<script setup lang="ts">
import { computed } from 'vue'
import type { RomDirection } from '../../core/motion/RomCalibrationState'

type IllustrationMode = 'center' | 'return-center' | RomDirection

const props = defineProps<{ mode: IllustrationMode }>()

const label = computed(() => ({
  center: '保持设备位于自然中心',
  'return-center': '缓慢回到自然中心',
  forward: '缓慢向前活动',
  backward: '缓慢向后活动',
  left: '缓慢向左活动',
  right: '缓慢向右活动',
})[props.mode])

const arrow = computed(() => ({
  forward: { x1: 130, y1: 93, x2: 130, y2: 31 },
  backward: { x1: 130, y1: 107, x2: 130, y2: 169 },
  left: { x1: 119, y1: 100, x2: 48, y2: 100 },
  right: { x1: 141, y1: 100, x2: 212, y2: 100 },
}[props.mode as RomDirection] ?? null))
</script>

<template>
  <figure class="rom-illustration" :aria-label="label">
    <svg viewBox="0 0 260 200" role="img">
      <defs>
        <marker id="rom-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill="#8fd8ff" />
        </marker>
      </defs>
      <circle class="safe-ring" cx="130" cy="100" r="73" />
      <circle v-if="mode === 'center'" class="center-pulse" cx="130" cy="100" r="42" />
      <g v-if="mode === 'return-center'" class="return-arrows">
        <path d="M130 30 V70" /><path d="M130 170 V130" />
        <path d="M48 100 H90" /><path d="M212 100 H170" />
      </g>
      <line
        v-if="arrow"
        class="direction-arrow"
        :x1="arrow.x1" :y1="arrow.y1" :x2="arrow.x2" :y2="arrow.y2"
        marker-end="url(#rom-arrow)"
      />
      <g class="sensor-device">
        <rect x="103" y="72" width="54" height="56" rx="16" />
        <circle cx="130" cy="91" r="7" />
        <path d="M116 111 H144" />
      </g>
    </svg>
    <figcaption>{{ label }}</figcaption>
  </figure>
</template>

<style scoped>
.rom-illustration { width: min(360px, 100%); margin: 2px auto 18px; text-align: center; }
.rom-illustration svg { width: 100%; max-height: 230px; overflow: visible; }
.safe-ring { fill: rgba(26, 64, 91, .3); stroke: #34506f; stroke-width: 2; stroke-dasharray: 7 7; }
.center-pulse { fill: rgba(104, 211, 145, .08); stroke: #68d391; stroke-width: 2; }
.sensor-device rect { fill: #173452; stroke: #8fd8ff; stroke-width: 3; }
.sensor-device circle { fill: #68d391; }
.sensor-device path { fill: none; stroke: #8fd8ff; stroke-width: 3; stroke-linecap: round; }
.direction-arrow { stroke: #8fd8ff; stroke-width: 7; stroke-linecap: round; }
.return-arrows path { fill: none; stroke: #68d391; stroke-width: 6; stroke-linecap: round; }
.rom-illustration figcaption { margin-top: -5px; color: #b8c6d8; font-weight: 700; }
</style>
