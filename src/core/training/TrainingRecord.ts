import type { MotionProfile } from '../motion/MotionProfile'
import type { TrainingReplay } from '../replay/TrainingReplay'
import type { BaseTrainingResult } from './BaseTrainingResult'

/** 可跨应用重启保存的单次训练快照，不包含患者身份信息。 */
export interface TrainingRecord<
  TResult extends BaseTrainingResult = BaseTrainingResult,
  TConfig = unknown,
> {
  schemaVersion: 1 | 2
  id: string
  gameId: string
  gameName: string
  completedAt: number
  result: TResult
  motionProfile: MotionProfile
  gameConfig: TConfig
  /** V1 旧记录没有回放数据；V2 训练会保存完整 Replay。 */
  replay?: TrainingReplay | null
}
