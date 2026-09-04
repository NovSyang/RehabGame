// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ActivityRangeHistoryRecord } from '../src/core/motion/history/ActivityRangeHistoryRecord'

const mocks = vi.hoisted(() => ({
  records: [] as ActivityRangeHistoryRecord[],
  recover: vi.fn().mockResolvedValue(undefined),
  getAll: vi.fn(),
  push: vi.fn(),
}))

vi.mock('../src/app/AppServices', () => ({
  activityRangeHistoryService: {
    recoverLegacyIfNeeded: mocks.recover,
    getAll: mocks.getAll.mockImplementation(async () => structuredClone(mocks.records)),
  },
}))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: mocks.push }) }))

import ActivityRangeHistoryView from '../src/views/ActivityRangeHistoryView.vue'

function record(id: string, measuredAt: number, forward: number): ActivityRangeHistoryRecord {
  return {
    schemaVersion: 1,
    id,
    profileId: 'default',
    measuredAt,
    measuredRange: { forwardMax: forward, backwardMax: forward + 1, leftMax: forward + 2, rightMax: forward + 3 },
    activeRange: { forwardMax: forward * 0.8, backwardMax: (forward + 1) * 0.8, leftMax: (forward + 2) * 0.8, rightMax: (forward + 3) * 0.8 },
    trainingRatio: 0.8,
    source: 'settings-remeasurement',
  }
}

describe('ActivityRangeHistoryView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.records = []
  })

  afterEach(() => { document.body.innerHTML = '' })

  it('无记录时显示测量引导，并提供返回设置和开始测量入口', async () => {
    const wrapper = mount(ActivityRangeHistoryView)
    await flushPromises()
    expect(wrapper.text()).toContain('暂无个人活动范围历史数据')
    expect(mocks.recover).toHaveBeenCalledOnce()

    const buttons = wrapper.findAll('button')
    await buttons.find((button) => button.text().includes('返回设置'))?.trigger('click')
    await buttons.find((button) => button.text() === '开始测量')?.trigger('click')
    expect(mocks.push).toHaveBeenNthCalledWith(1, '/settings')
    expect(mocks.push).toHaveBeenNthCalledWith(2, '/rom-calibration?source=settings')
    wrapper.unmount()
  })

  it('多条记录显示最新摘要、差值、趋势、桌面表格和手机卡片', async () => {
    mocks.records = [record('new', 2_000, 15), record('old', 1_000, 10)]
    const wrapper = mount(ActivityRangeHistoryView)
    await flushPromises()
    expect(wrapper.text()).toContain('较上次 +5.0°')
    expect(wrapper.findAll('.activity-range-history-table tbody tr')).toHaveLength(2)
    expect(wrapper.findAll('.activity-range-history-card')).toHaveLength(2)
    expect(wrapper.findAll('.trend-line')).toHaveLength(4)

    const forwardPoint = wrapper.find('.trend-point')
    await forwardPoint.trigger('focus')
    expect(wrapper.find('.chart-tooltip').exists()).toBe(true)
    wrapper.unmount()
  })

  it('单条记录显示单点趋势提示', async () => {
    mocks.records = [record('only', 1_000, 12)]
    const wrapper = mount(ActivityRangeHistoryView)
    await flushPromises()
    expect(wrapper.text()).toContain('至少完成两次测量后，即可查看变化趋势')
    expect(wrapper.findAll('.trend-line')).toHaveLength(0)
    expect(wrapper.findAll('.trend-point')).toHaveLength(4)
    wrapper.unmount()
  })
})
