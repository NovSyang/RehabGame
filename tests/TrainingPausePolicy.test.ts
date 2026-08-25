import { describe, expect, it } from 'vitest'
import { pauseReasonAfterDisconnect, shouldAutoResume } from '../src/core/game/TrainingPausePolicy'

describe('TrainingPausePolicy', () => {
  it('运行或倒计时断线标记为系统暂停', () => {
    expect(pauseReasonAfterDisconnect('none', 'playing')).toBe('disconnect')
    expect(pauseReasonAfterDisconnect('none', 'countdown')).toBe('disconnect')
    expect(shouldAutoResume('disconnect')).toBe(true)
  })

  it('手动暂停后断线仍保持手动暂停', () => {
    expect(pauseReasonAfterDisconnect('manual', 'paused')).toBe('manual')
    expect(shouldAutoResume('manual')).toBe(false)
  })
})
