import type { RiverLane, RiverObjectKind } from './RiverGameConfig'

export interface RiverLevelSegment {
  id: string
  title: string
  start: number
  length: number
}

export interface RiverLevelObject {
  id: string
  kind: RiverObjectKind
  distance: number
  lane: RiverLane
  direction?: RiverLane
  length?: number
}

export interface RiverLevelDefinition {
  id: 'forest-river-01'
  length: number
  segments: RiverLevelSegment[]
  objects: RiverLevelObject[]
}

const lanes: RiverLane[] = ['left', 'right', 'center']

/** 生成固定的森林溪谷第一关；同一配置在不同设备上拥有相同任务顺序。 */
export function createForestRiverLevel(): RiverLevelDefinition {
  const segments: RiverLevelSegment[] = [
    { id: 'intro', title: '熟悉操作', start: 0, length: 1_600 },
    { id: 'collect', title: '连续收集', start: 1_600, length: 1_800 },
    { id: 'gates', title: '训练门', start: 3_400, length: 1_800 },
    { id: 'obstacles', title: '障碍规避', start: 5_200, length: 1_800 },
    { id: 'hold', title: '稳定保持', start: 7_000, length: 1_600 },
    { id: 'combined', title: '综合训练', start: 8_600, length: 2_200 },
  ]
  const objects: RiverLevelObject[] = []
  addRepeated(objects, 'intro-star', 'star', 280, 300, 4, ['left', 'right'])
  addRepeated(objects, 'collect-star', 'star', 1_790, 190, 8, ['left', 'center', 'right'])
  addRepeated(objects, 'gate', 'gate', 3_650, 255, 6, lanes)
  addRepeated(objects, 'avoid-obstacle', 'obstacle', 5_520, 360, 4, ['left', 'right'])
  addRepeated(objects, 'avoid-star', 'star', 5_700, 650, 2, ['right', 'left'])
  objects.push({ id: 'hold-1', kind: 'hold', distance: 7_500, lane: 'center', length: 360 })
  addRepeated(objects, 'combined-star', 'star', 8_820, 285, 6, ['left', 'right', 'center'])
  addRepeated(objects, 'combined-gate', 'gate', 8_980, 460, 4, ['right', 'left', 'center'])
  addRepeated(objects, 'combined-obstacle', 'obstacle', 9_160, 470, 4, ['left', 'right'])
  objects.push({ id: 'hold-2', kind: 'hold', distance: 10_080, lane: 'right', length: 360 })
  return { id: 'forest-river-01', length: 10_800, segments, objects: objects.sort((a, b) => a.distance - b.distance) }
}

function addRepeated(
  target: RiverLevelObject[],
  prefix: string,
  kind: RiverObjectKind,
  start: number,
  gap: number,
  count: number,
  lanePattern: readonly RiverLane[],
): void {
  for (let index = 0; index < count; index += 1) {
    const lane = lanePattern[index % lanePattern.length]
    target.push({ id: `${prefix}-${index + 1}`, kind, distance: start + gap * index, lane, direction: kind === 'gate' ? lane : undefined })
  }
}

export function countRiverObjects(level: RiverLevelDefinition, kind: RiverObjectKind): number {
  return level.objects.filter((object) => object.kind === kind).length
}
