<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { trainingRepository } from '../app/AppServices'
import type { TrainingRecord } from '../core/training/TrainingRecord'

const records = ref<TrainingRecord[]>([])
const selected = ref<TrainingRecord | null>(null)
const errorMessage = ref('')

// 每次进入历史页重新读取数据库，确保显示跨重启持久化的数据。
onMounted(() => { void load() })
async function load(): Promise<void> { try { records.value = await trainingRepository.getAll() } catch (error) { errorMessage.value = formatError(error) } }
async function remove(record: TrainingRecord): Promise<void> { if (!window.confirm(`确认删除 ${formatDate(record.completedAt)} 的训练记录吗？`)) return; await trainingRepository.delete(record.id); if (selected.value?.id === record.id) selected.value = null; await load() }
function formatDate(value: number): string { return new Date(value).toLocaleString('zh-CN') }
function duration(value: number): string { return `${(value / 1000).toFixed(1)} s` }
function formatError(error: unknown): string { return error instanceof Error ? error.message : String(error) }
</script>

<template><main class="content-page"><p class="eyebrow">Training History</p><h1>训练历史</h1><p v-if="errorMessage" class="error">{{ errorMessage }}</p><p v-if="!records.length" class="muted">暂无已保存训练记录。</p><div v-else class="history-list"><article v-for="record in records" :key="record.id" class="card"><div class="history-row"><div><strong>{{ formatDate(record.completedAt) }}</strong><p class="muted small">{{ record.gameName }} · {{ duration(record.result.durationMs) }} · 成功率 {{ (record.result.successRate * 100).toFixed(0) }}%</p></div><div class="row"><button class="button" @click="selected = record">详情</button><button class="button danger" @click="remove(record)">删除</button></div></div></article></div><section v-if="selected" class="card history-detail"><h2>{{ selected.gameName }} 详情</h2><p>平均反应：{{ selected.result.averageReactionTimeMs === null ? '--' : `${(selected.result.averageReactionTimeMs / 1000).toFixed(2)} s` }}；平均到达：{{ selected.result.averageReachTimeMs === null ? '--' : `${(selected.result.averageReachTimeMs / 1000).toFixed(2)} s` }}</p><div class="direction-grid"><div v-for="(item, direction) in selected.result.directions" :key="direction"><span>{{ direction }}</span><strong>{{ item.success }} / {{ item.total }}</strong></div></div></section></main></template>
