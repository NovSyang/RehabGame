import type { MotionRange } from '../MotionConfig'
import type { ActivityRangeHistoryRecord } from './ActivityRangeHistoryRecord'

export type ActivityRangeDirection = 'forward' | 'backward' | 'left' | 'right'
export type ActivityRangeDirectionFilter = 'all' | ActivityRangeDirection

export interface ActivityRangeDirectionDefinition {
  id: ActivityRangeDirection
  label: string
  color: string
  rangeKey: keyof MotionRange
}

export interface ActivityRangeSummaryItem extends ActivityRangeDirectionDefinition {
  value: number
  delta: number | null
}

export interface ActivityRangeLatestSummary {
  measuredAt: number
  items: ActivityRangeSummaryItem[]
}

export interface ActivityRangeTrendPoint {
  recordId: string
  measuredAt: number
  value: number
  x: number
  y: number
}

export interface ActivityRangeTrendSeries extends ActivityRangeDirectionDefinition {
  points: ActivityRangeTrendPoint[]
}

export interface ActivityRangeTrendModel {
  width: number
  height: number
  plotLeft: number
  plotRight: number
  plotTop: number
  plotBottom: number
  yMax: number
  yTicks: Array<{ value: number; y: number }>
  xTicks: Array<{ measuredAt: number; x: number }>
  series: ActivityRangeTrendSeries[]
}

export const ACTIVITY_RANGE_DIRECTIONS: readonly ActivityRangeDirectionDefinition[] = [
  { id: 'forward', label: '向前', color: '#8fd8ff', rangeKey: 'forwardMax' },
  { id: 'backward', label: '向后', color: '#68d391', rangeKey: 'backwardMax' },
  { id: 'left', label: '向左', color: '#f3c969', rangeKey: 'leftMax' },
  { id: 'right', label: '向右', color: '#c5a3ff', rangeKey: 'rightMax' },
]

/** 最新摘要只描述数值变化，不对变化作康复结论。 */
export function buildActivityRangeLatestSummary(records: readonly ActivityRangeHistoryRecord[]): ActivityRangeLatestSummary | null {
  const sorted = [...records].sort((left, right) => right.measuredAt - left.measuredAt)
  const latest = sorted[0]
  if (!latest) return null
  const previous = sorted[1]
  return {
    measuredAt: latest.measuredAt,
    items: ACTIVITY_RANGE_DIRECTIONS.map((direction) => ({
      ...direction,
      value: latest.measuredRange[direction.rangeKey],
      delta: previous ? latest.measuredRange[direction.rangeKey] - previous.measuredRange[direction.rangeKey] : null,
    })),
  }
}

/** 使用真实时间间隔建立响应式 SVG 的固定逻辑坐标。 */
export function buildActivityRangeTrendModel(
  records: readonly ActivityRangeHistoryRecord[],
  filter: ActivityRangeDirectionFilter = 'all',
): ActivityRangeTrendModel {
  const width = 720
  const height = 320
  const plotLeft = 52
  const plotRight = 698
  const plotTop = 20
  const plotBottom = 270
  const sorted = [...records].sort((left, right) => left.measuredAt - right.measuredAt)
  const definitions = filter === 'all' ? ACTIVITY_RANGE_DIRECTIONS : ACTIVITY_RANGE_DIRECTIONS.filter((item) => item.id === filter)
  const values = sorted.flatMap((record) => definitions.map((direction) => record.measuredRange[direction.rangeKey]))
  const maximum = values.length ? Math.max(...values) : 0
  const yMax = Math.max(5, Math.ceil(maximum / 5) * 5)
  const firstTime = sorted[0]?.measuredAt ?? 0
  const lastTime = sorted.at(-1)?.measuredAt ?? firstTime
  const timeSpan = lastTime - firstTime
  const toX = (measuredAt: number): number => timeSpan <= 0
    ? (plotLeft + plotRight) / 2
    : plotLeft + ((measuredAt - firstTime) / timeSpan) * (plotRight - plotLeft)
  const toY = (value: number): number => plotBottom - (value / yMax) * (plotBottom - plotTop)
  const tickStep = Math.max(5, Math.ceil(yMax / 25) * 5)
  const yTicks: Array<{ value: number; y: number }> = []
  for (let value = 0; value <= yMax; value += tickStep) yTicks.push({ value, y: toY(value) })
  if (yTicks.at(-1)?.value !== yMax) yTicks.push({ value: yMax, y: toY(yMax) })

  return {
    width,
    height,
    plotLeft,
    plotRight,
    plotTop,
    plotBottom,
    yMax,
    yTicks,
    xTicks: selectedDateTicks(sorted).map((record) => ({ measuredAt: record.measuredAt, x: toX(record.measuredAt) })),
    series: definitions.map((direction) => ({
      ...direction,
      points: sorted.map((record) => ({
        recordId: record.id,
        measuredAt: record.measuredAt,
        value: record.measuredRange[direction.rangeKey],
        x: toX(record.measuredAt),
        y: toY(record.measuredRange[direction.rangeKey]),
      })),
    })),
  }
}

function selectedDateTicks(records: ActivityRangeHistoryRecord[]): ActivityRangeHistoryRecord[] {
  if (records.length <= 5) return records
  const indexes = new Set<number>()
  for (let index = 0; index < 5; index += 1) indexes.add(Math.round(index * (records.length - 1) / 4))
  return [...indexes].map((index) => records[index])
}
