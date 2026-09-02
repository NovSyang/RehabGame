/** 等待指定数量的浏览器绘制帧，让旋转或系统栏变化后的布局稳定下来。 */
export async function waitForAnimationFrames(count = 2): Promise<void> {
  const safeCount = Math.max(0, Math.floor(count))
  for (let index = 0; index < safeCount; index += 1) {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  }
}
