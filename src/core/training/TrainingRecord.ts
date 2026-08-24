import type { MotionProfile } from '../motion/MotionProfile'
import type { TrainingResult } from './TrainingResult'

/** 可跨应用重启保存的单次训练快照，不包含患者身份信息。 */
export interface TrainingRecord {
  schemaVersion: 1
  id: string
  gameId: string
  gameName: string
  completedAt: number
  result: TrainingResult
  motionProfile: MotionProfile
  gameConfig: unknown
}
