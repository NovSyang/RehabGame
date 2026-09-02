import { describe, expect, it } from 'vitest'
import { GuidedRomWorkflow } from '../src/core/motion/GuidedRomWorkflow'
import { RomCalibrator } from '../src/core/motion/RomCalibrator'
import type { RelativeMotion } from '../src/core/motion/MotionProcessor'
import type { RomDirection } from '../src/core/motion/RomCalibrationState'

const motion = (horizontalDeg: number, verticalDeg: number): RelativeMotion => ({
  relativeAngleX: -verticalDeg,
  relativeAngleY: horizontalDeg,
  horizontalDeg,
  verticalDeg,
})

/** 测试使用单样本 Calibrator，专注验证引导流程而不是重复测试 P95。 */
function createWorkflow(): GuidedRomWorkflow {
  return new GuidedRomWorkflow(undefined, () => new RomCalibrator(3000, 500, 1, 3))
}

function reachDirectionReady(workflow: GuidedRomWorkflow, startAt = 0): number {
  workflow.start(startAt)
  workflow.confirmReady(startAt)
  workflow.tick(startAt + 3000)
  workflow.centerCalibrated(startAt + 4000)
  return startAt + 4000
}

function completeDirection(workflow: GuidedRomWorkflow, direction: RomDirection, readyAt: number): number {
  workflow.confirmReady(readyAt)
  workflow.tick(readyAt + 3000)
  const measuringAt = readyAt + 3000
  const value = direction === 'forward' ? motion(0, 10)
    : direction === 'backward' ? motion(0, -10)
      : direction === 'left' ? motion(-10, 0)
        : motion(10, 0)
  workflow.addMotionSample(value, measuringAt + 600)
  workflow.tick(measuringAt + 3000)
  return measuringAt + 3000
}

describe('GuidedRomWorkflow', () => {
  it('倒计时达到 3000ms 后才启动中心和方向测量', () => {
    const workflow = createWorkflow()
    workflow.start(0)
    workflow.confirmReady(0)
    workflow.tick(2999)
    expect(workflow.getSnapshot(2999).phase).toBe('center-countdown')
    expect(workflow.getSnapshot(2999).countdown).toBe(1)
    workflow.tick(3000)
    expect(workflow.getSnapshot(3000).phase).toBe('center-calibrating')

    workflow.centerCalibrated(4000)
    workflow.confirmReady(4000)
    workflow.tick(6999)
    expect(workflow.getSnapshot(6999).phase).toBe('direction-countdown')
    workflow.tick(7000)
    expect(workflow.getSnapshot(7000).phase).toBe('direction-measuring')
  })

  it('中心超时返回准备页并允许重新开始', () => {
    const workflow = createWorkflow()
    workflow.start(0)
    workflow.confirmReady(0)
    workflow.tick(3000)
    workflow.tick(6000)
    const snapshot = workflow.getSnapshot(6000)
    expect(snapshot.phase).toBe('center-ready')
    expect(snapshot.errorMessage).toContain('未能完成中心校准')
    workflow.confirmReady(6100)
    expect(workflow.getSnapshot(6100).phase).toBe('center-countdown')
  })

  it('有效方向自动接受，无效方向只重试当前方向', () => {
    const workflow = createWorkflow()
    const readyAt = reachDirectionReady(workflow)
    workflow.confirmReady(readyAt)
    workflow.tick(readyAt + 3000)
    workflow.tick(readyAt + 6000)
    expect(workflow.getSnapshot(readyAt + 6000).phase).toBe('direction-failed')
    expect(workflow.getSnapshot(readyAt + 6000).currentDirection).toBe('forward')

    workflow.retryDirection(readyAt + 6100)
    const successAt = completeDirection(workflow, 'forward', readyAt + 6100)
    const snapshot = workflow.getSnapshot(successAt)
    expect(snapshot.phase).toBe('direction-success')
    expect(snapshot.completedDirections).toEqual(['forward'])
    expect(snapshot.measuredRange.forwardMax).toBe(10)
  })

  it('回中心需连续稳定 600ms，离开阈值会重新计时', () => {
    const workflow = createWorkflow()
    const successAt = completeDirection(workflow, 'forward', reachDirectionReady(workflow))
    workflow.tick(successAt + 1200)
    expect(workflow.getSnapshot(successAt + 1200).phase).toBe('return-center')

    workflow.addMotionSample(motion(1, 1), successAt + 1300)
    workflow.addMotionSample(motion(3, 0), successAt + 1700)
    workflow.addMotionSample(motion(1, 1), successAt + 1800)
    workflow.addMotionSample(motion(1, 1), successAt + 2399)
    expect(workflow.getSnapshot(successAt + 2399).phase).toBe('return-center')
    workflow.addMotionSample(motion(1, 1), successAt + 2400)
    expect(workflow.getSnapshot(successAt + 2400).phase).toBe('direction-ready')
    expect(workflow.getSnapshot(successAt + 2400).currentDirection).toBe('backward')
  })

  it('五秒后允许人工确认中心', () => {
    const workflow = createWorkflow()
    const successAt = completeDirection(workflow, 'forward', reachDirectionReady(workflow))
    workflow.tick(successAt + 1200)
    expect(workflow.getSnapshot(successAt + 6199).canManualConfirmCenter).toBe(false)
    expect(workflow.getSnapshot(successAt + 6200).canManualConfirmCenter).toBe(true)
    workflow.confirmReturnCenter(successAt + 6200)
    expect(workflow.getSnapshot(successAt + 6200).currentDirection).toBe('backward')
  })

  it('按固定顺序完成四方向并生成汇总', () => {
    const workflow = createWorkflow()
    let readyAt = reachDirectionReady(workflow)
    for (const direction of ['forward', 'backward', 'left', 'right'] as const) {
      const successAt = completeDirection(workflow, direction, readyAt)
      workflow.tick(successAt + 1200)
      if (direction === 'right') {
        expect(workflow.getSnapshot(successAt + 1200).phase).toBe('summary')
        expect(workflow.beginSaving(successAt + 1300)).toEqual({ leftMax: 10, rightMax: 10, forwardMax: 10, backwardMax: 10 })
      } else {
        workflow.addMotionSample(motion(0, 0), successAt + 1300)
        workflow.addMotionSample(motion(0, 0), successAt + 1900)
        readyAt = successAt + 1900
      }
    }
  })

  it('保存失败会保留完整结果并回到汇总页重试', () => {
    const workflow = createWorkflow()
    let readyAt = reachDirectionReady(workflow)
    for (const direction of ['forward', 'backward', 'left', 'right'] as const) {
      const successAt = completeDirection(workflow, direction, readyAt)
      workflow.tick(successAt + 1200)
      if (direction !== 'right') {
        workflow.addMotionSample(motion(0, 0), successAt + 1300)
        workflow.addMotionSample(motion(0, 0), successAt + 1900)
        readyAt = successAt + 1900
      }
    }
    const range = workflow.beginSaving(40_000)
    expect(range).not.toBeNull()
    workflow.saveFailed('存储空间不可用', 40_100)
    const snapshot = workflow.getSnapshot(40_100)
    expect(snapshot.phase).toBe('summary')
    expect(snapshot.errorMessage).toBe('存储空间不可用')
    expect(snapshot.measuredRange).toEqual(range)
  })

  it('取消可继续当前步骤，确认丢弃或断线都会清空本轮数据', () => {
    const workflow = createWorkflow()
    const successAt = completeDirection(workflow, 'forward', reachDirectionReady(workflow))
    workflow.tick(successAt + 1200)
    workflow.requestCancel(successAt + 1300)
    expect(workflow.getSnapshot(successAt + 1300).phase).toBe('cancel-confirm')
    workflow.continueAfterCancel(successAt + 1400)
    expect(workflow.getSnapshot(successAt + 1400).phase).toBe('return-center')

    workflow.connectionLost(successAt + 1500)
    const lost = workflow.getSnapshot(successAt + 1500)
    expect(lost.phase).toBe('connection-lost')
    expect(lost.completedDirections).toEqual([])
    expect(lost.measuredRange).toEqual({})
    workflow.restartAfterConnection(successAt + 1600)
    expect(workflow.getSnapshot(successAt + 1600).phase).toBe('center-ready')

    workflow.requestCancel(successAt + 1700)
    workflow.discard(successAt + 1800)
    expect(workflow.getSnapshot(successAt + 1800).phase).toBe('intro')
  })
})
