import { beforeEach, describe, expect, it, vi } from 'vitest'

// vi.mock 会提升执行，使用 hoisted 让插件桩在模块加载前安全创建。
const { lock, unlock, keepAwake, allowSleep, enterImmersiveMode, exitImmersiveMode } = vi.hoisted(() => ({
  lock: vi.fn(), unlock: vi.fn(), keepAwake: vi.fn(), allowSleep: vi.fn(),
  enterImmersiveMode: vi.fn(), exitImmersiveMode: vi.fn(),
}))

vi.mock('@capacitor/screen-orientation', () => ({ ScreenOrientation: { lock, unlock } }))
vi.mock('@capacitor-community/keep-awake', () => ({ KeepAwake: { keepAwake, allowSleep } }))
vi.mock('../src/platform/capacitor/RehabDisplayPlugin', () => ({ RehabDisplay: { enterImmersiveMode, exitImmersiveMode } }))

import { CapacitorDisplayService } from '../src/platform/capacitor/CapacitorDisplayService'
import { NoopDisplayService } from '../src/platform/display/NoopDisplayService'

describe('CapacitorDisplayService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    lock.mockResolvedValue(undefined)
    unlock.mockResolvedValue(undefined)
    keepAwake.mockResolvedValue(undefined)
    allowSleep.mockResolvedValue(undefined)
    enterImmersiveMode.mockResolvedValue(undefined)
    exitImmersiveMode.mockResolvedValue(undefined)
  })

  it('进入训练锁横屏并常亮，退出时恢复两项系统设置', async () => {
    const service = new CapacitorDisplayService()
    await expect(service.enterTrainingMode()).resolves.toEqual({ native: true, orientationLocked: true })
    await service.leaveTrainingMode()
    expect(lock).toHaveBeenCalledWith({ orientation: 'landscape' })
    expect(keepAwake).toHaveBeenCalledOnce()
    expect(enterImmersiveMode).toHaveBeenCalledOnce()
    expect(unlock).toHaveBeenCalledOnce()
    expect(allowSleep).toHaveBeenCalledOnce()
    expect(exitImmersiveMode).toHaveBeenCalledOnce()
  })

  it('方向锁定失败时返回降级状态，但仍尝试保持屏幕常亮', async () => {
    lock.mockRejectedValue(new Error('not supported'))
    const service = new CapacitorDisplayService()
    await expect(service.enterTrainingMode()).resolves.toEqual({ native: true, orientationLocked: false })
    expect(keepAwake).toHaveBeenCalledOnce()
    expect(enterImmersiveMode).toHaveBeenCalledOnce()
  })

  it('沉浸模式失败不阻止横屏和常亮，退出恢复也互不阻塞', async () => {
    enterImmersiveMode.mockRejectedValueOnce(new Error('immersive not supported'))
    exitImmersiveMode.mockRejectedValueOnce(new Error('restore failed'))
    const service = new CapacitorDisplayService()
    await expect(service.enterTrainingMode()).resolves.toEqual({ native: true, orientationLocked: true })
    await expect(service.leaveTrainingMode()).resolves.toBeUndefined()
    expect(lock).toHaveBeenCalledOnce()
    expect(keepAwake).toHaveBeenCalledOnce()
    expect(unlock).toHaveBeenCalledOnce()
    expect(allowSleep).toHaveBeenCalledOnce()
  })

  it('历史回放可单独锁定和解除方向，不启用屏幕常亮', async () => {
    const service = new CapacitorDisplayService()
    await expect(service.lockLandscape()).resolves.toBe(true)
    await service.unlockOrientation()
    expect(lock).toHaveBeenCalledWith({ orientation: 'landscape' })
    expect(unlock).toHaveBeenCalledOnce()
    expect(keepAwake).not.toHaveBeenCalled()
  })

  it('非原生平台的方向控制保持安全空操作', async () => {
    const service = new NoopDisplayService()
    await expect(service.lockLandscape()).resolves.toBe(true)
    await expect(service.unlockOrientation()).resolves.toBeUndefined()
  })
})
