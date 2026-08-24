<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, toRaw, watch } from 'vue'
import type { TrainingRecord } from '../../core/training/TrainingRecord'
import { TargetReachReplayPlayer, type ReplayMode, type ReplayPlayerSnapshot } from '../../games/target-reach/replay/TargetReachReplayPlayer'

const props = defineProps<{ record: TrainingRecord }>()
const host = ref<HTMLElement | null>(null)
const mode = ref<ReplayMode>('dynamic')
const player = new TargetReachReplayPlayer()
const snapshot = ref<ReplayPlayerSnapshot>(player.getSnapshot())
const loadError = ref('')
let unsubscribe: (() => void) | null = null

// 面板只加载已持久化 Replay；旧记录保持可查看但不创建播放器。
onMounted(async () => { await mountPlayer() })
onBeforeUnmount(() => { unsubscribe?.(); player.destroy() })
watch(() => props.record, () => { void mountPlayer() })
watch(mode, (next) => { player.setMode(next) })

async function mountPlayer(): Promise<void> {
  const replay = props.record.replay
  if (!replay) return
  loadError.value = ''
  unsubscribe?.()
  unsubscribe = null
  player.destroy()
  await nextTick()
  if (!host.value) return
  try {
    await player.mount(host.value)
    unsubscribe = player.onChanged((next) => { snapshot.value = next })
    // Props 会被 Vue 深度代理；先解包，播放器仍会创建自己的基础值副本。
    player.load(toRaw(replay))
    player.setMode(mode.value)
  } catch (error) {
    unsubscribe?.()
    unsubscribe = null
    player.destroy()
    loadError.value = error instanceof Error ? `回放数据加载失败：${error.message}` : '回放数据加载失败，请稍后重试。'
  }
}
function toggle(): void { snapshot.value.state === 'playing' ? player.pause() : player.play() }
function seek(event: Event): void { player.seek(Number((event.target as HTMLInputElement).value)) }
function format(value: number): string { const seconds = Math.floor(value / 1000); return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}` }
</script>

<template>
  <section class="replay-panel"><template v-if="record.replay && !loadError"><div class="replay-tabs"><button class="button" :class="{ primary: mode === 'dynamic' }" @click="mode = 'dynamic'">动态回放</button><button class="button" :class="{ primary: mode === 'trajectory' }" @click="mode = 'trajectory'">完整轨迹</button></div><div ref="host" class="replay-host"></div><div v-if="mode === 'dynamic'" class="replay-controls"><button class="button primary" @click="toggle">{{ snapshot.state === 'playing' ? '暂停' : '播放' }}</button><button class="button" @click="player.restart()">重新开始</button><input type="range" min="0" :max="snapshot.durationMs" :value="snapshot.currentTimeMs" @input="seek"><span>{{ format(snapshot.currentTimeMs) }} / {{ format(snapshot.durationMs) }}</span><div class="row"><button v-for="rate in [0.5, 1, 2]" :key="rate" class="button" :class="{ primary: snapshot.playbackRate === rate }" @click="player.setPlaybackRate(rate)">{{ rate }}x</button></div></div><p v-else class="muted small">蓝线为完整二维路径；绿色目标为成功，红色目标为超时或失败。</p></template><p v-else-if="loadError" class="error replay-empty">{{ loadError }}</p><p v-else class="muted replay-empty">该训练记录创建于轨迹回放功能启用前，暂无训练轨迹数据。</p></section>
</template>
