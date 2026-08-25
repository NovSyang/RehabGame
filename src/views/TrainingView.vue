<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import CenterCalibrationGuide from '../components/calibration/CenterCalibrationGuide.vue'
import { connectionManager, persistTargetReachResult, sensorService } from '../app/AppServices'
import { TrainingReplayRecorder } from '../core/replay/TrainingReplayRecorder'
import type { TrainingSessionState } from '../core/training/TrainingSessionState'
import { TargetReachGame } from '../games/target-reach/TargetReachGame'

type TrainingPreflightState = 'checking-device' | 'device-required' | 'center-guide' | 'calibrating' | 'ready' | 'playing' | 'recalibrating'

const router = useRouter()
const gameHost = ref<HTMLElement | null>(null)
const errorMessage = ref('')
const trainingState = ref<TrainingSessionState>('idle')
const preflight = ref<TrainingPreflightState>('checking-device')
const connected = ref(false)
const successCount = ref(0)
const attemptedCount = ref(0)
const currentTarget = ref('')
const canPause = computed(() => preflight.value === 'playing' && (trainingState.value === 'playing' || trainingState.value === 'paused'))
const replayRecorder = new TrainingReplayRecorder(40)

const game = new TargetReachGame(undefined, {
  onTargetChanged(direction, index) { currentTarget.value = `${index} · ${directionText(direction)}` },
  onScoreChanged(success, total) { successCount.value = success; attemptedCount.value = total },
  onSessionStateChanged(state) { trainingState.value = state },
  onReplayEvent(event) { replayRecorder.recordEvent(event) },
  onCompleted(result) { void completeTraining(result) },
})
let unsubscribe: (() => void) | null = null

// 游戏在中心确认前只完成挂载；它始终只接收标准化 GameInput。
onMounted(async () => {
  unsubscribe = sensorService.onSnapshot((snapshot) => {
    connected.value = snapshot.state === 'connected'
    game.setInput(snapshot.gameInput)
    if (preflight.value === 'playing' && trainingState.value === 'playing') {
      replayRecorder.recordInput(snapshot.gameInput, game.getTrainingElapsedMs())
    }
    if (preflight.value === 'playing' && snapshot.state !== 'connected') {
      preflight.value = 'recalibrating'
    }
    if (preflight.value === 'checking-device' || preflight.value === 'device-required') {
      preflight.value = connected.value ? 'center-guide' : 'device-required'
    }
  })
  await nextTick()
  if (!gameHost.value) { errorMessage.value = '游戏容器尚未创建。'; return }
  try {
    await game.mount(gameHost.value)
    // 每局都清除旧 Zero，避免复用上一局的自然中心。
    sensorService.resetCalibration()
    preflight.value = connected.value ? 'center-guide' : 'device-required'
    if (!connected.value) void connectionManager.reconnectNow()
  } catch (error) { errorMessage.value = formatError(error) }
})
onBeforeUnmount(() => { unsubscribe?.(); game.destroy() })

function centerCompleted(): void {
  try {
    if (preflight.value === 'recalibrating') {
      game.resume()
      preflight.value = 'playing'
      return
    }
    preflight.value = 'ready'
    replayRecorder.reset()
    game.start()
    preflight.value = 'playing'
  } catch (error) { errorMessage.value = formatError(error) }
}
function retryConnection(): void { errorMessage.value = ''; void connectionManager.reconnectNow() }
function togglePause(): void { try { trainingState.value === 'playing' ? game.pause() : game.resume() } catch (error) { errorMessage.value = formatError(error) } }
function abort(): void { game.abort(); void router.push('/games') }
async function completeTraining(result: Parameters<NonNullable<typeof game['events']['onCompleted']>>[0]): Promise<void> {
  try { await persistTargetReachResult(result, replayRecorder.finish(result.durationMs)); await router.push('/result') }
  catch (error) { errorMessage.value = `训练已完成，但保存历史失败：${formatError(error)}` }
}
function directionText(value: 'left' | 'right' | 'forward' | 'backward'): string { return { left: '左', right: '右', forward: '前', backward: '后' }[value] }
function formatError(error: unknown): string { return error instanceof Error ? error.message : String(error) }
</script>

<template><main class="training-shell"><header class="training-toolbar"><div><p class="eyebrow">Target Reach Training</p><h1>{{ preflight !== 'playing' ? '训练准备' : trainingState === 'countdown' ? '准备开始' : currentTarget || '等待目标' }}</h1></div><div class="scoreboard"><span>成功 {{ successCount }}</span><span>完成 {{ attemptedCount }} / 20</span><span>{{ trainingState }}</span></div><div class="row"><button class="button" :disabled="!canPause" @click="togglePause">{{ trainingState === 'paused' ? '继续' : '暂停' }}</button><button class="button danger" @click="abort">结束训练</button></div></header><div ref="gameHost" class="game-host training-host"></div><div v-if="preflight !== 'playing'" class="training-overlay"><CenterCalibrationGuide v-if="preflight === 'center-guide' || (preflight === 'recalibrating' && connected)" @completed="centerCompleted" /><section v-else class="center-guide"><h2>{{ preflight === 'recalibrating' ? '正在恢复设备连接' : '当前设备未连接' }}</h2><p>{{ preflight === 'recalibrating' ? '训练已暂停。设备恢复后请重新确认自然中心；如需手动处理设备，请使用右上角设备状态菜单。' : '系统正在尝试恢复已绑定设备。如需重新连接、更换设备或忘记设备，请使用右上角设备状态菜单。' }}</p><button class="button primary" @click="retryConnection">重新连接</button></section></div><p v-if="errorMessage" class="error">{{ errorMessage }}</p></main></template>
