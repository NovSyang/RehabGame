<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { connectionManager, motionProfileService, sensorService } from '../app/AppServices'
import type { SensorRuntimeSnapshot } from '../core/sensor/SensorService'
import { createEmptyBatteryState } from '../core/sensor/bsbt91/BsBt91Battery'
import type { SensorDevice } from '../core/sensor/SensorDevice'

const router = useRouter()
const devices = ref<SensorDevice[]>([])
const selectedDeviceId = ref('')
const snapshot = ref<SensorRuntimeSnapshot>({ state: 'idle', frame: null, gameInput: { x: 0, y: 0, connected: false, calibrated: false, timestamp: 0 }, rateHz: 0, rawHex: '', battery: createEmptyBatteryState() })
const reconnectMessage = ref('')
const busy = ref(false)
const scanning = ref(false)
const errorMessage = ref('')
let unsubscribeSensor: (() => void) | null = null
let unsubscribeConnection: (() => void) | null = null

const connected = computed(() => snapshot.value.state === 'connected')
const calibration = computed(() => sensorService.motion.getCalibrationSnapshot(snapshot.value.frame?.timestamp ?? Date.now()))
const hasMeasuredProfile = computed(() => motionProfileService.getCurrent().measuredRange !== null)

// 页面只订阅单例服务的快照，避免重复创建蓝牙连接。
onMounted(() => {
  unsubscribeSensor = sensorService.onSnapshot((next) => { snapshot.value = next })
  unsubscribeConnection = connectionManager.onChanged((next) => { reconnectMessage.value = next.message ?? '' })
})
onBeforeUnmount(() => { unsubscribeSensor?.(); unsubscribeConnection?.() })

async function scanDevices(): Promise<void> {
  scanning.value = true; errorMessage.value = ''
  try {
    devices.value = await sensorService.scan()
    if (!selectedDeviceId.value && devices.value.length) selectedDeviceId.value = devices.value[0].id
  } catch (error) { errorMessage.value = formatError(error) }
  finally { scanning.value = false }
}

async function connectDevice(): Promise<void> {
  const device = devices.value.find((item) => item.id === selectedDeviceId.value)
  if (!device) return
  busy.value = true; errorMessage.value = ''
  try { await connectionManager.connect(device) }
  catch (error) { errorMessage.value = formatError(error) }
  finally { busy.value = false }
}

async function disconnectDevice(): Promise<void> {
  busy.value = true
  try { await connectionManager.disconnectManually() }
  catch (error) { errorMessage.value = formatError(error) }
  finally { busy.value = false }
}

function calibrate(): void { sensorService.startCalibration() }
function openTraining(): void {
  if (!connected.value) { errorMessage.value = '请先连接 BS-BT91。'; return }
  if (!snapshot.value.gameInput.calibrated) { errorMessage.value = '请先完成中心校准。'; return }
  router.push(hasMeasuredProfile.value ? '/games' : '/rom-calibration')
}
function formatError(error: unknown): string { return error instanceof Error ? error.message : String(error) }
</script>

<template>
  <main class="shell">
    <aside class="panel">
      <div><p class="eyebrow">康复训练准备</p><h1>BS-BT91</h1><p class="muted">连接设备、中心校准并确认个人活动范围。</p></div>
      <section class="card"><div class="section-title">设备连接</div>
        <div class="row"><button class="button" :disabled="scanning || busy" @click="scanDevices">{{ scanning ? '扫描中…' : '扫描 BS-BT91' }}</button><span class="status" :data-state="snapshot.state">{{ snapshot.state }}</span></div>
        <select v-model="selectedDeviceId" class="select"><option value="">请选择设备</option><option v-for="device in devices" :key="device.id" :value="device.id">{{ device.name }} · {{ device.address || device.id }}</option></select>
        <div class="row"><button class="button primary" :disabled="!selectedDeviceId || busy || connected" @click="connectDevice">连接</button><button class="button danger" :disabled="busy || !connected" @click="disconnectDevice">断开</button></div>
        <p v-if="reconnectMessage" class="muted small">{{ reconnectMessage }}</p>
      </section>
      <section class="card"><div class="section-title">中心校准</div><button class="button primary wide" :disabled="!connected" @click="calibrate">保持中心 1 秒并校准</button><p class="muted small">{{ calibration.active ? `校准中 ${Math.round(calibration.progress * 100)}%` : snapshot.gameInput.calibrated ? '中心校准完成' : '完成校准后才能开始训练' }}</p></section>
      <section class="card"><div class="section-title">个人 ROM</div><p class="muted small">{{ hasMeasuredProfile ? '已保存个体化活动范围。' : '首次使用需要完成四方向 ROM 标定。' }}</p><button class="button" :disabled="!connected || !snapshot.gameInput.calibrated" @click="router.push('/rom-calibration')">{{ hasMeasuredProfile ? '重新标定 ROM' : '开始 ROM 标定' }}</button></section>
      <button class="button primary wide" :disabled="!connected || !snapshot.gameInput.calibrated" @click="openTraining">进入训练</button><p v-if="errorMessage" class="error">{{ errorMessage }}</p>
    </aside>
    <section class="game-area device-summary"><div class="game-header"><div><span class="game-kicker">实时状态</span><strong>连接 → 中心零点 → 个体 ROM → 训练</strong></div></div><div class="metric-grid"><div><span>Game X</span><strong>{{ snapshot.gameInput.x.toFixed(3) }}</strong></div><div><span>Game Y</span><strong>{{ snapshot.gameInput.y.toFixed(3) }}</strong></div><div><span>Rate</span><strong>{{ snapshot.rateHz }} Hz</strong></div></div><section class="card raw-card"><div class="section-title">最近一帧</div><code>{{ snapshot.rawHex || '等待 BLE Notify…' }}</code></section></section>
  </main>
</template>
