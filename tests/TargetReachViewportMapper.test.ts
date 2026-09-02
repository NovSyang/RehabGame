import { describe, expect, it } from 'vitest'
import { createTargetReachViewport, toTargetReachScreenPoint } from '../src/games/target-reach/TargetReachViewportMapper'

describe('TargetReachViewportMapper', () => {
  it.each([
    ['16:9', 1600, 900],
    ['20:9', 2000, 900],
    ['4:3', 1200, 900],
    ['超宽横屏', 2400, 600],
    ['矮屏横屏', 1280, 360],
  ])('%s 画布生成稳定的标准化映射', (_name, width, height) => {
    const viewport = createTargetReachViewport(width, height, 0.08, 0.12)
    const point = toTargetReachScreenPoint({ x: 0.7, y: -0.5 }, viewport)
    expect(viewport.centerX).toBe(width / 2)
    expect(viewport.centerY).toBe(height / 2)
    expect(point).toEqual({
      x: width / 2 + viewport.rangeX * 0.7,
      y: height / 2 + viewport.rangeY * 0.5,
    })
    expect(viewport.playerRadiusX).toBeCloseTo(viewport.rangeX * 0.08)
    expect(viewport.targetRadiusY).toBeCloseTo(viewport.rangeY * 0.12)
  })

  it('纵向边缘接触在屏幕映射后仍与两个椭圆半径之和一致', () => {
    const viewport = createTargetReachViewport(2000, 700, 0.08, 0.12)
    const player = toTargetReachScreenPoint({ x: 0, y: 0.5 }, viewport)
    const target = toTargetReachScreenPoint({ x: 0, y: 0.7 }, viewport)
    expect(Math.abs(player.y - target.y)).toBeCloseTo(viewport.playerRadiusY + viewport.targetRadiusY)
  })

  it('零尺寸和非法尺寸不会生成负数范围', () => {
    const viewport = createTargetReachViewport(Number.NaN, -1, 0.08, 0.12)
    expect(viewport.rangeX).toBe(0)
    expect(viewport.rangeY).toBe(0)
  })
})
