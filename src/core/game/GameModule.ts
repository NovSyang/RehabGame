import type { ITrainingReplayPlayer } from '../replay/ITrainingReplayPlayer'
import type { BaseTrainingResult } from '../training/BaseTrainingResult'
import type { GameDefinition } from './GameDefinition'
import type { GameResultPresentation } from './GameResultPresentation'
import type { ITrainingGame } from './ITrainingGame'
import type { TrainingGameEvents } from './TrainingGameEvents'

/** 一款正式游戏接入选择、训练、结果、历史和回放的完整契约。 */
export interface GameModule<
  TResult extends BaseTrainingResult = BaseTrainingResult,
  TConfig = unknown,
> {
  definition: GameDefinition
  createGame(events: TrainingGameEvents<TResult>): ITrainingGame<TResult>
  getConfigSnapshot(): TConfig
  presentResult(result: TResult, config: TConfig): GameResultPresentation
  /** 回放可读取训练当时的配置；不需要配置的游戏可以忽略此参数。 */
  createReplayPlayer(config?: TConfig): ITrainingReplayPlayer | null
}
