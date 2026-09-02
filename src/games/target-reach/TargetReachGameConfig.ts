import { ALL_DIRECTIONS, type Direction } from '../../core/training/Direction'

export interface TargetReachGameConfig {
  sessionDurationMs: number
  targetCount: number
  targetDistance: number
  targetRadiusNormalized: number
  playerRadiusNormalized: number
  holdTimeMs: number
  targetTimeoutMs: number
  movementThreshold: number
  enabledDirections: Direction[]
}

/** 默认难度使用标准化训练空间，视觉尺寸和业务命中共享同一半径。 */
export const defaultTargetReachGameConfig: TargetReachGameConfig = {
  sessionDurationMs: 120_000,
  targetCount: 20,
  targetDistance: 0.7,
  targetRadiusNormalized: 0.12,
  playerRadiusNormalized: 0.08,
  holdTimeMs: 300,
  targetTimeoutMs: 8_000,
  movementThreshold: 0.08,
  enabledDirections: [...ALL_DIRECTIONS],
}
