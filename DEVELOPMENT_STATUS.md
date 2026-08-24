# 开发状态 V0.4

## V0.1 已完成

- [x] Windows Tauri BLE、BS-BT91 帧解析与 Notify
- [x] 中心零点校准、MotionProcessor 与归一化 GameInput
- [x] Ball Demo 诊断工具

## V0.2 已完成并通过实机测试

- [x] TrainingSession、TargetReachGame 与训练结果
- [x] 倒计时、Hold、Timeout、暂停与断线暂停
- [x] 四方向统计与结果页

## V0.3 已实现

### Motion Profile 与 ROM

- [x] RelativeMotion 公共映射与动态 MotionConfig 更新
- [x] 单一 MotionProfile、localStorage 持久化与损坏数据回退
- [x] 四方向 ROM 标定、500ms 预热、P95 与 3° 防误操作阈值
- [x] 标定完成后生成并立即应用个体化 ROM

### BLE Reliability

- [x] 上次成功连接设备绑定与 ID/地址/唯一名称匹配
- [x] 异常断线自动重连，固定 1/2/5 秒退避
- [x] 主动断开不自动重连
- [x] 重连后清除旧中心校准，训练需重新校准后继续

### Training Persistence 与架构

- [x] IndexedDB TrainingRecord 持久化、历史列表、详情与单条删除
- [x] Vue Router 页面拆分与 AppServices 单例服务容器
- [x] Settings 单项重置 Profile、忘记设备绑定
- [x] IRehabGame、TargetReachGame 实现与 GameDefinition 注册表
- [x] V0.3 单元测试覆盖 Motion、ROM、绑定、重连与 IndexedDB

## V0.3 已通过实机验收

- [x] 四方向 ROM 重复测量的稳定性与动作方向一致性
- [x] Profile 重启后仍正确影响 TargetReach 输入范围
- [x] 训练中断线后，1/2/5 秒重连与重新中心校准流程
- [x] Training History 重启后的保存、查看与删除
- [x] 连续运行至少 30 分钟，确认约 50Hz、无阻塞卡顿和明显内存增长
- [x] `npm run tauri:build` 后在目标 Windows 环境启动验证

## V0.4 已实现

### Replay Core

- [x] TrainingReplay、25Hz Recorder 与插值数学
- [x] 有效训练时间采样、坐标 clamp 与四位小数精度
- [x] TargetReach 的 target、成功、失败、暂停、继续事件

### Persistence

- [x] TrainingRecord V2 保存 Replay
- [x] IndexedDB 继续兼容 V1 无 Replay 的历史记录

### History Replay

- [x] History 详情 Modal、ESC 与遮罩关闭
- [x] 历史数据汇总、MotionProfile 与游戏配置快照展示
- [x] 动态回放、播放暂停、重新开始、Seek、0.5x/1x/2x
- [x] 完整二维轨迹、目标编号与成功/失败标记
- [x] Modal 关闭时释放 Pixi Canvas 与 Ticker

## V0.4 待实机验收

- [x] 完成带明显二维偏移和暂停的 BS-BT91 TargetReach 训练
- [x] 验证目标顺序、轨迹方向、成功/失败与实际训练一致
- [x] 验证 30 秒真实暂停不计入 Replay 时长
- [x] 验证 0/25/50/75/100% Seek 和 0.5x/1x/2x 播放
- [x] 验证旧 V1 与新 V2 历史详情、弹窗反复打开关闭无资源残留
