# 开发状态 V0.7

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

## V0.5 已实现

### 启动与导航

- [x] 后台自动恢复绑定设备，不阻塞历史和设置
- [x] `/` 默认训练入口、`/device` 兼容跳转与无 ROM 首次设置引导
- [x] 全局设备已连接/未连接状态栏与 AppReadiness

### 训练前置

- [x] 首次设置：设备绑定、中心准备、个人 ROM 三步流程
- [x] 每局训练前清除旧 Zero 并完成新的中心校准
- [x] 中心校准 UI 超时重试保护
- [x] 断线暂停、重连后重新中心确认并继续原训练

### 设置与诊断

- [x] Settings 展示 ROM、训练范围与设备管理（设备管理在 V0.6 移至顶部状态菜单）
- [x] ROM 重测取消保留旧 Profile，完成后一次性覆盖
- [x] DeveloperDebugView 保留设备扫描、连接和实时诊断信息

## V0.5 待实机验收

- [x] 首次启动完成绑定、Zero、ROM 后自动进入训练选择
- [x] 重启后后台自动连接且不重复 ROM 引导
- [x] 连续多局训练均要求新的中心确认
- [x] 训练中断线、自动重连、重新中心确认后继续且 Replay 时长正确
- [x] Settings 更换/忘记设备与 ROM 重测取消流程
- [x] V0.4 历史回放与 V0.5 新训练流程联合回归

## V0.6 已实现

### 全局设备连接

- [x] 启动后台立即恢复已绑定设备，首次失败后按 1/2/5 秒最多重试三次
- [x] ConnectionOperation、连接尝试序号和工作流取消机制，避免并行扫描与连接
- [x] 手动重连、训练异常掉线恢复、更换设备和忘记设备统一由 SensorConnectionManager 协调
- [x] 更换设备失败保留旧绑定并尝试恢复；忘记设备只清除 Binding 与中心校准
- [x] Rust 连接优先复用已扫描到的外围设备，未命中才执行额外扫描

### 全局入口与设置迁移

- [x] 非阻塞设备连接 Floating Loading，训练中恢复不显示重复全局提示
- [x] 顶部设备状态下拉：重新连接、更换设备、忘记设备、外部点击与 ESC 关闭
- [x] 更换设备弹窗与首次设置复用受控设备扫描面板
- [x] Settings 移除训练设备区域，仅保留 ROM 与开发者诊断

### Battery Status Enhancement

- [x] Battery Register 读取命令 `FF AA 27 64 00` 与通用 `0x71` Register Parser
- [x] SensorBatteryState、连接后立即读取、30 秒低频刷新与断线清理
- [x] 0x71 与 0x61 分流，Battery 不影响 MotionProcessor、Rate、训练记录或 Replay
- [x] DeveloperDebug 手动读取、Battery Raw、时间戳与完整 Register Hex
- [x] 顶部设备状态的 CSS 电池图标与实时百分比显示
- [x] 使用真实 BS-BT91 与厂家软件确认 Raw `391 → 75%`、`389 → 70%`
- [x] 根据厂家电压表实现 Battery Percent Decoder（边界值归入较高电压档）

## V0.6 完成实机验收

### Closing Batch 代码与自动验证

- [x] TrainingView 统一引导用户通过右上角设备状态菜单管理设备
- [x] Battery 已验证实现的代码注释与实际 Percent Decoder 对齐
- [x] 执行完整 BS-BT91 启动、重试、训练、电量刷新、断线恢复与 Replay 组合回归
- [x] 完成至少 30 分钟连续运行的 BLE、Battery Timer、Pixi Ticker 与内存稳定性检查

- [x] 已绑定设备启动首次成功、Retry 1 成功、Retry 3 成功及四次均失败
- [x] 右上角手动重连、更换设备取消/失败回滚和忘记设备流程
- [x] 训练中异常断线自动恢复、重新中心校准与 Replay 有效时长回归
- [x] Tauri Windows 环境连续运行与真实 BS-BT91 蓝牙扫描性能确认

## V0.7 已实现

### 多游戏训练框架

- [x] BaseTrainingResult、ITrainingGame、TrainingGameEvents 与通用 HUD
- [x] GameModule、GameRegistry、唯一 ID 检查与动态 `/training/:gameId` 路由
- [x] TrainingRecord 泛型化与通用 persistTrainingResult，IndexedDB 版本保持不变
- [x] 通用 Result、History、TrainingSummary 与 Replay Player 契约
- [x] TargetReach Result、Presenter、HUD Adapter 与 Replay Factory 迁移
- [x] 手动/断线 PauseReason、倒计时断线冻结与重新中心校准恢复

### Trajectory Follow

- [x] 60 秒 8 字轨迹、25Hz 参考样本与有效训练时间轴
- [x] PixiJS Reference、Guide、Player 与 2.5 秒患者尾迹
- [x] 平均/最大归一化误差、范围内比例与范围内时间统计
- [x] 保存 reference-path 历史事实，不使用新版本公式重算旧训练
- [x] 动态回放、Seek、0.5x/1x/2x 与完整患者/参考轨迹
- [x] Vue Proxy 与嵌套 Replay Payload 的安全普通对象复制

### 自动验证

- [x] 28 个测试文件、116 项单元测试通过
- [x] `npm run build` 通过
- [x] `npm run tauri:build` 最终验证

## V0.7 待实机验收

- [x] 使用真实 BS-BT91 分别完成 TargetReach 与 TrajectoryFollow
- [x] 验证不同个人 ROM 下 8 字轨迹方向、幅度与中心穿越
- [x] 验证手动暂停、断线恢复、重新中心校准和有效时间连续性
- [x] 验证旧 V1/V2 TargetReach 与 V0.7 两款游戏混合历史
- [x] 验证两类动态/完整回放、Seek、倍速和重复开关无资源残留
- [x] 连续运行至少 30 分钟，确认 BLE、Battery Timer、Pixi Ticker 与内存稳定
