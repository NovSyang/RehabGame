# 开发状态 V0.2

## V0.1 已完成

- [x] Vue3 + TypeScript + PixiJS + Tauri 工程骨架
- [x] Windows BLE 扫描、连接与 Notify 桥接
- [x] BS-BT91 帧组装与实时数据解析
- [x] MotionProcessor、中心零点校准与归一化 GameInput
- [x] Ball Demo 诊断游戏

## V0.2 已完成

- [x] 清理 TypeScript 编译生成物并启用 `noEmit`
- [x] TrainingSession 与训练结果领域模型
- [x] 四方向 TargetReachGame 配置、数学判定与随机目标
- [x] 3 秒倒计时、300ms Hold、8 秒 Timeout
- [x] Pause / Resume 与 BLE 断线自动暂停
- [x] 训练目标、成功失败与方向统计
- [x] 设备准备、游戏、结果三页面模式
- [x] TrainingSession、目标数学和结果统计单元测试

## 待实机验收

- [ ] BS-BT91 连接、校准和约 50Hz Notify 稳定性
- [ ] 左、右、前、后四方向目标均可完成
- [ ] 快速扫过目标不会成功，保持约 300ms 才成功
- [ ] 单目标 8 秒超时后自动进入下一目标
- [ ] 达到 20 目标或 120 秒后结果统计正确
- [ ] BLE 断线自动暂停，重新连接并校准后可继续
