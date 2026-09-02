interface ReplayRenderer {
  resize(width: number, height: number): void
}

interface ReplayApplication {
  renderer: ReplayRenderer
}

interface ReplayHostSize {
  clientWidth: number
  clientHeight: number
}

/** Pixi 的 CSS 尺寸变化后同步内部 Renderer，避免轨迹只被视觉拉伸。 */
export function resizeReplayRendererToHost(
  app: ReplayApplication,
  host: ReplayHostSize,
  render: () => void,
): boolean {
  const width = Math.floor(host.clientWidth)
  const height = Math.floor(host.clientHeight)
  if (width <= 0 || height <= 0) return false
  app.renderer.resize(width, height)
  render()
  return true
}
