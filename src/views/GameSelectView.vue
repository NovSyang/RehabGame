<script setup lang="ts">
import { computed, ref } from 'vue'
import type { GameDefinition } from '../core/game/GameDefinition'
import { useRoute, useRouter } from 'vue-router'
import { getGameDefinitions } from '../games/GameRegistry'

const route = useRoute()
const router = useRouter()
const games = getGameDefinitions()
const routeError = computed(() => route.query.error === 'game-unavailable' ? '该训练游戏不存在或尚未开放。' : '')
const instructionGame = ref<GameDefinition | null>(null)

/** 游戏卡片只使用 Registry 元数据，不包含具体游戏分支。 */
function selectGame(id: string): void { void router.push(`/training/${id}`) }
function replayTutorial(id: string): void { void router.push({ path: `/training/${id}`, query: { tutorial: '1' } }) }
</script>

<template>
  <main class="content-page">
    <p class="eyebrow">训练选择</p><h1>选择训练游戏</h1>
    <p v-if="routeError" class="error">{{ routeError }}</p>
    <div class="game-list"><article v-for="game in games" :key="game.id" class="card game-select-card"><img v-if="game.coverImage" :src="game.coverImage" :alt="`${game.name}封面`" class="game-cover"><div class="game-card-body"><div class="row game-card-title"><h2>{{ game.name }}</h2><span v-if="game.estimatedDuration" class="duration-chip">{{ game.estimatedDuration }}</span></div><p class="muted">{{ game.description }}</p><div class="row"><button class="button primary" :disabled="!game.enabled" @click="selectGame(game.id)">{{ game.enabled ? '开始训练' : '暂未开放' }}</button><button v-if="game.instructions?.length" class="button" @click="instructionGame = game">玩法说明</button></div></div></article></div>
    <div v-if="instructionGame" class="training-dialog-backdrop" @click.self="instructionGame = null"><section class="training-dialog"><p class="eyebrow">玩法说明</p><h2>{{ instructionGame.name }}</h2><div class="instruction-list"><article v-for="item in instructionGame.instructions" :key="item.title"><strong>{{ item.title }}</strong><p>{{ item.description }}</p></article></div><div class="row"><button class="button" @click="instructionGame = null">关闭</button><button v-if="instructionGame.tutorial" class="button" @click="replayTutorial(instructionGame.id)">重看交互引导</button><button class="button primary" @click="selectGame(instructionGame.id)">开始训练</button></div></section></div>
  </main>
</template>
