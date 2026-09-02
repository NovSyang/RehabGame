import type { MotionRange } from './MotionConfig'
import { RomCalibrator, type RomCalibrationResult } from './RomCalibrator'
import { ROM_DIRECTION_ORDER, type RomDirection } from './RomCalibrationState'
import type { RelativeMotion } from './MotionProcessor'

/** 引导式 ROM 的全部用户可见阶段，页面只根据该状态渲染。 */
export type GuidedRomPhase =
  | 'intro'
  | 'center-ready'
  | 'center-countdown'
  | 'center-calibrating'
  | 'direction-ready'
  | 'direction-countdown'
  | 'direction-measuring'
  | 'direction-success'
  | 'return-center'
  | 'direction-failed'
  | 'summary'
  | 'saving'
  | 'connection-lost'
  | 'cancel-confirm'

export interface GuidedRomWorkflowConfig {
  prepareCountdownMs: number
  successDisplayMs: number
  centerSamplingMs: number
  centerCalibrationTimeoutMs: number
  returnCenterThresholdDeg: number
  returnCenterStableMs: number
  returnCenterFallbackMs: number
}

/** 固定交互参数集中存放，方便测试边界并避免页面出现魔法数字。 */
export const DEFAULT_GUIDED_ROM_CONFIG: Readonly<GuidedRomWorkflowConfig> = Object.freeze({
  prepareCountdownMs: 3000,
  successDisplayMs: 1200,
  centerSamplingMs: 1000,
  centerCalibrationTimeoutMs: 3000,
  returnCenterThresholdDeg: 2,
  returnCenterStableMs: 600,
  returnCenterFallbackMs: 5000,
})

export interface GuidedRomSnapshot {
  phase: GuidedRomPhase
  stepIndex: number
  totalSteps: number
  currentDirection: RomDirection | null
  countdown: number | null
  measurementProgress: number
  completedDirections: RomDirection[]
  currentResult: RomCalibrationResult | null
  measuredRange: Partial<MotionRange>
  returnCenterElapsedMs: number
  canManualConfirmCenter: boolean
  errorMessage: string | null
}

type CalibratorFactory = () => RomCalibrator

/**
 * 管理中心和四方向 ROM 的连续流程。
 * 此类不访问 Vue、BLE、路由或存储，因此可以用固定时钟独立测试。
 */
export class GuidedRomWorkflow {
  private phase: GuidedRomPhase = 'intro'
  private phaseStartedAt = 0
  private directionIndex = 0
  private calibrator: RomCalibrator | null = null
  private currentResult: RomCalibrationResult | null = null
  private measuredRange: Partial<MotionRange> = {}
  private completedDirections: RomDirection[] = []
  private returnCenterStableStartedAt: number | null = null
  private errorMessage: string | null = null
  private phaseBeforeCancel: GuidedRomPhase | null = null

  constructor(
    private readonly config: GuidedRomWorkflowConfig = DEFAULT_GUIDED_ROM_CONFIG,
    private readonly createCalibrator: CalibratorFactory = () => new RomCalibrator(),
  ) {}

  /** 从说明页进入自然中心准备页。 */
  start(now: number): void {
    if (this.phase !== 'intro') return
    this.enter('center-ready', now)
  }

  /** “准备好了”只启动倒计时，不会提前启动传感器采样。 */
  confirmReady(now: number): void {
    if (this.phase === 'center-ready') this.enter('center-countdown', now)
    else if (this.phase === 'direction-ready') this.enter('direction-countdown', now)
  }

  /** 页面按固定频率推进时间状态；传感器动作仍由外层在阶段切换后执行。 */
  tick(now: number): void {
    const elapsed = this.elapsed(now)
    if (this.phase === 'center-countdown' && elapsed >= this.config.prepareCountdownMs) {
      this.enter('center-calibrating', now)
      return
    }
    if (this.phase === 'center-calibrating' && elapsed >= this.config.centerCalibrationTimeoutMs) {
      this.errorMessage = '未能完成中心校准，请确认设备连接正常，并重新保持设备中心位置。'
      this.enter('center-ready', now, true)
      return
    }
    if (this.phase === 'direction-countdown' && elapsed >= this.config.prepareCountdownMs) {
      this.calibrator = this.createCalibrator()
      this.calibrator.prepare()
      this.calibrator.start(this.currentDirection(), now)
      this.currentResult = null
      this.enter('direction-measuring', now)
      return
    }
    if (this.phase === 'direction-measuring') {
      const result = this.calibrator?.complete(now) ?? null
      if (!result) return
      this.currentResult = result
      if (!result.valid || !this.calibrator?.accept()) {
        this.errorMessage = result.message ?? '本次测量未通过，请重新测量。'
        this.enter('direction-failed', now, true)
        return
      }
      this.measuredRange[rangeKeyFor(result.direction)] = result.measuredRom
      if (!this.completedDirections.includes(result.direction)) this.completedDirections.push(result.direction)
      this.enter('direction-success', now)
      return
    }
    if (this.phase === 'direction-success' && elapsed >= this.config.successDisplayMs) {
      if (this.directionIndex === ROM_DIRECTION_ORDER.length - 1) this.enter('summary', now)
      else this.enter('return-center', now)
    }
  }

  /** 收到真实 calibrated 输入后才允许进入第一个方向。 */
  centerCalibrated(now: number): void {
    if (this.phase !== 'center-calibrating') return
    this.directionIndex = 0
    this.errorMessage = null
    this.enter('direction-ready', now)
  }

  /** 同一个相对运动入口同时服务方向 P95 采样与自动回中心识别。 */
  addMotionSample(motion: RelativeMotion, timestamp: number): void {
    if (this.phase === 'direction-measuring') {
      this.calibrator?.addSample(motion, timestamp)
      return
    }
    if (this.phase !== 'return-center') return

    const distance = Math.hypot(motion.horizontalDeg, motion.verticalDeg)
    if (distance > this.config.returnCenterThresholdDeg) {
      this.returnCenterStableStartedAt = null
      return
    }
    this.returnCenterStableStartedAt ??= timestamp
    if (timestamp - this.returnCenterStableStartedAt >= this.config.returnCenterStableMs) {
      this.advanceDirection(timestamp)
    }
  }

  /** 自动识别困难时，五秒后允许现场人员人工确认中心。 */
  confirmReturnCenter(now: number): void {
    if (this.phase !== 'return-center' || !this.canManualConfirmCenter(now)) return
    this.advanceDirection(now)
  }

  retryDirection(now: number): void {
    if (this.phase !== 'direction-failed') return
    this.calibrator = null
    this.currentResult = null
    this.errorMessage = null
    this.enter('direction-ready', now)
  }

  /** 打开退出确认时终止正在进行的本步，继续时从本步准备页重新开始。 */
  requestCancel(now: number): void {
    if (this.phase === 'saving' || this.phase === 'cancel-confirm') return
    this.phaseBeforeCancel = this.phase
    if (this.phase === 'center-calibrating' || this.phase === 'direction-measuring') this.calibrator = null
    // 保留失败或断线提示，用户选择继续后仍能看到原始原因。
    this.enter('cancel-confirm', now, true)
  }

  continueAfterCancel(now: number): void {
    if (this.phase !== 'cancel-confirm') return
    const previous = this.phaseBeforeCancel
    this.phaseBeforeCancel = null
    if (previous === 'summary') this.enter('summary', now)
    else if (previous === 'direction-success') {
      if (this.directionIndex === ROM_DIRECTION_ORDER.length - 1) this.enter('summary', now)
      else this.enter('return-center', now)
    } else if (previous === 'return-center') this.enter('return-center', now)
    else if (previous === 'direction-failed') this.enter('direction-failed', now, true)
    else if (previous === 'intro') this.enter('intro', now)
    else if (previous === 'connection-lost') this.enter('connection-lost', now, true)
    else if (previous?.startsWith('center')) this.enter('center-ready', now)
    else this.enter('direction-ready', now)
  }

  /** 确认退出后清除全部临时结果，调用页面再决定返回位置。 */
  discard(now: number): void {
    this.clearRun()
    this.enter('intro', now)
  }

  /** 断线不保留任何未保存结果；保存请求开始后则以存储结果为准。 */
  connectionLost(now: number): void {
    if (this.phase === 'saving' || this.phase === 'connection-lost') return
    this.clearRun()
    this.errorMessage = '训练设备已断开，请重新连接设备后重新开始个人活动范围测量。'
    this.enter('connection-lost', now, true)
  }

  restartAfterConnection(now: number): void {
    if (this.phase !== 'connection-lost') return
    this.clearRun()
    this.enter('center-ready', now)
  }

  beginSaving(now: number): MotionRange | null {
    if (this.phase !== 'summary') return null
    const range = this.getMeasuredRange()
    if (!range) return null
    this.errorMessage = null
    this.enter('saving', now)
    return range
  }

  saveFailed(message: string, now: number): void {
    if (this.phase !== 'saving') return
    this.errorMessage = message
    this.enter('summary', now, true)
  }

  getSnapshot(now: number): GuidedRomSnapshot {
    const elapsed = this.elapsed(now)
    const countdown = this.phase === 'center-countdown' || this.phase === 'direction-countdown'
      ? Math.max(1, Math.ceil((this.config.prepareCountdownMs - elapsed) / 1000))
      : null
    const calibrationProgress = this.phase === 'center-calibrating'
      ? clamp(elapsed / this.config.centerSamplingMs, 0, 1)
      : this.phase === 'direction-measuring'
        ? clamp((this.calibrator?.getSnapshot(now).elapsedMs ?? 0) / (this.calibrator?.durationMs ?? 1), 0, 1)
        : 0

    return {
      phase: this.phase,
      stepIndex: this.phase.startsWith('center') || this.phase === 'intro' || this.phase === 'connection-lost'
        ? 0
        : Math.min(4, this.directionIndex + 1),
      totalSteps: 5,
      currentDirection: this.phase.startsWith('center') || this.phase === 'intro' || this.phase === 'connection-lost'
        ? null
        : this.currentDirection(),
      countdown,
      measurementProgress: calibrationProgress,
      completedDirections: [...this.completedDirections],
      currentResult: this.currentResult ? structuredClone(this.currentResult) : null,
      measuredRange: { ...this.measuredRange },
      returnCenterElapsedMs: this.phase === 'return-center' ? elapsed : 0,
      canManualConfirmCenter: this.canManualConfirmCenter(now),
      errorMessage: this.errorMessage,
    }
  }

  private currentDirection(): RomDirection {
    return ROM_DIRECTION_ORDER[this.directionIndex]
  }

  private advanceDirection(now: number): void {
    if (this.directionIndex >= ROM_DIRECTION_ORDER.length - 1) {
      this.enter('summary', now)
      return
    }
    this.directionIndex += 1
    this.currentResult = null
    this.calibrator = null
    this.enter('direction-ready', now)
  }

  private canManualConfirmCenter(now: number): boolean {
    return this.phase === 'return-center' && this.elapsed(now) >= this.config.returnCenterFallbackMs
  }

  private getMeasuredRange(): MotionRange | null {
    const range = this.measuredRange
    if (!ROM_DIRECTION_ORDER.every((direction) => range[rangeKeyFor(direction)] !== undefined)) return null
    return {
      leftMax: range.leftMax!,
      rightMax: range.rightMax!,
      forwardMax: range.forwardMax!,
      backwardMax: range.backwardMax!,
    }
  }

  private clearRun(): void {
    this.directionIndex = 0
    this.calibrator = null
    this.currentResult = null
    this.measuredRange = {}
    this.completedDirections = []
    this.returnCenterStableStartedAt = null
    this.errorMessage = null
    this.phaseBeforeCancel = null
  }

  private elapsed(now: number): number {
    return Math.max(0, now - this.phaseStartedAt)
  }

  private enter(phase: GuidedRomPhase, now: number, preserveError = false): void {
    this.phase = phase
    this.phaseStartedAt = now
    this.returnCenterStableStartedAt = null
    if (!preserveError) this.errorMessage = null
  }
}

function rangeKeyFor(direction: RomDirection): keyof MotionRange {
  return direction === 'left' ? 'leftMax'
    : direction === 'right' ? 'rightMax'
      : direction === 'forward' ? 'forwardMax'
        : 'backwardMax'
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
