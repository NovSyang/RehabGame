import { KeepAwake } from '@capacitor-community/keep-awake'
import { ScreenOrientation } from '@capacitor/screen-orientation'
import type { IDisplayService, TrainingDisplayState } from '../display/IDisplayService'

/** Android 训练期间尽量锁定横屏并保持亮屏，单项失败不会阻止训练。 */
export class CapacitorDisplayService implements IDisplayService {
  async lockLandscape(): Promise<boolean> {
    try {
      await ScreenOrientation.lock({ orientation: 'landscape' })
      return true
    } catch {
      // Android 大屏或系统策略可能拒绝锁定，调用方仍可继续显示界面。
      return false
    }
  }

  async unlockOrientation(): Promise<void> { await ScreenOrientation.unlock() }

  async enterTrainingMode(): Promise<TrainingDisplayState> {
    const orientationLocked = await this.lockLandscape()
    try { await KeepAwake.keepAwake() } catch { /* 不支持常亮时继续使用系统默认策略。 */ }
    return { native: true, orientationLocked }
  }

  async leaveTrainingMode(): Promise<void> {
    // 两项清理互不阻塞，确保其中一个失败时另一个仍会执行。
    await Promise.allSettled([KeepAwake.allowSleep(), this.unlockOrientation()])
  }
}
