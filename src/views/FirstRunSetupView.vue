<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import DeviceConnectionPanel from '../components/device/DeviceConnectionPanel.vue'
import GuidedRomCalibrationFlow from '../components/rom/GuidedRomCalibrationFlow.vue'
import { motionProfileService, sensorService, updateInstallGuard } from '../app/AppServices'
import { profileFromMeasuredRange } from '../core/motion/MotionProfile'
import type { MotionRange } from '../core/motion/MotionConfig'

const router = useRouter()
const step = ref<'device' | 'guided-rom'>('device')
const errorMessage = ref('')
let unsubscribe: (() => void) | null = null
let releaseUpdateLock: (() => void) | null = null
let initialConnectionChecked = false

// 首次进入页面时允许已恢复的连接自动前进；取消 ROM 后则必须由用户再次点击继续。
onMounted(() => {
  releaseUpdateLock = updateInstallGuard.acquire('first-run-setup')
  unsubscribe = sensorService.onSnapshot((snapshot) => {
    if (!initialConnectionChecked) {
      initialConnectionChecked = true
      if (snapshot.state === 'connected') step.value = 'guided-rom'
    }
  })
})
onBeforeUnmount(() => { unsubscribe?.(); releaseUpdateLock?.() })
function deviceConnected(): void { errorMessage.value = ''; step.value = 'guided-rom' }
async function persistRom(range: MotionRange): Promise<void> {
  await motionProfileService.save(profileFromMeasuredRange(range, motionProfileService.getCurrent()))
  await router.replace('/games')
}
function cancelRom(): void { step.value = 'device' }
</script>

<template>
  <main class="content-page setup-page">
    <template v-if="step === 'device'">
      <p class="eyebrow">首次设置 · 1 / 2</p>
      <h1>连接训练设备</h1>
      <p class="muted">请选择用于训练的设备，连接完成后将进入个人活动范围测量。</p>
      <DeviceConnectionPanel @connected="deviceConnected" @error="errorMessage = $event" />
      <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
    </template>
    <template v-else>
      <p class="eyebrow">首次设置 · 2 / 2</p>
      <h1>个人活动范围测量</h1>
      <GuidedRomCalibrationFlow :persist="persistRom" @cancelled="cancelRom" />
    </template>
  </main>
</template>
