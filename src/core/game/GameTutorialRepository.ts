import type { IKeyValueStore } from '../storage/IKeyValueStore'
import { StorageKeys } from '../storage/StorageKeys'

interface TutorialState {
  schemaVersion: 1
  completedVersions: Record<string, number>
}

/** 只持久化每款游戏已完成的教程版本，不保存训练数据。 */
export class GameTutorialRepository {
  constructor(private readonly store: IKeyValueStore) {}

  async isCompleted(gameId: string, version: number): Promise<boolean> {
    const state = await this.load()
    return state.completedVersions[gameId] === version
  }

  async markCompleted(gameId: string, version: number): Promise<void> {
    const state = await this.load()
    state.completedVersions[gameId] = version
    await this.store.set(StorageKeys.gameTutorial, JSON.stringify(state))
  }

  private async load(): Promise<TutorialState> {
    try {
      const raw = await this.store.get(StorageKeys.gameTutorial)
      if (!raw) return emptyState()
      const value = JSON.parse(raw) as Partial<TutorialState>
      if (value.schemaVersion !== 1 || !value.completedVersions || typeof value.completedVersions !== 'object') return emptyState()
      const completedVersions = Object.fromEntries(Object.entries(value.completedVersions).filter(([, version]) => Number.isInteger(version) && Number(version) > 0))
      return { schemaVersion: 1, completedVersions }
    } catch {
      return emptyState()
    }
  }
}

function emptyState(): TutorialState {
  return { schemaVersion: 1, completedVersions: {} }
}
