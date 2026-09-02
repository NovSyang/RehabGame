import { describe, expect, it } from 'vitest'
import { applyRiverDeadZone, collisionAllowed, difficultyRangeScale, getForwardSpeed, holdStability, updateHoldProgress, updateHorizontalVelocity } from '../src/games/river/RiverControl'
import { RiverDifficultyManager } from '../src/games/river/RiverDifficultyManager'
import { countRiverObjects, createForestRiverLevel } from '../src/games/river/RiverLevel'
import { buildRiverTrainingResult, scoreForSuccess } from '../src/games/river/RiverTrainingResult'

describe('River control', () => {
  it('应用额外死区并保持方向', () => {
    expect(applyRiverDeadZone(0.08)).toBe(0)
    expect(applyRiverDeadZone(-0.5)).toBeLessThan(0)
    expect(applyRiverDeadZone(1)).toBe(1)
  })

  it('横向速度受加速度、最高速度和阻尼约束', () => {
    expect(updateHorizontalVelocity(0, 1, 0.1)).toBe(110)
    expect(updateHorizontalVelocity(400, 1, 1)).toBe(420)
    expect(updateHorizontalVelocity(100, 0, 1)).toBeLessThan(1)
  })

  it('纵向输入映射到 45/60/80 航速', () => {
    expect(getForwardSpeed(-1)).toBe(45)
    expect(getForwardSpeed(0)).toBe(60)
    expect(getForwardSpeed(1)).toBe(80)
  })

  it('碰撞保护和 Hold 缓慢回退遵守固定规则', () => {
    expect(collisionAllowed(799, 800)).toBe(false)
    expect(collisionAllowed(800, 800)).toBe(true)
    expect(updateHoldProgress(1_000, false, 400)).toBe(800)
    expect(updateHoldProgress(100, false, 400)).toBe(0)
    expect(holdStability(0, 100)).toBe(1)
    expect(holdStability(150, 100)).toBe(0)
  })
})

describe('River level and difficulty', () => {
  it('第一关包含锁定的六段长度与任务总数', () => {
    const level = createForestRiverLevel()
    expect(level.segments.map((item) => item.length)).toEqual([1600, 1800, 1800, 1800, 1600, 2200])
    expect(level.segments.reduce((sum, item) => sum + item.length, 0)).toBe(10_800)
    expect(countRiverObjects(level, 'star')).toBe(20)
    expect(countRiverObjects(level, 'gate')).toBe(10)
    expect(countRiverObjects(level, 'obstacle')).toBe(8)
    expect(countRiverObjects(level, 'hold')).toBe(2)
  })

  it('三次成功进入挑战、两次失败进入辅助并遵守冷却', () => {
    const manager = new RiverDifficultyManager(15_000)
    manager.recordSuccess(0); manager.recordSuccess(100)
    expect(manager.recordSuccess(200)).toBe('challenge')
    manager.recordFailure(1_000)
    expect(manager.recordFailure(2_000)).toBeNull()
    expect(manager.recordFailure(16_000)).toBe('assist')
    expect(difficultyRangeScale('collect', 'assist')).toBe(1.2)
    expect(difficultyRangeScale('gate', 'challenge')).toBe(0.92)
  })
})

describe('River result', () => {
  it('组合奖励封顶并汇总原始指标', () => {
    expect(scoreForSuccess(100, 1)).toBe(100)
    expect(scoreForSuccess(100, 8)).toBe(200)
    const result = buildRiverTrainingResult(1, 2, 10_000, {
      score: 1_200, maxCombo: 4, starsTotal: 20, starsCollected: 15,
      gateDirections: ['left', 'center', 'right'], successfulGateDirections: ['left', 'right'],
      gateReactionTimesMs: [300, 500], collisionCount: 2, holdsTotal: 2, holdsSucceeded: 1,
      holdStabilities: [0.8, 0.6], accelerationDurationMs: 2_000, decelerationDurationMs: 1_000,
      speedSamples: [50, 70], inputSamples: [{ x: -0.8, y: -0.4 }, { x: 0.7, y: 0.9 }],
    })
    expect(result.averageGateReactionMs).toBe(400)
    expect(result.averageHoldStability).toBeCloseTo(0.7)
    expect(result.averageForwardSpeed).toBe(60)
    expect(result.gatesByDirection.left.success).toBe(1)
    expect(result.inputExtremes).toEqual({ minX: -0.8, maxX: 0.7, minY: -0.4, maxY: 0.9 })
  })
})
