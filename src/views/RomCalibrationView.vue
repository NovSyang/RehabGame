<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import GuidedRomCalibrationFlow from '../components/rom/GuidedRomCalibrationFlow.vue'
import { persistActivityRangeMeasurement, updateInstallGuard } from '../app/AppServices'
import type { MotionRange } from '../core/motion/MotionConfig'

const router = useRouter()
const route = useRoute()
const source = computed(() => route.query.source === 'settings' ? 'settings' : 'setup')
let releaseUpdateLock: (() => void) | null = null

// 整个 ROM 流程禁止启动安装器，避免中心或样本采集被系统页面中断。
onMounted(() => { releaseUpdateLock = updateInstallGuard.acquire('rom-calibration') })
onBeforeUnmount(() => releaseUpdateLock?.())

/** 从设置重新测量时，旧 Profile 一直保留到汇总页明确保存。 */
async function persist(range: MotionRange): Promise<void> {
  await persistActivityRangeMeasurement(range, source.value === 'settings' ? 'settings-remeasurement' : 'first-run')
  await router.replace(source.value === 'settings' ? '/settings' : '/games')
}
function cancel(): void { void router.replace(source.value === 'settings' ? '/settings' : '/games') }
</script>

<template>
  <main class="content-page rom-calibration-page">
    <p class="eyebrow">个人活动范围</p>
    <h1>个人活动范围测量</h1>
    <GuidedRomCalibrationFlow :persist="persist" @cancelled="cancel" />
  </main>
</template>
