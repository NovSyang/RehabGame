import { describe, expect, it, vi } from 'vitest'
import { resizeReplayRendererToHost } from '../src/core/replay/ReplayPlayerResize'

describe('resizeReplayRendererToHost', () => {
  it('按 Host 实际尺寸更新 Renderer 后重绘', () => {
    const resize = vi.fn()
    const render = vi.fn()
    const resized = resizeReplayRendererToHost({ renderer: { resize } }, { clientWidth: 844, clientHeight: 390 }, render)

    expect(resized).toBe(true)
    expect(resize).toHaveBeenCalledWith(844, 390)
    expect(render).toHaveBeenCalledOnce()
  })

  it('Host 尚无有效布局时不触碰 Renderer', () => {
    const resize = vi.fn()
    const render = vi.fn()
    expect(resizeReplayRendererToHost({ renderer: { resize } }, { clientWidth: 0, clientHeight: 390 }, render)).toBe(false)
    expect(resize).not.toHaveBeenCalled()
    expect(render).not.toHaveBeenCalled()
  })
})
