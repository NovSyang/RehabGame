import { describe, expect, it, vi } from 'vitest'
import { ActivityRangeHistoryService } from '../src/core/motion/history/ActivityRangeHistoryService'
import type { ActivityRangeHistoryRecord } from '../src/core/motion/history/ActivityRangeHistoryRecord'
import type { IActivityRangeHistoryRepository } from '../src/core/motion/history/IActivityRangeHistoryRepository'
import { activeRangeFromMeasured, createDefaultMotionProfile, type MotionProfile } from '../src/core/motion/MotionProfile'
import type { MotionRange } from '../src/core/motion/MotionConfig'
import type { TrainingRecord } from '../src/core/training/TrainingRecord'

class MemoryHistoryRepository implements IActivityRangeHistoryRepository {
  readonly records: ActivityRangeHistoryRecord[] = []
  async getAll(): Promise<ActivityRangeHistoryRecord[]> { return structuredClone(this.records) }
  async append(record: ActivityRangeHistoryRecord): Promise<void> { this.records.push(structuredClone(record)) }
  async clear(): Promise<void> { this.records.length = 0 }
}

const rangeA: MotionRange = { forwardMax: 10, backwardMax: 11, leftMax: 12, rightMax: 13 }
const rangeB: MotionRange = { forwardMax: 15, backwardMax: 16, leftMax: 17, rightMax: 18 }

function profile(range: MotionRange | null, updatedAt: number, id = 'default'): MotionProfile {
  const value = createDefaultMotionProfile(1)
  value.id = id
  value.updatedAt = updatedAt
  value.measuredRange = range ? structuredClone(range) : null
  value.activeRange = range ? activeRangeFromMeasured(range, value.trainingRatio) : value.activeRange
  return value
}

function trainingRecord(id: string, motionProfile: MotionProfile): TrainingRecord {
  return {
    schemaVersion: 1,
    id,
    gameId: 'target-reach',
    gameName: '四方向目标触达',
    completedAt: motionProfile.updatedAt + 10,
    result: { startedAt: 1, endedAt: 2, durationMs: 1 },
    motionProfile,
    gameConfig: {},
  }
}

function createService(
  repository: MemoryHistoryRepository,
  trainingRecords: TrainingRecord[] = [],
  current = profile(null, 1),
): ActivityRangeHistoryService {
  let sequence = 0
  return new ActivityRangeHistoryService(
    repository,
    { getAll: vi.fn(async () => structuredClone(trainingRecords)) },
    () => structuredClone(current),
    () => 999,
    () => `history-${++sequence}`,
  )
}

describe('ActivityRangeHistoryService', () => {
  it('保存首次与重测记录，按时间提供倒序和正序独立副本', async () => {
    const repository = new MemoryHistoryRepository()
    const service = createService(repository)
    await service.record(rangeA, profile(rangeA, 100), 'first-run')
    await service.record(rangeB, profile(rangeB, 200), 'settings-remeasurement')

    const descending = await service.getAll()
    expect(descending.map((record) => record.measuredAt)).toEqual([200, 100])
    expect((await service.getChronological()).map((record) => record.measuredAt)).toEqual([100, 200])
    descending[0].measuredRange.forwardMax = 999
    expect((await service.getAll())[0].measuredRange.forwardMax).toBe(15)
  })

  it('精确身份重复时去重，但相同范围在不同时间仍会保留', async () => {
    const repository = new MemoryHistoryRepository()
    const service = createService(repository)
    await service.record(rangeA, profile(rangeA, 100), 'first-run')
    await service.record(rangeA, profile(rangeA, 100), 'settings-remeasurement')
    await service.record(rangeA, profile(rangeA, 101), 'settings-remeasurement')
    expect(repository.records).toHaveLength(2)
  })

  it('仅在独立历史为空时恢复训练快照和未覆盖的当前 Profile', async () => {
    const repository = new MemoryHistoryRepository()
    const recoveredA = profile(rangeA, 100, 'profile-a')
    const current = profile(rangeB, 300, 'profile-current')
    const damaged = { ...trainingRecord('damaged', recoveredA), motionProfile: {} as MotionProfile }
    const service = createService(repository, [trainingRecord('one', recoveredA), trainingRecord('duplicate', recoveredA), damaged], current)

    const first = service.recoverLegacyIfNeeded()
    expect(service.recoverLegacyIfNeeded()).toBe(first)
    await first
    const records = await service.getAll()
    expect(records.map((record) => record.measuredAt)).toEqual([300, 100])
    expect(records.every((record) => record.source === 'legacy-recovered')).toBe(true)
    expect(records.map((record) => record.profileId)).toEqual(['profile-current', 'profile-a'])

    await service.recoverLegacyIfNeeded()
    expect(repository.records).toHaveLength(2)
  })

  it('已有独立历史时不会读取或修改旧训练数据', async () => {
    const repository = new MemoryHistoryRepository()
    repository.records.push({
      schemaVersion: 1, id: 'existing', profileId: 'default', measuredAt: 1,
      measuredRange: structuredClone(rangeA), activeRange: activeRangeFromMeasured(rangeA, 0.8),
      trainingRatio: 0.8, source: 'first-run',
    })
    const getAll = vi.fn(async () => [trainingRecord('old', profile(rangeB, 2))])
    const service = new ActivityRangeHistoryService(repository, { getAll }, () => profile(rangeB, 3))
    await service.recoverLegacyIfNeeded()
    expect(getAll).not.toHaveBeenCalled()
    expect(repository.records).toHaveLength(1)
  })
})
