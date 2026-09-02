import type { RiverDifficulty, RiverLane, RiverObjectKind } from './RiverGameConfig'

export interface RiverReplayObject {
  id: string
  kind: RiverObjectKind
  distance: number
  lane: RiverLane
  difficulty: RiverDifficulty
  rangeScale: number
  outcome: 'success' | 'failed' | 'collision' | 'unresolved'
  length?: number
}

export interface RiverBoatSample {
  elapsedMs: number
  boatX: number
  progress: number
  speed: number
  rotation: number
  state: string
}

export interface RiverRunSnapshot {
  levelLength: number
  riverHalfWidth: number
  objects: RiverReplayObject[]
  boatSamples: RiverBoatSample[]
}
