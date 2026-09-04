<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { sensorService } from '../../app/AppServices'
import type { MotionRange } from '../../core/motion/MotionConfig'
import { GuidedRomWorkflow, type GuidedRomPhase } from '../../core/motion/GuidedRomWorkflow'
import type { RomDirection } from '../../core/motion/RomCalibrationState'
import type { SensorRuntimeSnapshot } from '../../core/sensor/SensorService'
import RomCalibrationSummary from './RomCalibrationSummary.vue'
import RomDirectionIllustration from './RomDirectionIllustration.vue'
import RomProgressStepper from './RomProgressStepper.vue'

const props = defineProps<{ persist: (range: MotionRange) => Promise<void> }>()
const emit = defineEmits<{ cancelled: [] }>()

const workflow = new GuidedRomWorkflow()
const snapshot = ref(workflow.getSnapshot(Date.now()))
const connected = ref(false)
let timer: number | null = null
let unsubscribe: (() => void) | null = null
let lastProcessedFrameTimestamp: number | null = null

const phase = computed(() => snapshot.value.phase)
const direction = computed(() => snapshot.value.currentDirection)
const finalRange = computed<MotionRange | null>(() => {
  const range = snapshot.value.measuredRange
  if (range.leftMax === undefined || range.rightMax === undefined || range.forwardMax === undefined || range.backwardMax === undefined) return null
  return { leftMax: range.leftMax, rightMax: range.rightMax, forwardMax: range.forwardMax, backwardMax: range.backwardMax }
})

onMounted(() => {
  unsubscribe = sensorService.onSnapshot(handleSensorSnapshot)
  timer = window.setInterval(advanceTime, 50)
})

onBeforeUnmount(() => {
  unsubscribe?.()
  if (timer !== null) window.clearInterval(timer)
  // 离开测量页面时停止可能仍在进行的中心采样，避免 Zero 在后台晚到。
  if (snapshot.value.phase === 'center-calibrating') sensorService.resetCalibration()
})

/** 传感器订阅只负责连接、真实中心完成和相对运动数据的桥接。 */
function handleSensorSnapshot(sensor: SensorRuntimeSnapshot): void {
  const now = Date.now()
  connected.value = sensor.state === 'connected'
  if (!connected.value) {
    lastProcessedFrameTimestamp = null
    if (snapshot.value.phase !== 'saving') workflow.connectionLost(now)
    refresh(now)
    return
  }

  if (snapshot.value.phase === 'center-calibrating' && sensor.gameInput.calibrated) {
    workflow.centerCalibrated(sensor.gameInput.timestamp || now)
  }
  // Battery 等低频状态也会发布 Snapshot，同一姿态帧只能进入测量一次。
  if (
    sensor.frame
    && sensor.frame.timestamp !== lastProcessedFrameTimestamp
    && (snapshot.value.phase === 'direction-measuring' || snapshot.value.phase === 'return-center')
  ) {
    lastProcessedFrameTimestamp = sensor.frame.timestamp
    workflow.addMotionSample(sensorService.motion.getRelativeMotion(sensor.frame), sensor.frame.timestamp)
  }
  refresh(now)
}

/** 倒计时结束后才真正启动中心校准，确保准备阶段不会误采样。 */
function advanceTime(): void {
  const now = Date.now()
  const previous = snapshot.value.phase
  workflow.tick(now)
  const next = workflow.getSnapshot(now).phase
  if (previous !== next && next === 'center-calibrating') {
    sensorService.resetCalibration()
    sensorService.startCalibration()
  } else if (previous === 'center-calibrating' && next === 'center-ready') {
    sensorService.resetCalibration()
  }
  refresh(now)
}

function start(): void {
  const now = Date.now()
  if (!connected.value) workflow.connectionLost(now)
  else workflow.start(now)
  refresh(now)
}

function confirmReady(): void {
  const now = Date.now()
  if (!connected.value) workflow.connectionLost(now)
  else workflow.confirmReady(now)
  refresh(now)
}

function retryDirection(): void {
  workflow.retryDirection(Date.now())
  refresh()
}

function confirmReturnCenter(): void {
  workflow.confirmReturnCenter(Date.now())
  refresh()
}

function restartAfterConnection(): void {
  if (!connected.value) return
  sensorService.resetCalibration()
  workflow.restartAfterConnection(Date.now())
  refresh()
}

function requestCancel(): void {
  const previous = snapshot.value.phase
  workflow.requestCancel(Date.now())
  if (previous === 'center-calibrating') sensorService.resetCalibration()
  refresh()
}

function continueAfterCancel(): void {
  workflow.continueAfterCancel(Date.now())
  refresh()
}

function confirmCancel(): void {
  workflow.discard(Date.now())
  emit('cancelled')
}

async function save(): Promise<void> {
  const range = workflow.beginSaving(Date.now())
  if (!range) return
  refresh()
  try {
    await props.persist(range)
  } catch (error) {
    workflow.saveFailed(error instanceof Error ? error.message : String(error), Date.now())
    refresh()
  }
}

function refresh(now = Date.now()): void {
  snapshot.value = workflow.getSnapshot(now)
}

function directionLabel(value: RomDirection | null): string {
  if (!value) return ''
  return { forward: '向前', backward: '向后', left: '向左', right: '向右' }[value]
}

function directionInstruction(value: RomDirection | null): string {
  if (!value) return ''
  return {
    forward: '准备后请缓慢向前活动，达到舒适的最大位置。',
    backward: '准备后请缓慢向后活动，达到舒适的最大位置。',
    left: '准备后请缓慢向左活动，达到舒适的最大位置。',
    right: '准备后请缓慢向右活动，达到舒适的最大位置。',
  }[value]
}

function illustrationMode(currentPhase: GuidedRomPhase): 'center' | 'return-center' | RomDirection {
  if (currentPhase.startsWith('center')) return 'center'
  if (currentPhase === 'return-center') return 'return-center'
  return direction.value ?? 'center'
}
</script>

<template>
  <section class="card guided-rom-flow">
    <RomProgressStepper
      v-if="phase !== 'intro' && phase !== 'cancel-confirm'"
      :phase="phase"
      :step-index="snapshot.stepIndex"
      :total-steps="snapshot.totalSteps"
      :completed-directions="snapshot.completedDirections"
    />

    <template v-if="phase === 'intro'">
      <div class="rom-intro-icon" aria-hidden="true">↕</div>
      <h2>开始个人活动范围测量</h2>
      <p class="rom-copy">整个过程包含自然中心和前、后、左、右五个步骤。请在舒适、安全的范围内缓慢活动，不需要用力达到极限。</p>
      <div class="rom-safety-tip">测量过程中如有不适，请立即停止并退出。</div>
      <button class="button primary rom-primary-action" @click="start">开始测量</button>
    </template>

    <template v-else-if="phase === 'center-ready'">
      <RomDirectionIllustration mode="center" />
      <h2>确认自然中心</h2>
      <p class="rom-copy">请采用放松、舒适的姿势，将设备保持在自然中心位置。</p>
      <p v-if="snapshot.errorMessage" class="error">{{ snapshot.errorMessage }}</p>
      <button class="button primary rom-primary-action" @click="confirmReady">准备好了</button>
    </template>

    <template v-else-if="phase === 'center-countdown' || phase === 'direction-countdown'">
      <RomDirectionIllustration :mode="illustrationMode(phase)" />
      <p class="muted">请保持准备姿势</p>
      <div class="rom-countdown" aria-live="polite">{{ snapshot.countdown }}</div>
      <p class="rom-copy">倒计时结束后开始测量。</p>
    </template>

    <template v-else-if="phase === 'center-calibrating'">
      <RomDirectionIllustration mode="center" />
      <h2>正在确认自然中心</h2>
      <p class="rom-copy">请保持放松和稳定，暂时不要移动设备。</p>
      <div class="rom-measure-progress"><span :style="{ width: `${snapshot.measurementProgress * 100}%` }" /></div>
    </template>

    <template v-else-if="phase === 'direction-ready'">
      <RomDirectionIllustration :mode="direction ?? 'center'" />
      <p class="rom-step-label">第 {{ snapshot.stepIndex + 1 }}/{{ snapshot.totalSteps }} 步</p>
      <h2>测量{{ directionLabel(direction) }}活动范围</h2>
      <p class="rom-copy">{{ directionInstruction(direction) }}</p>
      <button class="button primary rom-primary-action" @click="confirmReady">准备好了</button>
    </template>

    <template v-else-if="phase === 'direction-measuring'">
      <RomDirectionIllustration :mode="direction ?? 'center'" />
      <h2>请缓慢{{ directionLabel(direction) }}</h2>
      <p class="rom-copy">移动到舒适的最大位置，并保持动作平稳。</p>
      <div class="rom-measure-progress"><span :style="{ width: `${snapshot.measurementProgress * 100}%` }" /></div>
      <strong class="rom-progress-label">正在测量 {{ Math.round(snapshot.measurementProgress * 100) }}%</strong>
    </template>

    <template v-else-if="phase === 'direction-success'">
      <div class="rom-success-mark" aria-hidden="true">✓</div>
      <h2>{{ directionLabel(direction) }}测量完成</h2>
      <strong class="rom-result-value">{{ snapshot.currentResult?.measuredRom.toFixed(1) }}°</strong>
      <p class="rom-copy">{{ direction === 'right' ? '四个方向均已完成，正在生成汇总。' : '请准备缓慢回到自然中心。' }}</p>
    </template>

    <template v-else-if="phase === 'return-center'">
      <RomDirectionIllustration mode="return-center" />
      <h2>请回到自然中心</h2>
      <p class="rom-copy">缓慢将设备恢复到放松、舒适的中心位置，系统会自动识别。</p>
      <p class="muted">正在等待回到中心……</p>
      <button v-if="snapshot.canManualConfirmCenter" class="button rom-primary-action" @click="confirmReturnCenter">我已回到舒适中心</button>
    </template>

    <template v-else-if="phase === 'direction-failed'">
      <RomDirectionIllustration :mode="direction ?? 'center'" />
      <h2>需要重新测量{{ directionLabel(direction) }}</h2>
      <p class="error rom-error-copy">{{ snapshot.errorMessage }}</p>
      <p class="rom-copy">请确认设备连接正常，并在舒适范围内完成完整动作。</p>
      <button class="button primary rom-primary-action" @click="retryDirection">重新测量当前方向</button>
    </template>

    <RomCalibrationSummary
      v-else-if="(phase === 'summary' || phase === 'saving') && finalRange"
      :range="finalRange"
      :saving="phase === 'saving'"
      :error-message="snapshot.errorMessage"
      @save="save"
    />

    <template v-else-if="phase === 'connection-lost'">
      <div class="rom-disconnected-icon" aria-hidden="true">!</div>
      <h2>训练设备已断开</h2>
      <p class="rom-copy">本轮未保存结果已清除。请通过右上角设备状态菜单重新连接或更换设备，然后从自然中心重新开始。</p>
      <button class="button primary rom-primary-action" :disabled="!connected" @click="restartAfterConnection">
        {{ connected ? '重新开始测量' : '等待设备重新连接…' }}
      </button>
    </template>

    <template v-else-if="phase === 'cancel-confirm'">
      <h2>确认退出个人活动范围测量？</h2>
      <p class="rom-copy">当前未保存的测量结果将被清除，已经保存的个人活动范围不会受到影响。</p>
      <div class="rom-confirm-actions">
        <button class="button" @click="continueAfterCancel">继续测量</button>
        <button class="button danger" @click="confirmCancel">退出</button>
      </div>
    </template>

    <button
      v-if="phase !== 'saving' && phase !== 'cancel-confirm'"
      class="rom-exit-action"
      type="button"
      @click="requestCancel"
    >退出测量</button>
  </section>
</template>

<style scoped>
.guided-rom-flow { width: min(780px, 100%); min-height: 560px; display: flex; flex-direction: column; align-items: center; justify-content: center; margin-inline: auto; padding: 28px; text-align: center; }
.guided-rom-flow h2 { margin: 8px 0 10px; }
.rom-copy { max-width: 580px; margin: 0 auto 20px; color: #b8c6d8; line-height: 1.75; }
.rom-intro-icon, .rom-disconnected-icon { width: 72px; height: 72px; display: grid; place-items: center; margin-bottom: 14px; border: 2px solid #69bdf0; border-radius: 50%; background: rgba(77, 163, 255, .1); color: #8fd8ff; font-size: 40px; font-weight: 800; }
.rom-disconnected-icon { border-color: #f28b82; background: rgba(242, 139, 130, .09); color: #f28b82; }
.rom-safety-tip { width: min(560px, 100%); margin: 0 auto 22px; padding: 12px 15px; border: 1px solid #665b38; border-radius: 11px; background: rgba(73, 62, 27, .28); color: #efd693; font-size: 13px; }
.rom-primary-action { width: min(340px, 100%); min-height: 52px; margin-top: 4px; font-weight: 750; }
.rom-countdown { margin: 8px 0; color: #8fd8ff; font-size: clamp(74px, 12vw, 116px); font-weight: 850; line-height: 1; text-shadow: 0 0 34px rgba(77, 163, 255, .26); }
.rom-measure-progress { width: min(520px, 100%); height: 13px; overflow: hidden; margin: 10px auto 14px; border-radius: 99px; background: #08111f; }
.rom-measure-progress span { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, #4da3ff, #68d391); transition: width .12s linear; }
.rom-progress-label { color: #8fd8ff; font-size: 14px; }
.rom-step-label { margin: -7px 0 3px; color: #71a8ff; font-size: 12px; font-weight: 700; letter-spacing: .08em; }
.rom-success-mark { width: 70px; height: 70px; display: grid; place-items: center; margin-bottom: 10px; border: 2px solid #68d391; border-radius: 50%; background: rgba(104, 211, 145, .12); color: #8fe2b1; font-size: 38px; font-weight: 900; }
.rom-result-value { display: block; margin: 2px 0 14px; color: #8fd8ff; font-size: 34px; }
.rom-error-copy { max-width: 540px; margin: 0 auto 12px; font-size: 14px; line-height: 1.6; }
.rom-confirm-actions { display: flex; justify-content: center; gap: 12px; width: min(460px, 100%); }
.rom-confirm-actions .button { flex: 1; min-height: 48px; }
.rom-exit-action { margin-top: 24px; border: 0; background: transparent; color: #91a3ba; text-decoration: underline; cursor: pointer; }
.rom-exit-action:hover { color: #f1b0aa; }

@media (max-width: 767px) {
  .guided-rom-flow { min-height: calc(100dvh - 150px); padding: 20px 16px; }
  .guided-rom-flow h2 { font-size: 22px; }
  .rom-copy { font-size: 14px; }
  .rom-confirm-actions { flex-direction: column; }
  .rom-confirm-actions .button { width: 100%; }
}
</style>
