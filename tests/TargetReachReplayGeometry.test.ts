import { reactive } from 'vue'
import { describe, expect, it } from 'vitest'
import { defaultTargetReachGameConfig } from '../src/games/target-reach/TargetReachGameConfig'
import { createTargetReachViewport, toTargetReachScreenPoint } from '../src/games/target-reach/TargetReachViewportMapper'
import {
  createTargetReachReplayViewport,
  resolveTargetReachReplayGeometryConfig,
  targetReachReplayViewportInsets,
} from '../src/games/target-reach/replay/TargetReachReplayGeometry'

describe('TargetReachReplayGeometry', () => {
  it('旧记录缺少半径时逐项回退默认配置', () => {
    expect(resolveTargetReachReplayGeometryConfig({})).toEqual({
      playerRadiusNormalized: defaultTargetReachGameConfig.playerRadiusNormalized,
      targetRadiusNormalized: defaultTargetReachGameConfig.targetRadiusNormalized,
    })
    expect(resolveTargetReachReplayGeometryConfig({ playerRadiusNormalized: 0.1, targetRadiusNormalized: Number.NaN })).toEqual({
      playerRadiusNormalized: 0.1,
      targetRadiusNormalized: defaultTargetReachGameConfig.targetRadiusNormalized,
    })
  })

  it.each([0, -0.1, 1.1, Number.NaN, Number.POSITIVE_INFINITY])('非法半径 %s 不进入回放画面', (radius) => {
    expect(resolveTargetReachReplayGeometryConfig({
      playerRadiusNormalized: radius,
      targetRadiusNormalized: radius,
    })).toEqual({
      playerRadiusNormalized: defaultTargetReachGameConfig.playerRadiusNormalized,
      targetRadiusNormalized: defaultTargetReachGameConfig.targetRadiusNormalized,
    })
  })

  it('可安全读取 Vue Proxy，并只保存两个基础数字字段', () => {
    const config = reactive({ playerRadiusNormalized: 0.09, targetRadiusNormalized: 0.14, nested: { ignored: true } })
    expect(resolveTargetReachReplayGeometryConfig(config)).toEqual({ playerRadiusNormalized: 0.09, targetRadiusNormalized: 0.14 })
  })

  it.each([[1848, 832], [2400, 1080], [800, 480]])('%d×%d 下四方向距离保持一致且半径随同一比例缩放', (width, height) => {
    const viewport = createTargetReachReplayViewport(width, height, {
      playerRadiusNormalized: 0.08,
      targetRadiusNormalized: 0.12,
    })
    const center = toTargetReachScreenPoint({ x: 0, y: 0 }, viewport)
    const points = [
      { x: 0.7, y: 0 },
      { x: -0.7, y: 0 },
      { x: 0, y: 0.7 },
      { x: 0, y: -0.7 },
    ].map((point) => toTargetReachScreenPoint(point, viewport))
    const distances = points.map((point) => Math.hypot(point.x - center.x, point.y - center.y))

    for (const distance of distances) expect(distance).toBeCloseTo(0.7 * viewport.interactionScale)
    expect(viewport.playerRadiusPx).toBeCloseTo(0.08 * viewport.interactionScale)
    expect(viewport.targetRadiusPx).toBeCloseTo(0.12 * viewport.interactionScale)
    expect(viewport.centerY - viewport.interactionScale).toBeGreaterThanOrEqual(targetReachReplayViewportInsets.top)
    expect(viewport.centerY + viewport.interactionScale).toBeLessThanOrEqual(height - targetReachReplayViewportInsets.bottom)
  })

  it('回放封装与共享 Viewport Mapper 产生完全相同的映射', () => {
    const config = { playerRadiusNormalized: 0.1, targetRadiusNormalized: 0.15 }
    const replayViewport = createTargetReachReplayViewport(1848, 832, config)
    const sharedViewport = createTargetReachViewport(1848, 832, 0.1, 0.15, targetReachReplayViewportInsets)

    expect(replayViewport).toEqual(sharedViewport)
    expect(toTargetReachScreenPoint({ x: 0.42, y: -0.31 }, replayViewport))
      .toEqual(toTargetReachScreenPoint({ x: 0.42, y: -0.31 }, sharedViewport))
  })
})
