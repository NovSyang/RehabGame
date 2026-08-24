<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { TauriBleTransport } from './platform/tauri/TauriBleTransport'
import { SensorService, type SensorRuntimeSnapshot } from './core/sensor/SensorService'
import type { SensorDevice } from './core/sensor/SensorDevice'
import { BallGame } from './games/ball-demo/BallGame'

const transport = new TauriBleTransport()
const sensorService = new SensorService(transport)
const ballGame = new BallGame()

const devices = ref<SensorDevice[]>([])
const selectedDeviceId = ref('')
const scanning = ref(false)
const busy = ref(false)
const errorMessage = ref('')
const gameHost = ref<HTMLElement | null>(null)

const snapshot = ref<SensorRuntimeSnapshot>({
  state: 'idle',
  frame: null,
  gameInput: { x: 0, y: 0, connected: false, calibrated: false, timestamp: 0 },
  rateHz: 0,
  rawHex: '',
})

const connected = computed(() => snapshot.value.state === 'connected')
const calibration = computed(() =>
  sensorService.motion.getCalibrationSnapshot(snapshot.value.frame?.timestamp ?? Date.now()),
)

let unsubscribeSnapshot: (() => void) | null = null

onMounted(async () => {
  unsubscribeSnapshot = sensorService.onSnapshot((next) => {
    snapshot.value = next
    ballGame.setInput(next.gameInput)
  })

  await nextTick()
  if (gameHost.value) await ballGame.mount(gameHost.value)
})

onBeforeUnmount(async () => {
  unsubscribeSnapshot?.()
  ballGame.destroy()
  await transport.dispose()
})

async function scanDevices() {
  scanning.value = true
  errorMessage.value = ''
  try {
    devices.value = await sensorService.scan()
    if (!selectedDeviceId.value && devices.value.length > 0) {
      selectedDeviceId.value = devices.value[0].id
    }
  } catch (error) {
    errorMessage.value = formatError(error)
  } finally {
    scanning.value = false
  }
}

async function connectDevice() {
  if (!selectedDeviceId.value) return
  busy.value = true
  errorMessage.value = ''
  try {
    await sensorService.connect(selectedDeviceId.value)
  } catch (error) {
    errorMessage.value = formatError(error)
  } finally {
    busy.value = false
  }
}

async function disconnectDevice() {
  busy.value = true
  try {
    await sensorService.disconnect()
  } catch (error) {
    errorMessage.value = formatError(error)
  } finally {
    busy.value = false
  }
}

function calibrate() {
  sensorService.startCalibration()
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
</script>

<template>
  <main class="shell">
    <aside class="panel">
      <div>
        <p class="eyebrow">康复仪器交互验证</p>
        <h1>BS-BT91 实机 Demo</h1>
        <p class="muted">Windows Tauri · BLE 50Hz · PixiJS</p>
      </div>

      <section class="card">
        <div class="section-title">设备连接</div>
        <div class="row">
          <button class="button" :disabled="scanning || busy" @click="scanDevices">
            {{ scanning ? '扫描中…' : '扫描 BS-BT91' }}
          </button>
          <span class="status" :data-state="snapshot.state">{{ snapshot.state }}</span>
        </div>

        <select v-model="selectedDeviceId" class="select">
          <option value="">请选择设备</option>
          <option v-for="device in devices" :key="device.id" :value="device.id">
            {{ device.name }} · {{ device.address || device.id }}
          </option>
        </select>

        <div class="row">
          <button class="button primary" :disabled="!selectedDeviceId || busy || connected" @click="connectDevice">
            连接
          </button>
          <button class="button danger" :disabled="busy || !connected" @click="disconnectDevice">
            断开
          </button>
        </div>
        <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
      </section>

      <section class="card">
        <div class="section-title">实时姿态</div>
        <div class="metric-grid">
          <div><span>Angle X</span><strong>{{ snapshot.frame?.angleX.toFixed(2) ?? '--' }}°</strong></div>
          <div><span>Angle Y</span><strong>{{ snapshot.frame?.angleY.toFixed(2) ?? '--' }}°</strong></div>
          <div><span>Angle Z</span><strong>{{ snapshot.frame?.angleZ.toFixed(2) ?? '--' }}°</strong></div>
          <div><span>Rate</span><strong>{{ snapshot.rateHz }} Hz</strong></div>
        </div>
      </section>

      <section class="card">
        <div class="section-title">MotionProcessor</div>
        <button class="button primary wide" :disabled="!connected" @click="calibrate">
          保持中心 1 秒并校准
        </button>
        <div class="metric-grid compact">
          <div><span>Zero X</span><strong>{{ calibration.zeroAngleX.toFixed(2) }}°</strong></div>
          <div><span>Zero Y</span><strong>{{ calibration.zeroAngleY.toFixed(2) }}°</strong></div>
          <div><span>Game X</span><strong>{{ snapshot.gameInput.x.toFixed(3) }}</strong></div>
          <div><span>Game Y</span><strong>{{ snapshot.gameInput.y.toFixed(3) }}</strong></div>
        </div>
        <p class="muted small">
          当前映射：GameX = AngleY，GameY = -AngleX；DeadZone = 0.5°；默认四方向 ROM = 20°。
        </p>
      </section>

      <section class="card raw-card">
        <div class="section-title">最近一帧</div>
        <code>{{ snapshot.rawHex || '等待 BLE Notify…' }}</code>
      </section>
    </aside>

    <section class="game-area">
      <div class="game-header">
        <div>
          <span class="game-kicker">PixiJS Ball Demo</span>
          <strong>{{ snapshot.gameInput.calibrated ? '已校准' : '请先连接并校准' }}</strong>
        </div>
        <div class="legend">左 / 右 ← Game X · 前 / 后 ← Game Y</div>
      </div>
      <div ref="gameHost" class="game-host"></div>
    </section>
  </main>
</template>
