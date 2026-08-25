<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import DeviceConnectionPanel from '../components/device/DeviceConnectionPanel.vue'
import { connectionManager, motionProfileService, sensorService } from '../app/AppServices'
import type { SensorConnectionSnapshot } from '../core/sensor/SensorConnectionManager'
import type { SensorRuntimeSnapshot } from '../core/sensor/SensorService'

const router = useRouter()
const connection = ref<SensorConnectionSnapshot>(connectionManager.getSnapshot())
const sensor = ref<SensorRuntimeSnapshot>({ state: 'idle', frame: null, gameInput: { x: 0, y: 0, connected: false, calibrated: false, timestamp: 0 }, rateHz: 0, rawHex: '' })
const showDevicePanel = ref(false)
const message = ref('')
const profile = computed(() => motionProfileService.getCurrent())
let unsubscribeConnection: (() => void) | null = null
let unsubscribeSensor: (() => void) | null = null

// 设置页展示长期配置和设备管理；顶部状态栏不承载这些操作。
onMounted(() => { unsubscribeConnection = connectionManager.onChanged((next) => { connection.value = next }); unsubscribeSensor = sensorService.onSnapshot((next) => { sensor.value = next }) })
onBeforeUnmount(() => { unsubscribeConnection?.(); unsubscribeSensor?.() })
function range(value: number | undefined): string { return value === undefined ? '--' : `${value.toFixed(1)}°` }
function reconnect(): void { message.value = '正在尝试恢复已绑定设备…'; void connectionManager.reconnectBoundDevice() }
async function forgetDevice(): Promise<void> { if (!window.confirm('确认忘记当前训练设备吗？')) return; await connectionManager.forgetBinding(); sensorService.resetCalibration(); message.value = '已忘记设备绑定。' }
function deviceConnected(): void { showDevicePanel.value = false; sensorService.resetCalibration(); message.value = '训练设备已更新，开始训练前会重新确认中心位置。' }
</script>

<template><main class="content-page"><p class="eyebrow">Settings</p><h1>设置</h1><section class="card"><h2>个人活动范围</h2><template v-if="profile.measuredRange"><p>实测 ROM：前 {{ range(profile.measuredRange.forwardMax) }} · 后 {{ range(profile.measuredRange.backwardMax) }} · 左 {{ range(profile.measuredRange.leftMax) }} · 右 {{ range(profile.measuredRange.rightMax) }}</p><p class="muted">当前训练范围：前 {{ range(profile.activeRange.forwardMax) }} · 后 {{ range(profile.activeRange.backwardMax) }} · 左 {{ range(profile.activeRange.leftMax) }} · 右 {{ range(profile.activeRange.rightMax) }}</p><p class="muted small">训练比例 {{ (profile.trainingRatio * 100).toFixed(0) }}% · 死区 {{ profile.horizontalDeadZone }}° / {{ profile.verticalDeadZone }}°</p></template><p v-else class="muted">尚未完成个人 ROM 测量。</p><button class="button primary" @click="router.push('/rom-calibration?source=settings')">{{ profile.measuredRange ? '重新测量个人 ROM' : '开始个人 ROM 测量' }}</button></section><section class="card"><h2>训练设备</h2><p :class="sensor.state === 'connected' ? 'success-text' : 'muted'">{{ sensor.state === 'connected' ? '设备已连接' : '设备未连接' }}</p><p class="muted">{{ connection.binding ? `${connection.binding.name} · ${connection.binding.address || connection.binding.deviceId}` : '未保存设备绑定' }}</p><div class="row"><button class="button" :disabled="!connection.binding" @click="reconnect">重新连接</button><button class="button primary" @click="showDevicePanel = !showDevicePanel">更换设备</button><button class="button danger" :disabled="!connection.binding" @click="forgetDevice">忘记设备</button></div><DeviceConnectionPanel v-if="showDevicePanel" @connected="deviceConnected" /></section><section class="card"><h2>高级</h2><button class="button" @click="router.push('/settings/debug')">开发者诊断</button></section><p v-if="message" class="muted">{{ message }}</p></main></template>
