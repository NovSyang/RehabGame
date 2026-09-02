import { distanceBetween, type NormalizedPoint } from './TargetReachMath'

/** TargetReach 的业务圆全部使用标准化坐标，禁止混入屏幕像素。 */
export interface NormalizedCircle {
  center: NormalizedPoint
  radius: number
}

/** 圆的边缘刚好接触也属于命中，非法几何数据不会产生误判。 */
export function circlesIntersect(first: NormalizedCircle, second: NormalizedCircle): boolean {
  if (!isValidCircle(first) || !isValidCircle(second)) return false
  return distanceBetween(first.center, second.center) <= first.radius + second.radius
}

function isValidCircle(circle: NormalizedCircle): boolean {
  return Number.isFinite(circle.center.x)
    && Number.isFinite(circle.center.y)
    && Number.isFinite(circle.radius)
    && circle.radius >= 0
}
