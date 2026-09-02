import { describe, expect, it } from 'vitest'
import { GameTutorialController } from '../src/core/game/GameTutorial'
import { GameTutorialRepository } from '../src/core/game/GameTutorialRepository'
import type { GameInput } from '../src/core/game-input/GameInput'
import type { IKeyValueStore } from '../src/core/storage/IKeyValueStore'

const definition = {
  version: 2,
  steps: [
    { id: 'left', title: '左', description: '向左', axis: 'x' as const, direction: 'negative' as const, threshold: 0.25, holdMs: 400 },
    { id: 'forward', title: '前', description: '向前', axis: 'y' as const, direction: 'positive' as const, threshold: 0.25, holdMs: 400 },
  ],
}

describe('GameTutorialController', () => {
  it('必须按顺序达到阈值并连续保持 400ms', () => {
    const controller = new GameTutorialController(definition)
    expect(controller.update(input(-0.3, 0), 1_000).holdProgress).toBe(0)
    expect(controller.update(input(-0.3, 0), 1_399).completed).toBe(false)
    expect(controller.update(input(-0.3, 0), 1_400).step?.id).toBe('forward')
    controller.update(input(0, 0.3), 2_000)
    expect(controller.update(input(0, 0.3), 2_400).completed).toBe(true)
  })

  it('离开方向或断线会重新计算当前步骤保持时间', () => {
    const controller = new GameTutorialController(definition)
    controller.update(input(-0.3, 0), 0)
    controller.update(input(0, 0), 300)
    expect(controller.update(input(-0.3, 0), 500).holdProgress).toBe(0)
    expect(controller.update({ ...input(-0.3, 0), connected: false }, 900).step?.id).toBe('left')
  })
})

describe('GameTutorialRepository', () => {
  it('只在游戏与教程版本均匹配时视为完成', async () => {
    const store = new MemoryStore()
    const repository = new GameTutorialRepository(store)
    expect(await repository.isCompleted('forest-river', 1)).toBe(false)
    await repository.markCompleted('forest-river', 1)
    expect(await repository.isCompleted('forest-river', 1)).toBe(true)
    expect(await repository.isCompleted('forest-river', 2)).toBe(false)
  })
})

function input(x: number, y: number): GameInput { return { x, y, connected: true, calibrated: true, timestamp: 0 } }
class MemoryStore implements IKeyValueStore {
  private values = new Map<string, string>()
  async get(key: string): Promise<string | null> { return this.values.get(key) ?? null }
  async set(key: string, value: string): Promise<void> { this.values.set(key, value) }
  async remove(key: string): Promise<void> { this.values.delete(key) }
}
