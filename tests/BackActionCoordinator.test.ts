import { describe, expect, it, vi } from 'vitest'
import { BACK_ACTION_PRIORITY, BackActionCoordinator } from '../src/core/navigation/BackActionCoordinator'

describe('BackActionCoordinator', () => {
  it('每次只执行最高优先级处理器', () => {
    const coordinator = new BackActionCoordinator()
    const history = vi.fn()
    const fullscreen = vi.fn()
    coordinator.register(40, history)
    coordinator.register(60, fullscreen)

    expect(coordinator.handle()).toBe(true)
    expect(fullscreen).toHaveBeenCalledOnce()
    expect(history).not.toHaveBeenCalled()
  })

  it('相同优先级优先执行最后注册项，注销后恢复下一层', () => {
    const coordinator = new BackActionCoordinator()
    const first = vi.fn()
    const second = vi.fn()
    coordinator.register(40, first)
    const unregister = coordinator.register(40, second)

    coordinator.handle()
    expect(second).toHaveBeenCalledOnce()
    unregister()
    coordinator.handle()
    expect(first).toHaveBeenCalledOnce()
  })

  it('没有浮层处理器时交还给路由流程', () => {
    expect(new BackActionCoordinator().handle()).toBe(false)
  })

  it('按更新、回放全屏、历史详情的顺序逐层返回', () => {
    const coordinator = new BackActionCoordinator()
    const calls: string[] = []
    const closeHistory = coordinator.register(BACK_ACTION_PRIORITY.historyDialog, () => { calls.push('history') })
    const closeReplay = coordinator.register(BACK_ACTION_PRIORITY.replayFullscreen, () => { calls.push('replay') })
    const closeUpdate = coordinator.register(BACK_ACTION_PRIORITY.updateDialog, () => { calls.push('update') })

    coordinator.handle()
    closeUpdate()
    coordinator.handle()
    closeReplay()
    coordinator.handle()
    closeHistory()
    expect(coordinator.handle()).toBe(false)
    expect(calls).toEqual(['update', 'replay', 'history'])
  })
})
