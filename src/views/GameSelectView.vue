<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getGameDefinitions } from '../games/GameRegistry'

const route = useRoute()
const router = useRouter()
const games = getGameDefinitions()
const routeError = computed(() => route.query.error === 'game-unavailable' ? '该训练游戏不存在或尚未开放。' : '')

/** 游戏卡片只使用 Registry 元数据，不包含具体游戏分支。 */
function selectGame(id: string): void { void router.push(`/training/${id}`) }
</script>

<template>
  <main class="content-page">
    <p class="eyebrow">训练选择</p><h1>选择训练游戏</h1>
    <p v-if="routeError" class="error">{{ routeError }}</p>
    <div class="game-list"><article v-for="game in games" :key="game.id" class="card"><h2>{{ game.name }}</h2><p class="muted">{{ game.description }}</p><button class="button primary" :disabled="!game.enabled" @click="selectGame(game.id)">{{ game.enabled ? '开始训练' : '暂未开放' }}</button></article></div>
  </main>
</template>
