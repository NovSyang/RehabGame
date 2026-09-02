import { Application, Graphics, Text } from 'pixi.js'
import type { GameInput } from '../../core/game-input/GameInput'
import type { ITrainingGame } from '../../core/game/ITrainingGame'
import type { Direction } from '../../core/training/Direction'
import { TrainingSession } from '../../core/training/TrainingSession'
import type { TrainingSessionState } from '../../core/training/TrainingSessionState'
import {
  defaultTargetReachGameConfig,
  type TargetReachGameConfig,
} from './TargetReachGameConfig'
import type { TargetReachGameEvents } from './TargetReachGameEvents'
import { circlesIntersect } from './TargetReachGeometry'
import { distanceBetween, getTargetPosition, type NormalizedPoint } from './TargetReachMath'
import {
  createTargetReachViewport,
  toTargetReachScreenPoint,
  type TargetReachViewportState,
} from './TargetReachViewportMapper'
import {
  buildTargetReachTrainingResult,
  type TargetAttemptResult,
  type TargetReachTrainingResult,
} from './TargetReachTrainingResult'

export type TargetContactState = 'outside' | 'holding' | 'success'

export interface TargetReachGameOptions {
  geometryDebug?: boolean
}

const VIEWPORT_PADDING = 70
const SUCCESS_PULSE_MS = 260

/** 使用归一化 GameInput 完成四方向目标触达训练的 PixiJS 游戏。 */
export class TargetReachGame implements ITrainingGame<TargetReachTrainingResult> {
  private app: Application | null = null
  private session = new TrainingSession()
  private latestInput: GameInput = emptyGameInput()
  private player: Graphics | null = null
  private targetOutside: Graphics | null = null
  private targetHolding: Graphics | null = null
  private holdProgressGraphic: Graphics | null = null
  private successPulse: Graphics | null = null
  private countdownText: Text | null = null
  private directionText: Text | null = null
  private debugGraphic: Graphics | null = null
  private debugText: Text | null = null
  private resizeObserver: ResizeObserver | null = null
  private resizeFrameId: number | null = null
  private viewport: TargetReachViewportState
  private currentDirection: Direction | null = null
  private targetStartedAt = 0
  private targetStartedElapsedMs = 0
  private firstMovementAt: number | null = null
  private currentReactionTimeMs: number | null = null
  private targetHoldStartedElapsedMs: number | null = null
  private currentMaxInput = 0
  private currentContactState: TargetContactState = 'outside'
  private currentDistance: number | null = null
  private currentHit = false
  private holdProgress = 0
  private renderedHoldProgress = -1
  private successPulsePoint: NormalizedPoint | null = null
  private successPulseStartedAt = 0
  private attempts: TargetAttemptResult[] = []
  private lastNotifiedState: TrainingSessionState = 'idle'

  constructor(
    private readonly config: TargetReachGameConfig = structuredClone(defaultTargetReachGameConfig),
    private readonly events: TargetReachGameEvents = {},
    private readonly options: TargetReachGameOptions = {},
  ) {
    this.viewport = createTargetReachViewport(
      0,
      0,
      this.config.playerRadiusNormalized,
      this.config.targetRadiusNormalized,
      VIEWPORT_PADDING,
    )
  }

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

    const player = new Graphics()
    const targetOutside = new Graphics()
    const targetHolding = new Graphics()
    const holdProgressGraphic = new Graphics()
    const successPulse = new Graphics()
    const countdownText = new Text({ text: '', style: { fill: '#ffffff', fontSize: 72, fontWeight: '700' } })
    const directionText = new Text({ text: '', style: { fill: '#8fd8ff', fontSize: 22, fontWeight: '600' } })
    const debugGraphic = new Graphics()
    const debugText = new Text({ text: '', style: { fill: '#dcecff', fontSize: 11, lineHeight: 15, fontFamily: 'monospace' } })
    countdownText.anchor.set(0.5)
    directionText.anchor.set(0.5)
    debugText.position.set(16, 14)
    targetOutside.visible = false
    targetHolding.visible = false
    holdProgressGraphic.visible = false
    successPulse.visible = false
    directionText.visible = false
    debugGraphic.visible = this.options.geometryDebug === true
    debugText.visible = this.options.geometryDebug === true
    app.stage.addChild(
      targetOutside,
      targetHolding,
      holdProgressGraphic,
      successPulse,
      player,
      directionText,
      countdownText,
      debugGraphic,
      debugText,
    )

    this.app = app
    this.player = player
    this.targetOutside = targetOutside
    this.targetHolding = targetHolding
    this.holdProgressGraphic = holdProgressGraphic
    this.successPulse = successPulse
    this.countdownText = countdownText
    this.directionText = directionText
    this.debugGraphic = debugGraphic
    this.debugText = debugText
    this.updateViewportGeometry(true)
    // 容器旋转或分屏后只重画尺寸相关图形，普通帧只更新位置和反馈状态。
    this.resizeObserver = new ResizeObserver(() => this.scheduleResize())
    this.resizeObserver.observe(container)
    app.ticker.add(() => {
      const now = performance.now()
      this.update(now)
      this.render(now)
    })
  }

  setInput(input: GameInput): void {
    this.latestInput = input
    const state = this.session.getSnapshot().state
    if (!input.connected && (state === 'playing' || state === 'countdown')) this.pause()
  }

  start(): void {
    if (!this.latestInput.connected) throw new Error('开始训练前必须连接 BS-BT91')
    if (!this.latestInput.calibrated) throw new Error('开始训练前必须完成中心校准')

    this.attempts = []
    this.currentDirection = null
    this.currentReactionTimeMs = null
    this.clearContactFeedback(true)
    this.session.start(performance.now(), 3000)
    this.notifySessionState()
  }

  pause(now = performance.now()): void {
    const state = this.session.getSnapshot(now).state
    if (state !== 'playing' && state !== 'countdown') return
    // 暂停会打断连续保持，恢复后必须重新满足完整 Hold 时间。
    this.clearContactFeedback(true)
    this.events.onReplayEvent?.({ elapsedMs: this.getTrainingElapsedMs(now), type: 'pause' })
    this.session.pause(now)
    this.notifySessionState()
  }

  resume(now = performance.now()): void {
    if (!this.latestInput.connected) throw new Error('传感器未连接，无法继续训练')
    if (!this.latestInput.calibrated) throw new Error('请重新完成中心校准后继续训练')
    if (this.session.getSnapshot(now).state !== 'paused') return
    this.session.resume(now)
    this.events.onReplayEvent?.({ elapsedMs: this.getTrainingElapsedMs(now), type: 'resume' })
    this.notifySessionState()
  }

  abort(): void {
    this.session.abort(performance.now())
    this.currentDirection = null
    this.clearContactFeedback(true)
    this.setTargetVisibility(false)
    if (this.directionText) this.directionText.visible = false
    this.notifySessionState()
  }

  destroy(): void {
    this.resizeObserver?.disconnect()
    this.resizeObserver = null
    if (this.resizeFrameId !== null) cancelAnimationFrame(this.resizeFrameId)
    this.resizeFrameId = null
    this.app?.destroy(true, { children: true })
    this.app = null
    this.player = null
    this.targetOutside = null
    this.targetHolding = null
    this.holdProgressGraphic = null
    this.successPulse = null
    this.countdownText = null
    this.directionText = null
    this.debugGraphic = null
    this.debugText = null
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
    if (this.getCurrentTargetElapsedMs(now) >= this.config.targetTimeoutMs) {
      this.finishCurrentTarget(now, false)
      return
    }
    this.updateCurrentAttempt(now)
  }

  private beginNextTarget(now: number): void {
    this.currentDirection = this.pickNextDirection()
    this.targetStartedAt = now
    this.targetStartedElapsedMs = this.session.getSnapshot(now).playingElapsedMs
    this.firstMovementAt = null
    this.currentReactionTimeMs = null
    this.clearContactFeedback(false)
    this.currentMaxInput = 0
    this.events.onTargetChanged?.(this.currentDirection, this.attempts.length + 1)
    const targetPoint = getTargetPosition(this.currentDirection, this.config.targetDistance)
    this.events.onReplayEvent?.({
      elapsedMs: this.getTrainingElapsedMs(now),
      type: 'target-start',
      payload: {
        index: this.attempts.length + 1,
        direction: this.currentDirection,
        targetX: targetPoint.x,
        targetY: targetPoint.y,
      },
    })
  }

  private updateCurrentAttempt(now: number): void {
    if (!this.currentDirection) return
    const targetPoint = getTargetPosition(this.currentDirection, this.config.targetDistance)
    const currentPoint = { x: this.latestInput.x, y: this.latestInput.y }
    const magnitude = Math.max(Math.abs(currentPoint.x), Math.abs(currentPoint.y))
    this.currentMaxInput = Math.max(this.currentMaxInput, magnitude)
    if (this.firstMovementAt === null && magnitude >= this.config.movementThreshold) {
      this.firstMovementAt = now
      // 反应时间在首次有效动作时固定，不会受后续暂停影响。
      this.currentReactionTimeMs = this.getCurrentTargetElapsedMs(now)
    }

    this.currentDistance = distanceBetween(currentPoint, targetPoint)
    this.currentHit = circlesIntersect(
      { center: currentPoint, radius: this.config.playerRadiusNormalized },
      { center: targetPoint, radius: this.config.targetRadiusNormalized },
    )
    if (!this.currentHit) {
      this.clearContactFeedback(false)
      return
    }

    const sessionElapsed = this.session.getSnapshot(now).playingElapsedMs
    this.targetHoldStartedElapsedMs ??= sessionElapsed
    const heldMs = Math.max(0, sessionElapsed - this.targetHoldStartedElapsedMs)
    this.currentContactState = 'holding'
    this.holdProgress = Math.min(1, heldMs / this.config.holdTimeMs)
    if (heldMs >= this.config.holdTimeMs) {
      this.currentContactState = 'success'
      this.holdProgress = 1
      this.finishCurrentTarget(now, true)
    }
  }

  private finishCurrentTarget(now: number, success: boolean): void {
    const direction = this.currentDirection
    if (!direction) return
    const completedTargetPoint = getTargetPosition(direction, this.config.targetDistance)
    this.attempts.push({
      index: this.attempts.length + 1,
      direction,
      startedAt: this.targetStartedAt,
      firstMovementAt: this.firstMovementAt,
      reachedAt: success ? now : null,
      endedAt: now,
      success,
      // 所有受暂停影响的业务时间使用 TrainingSession 的有效训练时间轴。
      reactionTimeMs: this.currentReactionTimeMs === null ? null : Math.max(0, this.currentReactionTimeMs),
      reachTimeMs: success ? Math.max(0, this.getCurrentTargetElapsedMs(now)) : null,
      maxInput: this.currentMaxInput,
    })
    this.events.onReplayEvent?.({
      elapsedMs: this.getTrainingElapsedMs(now),
      type: success ? 'target-success' : 'target-failed',
      payload: { index: this.attempts.length },
    })
    if (success) {
      // 成功脉冲只提供视觉确认，不推迟下一目标或修改业务时间轴。
      this.successPulsePoint = completedTargetPoint
      this.successPulseStartedAt = now
    }
    this.currentDirection = null
    this.targetHoldStartedElapsedMs = null
    this.currentHit = false
    this.currentDistance = null
    this.currentContactState = success ? 'success' : 'outside'
    this.holdProgress = success ? 1 : 0
    this.setTargetVisibility(false)
    const successCount = this.attempts.filter((attempt) => attempt.success).length
    this.events.onScoreChanged?.(successCount, this.attempts.length)
  }

  private complete(now: number): void {
    this.session.complete(now)
    this.currentDirection = null
    this.setTargetVisibility(false)
    if (this.directionText) this.directionText.visible = false
    const snapshot = this.session.getSnapshot(now)
    const result = buildTargetReachTrainingResult(
      snapshot.startedAt ?? now,
      snapshot.completedAt ?? now,
      snapshot.playingElapsedMs,
      this.attempts,
    )
    this.notifySessionState()
    this.events.onCompleted?.(result)
  }

  /** 返回当前目标已消耗的有效训练时间，自动排除任意次数的暂停。 */
  private getCurrentTargetElapsedMs(now: number): number {
    const sessionElapsed = this.session.getSnapshot(now).playingElapsedMs
    return Math.max(0, sessionElapsed - this.targetStartedElapsedMs)
  }

  /** 供训练页 Recorder 使用的有效训练时间，不包含真实暂停时长。 */
  getTrainingElapsedMs(now = performance.now()): number {
    return this.session.getSnapshot(now).playingElapsedMs
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
    const { app, player, countdownText, directionText } = this
    if (!app || !player || !countdownText || !directionText) return
    this.updateViewportGeometry()
    const playerPoint = toTargetReachScreenPoint({ x: this.latestInput.x, y: this.latestInput.y }, this.viewport)
    player.position.set(playerPoint.x, playerPoint.y)
    player.alpha = this.latestInput.connected ? 1 : 0.35
    const snapshot = this.session.getSnapshot(now)
    const targetVisible = this.currentDirection !== null && snapshot.state === 'playing'

    if (this.currentDirection) {
      const point = getTargetPosition(this.currentDirection, this.config.targetDistance)
      const targetPoint = toTargetReachScreenPoint(point, this.viewport)
      this.setTargetPosition(targetPoint.x, targetPoint.y)
      directionText.text = directionLabel(this.currentDirection)
      directionText.position.set(this.viewport.centerX, 40)
      directionText.visible = snapshot.state === 'playing'
    } else directionText.visible = false

    this.setTargetVisibility(targetVisible)
    this.renderHoldFeedback(targetVisible)
    this.renderSuccessPulse(now)
    if (snapshot.state === 'countdown') {
      countdownText.text = String(Math.max(1, Math.ceil(snapshot.countdownRemainingMs / 1000)))
      countdownText.position.set(this.viewport.centerX, this.viewport.centerY)
      countdownText.visible = true
      this.setTargetVisibility(false)
      directionText.visible = false
    } else countdownText.visible = false
    this.renderDiagnostics(now)
  }

  private updateViewportGeometry(force = false): void {
    if (!this.app || !this.player || !this.targetOutside || !this.targetHolding || !this.successPulse) return
    const next = createTargetReachViewport(
      this.app.screen.width,
      this.app.screen.height,
      this.config.playerRadiusNormalized,
      this.config.targetRadiusNormalized,
      VIEWPORT_PADDING,
    )
    if (!force && next.width === this.viewport.width && next.height === this.viewport.height) return
    this.viewport = next
    this.player.clear().ellipse(0, 0, next.playerRadiusX, next.playerRadiusY).fill(0x68d391)
    this.targetOutside.clear()
      .ellipse(0, 0, next.targetRadiusX, next.targetRadiusY)
      .fill({ color: 0x4da3ff, alpha: 0.1 })
      // 描边向内绘制，患者看到的最外边界仍是业务圆的真实边界。
      .stroke({ width: 4, color: 0x4da3ff, alpha: 1, alignment: 1 })
    this.targetHolding.clear()
      .ellipse(0, 0, next.targetRadiusX, next.targetRadiusY)
      .fill({ color: 0x68d391, alpha: 0.16 })
      .stroke({ width: 5, color: 0x7ee8b0, alpha: 1, alignment: 1 })
    this.successPulse.clear()
      .ellipse(0, 0, next.targetRadiusX + 7, next.targetRadiusY + 7)
      .stroke({ width: 5, color: 0x68d391, alpha: 1 })
    this.renderedHoldProgress = -1
    this.drawHoldProgress(this.holdProgress)
  }

  private scheduleResize(): void {
    if (this.resizeFrameId !== null) cancelAnimationFrame(this.resizeFrameId)
    this.resizeFrameId = requestAnimationFrame(() => {
      this.resizeFrameId = null
      this.updateViewportGeometry(true)
      this.render(performance.now())
    })
  }

  private setTargetPosition(x: number, y: number): void {
    this.targetOutside?.position.set(x, y)
    this.targetHolding?.position.set(x, y)
    this.holdProgressGraphic?.position.set(x, y)
  }

  private setTargetVisibility(visible: boolean): void {
    if (this.targetOutside) this.targetOutside.visible = visible && this.currentContactState === 'outside'
    if (this.targetHolding) this.targetHolding.visible = visible && this.currentContactState !== 'outside'
    if (this.holdProgressGraphic) this.holdProgressGraphic.visible = visible && this.currentContactState === 'holding'
  }

  private renderHoldFeedback(targetVisible: boolean): void {
    if (this.renderedHoldProgress !== this.holdProgress) this.drawHoldProgress(this.holdProgress)
    this.setTargetVisibility(targetVisible)
  }

  private drawHoldProgress(progress: number): void {
    const graphic = this.holdProgressGraphic
    if (!graphic) return
    const safeProgress = Math.max(0, Math.min(1, progress))
    this.renderedHoldProgress = safeProgress
    graphic.clear()
    if (safeProgress <= 0 || this.viewport.targetRadiusX <= 0 || this.viewport.targetRadiusY <= 0) return
    // Pixi 没有椭圆弧 API，使用少量线段绘制连续 Hold 光圈。
    const segmentCount = Math.max(2, Math.ceil(64 * safeProgress))
    for (let index = 0; index <= segmentCount; index += 1) {
      const angle = -Math.PI / 2 + Math.PI * 2 * safeProgress * (index / segmentCount)
      const x = Math.cos(angle) * (this.viewport.targetRadiusX + 7)
      const y = Math.sin(angle) * (this.viewport.targetRadiusY + 7)
      if (index === 0) graphic.moveTo(x, y)
      else graphic.lineTo(x, y)
    }
    graphic.stroke({ width: 4, color: 0xb6f5d1, alpha: 1 })
  }

  private renderSuccessPulse(now: number): void {
    if (!this.successPulse || !this.successPulsePoint) return
    const elapsed = Math.max(0, now - this.successPulseStartedAt)
    if (elapsed >= SUCCESS_PULSE_MS) {
      this.successPulse.visible = false
      this.successPulse.scale.set(1)
      this.successPulsePoint = null
      return
    }
    const point = toTargetReachScreenPoint(this.successPulsePoint, this.viewport)
    const progress = elapsed / SUCCESS_PULSE_MS
    this.successPulse.position.set(point.x, point.y)
    this.successPulse.scale.set(1 + progress * 0.2)
    this.successPulse.alpha = 1 - progress
    this.successPulse.visible = true
  }

  private clearContactFeedback(clearPulse: boolean): void {
    this.targetHoldStartedElapsedMs = null
    this.currentContactState = 'outside'
    this.currentDistance = null
    this.currentHit = false
    this.holdProgress = 0
    if (clearPulse) {
      this.successPulsePoint = null
      if (this.successPulse) this.successPulse.visible = false
    }
  }

  private renderDiagnostics(now: number): void {
    if (!this.options.geometryDebug || !this.debugGraphic || !this.debugText) return
    const playerNormalized = { x: this.latestInput.x, y: this.latestInput.y }
    const targetNormalized = this.currentDirection ? getTargetPosition(this.currentDirection, this.config.targetDistance) : null
    const playerScreen = toTargetReachScreenPoint(playerNormalized, this.viewport)
    const targetScreen = targetNormalized ? toTargetReachScreenPoint(targetNormalized, this.viewport) : null
    const distance = targetNormalized ? (this.currentDistance ?? distanceBetween(playerNormalized, targetNormalized)) : null
    const sessionElapsed = this.session.getSnapshot(now).playingElapsedMs
    const heldMs = this.targetHoldStartedElapsedMs === null ? 0 : Math.max(0, sessionElapsed - this.targetHoldStartedElapsedMs)

    const graphic = this.debugGraphic.clear().roundRect(8, 8, 274, 174, 8).fill({ color: 0x040d18, alpha: 0.82 })
    graphic.ellipse(playerScreen.x, playerScreen.y, this.viewport.playerRadiusX, this.viewport.playerRadiusY)
      .stroke({ width: 1, color: 0xffd166, alpha: 0.9 })
    graphic.circle(playerScreen.x, playerScreen.y, 2).fill(0xffd166)
    if (targetScreen) {
      graphic.moveTo(playerScreen.x, playerScreen.y).lineTo(targetScreen.x, targetScreen.y)
        .stroke({ width: 1, color: 0xffd166, alpha: 0.7 })
      graphic.ellipse(targetScreen.x, targetScreen.y, this.viewport.targetRadiusX, this.viewport.targetRadiusY)
        .stroke({ width: 1, color: 0xffd166, alpha: 0.9 })
      graphic.circle(targetScreen.x, targetScreen.y, 2).fill(0xffd166)
    }
    this.debugText.text = [
      `Canvas: ${this.viewport.width.toFixed(0)} x ${this.viewport.height.toFixed(0)}`,
      `Range: X ${this.viewport.rangeX.toFixed(0)} / Y ${this.viewport.rangeY.toFixed(0)}`,
      `Input: ${playerNormalized.x.toFixed(3)}, ${playerNormalized.y.toFixed(3)}`,
      `Target: ${targetNormalized ? `${targetNormalized.x.toFixed(3)}, ${targetNormalized.y.toFixed(3)}` : '--'}`,
      `Distance: ${distance === null ? '--' : distance.toFixed(3)}`,
      `Player Radius: ${this.config.playerRadiusNormalized.toFixed(3)}`,
      `Target Radius: ${this.config.targetRadiusNormalized.toFixed(3)}`,
      `Hit Threshold: ${(this.config.playerRadiusNormalized + this.config.targetRadiusNormalized).toFixed(3)}`,
      `Hit: ${this.currentHit}`,
      `Hold: ${Math.min(this.config.holdTimeMs, heldMs).toFixed(0)} / ${this.config.holdTimeMs} ms`,
    ].join('\n')
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
