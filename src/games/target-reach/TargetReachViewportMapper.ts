import type { NormalizedPoint } from './TargetReachMath'

export interface ScreenPoint {
  x: number
  y: number
}

export interface TargetReachViewportInsets {
  top: number
  right: number
  bottom: number
  left: number
}

/** 顶部为移动 HUD 留出空间，其他边缘只保留基础视觉间距。 */
export const defaultTargetReachViewportInsets: Readonly<TargetReachViewportInsets> = {
  top: 60,
  right: 24,
  bottom: 24,
  left: 24,
}

/** 标准化 X/Y 共用同一比例，圆形交互元素不会随屏幕宽高比变形。 */
export interface TargetReachViewportState {
  width: number
  height: number
  centerX: number
  centerY: number
  interactionScale: number
  playerRadiusPx: number
  targetRadiusPx: number
}

export function createTargetReachViewport(
  width: number,
  height: number,
  playerRadiusNormalized: number,
  targetRadiusNormalized: number,
  insets: TargetReachViewportInsets = defaultTargetReachViewportInsets,
): TargetReachViewportState {
  const safeWidth = finiteNonNegative(width)
  const safeHeight = finiteNonNegative(height)
  const top = finiteNonNegative(insets.top)
  const right = finiteNonNegative(insets.right)
  const bottom = finiteNonNegative(insets.bottom)
  const left = finiteNonNegative(insets.left)
  const availableWidth = Math.max(0, safeWidth - left - right)
  const availableHeight = Math.max(0, safeHeight - top - bottom)
  const interactionScale = Math.min(availableWidth / 2, availableHeight / 2)
  const playerRadius = finiteNonNegative(playerRadiusNormalized)
  const targetRadius = finiteNonNegative(targetRadiusNormalized)
  return {
    width: safeWidth,
    height: safeHeight,
    centerX: availableWidth > 0 ? left + availableWidth / 2 : safeWidth / 2,
    centerY: availableHeight > 0 ? top + availableHeight / 2 : safeHeight / 2,
    interactionScale,
    playerRadiusPx: playerRadius * interactionScale,
    targetRadiusPx: targetRadius * interactionScale,
  }
}

/** Y 轴向上为正，因此映射到屏幕时需要反向。 */
export function toTargetReachScreenPoint(point: NormalizedPoint, viewport: TargetReachViewportState): ScreenPoint {
  return {
    x: viewport.centerX + point.x * viewport.interactionScale,
    y: viewport.centerY - point.y * viewport.interactionScale,
  }
}

function finiteNonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0
}
