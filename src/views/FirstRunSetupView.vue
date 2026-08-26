<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import CenterCalibrationGuide from '../components/calibration/CenterCalibrationGuide.vue'
import DeviceConnectionPanel from '../components/device/DeviceConnectionPanel.vue'
import RomCalibrationPanel from '../components/rom/RomCalibrationPanel.vue'
import { motionProfileService, sensorService, updateInstallGuard } from '../app/AppServices'
import { profileFromMeasuredRange } from '../core/motion/MotionProfile'

const router = useRouter()
const step = ref<'device' | 'center' | 'rom'>('device')
const errorMessage = ref('')
let unsubscribe: (() => void) | null = null
let releaseUpdateLock: (() => void) | null = null

// 已绑定设备在后台恢复连接后可自动进入中心准备，不要求再次手动选择。
onMounted(() => {
  releaseUpdateLock = updateInstallGuard.acquire('first-run-setup')
  unsubscribe = sensorService.onSnapshot((snapshot) => { if (step.value === 'device' && snapshot.state === 'connected') step.value = 'center' })
})
onBeforeUnmount(() => { unsubscribe?.(); releaseUpdateLock?.() })
function deviceConnected(): void { step.value = 'center' }
function centerCompleted(): void { step.value = 'rom' }
async function romCompleted(range: Parameters<typeof profileFromMeasuredRange>[0]): Promise<void> {
  try { await motionProfileService.save(profileFromMeasuredRange(range, motionProfileService.getCurrent())); await router.replace('/games') }
  catch (error) { errorMessage.value = error instanceof Error ? error.message : String(error) }
}
</script>

<template><main class="content-page setup-page"><p class="eyebrow">首次设置 · {{ step === 'device' ? '1' : step === 'center' ? '2' : '3' }} / 3</p><h1>{{ step === 'device' ? '连接训练设备' : step === 'center' ? '确认自然中心' : '设置个人活动范围' }}</h1><p class="muted">{{ step === 'device' ? '请选择用于训练的设备。' : step === 'center' ? 'ROM 测量需要先确认自然中心位置。' : '此步骤通常只需完成一次，以后可在设置中重新测量。' }}</p><DeviceConnectionPanel v-if="step === 'device'" @connected="deviceConnected" /><CenterCalibrationGuide v-else-if="step === 'center'" @completed="centerCompleted" /><RomCalibrationPanel v-else @completed="romCompleted" @cancelled="step = 'center'" /><p v-if="errorMessage" class="error">{{ errorMessage }}</p></main></template>
