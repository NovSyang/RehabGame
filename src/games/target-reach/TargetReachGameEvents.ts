import type { Direction } from '../../core/training/Direction'
import type { TrainingResult } from '../../core/training/TrainingResult'
import type { TrainingSessionState } from '../../core/training/TrainingSessionState'
import type { TargetReachReplayEvent } from './replay/TargetReachReplayEvent'

export interface TargetReachGameEvents {
  onTargetChanged?: (direction: Direction, index: number) => void
  onScoreChanged?: (success: number, total: number) => void
  onSessionStateChanged?: (state: TrainingSessionState) => void
  onReplayEvent?: (event: TargetReachReplayEvent) => void
  onCompleted?: (result: TrainingResult) => void
}
