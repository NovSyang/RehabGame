import { registerPlugin } from '@capacitor/core'

interface RehabDisplayPluginApi {
  enterImmersiveMode(): Promise<void>
  exitImmersiveMode(): Promise<void>
}

/** 名称必须与 Android @CapacitorPlugin 注解保持一致。 */
export const RehabDisplay = registerPlugin<RehabDisplayPluginApi>('RehabDisplay')
