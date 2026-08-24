<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import { SensorService, type SensorRuntimeSnapshot } from './core/sensor/SensorService'
import type { SensorDevice } from './core/sensor/SensorDevice'
import type { TrainingResult } from './core/training/TrainingResult'
import type { TrainingSessionState } from './core/training/TrainingSessionState'
import { TargetReachGame } from './games/target-reach/TargetReachGame'
import { TauriBleTransport } from './platform/tauri/TauriBleTransport'

type AppMode = 'device' | 'game' | 'result'
type ResultDirection = 'left' | 'right' | 'forward' | 'backward'
const resultDirections: ResultDirection[] = ['left', 'right', 'forward', 'backward']

const transport = new TauriBleTransport()
const sensorService = new SensorService(transport)
const appMode = ref<AppMode>('device')
const devices = ref<SensorDevice[]>([])
const selectedDeviceId = ref('')
const scanning = ref(false)
const busy = ref(false)
const errorMessage = ref('')
const gameHost = ref<HTMLElement | null>(null)
const result = ref<TrainingResult | null>(null)
const trainingState = ref<TrainingSessionState>('idle')
const successCount = ref(0)
const attemptedCount = ref(0)
const currentTarget = ref('')
const snapshot = ref<SensorRuntimeSnapshot>({
  state: 'idle', frame: null,
  gameInput: { x: 0, y: 0, connected: false, calibrated: false, timestamp: 0 },
  rateHz: 0, rawHex: '',
})

const connected = computed(() => snapshot.value.state === 'connected')
const calibration = computed(() =>
  sensorService.motion.getCalibrationSnapshot(snapshot.value.frame?.timestamp ?? Date.now()),
)

const targetReachGame = new TargetReachGame(undefined, {
  onTargetChanged(direction, index) { currentTarget.value = `${index} · ${directionText(direction)}` },
  onScoreChanged(success, total) { successCount.value = success; attemptedCount.value = total },
  onSessionStateChanged(state) { trainingState.value = state },
  onCompleted(trainingResult) { result.value = trainingResult; appMode.value = 'result' },
})

// 正式游戏只接收归一化后的 GameInput，避免耦合 BLE 与角度解析细节。
const unsubscribeSnapshot = sensorService.onSnapshot((next) => {
  snapshot.value = next
  targetReachGame.setInput(next.gameInput)
})

onBeforeUnmount(async () => {
  unsubscribeSnapshot()
  targetReachGame.destroy()
  await transport.dispose()
})

async function scanDevices() {
  scanning.value = true
  errorMessage.value = ''
  try {
    devices.value = await sensorService.scan()
    if (!selectedDeviceId.value && devices.value.length > 0) selectedDeviceId.value = devices.value[0].id
  } catch (error) { errorMessage.value = formatError(error) } finally { scanning.value = false }
}

async function connectDevice() {
  if (!selectedDeviceId.value) return
  busy.value = true
  errorMessage.value = ''
  try { await sensorService.connect(selectedDeviceId.value) }
  catch (error) { errorMessage.value = formatError(error) }
  finally { busy.value = false }
}

async function disconnectDevice() {
  busy.value = true
  try { await sensorService.disconnect() }
  catch (error) { errorMessage.value = formatError(error) }
  finally { busy.value = false }
}

function calibrate() { sensorService.startCalibration() }

async function startTraining() {
  errorMessage.value = ''
  if (!connected.value) { errorMessage.value = '请先连接 BS-BT91'; return }
  if (!snapshot.value.gameInput.calibrated) { errorMessage.value = '请先完成中心校准'; return }
  result.value = null
  successCount.value = 0
  attemptedCount.value = 0
  currentTarget.value = ''
  appMode.value = 'game'
  await nextTick()
  try {
    if (!gameHost.value) throw new Error('游戏容器尚未创建')
    await targetReachGame.mount(gameHost.value)
    targetReachGame.start()
  } catch (error) {
    targetReachGame.destroy()
    appMode.value = 'device'
    errorMessage.value = formatError(error)
  }
}

function togglePause() {
  try {
    if (trainingState.value === 'playing') targetReachGame.pause()
    else if (trainingState.value === 'paused') targetReachGame.resume()
  } catch (error) { errorMessage.value = formatError(error) }
}

function abortTraining() {
  targetReachGame.abort()
  targetReachGame.destroy()
  appMode.value = 'device'
}

function returnToDevice() {
  targetReachGame.destroy()
  trainingState.value = 'idle'
  appMode.value = 'device'
}

function formatError(error: unknown): string { return error instanceof Error ? error.message : String(error) }
function directionText(direction: ResultDirection): string { return { left: '左', right: '右', forward: '前', backward: '后' }[direction] }
function secondsText(value: number | null): string { return value === null ? '--' : `${(value / 1000).toFixed(2)} s` }
function durationText(value: number): string { return `${(value / 1000).toFixed(1)} s` }
</script>

<template>
  <main v-if="appMode === 'device'" class="shell">
    <aside class="panel">
      <div><p class="eyebrow">康复仪器训练准备</p><h1>BS-BT91 Target Reach</h1><p class="muted">连接设备、完成中心校准后开始正式训练。</p></div>
      <section class="card">
        <div class="section-title">设备连接</div>
        <div class="row"><button class="button" :disabled="scanning || busy" @click="scanDevices">{{ scanning ? '扫描中…' : '扫描 BS-BT91' }}</button><span class="status" :data-state="snapshot.state">{{ snapshot.state }}</span></div>
        <select v-model="selectedDeviceId" class="select"><option value="">请选择设备</option><option v-for="device in devices" :key="device.id" :value="device.id">{{ device.name }} · {{ device.address || device.id }}</option></select>
        <div class="row"><button class="button primary" :disabled="!selectedDeviceId || busy || connected" @click="connectDevice">连接</button><button class="button danger" :disabled="busy || !connected" @click="disconnectDevice">断开</button></div>
      </section>
      <section class="card">
        <div class="section-title">中心校准</div><button class="button primary wide" :disabled="!connected" @click="calibrate">保持中心 1 秒并校准</button>
        <p class="muted small">{{ calibration.active ? `校准中 ${Math.round(calibration.progress * 100)}%` : snapshot.gameInput.calibrated ? '中心校准完成' : '完成校准后才能开始训练' }}</p>
        <div class="metric-grid compact"><div><span>Game X</span><strong>{{ snapshot.gameInput.x.toFixed(3) }}</strong></div><div><span>Game Y</span><strong>{{ snapshot.gameInput.y.toFixed(3) }}</strong></div></div>
      </section>
      <section class="card"><div class="section-title">训练设置</div><p class="muted small">120 秒 · 20 个目标 · 70% ROM · 目标内保持 300ms</p><button class="button primary wide" :disabled="!connected || !snapshot.gameInput.calibrated" @click="startTraining">开始训练</button></section>
      <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
    </aside>
    <section class="game-area device-summary">
      <div class="game-header"><div><span class="game-kicker">训练流程</span><strong>设备连接 → 中心校准 → 目标触达训练</strong></div></div>
      <div class="training-guide"><div>① 连接 BS-BT91</div><div>② 保持中心完成校准</div><div>③ 进入 3 秒倒计时</div><div>④ 按目标方向控制圆点并保持</div></div>
      <section class="card raw-card"><div class="section-title">最近一帧</div><code>{{ snapshot.rawHex || '等待 BLE Notify…' }}</code></section>
    </section>
  </main>

  <main v-else-if="appMode === 'game'" class="training-shell">
    <header class="training-toolbar"><div><p class="eyebrow">Target Reach Training</p><h1>{{ trainingState === 'countdown' ? '准备开始' : currentTarget || '等待目标' }}</h1></div><div class="scoreboard"><span>成功 {{ successCount }}</span><span>完成 {{ attemptedCount }} / 20</span><span>{{ trainingState }}</span></div><div class="row"><button class="button" :disabled="trainingState !== 'playing' && trainingState !== 'paused'" @click="togglePause">{{ trainingState === 'paused' ? '继续' : '暂停' }}</button><button class="button danger" @click="abortTraining">结束训练</button></div></header>
    <div ref="gameHost" class="game-host training-host"></div><p v-if="errorMessage" class="error">{{ errorMessage }}</p>
  </main>

  <main v-else class="result-shell"><section class="result-card"><p class="eyebrow">训练完成</p><h1>Target Reach 结果</h1>
    <template v-if="result"><div class="result-metrics"><div><span>训练时长</span><strong>{{ durationText(result.durationMs) }}</strong></div><div><span>目标总数</span><strong>{{ result.totalTargets }}</strong></div><div><span>成功 / 失败</span><strong>{{ result.successTargets }} / {{ result.failedTargets }}</strong></div><div><span>成功率</span><strong>{{ (result.successRate * 100).toFixed(0) }}%</strong></div><div><span>平均反应时间</span><strong>{{ secondsText(result.averageReactionTimeMs) }}</strong></div><div><span>平均到达时间</span><strong>{{ secondsText(result.averageReachTimeMs) }}</strong></div></div>
    <h2>方向统计</h2><div class="direction-grid"><div v-for="direction in resultDirections" :key="direction"><span>{{ directionText(direction) }}</span><strong>{{ result.directions[direction].success }} / {{ result.directions[direction].total }}</strong><small>平均 {{ secondsText(result.directions[direction].averageReachTimeMs) }}</small></div></div></template>
    <button class="button primary" @click="returnToDevice">返回设备准备</button>
  </section></main>
</template>
