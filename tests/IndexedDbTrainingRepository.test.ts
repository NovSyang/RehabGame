import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { IndexedDbTrainingRepository } from '../src/core/training/IndexedDbTrainingRepository'
import { createDefaultMotionProfile } from '../src/core/motion/MotionProfile'
import type { TrainingRecord } from '../src/core/training/TrainingRecord'

function record(id: string, completedAt: number): TrainingRecord {
  return {
    schemaVersion: 1, id, gameId: 'target-reach', gameName: '四方向目标触达', completedAt,
    motionProfile: createDefaultMotionProfile(1), gameConfig: {},
    result: { startedAt: 1, endedAt: 2, durationMs: 1, totalTargets: 1, successTargets: 1, failedTargets: 0, successRate: 1, averageReactionTimeMs: 1, averageReachTimeMs: 1, attempts: [], directions: { left: { total: 0, success: 0, failed: 0, averageReachTimeMs: null }, right: { total: 0, success: 0, failed: 0, averageReachTimeMs: null }, forward: { total: 0, success: 0, failed: 0, averageReachTimeMs: null }, backward: { total: 0, success: 0, failed: 0, averageReachTimeMs: null } } },
  }
}

beforeEach(async () => { await new Promise<void>((resolve) => { const request = indexedDB.deleteDatabase('rehab-game'); request.onsuccess = () => resolve(); request.onerror = () => resolve() }) })

describe('IndexedDbTrainingRepository', () => {
  it('保存、倒序读取、按 ID 查询和删除训练记录', async () => {
    const repository = new IndexedDbTrainingRepository()
    await repository.save(record('old', 1))
    await repository.save(record('new', 2))
    expect((await repository.getAll()).map((item) => item.id)).toEqual(['new', 'old'])
    expect((await repository.getById('old'))?.completedAt).toBe(1)
    await repository.delete('old')
    expect(await repository.getById('old')).toBeNull()
  })
})
