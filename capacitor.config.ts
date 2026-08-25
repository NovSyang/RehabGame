import type { CapacitorConfig } from '@capacitor/cli'

/** Android 使用与桌面端相同的 Vue 构建产物，平台差异只放在原生适配层。 */
const config: CapacitorConfig = {
  appId: 'com.rehabgame.app',
  appName: 'RehabGame',
  webDir: 'dist',
  plugins: {
    App: {
      // 由应用统一处理训练确认、路由返回和根页面最小化。
      disableBackButtonHandler: true,
    },
  },
}

export default config
