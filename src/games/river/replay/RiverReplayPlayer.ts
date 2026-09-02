import { Application, Container, Graphics, Text } from 'pixi.js'
import type { ITrainingReplayPlayer, ReplayMode, ReplayPlayerSnapshot, ReplayPlayerState } from '../../../core/replay/ITrainingReplayPlayer'
import { downsampleForDisplay } from '../../../core/replay/ReplayMath'
import type { TrainingReplay } from '../../../core/replay/TrainingReplay'
import { copyTrainingReplay } from '../../../core/replay/TrainingReplayCopy'
import { laneX } from '../RiverControl'
import type { RiverBoatSample, RiverRunSnapshot } from '../RiverReplayTypes'
import { resizeReplayRendererToHost } from '../../../core/replay/ReplayPlayerResize'

/** River 回放只读取当局快照，不重新运行关卡、碰撞或动态难度。 */
export class RiverReplayPlayer implements ITrainingReplayPlayer {
  private app: Application | null = null
  private scene: Container | null = null
  private world: Graphics | null = null
  private trail: Graphics | null = null
  private boat: Graphics | null = null
  private title: Text | null = null
  private replay: TrainingReplay | null = null
  private run: RiverRunSnapshot | null = null
  private mode: ReplayMode = 'dynamic'
  private state: ReplayPlayerState = 'idle'
  private currentTimeMs = 0
  private playbackRate = 1
  private lastTickAt = 0
  private listeners = new Set<(snapshot: ReplayPlayerSnapshot) => void>()
  private resizeObserver: ResizeObserver | null = null
  private host: HTMLElement | null = null
  private resizeFrameId: number | null = null

  async mount(container: HTMLElement): Promise<void> {
    this.destroy()
    const app = new Application()
    await app.init({ resizeTo: container, antialias: true, background: '#173f3c', resolution: Math.min(window.devicePixelRatio || 1, 2), autoDensity: true })
    container.appendChild(app.canvas)
    const scene = new Container()
    this.world = new Graphics()
    this.trail = new Graphics()
    this.boat = new Graphics()
    this.title = new Text({ text: '', style: { fill: '#f5fbef', fontSize: 18, fontWeight: '700' } })
    this.title.anchor.set(0.5, 0)
    scene.addChild(this.world, this.trail, this.boat, this.title)
    app.stage.addChild(scene)
    this.app = app
    this.scene = scene
    this.host = container
    this.resizeObserver = new ResizeObserver(() => this.scheduleResize())
    this.resizeObserver.observe(container)
    app.ticker.add(() => this.tick(performance.now()))
  }

  load(replay: TrainingReplay): void {
    this.replay = copyTrainingReplay(replay)
    this.run = extractRiverRunSnapshot(this.replay)
    if (!this.run || this.run.boatSamples.length === 0) throw new Error('River 回放缺少当局船体与世界快照。')
    this.currentTimeMs = 0
    this.state = 'paused'
    this.lastTickAt = 0
    this.render()
    this.publish()
  }

  setMode(mode: ReplayMode): void { this.mode = mode; this.pause(); this.render() }
  play(): void {
    if (!this.replay || !this.run || this.replay.durationMs <= 0) return
    if (this.currentTimeMs >= this.replay.durationMs) this.currentTimeMs = 0
    this.state = 'playing'
    this.lastTickAt = performance.now()
    this.publish()
  }
  pause(): void { if (this.state === 'playing') { this.state = 'paused'; this.publish() } }
  restart(): void { this.seek(0); this.pause() }
  seek(elapsedMs: number): void {
    const duration = this.replay?.durationMs ?? 0
    this.currentTimeMs = Math.max(0, Math.min(duration, Math.round(elapsedMs)))
    this.state = duration > 0 && this.currentTimeMs >= duration ? 'ended' : 'paused'
    this.render()
    this.publish()
  }
  setPlaybackRate(rate: number): void { this.playbackRate = [0.5, 1, 2].includes(rate) ? rate : 1; this.publish() }
  getSnapshot(): ReplayPlayerSnapshot { return { state: this.state, currentTimeMs: this.currentTimeMs, durationMs: this.replay?.durationMs ?? 0, playbackRate: this.playbackRate } }
  onChanged(callback: (snapshot: ReplayPlayerSnapshot) => void): () => void { this.listeners.add(callback); callback(this.getSnapshot()); return () => this.listeners.delete(callback) }
  destroy(): void {
    this.resizeObserver?.disconnect()
    this.resizeObserver = null
    if (this.resizeFrameId !== null) cancelAnimationFrame(this.resizeFrameId)
    this.resizeFrameId = null
    this.host = null
    this.app?.destroy(true, { children: true })
    this.app = null
    this.scene = null
    this.world = null
    this.trail = null
    this.boat = null
    this.title = null
    this.state = 'idle'
  }

  private tick(now: number): void {
    if (this.state !== 'playing' || !this.replay) return
    const next = this.currentTimeMs + Math.max(0, now - this.lastTickAt) * this.playbackRate
    this.lastTickAt = now
    if (next >= this.replay.durationMs) { this.currentTimeMs = this.replay.durationMs; this.state = 'ended' }
    else this.currentTimeMs = next
    this.render()
    this.publish()
  }

  /** River 场景直接使用宽高布局，全屏切换后必须同步内部画布尺寸。 */
  private scheduleResize(): void {
    if (this.resizeFrameId !== null) cancelAnimationFrame(this.resizeFrameId)
    this.resizeFrameId = requestAnimationFrame(() => {
      this.resizeFrameId = null
      if (this.app && this.host) resizeReplayRendererToHost(this.app, this.host, () => this.render())
    })
  }

  private render(): void {
    if (!this.app || !this.scene || !this.world || !this.trail || !this.boat || !this.title || !this.run) return
    const width = this.app.screen.width
    const height = this.app.screen.height
    this.scene.scale.set(1)
    this.world.clear()
    this.trail.clear()
    this.boat.clear()
    if (this.mode === 'trajectory') this.renderFull(width, height)
    else this.renderDynamic(width, height)
  }

  private renderDynamic(width: number, height: number): void {
    const sample = sampleBoat(this.run!.boatSamples, this.currentTimeMs)
    if (!sample) return
    const scaleX = Math.max(0.2, (width - 100) / (this.run!.riverHalfWidth * 2))
    this.world!.roundRect(width / 2 - this.run!.riverHalfWidth * scaleX, 20, this.run!.riverHalfWidth * 2 * scaleX, height - 40, 70).fill(0x4d9db3)
    for (const object of this.run!.objects) {
      const y = height * 0.72 - (object.distance - sample.progress) * 0.35
      if (y < -50 || y > height + 50) continue
      drawObject(this.world!, width / 2 + laneX(object.lane) * scaleX, y, object.kind, object.outcome)
    }
    const tail = this.run!.boatSamples.filter((value) => value.elapsedMs >= this.currentTimeMs - 2_500 && value.elapsedMs <= this.currentTimeMs)
    if (tail.length > 1) {
      this.trail!.moveTo(width / 2 + tail[0].boatX * scaleX, height * 0.72)
      for (const value of tail.slice(1)) this.trail!.lineTo(width / 2 + value.boatX * scaleX, height * 0.72 - (value.progress - sample.progress) * 0.35)
      this.trail!.stroke({ width: 4, color: 0xf8f1d4, alpha: 0.75 })
    }
    this.boat!.moveTo(-18, -10).lineTo(18, -10).lineTo(12, 18).lineTo(-12, 18).closePath().fill(0xf3a45b)
    this.boat!.position.set(width / 2 + sample.boatX * scaleX, height * 0.72)
    this.boat!.rotation = sample.rotation
    this.title!.text = `森林溪谷 · ${Math.round(sample.progress / this.run!.levelLength * 100)}%`
    this.title!.position.set(width / 2, 28)
  }

  private renderFull(width: number, height: number): void {
    const samples = downsampleForDisplay(this.run!.boatSamples.map((sample) => ({ elapsedMs: sample.elapsedMs, x: sample.boatX / this.run!.riverHalfWidth, y: sample.progress / this.run!.levelLength })), 1_800)
    const left = 70
    const top = 30
    const plotWidth = width - 140
    const plotHeight = height - 60
    this.world!.roundRect(left, top, plotWidth, plotHeight, 24).fill(0x4d9db3).stroke({ width: 3, color: 0x9bd8dd, alpha: 0.65 })
    if (samples.length > 1) {
      this.trail!.moveTo(width / 2 + samples[0].x * plotWidth * 0.42, top + plotHeight * (1 - samples[0].y))
      for (const sample of samples.slice(1)) this.trail!.lineTo(width / 2 + sample.x * plotWidth * 0.42, top + plotHeight * (1 - sample.y))
      this.trail!.stroke({ width: 3, color: 0xf8f1d4, alpha: 0.9 })
    }
    this.boat!.position.set(0, 0)
    this.title!.text = '完整航行轨迹（世界坐标）'
    this.title!.position.set(width / 2, 34)
  }

  private publish(): void { const snapshot = this.getSnapshot(); for (const listener of this.listeners) listener(snapshot) }
}

/** 从事实事件中安全提取固定世界快照。 */
export function extractRiverRunSnapshot(replay: TrainingReplay): RiverRunSnapshot | null {
  const event = replay.events.find((item) => item.type === 'river-run-snapshot')
  if (!event?.payload || typeof event.payload !== 'object') return null
  const value = event.payload as Partial<RiverRunSnapshot>
  if (!Number.isFinite(value.levelLength) || !Number.isFinite(value.riverHalfWidth) || !Array.isArray(value.objects) || !Array.isArray(value.boatSamples)) return null
  return value as RiverRunSnapshot
}

function sampleBoat(samples: readonly RiverBoatSample[], elapsedMs: number): RiverBoatSample | null {
  if (samples.length === 0) return null
  let low = 0
  let high = samples.length - 1
  while (low < high) { const mid = Math.ceil((low + high) / 2); if (samples[mid].elapsedMs <= elapsedMs) low = mid; else high = mid - 1 }
  return samples[low]
}

function drawObject(graphic: Graphics, x: number, y: number, kind: string, outcome: string): void {
  const alpha = outcome === 'unresolved' ? 1 : 0.35
  if (kind === 'star') graphic.star(x, y, 5, 12, 6).fill({ color: 0xffdd72, alpha })
  else if (kind === 'obstacle') graphic.ellipse(x, y, 38, 22).fill({ color: 0x75655d, alpha })
  else if (kind === 'gate') graphic.rect(x - 45, y - 5, 90, 10).fill({ color: 0x8fd8ff, alpha })
  else graphic.roundRect(x - 55, y - 18, 110, 36, 16).fill({ color: 0x68d391, alpha: alpha * 0.45 })
}
