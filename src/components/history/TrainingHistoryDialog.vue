<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { backActionCoordinator } from '../../app/AppServices'
import { BACK_ACTION_PRIORITY } from '../../core/navigation/BackActionCoordinator'
import type { TrainingRecord } from '../../core/training/TrainingRecord'
import TrainingReplayPanel from './TrainingReplayPanel.vue'
import TrainingSummary from './TrainingSummary.vue'

defineProps<{ record: TrainingRecord }>()
const emit = defineEmits<{ close: [] }>()
const replayExpanded = ref(false)
let unregisterBackAction: (() => void) | null = null

// 历史详情只在回放未展开时关闭，避免按钮或遮罩跨层影响全屏回放。
function requestClose(): void { if (!replayExpanded.value) emit('close') }
onMounted(() => { unregisterBackAction = backActionCoordinator.register(BACK_ACTION_PRIORITY.historyDialog, requestClose) })
onBeforeUnmount(() => unregisterBackAction?.())
function formatDate(value: number): string { return new Date(value).toLocaleString('zh-CN') }
</script>

<template><Teleport to="body"><div class="history-dialog-backdrop" @click.self="requestClose"><section class="history-dialog" role="dialog" aria-modal="true" aria-label="训练详情" :aria-hidden="replayExpanded ? 'true' : undefined"><header><div><p class="eyebrow">训练详情</p><h2>{{ record.gameName }}</h2><p class="muted small">{{ formatDate(record.completedAt) }}</p></div><button class="button danger" :disabled="replayExpanded" aria-label="关闭训练详情" @click="requestClose">关闭</button></header><div class="history-dialog-body"><TrainingSummary :record="record" /><TrainingReplayPanel :record="record" @expanded-changed="replayExpanded = $event" /></div></section></div></Teleport></template>
