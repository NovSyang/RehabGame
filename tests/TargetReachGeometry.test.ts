import { describe, expect, it } from 'vitest'
import { circlesIntersect, type NormalizedCircle } from '../src/games/target-reach/TargetReachGeometry'

const circle = (x: number, y: number, radius: number): NormalizedCircle => ({ center: { x, y }, radius })

describe('TargetReachGeometry', () => {
  it('完全分离时不命中', () => {
    expect(circlesIntersect(circle(0, 0, 0.08), circle(0.201, 0, 0.12))).toBe(false)
  })

  it('边缘刚好接触时命中', () => {
    expect(circlesIntersect(circle(0, 0, 0.08), circle(0.2, 0, 0.12))).toBe(true)
  })

  it.each([
    ['部分重叠', circle(0, 0, 0.08), circle(0.15, 0, 0.12)],
    ['完全包含', circle(0, 0, 0.2), circle(0.05, 0, 0.03)],
    ['相同中心', circle(0, 0, 0.08), circle(0, 0, 0.12)],
    ['纵向接触', circle(0, 0, 0.08), circle(0, 0.2, 0.12)],
  ])('%s 时命中', (_name, first, second) => {
    expect(circlesIntersect(first, second)).toBe(true)
  })

  it('非法坐标或半径不会产生误判', () => {
    expect(circlesIntersect(circle(Number.NaN, 0, 0.08), circle(0, 0, 0.12))).toBe(false)
    expect(circlesIntersect(circle(0, 0, -0.08), circle(0, 0, 0.12))).toBe(false)
  })
})
