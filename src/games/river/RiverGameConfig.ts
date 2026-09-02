export type RiverDifficulty = 'assist' | 'normal' | 'challenge'
export type RiverLane = 'left' | 'center' | 'right'
export type RiverObjectKind = 'star' | 'gate' | 'obstacle' | 'hold'

export interface RiverGameConfig {
  levelId: 'forest-river-01'
  levelLength: number
  logicalWidth: number
  logicalHeight: number
  inputDeadZone: number
  horizontalMaxSpeed: number
  horizontalAcceleration: number
  centerDamping: number
  minForwardSpeed: number
  centerForwardSpeed: number
  maxForwardSpeed: number
  riverHalfWidth: number
  collisionSpeedMultiplier: number
  collisionSlowMs: number
  collisionProtectionMs: number
  holdLength: number
  holdRequiredMs: number
  difficultyCooldownMs: number
}

/** 第一关参数集中定义，历史记录会保存该配置快照。 */
export const defaultRiverGameConfig: Readonly<RiverGameConfig> = {
  levelId: 'forest-river-01',
  levelLength: 10_800,
  logicalWidth: 1280,
  logicalHeight: 720,
  inputDeadZone: 0.08,
  horizontalMaxSpeed: 420,
  horizontalAcceleration: 1_100,
  centerDamping: 6,
  minForwardSpeed: 45,
  centerForwardSpeed: 60,
  maxForwardSpeed: 80,
  riverHalfWidth: 390,
  collisionSpeedMultiplier: 0.72,
  collisionSlowMs: 650,
  collisionProtectionMs: 800,
  holdLength: 360,
  holdRequiredMs: 2_500,
  difficultyCooldownMs: 15_000,
}
