<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, toRaw, watch } from 'vue'
import { backActionCoordinator, displayService } from '../../app/AppServices'
import { BACK_ACTION_PRIORITY } from '../../core/navigation/BackActionCoordinator'
import type { ITrainingReplayPlayer, ReplayMode, ReplayPlayerSnapshot } from '../../core/replay/ITrainingReplayPlayer'
import type { TrainingRecord } from '../../core/training/TrainingRecord'
import { getGameModule } from '../../games/GameRegistry'

const props = defineProps<{ record: TrainingRecord }>()
const emit = defineEmits<{ expandedChanged: [expanded: boolean] }>()
const host = ref<HTMLElement | null>(null)
const fullscreenRoot = ref<HTMLElement | null>(null)
const expandButton = ref<HTMLButtonElement | null>(null)
const mode = ref<ReplayMode>('dynamic')
const expanded = ref(false)
const snapshot = ref<ReplayPlayerSnapshot>(emptySnapshot())
const loadError = ref('')
const unavailableMessage = ref('')
const ready = ref(false)
const legendItems = computed(() => getReplayLegend(props.record.gameId, mode.value))
let player: ITrainingReplayPlayer | null = null
let unsubscribe: (() => void) | null = null
let unregisterFullscreenBack: (() => void) | null = null
let focusFrameId: number | null = null
let mountVersion = 0
let fullscreenVersion = 0
let unmounted = false
let exitPromise: Promise<void> | null = null

onMounted(async () => { unmounted = false; await mountPlayer() })
onBeforeUnmount(() => {
  unmounted = true
  mountVersion++
  fullscreenVersion++
  if (focusFrameId !== null) cancelAnimationFrame(focusFrameId)
  unregisterFullscreenBack?.()
  unregisterFullscreenBack = null
  document.body.classList.remove('replay-fullscreen-open')
  if (expanded.value) void displayService.unlockOrientation().catch(() => undefined)
  cleanupPlayer()
})

watch(() => props.record, async () => {
  // 切换记录前先退出全屏，避免旧记录的方向锁和 Teleport 状态残留。
  await exitFullscreen(false)
  if (!unmounted) await mountPlayer()
})
watch(mode, (next) => player?.setMode(next))

/** 每次切换记录都新建对应游戏播放器，展开全屏本身不会执行此方法。 */
async function mountPlayer(): Promise<void> {
  const version = ++mountVersion
  cleanupPlayer()
  snapshot.value = emptySnapshot()
  loadError.value = ''
  unavailableMessage.value = ''
  const replay = props.record.replay
  if (!replay) return
  const module = getGameModule(props.record.gameId)
  if (!module) { unavailableMessage.value = '当前版本无法识别该游戏，暂不能播放历史轨迹。'; return }
  // 历史配置也可能被 Vue 代理；播放器只接收解包后的普通配置值。
  const config = props.record.gameConfig
  const rawConfig = typeof config === 'object' && config !== null ? toRaw(config) : config
  const candidate = module.createReplayPlayer(rawConfig)
  if (!candidate) { unavailableMessage.value = '当前游戏暂不支持历史回放。'; return }
  player = candidate
  await nextTick()
  if (unmounted || version !== mountVersion || !host.value) { discardCandidate(candidate); return }
  try {
    await candidate.mount(host.value)
    if (unmounted || version !== mountVersion) { discardCandidate(candidate); return }
    // Vue Props 会被深度代理；播放器内部还会生成受限的独立普通对象快照。
    candidate.load(toRaw(replay))
    candidate.setMode(mode.value)
    unsubscribe = candidate.onChanged((next) => { snapshot.value = next })
    ready.value = true
  } catch (error) {
    discardCandidate(candidate)
    if (version === mountVersion && !unmounted) {
      loadError.value = error instanceof Error ? `回放数据加载失败：${error.message}` : '回放数据加载失败，请稍后重试。'
    }
  }
}

/** 全屏只移动现有 DOM，不创建第二个播放器，也不改变当前播放状态。 */
async function enterFullscreen(): Promise<void> {
  if (!ready.value || expanded.value || unmounted) return
  const version = ++fullscreenVersion
  expanded.value = true
  document.body.classList.add('replay-fullscreen-open')
  unregisterFullscreenBack = backActionCoordinator.register(BACK_ACTION_PRIORITY.replayFullscreen, () => exitFullscreen())
  emit('expandedChanged', true)
  try { await displayService.lockLandscape() }
  catch { /* 方向锁属于体验增强，失败时仍保留应用内全屏。 */ }
  if (unmounted || version !== fullscreenVersion || !expanded.value) {
    // 如果退出发生在锁屏请求完成前，再解除一次，避免 Android 留在横屏锁定状态。
    await displayService.unlockOrientation().catch(() => undefined)
    return
  }
  await nextTick()
  focusFrameId = requestAnimationFrame(() => { focusFrameId = null; fullscreenRoot.value?.focus() })
}

/** 解除方向锁失败也必须退出 Overlay，并恢复历史详情交互。 */
function exitFullscreen(restoreFocus = true): Promise<void> {
  if (!expanded.value) return Promise.resolve()
  if (exitPromise) return exitPromise
  const version = ++fullscreenVersion
  exitPromise = (async () => {
    try { await displayService.unlockOrientation() }
    catch { /* 系统拒绝解除方向锁时，仍继续关闭应用内全屏。 */ }
    finally {
      if (version === fullscreenVersion && !unmounted) {
        expanded.value = false
        unregisterFullscreenBack?.()
        unregisterFullscreenBack = null
        document.body.classList.remove('replay-fullscreen-open')
        emit('expandedChanged', false)
        await nextTick()
        if (restoreFocus) focusFrameId = requestAnimationFrame(() => { focusFrameId = null; expandButton.value?.focus() })
      }
      exitPromise = null
    }
  })()
  return exitPromise
}

function cleanupPlayer(): void {
  unsubscribe?.()
  unsubscribe = null
  player?.destroy()
  player = null
  ready.value = false
}

function discardCandidate(candidate: ITrainingReplayPlayer): void {
  candidate.destroy()
  if (player === candidate) player = null
}

function toggle(): void { snapshot.value.state === 'playing' ? player?.pause() : player?.play() }
function restart(): void { player?.restart() }
function setRate(rate: number): void { player?.setPlaybackRate(rate) }
function seek(event: Event): void { player?.seek(Number((event.target as HTMLInputElement).value)) }
function format(value: number): string { const seconds = Math.floor(value / 1_000); return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}` }
function emptySnapshot(): ReplayPlayerSnapshot { return { state: 'idle', currentTimeMs: 0, durationMs: 0, playbackRate: 1 } }

/** 图例只说明已经保存的画面事实，不参与任何游戏判定。 */
function getReplayLegend(gameId: string, replayMode: ReplayMode): string[] {
  if (gameId === 'target-reach') return replayMode === 'dynamic'
    ? ['薄荷绿：患者当前位置与本目标轨迹', '蓝色圆环：当前目标']
    : ['浅蓝线：完整移动轨迹', '绿色目标：成功', '珊瑚色目标：失败']
  if (gameId === 'trajectory-follow') return ['蓝色：参考路径', '薄荷绿：患者实际轨迹']
  if (gameId === 'river') return replayMode === 'dynamic'
    ? ['浅色尾迹：小船最近航行路径', '蓝色区域：训练河道']
    : ['浅色轨迹：完整航行路径']
  return []
}
</script>

<template>
  <Teleport to="body" :disabled="!expanded">
    <section
      ref="fullscreenRoot"
      class="replay-panel"
      :class="{
        'replay-panel--fullscreen': expanded,
        'replay-panel--dynamic': mode === 'dynamic',
        'replay-panel--trajectory': mode === 'trajectory',
      }"
      :role="expanded ? 'dialog' : undefined"
      :aria-modal="expanded ? 'true' : undefined"
      :aria-label="expanded ? `${record.gameName}轨迹全屏回放` : undefined"
      :tabindex="expanded ? -1 : undefined"
      @keydown.esc.stop.prevent="exitFullscreen()"
    >
      <template v-if="record.replay && !loadError && !unavailableMessage">
        <div class="replay-toolbar">
          <strong v-if="expanded" class="replay-fullscreen-title">{{ record.gameName }}</strong>
          <div class="replay-tabs">
            <button class="button" :class="{ primary: mode === 'dynamic' }" @click="mode = 'dynamic'">{{ expanded ? '动态' : '动态回放' }}</button>
            <button class="button" :class="{ primary: mode === 'trajectory' }" @click="mode = 'trajectory'">{{ expanded ? '轨迹' : '完整轨迹' }}</button>
          </div>
          <button v-if="ready" ref="expandButton" class="button replay-expand-button" @click="expanded ? exitFullscreen() : enterFullscreen()">
            {{ expanded ? '退出' : '展开全屏' }}
          </button>
        </div>
        <div ref="host" class="replay-host"></div>
        <div v-if="ready && mode === 'dynamic'" class="replay-controls">
          <button class="button primary" @click="toggle">{{ snapshot.state === 'playing' ? '暂停' : '播放' }}</button>
          <button class="button" @click="restart">{{ expanded ? '重置' : '重新开始' }}</button>
          <input class="replay-timeline" type="range" min="0" :max="snapshot.durationMs" :value="snapshot.currentTimeMs" aria-label="回放进度" @input="seek">
          <span class="replay-time">{{ format(snapshot.currentTimeMs) }} / {{ format(snapshot.durationMs) }}</span>
          <div class="row replay-rate-buttons"><button v-for="rate in [0.5, 1, 2]" :key="rate" class="button" :class="{ primary: snapshot.playbackRate === rate }" @click="setRate(rate)">{{ rate }}x</button></div>
        </div>
        <p v-else-if="ready && !expanded" class="muted small">完整轨迹展示训练当时保存的二维运动事实，不重新执行游戏判定。</p>
        <div v-if="ready && expanded && legendItems.length" class="replay-legend" aria-label="轨迹图例"><span v-for="item in legendItems" :key="item">{{ item }}</span></div>
      </template>
      <p v-else-if="loadError" class="error replay-empty">{{ loadError }}</p>
      <p v-else-if="unavailableMessage" class="muted replay-empty">{{ unavailableMessage }}</p>
      <p v-else class="muted replay-empty">该训练记录创建于轨迹回放功能启用前，暂无训练轨迹数据。</p>
    </section>
  </Teleport>
</template>
