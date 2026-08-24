import type { SensorRuntimeSnapshot } from './SensorService'
import type { DeviceBinding, IDeviceBindingRepository } from './DeviceBinding'
import { matchBoundDevice } from './DeviceBinding'
import type { SensorDevice } from './SensorDevice'

/** 自动恢复连接的独立状态，不与底层 BLE 状态混在一起。 */
export type ReconnectState = 'idle' | 'reconnecting' | 'waiting-user'

export interface SensorConnectionSnapshot {
  reconnectState: ReconnectState
  binding: DeviceBinding | null
  attempt: number
  message: string | null
}

/** 连接管理实际需要的最小传感器能力，便于独立单元测试。 */
export interface SensorConnectionPort {
  scan(): Promise<SensorDevice[]>
  connect(deviceId: string): Promise<void>
  disconnect(): Promise<void>
  resetCalibration(): void
  onSnapshot(callback: (snapshot: Pick<SensorRuntimeSnapshot, 'state'>) => void): () => void
}

type WaitFunction = (milliseconds: number) => Promise<void>

/**
 * 协调设备绑定与异常断线恢复；Transport 仍只负责原生 IPC。
 * 重连成功总会清除旧中心校准，避免旧零点用于新会话。
 */
export class SensorConnectionManager {
  private binding: DeviceBinding | null = null
  private reconnectState: ReconnectState = 'idle'
  private attempt = 0
  private message: string | null = null
  private manualDisconnect = false
  private previousState = 'idle'
  private listeners = new Set<(snapshot: SensorConnectionSnapshot) => void>()
  private unsubscribe: (() => void) | null = null
  private reconnectTask: Promise<void> | null = null

  constructor(
    private readonly sensor: SensorConnectionPort,
    private readonly repository: IDeviceBindingRepository,
    private readonly wait: WaitFunction = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  ) {}

  async initialize(): Promise<void> {
    this.binding = await this.repository.load()
    this.unsubscribe ??= this.sensor.onSnapshot((snapshot) => this.handleSensorState(snapshot.state))
    this.publish()
  }

  dispose(): void { this.unsubscribe?.(); this.unsubscribe = null }

  onChanged(callback: (snapshot: SensorConnectionSnapshot) => void): () => void {
    this.listeners.add(callback)
    callback(this.getSnapshot())
    return () => this.listeners.delete(callback)
  }

  getSnapshot(): SensorConnectionSnapshot {
    return { reconnectState: this.reconnectState, binding: this.binding ? structuredClone(this.binding) : null, attempt: this.attempt, message: this.message }
  }

  async connect(device: SensorDevice): Promise<void> {
    this.manualDisconnect = false
    await this.sensor.connect(device.id)
    this.binding = { deviceId: device.id, address: device.address, name: device.name, updatedAt: Date.now() }
    await this.repository.save(this.binding)
    this.reconnectState = 'idle'
    this.attempt = 0
    this.message = null
    this.publish()
  }

  async disconnectManually(): Promise<void> {
    this.manualDisconnect = true
    this.reconnectState = 'idle'
    this.attempt = 0
    this.message = null
    await this.sensor.disconnect()
    this.publish()
  }

  async forgetBinding(): Promise<void> {
    this.binding = null
    await this.repository.clear()
    this.reconnectState = 'idle'
    this.message = null
    this.publish()
  }

  /** 应用启动后尝试恢复此前绑定设备；无法匹配时等待用户手动选择。 */
  async reconnectBoundDevice(): Promise<void> {
    if (!this.binding || this.reconnectTask) return
    this.reconnectTask = this.runReconnect().finally(() => { this.reconnectTask = null })
    await this.reconnectTask
  }

  private handleSensorState(state: string): void {
    const wasConnected = this.previousState === 'connected'
    this.previousState = state
    if (state === 'connected') {
      this.reconnectState = 'idle'
      this.attempt = 0
      this.message = null
      this.publish()
      return
    }
    if (wasConnected && (state === 'disconnected' || state === 'error') && !this.manualDisconnect) {
      this.sensor.resetCalibration()
      void this.reconnectBoundDevice()
    }
    if (state === 'disconnected' && this.manualDisconnect) this.manualDisconnect = false
  }

  private async runReconnect(): Promise<void> {
    if (!this.binding) return
    // 固定三次退避：1 秒、2 秒、5 秒，避免持续扫描消耗蓝牙资源。
    const delays = [1000, 2000, 5000]
    this.reconnectState = 'reconnecting'
    this.message = '正在尝试恢复 BS-BT91 连接…'
    this.publish()
    for (let index = 0; index < delays.length; index += 1) {
      if (delays[index] > 0) await this.wait(delays[index])
      this.attempt = index + 1
      this.publish()
      try {
        const devices = await this.sensor.scan()
        const binding: DeviceBinding | null = this.binding
        const device: SensorDevice | null = binding ? matchBoundDevice(binding, devices) : null
        if (!device) continue
        await this.sensor.connect(device.id)
        this.binding = { deviceId: device.id, address: device.address, name: device.name, updatedAt: Date.now() }
        await this.repository.save(this.binding)
        this.sensor.resetCalibration()
        this.reconnectState = 'idle'
        this.attempt = 0
        this.message = '设备已重连，请重新完成中心校准后继续训练。'
        this.publish()
        return
      } catch { /* 本轮失败后按照退避策略继续尝试。 */ }
    }
    this.reconnectState = 'waiting-user'
    this.message = '未能自动恢复设备连接，请扫描后手动选择设备。'
    this.publish()
  }

  private publish(): void {
    const snapshot = this.getSnapshot()
    for (const callback of this.listeners) callback(snapshot)
  }
}
