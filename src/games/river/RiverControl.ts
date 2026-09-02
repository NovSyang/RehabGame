import type { RiverDifficulty, RiverLane } from './RiverGameConfig'

/** 游戏额外死区只去除中心抖动，并保持输出范围在 -1 到 1。 */
export function applyRiverDeadZone(value: number, deadZone = 0.08): number {
  if (!Number.isFinite(value)) return 0
  const clamped = Math.max(-1, Math.min(1, value))
  if (Math.abs(clamped) <= deadZone) return 0
  return Math.sign(clamped) * (Math.abs(clamped) - deadZone) / (1 - deadZone)
}

/** 采用加速度控制横移，回到中心后使用指数阻尼自然停船。 */
export function updateHorizontalVelocity(
  velocity: number,
  inputX: number,
  deltaSeconds: number,
  acceleration = 1_100,
  maxSpeed = 420,
  damping = 6,
): number {
  const dt = Math.max(0, deltaSeconds)
  if (inputX === 0) return velocity * Math.exp(-damping * dt)
  return Math.max(-maxSpeed, Math.min(maxSpeed, velocity + inputX * acceleration * dt))
}

/** 纵向输入只改变前进速度，最低航速保证关卡持续推进。 */
export function getForwardSpeed(inputY: number, min = 45, center = 60, max = 80): number {
  const value = Math.max(-1, Math.min(1, Number.isFinite(inputY) ? inputY : 0))
  return value >= 0 ? center + (max - center) * value : center + (center - min) * value
}

export function laneX(lane: RiverLane): number {
  return { left: -235, center: 0, right: 235 }[lane]
}

/** 难度只缩放尚未激活对象的判定范围。 */
export function difficultyRangeScale(kind: 'collect' | 'gate' | 'hold' | 'obstacle', difficulty: RiverDifficulty): number {
  if (difficulty === 'normal') return 1
  const assist = { collect: 1.2, gate: 1.15, hold: 1.15, obstacle: 1.15 }
  const challenge = { collect: 0.9, gate: 0.92, hold: 0.92, obstacle: 0.95 }
  return difficulty === 'assist' ? assist[kind] : challenge[kind]
}

/** 防重复时间未结束前，同一段接触不会再次计为碰撞。 */
export function collisionAllowed(elapsedMs: number, protectedUntilMs: number): boolean {
  return Number.isFinite(elapsedMs) && elapsedMs >= Math.max(0, protectedUntilMs)
}

/** Hold 离开有效区域时按实际时间的一半回退，不会直接清零。 */
export function updateHoldProgress(currentMs: number, inside: boolean, deltaMs: number): number {
  const delta = Math.max(0, Number.isFinite(deltaMs) ? deltaMs : 0)
  return Math.max(0, currentMs + (inside ? delta : -delta * 0.5))
}

/** 稳定度按中心距离归一化，区域外样本固定为 0。 */
export function holdStability(distanceFromCenter: number, radius: number): number {
  if (!Number.isFinite(distanceFromCenter) || !Number.isFinite(radius) || radius <= 0) return 0
  return Math.max(0, Math.min(1, 1 - Math.abs(distanceFromCenter) / radius))
}
