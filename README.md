# BS-BT91 康复交互游戏 V0.1

这是按照当前开发主线落地的第一版实机工程：

```text
BS-BT91
  ↓ BLE
Tauri Windows
  ↓
FrameAssembler
  ↓
BsBt91Parser
  ↓
MotionProcessor
  ↓
GameInput
  ↓
PixiJS Ball Demo
```

## 当前已经实现

- Vue3 + TypeScript + Vite 工程。
- PixiJS v8 小球交互 Demo。
- Tauri v2 Windows 桌面壳。
- Rust `btleplug` BLE Central 接入。
- 扫描名称包含 `BS` 的 BLE 设备。
- 连接目标设备并校验 FFE5 Service。
- 订阅 FFE4 Notify。
- 获取 FFE9 Write Characteristic 并支持写入。
- 0x55 / 0x61 / 0x71 缓冲组帧。
- 0x55 0x61 20Byte 姿态解析。
- 实时显示 AngleX / AngleY / AngleZ 与接收频率。
- 1 秒中心零点校准。
- `GameX = AngleY`、`GameY = -AngleX`。
- 默认 0.5° 死区。
- 四方向独立 ROM 结构，当前默认各 20°。
- PixiJS 小球实时响应 GameInput。
- Parser 与 MotionProcessor 基础单元测试。

## Windows 开发环境

建议：

1. Windows 10 / Windows 11，电脑具备 BLE。
2. Node.js 20+。
3. Rust stable（通过 rustup 安装）。
4. Microsoft C++ Build Tools / Visual Studio C++ Desktop workload。
5. WebView2 Runtime。

## 安装

```powershell
npm install
```

## 先验证前端

```powershell
npm run build
npm test
```

## 启动 Tauri 实机程序

```powershell
npm run tauri:dev
```

操作顺序：

1. 打开 BS-BT91，并确保厂家软件已经退出，避免同一设备连接被占用。
2. 点击“扫描 BS-BT91”。
3. 从列表选择真实设备。
4. 点击“连接”。
5. 确认 AngleX / AngleY / AngleZ 持续变化，Rate 接近当前设备配置（目标约 50Hz）。
6. 将康复仪器保持自然中心位置。
7. 点击“保持中心 1 秒并校准”。
8. 前后左右操作康复仪器，观察 PixiJS 小球。

预期：

```text
左  → 球左移
右  → 球右移
前  → 球上移
后  → 球下移
```

## 当前 V0.1 暂未实现

- 自动重连。
- BLE 地址持久绑定。
- 电量/版本/寄存器操作 UI。
- MotionConfig 参数设置 UI。
- ROM 自动校准。
- EMA / One Euro Filter。
- Capacitor Android / iOS BLE Adapter。
- Three.js 游戏。

## 实机验收重点

第一轮请记录：

- 是否能扫描到 BS-BT91；
- 是否成功连接；
- Rate 是否约 50Hz；
- AngleX / AngleY 是否与厂家调试软件方向、量级一致；
- 校准后中心 GameX/GameY 是否接近 0；
- 左右前后方向是否正确；
- 小球是否有明显抖动或迟滞；
- 断开设备后的程序行为。

如果 Windows 实机出现 BLE API / Rust 编译问题，请保留完整 `cargo` / `tauri dev` 报错日志，再针对具体环境修正。
