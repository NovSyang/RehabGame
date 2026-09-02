import { Application, Assets, Container, Graphics, Particle, ParticleContainer, Sprite, Text, Texture, TilingSprite } from 'pixi.js'
import type { GameInput } from '../../core/game-input/GameInput'
import type { ITrainingGame } from '../../core/game/ITrainingGame'
import type { TrainingGameEvents } from '../../core/game/TrainingGameEvents'
import { TrainingSession } from '../../core/training/TrainingSession'
import type { TrainingSessionState } from '../../core/training/TrainingSessionState'
import { applyRiverDeadZone, collisionAllowed, difficultyRangeScale, getForwardSpeed, holdStability, laneX, updateHoldProgress, updateHorizontalVelocity } from './RiverControl'
import { RiverDifficultyManager } from './RiverDifficultyManager'
import { defaultRiverGameConfig, type RiverDifficulty, type RiverGameConfig, type RiverLane } from './RiverGameConfig'
import { createForestRiverLevel, type RiverLevelObject } from './RiverLevel'
import type { RiverBoatSample, RiverReplayObject, RiverRunSnapshot } from './RiverReplayTypes'
import { buildRiverTrainingResult, scoreForSuccess, type RiverTrainingResult } from './RiverTrainingResult'
import { RiverAudioController } from './RiverAudioController'

type Outcome = RiverReplayObject['outcome']
interface RuntimeObject extends RiverLevelObject {
  difficulty: RiverDifficulty | null
  rangeScale: number
  outcome: Outcome
  holdProgressMs: number
  holdStabilitySum: number
  holdStabilitySamples: number
  holdSampleAccumulatorMs: number
  reactionStartedElapsedMs: number | null
  reactionMs: number | null
  display: Container | null
}

/** 森林溪谷漂流只消费标准化 GameInput，并以有效训练时间推进固定关卡。 */
export class RiverGame implements ITrainingGame<RiverTrainingResult> {
  private readonly session = new TrainingSession()
  private readonly level = createForestRiverLevel()
  private readonly difficulty: RiverDifficultyManager
  private audio = new RiverAudioController()
  private app: Application | null = null
  private scene: Container | null = null
  private worldLayer: Container | null = null
  private decorLayer: Container | null = null
  private waterParticles: ParticleContainer | null = null
  private river: TilingSprite | null = null
  private boat: Container | null = null
  private countdownText: Text | null = null
  private missionText: Text | null = null
  private resizeObserver: ResizeObserver | null = null
  private latestInput = emptyInput()
  private objects: RuntimeObject[] = []
  private boatX = 0
  private horizontalVelocity = 0
  private progress = 0
  private forwardSpeed = 60
  private lastTrainingElapsedMs = 0
  private lastNotifiedState: TrainingSessionState = 'idle'
  private resumeCountdownEndsAt: number | null = null
  private collisionSlowUntilElapsedMs = 0
  private collisionProtectedUntilElapsedMs = 0
  private combo = 0
  private maxCombo = 0
  private score = 0
  private collisionCount = 0
  private accelerationDurationMs = 0
  private decelerationDurationMs = 0
  private speedSamples: number[] = []
  private inputSamples: { x: number; y: number }[] = []
  private successfulGateDirections: RiverLane[] = []
  private gateReactionTimesMs: number[] = []
  private holdStabilities: number[] = []
  private boatSamples: RiverBoatSample[] = []
  private nextMetricSampleMs = 0
  private textures = new Map<string, Texture>()

  constructor(
    private readonly config: RiverGameConfig = structuredClone(defaultRiverGameConfig),
    private readonly events: TrainingGameEvents<RiverTrainingResult> = {},
  ) {
    this.difficulty = new RiverDifficultyManager(config.difficultyCooldownMs)
  }

  async mount(container: HTMLElement): Promise<void> {
    this.destroy()
    this.audio = new RiverAudioController()
    const app = new Application()
    await app.init({ resizeTo: container, antialias: true, background: '#10283a', resolution: Math.min(window.devicePixelRatio || 1, 2), autoDensity: true })
    container.appendChild(app.canvas)
    this.app = app
    this.buildScene()
    await this.loadArt()
    this.resizeObserver = new ResizeObserver(() => requestAnimationFrame(() => this.layoutScene()))
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
    this.resetRun()
    this.session.start(performance.now(), 3_000)
    this.notifySessionState()
    this.publishHud()
  }

  pause(now = performance.now()): void {
    const state = this.session.getSnapshot(now).state
    if (state !== 'playing' && state !== 'countdown') return
    this.resumeCountdownEndsAt = null
    this.events.onReplayEvent?.({ elapsedMs: this.getTrainingElapsedMs(now), type: 'pause' })
    this.session.pause(now)
    this.audio.pause()
    this.notifySessionState()
    this.publishHud()
  }

  resume(now = performance.now()): void {
    if (!this.latestInput.connected) throw new Error('传感器未连接，无法继续训练')
    if (!this.latestInput.calibrated) throw new Error('请重新完成中心校准后继续训练')
    if (this.session.getSnapshot(now).state !== 'paused' || this.resumeCountdownEndsAt !== null) return
    // River 每次恢复先显示独立的三秒准备，不推进 TrainingSession 和 Replay 时间。
    this.resumeCountdownEndsAt = now + 3_000
    this.publishHud()
  }

  abort(): void {
    this.resumeCountdownEndsAt = null
    this.session.abort(performance.now())
    this.audio.pause()
    this.notifySessionState()
  }

  destroy(): void {
    this.resizeObserver?.disconnect()
    this.resizeObserver = null
    this.audio.destroy()
    this.app?.destroy(true, { children: true })
    this.app = null
    this.scene = null
    this.worldLayer = null
    this.decorLayer = null
    this.waterParticles = null
    this.river = null
    this.boat = null
    this.countdownText = null
    this.missionText = null
    this.textures.clear()
  }

  getTrainingElapsedMs(now = performance.now()): number { return this.session.getSnapshot(now).playingElapsedMs }

  private resetRun(): void {
    this.difficulty.reset()
    this.objects = this.level.objects.map((object) => ({ ...object, difficulty: null, rangeScale: 1, outcome: 'unresolved', holdProgressMs: 0, holdStabilitySum: 0, holdStabilitySamples: 0, holdSampleAccumulatorMs: 0, reactionStartedElapsedMs: null, reactionMs: null, display: null }))
    this.boatX = 0
    this.horizontalVelocity = 0
    this.progress = 0
    this.forwardSpeed = this.config.centerForwardSpeed
    this.lastTrainingElapsedMs = 0
    this.resumeCountdownEndsAt = null
    this.collisionSlowUntilElapsedMs = 0
    this.collisionProtectedUntilElapsedMs = 0
    this.combo = 0
    this.maxCombo = 0
    this.score = 0
    this.collisionCount = 0
    this.accelerationDurationMs = 0
    this.decelerationDurationMs = 0
    this.speedSamples = []
    this.inputSamples = []
    this.successfulGateDirections = []
    this.gateReactionTimesMs = []
    this.holdStabilities = []
    this.boatSamples = []
    this.nextMetricSampleMs = 0
    this.rebuildWorldObjects()
  }

  private update(now: number): void {
    if (this.resumeCountdownEndsAt !== null) {
      if (now < this.resumeCountdownEndsAt) return
      this.resumeCountdownEndsAt = null
      this.session.resume(now)
      this.events.onReplayEvent?.({ elapsedMs: this.getTrainingElapsedMs(now), type: 'resume' })
      this.audio.resume()
      this.notifySessionState()
    }
    this.session.update(now)
    this.notifySessionState()
    const snapshot = this.session.getSnapshot(now)
    if (snapshot.state === 'countdown') return
    if (snapshot.state !== 'playing' || !this.latestInput.connected || !this.latestInput.calibrated) return
    if (this.lastTrainingElapsedMs === 0) this.audio.playBgm()
    const deltaMs = Math.min(100, Math.max(0, snapshot.playingElapsedMs - this.lastTrainingElapsedMs))
    this.lastTrainingElapsedMs = snapshot.playingElapsedMs
    const dt = deltaMs / 1_000
    const x = applyRiverDeadZone(this.latestInput.x, this.config.inputDeadZone)
    const y = applyRiverDeadZone(this.latestInput.y, this.config.inputDeadZone)
    this.horizontalVelocity = updateHorizontalVelocity(this.horizontalVelocity, x, dt, this.config.horizontalAcceleration, this.config.horizontalMaxSpeed, this.config.centerDamping)
    const minX = -this.config.riverHalfWidth + 55
    const maxX = this.config.riverHalfWidth - 55
    const nextBoatX = this.boatX + this.horizontalVelocity * dt
    this.boatX = Math.max(minX, Math.min(maxX, nextBoatX))
    if (nextBoatX < minX || nextBoatX > maxX) this.horizontalVelocity *= 0.25
    this.forwardSpeed = getForwardSpeed(y, this.config.minForwardSpeed, this.config.centerForwardSpeed, this.config.maxForwardSpeed)
    if (snapshot.playingElapsedMs < this.collisionSlowUntilElapsedMs) this.forwardSpeed *= this.config.collisionSpeedMultiplier
    this.progress = Math.min(this.config.levelLength, this.progress + this.forwardSpeed * dt)
    if (y > 0) this.accelerationDurationMs += deltaMs
    if (y < 0) this.decelerationDurationMs += deltaMs
    this.activateObjects(snapshot.playingElapsedMs)
    this.resolveObjects(snapshot.playingElapsedMs, deltaMs)
    this.captureMetrics(snapshot.playingElapsedMs)
    this.publishHud()
    if (this.progress >= this.config.levelLength) this.complete(now)
  }

  private activateObjects(elapsedMs: number): void {
    for (const object of this.objects) {
      if (object.difficulty !== null || object.distance - this.progress > 900) continue
      object.difficulty = this.difficulty.getCurrent()
      const rangeKind = object.kind === 'star' ? 'collect' : object.kind === 'obstacle' ? 'obstacle' : object.kind
      object.rangeScale = difficultyRangeScale(rangeKind, object.difficulty)
      if (object.kind === 'gate') object.reactionStartedElapsedMs = elapsedMs
    }
  }

  private resolveObjects(elapsedMs: number, deltaMs: number): void {
    for (const object of this.objects) {
      if (object.outcome !== 'unresolved' || object.difficulty === null) continue
      const delta = object.distance - this.progress
      if (object.kind === 'star') this.resolveStar(object, delta, elapsedMs)
      else if (object.kind === 'gate') this.resolveGate(object, delta, elapsedMs)
      else if (object.kind === 'obstacle') this.resolveObstacle(object, delta, elapsedMs)
      else this.resolveHold(object, delta, elapsedMs, deltaMs)
    }
  }

  private resolveStar(object: RuntimeObject, delta: number, elapsedMs: number): void {
    const hit = Math.abs(delta) <= 36 && Math.abs(this.boatX - laneX(object.lane)) <= 82 * object.rangeScale
    if (hit) this.recordSuccess(object, elapsedMs, 100, 'collect')
    else if (delta < -45) this.recordFailure(object, elapsedMs, 'collect-missed')
  }

  private resolveGate(object: RuntimeObject, delta: number, elapsedMs: number): void {
    if (object.reactionMs === null && gateInputMatched(this.latestInput, object.direction ?? object.lane)) {
      object.reactionMs = Math.max(0, elapsedMs - (object.reactionStartedElapsedMs ?? elapsedMs))
    }
    if (delta >= 0) return
    const success = Math.abs(this.boatX - laneX(object.lane)) <= 125 * object.rangeScale
    if (success) {
      this.successfulGateDirections.push(object.direction ?? object.lane)
      if (object.reactionMs !== null) this.gateReactionTimesMs.push(object.reactionMs)
      this.recordSuccess(object, elapsedMs, 200, 'gate')
    } else this.recordFailure(object, elapsedMs, 'gate-missed')
  }

  private resolveObstacle(object: RuntimeObject, delta: number, elapsedMs: number): void {
    const hitRadius = 78 / object.rangeScale
    if (Math.abs(delta) <= 30 && Math.abs(this.boatX - laneX(object.lane)) <= hitRadius && collisionAllowed(elapsedMs, this.collisionProtectedUntilElapsedMs)) {
      object.outcome = 'collision'
      this.collisionCount += 1
      this.combo = 0
      this.collisionSlowUntilElapsedMs = elapsedMs + this.config.collisionSlowMs
      this.collisionProtectedUntilElapsedMs = elapsedMs + this.config.collisionProtectionMs
      this.recordDifficulty(false, elapsedMs)
      this.audio.playEffect('collision')
      this.events.onReplayEvent?.({ elapsedMs, type: 'collision', payload: { id: object.id } })
    } else if (delta < -45) object.outcome = 'success'
  }

  private resolveHold(object: RuntimeObject, delta: number, elapsedMs: number, deltaMs: number): void {
    const length = object.length ?? this.config.holdLength
    const insideLongitudinal = delta <= 0 && delta >= -length
    if (insideLongitudinal) {
      const stability = holdStability(this.boatX - laneX(object.lane), 130 * object.rangeScale)
      // 稳定度固定按 25Hz 采样，画面帧率不会改变统计权重。
      object.holdSampleAccumulatorMs += deltaMs
      while (object.holdSampleAccumulatorMs >= 40) {
        object.holdStabilitySum += stability
        object.holdStabilitySamples += 1
        object.holdSampleAccumulatorMs -= 40
      }
      object.holdProgressMs = updateHoldProgress(object.holdProgressMs, stability > 0, deltaMs)
    }
    if (delta < -length) {
      const stability = object.holdStabilitySamples === 0 ? 0 : object.holdStabilitySum / object.holdStabilitySamples
      this.holdStabilities.push(stability)
      if (object.holdProgressMs >= this.config.holdRequiredMs) this.recordSuccess(object, elapsedMs, 300, 'hold')
      else this.recordFailure(object, elapsedMs, 'hold-failed')
    }
  }

  private recordSuccess(object: RuntimeObject, elapsedMs: number, baseScore: number, eventType: string): void {
    object.outcome = 'success'
    this.combo += 1
    this.maxCombo = Math.max(this.maxCombo, this.combo)
    this.score += scoreForSuccess(baseScore, this.combo)
    this.recordDifficulty(true, elapsedMs)
    this.audio.playEffect(eventType === 'collect' ? 'collect' : eventType === 'gate' ? 'gate' : 'hold')
    this.events.onReplayEvent?.({ elapsedMs, type: eventType, payload: { id: object.id, combo: this.combo, score: this.score } })
  }

  private recordFailure(object: RuntimeObject, elapsedMs: number, eventType: string): void {
    object.outcome = 'failed'
    this.combo = 0
    this.recordDifficulty(false, elapsedMs)
    this.events.onReplayEvent?.({ elapsedMs, type: eventType, payload: { id: object.id } })
  }

  private recordDifficulty(success: boolean, elapsedMs: number): void {
    const changed = success ? this.difficulty.recordSuccess(elapsedMs) : this.difficulty.recordFailure(elapsedMs)
    if (changed) this.events.onReplayEvent?.({ elapsedMs, type: 'difficulty', payload: { difficulty: changed } })
  }

  private captureMetrics(elapsedMs: number): void {
    while (this.nextMetricSampleMs <= elapsedMs) {
      this.speedSamples.push(this.forwardSpeed)
      this.inputSamples.push({ x: this.latestInput.x, y: this.latestInput.y })
      this.boatSamples.push({ elapsedMs: Math.round(this.nextMetricSampleMs), boatX: round(this.boatX), progress: round(this.progress), speed: round(this.forwardSpeed), rotation: round(this.horizontalVelocity / this.config.horizontalMaxSpeed * 0.22), state: this.collisionSlowUntilElapsedMs > elapsedMs ? 'collision-slow' : 'sailing' })
      this.nextMetricSampleMs += 40
    }
  }

  private complete(now: number): void {
    if (this.session.getSnapshot(now).state !== 'playing') return
    this.session.complete(now)
    const snapshot = this.session.getSnapshot(now)
    const runSnapshot: RiverRunSnapshot = {
      levelLength: this.config.levelLength,
      riverHalfWidth: this.config.riverHalfWidth,
      objects: this.objects.map((object) => ({ id: object.id, kind: object.kind, distance: object.distance, lane: object.lane, difficulty: object.difficulty ?? 'normal', rangeScale: object.rangeScale, outcome: object.outcome, length: object.length })),
      boatSamples: this.boatSamples.map((sample) => ({ ...sample })),
    }
    this.events.onReplayEvent?.({ elapsedMs: snapshot.playingElapsedMs, type: 'river-run-snapshot', payload: runSnapshot })
    this.events.onReplayEvent?.({ elapsedMs: snapshot.playingElapsedMs, type: 'finish', payload: { score: this.score } })
    this.audio.playEffect('finish')
    this.audio.pause()
    const result = buildRiverTrainingResult(snapshot.startedAt ?? now, snapshot.completedAt ?? now, snapshot.playingElapsedMs, {
      score: this.score,
      maxCombo: this.maxCombo,
      starsTotal: this.objects.filter((object) => object.kind === 'star').length,
      starsCollected: this.objects.filter((object) => object.kind === 'star' && object.outcome === 'success').length,
      gateDirections: this.objects.filter((object) => object.kind === 'gate').map((object) => object.direction ?? object.lane),
      successfulGateDirections: this.successfulGateDirections,
      gateReactionTimesMs: this.gateReactionTimesMs,
      collisionCount: this.collisionCount,
      holdsTotal: this.objects.filter((object) => object.kind === 'hold').length,
      holdsSucceeded: this.objects.filter((object) => object.kind === 'hold' && object.outcome === 'success').length,
      holdStabilities: this.holdStabilities,
      accelerationDurationMs: this.accelerationDurationMs,
      decelerationDurationMs: this.decelerationDurationMs,
      speedSamples: this.speedSamples,
      inputSamples: this.inputSamples,
    })
    this.notifySessionState()
    this.events.onCompleted?.(result)
  }

  private buildScene(): void {
    if (!this.app) return
    const scene = new Container()
    const background = new Graphics().rect(0, 0, 1280, 720).fill(0x173f3c)
    const bank = new Graphics().roundRect(150, -40, 980, 800, 180).fill(0x5b8d5a)
    const river = new TilingSprite({ texture: Texture.WHITE, width: 780, height: 820 })
    river.position.set(250, -50)
    river.tint = 0x4d9db3
    const waterLines = new Graphics()
    for (let y = 0; y < 760; y += 46) waterLines.moveTo(290, y).bezierCurveTo(470, y + 18, 710, y - 18, 990, y).stroke({ width: 3, color: 0x9bd8dd, alpha: 0.28 })
    const decorLayer = new Container()
    const worldLayer = new Container()
    const waterParticles = new ParticleContainer({ dynamicProperties: { position: true, rotation: true, color: true } })
    for (let index = 0; index < 32; index += 1) {
      waterParticles.addParticle(new Particle({ texture: Texture.WHITE, x: 300 + (index * 137) % 680, y: (index * 83) % 720, scaleX: 10 + index % 5, scaleY: 2, rotation: (index % 4 - 2) * 0.08, tint: 0xc9f2ef, alpha: 0.26, anchorX: 0.5, anchorY: 0.5 }))
    }
    const boat = this.createBoatFallback()
    const countdownText = new Text({ text: '', style: { fill: '#ffffff', fontSize: 86, fontWeight: '800', stroke: { color: '#24433e', width: 8 } } })
    const missionText = new Text({ text: '', style: { fill: '#f5fbef', fontSize: 22, fontWeight: '700', stroke: { color: '#17332f', width: 5 } } })
    countdownText.anchor.set(0.5)
    missionText.anchor.set(0.5)
    scene.addChild(background, bank, river, waterLines, waterParticles, decorLayer, worldLayer, boat, missionText, countdownText)
    this.app.stage.addChild(scene)
    this.scene = scene
    this.worldLayer = worldLayer
    this.decorLayer = decorLayer
    this.waterParticles = waterParticles
    this.river = river
    this.boat = boat
    this.countdownText = countdownText
    this.missionText = missionText
    this.layoutScene()
  }

  private async loadArt(): Promise<void> {
    if (!this.boat) return
    try {
      const paths = ['boat', 'star', 'rock', 'log', 'foliage'] as const
      const loaded = await Promise.all(paths.map(async (name) => [name, await Assets.load<Texture>(`/assets/games/river/${name}.png`)] as const))
      for (const [name, texture] of loaded) this.textures.set(name, texture)
      const texture = this.textures.get('boat')!
      const sprite = new Sprite(texture)
      sprite.anchor.set(0.5)
      sprite.width = 110
      sprite.height = 110
      this.boat.removeChildren().forEach((child) => child.destroy())
      this.boat.addChild(sprite)
      this.decorateBanks()
    } catch { /* 正式素材缺失时保留清晰的小船降级图形。 */ }
  }

  private createBoatFallback(): Container {
    const container = new Container()
    const boat = new Graphics().moveTo(-48, -16).lineTo(48, -16).lineTo(32, 34).quadraticCurveTo(0, 52, -32, 34).closePath().fill(0xf3a45b).stroke({ width: 5, color: 0x7d4934 })
    const cabin = new Graphics().roundRect(-25, -45, 50, 32, 9).fill(0xf8f1d4).stroke({ width: 4, color: 0x52796f })
    container.addChild(boat, cabin)
    return container
  }

  private rebuildWorldObjects(): void {
    this.worldLayer?.removeChildren().forEach((child) => child.destroy())
    for (const object of this.objects) {
      object.display = this.createObjectGraphic(object)
      this.worldLayer?.addChild(object.display)
    }
  }

  private createObjectGraphic(object: RuntimeObject): Container {
    const container = new Container()
    const assetName = object.kind === 'star' ? 'star' : object.kind === 'obstacle' ? (object.id.includes('combined') ? 'log' : 'rock') : null
    const texture = assetName ? this.textures.get(assetName) : null
    if (texture) {
      const sprite = new Sprite(texture)
      sprite.anchor.set(0.5)
      const size = object.kind === 'star' ? 54 : 105
      sprite.width = size
      sprite.height = size
      container.addChild(sprite)
    } else if (object.kind === 'star') container.addChild(new Graphics().star(0, 0, 5, 22, 10).fill(0xffdd72).stroke({ width: 4, color: 0xf09f4c }))
    else if (object.kind === 'obstacle') container.addChild(new Graphics().ellipse(0, 0, 95, 54).fill(0x796b64).stroke({ width: 5, color: 0x493f3a }))
    else if (object.kind === 'gate') {
      const graphic = new Graphics().rect(-100, -8, 200, 16).fill(0x8fd8ff).rect(-108, -60, 16, 120).fill(0xf4f0ce).rect(92, -60, 16, 120).fill(0xf4f0ce)
      container.addChild(graphic)
    } else container.addChild(new Graphics().roundRect(-135, -45, 270, 90, 34).fill({ color: 0x68d391, alpha: 0.28 }).stroke({ width: 4, color: 0x9ee5bb, alpha: 0.9 }))
    return container
  }

  /** 重复少量植被精灵丰富河岸，同时保持对象数量固定。 */
  private decorateBanks(): void {
    const texture = this.textures.get('foliage')
    if (!texture || !this.decorLayer) return
    this.decorLayer.removeChildren().forEach((child) => child.destroy())
    for (let index = 0; index < 8; index += 1) {
      const sprite = new Sprite(texture)
      sprite.anchor.set(0.5)
      sprite.width = 170 + (index % 3) * 22
      sprite.height = sprite.width
      sprite.position.set(index % 2 === 0 ? 120 : 1160, 90 + (index % 4) * 185)
      sprite.scale.x *= index % 2 === 0 ? 1 : -1
      sprite.alpha = 0.9
      this.decorLayer.addChild(sprite)
    }
  }

  private render(now: number): void {
    if (!this.scene || !this.boat || !this.countdownText || !this.missionText) return
    const snapshot = this.session.getSnapshot(now)
    this.river!.tilePosition.y = this.progress * 0.6
    // 粒子数量固定为 32，循环移动只表现水面波光，不随局时增长。
    for (const particle of this.waterParticles?.particleChildren ?? []) {
      particle.y = (particle.y + this.forwardSpeed * 0.018) % 740
      particle.rotation += 0.0015
    }
    this.boat.position.set(640 + this.boatX, 555)
    this.boat.rotation = this.horizontalVelocity / this.config.horizontalMaxSpeed * 0.22
    for (const object of this.objects) {
      if (!object.display) continue
      const worldDelta = object.distance - this.progress
      object.display.position.set(640 + laneX(object.lane), 555 - worldDelta * 0.55)
      object.display.visible = object.outcome === 'unresolved' && worldDelta > -500 && worldDelta < 1_200
      if (object.kind === 'hold') object.display.scale.y = Math.max(1, (object.length ?? this.config.holdLength) / 180)
    }
    const countdown = this.resumeCountdownEndsAt === null ? snapshot.countdownRemainingMs : Math.max(0, this.resumeCountdownEndsAt - now)
    this.countdownText.visible = snapshot.state === 'countdown' || this.resumeCountdownEndsAt !== null
    this.countdownText.text = String(Math.max(1, Math.ceil(countdown / 1_000)))
    this.countdownText.position.set(640, 330)
    const segment = [...this.level.segments].reverse().find((item) => this.progress >= item.start)
    this.missionText.text = `${segment?.title ?? '森林溪谷'} · ${Math.round(this.progress / this.config.levelLength * 100)}%`
    this.missionText.position.set(640, 45)
  }

  private layoutScene(): void {
    if (!this.app || !this.scene) return
    const scale = Math.min(this.app.screen.width / this.config.logicalWidth, this.app.screen.height / this.config.logicalHeight)
    this.scene.scale.set(scale)
    this.scene.position.set((this.app.screen.width - this.config.logicalWidth * scale) / 2, (this.app.screen.height - this.config.logicalHeight * scale) / 2)
  }

  private publishHud(): void {
    const stars = this.objects.filter((object) => object.kind === 'star' && object.outcome === 'success').length
    this.events.onHudChanged?.({
      title: this.resumeCountdownEndsAt === null ? '森林溪谷漂流' : '准备继续',
      subtitle: `难度：${difficultyLabel(this.difficulty.getCurrent())}`,
      metrics: [
        { label: '得分', value: String(this.score) },
        { label: '星星', value: `${stars}/20` },
        { label: '连击', value: String(this.combo) },
        { label: '进度', value: `${Math.round(this.progress / this.config.levelLength * 100)}%` },
      ],
    })
  }

  private notifySessionState(): void {
    const state = this.session.getSnapshot().state
    if (state === this.lastNotifiedState) return
    this.lastNotifiedState = state
    this.events.onSessionStateChanged?.(state)
  }
}

function emptyInput(): GameInput { return { x: 0, y: 0, connected: false, calibrated: false, timestamp: 0 } }
function gateInputMatched(input: GameInput, direction: RiverLane): boolean { return direction === 'left' ? input.x <= -0.25 : direction === 'right' ? input.x >= 0.25 : Math.abs(input.x) <= 0.15 }
function round(value: number): number { return Math.round(value * 10_000) / 10_000 }
function difficultyLabel(value: RiverDifficulty): string { return { assist: '辅助', normal: '标准', challenge: '挑战' }[value] }
