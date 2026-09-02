<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import CenterCalibrationGuide from '../components/calibration/CenterCalibrationGuide.vue'
import DeviceConnectionStatus from '../components/app/DeviceConnectionStatus.vue'
import { appLifecycleService, connectionManager, displayService, gameTutorialRepository, persistTrainingResult, sensorService, updateInstallGuard } from '../app/AppServices'
import type { GameHudSnapshot } from '../core/game/TrainingGameEvents'
import type { ITrainingGame } from '../core/game/ITrainingGame'
import { GameTutorialController, type GameTutorialSnapshot } from '../core/game/GameTutorial'
import { pauseReasonAfterBackground, pauseReasonAfterDisconnect, shouldAutoResume, type PauseReason } from '../core/game/TrainingPausePolicy'
import { TrainingReplayRecorder } from '../core/replay/TrainingReplayRecorder'
import type { BaseTrainingResult } from '../core/training/BaseTrainingResult'
import type { TrainingSessionState } from '../core/training/TrainingSessionState'
import { getGameModule } from '../games/GameRegistry'
import { isAndroidNativeRuntime } from '../platform/PlatformRuntime'

type TrainingPreflightState = 'checking-device' | 'device-required' | 'center-guide' | 'tutorial' | 'ready' | 'playing' | 'recalibrating'

const route = useRoute()
const router = useRouter()
const module = getGameModule(String(route.params.gameId ?? ''))
const gameHost = ref<HTMLElement | null>(null)
const errorMessage = ref('')
const displayMessage = ref('')
const trainingState = ref<TrainingSessionState>('idle')
const preflight = ref<TrainingPreflightState>('checking-device')
const pauseReason = ref<PauseReason>('none')
const connected = ref(false)
const calibrated = ref(false)
const hud = ref<GameHudSnapshot>({ title: '训练准备', metrics: [] })
const tutorialSnapshot = ref<GameTutorialSnapshot | null>(null)
const showInstructions = ref(false)
const showExitConfirm = ref(false)
const canPause = computed(() => preflight.value === 'playing' && (trainingState.value === 'playing' || trainingState.value === 'paused'))
const replayRecorder = new TrainingReplayRecorder(40)
const androidNative = isAndroidNativeRuntime()
let unsubscribe: (() => void) | null = null
let unsubscribeLifecycle: (() => void) | null = null
let game: ITrainingGame<BaseTrainingResult> | null = null
let displayModeEntered = false
let appActive = true
let backgroundedDuringSession = false
let releaseUpdateLock: (() => void) | null = null
let tutorialController: GameTutorialController | null = null
let tutorialCompleting = false
let allowNavigation = false
let pendingRoute = '/games'
let pausedForDialog = false

if (module?.definition.enabled) {
  game = module.createGame({
    onSessionStateChanged(state: TrainingSessionState) { trainingState.value = state },
    onHudChanged(next: GameHudSnapshot) { hud.value = next },
    onReplayEvent(event) { replayRecorder.recordEvent(event) },
    onCompleted(result: BaseTrainingResult) { void completeTraining(result) },
  })
}

// 通用宿主只分发标准化输入；具体游戏无法访问 BLE、角度或 ROM 算法。
onMounted(async () => {
  releaseUpdateLock = updateInstallGuard.acquire('training')
  if (!module || !module.definition.enabled || !game) {
    await router.replace({ path: '/games', query: { error: 'game-unavailable' } })
    return
  }
  unsubscribeLifecycle = appLifecycleService.onActiveChanged(handleAppActiveChanged)
  unsubscribe = sensorService.onSnapshot((snapshot) => {
    const nextConnected = snapshot.state === 'connected'
    connected.value = nextConnected
    calibrated.value = snapshot.gameInput.calibrated
    const stateBeforeInput = trainingState.value
    if (preflight.value === 'playing' && !nextConnected && ['countdown', 'playing', 'paused'].includes(stateBeforeInput)) {
      // 只有系统造成的暂停才允许校准后自动恢复，手动暂停优先保留。
      pauseReason.value = pauseReasonAfterDisconnect(pauseReason.value, stateBeforeInput)
      game?.pause()
      preflight.value = 'recalibrating'
    }
    game?.setInput(snapshot.gameInput)
    if (preflight.value === 'tutorial' && tutorialController) {
      const next = tutorialController.update(snapshot.gameInput, performance.now())
      tutorialSnapshot.value = next
      if (next.completed && !tutorialCompleting) void finishTutorial()
    }
    if (preflight.value === 'playing' && nextConnected && trainingState.value === 'playing') {
      replayRecorder.recordInput(snapshot.gameInput, game?.getTrainingElapsedMs() ?? 0)
    }
    if (preflight.value === 'checking-device' || preflight.value === 'device-required') {
      preflight.value = nextConnected ? 'center-guide' : 'device-required'
    }
  })
  const displayState = await displayService.enterTrainingMode()
  displayModeEntered = true
  if (displayState.native && !displayState.orientationLocked) displayMessage.value = '系统未能锁定横屏，建议将设备横向放置后继续训练。'
  // 等待方向变化和 CSS 布局稳定后再创建 Pixi Canvas。
  await nextTick()
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  if (!gameHost.value) { errorMessage.value = '游戏容器尚未创建。'; return }
  try {
    await game.mount(gameHost.value)
    // 每局训练都清除旧 Zero，个人 ROM 仍保持不变。
    sensorService.resetCalibration()
    preflight.value = connected.value ? 'center-guide' : 'device-required'
    if (!connected.value) void connectionManager.reconnectNow()
  } catch (error) { errorMessage.value = formatError(error) }
})

// 导航离开与 Android 返回键共用页面内确认，未完成训练不会被误保存。
onBeforeRouteLeave((to) => {
  if (!module || !game || allowNavigation || trainingState.value === 'completed' || trainingState.value === 'aborted') return true
  pendingRoute = to.fullPath
  requestAbort()
  return false
})
onBeforeUnmount(() => {
  unsubscribe?.()
  unsubscribeLifecycle?.()
  game?.destroy()
  releaseUpdateLock?.()
  if (displayModeEntered) void displayService.leaveTrainingMode()
})

/** 后台只冻结当前会话；回前台必须使用真实传感器数据重新确认中心。 */
function handleAppActiveChanged(active: boolean): void {
  if (active === appActive) return
  appActive = active
  if (!active) {
    if (preflight.value !== 'playing' || !['countdown', 'playing', 'paused'].includes(trainingState.value)) return
    backgroundedDuringSession = true
    pauseReason.value = pauseReasonAfterBackground(pauseReason.value, trainingState.value)
    game?.pause()
    return
  }
  if (!backgroundedDuringSession || trainingState.value !== 'paused') return
  backgroundedDuringSession = false
  sensorService.resetCalibration()
  preflight.value = 'recalibrating'
  if (!connected.value) void connectionManager.reconnectNow()
}

async function centerCompleted(): Promise<void> {
  if (!game) return
  try {
    if (preflight.value === 'recalibrating') {
      preflight.value = 'playing'
      if (shouldAutoResume(pauseReason.value)) {
        game.resume()
        pauseReason.value = 'none'
      }
      return
    }
    const tutorial = module?.definition.tutorial
    const forceTutorial = route.query.tutorial === '1'
    if (tutorial && (forceTutorial || !(await gameTutorialRepository.isCompleted(module!.definition.id, tutorial.version)))) {
      tutorialController = new GameTutorialController(tutorial)
      tutorialSnapshot.value = tutorialController.getSnapshot(performance.now())
      preflight.value = 'tutorial'
      return
    }
    startTraining()
  } catch (error) { errorMessage.value = formatError(error) }
}

/** 教程完成后才重置 Recorder 并启动三秒倒计时。 */
async function finishTutorial(): Promise<void> {
  const tutorial = module?.definition.tutorial
  if (!tutorial || tutorialCompleting) return
  tutorialCompleting = true
  try {
    await gameTutorialRepository.markCompleted(module!.definition.id, tutorial.version)
    startTraining()
  } catch (error) { errorMessage.value = formatError(error) }
  finally { tutorialCompleting = false }
}

function startTraining(): void {
  if (!game) return
  preflight.value = 'ready'
  pauseReason.value = 'none'
  replayRecorder.reset()
  game.start()
  preflight.value = 'playing'
}

function retryConnection(): void { errorMessage.value = ''; void connectionManager.reconnectNow() }

function togglePause(): void {
  if (!game) return
  try {
    if (trainingState.value === 'playing') {
      pauseReason.value = 'manual'
      game.pause()
      showInstructions.value = true
    } else if (trainingState.value === 'paused') {
      game.resume()
      pauseReason.value = 'none'
      showInstructions.value = false
    }
  } catch (error) { errorMessage.value = formatError(error) }
}

function requestAbort(): void {
  if (showExitConfirm.value) return
  pausedForDialog = trainingState.value === 'playing' || trainingState.value === 'countdown'
  if (pausedForDialog) game?.pause()
  showExitConfirm.value = true
}

function cancelAbort(): void {
  showExitConfirm.value = false
  pendingRoute = '/games'
  if (pausedForDialog && connected.value && calibrated.value) game?.resume()
  pausedForDialog = false
}

function confirmAbort(): void {
  showExitConfirm.value = false
  allowNavigation = true
  game?.abort()
  void router.push(pendingRoute)
}

async function completeTraining(result: BaseTrainingResult): Promise<void> {
  if (!module || !game) return
  try {
    await persistTrainingResult({ game: module.definition, result, replay: replayRecorder.finish(result.durationMs), gameConfig: module.getConfigSnapshot() })
    allowNavigation = true
    await router.push('/result')
  } catch (error) { errorMessage.value = `训练已完成，但保存历史失败：${formatError(error)}` }
}

function formatError(error: unknown): string { return error instanceof Error ? error.message : String(error) }
</script>

<template>
  <main class="training-shell">
    <header class="training-toolbar">
      <div><p class="eyebrow">{{ module?.definition.name ?? '训练' }}</p><h1>{{ preflight !== 'playing' ? '训练准备' : hud.title }}</h1><p v-if="hud.subtitle" class="muted small">{{ hud.subtitle }}</p></div>
      <div class="scoreboard"><span v-for="metric in hud.metrics" :key="metric.label">{{ metric.label }} {{ metric.value }}</span><span>{{ trainingState }}</span></div>
      <div class="row training-actions"><DeviceConnectionStatus v-if="androidNative" /><button class="button" :disabled="!canPause" @click="togglePause">{{ trainingState === 'paused' ? '继续' : '暂停' }}</button><button class="button danger" @click="requestAbort">结束训练</button></div>
    </header>
    <div ref="gameHost" class="game-host training-host"></div>
    <div v-if="preflight !== 'playing'" class="training-overlay">
      <CenterCalibrationGuide v-if="preflight === 'center-guide' || (preflight === 'recalibrating' && connected)" @completed="centerCompleted" />
      <section v-else-if="preflight === 'tutorial'" class="center-guide tutorial-guide"><p class="eyebrow">交互引导 {{ (tutorialSnapshot?.stepIndex ?? 0) + 1 }} / {{ module?.definition.tutorial?.steps.length ?? 0 }}</p><h2>{{ tutorialSnapshot?.step?.title }}</h2><p>{{ tutorialSnapshot?.step?.description }}</p><div class="calibration-progress"><span :style="{ width: `${(tutorialSnapshot?.holdProgress ?? 0) * 100}%` }"></span></div><p class="muted small">达到提示方向并连续保持 400 毫秒。</p></section>
      <section v-else class="center-guide"><h2>{{ preflight === 'recalibrating' ? '正在恢复设备连接' : '当前设备未连接' }}</h2><p>{{ preflight === 'recalibrating' ? '训练已暂停。设备恢复后请重新确认自然中心；如需手动处理设备，请使用右上角设备状态菜单。' : '系统正在尝试恢复已绑定设备。如需重新连接、更换设备或忘记设备，请使用右上角设备状态菜单。' }}</p><button class="button primary" @click="retryConnection">重新连接</button></section>
    </div>
    <div v-if="showInstructions && preflight === 'playing'" class="training-dialog-backdrop"><section class="training-dialog"><p class="eyebrow">训练已暂停</p><h2>{{ module?.definition.name }}</h2><div v-if="module?.definition.instructions?.length" class="instruction-list"><article v-for="item in module.definition.instructions" :key="item.title"><strong>{{ item.title }}</strong><p>{{ item.description }}</p></article></div><p v-else class="muted">保持自然、舒适的运动幅度完成当前训练。</p><div class="row"><button class="button primary" @click="togglePause">继续训练</button><button class="button danger" @click="requestAbort">结束训练</button></div></section></div>
    <div v-if="showExitConfirm" class="training-dialog-backdrop confirm-layer"><section class="training-dialog"><h2>确认结束当前训练？</h2><p>未抵达终点的本局训练会被丢弃，并且不会保存到训练历史。</p><div class="row"><button class="button" @click="cancelAbort">返回训练</button><button class="button danger" @click="confirmAbort">确认结束</button></div></section></div>
    <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
    <p v-if="displayMessage" class="training-display-hint">{{ displayMessage }}</p>
  </main>
</template>
