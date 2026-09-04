import type { MotionRange } from '../MotionConfig'
import { profileFromMeasuredRange, type MotionProfile } from '../MotionProfile'
import type { ActivityRangeHistorySource } from './ActivityRangeHistoryRecord'

/** 仅声明保存流程需要的最小 Profile 能力，便于独立测试保存顺序。 */
export interface ActivityRangeProfileWriter {
  getCurrent(): MotionProfile
  save(profile: MotionProfile): Promise<void>
}

/** 历史服务只需接收已经实际保存并应用的 Profile 快照。 */
export interface ActivityRangeHistoryWriter {
  record(range: MotionRange, profile: MotionProfile, source: ActivityRangeHistorySource): Promise<unknown>
}

/**
 * 先保存并应用训练配置，再追加不可变的测量事实。
 * 历史失败不会回滚 Profile，避免用户已经完成的测量结果丢失。
 */
export async function saveActivityRangeMeasurement(
  range: MotionRange,
  source: ActivityRangeHistorySource,
  profileWriter: ActivityRangeProfileWriter,
  historyWriter: ActivityRangeHistoryWriter,
): Promise<MotionProfile> {
  const nextProfile = profileFromMeasuredRange(range, profileWriter.getCurrent())
  await profileWriter.save(nextProfile)
  const savedProfile = profileWriter.getCurrent()
  try {
    await historyWriter.record(range, savedProfile, source)
  } catch (cause) {
    throw new Error('个人活动范围已保存，但历史记录保存失败，请重试。', { cause })
  }
  return savedProfile
}
