# BS-BT91 康复交互游戏 V0.7

V0.7 在已完成实机验证的设备、ROM 和训练闭环上，加入通用多游戏框架与第二款正式训练游戏：

```text
BS-BT91 → BLE 自动恢复 → 每局中心 Zero → MotionProfile
→ MotionProcessor → GameInput → GameRegistry / GameModule
→ TargetReach 或 TrajectoryFollow → TrainingRecord → History / Replay
```

## 当前能力

- Windows Tauri BLE：扫描、连接、FFE4 Notify、FFE9 Write 与异常断线检测。
- 中心校准与四方向个体 ROM 标定：3 秒采样、前 500ms 忽略、P95 结果。
- MotionProfile 持久化：保存死区、实测 ROM、训练比例与实际活动范围。
- 最近设备绑定：按 ID、地址、唯一名称匹配，异常断线按 1/2/5 秒自动重连。
- 多游戏训练宿主：动态 HUD、统一中心校准、手动暂停和断线恢复。
- 四方向目标触达训练：倒计时、Hold、Timeout、方向统计和历史目标回放。
- 8 字轨迹跟随训练：60 秒连续二维控制、误差与容差范围统计。
- IndexedDB 混合训练历史：结果、Profile、配置与 25Hz 轨迹事实快照。
- 双模式历史回放：动态播放、Seek、倍速和完整二维轨迹。
- 实时电量状态：连接后读取并每 30 秒更新，经厂家分段表解码百分比。

## 开发环境

Windows 10/11、Node.js 20+、Rust stable、Visual Studio C++ Desktop workload、WebView2 Runtime，以及具备 BLE 的电脑。

```powershell
npm install
npm run test
npm run build
npm run tauri:dev
```

## 使用流程

首次使用：

```text
首次设置连接设备 → 中心确认 → 四方向 ROM 标定 → 选择游戏 → 每局中心校准 → 训练 → 结果与历史
```

后续使用：

```text
后台恢复上次设备 → 选择游戏 → 每局中心校准 → 训练
```

浏览器仅用于界面预览；真实 BS-BT91 扫描、自动重连和实机训练必须在 `npm run tauri:dev` 打开的 Tauri 桌面窗口内进行。

## V0.7 实机验收重点

1. 分别完成 TargetReach 和 TrajectoryFollow，确认两款游戏方向与个人 ROM 一致。
2. TrajectoryFollow 暂停或断线后，引导点时间轴不跳跃，重新中心校准后继续原会话。
3. 历史同时查看旧 TargetReach、新 TargetReach 和 TrajectoryFollow 记录。
4. 验证两款游戏的动态回放、Seek、倍速、完整轨迹及弹窗反复开关资源释放。
5. 连续运行至少 30 分钟，观察 BLE、电量轮询、Pixi Ticker 和内存稳定性。
