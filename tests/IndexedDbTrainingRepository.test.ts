import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { IndexedDbTrainingRepository } from '../src/core/training/IndexedDbTrainingRepository'
import { createDefaultMotionProfile } from '../src/core/motion/MotionProfile'
import type { TrainingRecord } from '../src/core/training/TrainingRecord'
import type { TrainingReplay } from '../src/core/replay/TrainingReplay'

function record(id: string, completedAt: number): TrainingRecord {
  return {
    schemaVersion: 1, id, gameId: 'target-reach', gameName: '四方向目标触达', completedAt,
    motionProfile: createDefaultMotionProfile(1), gameConfig: {},
    result: { startedAt: 1, endedAt: 2, durationMs: 1, totalTargets: 1, successTargets: 1, failedTargets: 0, successRate: 1, averageReactionTimeMs: 1, averageReachTimeMs: 1, attempts: [], directions: { left: { total: 0, success: 0, failed: 0, averageReachTimeMs: null }, right: { total: 0, success: 0, failed: 0, averageReachTimeMs: null }, forward: { total: 0, success: 0, failed: 0, averageReachTimeMs: null }, backward: { total: 0, success: 0, failed: 0, averageReachTimeMs: null } } },
  }
}

beforeEach(async () => { await new Promise<void>((resolve) => { const request = indexedDB.deleteDatabase('rehab-game'); request.onsuccess = () => resolve(); request.onerror = () => resolve() }) })

describe('IndexedDbTrainingRepository', () => {
  it('保存、倒序读取、按 ID 查询和删除，并兼容 V1/V2 Replay', async () => {
    const repository = new IndexedDbTrainingRepository()
    const replay: TrainingReplay = { schemaVersion: 1, durationMs: 40, sampleRateHz: 25, samples: [{ elapsedMs: 0, x: 0, y: 0 }], events: [] }
    await repository.save(record('old', 1))
    await repository.save({ ...record('new', 2), schemaVersion: 2, replay })
    expect((await repository.getAll()).map((item) => item.id)).toEqual(['new', 'old'])
    expect((await repository.getById('old'))?.completedAt).toBe(1)
    expect((await repository.getById('old'))?.replay).toBeUndefined()
    expect((await repository.getById('new'))?.replay).toEqual(replay)
    await repository.delete('old')
    expect(await repository.getById('old')).toBeNull()
  })
})
