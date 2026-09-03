<script setup lang="ts">
import type { GameHudSnapshot } from '../../core/game/TrainingGameEvents'
import type { TrainingSessionState } from '../../core/training/TrainingSessionState'
import DeviceConnectionStatus from '../app/DeviceConnectionStatus.vue'

defineProps<{
  hud: GameHudSnapshot
  trainingState: TrainingSessionState
  canPause: boolean
}>()

const emit = defineEmits<{
  pause: []
  abort: []
}>()
</script>

<template>
  <!-- Android 训练 HUD 只保留患者操作时真正需要的信息。 -->
  <section class="training-hud" aria-label="训练状态与操作">
    <div class="training-hud-metrics" aria-label="训练指标">
      <span v-for="metric in hud.metrics" :key="metric.label" class="training-hud-metric">
        <small>{{ metric.label }}</small>
        <strong>{{ metric.value }}</strong>
      </span>
    </div>
    <div class="training-hud-actions">
      <DeviceConnectionStatus compact />
      <button class="training-hud-button" :disabled="!canPause" @click="emit('pause')">
        {{ trainingState === 'paused' ? '继续' : '暂停' }}
      </button>
      <button class="training-hud-button training-hud-button--danger" @click="emit('abort')">结束</button>
    </div>
  </section>
</template>
