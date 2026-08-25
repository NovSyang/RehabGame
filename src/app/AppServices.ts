import { ref } from 'vue'
import { LocalStorageMotionProfileRepository } from '../core/motion/LocalStorageMotionProfileRepository'
import { MotionProfileService } from '../core/motion/MotionProfileService'
import type { MotionProfile } from '../core/motion/MotionProfile'
import { LocalStorageDeviceBindingRepository } from '../core/sensor/DeviceBinding'
import { SensorConnectionManager } from '../core/sensor/SensorConnectionManager'
import { SensorService } from '../core/sensor/SensorService'
import { LocalStorageStore } from '../core/storage/LocalStorageStore'
import { IndexedDbTrainingRepository } from '../core/training/IndexedDbTrainingRepository'
import type { TrainingRecord } from '../core/training/TrainingRecord'
import type { TrainingResult } from '../core/training/TrainingResult'
import type { TrainingReplay } from '../core/replay/TrainingReplay'
import { defaultTargetReachGameConfig } from '../games/target-reach/TargetReachGameConfig'
import { TauriBleTransport } from '../platform/tauri/TauriBleTransport'

/** 应用级单例服务，确保切换页面时不会重复创建 BLE 监听与传感器处理链路。 */
export const transport = new TauriBleTransport()
export const sensorService = new SensorService(transport)
const localStore = new LocalStorageStore()
export const connectionManager = new SensorConnectionManager(sensorService, new LocalStorageDeviceBindingRepository(localStore))
export const motionProfileService = new MotionProfileService(new LocalStorageMotionProfileRepository(localStore), sensorService)
export const trainingRepository = new IndexedDbTrainingRepository()

/** 结果页使用的短期内存状态；历史记录才是可跨重启的数据来源。 */
export const latestTrainingRecord = ref<TrainingRecord | null>(null)

let initialized: Promise<void> | null = null

/** 首次加载 Profile、绑定并在后台启动有限次数的设备恢复。 */
export function initializeAppServices(): Promise<void> {
  initialized ??= (async () => {
    await motionProfileService.load()
    await connectionManager.initialize()
    // 自动连接不能阻塞历史、设置或回放页面的首次渲染。
    void connectionManager.startupConnect()
  })()
  return initialized
}

/** 将完成结果连同当时配置写入历史，保持历史数据可解释。 */
export async function persistTargetReachResult(
  result: TrainingResult,
  replay: TrainingReplay,
): Promise<TrainingRecord> {
  const record: TrainingRecord = {
    schemaVersion: 2,
    id: createRecordId(),
    gameId: 'target-reach',
    gameName: '四方向目标触达',
    completedAt: Date.now(),
    result: structuredClone(result),
    motionProfile: motionProfileService.getCurrent(),
    gameConfig: structuredClone(defaultTargetReachGameConfig),
    replay: structuredClone(replay),
  }
  await trainingRepository.save(record)
  latestTrainingRecord.value = record
  return record
}

/** 使用标准 UUID；极少数不支持环境采用时间与随机值组合。 */
function createRecordId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `record-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

/** Settings 重置 Profile 后保留默认配置并立即更新实时输入。 */
export async function resetMotionProfile(): Promise<MotionProfile> {
  return motionProfileService.reset()
}
