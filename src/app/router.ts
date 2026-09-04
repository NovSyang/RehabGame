import { createRouter, createWebHashHistory } from 'vue-router'
import { initializeAppServices, motionProfileService } from './AppServices'
import DeveloperDebugView from '../views/DeveloperDebugView.vue'
import ActivityRangeHistoryView from '../views/ActivityRangeHistoryView.vue'
import FirstRunSetupView from '../views/FirstRunSetupView.vue'
import GameSelectView from '../views/GameSelectView.vue'
import HistoryView from '../views/HistoryView.vue'
import ResultView from '../views/ResultView.vue'
import RomCalibrationView from '../views/RomCalibrationView.vue'
import SettingsView from '../views/SettingsView.vue'
import TrainingView from '../views/TrainingView.vue'

/** Hash 路由兼容 Tauri 本地文件与 Vite 预览环境。 */
export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/games' },
    { path: '/device', redirect: '/games' },
    { path: '/setup', component: FirstRunSetupView },
    { path: '/rom-calibration', component: RomCalibrationView },
    { path: '/games', component: GameSelectView },
    // 训练布局在 Android 隐藏全局导航，并由显示服务进入横屏与常亮模式。
    { path: '/training/:gameId', component: TrainingView, meta: { trainingLayout: true } },
    { path: '/result', component: ResultView },
    { path: '/history', component: HistoryView },
    { path: '/settings', component: SettingsView },
    // 活动范围历史不依赖当前 Profile，重置配置后仍可查看既往测量事实。
    { path: '/settings/activity-range-history', component: ActivityRangeHistoryView },
    { path: '/settings/debug', component: DeveloperDebugView },
    { path: '/:pathMatch(.*)*', redirect: '/games' },
  ],
})

/** 仅正常训练入口需要个人活动范围；历史和设置永远可以直接访问。 */
router.beforeEach(async (to) => {
  await initializeAppServices()
  if ((to.path === '/games' || to.path.startsWith('/training/')) && motionProfileService.getCurrent().measuredRange === null) {
    return { path: '/setup' }
  }
  return true
})
