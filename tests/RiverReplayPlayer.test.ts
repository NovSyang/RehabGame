import { describe, expect, it } from 'vitest'
import type { TrainingReplay } from '../src/core/replay/TrainingReplay'
import { extractRiverRunSnapshot } from '../src/games/river/replay/RiverReplayPlayer'

describe('River replay snapshot', () => {
  it('读取保存的世界与船体事实，不重新生成关卡', () => {
    const replay: TrainingReplay = { schemaVersion: 1, durationMs: 1_000, sampleRateHz: 25, samples: [], events: [{ elapsedMs: 1_000, type: 'river-run-snapshot', payload: { levelLength: 10_800, riverHalfWidth: 390, objects: [], boatSamples: [{ elapsedMs: 0, boatX: 2, progress: 4, speed: 60, rotation: 0, state: 'sailing' }] } }] }
    const snapshot = extractRiverRunSnapshot(replay)
    expect(snapshot?.levelLength).toBe(10_800)
    expect(snapshot?.boatSamples[0].progress).toBe(4)
  })

  it('缺失或损坏快照时安全返回 null', () => {
    expect(extractRiverRunSnapshot({ schemaVersion: 1, durationMs: 0, sampleRateHz: 25, samples: [], events: [] })).toBeNull()
  })
})
