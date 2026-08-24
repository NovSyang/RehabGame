<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { latestTrainingRecord } from '../app/AppServices'
import type { Direction } from '../core/training/Direction'

const router = useRouter()
const result = computed(() => latestTrainingRecord.value?.result ?? null)
const directions: Direction[] = ['left', 'right', 'forward', 'backward']
function directionText(value: Direction): string { return { left: '左', right: '右', forward: '前', backward: '后' }[value] }
function secondsText(value: number | null): string { return value === null ? '--' : `${(value / 1000).toFixed(2)} s` }
function durationText(value: number): string { return `${(value / 1000).toFixed(1)} s` }
</script>

<template><main class="result-shell"><section class="result-card"><p class="eyebrow">训练完成</p><h1>Target Reach 结果</h1><template v-if="result"><div class="result-metrics"><div><span>训练时长</span><strong>{{ durationText(result.durationMs) }}</strong></div><div><span>目标总数</span><strong>{{ result.totalTargets }}</strong></div><div><span>成功 / 失败</span><strong>{{ result.successTargets }} / {{ result.failedTargets }}</strong></div><div><span>成功率</span><strong>{{ (result.successRate * 100).toFixed(0) }}%</strong></div><div><span>平均反应时间</span><strong>{{ secondsText(result.averageReactionTimeMs) }}</strong></div><div><span>平均到达时间</span><strong>{{ secondsText(result.averageReachTimeMs) }}</strong></div></div><h2>方向统计</h2><div class="direction-grid"><div v-for="direction in directions" :key="direction"><span>{{ directionText(direction) }}</span><strong>{{ result.directions[direction].success }} / {{ result.directions[direction].total }}</strong><small>平均 {{ secondsText(result.directions[direction].averageReachTimeMs) }}</small></div></div></template><p v-else class="muted">当前会话没有可展示的结果，请从历史记录查看已保存训练。</p><div class="row"><button class="button primary" @click="router.push('/device')">返回设备准备</button><button class="button" @click="router.push('/history')">查看历史</button></div></section></main></template>
