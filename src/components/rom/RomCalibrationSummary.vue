<script setup lang="ts">
import type { MotionRange } from '../../core/motion/MotionConfig'

defineProps<{ range: MotionRange; saving: boolean; errorMessage?: string | null }>()
const emit = defineEmits<{ save: [] }>()

/** 汇总仅展示最终四方向结果，不在此处计算或保存 Profile。 */
function format(value: number): string {
  return `${value.toFixed(1)}°`
}
</script>

<template>
  <section class="rom-summary">
    <div class="rom-success-mark" aria-hidden="true">✓</div>
    <h2>测量完成</h2>
    <p class="muted">请确认本次个人活动范围，保存后将自动设置安全训练范围。</p>
    <div class="rom-summary-grid">
      <div><span>向前</span><strong>{{ format(range.forwardMax) }}</strong></div>
      <div><span>向后</span><strong>{{ format(range.backwardMax) }}</strong></div>
      <div><span>向左</span><strong>{{ format(range.leftMax) }}</strong></div>
      <div><span>向右</span><strong>{{ format(range.rightMax) }}</strong></div>
    </div>
    <p v-if="errorMessage" class="error rom-summary-error">{{ errorMessage }}</p>
    <button class="button primary rom-primary-action" :disabled="saving" @click="emit('save')">
      {{ saving ? '正在保存…' : '保存并完成' }}
    </button>
  </section>
</template>

<style scoped>
.rom-summary { text-align: center; }
.rom-summary h2 { margin: 12px 0 8px; }
.rom-success-mark { width: 64px; height: 64px; display: grid; place-items: center; margin: 0 auto; border: 2px solid #68d391; border-radius: 50%; background: rgba(104, 211, 145, .12); color: #8fe2b1; font-size: 34px; font-weight: 900; }
.rom-summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 24px 0; }
.rom-summary-grid div { padding: 16px; border: 1px solid #2d4967; border-radius: 13px; background: #0a1727; }
.rom-summary-grid span, .rom-summary-grid strong { display: block; }
.rom-summary-grid span { color: #91a3ba; font-size: 13px; }
.rom-summary-grid strong { margin-top: 7px; color: #8fd8ff; font-size: 23px; }
.rom-summary-error { margin: 0 0 14px; }
.rom-primary-action { width: min(320px, 100%); min-height: 52px; }

@media (max-width: 600px) {
  .rom-summary-grid { grid-template-columns: repeat(2, 1fr); }
}
</style>
