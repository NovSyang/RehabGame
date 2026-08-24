import { describe, expect, it } from 'vitest'
import { TrainingSession } from '../src/core/training/TrainingSession'

describe('TrainingSession', () => {
  it('3 秒倒计时结束后进入训练状态', () => {
    const session = new TrainingSession()
    session.start(1000, 3000)

    session.update(3999)
    expect(session.getSnapshot(3999).state).toBe('countdown')

    session.update(4000)
    expect(session.getSnapshot(4000).state).toBe('playing')
  })

  it('暂停时间不计入有效训练时长', () => {
    const session = new TrainingSession()
    session.start(1, 0)
    session.pause(1001)
    session.resume(3001)

    expect(session.getSnapshot(4001).playingElapsedMs).toBe(2000)
  })
})
