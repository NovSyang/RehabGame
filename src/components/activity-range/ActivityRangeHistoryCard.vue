<script setup lang="ts">
import type { ActivityRangeHistoryRecord } from '../../core/motion/history/ActivityRangeHistoryRecord'

defineProps<{ record: ActivityRangeHistoryRecord }>()

function formatDate(value: number): string {
  return new Date(value).toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

function range(value: number): string { return `${value.toFixed(1)}°` }
</script>

<template>
  <article class="card activity-range-history-card">
    <strong>{{ formatDate(record.measuredAt) }}</strong>
    <div class="activity-range-history-card-grid">
      <span><small>向前</small><b>{{ range(record.measuredRange.forwardMax) }}</b></span>
      <span><small>向后</small><b>{{ range(record.measuredRange.backwardMax) }}</b></span>
      <span><small>向左</small><b>{{ range(record.measuredRange.leftMax) }}</b></span>
      <span><small>向右</small><b>{{ range(record.measuredRange.rightMax) }}</b></span>
    </div>
    <p class="muted small">当时训练比例 {{ (record.trainingRatio * 100).toFixed(0) }}%</p>
  </article>
</template>

<style scoped>
.activity-range-history-card { display: grid; gap: 13px; }
.activity-range-history-card-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 9px; }
.activity-range-history-card-grid span { padding: 10px; border-radius: 9px; background: #0a1727; }
.activity-range-history-card-grid small, .activity-range-history-card-grid b { display: block; }
.activity-range-history-card-grid small { color: #91a3ba; }
.activity-range-history-card-grid b { margin-top: 4px; color: #8fd8ff; }
.activity-range-history-card p { margin: 0; }
</style>
