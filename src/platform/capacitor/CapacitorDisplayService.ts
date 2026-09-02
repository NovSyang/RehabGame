import { KeepAwake } from '@capacitor-community/keep-awake'
import { ScreenOrientation } from '@capacitor/screen-orientation'
import type { IDisplayService, TrainingDisplayState } from '../display/IDisplayService'
import { RehabDisplay } from './RehabDisplayPlugin'

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
    // 三项原生能力互不依赖，单项失败时仍允许患者开始训练。
    const [orientationResult] = await Promise.allSettled([
      this.lockLandscape(),
      RehabDisplay.enterImmersiveMode(),
      KeepAwake.keepAwake(),
    ])
    const orientationLocked = orientationResult.status === 'fulfilled' && orientationResult.value
    return { native: true, orientationLocked }
  }

  async leaveTrainingMode(): Promise<void> {
    // 三项清理互不阻塞，确保其中一个失败时其他恢复动作仍会执行。
    await Promise.allSettled([
      RehabDisplay.exitImmersiveMode(),
      KeepAwake.allowSleep(),
      this.unlockOrientation(),
    ])
  }
}
