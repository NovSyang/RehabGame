<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { motionProfileService } from '../app/AppServices'
import UpdateSettingsCard from '../components/update/UpdateSettingsCard.vue'

const router = useRouter()
const profile = computed(() => motionProfileService.getCurrent())

// Settings 仅保存长期配置；日常设备连接统一由顶部状态菜单处理。
function range(value: number | undefined): string { return value === undefined ? '--' : `${value.toFixed(1)}°` }
</script>

<template>
  <main class="content-page">
    <p class="eyebrow">Settings</p>
    <h1>设置</h1>
    <section class="card">
      <h2>个人活动范围</h2>
      <template v-if="profile.measuredRange">
        <h3>实测活动范围</h3>
        <div class="settings-range-grid">
          <span>向前 <strong>{{ range(profile.measuredRange.forwardMax) }}</strong></span>
          <span>向后 <strong>{{ range(profile.measuredRange.backwardMax) }}</strong></span>
          <span>向左 <strong>{{ range(profile.measuredRange.leftMax) }}</strong></span>
          <span>向右 <strong>{{ range(profile.measuredRange.rightMax) }}</strong></span>
        </div>
        <h3>当前训练活动范围</h3>
        <div class="settings-range-grid muted">
          <span>向前 <strong>{{ range(profile.activeRange.forwardMax) }}</strong></span>
          <span>向后 <strong>{{ range(profile.activeRange.backwardMax) }}</strong></span>
          <span>向左 <strong>{{ range(profile.activeRange.leftMax) }}</strong></span>
          <span>向右 <strong>{{ range(profile.activeRange.rightMax) }}</strong></span>
        </div>
        <p class="muted small">训练比例 {{ (profile.trainingRatio * 100).toFixed(0) }}% · 死区 {{ profile.horizontalDeadZone }}° / {{ profile.verticalDeadZone }}°</p>
      </template>
      <p v-else class="muted">尚未完成个人活动范围测量。</p>
      <div class="settings-range-actions">
        <button class="button primary" type="button" @click="router.push('/rom-calibration?source=settings')">{{ profile.measuredRange ? '重新测量' : '开始测量' }}</button>
        <button class="button" type="button" @click="router.push('/settings/activity-range-history')">历史数据</button>
      </div>
    </section>
    <UpdateSettingsCard />
    <section class="card"><h2>高级</h2><button class="button" @click="router.push('/settings/debug')">开发者诊断</button></section>
  </main>
</template>

<style scoped>
.settings-range-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin: 10px 0 18px; }
.settings-range-grid span { display: flex; flex-direction: column; gap: 5px; padding: 12px; border-radius: 10px; background: #0a1727; }
.settings-range-grid strong { color: #8fd8ff; font-size: 19px; }
.settings-range-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 18px; }
@media (max-width: 767px) {
  .settings-range-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .settings-range-actions .button { min-height: 48px; }
}
</style>
