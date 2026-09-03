/** River 的逻辑场景保持等比，剩余区域由全屏环境层负责填充。 */
export interface RiverViewportLayout {
  screenWidth: number
  screenHeight: number
  gameplayScale: number
  gameplayX: number
  gameplayY: number
  gameplayWidth: number
  gameplayHeight: number
  leftFillWidth: number
  rightFillWidth: number
  topFillHeight: number
  bottomFillHeight: number
}

export function createRiverViewportLayout(
  screenWidth: number,
  screenHeight: number,
  logicalWidth: number,
  logicalHeight: number,
): RiverViewportLayout {
  const width = finiteNonNegative(screenWidth)
  const height = finiteNonNegative(screenHeight)
  const gameWidth = finiteNonNegative(logicalWidth)
  const gameHeight = finiteNonNegative(logicalHeight)
  const gameplayScale = gameWidth > 0 && gameHeight > 0
    ? Math.min(width / gameWidth, height / gameHeight)
    : 0
  const gameplayWidth = gameWidth * gameplayScale
  const gameplayHeight = gameHeight * gameplayScale
  const gameplayX = Math.max(0, (width - gameplayWidth) / 2)
  const gameplayY = Math.max(0, (height - gameplayHeight) / 2)

  return {
    screenWidth: width,
    screenHeight: height,
    gameplayScale,
    gameplayX,
    gameplayY,
    gameplayWidth,
    gameplayHeight,
    leftFillWidth: gameplayX,
    rightFillWidth: Math.max(0, width - gameplayX - gameplayWidth),
    topFillHeight: gameplayY,
    bottomFillHeight: Math.max(0, height - gameplayY - gameplayHeight),
  }
}

function finiteNonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0
}
