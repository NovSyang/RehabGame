<script setup lang="ts">
import { useRouter } from 'vue-router'
import { gameDefinitions } from '../core/game/GameDefinition'

const router = useRouter()
// 游戏注册表是唯一入口，第二款正式游戏可直接在此扩展。
function selectGame(id: string): void { if (id === 'target-reach') void router.push('/training/target-reach') }
</script>

<template><main class="content-page"><p class="eyebrow">训练选择</p><h1>选择训练游戏</h1><div class="game-list"><article v-for="game in gameDefinitions" :key="game.id" class="card"><h2>{{ game.name }}</h2><p class="muted">{{ game.description }}</p><button class="button primary" :disabled="!game.enabled" @click="selectGame(game.id)">{{ game.enabled ? '开始训练' : '暂未开放' }}</button></article></div></main></template>
