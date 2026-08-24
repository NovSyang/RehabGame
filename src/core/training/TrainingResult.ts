import { ALL_DIRECTIONS, type Direction } from './Direction'

export interface TargetAttemptResult {
  index: number
  direction: Direction
  startedAt: number
  firstMovementAt: number | null
  reachedAt: number | null
  endedAt: number
  success: boolean
  reactionTimeMs: number | null
  reachTimeMs: number | null
  maxInput: number
}

export interface DirectionSummary {
  total: number
  success: number
  failed: number
  averageReachTimeMs: number | null
}

export interface TrainingResult {
  startedAt: number
  endedAt: number
  durationMs: number
  totalTargets: number
  successTargets: number
  failedTargets: number
  successRate: number
  averageReactionTimeMs: number | null
  averageReachTimeMs: number | null
  directions: Record<Direction, DirectionSummary>
  attempts: TargetAttemptResult[]
}

/** 根据每个目标的记录生成供结果页展示的汇总数据。 */
export function buildTrainingResult(
  startedAt: number,
  endedAt: number,
  durationMs: number,
  attempts: TargetAttemptResult[],
): TrainingResult {
  const directions = createDirectionSummaries()
  for (const attempt of attempts) {
    const summary = directions[attempt.direction]
    summary.total += 1
    if (attempt.success) summary.success += 1
    else summary.failed += 1
  }

  for (const direction of ALL_DIRECTIONS) {
    const reachTimes = attempts
      .filter((attempt) => attempt.direction === direction && attempt.reachTimeMs !== null)
      .map((attempt) => attempt.reachTimeMs as number)
    directions[direction].averageReachTimeMs = averageOrNull(reachTimes)
  }

  const successTargets = attempts.filter((attempt) => attempt.success).length
  const reactionTimes = attempts
    .map((attempt) => attempt.reactionTimeMs)
    .filter((value): value is number => value !== null)
  const reachTimes = attempts
    .map((attempt) => attempt.reachTimeMs)
    .filter((value): value is number => value !== null)

  return {
    startedAt,
    endedAt,
    durationMs,
    totalTargets: attempts.length,
    successTargets,
    failedTargets: attempts.length - successTargets,
    successRate: attempts.length === 0 ? 0 : successTargets / attempts.length,
    averageReactionTimeMs: averageOrNull(reactionTimes),
    averageReachTimeMs: averageOrNull(reachTimes),
    directions,
    attempts: [...attempts],
  }
}

function createDirectionSummaries(): Record<Direction, DirectionSummary> {
  return {
    left: { total: 0, success: 0, failed: 0, averageReachTimeMs: null },
    right: { total: 0, success: 0, failed: 0, averageReachTimeMs: null },
    forward: { total: 0, success: 0, failed: 0, averageReachTimeMs: null },
    backward: { total: 0, success: 0, failed: 0, averageReachTimeMs: null },
  }
}

function averageOrNull(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}
