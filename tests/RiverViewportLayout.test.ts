import { describe, expect, it } from 'vitest'
import { createRiverViewportLayout } from '../src/games/river/RiverViewportLayout'

describe('RiverViewportLayout', () => {
  it.each([
    ['16:9', 1920, 1080, 0, 0],
    ['19.5:9', 2340, 1080, 210, 0],
    ['20:9', 2400, 1080, 240, 0],
    ['4:3', 1024, 768, 0, 96],
  ])('%s 使用 contain 并正确计算环境填充', (_name, width, height, sideFill, verticalFill) => {
    const layout = createRiverViewportLayout(width, height, 1280, 720)
    expect(layout.gameplayWidth / layout.gameplayHeight).toBeCloseTo(16 / 9)
    expect(layout.leftFillWidth).toBeCloseTo(sideFill)
    expect(layout.rightFillWidth).toBeCloseTo(sideFill)
    expect(layout.topFillHeight).toBeCloseTo(verticalFill)
    expect(layout.bottomFillHeight).toBeCloseTo(verticalFill)
    expect(layout.gameplayX * 2 + layout.gameplayWidth).toBeCloseTo(width)
    expect(layout.gameplayY * 2 + layout.gameplayHeight).toBeCloseTo(height)
  })

  it('非法画布或逻辑尺寸安全返回零布局', () => {
    const layout = createRiverViewportLayout(Number.NaN, -1, 0, 720)
    expect(layout.screenWidth).toBe(0)
    expect(layout.screenHeight).toBe(0)
    expect(layout.gameplayScale).toBe(0)
    expect(layout.gameplayWidth).toBe(0)
    expect(layout.gameplayHeight).toBe(0)
  })
})
