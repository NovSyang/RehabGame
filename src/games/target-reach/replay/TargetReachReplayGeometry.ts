import {
  createTargetReachViewport,
  type TargetReachViewportInsets,
  type TargetReachViewportState,
} from '../TargetReachViewportMapper'
import { defaultTargetReachGameConfig } from '../TargetReachGameConfig'

/** 回放只需要历史配置中的两个标准化半径，避免持有整份可变配置。 */
export interface TargetReachReplayGeometryConfig {
  playerRadiusNormalized: number
  targetRadiusNormalized: number
}

/** 底部额外预留控制条空间，四个方向仍共享同一个缩放比例。 */
export const targetReachReplayViewportInsets: Readonly<TargetReachViewportInsets> = {
  top: 60,
  right: 24,
  bottom: 60,
  left: 24,
}

/** 旧记录可能缺少标准化半径，逐项回退可继续安全播放历史。 */
export function resolveTargetReachReplayGeometryConfig(config: unknown): TargetReachReplayGeometryConfig {
  const source = isRecord(config) ? config : {}
  return {
    playerRadiusNormalized: validRadius(source.playerRadiusNormalized, defaultTargetReachGameConfig.playerRadiusNormalized),
    targetRadiusNormalized: validRadius(source.targetRadiusNormalized, defaultTargetReachGameConfig.targetRadiusNormalized),
  }
}

/** 实时游戏和历史回放最终都通过同一个 Viewport Mapper 映射坐标。 */
export function createTargetReachReplayViewport(
  width: number,
  height: number,
  config?: unknown,
): TargetReachViewportState {
  const geometry = resolveTargetReachReplayGeometryConfig(config)
  return createTargetReachViewport(
    width,
    height,
    geometry.playerRadiusNormalized,
    geometry.targetRadiusNormalized,
    targetReachReplayViewportInsets,
  )
}

function validRadius(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 1 ? value : fallback
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
