import { createRouter, createWebHashHistory } from 'vue-router'
import DeviceView from '../views/DeviceView.vue'
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
    { path: '/', redirect: '/device' },
    { path: '/device', component: DeviceView },
    { path: '/rom-calibration', component: RomCalibrationView },
    { path: '/games', component: GameSelectView },
    { path: '/training/target-reach', component: TrainingView },
    { path: '/result', component: ResultView },
    { path: '/history', component: HistoryView },
    { path: '/settings', component: SettingsView },
    { path: '/:pathMatch(.*)*', redirect: '/device' },
  ],
})
