import { describe, expect, it } from 'vitest'
import {
  createTargetReachViewport,
  defaultTargetReachViewportInsets,
  toTargetReachScreenPoint,
} from '../src/games/target-reach/TargetReachViewportMapper'

describe('TargetReachViewportMapper', () => {
  it.each([
    ['16:9', 1280, 720],
    ['20:9', 2400, 1080],
    ['Full HD', 1920, 1080],
    ['4:3', 1024, 768],
    ['矮屏横屏', 800, 360],
  ])('%s 画布使用统一的 X/Y 交互比例', (_name, width, height) => {
    const viewport = createTargetReachViewport(width, height, 0.08, 0.12)
    const point = toTargetReachScreenPoint({ x: 0.7, y: -0.5 }, viewport)
    expect(viewport.centerX).toBe(width / 2)
    expect(point).toEqual({
      x: viewport.centerX + viewport.interactionScale * 0.7,
      y: viewport.centerY + viewport.interactionScale * 0.5,
    })
    expect(viewport.playerRadiusPx).toBeCloseTo(viewport.interactionScale * 0.08)
    expect(viewport.targetRadiusPx).toBeCloseTo(viewport.interactionScale * 0.12)
    expect(viewport.centerY - viewport.interactionScale).toBeGreaterThanOrEqual(defaultTargetReachViewportInsets.top)
  })

  it('横向和纵向的相同标准化距离映射为相同像素距离', () => {
    const viewport = createTargetReachViewport(2400, 1080, 0.08, 0.12)
    const center = toTargetReachScreenPoint({ x: 0, y: 0 }, viewport)
    const horizontal = toTargetReachScreenPoint({ x: 0.2, y: 0 }, viewport)
    const vertical = toTargetReachScreenPoint({ x: 0, y: 0.2 }, viewport)
    expect(Math.abs(horizontal.x - center.x)).toBeCloseTo(Math.abs(vertical.y - center.y))
    expect(Math.abs(vertical.y - center.y)).toBeCloseTo(viewport.playerRadiusPx + viewport.targetRadiusPx)
  })

  it('零尺寸和非法尺寸不会生成负数范围或半径', () => {
    const viewport = createTargetReachViewport(Number.NaN, -1, 0.08, 0.12)
    expect(viewport.interactionScale).toBe(0)
    expect(viewport.playerRadiusPx).toBe(0)
    expect(viewport.targetRadiusPx).toBe(0)
  })
})
