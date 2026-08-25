<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { sensorService } from '../../app/AppServices'
import type { SensorRuntimeSnapshot } from '../../core/sensor/SensorService'

const snapshot = ref<SensorRuntimeSnapshot>({ state: 'idle', frame: null, gameInput: { x: 0, y: 0, connected: false, calibrated: false, timestamp: 0 }, rateHz: 0, rawHex: '' })
const connected = computed(() => snapshot.value.state === 'connected')
let unsubscribe: (() => void) | null = null

// 顶部只展示连接结果，不暴露扫描、设备标识或重连细节。
onMounted(() => { unsubscribe = sensorService.onSnapshot((next) => { snapshot.value = next }) })
onBeforeUnmount(() => unsubscribe?.())
</script>

<template><div class="device-status" :data-connected="connected"><span class="status-dot"></span><span>{{ connected ? '设备已连接' : '设备未连接' }}</span></div></template>
