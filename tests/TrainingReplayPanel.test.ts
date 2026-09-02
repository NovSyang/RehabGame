// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReplayPlayerSnapshot } from '../src/core/replay/ITrainingReplayPlayer'
import { createDefaultMotionProfile } from '../src/core/motion/MotionProfile'
import type { TrainingRecord } from '../src/core/training/TrainingRecord'

// 依赖桩在组件加载前创建，避免测试初始化真实平台和 IndexedDB 服务。
const mocks = vi.hoisted(() => {
  const snapshot: ReplayPlayerSnapshot = { state: 'playing', currentTimeMs: 30_000, durationMs: 90_000, playbackRate: 2 }
  const player = {
    mount: vi.fn().mockResolvedValue(undefined),
    load: vi.fn(),
    setMode: vi.fn(),
    play: vi.fn(),
    pause: vi.fn(),
    restart: vi.fn(),
    seek: vi.fn(),
    setPlaybackRate: vi.fn(),
    getSnapshot: vi.fn(() => snapshot),
    onChanged: vi.fn((callback: (value: ReplayPlayerSnapshot) => void) => { callback(snapshot); return vi.fn() }),
    destroy: vi.fn(),
  }
  return {
    snapshot,
    player,
    createReplayPlayer: vi.fn(() => player),
    lockLandscape: vi.fn().mockResolvedValue(true),
    unlockOrientation: vi.fn().mockResolvedValue(undefined),
    registerBack: vi.fn(),
    unregisterBack: vi.fn(),
    backHandler: null as (() => void | Promise<void>) | null,
  }
})

vi.mock('../src/app/AppServices', () => ({
  displayService: { lockLandscape: mocks.lockLandscape, unlockOrientation: mocks.unlockOrientation },
  backActionCoordinator: {
    register: mocks.registerBack.mockImplementation((_priority: number, handler: () => void | Promise<void>) => {
      mocks.backHandler = handler
      return () => { mocks.unregisterBack(); if (mocks.backHandler === handler) mocks.backHandler = null }
    }),
  },
}))
vi.mock('../src/games/GameRegistry', () => ({ getGameModule: () => ({ createReplayPlayer: mocks.createReplayPlayer }) }))

import TrainingReplayPanel from '../src/components/history/TrainingReplayPanel.vue'

describe('TrainingReplayPanel fullscreen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.backHandler = null
    mocks.player.mount.mockResolvedValue(undefined)
    mocks.lockLandscape.mockResolvedValue(true)
    mocks.unlockOrientation.mockResolvedValue(undefined)
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { queueMicrotask(() => callback(0)); return 1 })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
  })

  afterEach(() => {
    document.body.classList.remove('replay-fullscreen-open')
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
  })

  it('展开和退出复用同一播放器并保持播放快照', async () => {
    const wrapper = mount(TrainingReplayPanel, { props: { record: createRecord('record-1') }, attachTo: document.body })
    await flushPromises()
    clickButton('展开全屏')
    await flushPromises()

    expect(document.querySelector('.replay-panel--fullscreen')).not.toBeNull()
    expect(document.body.classList.contains('replay-fullscreen-open')).toBe(true)
    expect(document.body.textContent).toContain('00:30 / 01:30')
    expect(mocks.createReplayPlayer).toHaveBeenCalledOnce()
    expect(mocks.player.load).toHaveBeenCalledOnce()
    expect(mocks.lockLandscape).toHaveBeenCalledOnce()

    await mocks.backHandler?.()
    await flushPromises()
    expect(document.querySelector('.replay-panel--fullscreen')).toBeNull()
    expect(document.body.classList.contains('replay-fullscreen-open')).toBe(false)
    expect(mocks.player.load).toHaveBeenCalledOnce()
    expect(mocks.unlockOrientation).toHaveBeenCalledOnce()
    expect(wrapper.emitted('expandedChanged')).toEqual([[true], [false]])
    wrapper.unmount()
  })

  it('全屏切换模式不会重新创建或重新加载播放器', async () => {
    const wrapper = mount(TrainingReplayPanel, { props: { record: createRecord('record-2') }, attachTo: document.body })
    await flushPromises()
    clickButton('展开全屏')
    await flushPromises()
    clickButton('完整轨迹')
    await flushPromises()

    expect(mocks.player.setMode).toHaveBeenLastCalledWith('trajectory')
    expect(mocks.createReplayPlayer).toHaveBeenCalledOnce()
    expect(mocks.player.load).toHaveBeenCalledOnce()
    expect(document.body.textContent).toContain('浅蓝线：完整移动轨迹')
    wrapper.unmount()
    await flushPromises()
    expect(document.body.classList.contains('replay-fullscreen-open')).toBe(false)
  })

  it('切换历史记录时先退出全屏，再重新创建对应播放器', async () => {
    const wrapper = mount(TrainingReplayPanel, { props: { record: createRecord('record-3') }, attachTo: document.body })
    await flushPromises()
    clickButton('展开全屏')
    await flushPromises()
    await wrapper.setProps({ record: createRecord('record-4') })
    await flushPromises()

    expect(document.querySelector('.replay-panel--fullscreen')).toBeNull()
    expect(mocks.unlockOrientation).toHaveBeenCalledOnce()
    expect(mocks.createReplayPlayer).toHaveBeenCalledTimes(2)
    expect(mocks.player.load).toHaveBeenCalledTimes(2)
    expect(mocks.unlockOrientation.mock.invocationCallOrder[0]).toBeLessThan(mocks.createReplayPlayer.mock.invocationCallOrder[1])
    wrapper.unmount()
  })

  it('方向锁定失败时仍然进入应用内全屏', async () => {
    mocks.lockLandscape.mockRejectedValueOnce(new Error('orientation denied'))
    const wrapper = mount(TrainingReplayPanel, { props: { record: createRecord('record-5') }, attachTo: document.body })
    await flushPromises()
    clickButton('展开全屏')
    await flushPromises()

    expect(document.querySelector('.replay-panel--fullscreen')).not.toBeNull()
    wrapper.unmount()
  })
})

/** 测试只需要一条可识别的 V2 回放记录。 */
function createRecord(id: string): TrainingRecord {
  return {
    schemaVersion: 2,
    id,
    gameId: 'target-reach',
    gameName: '四方向目标触达',
    completedAt: 1,
    result: { startedAt: 1, endedAt: 90_001, durationMs: 90_000 },
    motionProfile: createDefaultMotionProfile(1),
    gameConfig: {},
    replay: { schemaVersion: 1, durationMs: 90_000, sampleRateHz: 25, samples: [], events: [] },
  }
}

function clickButton(label: string): void {
  const button = [...document.querySelectorAll('button')].find((item) => item.textContent?.trim() === label)
  if (!button) throw new Error(`未找到按钮：${label}`)
  button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}
