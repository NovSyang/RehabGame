import { describe, expect, it, vi } from 'vitest'
import { saveActivityRangeMeasurement } from '../src/core/motion/history/PersistActivityRangeMeasurement'
import { createDefaultMotionProfile, type MotionProfile } from '../src/core/motion/MotionProfile'
import type { MotionRange } from '../src/core/motion/MotionConfig'

const measuredRange: MotionRange = { forwardMax: 20, backwardMax: 15, leftMax: 10, rightMax: 25 }

function createProfileWriter(events: string[]): { getCurrent(): MotionProfile; save(profile: MotionProfile): Promise<void> } {
  let current = createDefaultMotionProfile(1)
  return {
    getCurrent: () => structuredClone(current),
    save: async (profile) => {
      events.push('profile')
      // 模拟真实服务在持久化时写入最终更新时间。
      current = { ...structuredClone(profile), updatedAt: 500 }
    },
  }
}

describe('saveActivityRangeMeasurement', () => {
  it('先保存 Profile，再用实际保存后的快照追加历史', async () => {
    const events: string[] = []
    const profileWriter = createProfileWriter(events)
    const historyWriter = {
      record: vi.fn(async (_range: MotionRange, profile: MotionProfile) => {
        events.push('history')
        expect(profile.updatedAt).toBe(500)
      }),
    }
    const saved = await saveActivityRangeMeasurement(measuredRange, 'first-run', profileWriter, historyWriter)
    expect(events).toEqual(['profile', 'history'])
    expect(saved.measuredRange).toEqual(measuredRange)
    expect(saved.activeRange.forwardMax).toBe(16)
    expect(historyWriter.record).toHaveBeenCalledWith(measuredRange, expect.objectContaining({ updatedAt: 500 }), 'first-run')
  })

  it('历史写入失败时给出明确提示，同时保留已保存的当前 Profile', async () => {
    const events: string[] = []
    const profileWriter = createProfileWriter(events)
    const historyWriter = { record: vi.fn(async () => { throw new Error('storage unavailable') }) }
    await expect(saveActivityRangeMeasurement(measuredRange, 'settings-remeasurement', profileWriter, historyWriter))
      .rejects.toThrow('个人活动范围已保存，但历史记录保存失败，请重试。')
    expect(profileWriter.getCurrent().measuredRange).toEqual(measuredRange)
    expect(events).toEqual(['profile'])
  })
})
