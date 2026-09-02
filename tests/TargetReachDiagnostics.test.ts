import { describe, expect, it } from 'vitest'
import { isTargetReachGeometryDebugEnabled } from '../src/games/target-reach/TargetReachGameModule'

describe('TargetReach Geometry Diagnostics', () => {
  it('普通训练地址默认关闭诊断覆盖层', () => {
    expect(isTargetReachGeometryDebugEnabled('#/training/target-reach')).toBe(false)
  })

  it('只在明确的 geometryDebug 查询参数下开启', () => {
    expect(isTargetReachGeometryDebugEnabled('#/training/target-reach?geometryDebug=1')).toBe(true)
    expect(isTargetReachGeometryDebugEnabled('#/training/target-reach?geometryDebug=0')).toBe(false)
  })
})
