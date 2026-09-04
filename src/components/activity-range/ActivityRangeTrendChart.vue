<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  ACTIVITY_RANGE_DIRECTIONS,
  buildActivityRangeTrendModel,
  type ActivityRangeDirectionFilter,
  type ActivityRangeTrendPoint,
} from '../../core/motion/history/ActivityRangeHistoryPresentation'
import type { ActivityRangeHistoryRecord } from '../../core/motion/history/ActivityRangeHistoryRecord'

const props = defineProps<{ records: ActivityRangeHistoryRecord[] }>()
const selectedDirection = ref<ActivityRangeDirectionFilter>('all')
const tooltip = ref<{ point: ActivityRangeTrendPoint; label: string; color: string } | null>(null)
const model = computed(() => buildActivityRangeTrendModel(props.records, selectedDirection.value))
const filters: Array<{ id: ActivityRangeDirectionFilter; label: string }> = [
  { id: 'all', label: '全部' },
  ...ACTIVITY_RANGE_DIRECTIONS.map((direction) => ({ id: direction.id, label: direction.label })),
]

/** 切换方向后清除旧提示，避免 Tooltip 指向已经隐藏的数据点。 */
function selectDirection(direction: ActivityRangeDirectionFilter): void {
  selectedDirection.value = direction
  tooltip.value = null
}

function showTooltip(point: ActivityRangeTrendPoint, label: string, color: string): void {
  tooltip.value = { point, label, color }
}

function linePoints(points: ActivityRangeTrendPoint[]): string {
  return points.map((point) => `${point.x},${point.y}`).join(' ')
}

function formatDate(value: number): string {
  return new Date(value).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}

function formatTooltipDate(value: number): string {
  return new Date(value).toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

const tooltipTransform = computed(() => {
  if (!tooltip.value) return ''
  const x = Math.max(102, Math.min(model.value.width - 102, tooltip.value.point.x))
  const y = Math.max(48, tooltip.value.point.y - 17)
  return `translate(${x} ${y})`
})
</script>

<template>
  <section class="activity-range-chart" aria-label="个人活动范围变化趋势">
    <div class="activity-range-chart-filters" aria-label="趋势方向筛选">
      <button
        v-for="filter in filters"
        :key="filter.id"
        class="button"
        :class="{ primary: selectedDirection === filter.id }"
        type="button"
        @click="selectDirection(filter.id)"
      >{{ filter.label }}</button>
    </div>

    <div class="activity-range-chart-scroll">
      <svg :viewBox="`0 0 ${model.width} ${model.height}`" role="img" aria-label="历次实测活动范围折线图">
        <text x="16" y="17" class="axis-title">活动范围（°）</text>
        <g v-for="tick in model.yTicks" :key="tick.value">
          <line :x1="model.plotLeft" :x2="model.plotRight" :y1="tick.y" :y2="tick.y" class="grid-line" />
          <text :x="model.plotLeft - 9" :y="tick.y + 4" class="axis-label" text-anchor="end">{{ tick.value }}</text>
        </g>
        <line :x1="model.plotLeft" :x2="model.plotLeft" :y1="model.plotTop" :y2="model.plotBottom" class="axis-line" />
        <line :x1="model.plotLeft" :x2="model.plotRight" :y1="model.plotBottom" :y2="model.plotBottom" class="axis-line" />

        <g v-for="tick in model.xTicks" :key="tick.measuredAt">
          <line :x1="tick.x" :x2="tick.x" :y1="model.plotBottom" :y2="model.plotBottom + 5" class="axis-line" />
          <text :x="tick.x" :y="model.plotBottom + 20" class="axis-label" text-anchor="middle">{{ formatDate(tick.measuredAt) }}</text>
        </g>

        <g v-for="series in model.series" :key="series.id">
          <polyline v-if="series.points.length > 1" :points="linePoints(series.points)" :stroke="series.color" class="trend-line" />
          <circle
            v-for="point in series.points"
            :key="`${series.id}-${point.recordId}`"
            :cx="point.x"
            :cy="point.y"
            r="5"
            :fill="series.color"
            class="trend-point"
            tabindex="0"
            role="button"
            :aria-label="`${formatTooltipDate(point.measuredAt)} ${series.label} ${point.value.toFixed(1)}度`"
            @mouseenter="showTooltip(point, series.label, series.color)"
            @focus="showTooltip(point, series.label, series.color)"
            @click="showTooltip(point, series.label, series.color)"
          />
        </g>

        <g v-if="tooltip" :transform="tooltipTransform" class="chart-tooltip" pointer-events="none">
          <rect x="-98" y="-32" width="196" height="27" rx="7" />
          <text x="0" y="-14" text-anchor="middle">
            {{ formatTooltipDate(tooltip.point.measuredAt) }} · {{ tooltip.label }} {{ tooltip.point.value.toFixed(1) }}°
          </text>
        </g>
      </svg>
    </div>

    <div class="activity-range-chart-legend" aria-label="方向图例">
      <span v-for="direction in model.series" :key="direction.id"><i :style="{ background: direction.color }"></i>{{ direction.label }}</span>
    </div>
    <p v-if="records.length === 1" class="muted small activity-range-chart-tip">已记录 1 次个人活动范围测量。至少完成两次测量后，即可查看变化趋势。</p>
  </section>
</template>

<style scoped>
.activity-range-chart { min-width: 0; }
.activity-range-chart-filters { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
.activity-range-chart-filters .button { min-height: 40px; }
.activity-range-chart-scroll { width: 100%; overflow: hidden; }
.activity-range-chart svg { display: block; width: 100%; min-width: 0; height: auto; overflow: visible; }
.grid-line { stroke: rgba(73, 105, 141, .35); stroke-width: 1; }
.axis-line { stroke: #526b88; stroke-width: 1.2; }
.axis-label, .axis-title { fill: #91a3ba; font-size: 11px; }
.axis-title { font-weight: 700; }
.trend-line { fill: none; stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; }
.trend-point { stroke: #07101d; stroke-width: 2; cursor: pointer; }
.trend-point:focus { outline: none; stroke: #ffffff; stroke-width: 3; }
.chart-tooltip rect { fill: rgba(7, 16, 29, .94); stroke: #526b88; }
.chart-tooltip text { fill: #edf2f7; font-size: 11px; }
.activity-range-chart-legend { display: flex; flex-wrap: wrap; justify-content: center; gap: 9px 18px; color: #b8c6d8; font-size: 12px; }
.activity-range-chart-legend span { display: inline-flex; align-items: center; gap: 6px; }
.activity-range-chart-legend i { width: 9px; height: 9px; border-radius: 50%; }
.activity-range-chart-tip { margin: 14px 0 0; text-align: center; }
@media (max-width: 767px) {
  .activity-range-chart-filters { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); }
  .activity-range-chart-filters .button { min-width: 0; padding-inline: 4px; }
  /* SVG 使用 viewBox 随容器缩放，手机页面无需产生横向滚动。 */
  .activity-range-chart svg { width: 100%; }
}
</style>
