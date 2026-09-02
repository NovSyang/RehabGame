import type { RiverDifficulty } from './RiverGameConfig'

/** 根据近期表现切换保守难度，并使用冷却时间避免频繁变化。 */
export class RiverDifficultyManager {
  private difficulty: RiverDifficulty = 'normal'
  private successStreak = 0
  private failureStreak = 0
  private lastChangedAt = Number.NEGATIVE_INFINITY

  constructor(private readonly cooldownMs = 15_000) {}

  recordSuccess(elapsedMs: number): RiverDifficulty | null {
    this.successStreak += 1
    this.failureStreak = 0
    if (this.successStreak < 3 || elapsedMs - this.lastChangedAt < this.cooldownMs || this.difficulty === 'challenge') return null
    return this.change('challenge', elapsedMs)
  }

  recordFailure(elapsedMs: number): RiverDifficulty | null {
    this.failureStreak += 1
    this.successStreak = 0
    if (this.failureStreak < 2 || elapsedMs - this.lastChangedAt < this.cooldownMs || this.difficulty === 'assist') return null
    return this.change('assist', elapsedMs)
  }

  getCurrent(): RiverDifficulty { return this.difficulty }

  reset(): void {
    this.difficulty = 'normal'
    this.successStreak = 0
    this.failureStreak = 0
    this.lastChangedAt = Number.NEGATIVE_INFINITY
  }

  private change(next: RiverDifficulty, elapsedMs: number): RiverDifficulty {
    this.difficulty = next
    this.lastChangedAt = elapsedMs
    this.successStreak = 0
    this.failureStreak = 0
    return next
  }
}
