import type { GameInput } from '../game-input/GameInput'
import type { GameTutorialDefinition, GameTutorialStep } from './GameDefinition'

export interface GameTutorialSnapshot {
  completed: boolean
  stepIndex: number
  step: GameTutorialStep | null
  holdProgress: number
}

/** 按有效传感器时间检查方向和保持时长，教程本身不计入训练。 */
export class GameTutorialController {
  private stepIndex = 0
  private holdStartedAt: number | null = null

  constructor(private readonly definition: GameTutorialDefinition) {}

  update(input: GameInput, now: number): GameTutorialSnapshot {
    const step = this.definition.steps[this.stepIndex]
    if (!step) return this.getSnapshot(now)
    if (!input.connected || !input.calibrated || !matchesStep(input, step)) {
      this.holdStartedAt = null
      return this.getSnapshot(now)
    }
    this.holdStartedAt ??= now
    if (now - this.holdStartedAt >= step.holdMs) {
      this.stepIndex += 1
      this.holdStartedAt = null
    }
    return this.getSnapshot(now)
  }

  reset(): void {
    this.stepIndex = 0
    this.holdStartedAt = null
  }

  getSnapshot(now: number): GameTutorialSnapshot {
    const step = this.definition.steps[this.stepIndex] ?? null
    const elapsed = this.holdStartedAt === null ? 0 : Math.max(0, now - this.holdStartedAt)
    return {
      completed: step === null,
      stepIndex: this.stepIndex,
      step,
      holdProgress: step ? Math.min(1, elapsed / Math.max(1, step.holdMs)) : 1,
    }
  }
}

/** 把方向定义转换为标准化轴值判断。 */
function matchesStep(input: GameInput, step: GameTutorialStep): boolean {
  const value = input[step.axis]
  return step.direction === 'positive' ? value >= step.threshold : value <= -step.threshold
}
