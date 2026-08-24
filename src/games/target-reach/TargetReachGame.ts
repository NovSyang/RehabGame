import { Application, Graphics, Text } from 'pixi.js'
import type { GameInput } from '../../core/game-input/GameInput'
import type { Direction } from '../../core/training/Direction'
import { TrainingSession } from '../../core/training/TrainingSession'
import type { TrainingSessionState } from '../../core/training/TrainingSessionState'
import {
  buildTrainingResult,
  type TargetAttemptResult,
} from '../../core/training/TrainingResult'
import {
  defaultTargetReachGameConfig,
  type TargetReachGameConfig,
} from './TargetReachGameConfig'
import type { TargetReachGameEvents } from './TargetReachGameEvents'
import { distanceBetween, getTargetPosition } from './TargetReachMath'

/** 使用归一化 GameInput 完成四方向目标触达训练的 PixiJS 游戏。 */
export class TargetReachGame {
  private app: Application | null = null
  private session = new TrainingSession()
  private latestInput: GameInput = emptyGameInput()
  private player: Graphics | null = null
  private target: Graphics | null = null
  private countdownText: Text | null = null
  private directionText: Text | null = null
  private currentDirection: Direction | null = null
  private targetStartedAt = 0
  private targetPausedAt = 0
  private firstMovementAt: number | null = null
  private targetHoldStartedAt: number | null = null
  private currentMaxInput = 0
  private attempts: TargetAttemptResult[] = []
  private lastNotifiedState: TrainingSessionState = 'idle'

  constructor(
    private readonly config: TargetReachGameConfig = structuredClone(defaultTargetReachGameConfig),
    private readonly events: TargetReachGameEvents = {},
  ) {}

  async mount(container: HTMLElement): Promise<void> {
    this.destroy()
    const app = new Application()
    await app.init({
      resizeTo: container,
      antialias: true,
      background: '#08111f',
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
    })
    container.appendChild(app.canvas)

    const player = new Graphics().circle(0, 0, this.config.playerRadius).fill('#68d391')
    const target = new Graphics().circle(0, 0, 34).stroke({ width: 5, color: '#4da3ff', alpha: 1 })
    const countdownText = new Text({ text: '', style: { fill: '#ffffff', fontSize: 72, fontWeight: '700' } })
    const directionText = new Text({ text: '', style: { fill: '#8fd8ff', fontSize: 22, fontWeight: '600' } })
    countdownText.anchor.set(0.5)
    directionText.anchor.set(0.5)
    target.visible = false
    directionText.visible = false
    app.stage.addChild(target, player, directionText, countdownText)

    this.app = app
    this.player = player
    this.target = target
    this.countdownText = countdownText
    this.directionText = directionText
    app.ticker.add(() => {
      const now = performance.now()
      this.update(now)
      this.render(now)
    })
  }

  setInput(input: GameInput): void {
    this.latestInput = input
    if (!input.connected && this.session.getSnapshot().state === 'playing') this.pause()
  }

  start(): void {
    if (!this.latestInput.connected) throw new Error('开始训练前必须连接 BS-BT91')
    if (!this.latestInput.calibrated) throw new Error('开始训练前必须完成中心校准')

    this.attempts = []
    this.currentDirection = null
    this.targetHoldStartedAt = null
    this.targetPausedAt = 0
    this.session.start(performance.now(), 3000)
    this.notifySessionState()
  }

  pause(): void {
    const now = performance.now()
    if (this.session.getSnapshot(now).state !== 'playing') return
    this.targetPausedAt = now
    this.session.pause(now)
    this.notifySessionState()
  }

  resume(): void {
    if (!this.latestInput.connected) throw new Error('传感器未连接，无法继续训练')
    if (!this.latestInput.calibrated) throw new Error('请重新完成中心校准后继续训练')

    const now = performance.now()
    if (this.session.getSnapshot(now).state !== 'paused') return
    if (this.targetPausedAt > 0 && this.currentDirection) {
      this.targetStartedAt += now - this.targetPausedAt
    }
    this.targetPausedAt = 0
    this.session.resume(now)
    this.notifySessionState()
  }

  abort(): void {
    this.session.abort(performance.now())
    if (this.target) this.target.visible = false
    if (this.directionText) this.directionText.visible = false
    this.notifySessionState()
  }

  destroy(): void {
    this.app?.destroy(true, { children: true })
    this.app = null
    this.player = null
    this.target = null
    this.countdownText = null
    this.directionText = null
  }

  private update(now: number): void {
    this.session.update(now)
    this.notifySessionState()
    const snapshot = this.session.getSnapshot(now)
    if (snapshot.state === 'countdown' || snapshot.state !== 'playing') return

    if (snapshot.playingElapsedMs >= this.config.sessionDurationMs || this.attempts.length >= this.config.targetCount) {
      this.complete(now)
      return
    }
    if (this.currentDirection === null) {
      this.beginNextTarget(now)
      return
    }
    if (now - this.targetStartedAt >= this.config.targetTimeoutMs) {
      this.finishCurrentTarget(now, false)
      return
    }
    this.updateCurrentAttempt(now)
  }

  private beginNextTarget(now: number): void {
    this.currentDirection = this.pickNextDirection()
    this.targetStartedAt = now
    this.firstMovementAt = null
    this.targetHoldStartedAt = null
    this.currentMaxInput = 0
    if (this.target) this.target.visible = true
    this.events.onTargetChanged?.(this.currentDirection, this.attempts.length + 1)
  }

  private updateCurrentAttempt(now: number): void {
    if (!this.currentDirection) return
    const targetPoint = getTargetPosition(this.currentDirection, this.config.targetDistance)
    const currentPoint = { x: this.latestInput.x, y: this.latestInput.y }
    const magnitude = Math.max(Math.abs(currentPoint.x), Math.abs(currentPoint.y))
    this.currentMaxInput = Math.max(this.currentMaxInput, magnitude)
    if (this.firstMovementAt === null && magnitude >= this.config.movementThreshold) {
      this.firstMovementAt = now
    }

    if (distanceBetween(currentPoint, targetPoint) <= this.config.targetRadius) {
      this.targetHoldStartedAt ??= now
      if (now - this.targetHoldStartedAt >= this.config.holdTimeMs) this.finishCurrentTarget(now, true)
    } else {
      this.targetHoldStartedAt = null
    }
  }

  private finishCurrentTarget(now: number, success: boolean): void {
    const direction = this.currentDirection
    if (!direction) return
    this.attempts.push({
      index: this.attempts.length + 1,
      direction,
      startedAt: this.targetStartedAt,
      firstMovementAt: this.firstMovementAt,
      reachedAt: success ? now : null,
      endedAt: now,
      success,
      reactionTimeMs: this.firstMovementAt === null ? null : this.firstMovementAt - this.targetStartedAt,
      reachTimeMs: success ? now - this.targetStartedAt : null,
      maxInput: this.currentMaxInput,
    })
    this.currentDirection = null
    this.targetHoldStartedAt = null
    if (this.target) this.target.visible = false
    const successCount = this.attempts.filter((attempt) => attempt.success).length
    this.events.onScoreChanged?.(successCount, this.attempts.length)
  }

  private complete(now: number): void {
    this.session.complete(now)
    if (this.target) this.target.visible = false
    if (this.directionText) this.directionText.visible = false
    const snapshot = this.session.getSnapshot(now)
    const result = buildTrainingResult(
      snapshot.startedAt ?? now,
      snapshot.completedAt ?? now,
      snapshot.playingElapsedMs,
      this.attempts,
    )
    this.notifySessionState()
    this.events.onCompleted?.(result)
  }

  private pickNextDirection(): Direction {
    const directions = this.config.enabledDirections
    if (directions.length === 0) throw new Error('至少启用一个训练方向')
    if (directions.length === 1) return directions[0]
    const lastDirection = this.attempts.at(-1)?.direction
    const candidates = lastDirection ? directions.filter((direction) => direction !== lastDirection) : directions
    return candidates[Math.floor(Math.random() * candidates.length)]
  }

  private render(now: number): void {
    const { app, player, target, countdownText, directionText } = this
    if (!app || !player || !target || !countdownText || !directionText) return
    const centerX = app.screen.width / 2
    const centerY = app.screen.height / 2
    const rangeX = Math.max(0, app.screen.width / 2 - 70)
    const rangeY = Math.max(0, app.screen.height / 2 - 70)
    player.position.set(centerX + this.latestInput.x * rangeX, centerY - this.latestInput.y * rangeY)
    player.alpha = this.latestInput.connected ? 1 : 0.35
    const snapshot = this.session.getSnapshot(now)

    if (this.currentDirection) {
      const point = getTargetPosition(this.currentDirection, this.config.targetDistance)
      target.position.set(centerX + point.x * rangeX, centerY - point.y * rangeY)
      directionText.text = directionLabel(this.currentDirection)
      directionText.position.set(centerX, 40)
      directionText.visible = snapshot.state === 'playing'
    }
    if (snapshot.state === 'countdown') {
      countdownText.text = String(Math.max(1, Math.ceil(snapshot.countdownRemainingMs / 1000)))
      countdownText.position.set(centerX, centerY)
      countdownText.visible = true
      target.visible = false
      directionText.visible = false
    } else {
      countdownText.visible = false
    }
  }

  private notifySessionState(): void {
    const state = this.session.getSnapshot().state
    if (state === this.lastNotifiedState) return
    this.lastNotifiedState = state
    this.events.onSessionStateChanged?.(state)
  }
}

function emptyGameInput(): GameInput {
  return { x: 0, y: 0, connected: false, calibrated: false, timestamp: 0 }
}

function directionLabel(direction: Direction): string {
  return { left: '向左触达', right: '向右触达', forward: '向前触达', backward: '向后触达' }[direction]
}
