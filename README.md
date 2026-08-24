# BS-BT91 康复交互游戏 V0.3

V0.3 在已完成实机验证的 TargetReach 训练基础上，加入个体化 ROM、BLE 恢复和本地训练历史：

```text
BS-BT91 → BLE 自动恢复 → 中心 Zero → MotionProfile
→ MotionProcessor → GameInput → IRehabGame
→ TargetReachGame → TrainingRecord → History
```

## 当前能力

- Windows Tauri BLE：扫描、连接、FFE4 Notify、FFE9 Write 与异常断线检测。
- 中心校准与四方向个体 ROM 标定：3 秒采样、前 500ms 忽略、P95 结果。
- MotionProfile 持久化：保存死区、实测 ROM、训练比例与实际活动范围。
- 最近设备绑定：按 ID、地址、唯一名称匹配，异常断线按 1/2/5 秒自动重连。
- 四方向目标触达训练：倒计时、Hold、Timeout、断线暂停和结果统计。
- IndexedDB 训练历史：结果、Profile 快照、游戏配置快照、详情及单条删除。
- Vue Router 页面：设备、ROM 标定、游戏、训练、结果、历史和设置。

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
设备页扫描并连接 → 中心校准 → 四方向 ROM 标定 → 选择游戏 → 训练 → 结果与历史
```

后续使用：

```text
自动尝试恢复上次设备 → 中心校准 → 选择游戏 → 训练
```

浏览器仅用于界面预览；真实 BS-BT91 扫描、自动重连和实机训练必须在 `npm run tauri:dev` 打开的 Tauri 桌面窗口内进行。

## V0.3 实机验收

1. 每个方向至少重复三次 ROM 标定，确认结果量级稳定且无串轴。
2. 重启应用，确认 MotionProfile、设备绑定和训练历史仍存在。
3. 训练中关闭设备，确认游戏暂停、1/2/5 秒重连、重连后要求重新中心校准。
4. 连续运行至少 30 分钟，观察数据频率、卡顿与历史记录正确性。
