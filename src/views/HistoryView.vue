<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { trainingRepository } from '../app/AppServices'
import { presentTrainingRecord } from '../games/TrainingRecordPresentation'
import type { TrainingRecord } from '../core/training/TrainingRecord'
import TrainingHistoryDialog from '../components/history/TrainingHistoryDialog.vue'

const records = ref<TrainingRecord[]>([])
const selected = ref<TrainingRecord | null>(null)
const errorMessage = ref('')

onMounted(() => { void load() })
async function load(): Promise<void> { try { records.value = await trainingRepository.getAll() } catch (error) { errorMessage.value = formatError(error) } }
async function remove(record: TrainingRecord): Promise<void> { if (!window.confirm(`确认删除 ${formatDate(record.completedAt)} 的训练记录吗？`)) return; await trainingRepository.delete(record.id); if (selected.value?.id === record.id) selected.value = null; await load() }
function formatDate(value: number): string { return new Date(value).toLocaleString('zh-CN') }
function duration(value: number): string { return `${(value / 1_000).toFixed(1)} s` }
/** 列表只取 Presenter 的主指标，未知记录仍可打开公共详情。 */
function primaryMetric(record: TrainingRecord): string { const metric = presentTrainingRecord(record)?.metrics[0]; return metric ? `${metric.label} ${metric.value}` : '详细指标不可解析' }
function formatError(error: unknown): string { return error instanceof Error ? error.message : String(error) }
</script>

<template><main class="content-page"><p class="eyebrow">Training History</p><h1>训练历史</h1><p v-if="errorMessage" class="error">{{ errorMessage }}</p><p v-if="!records.length" class="muted">暂无已保存训练记录。</p><div v-else class="history-list"><article v-for="record in records" :key="record.id" class="card"><div class="history-row"><div><strong>{{ formatDate(record.completedAt) }}</strong><p class="muted small">{{ record.gameName }} · {{ duration(record.result.durationMs) }} · {{ primaryMetric(record) }}</p></div><div class="row"><button class="button" @click="selected = record">详情</button><button class="button danger" @click="remove(record)">删除</button></div></div></article></div><TrainingHistoryDialog v-if="selected" :record="selected" @close="selected = null" /></main></template>
