import type { IKeyValueStore } from '../../storage/IKeyValueStore'
import { StorageKeys } from '../../storage/StorageKeys'
import {
  activityRangeHistoryIdentity,
  copyActivityRangeHistoryRecord,
  type ActivityRangeHistoryRecord,
  type ActivityRangeHistorySource,
} from './ActivityRangeHistoryRecord'
import type { IActivityRangeHistoryRepository } from './IActivityRangeHistoryRepository'

/** 将少量测量历史保存为一个 JSON 数组，并安全过滤损坏条目。 */
export class LocalStorageActivityRangeHistoryRepository implements IActivityRangeHistoryRepository {
  private writeQueue: Promise<void> = Promise.resolve()

  constructor(private readonly store: IKeyValueStore) {}

  async getAll(): Promise<ActivityRangeHistoryRecord[]> {
    const raw = await this.store.get(StorageKeys.activityRangeHistory)
    if (!raw) return []
    try {
      const value: unknown = JSON.parse(raw)
      if (!Array.isArray(value)) return []
      return value.filter(isActivityRangeHistoryRecord).map(copyActivityRangeHistoryRecord)
    } catch {
      return []
    }
  }

  append(record: ActivityRangeHistoryRecord): Promise<void> {
    const copy = copyActivityRangeHistoryRecord(record)
    const operation = this.writeQueue.then(async () => {
      const records = await this.getAll()
      const identity = activityRangeHistoryIdentity(copy)
      if (!records.some((item) => item.id === copy.id || activityRangeHistoryIdentity(item) === identity)) records.push(copy)
      await this.store.set(StorageKeys.activityRangeHistory, JSON.stringify(records))
      // LocalStorageStore 会安全吞掉浏览器写入异常，因此这里通过回读确认真正落盘。
      const verified = await this.getAll()
      if (!verified.some((item) => item.id === copy.id || activityRangeHistoryIdentity(item) === identity)) {
        throw new Error('个人活动范围历史记录未能写入本地存储。')
      }
    })
    this.writeQueue = operation.catch(() => undefined)
    return operation
  }

  clear(): Promise<void> {
    const operation = this.writeQueue.then(async () => {
      await this.store.remove(StorageKeys.activityRangeHistory)
      if (await this.store.get(StorageKeys.activityRangeHistory)) throw new Error('个人活动范围历史记录未能清除。')
    })
    this.writeQueue = operation.catch(() => undefined)
    return operation
  }
}

function isActivityRangeHistoryRecord(value: unknown): value is ActivityRangeHistoryRecord {
  if (!value || typeof value !== 'object') return false
  const record = value as Partial<ActivityRangeHistoryRecord>
  return record.schemaVersion === 1
    && typeof record.id === 'string' && record.id.length > 0
    && typeof record.profileId === 'string' && record.profileId.length > 0
    && typeof record.measuredAt === 'number' && Number.isFinite(record.measuredAt) && record.measuredAt > 0
    && isMotionRange(record.measuredRange)
    && isMotionRange(record.activeRange)
    && typeof record.trainingRatio === 'number' && Number.isFinite(record.trainingRatio)
    && record.trainingRatio > 0 && record.trainingRatio <= 1
    && isHistorySource(record.source)
}

function isMotionRange(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  const range = value as Record<string, unknown>
  return ['leftMax', 'rightMax', 'forwardMax', 'backwardMax']
    .every((key) => typeof range[key] === 'number' && Number.isFinite(range[key]) && (range[key] as number) > 0)
}

function isHistorySource(value: unknown): value is ActivityRangeHistorySource {
  return value === 'first-run' || value === 'settings-remeasurement' || value === 'legacy-recovered'
}
