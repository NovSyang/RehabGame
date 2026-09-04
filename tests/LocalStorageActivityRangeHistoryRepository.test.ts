import { describe, expect, it } from 'vitest'
import { LocalStorageActivityRangeHistoryRepository } from '../src/core/motion/history/LocalStorageActivityRangeHistoryRepository'
import type { ActivityRangeHistoryRecord } from '../src/core/motion/history/ActivityRangeHistoryRecord'
import type { IKeyValueStore } from '../src/core/storage/IKeyValueStore'
import { StorageKeys } from '../src/core/storage/StorageKeys'

class MemoryStore implements IKeyValueStore {
  readonly values = new Map<string, string>()
  ignoreWrites = false

  async get(key: string): Promise<string | null> { return this.values.get(key) ?? null }
  async set(key: string, value: string): Promise<void> { if (!this.ignoreWrites) this.values.set(key, value) }
  async remove(key: string): Promise<void> { if (!this.ignoreWrites) this.values.delete(key) }
}

function createRecord(id = 'range-1', measuredAt = 100): ActivityRangeHistoryRecord {
  return {
    schemaVersion: 1,
    id,
    profileId: 'default',
    measuredAt,
    measuredRange: { forwardMax: 10, backwardMax: 11, leftMax: 12, rightMax: 13 },
    activeRange: { forwardMax: 8, backwardMax: 8.8, leftMax: 9.6, rightMax: 10.4 },
    trainingRatio: 0.8,
    source: 'first-run',
  }
}

describe('LocalStorageActivityRangeHistoryRepository', () => {
  it('空数据、损坏 JSON 和非数组数据都安全返回空列表', async () => {
    const store = new MemoryStore()
    const repository = new LocalStorageActivityRangeHistoryRepository(store)
    expect(await repository.getAll()).toEqual([])
    store.values.set(StorageKeys.activityRangeHistory, '{broken')
    expect(await repository.getAll()).toEqual([])
    store.values.set(StorageKeys.activityRangeHistory, '{}')
    expect(await repository.getAll()).toEqual([])
  })

  it('追加后回读独立副本，并按身份阻止重复记录', async () => {
    const store = new MemoryStore()
    const repository = new LocalStorageActivityRangeHistoryRepository(store)
    const record = createRecord()
    await repository.append(record)
    record.measuredRange.forwardMax = 999
    const firstRead = await repository.getAll()
    firstRead[0].activeRange.forwardMax = 999
    await repository.append({ ...createRecord('another-id'), source: 'settings-remeasurement' })

    const records = await repository.getAll()
    expect(records).toHaveLength(1)
    expect(records[0].measuredRange.forwardMax).toBe(10)
    expect(records[0].activeRange.forwardMax).toBe(8)
  })

  it('逐条过滤非法 Schema、时间、范围、比例和来源', async () => {
    const store = new MemoryStore()
    const valid = createRecord()
    const values = [
      valid,
      { ...valid, id: 'schema', schemaVersion: 2 },
      { ...valid, id: 'time', measuredAt: Number.NaN },
      { ...valid, id: 'range', measuredRange: { ...valid.measuredRange, leftMax: -1 } },
      { ...valid, id: 'ratio', trainingRatio: 2 },
      { ...valid, id: 'source', source: 'manual' },
    ]
    store.values.set(StorageKeys.activityRangeHistory, JSON.stringify(values))
    const records = await new LocalStorageActivityRangeHistoryRepository(store).getAll()
    expect(records.map((record) => record.id)).toEqual(['range-1'])
  })

  it('支持清空历史，并通过回读识别被底层吞掉的写入失败', async () => {
    const store = new MemoryStore()
    const repository = new LocalStorageActivityRangeHistoryRepository(store)
    await repository.append(createRecord())
    await repository.clear()
    expect(await repository.getAll()).toEqual([])

    store.ignoreWrites = true
    await expect(repository.append(createRecord('failed', 200))).rejects.toThrow('未能写入')
    store.values.set(StorageKeys.activityRangeHistory, JSON.stringify([createRecord()]))
    await expect(repository.clear()).rejects.toThrow('未能清除')
  })
})
