<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import DeviceConnectionPanel from '../components/device/DeviceConnectionPanel.vue'
import { connectionManager, sensorService } from '../app/AppServices'
import type { SensorRuntimeSnapshot } from '../core/sensor/SensorService'

const snapshot = ref<SensorRuntimeSnapshot>({ state: 'idle', frame: null, gameInput: { x: 0, y: 0, connected: false, calibrated: false, timestamp: 0 }, rateHz: 0, rawHex: '' })
let unsubscribe: (() => void) | null = null

// 调试页保留原设备页面的诊断信息，不参与普通训练流程。
onMounted(() => { unsubscribe = sensorService.onSnapshot((next) => { snapshot.value = next }) })
onBeforeUnmount(() => unsubscribe?.())
async function disconnect(): Promise<void> { await connectionManager.disconnectManually() }
function calibrate(): void { sensorService.resetCalibration(); sensorService.startCalibration() }
</script>

<template><main class="content-page"><p class="eyebrow">Developer Diagnostics</p><h1>开发者诊断</h1><DeviceConnectionPanel /><section class="card"><h2>传感器状态</h2><p>State：{{ snapshot.state }} · Rate：{{ snapshot.rateHz }} Hz</p><p>Angle：{{ snapshot.frame?.angleX.toFixed(2) ?? '--' }} / {{ snapshot.frame?.angleY.toFixed(2) ?? '--' }} / {{ snapshot.frame?.angleZ.toFixed(2) ?? '--' }}</p><p>GameInput：{{ snapshot.gameInput.x.toFixed(3) }} / {{ snapshot.gameInput.y.toFixed(3) }} · calibrated={{ snapshot.gameInput.calibrated }}</p><p>Zero：{{ sensorService.motion.getCalibrationSnapshot(snapshot.frame?.timestamp ?? Date.now()).zeroAngleX.toFixed(2) }} / {{ sensorService.motion.getCalibrationSnapshot(snapshot.frame?.timestamp ?? Date.now()).zeroAngleY.toFixed(2) }}</p><p class="raw-card"><code>{{ snapshot.rawHex || '等待 Notify…' }}</code></p><div class="row"><button class="button" @click="calibrate">手动中心校准</button><button class="button danger" @click="disconnect">断开设备</button></div></section></main></template>
