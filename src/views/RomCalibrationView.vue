<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { motionProfileService, sensorService } from '../app/AppServices'
import { profileFromMeasuredRange } from '../core/motion/MotionProfile'
import { RomCalibrator } from '../core/motion/RomCalibrator'
import { ROM_DIRECTION_ORDER, type RomDirection } from '../core/motion/RomCalibrationState'

const router = useRouter()
const calibrator = new RomCalibrator()
const snapshot = ref(calibrator.getSnapshot(Date.now()))
const errorMessage = ref('')
const direction = computed<RomDirection | null>(() => snapshot.value.direction)
const readyForRom = ref(false)
let timer: number | null = null
let unsubscribe: (() => void) | null = null

// 标定仅消费 MotionProcessor 的相对运动，避免页面复制轴映射。
onMounted(() => {
  calibrator.prepare(); refresh()
  unsubscribe = sensorService.onSnapshot((sensor) => {
    readyForRom.value = sensor.state === 'connected' && sensor.gameInput.calibrated
    if (sensor.frame) calibrator.addSample(sensorService.motion.getRelativeMotion(sensor.frame), sensor.frame.timestamp)
  })
  timer = window.setInterval(() => {
    if (snapshot.value.state === 'measuring') {
      calibrator.complete(Date.now()); refresh()
    }
  }, 50)
})
onBeforeUnmount(() => { unsubscribe?.(); if (timer !== null) window.clearInterval(timer) })

function start(directionToMeasure: RomDirection): void {
  if (!readyForRom.value) { errorMessage.value = 'ROM 标定前必须连接设备并完成中心校准。'; return }
  errorMessage.value = ''; calibrator.start(directionToMeasure, Date.now()); refresh()
}
async function accept(): Promise<void> {
  if (!calibrator.accept()) { errorMessage.value = snapshot.value.result?.message ?? '请重新测量当前方向。'; return }
  const range = calibrator.getMeasuredRange(); refresh()
  if (range) { await motionProfileService.save(profileFromMeasuredRange(range, motionProfileService.getCurrent())); await router.push('/games') }
}
function retry(): void { calibrator.retry(); refresh() }
function cancel(): void { calibrator.cancel(); void router.push('/device') }
function refresh(): void { snapshot.value = calibrator.getSnapshot(Date.now()) }
function label(value: RomDirection): string { return { forward: '向前', backward: '向后', left: '向左', right: '向右' }[value] }
</script>

<template><main class="content-page"><p class="eyebrow">ROM Calibration</p><h1>四方向活动范围标定</h1><p class="muted">请在舒适、安全范围内缓慢移动并保持。每个方向采集 3 秒，前 500ms 不计入结果。</p><section class="card"><template v-if="snapshot.state === 'ready'"><h2>请选择待测方向</h2><div class="row"><button v-for="item in ROM_DIRECTION_ORDER" :key="item" class="button primary" @click="start(item)">{{ label(item) }}</button></div></template><template v-else-if="snapshot.state === 'measuring'"><h2>当前：{{ direction && label(direction) }}</h2><p>采集中 {{ Math.min(100, Math.round(snapshot.elapsedMs / 30)) }}% · 有效样本 {{ snapshot.sampleCount }}</p></template><template v-else-if="snapshot.state === 'review'"><h2>{{ snapshot.result?.valid ? '测量结果' : '需要重新测量' }}</h2><p>{{ snapshot.result?.measuredRom.toFixed(1) }}° · {{ snapshot.result?.validSamples }} 个有效样本</p><p v-if="snapshot.result?.message" class="error">{{ snapshot.result.message }}</p><div class="row"><button class="button primary" :disabled="!snapshot.result?.valid" @click="accept">接受</button><button class="button" @click="retry">重新测量</button></div></template><template v-else><p>正在准备标定流程…</p></template></section><p v-if="errorMessage" class="error">{{ errorMessage }}</p><button class="button danger" @click="cancel">取消并返回</button></main></template>
