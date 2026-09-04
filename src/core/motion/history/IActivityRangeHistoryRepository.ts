import type { ActivityRangeHistoryRecord } from './ActivityRangeHistoryRecord'

/** 个人活动范围历史使用独立轻量存储，不依赖训练历史数据库。 */
export interface IActivityRangeHistoryRepository {
  getAll(): Promise<ActivityRangeHistoryRecord[]>
  append(record: ActivityRangeHistoryRecord): Promise<void>
  clear(): Promise<void>
}
