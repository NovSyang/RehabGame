import type { MotionRange } from '../MotionConfig'

export type ActivityRangeHistorySource = 'first-run' | 'settings-remeasurement' | 'legacy-recovered'

/** 一次完整且由用户确认保存的个人活动范围测量事实。 */
export interface ActivityRangeHistoryRecord {
  schemaVersion: 1
  id: string
  profileId: string
  measuredAt: number
  measuredRange: MotionRange
  activeRange: MotionRange
  trainingRatio: number
  source: ActivityRangeHistorySource
}

/** 显式复制基础字段，避免 Vue Proxy 或外部引用进入历史存储。 */
export function copyActivityRangeHistoryRecord(record: ActivityRangeHistoryRecord): ActivityRangeHistoryRecord {
  return {
    schemaVersion: 1,
    id: record.id,
    profileId: record.profileId,
    measuredAt: record.measuredAt,
    measuredRange: copyRange(record.measuredRange),
    activeRange: copyRange(record.activeRange),
    trainingRatio: record.trainingRatio,
    source: record.source,
  }
}

export function activityRangeHistoryIdentity(record: Pick<ActivityRangeHistoryRecord, 'profileId' | 'measuredAt' | 'measuredRange'>): string {
  const range = record.measuredRange
  return [record.profileId, record.measuredAt, range.forwardMax, range.backwardMax, range.leftMax, range.rightMax].join('|')
}

function copyRange(range: MotionRange): MotionRange {
  return {
    leftMax: range.leftMax,
    rightMax: range.rightMax,
    forwardMax: range.forwardMax,
    backwardMax: range.backwardMax,
  }
}
