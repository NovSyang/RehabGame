import type { GameModule } from '../../core/game/GameModule'
import type { GameResultPresentation } from '../../core/game/GameResultPresentation'
import { RiverGame } from './RiverGame'
import { defaultRiverGameConfig, type RiverGameConfig } from './RiverGameConfig'
import { RiverReplayPlayer } from './replay/RiverReplayPlayer'
import type { RiverTrainingResult } from './RiverTrainingResult'

/** River 模块把第三款游戏完整接入选择、训练、结果、历史与回放。 */
export const riverGameModule: GameModule<RiverTrainingResult, RiverGameConfig> = {
  definition: {
    id: 'forest-river',
    name: '森林溪谷漂流',
    description: '控制康复小船转向和航速，收集星星、通过训练门并完成稳定保持。',
    renderer: 'pixi',
    enabled: true,
    coverImage: '/assets/games/river/cover.png',
    estimatedDuration: '约 2–4 分钟',
    instructions: [
      { title: '左右转向', description: '向左或向右运动，控制小船横向避障和收集星星。' },
      { title: '前后调速', description: '向前运动加速，向后运动减速；小船始终保持最低航速。' },
      { title: '完成关卡', description: '抵达溪谷终点即完成训练，碰撞只会短暂减速。' },
    ],
    tutorial: {
      version: 1,
      steps: [
        { id: 'left', title: '向左转向', description: '缓慢向左运动并保持。', axis: 'x', direction: 'negative', threshold: 0.25, holdMs: 400 },
        { id: 'right', title: '向右转向', description: '缓慢向右运动并保持。', axis: 'x', direction: 'positive', threshold: 0.25, holdMs: 400 },
        { id: 'accelerate', title: '向前加速', description: '向前运动并保持。', axis: 'y', direction: 'positive', threshold: 0.25, holdMs: 400 },
        { id: 'decelerate', title: '向后减速', description: '向后运动并保持。', axis: 'y', direction: 'negative', threshold: 0.25, holdMs: 400 },
      ],
    },
  },
  createGame: (events) => new RiverGame(structuredClone(defaultRiverGameConfig), events),
  getConfigSnapshot: () => structuredClone(defaultRiverGameConfig),
  presentResult: presentRiverResult,
  createReplayPlayer: () => new RiverReplayPlayer(),
}

/** 历史主指标固定为星星收集率，其余保持工程训练原始数据。 */
export function presentRiverResult(result: RiverTrainingResult, config: RiverGameConfig): GameResultPresentation {
  const starRatio = result.starsTotal === 0 ? 0 : result.starsCollected / result.starsTotal
  return {
    title: '森林溪谷漂流',
    metrics: [
      { label: '星星收集率', value: `${(starRatio * 100).toFixed(0)}%` },
      { label: '游戏得分', value: String(result.score) },
      { label: '最高连击', value: String(result.maxCombo) },
      { label: '训练门', value: `${result.gatesSucceeded}/${result.gatesTotal}` },
      { label: '保持任务', value: `${result.holdsSucceeded}/${result.holdsTotal}` },
      { label: '障碍碰撞', value: String(result.collisionCount) },
    ],
    sections: [
      { title: '康复交互原始指标', items: [
        { label: '平均门反应时间', value: milliseconds(result.averageGateReactionMs) },
        { label: '平均保持稳定度', value: result.averageHoldStability === null ? '--' : `${(result.averageHoldStability * 100).toFixed(0)}%` },
        { label: '平均航速', value: `${result.averageForwardSpeed.toFixed(1)} 单位/秒` },
        { label: '横向输入范围', value: `${result.inputExtremes.minX.toFixed(2)} ～ ${result.inputExtremes.maxX.toFixed(2)}` },
        { label: '纵向输入范围', value: `${result.inputExtremes.minY.toFixed(2)} ～ ${result.inputExtremes.maxY.toFixed(2)}` },
      ] },
      { title: '三方向训练门', items: (['left', 'center', 'right'] as const).map((direction) => ({ label: { left: '左门', center: '中门', right: '右门' }[direction], value: `${result.gatesByDirection[direction].success}/${result.gatesByDirection[direction].total}` })) },
      { title: '速度控制', items: [
        { label: '加速时间', value: `${(result.accelerationDurationMs / 1_000).toFixed(1)} s` },
        { label: '减速时间', value: `${(result.decelerationDurationMs / 1_000).toFixed(1)} s` },
        { label: '最低/中心/最高航速', value: `${config.minForwardSpeed}/${config.centerForwardSpeed}/${config.maxForwardSpeed}` },
      ] },
    ],
  }
}

function milliseconds(value: number | null): string { return value === null ? '--' : `${Math.round(value)} ms` }
