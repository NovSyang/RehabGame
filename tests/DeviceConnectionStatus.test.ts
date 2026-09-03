// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  sensorSnapshot: {
    state: 'connected',
    frame: null,
    gameInput: { x: 0, y: 0, connected: true, calibrated: true, timestamp: 1 },
    rateHz: 50,
    rawHex: '',
    battery: { rawValue: 391, percent: 75, updatedAt: 1, rawHex: '55 71 64 87 01' },
  },
  connectionSnapshot: {
    reconnectState: 'idle',
    binding: { deviceId: 'device-1', address: null, name: 'BS-BT91' },
    operation: 'idle',
    attemptNumber: 0,
    retryIndex: 0,
    maxAttempts: 4,
    message: null,
  },
}))

vi.mock('../src/app/AppServices', () => ({
  sensorService: { onSnapshot: (callback: (value: typeof mocks.sensorSnapshot) => void) => { callback(mocks.sensorSnapshot); return vi.fn() } },
  connectionManager: {
    getSnapshot: () => mocks.connectionSnapshot,
    onChanged: (callback: (value: typeof mocks.connectionSnapshot) => void) => { callback(mocks.connectionSnapshot); return vi.fn() },
    reconnectNow: vi.fn(),
    forgetCurrentDevice: vi.fn(),
  },
}))
vi.mock('../src/components/device/DeviceSwitchDialog.vue', () => ({ default: { template: '<div class="switch-dialog-stub"></div>' } }))

import DeviceConnectionStatus from '../src/components/app/DeviceConnectionStatus.vue'

describe('DeviceConnectionStatus compact', () => {
  afterEach(() => { document.body.innerHTML = '' })

  it('紧凑模式只显示连接点和电量，同时保留可访问性说明', async () => {
    const wrapper = mount(DeviceConnectionStatus, { props: { compact: true }, attachTo: document.body })
    await nextTick()
    const button = wrapper.get('.device-status')
    expect(button.classes()).toContain('device-status--compact')
    expect(button.text()).toContain('75%')
    expect(button.text()).not.toContain('设备已连接')
    expect(button.text()).not.toContain('▾')
    expect(button.attributes('aria-label')).toContain('设备已连接')
    expect(button.attributes('aria-label')).toContain('75%')
    wrapper.unmount()
  })

  it('普通模式继续显示完整状态，并可打开设备菜单', async () => {
    const wrapper = mount(DeviceConnectionStatus, { attachTo: document.body })
    await nextTick()
    const button = wrapper.get('.device-status')
    expect(button.text()).toContain('设备已连接')
    expect(button.text()).toContain('▾')
    await button.trigger('click')
    expect(wrapper.text()).toContain('重新连接')
    expect(button.attributes('aria-expanded')).toBe('true')
    wrapper.unmount()
  })
})
