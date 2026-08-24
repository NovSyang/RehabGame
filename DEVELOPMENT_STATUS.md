# 开发状态 V0.1

## 已落地

- [x] M0 Vue3 + TypeScript + Vite + PixiJS + Tauri 工程骨架
- [x] M1 SensorFrame / GameInput / ISensorTransport / MotionConfig
- [x] M2 Tauri Windows BLE Adapter 第一版
- [x] M3 BS-BT91 FrameAssembler + 0x61 Parser
- [x] M4 MotionProcessor V0.1
- [x] M5 PixiJS Ball Demo 第一版

## 等待 Windows + 真实 BS-BT91 实机验证

- [ ] Windows Rust/Tauri 完整编译
- [ ] 扫描真实 BS-BT91
- [ ] FFE5 / FFE4 / FFE9 实机确认
- [ ] 50Hz Notify 稳定性
- [ ] 与厂家调试软件 AngleX/Y/Z 对照
- [ ] 中心零点校准
- [ ] 前后左右方向验证
- [ ] 小球跟手性验证

## 实机通过后下一批任务

- [ ] MotionConfig UI（DeadZone + 4方向ROM）
- [ ] ROM Calibration 流程
- [ ] 自动重连
- [ ] BLE设备持久绑定
- [ ] Notify 间隔和掉帧统计
- [ ] 轻量 EMA 可选滤波
- [ ] 第一款正式康复小游戏
- [ ] Capacitor BLE Adapter
