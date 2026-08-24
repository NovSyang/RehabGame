<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { persistTargetReachResult, sensorService } from '../app/AppServices'
import type { TrainingSessionState } from '../core/training/TrainingSessionState'
import { TargetReachGame } from '../games/target-reach/TargetReachGame'

const router = useRouter()
const gameHost = ref<HTMLElement | null>(null)
const errorMessage = ref('')
const trainingState = ref<TrainingSessionState>('idle')
const successCount = ref(0)
const attemptedCount = ref(0)
const currentTarget = ref('')
const canPause = computed(() => trainingState.value === 'playing' || trainingState.value === 'paused')

const game = new TargetReachGame(undefined, {
  onTargetChanged(direction, index) { currentTarget.value = `${index} · ${directionText(direction)}` },
  onScoreChanged(success, total) { successCount.value = success; attemptedCount.value = total },
  onSessionStateChanged(state) { trainingState.value = state },
  onCompleted(result) { void completeTraining(result) },
})
let unsubscribe: (() => void) | null = null

// 游戏仅接收标准化 GameInput，因此断线和 ROM 更新不需要修改游戏判定。
onMounted(async () => {
  unsubscribe = sensorService.onSnapshot((snapshot) => game.setInput(snapshot.gameInput))
  await nextTick()
  if (!gameHost.value || !sensorService.motion.getCalibrationSnapshot().calibrated) {
    errorMessage.value = '请连接设备并完成中心校准后开始训练。'
    return
  }
  try { await game.mount(gameHost.value); game.start() }
  catch (error) { errorMessage.value = formatError(error) }
})
onBeforeUnmount(() => { unsubscribe?.(); game.destroy() })

function togglePause(): void {
  try { trainingState.value === 'playing' ? game.pause() : game.resume() }
  catch (error) { errorMessage.value = formatError(error) }
}
function abort(): void { game.abort(); void router.push('/device') }
async function completeTraining(result: Parameters<NonNullable<typeof game['events']['onCompleted']>>[0]): Promise<void> {
  try { await persistTargetReachResult(result); await router.push('/result') }
  catch (error) { errorMessage.value = `训练已完成，但保存历史失败：${formatError(error)}` }
}
function directionText(value: 'left' | 'right' | 'forward' | 'backward'): string { return { left: '左', right: '右', forward: '前', backward: '后' }[value] }
function formatError(error: unknown): string { return error instanceof Error ? error.message : String(error) }
</script>

<template><main class="training-shell"><header class="training-toolbar"><div><p class="eyebrow">Target Reach Training</p><h1>{{ trainingState === 'countdown' ? '准备开始' : currentTarget || '等待目标' }}</h1></div><div class="scoreboard"><span>成功 {{ successCount }}</span><span>完成 {{ attemptedCount }} / 20</span><span>{{ trainingState }}</span></div><div class="row"><button class="button" :disabled="!canPause" @click="togglePause">{{ trainingState === 'paused' ? '继续' : '暂停' }}</button><button class="button danger" @click="abort">结束训练</button></div></header><div ref="gameHost" class="game-host training-host"></div><p v-if="errorMessage" class="error">{{ errorMessage }}</p></main></template>
