import { afterEach, describe, expect, it, vi } from 'vitest'
import { waitForAnimationFrames } from '../src/platform/display/DisplayLayout'

describe('DisplayLayout', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('Pixi 挂载前等待两个布局绘制帧', async () => {
    const requestFrame = vi.fn((callback: FrameRequestCallback) => { callback(0); return 1 })
    vi.stubGlobal('requestAnimationFrame', requestFrame)
    await waitForAnimationFrames(2)
    expect(requestFrame).toHaveBeenCalledTimes(2)
  })
})
