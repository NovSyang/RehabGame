<script setup lang="ts">
import { ref } from 'vue'
import { connectionManager, motionProfileService, resetMotionProfile } from '../app/AppServices'

const message = ref('')
// 每个不可逆本地操作都单独确认，避免误删其它训练数据。
async function resetProfile(): Promise<void> { if (!window.confirm('确认重置个人 ROM 配置为默认值吗？')) return; await resetMotionProfile(); message.value = '已重置 MotionProfile，并立即应用默认 ROM。' }
async function forgetDevice(): Promise<void> { if (!window.confirm('确认忘记上次连接的设备吗？')) return; await connectionManager.forgetBinding(); message.value = '已忘记设备绑定。' }
</script>

<template><main class="content-page"><p class="eyebrow">Settings</p><h1>设置</h1><section class="card"><h2>当前 MotionProfile</h2><p class="muted">{{ motionProfileService.getCurrent().name }} · 训练比例 {{ (motionProfileService.getCurrent().trainingRatio * 100).toFixed(0) }}%</p><button class="button danger" @click="resetProfile">重置 MotionProfile</button></section><section class="card"><h2>设备绑定</h2><p class="muted">{{ connectionManager.getSnapshot().binding?.name ?? '未保存设备绑定' }}</p><button class="button danger" :disabled="!connectionManager.getSnapshot().binding" @click="forgetDevice">忘记设备</button></section><p v-if="message" class="muted">{{ message }}</p></main></template>
