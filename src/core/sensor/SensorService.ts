import type { GameInput } from '../game-input/GameInput'
import { MotionProcessor } from '../motion/MotionProcessor'
import type { ISensorTransport } from './ISensorTransport'
import type { SensorConnectionState, SensorDevice } from './SensorDevice'
import type { SensorFrame } from './SensorFrame'
import { BsBt91FrameAssembler } from './bsbt91/BsBt91FrameAssembler'
import { BsBt91Parser } from './bsbt91/BsBt91Parser'

export interface SensorRuntimeSnapshot {
  state: SensorConnectionState
  frame: SensorFrame | null
  gameInput: GameInput
  rateHz: number
  rawHex: string
}

export class SensorService {
  private assembler = new BsBt91FrameAssembler()
  private parser = new BsBt91Parser()
  readonly motion = new MotionProcessor()

  private snapshotCallbacks = new Set<(snapshot: SensorRuntimeSnapshot) => void>()
  private frameTimes: number[] = []
  private state: SensorConnectionState = 'idle'
  private frame: SensorFrame | null = null
  private gameInput: GameInput = {
    x: 0,
    y: 0,
    connected: false,
    calibrated: false,
    timestamp: 0,
  }
  private rawHex = ''

  constructor(private readonly transport: ISensorTransport) {
    this.transport.onData((packet) => this.handleData(packet.data, packet.timestamp))
    this.transport.onStateChanged((state) => {
      this.state = state
      if (state !== 'connected') {
        this.gameInput = { ...this.gameInput, connected: false, x: 0, y: 0 }
      }
      this.publish()
    })
  }

  scan(): Promise<SensorDevice[]> {
    return this.transport.scan()
  }

  connect(deviceId: string): Promise<void> {
    this.assembler.reset()
    this.frameTimes = []
    return this.transport.connect(deviceId)
  }

  disconnect(): Promise<void> {
    return this.transport.disconnect()
  }

  startCalibration(): void {
    this.motion.startCalibration(1000)
    this.publish()
  }

  onSnapshot(callback: (snapshot: SensorRuntimeSnapshot) => void): () => void {
    this.snapshotCallbacks.add(callback)
    callback(this.getSnapshot())
    return () => this.snapshotCallbacks.delete(callback)
  }

  private handleData(chunk: Uint8Array, timestamp: number): void {
    const assembled = this.assembler.push(chunk, timestamp)
    for (const item of assembled) {
      this.rawHex = Array.from(item.bytes)
        .map((byte) => byte.toString(16).padStart(2, '0').toUpperCase())
        .join(' ')

      const frame = this.parser.parseRealtimeFrame(item.bytes, item.timestamp)
      if (!frame) continue

      this.frame = frame
      this.frameTimes.push(frame.timestamp)
      const threshold = frame.timestamp - 1000
      while (this.frameTimes.length > 0 && this.frameTimes[0] < threshold) {
        this.frameTimes.shift()
      }

      this.gameInput = this.motion.process(frame, this.state === 'connected')
      this.publish()
    }
  }

  private getSnapshot(): SensorRuntimeSnapshot {
    return {
      state: this.state,
      frame: this.frame,
      gameInput: this.gameInput,
      rateHz: this.frameTimes.length,
      rawHex: this.rawHex,
    }
  }

  private publish(): void {
    const snapshot = this.getSnapshot()
    for (const callback of this.snapshotCallbacks) callback(snapshot)
  }
}
