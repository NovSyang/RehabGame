import { describe, expect, it } from 'vitest'
import {
  buildActivityRangeLatestSummary,
  buildActivityRangeTrendModel,
} from '../src/core/motion/history/ActivityRangeHistoryPresentation'
import type { ActivityRangeHistoryRecord } from '../src/core/motion/history/ActivityRangeHistoryRecord'

function record(id: string, measuredAt: number, forward: number): ActivityRangeHistoryRecord {
  return {
    schemaVersion: 1,
    id,
    profileId: 'default',
    measuredAt,
    measuredRange: { forwardMax: forward, backwardMax: forward + 1, leftMax: forward + 2, rightMax: forward + 3 },
    // 故意放大训练范围，证明趋势计算不会误用 activeRange。
    activeRange: { forwardMax: 90, backwardMax: 90, leftMax: 90, rightMax: 90 },
    trainingRatio: 0.8,
    source: 'settings-remeasurement',
  }
}

describe('ActivityRangeHistoryPresentation', () => {
  it('摘要选择最新两次测量并计算中性正负差值', () => {
    const summary = buildActivityRangeLatestSummary([record('middle', 2_000, 15), record('old', 1_000, 10), record('new', 3_000, 14)])
    expect(summary?.measuredAt).toBe(3_000)
    expect(summary?.items.find((item) => item.id === 'forward')).toMatchObject({ value: 14, delta: -1 })
    expect(buildActivityRangeLatestSummary([])).toBeNull()
  })

  it('趋势仅使用实测范围，Y 轴从零开始并向上取整到 5 度', () => {
    const model = buildActivityRangeTrendModel([record('a', 1_000, 11), record('b', 2_000, 17)])
    expect(model.yTicks[0].value).toBe(0)
    expect(model.yMax).toBe(20)
    expect(model.series.find((series) => series.id === 'forward')?.points.map((point) => point.value)).toEqual([11, 17])
  })

  it('X 轴按真实时间比例排列，并能筛选单个方向', () => {
    const model = buildActivityRangeTrendModel([
      record('last', 5_000, 15), record('first', 1_000, 10), record('quarter', 2_000, 12),
    ], 'left')
    const points = model.series[0].points
    const expectedQuarterX = model.plotLeft + (model.plotRight - model.plotLeft) * 0.25
    expect(model.series.map((series) => series.id)).toEqual(['left'])
    expect(points.map((point) => point.recordId)).toEqual(['first', 'quarter', 'last'])
    expect(points[1].x).toBeCloseTo(expectedQuarterX)
  })

  it('单条记录居中显示，输入数组顺序保持不变', () => {
    const records = [record('second', 2_000, 12), record('first', 1_000, 10)]
    const originalOrder = records.map((item) => item.id)
    const single = buildActivityRangeTrendModel([records[0]])
    buildActivityRangeTrendModel(records)
    expect(single.series[0].points[0].x).toBe((single.plotLeft + single.plotRight) / 2)
    expect(records.map((item) => item.id)).toEqual(originalOrder)
  })
})
