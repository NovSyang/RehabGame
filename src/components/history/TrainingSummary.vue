<script setup lang="ts">
import { computed } from 'vue'
import type { TargetReachGameConfig } from '../../games/target-reach/TargetReachGameConfig'
import type { TrainingRecord } from '../../core/training/TrainingRecord'

const props = defineProps<{ record: TrainingRecord }>()
const directions = ['left', 'right', 'forward', 'backward'] as const
const config = computed(() => props.record.gameConfig as Partial<TargetReachGameConfig>)
const profile = computed(() => props.record.motionProfile)
function directionText(value: typeof directions[number]): string { return { left: '左', right: '右', forward: '前', backward: '后' }[value] }
function time(value: number | null): string { return value === null ? '--' : `${(value / 1000).toFixed(2)} s` }
function duration(value: number): string { return `${(value / 1000).toFixed(1)} s` }
function range(value: number | undefined): string { return value === undefined ? '--' : `${value.toFixed(1)}°` }
</script>

<template>
  <section class="history-summary">
    <div class="summary-metrics"><div><span>有效训练时长</span><strong>{{ duration(record.result.durationMs) }}</strong></div><div><span>成功 / 失败</span><strong>{{ record.result.successTargets }} / {{ record.result.failedTargets }}</strong></div><div><span>成功率</span><strong>{{ (record.result.successRate * 100).toFixed(0) }}%</strong></div><div><span>平均反应</span><strong>{{ time(record.result.averageReactionTimeMs) }}</strong></div><div><span>平均到达</span><strong>{{ time(record.result.averageReachTimeMs) }}</strong></div></div>
    <div class="summary-columns"><div><h3>四方向表现</h3><p v-for="direction in directions" :key="direction">{{ directionText(direction) }}：{{ record.result.directions[direction].success }} / {{ record.result.directions[direction].total }}</p></div><div><h3>当时 MotionProfile</h3><p>实测 ROM：左 {{ range(profile.measuredRange?.leftMax) }} / 右 {{ range(profile.measuredRange?.rightMax) }} / 前 {{ range(profile.measuredRange?.forwardMax) }} / 后 {{ range(profile.measuredRange?.backwardMax) }}</p><p>训练 ROM：左 {{ range(profile.activeRange.leftMax) }} / 右 {{ range(profile.activeRange.rightMax) }} / 前 {{ range(profile.activeRange.forwardMax) }} / 后 {{ range(profile.activeRange.backwardMax) }}</p><p>训练比例 {{ (profile.trainingRatio * 100).toFixed(0) }}% · 死区 {{ profile.horizontalDeadZone }}° / {{ profile.verticalDeadZone }}°</p></div><div><h3>当时游戏配置</h3><p>目标距离 {{ config.targetDistance ?? '--' }} · 保持 {{ config.holdTimeMs ?? '--' }}ms</p><p>超时 {{ config.targetTimeoutMs ?? '--' }}ms · 目标数 {{ config.targetCount ?? '--' }}</p></div></div>
  </section>
</template>
