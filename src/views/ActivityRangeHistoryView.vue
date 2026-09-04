<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { activityRangeHistoryService } from '../app/AppServices'
import ActivityRangeHistoryCard from '../components/activity-range/ActivityRangeHistoryCard.vue'
import ActivityRangeTrendChart from '../components/activity-range/ActivityRangeTrendChart.vue'
import { buildActivityRangeLatestSummary } from '../core/motion/history/ActivityRangeHistoryPresentation'
import type { ActivityRangeHistoryRecord } from '../core/motion/history/ActivityRangeHistoryRecord'

const router = useRouter()
const records = ref<ActivityRangeHistoryRecord[]>([])
const loading = ref(true)
const errorMessage = ref('')
const latestSummary = computed(() => buildActivityRangeLatestSummary(records.value))

onMounted(() => { void load() })

/** 历史页面等待后台恢复任务，避免首次打开时短暂显示为空。 */
async function load(): Promise<void> {
  loading.value = true
  try {
    await activityRangeHistoryService.recoverLegacyIfNeeded().catch(() => undefined)
    records.value = await activityRangeHistoryService.getAll()
    errorMessage.value = ''
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error)
  } finally {
    loading.value = false
  }
}

function formatDate(value: number): string {
  return new Date(value).toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

function range(value: number): string { return `${value.toFixed(1)}°` }

function delta(value: number | null): string {
  if (value === null) return '暂无上次数据'
  if (Math.abs(value) < 0.05) return '较上次 0.0°'
  return `较上次 ${value > 0 ? '+' : ''}${value.toFixed(1)}°`
}
</script>

<template>
  <main class="content-page activity-range-history-page">
    <p class="eyebrow">个人活动范围</p>
    <h1>个人活动范围历史</h1>
    <p class="muted">这里记录每次完整保存的实测数据，仅展示数值变化，不代表康复结论。</p>
    <button class="button activity-range-back" type="button" @click="router.push('/settings')">← 返回设置</button>

    <p v-if="errorMessage" class="error">加载个人活动范围历史失败：{{ errorMessage }}</p>
    <p v-if="loading" class="muted activity-range-empty">正在加载历史数据…</p>
    <section v-else-if="!records.length" class="card activity-range-empty">
      <h2>暂无个人活动范围历史数据</h2>
      <p class="muted">完成一次个人活动范围测量并保存后，这里会自动记录。</p>
      <button class="button primary" type="button" @click="router.push('/rom-calibration?source=settings')">开始测量</button>
    </section>

    <template v-else>
      <section v-if="latestSummary" class="card activity-range-latest">
        <div><p class="eyebrow">最近测量</p><h2>{{ formatDate(latestSummary.measuredAt) }}</h2></div>
        <div class="activity-range-latest-grid">
          <article v-for="item in latestSummary.items" :key="item.id">
            <span>{{ item.label }}</span>
            <strong>{{ range(item.value) }}</strong>
            <small>{{ delta(item.delta) }}</small>
          </article>
        </div>
      </section>

      <section class="card activity-range-trend-section">
        <h2>活动范围变化趋势</h2>
        <p class="muted small">趋势图使用每次实测活动范围，不受训练比例调整影响。</p>
        <ActivityRangeTrendChart :records="records" />
      </section>

      <section class="activity-range-records">
        <h2>历史测量记录</h2>
        <div class="activity-range-history-table-wrap">
          <table class="activity-range-history-table">
            <thead><tr><th>测量时间</th><th>向前</th><th>向后</th><th>向左</th><th>向右</th><th>训练比例</th></tr></thead>
            <tbody><tr v-for="record in records" :key="record.id"><td>{{ formatDate(record.measuredAt) }}</td><td>{{ range(record.measuredRange.forwardMax) }}</td><td>{{ range(record.measuredRange.backwardMax) }}</td><td>{{ range(record.measuredRange.leftMax) }}</td><td>{{ range(record.measuredRange.rightMax) }}</td><td>{{ (record.trainingRatio * 100).toFixed(0) }}%</td></tr></tbody>
          </table>
        </div>
        <div class="activity-range-history-cards"><ActivityRangeHistoryCard v-for="record in records" :key="record.id" :record="record" /></div>
      </section>
    </template>
  </main>
</template>

<style scoped>
.activity-range-back { margin: 14px 0 20px; }
.activity-range-empty { margin-top: 22px; text-align: center; }
.activity-range-latest, .activity-range-trend-section { margin-top: 18px; }
.activity-range-latest h2 { margin: 5px 0 0; font-size: 19px; }
.activity-range-latest-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 11px; margin-top: 18px; }
.activity-range-latest article { padding: 14px; border-radius: 11px; background: #0a1727; }
.activity-range-latest span, .activity-range-latest strong, .activity-range-latest small { display: block; }
.activity-range-latest span, .activity-range-latest small { color: #91a3ba; }
.activity-range-latest strong { margin: 6px 0; color: #8fd8ff; font-size: 23px; }
.activity-range-trend-section h2, .activity-range-records h2 { margin-top: 0; }
.activity-range-records { margin-top: 24px; }
.activity-range-history-table-wrap { overflow-x: auto; border: 1px solid #263952; border-radius: 14px; background: rgba(15, 27, 44, .86); }
.activity-range-history-table { width: 100%; min-width: 760px; border-collapse: collapse; }
.activity-range-history-table th, .activity-range-history-table td { padding: 13px 16px; border-bottom: 1px solid rgba(52, 80, 111, .52); text-align: left; white-space: nowrap; }
.activity-range-history-table th { color: #91a3ba; font-size: 13px; }
.activity-range-history-table tbody tr:last-child td { border-bottom: 0; }
.activity-range-history-table tbody tr:hover { background: rgba(32, 58, 88, .38); }
.activity-range-history-cards { display: none; gap: 12px; }
@media (max-width: 767px) {
  .activity-range-latest-grid { grid-template-columns: repeat(2, 1fr); }
  .activity-range-history-table-wrap { display: none; }
  .activity-range-history-cards { display: grid; }
  .activity-range-trend-section { padding-inline: 12px; }
}
</style>
