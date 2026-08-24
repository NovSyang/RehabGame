<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink, RouterView } from 'vue-router'
import { connectionManager, initializeAppServices, transport } from './app/AppServices'

const startupError = ref('')

// 全局只初始化一次服务，页面切换不会中断 BLE 监听或丢失当前 Profile。
onMounted(async () => {
  try { await initializeAppServices() }
  catch (error) { startupError.value = error instanceof Error ? error.message : String(error) }
})

onBeforeUnmount(async () => {
  connectionManager.dispose()
  await transport.dispose()
})
</script>

<template>
  <header class="app-nav">
    <RouterLink to="/device">设备</RouterLink>
    <RouterLink to="/games">训练</RouterLink>
    <RouterLink to="/history">历史</RouterLink>
    <RouterLink to="/settings">设置</RouterLink>
  </header>
  <p v-if="startupError" class="error app-error">{{ startupError }}</p>
  <RouterView />
</template>
