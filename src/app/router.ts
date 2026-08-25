import { createRouter, createWebHashHistory } from 'vue-router'
import { initializeAppServices, motionProfileService } from './AppServices'
import DeveloperDebugView from '../views/DeveloperDebugView.vue'
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
    { path: '/training/:gameId', component: TrainingView },
    { path: '/result', component: ResultView },
    { path: '/history', component: HistoryView },
    { path: '/settings', component: SettingsView },
    { path: '/settings/debug', component: DeveloperDebugView },
    { path: '/:pathMatch(.*)*', redirect: '/games' },
  ],
})

/** 仅正常训练入口需要个人 ROM；历史和设置永远可以直接访问。 */
router.beforeEach(async (to) => {
  await initializeAppServices()
  if ((to.path === '/games' || to.path.startsWith('/training/')) && motionProfileService.getCurrent().measuredRange === null) {
    return { path: '/setup' }
  }
  return true
})
