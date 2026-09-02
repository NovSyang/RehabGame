import type { NormalizedPoint } from './TargetReachMath'

export interface ScreenPoint {
  x: number
  y: number
}

/** 集中保存标准化训练空间映射到当前 Pixi 画布所需的尺寸。 */
export interface TargetReachViewportState {
  width: number
  height: number
  centerX: number
  centerY: number
  rangeX: number
  rangeY: number
  playerRadiusX: number
  playerRadiusY: number
  targetRadiusX: number
  targetRadiusY: number
}

/** X/Y 独立缩放能充分使用横屏空间，标准化圆会对应为屏幕椭圆。 */
export function createTargetReachViewport(
  width: number,
  height: number,
  playerRadiusNormalized: number,
  targetRadiusNormalized: number,
  padding = 70,
): TargetReachViewportState {
  const safeWidth = finiteNonNegative(width)
  const safeHeight = finiteNonNegative(height)
  const safePadding = finiteNonNegative(padding)
  const playerRadius = finiteNonNegative(playerRadiusNormalized)
  const targetRadius = finiteNonNegative(targetRadiusNormalized)
  const rangeX = Math.max(0, safeWidth / 2 - safePadding)
  const rangeY = Math.max(0, safeHeight / 2 - safePadding)
  return {
    width: safeWidth,
    height: safeHeight,
    centerX: safeWidth / 2,
    centerY: safeHeight / 2,
    rangeX,
    rangeY,
    playerRadiusX: playerRadius * rangeX,
    playerRadiusY: playerRadius * rangeY,
    targetRadiusX: targetRadius * rangeX,
    targetRadiusY: targetRadius * rangeY,
  }
}

/** Y 轴向上为正，因此映射到屏幕时需要反向。 */
export function toTargetReachScreenPoint(point: NormalizedPoint, viewport: TargetReachViewportState): ScreenPoint {
  return {
    x: viewport.centerX + point.x * viewport.rangeX,
    y: viewport.centerY - point.y * viewport.rangeY,
  }
}

function finiteNonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0
}
