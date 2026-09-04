/** V0.3 本地持久化键名集中定义，避免不同模块使用不一致字符串。 */
export const StorageKeys = {
  motionProfile: 'rehab.motion-profile.v1',
  activityRangeHistory: 'rehab.activity-range-history.v1',
  lastDevice: 'rehab.last-device.v1',
  gameTutorial: 'rehab.game-tutorial.v1',
} as const
