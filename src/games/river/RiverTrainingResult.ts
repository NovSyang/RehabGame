import type { BaseTrainingResult } from '../../core/training/BaseTrainingResult'
import type { RiverLane } from './RiverGameConfig'

export interface RiverGateDirectionStats { total: number; success: number }

export interface RiverTrainingResult extends BaseTrainingResult {
  score: number
  maxCombo: number
  starsTotal: number
  starsCollected: number
  gatesTotal: number
  gatesSucceeded: number
  gatesByDirection: Record<RiverLane, RiverGateDirectionStats>
  collisionCount: number
  holdsTotal: number
  holdsSucceeded: number
  averageHoldStability: number | null
  averageGateReactionMs: number | null
  accelerationDurationMs: number
  decelerationDurationMs: number
  averageForwardSpeed: number
  inputExtremes: { minX: number; maxX: number; minY: number; maxY: number }
}

export interface RiverResultFacts {
  score: number
  maxCombo: number
  starsTotal: number
  starsCollected: number
  gateDirections: readonly RiverLane[]
  successfulGateDirections: readonly RiverLane[]
  gateReactionTimesMs: readonly number[]
  collisionCount: number
  holdsTotal: number
  holdsSucceeded: number
  holdStabilities: readonly number[]
  accelerationDurationMs: number
  decelerationDurationMs: number
  speedSamples: readonly number[]
  inputSamples: readonly { x: number; y: number }[]
}

/** 由已发生的游戏事实生成中立结果，不生成临床评分。 */
export function buildRiverTrainingResult(startedAt: number, endedAt: number, durationMs: number, facts: RiverResultFacts): RiverTrainingResult {
  const validStabilities = facts.holdStabilities.filter(isUnitValue)
  const reactions = facts.gateReactionTimesMs.filter((value) => Number.isFinite(value) && value >= 0)
  const speeds = facts.speedSamples.filter((value) => Number.isFinite(value) && value >= 0)
  const inputs = facts.inputSamples.filter((value) => Number.isFinite(value.x) && Number.isFinite(value.y))
  const directions = (['left', 'center', 'right'] as const)
  const gatesByDirection = Object.fromEntries(directions.map((direction) => [direction, {
    total: facts.gateDirections.filter((item) => item === direction).length,
    success: facts.successfulGateDirections.filter((item) => item === direction).length,
  }])) as Record<RiverLane, RiverGateDirectionStats>
  return {
    startedAt,
    endedAt,
    durationMs: Math.max(0, durationMs),
    score: Math.max(0, Math.round(facts.score)),
    maxCombo: Math.max(0, Math.round(facts.maxCombo)),
    starsTotal: Math.max(0, facts.starsTotal),
    starsCollected: Math.max(0, facts.starsCollected),
    gatesTotal: facts.gateDirections.length,
    gatesSucceeded: facts.successfulGateDirections.length,
    gatesByDirection,
    collisionCount: Math.max(0, facts.collisionCount),
    holdsTotal: Math.max(0, facts.holdsTotal),
    holdsSucceeded: Math.max(0, facts.holdsSucceeded),
    averageHoldStability: average(validStabilities),
    averageGateReactionMs: average(reactions),
    accelerationDurationMs: Math.max(0, Math.round(facts.accelerationDurationMs)),
    decelerationDurationMs: Math.max(0, Math.round(facts.decelerationDurationMs)),
    averageForwardSpeed: average(speeds) ?? 0,
    inputExtremes: inputs.length === 0
      ? { minX: 0, maxX: 0, minY: 0, maxY: 0 }
      : {
          minX: Math.min(...inputs.map((value) => value.x)),
          maxX: Math.max(...inputs.map((value) => value.x)),
          minY: Math.min(...inputs.map((value) => value.y)),
          maxY: Math.max(...inputs.map((value) => value.y)),
        },
  }
}

/** 连续成功时增加固定上限的奖励分。 */
export function scoreForSuccess(baseScore: number, combo: number): number {
  return baseScore + 20 * Math.min(Math.max(0, combo - 1), 5)
}

function isUnitValue(value: number): boolean { return Number.isFinite(value) && value >= 0 && value <= 1 }
function average(values: readonly number[]): number | null { return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length }
