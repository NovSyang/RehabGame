import { describe, expect, it } from 'vitest'
import type { IDeviceBindingRepository, DeviceBinding } from '../src/core/sensor/DeviceBinding'
import { SensorConnectionManager, type SensorConnectionPort } from '../src/core/sensor/SensorConnectionManager'
import type { SensorDevice } from '../src/core/sensor/SensorDevice'

class BindingRepository implements IDeviceBindingRepository {
  saved: DeviceBinding | null
  constructor(binding: DeviceBinding | null) { this.saved = binding }
  async load(): Promise<DeviceBinding | null> { return this.saved }
  async save(binding: DeviceBinding): Promise<void> { this.saved = binding }
  async clear(): Promise<void> { this.saved = null }
}

class FakeSensor implements SensorConnectionPort {
  scans: SensorDevice[][] = []
  connected: string[] = []
  resetCount = 0
  callback: ((snapshot: { state: 'idle' | 'connected' | 'disconnected' }) => void) | null = null
  async scan(): Promise<SensorDevice[]> { return this.scans.shift() ?? [] }
  async connect(deviceId: string): Promise<void> { this.connected.push(deviceId) }
  async disconnect(): Promise<void> {}
  resetCalibration(): void { this.resetCount += 1 }
  onSnapshot(callback: (snapshot: { state: 'idle' | 'connected' | 'disconnected' }) => void): () => void { this.callback = callback; callback({ state: 'idle' }); return () => { this.callback = null } }
  emit(state: 'idle' | 'connected' | 'disconnected'): void { this.callback?.({ state }) }
}

describe('SensorConnectionManager', () => {
  it('重连按 1/2/5 秒退避，三次失败后等待用户', async () => {
    const delays: number[] = []
    const sensor = new FakeSensor()
    sensor.scans = [[], [], []]
    const manager = new SensorConnectionManager(sensor, new BindingRepository({ deviceId: 'id', name: 'BS', updatedAt: 1 }), async (delay) => { delays.push(delay) })
    await manager.initialize()
    await manager.reconnectBoundDevice()

    expect(delays).toEqual([1000, 2000, 5000])
    expect(manager.getSnapshot().reconnectState).toBe('waiting-user')
  })

  it('异常断线重连成功后要求重新校准，主动断开不重连', async () => {
    const sensor = new FakeSensor()
    sensor.scans = [[{ id: 'new', name: 'BS', address: 'AA' }]]
    const manager = new SensorConnectionManager(sensor, new BindingRepository({ deviceId: 'old', address: 'AA', name: 'BS', updatedAt: 1 }), async () => {})
    await manager.initialize()
    await manager.reconnectBoundDevice()
    expect(sensor.connected).toEqual(['new'])
    expect(sensor.resetCount).toBe(1)

    sensor.emit('connected')
    await manager.disconnectManually()
    sensor.emit('disconnected')
    expect(manager.getSnapshot().reconnectState).toBe('idle')
  })
})
