<script setup lang="ts">
import { computed } from 'vue'
import type { GuidedRomPhase } from '../../core/motion/GuidedRomWorkflow'
import type { RomDirection } from '../../core/motion/RomCalibrationState'

const props = defineProps<{
  phase: GuidedRomPhase
  stepIndex: number
  totalSteps: number
  completedDirections: RomDirection[]
}>()

const steps = [
  { key: 'center', label: '自然中心' },
  { key: 'forward', label: '向前' },
  { key: 'backward', label: '向后' },
  { key: 'left', label: '向左' },
  { key: 'right', label: '向右' },
] as const

const allCompleted = computed(() => props.phase === 'summary' || props.phase === 'saving')

/** 中心完成由当前步骤判断，四方向完成则读取 Workflow 的已接受结果。 */
function isCompleted(index: number, key: string): boolean {
  if (allCompleted.value) return true
  if (index === 0) return props.stepIndex > 0
  return props.completedDirections.includes(key as RomDirection)
}
</script>

<template>
  <nav class="rom-stepper" aria-label="个人活动范围测量进度">
    <div class="rom-stepper-desktop">
      <div
        v-for="(step, index) in steps"
        :key="step.key"
        class="rom-step"
        :data-active="stepIndex === index && !allCompleted"
        :data-completed="isCompleted(index, step.key)"
      >
        <span class="rom-step-dot">{{ isCompleted(index, step.key) ? '✓' : index + 1 }}</span>
        <small>{{ step.label }}</small>
      </div>
    </div>
    <div class="rom-stepper-mobile">
      <strong>{{ allCompleted ? '测量完成' : `第 ${stepIndex + 1}/${totalSteps} 步` }}</strong>
      <span class="rom-mobile-dots" aria-hidden="true">
        <i v-for="(_, index) in steps" :key="index" :data-active="index === stepIndex" :data-completed="isCompleted(index, steps[index].key)" />
      </span>
    </div>
  </nav>
</template>

<style scoped>
.rom-stepper { width: 100%; margin-bottom: 22px; }
.rom-stepper-desktop { display: grid; grid-template-columns: repeat(5, 1fr); }
.rom-step { position: relative; display: grid; justify-items: center; gap: 7px; color: #6f829b; }
.rom-step:not(:last-child)::after { content: ''; position: absolute; top: 15px; left: calc(50% + 22px); right: calc(-50% + 22px); height: 2px; background: #263952; }
.rom-step[data-completed="true"]:not(:last-child)::after { background: #4f9c7b; }
.rom-step-dot { position: relative; z-index: 1; width: 32px; height: 32px; display: grid; place-items: center; border: 2px solid #34506f; border-radius: 50%; background: #0a1727; font-size: 13px; font-weight: 800; }
.rom-step[data-active="true"] { color: #8fd8ff; }
.rom-step[data-active="true"] .rom-step-dot { border-color: #69bdf0; box-shadow: 0 0 0 5px rgba(105, 189, 240, .12); }
.rom-step[data-completed="true"] { color: #8fdab0; }
.rom-step[data-completed="true"] .rom-step-dot { border-color: #68d391; background: #235341; color: #dffff0; }
.rom-stepper-mobile { display: none; }
.rom-mobile-dots { display: flex; gap: 7px; }
.rom-mobile-dots i { width: 9px; height: 9px; border-radius: 99px; background: #34506f; }
.rom-mobile-dots i[data-active="true"] { width: 24px; background: #69bdf0; }
.rom-mobile-dots i[data-completed="true"] { background: #68d391; }

@media (max-width: 767px) {
  .rom-stepper-desktop { display: none; }
  .rom-stepper-mobile { display: flex; align-items: center; justify-content: space-between; gap: 16px; color: #b8c6d8; }
}
</style>
