# 开发状态 V0.8

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

### Training History UX Enhancement

- [x] 按 `gameId` 分组历史，并仅为存在记录的游戏生成 Card
- [x] Card 展示训练次数、最近训练和累计有效训练时长
- [x] Card 进入单游戏 Record Table，主要结果继续复用 Game Presenter
- [x] 详情继续复用 TrainingHistoryDialog，关闭后保持当前 Table
- [x] 删除后同步 Group 统计，删除最后一条后自动返回 Card 层
- [x] Unknown / Disabled Game 历史名称与详情降级兼容
- [x] TrainingHistoryGroup 分组、排序、统计和异常时长单元测试
- [ ] 使用真实 TargetReach 与 TrajectoryFollow 历史完成 Card、Table、详情和 Replay 页面回归

### 自动验证

- [x] 29 个测试文件、123 项单元测试通过
- [x] `npm run build` 通过
- [x] `npm run tauri:build` 最终验证

## V0.7 待实机验收

- [x] 使用真实 BS-BT91 分别完成 TargetReach 与 TrajectoryFollow
- [x] 验证不同个人 ROM 下 8 字轨迹方向、幅度与中心穿越
- [x] 验证手动暂停、断线恢复、重新中心校准和有效时间连续性
- [x] 验证旧 V1/V2 TargetReach 与 V0.7 两款游戏混合历史
- [x] 验证两类动态/完整回放、Seek、倍速和重复开关无资源残留
- [x] 连续运行至少 30 分钟，确认 BLE、Battery Timer、Pixi Ticker 与内存稳定

## Android 移动端适配

### 环境与 Capacitor Build

- [x] 确认 Node 22、JDK 21、Android SDK 36、Build Tools 36 与 adb 可用
- [x] 接入 Capacitor 8、Android 工程、App、Screen Orientation、BLE 与 Keep Awake 插件
- [x] 固定 `com.rehabgame.app`、`RehabGame` 和 `dist` Web 产物目录
- [x] 完成前端构建与 `cap sync android`
- [x] 生成 Debug APK
- [ ] 在 Android 真机安装并启动 Debug APK

### 平台抽象与 Android BLE

- [x] `ISensorTransport.dispose()`、平台 Transport Factory 与浏览器保护
- [x] Capacitor BLE 3 秒扫描、BS 名称过滤、ID 去重和扫描清理
- [x] FFE5/FFE4/FFE9 特征验证、Notify 数据复制与按能力选择写入方式
- [x] Android 12+ Nearby Devices 与 Android 11- 旧定位权限配置
- [x] 权限拒绝、永久拒绝、蓝牙关闭终止重试，普通错误保留有限退避
- [x] 连接、断线、Battery 命令与现有 ConnectionManager/SensorService 链路复用
- [ ] 真机验证 Scan、Connect、约 50Hz、Battery、Reconnect、Switch 与 Forget

### Android ROM Timestamp Fix

- [x] 明确 `SensorDataPacket.timestamp` 为 Unix Epoch 毫秒
- [x] Capacitor Notify 使用可测试的 `Date.now()` 时钟
- [x] 增加 Capacitor Timestamp Contract 与 ROM Timestamp Integration 测试
- [ ] Android 前、后、左、右 ROM 实机采样回归
- [ ] Battery Updated、TargetReach 与 TrajectoryFollow 实机回归

### Responsive 与移动训练

- [x] 移除 1080px 强制宽度，加入 320px 下限、动态视口和 Safe Area
- [x] Phone History Record Card、触控尺寸、移动 Dialog 与普通页面单列布局
- [x] Android 训练横屏、常亮、紧凑 Toolbar 和 Portrait Fallback
- [x] App 后台暂停、前台重新中心、手动暂停优先与 Android Back 结束确认
- [x] TargetReach、TrajectoryFollow 与两类 Replay 的尺寸变化重绘和资源清理
- [ ] 真机验证 360/390/430/768px、双游戏横屏、前后台恢复和系统返回键

### 自动验证与交付边界

- [x] 33 个测试文件、135 项单元测试通过
- [x] `npm run build` 与 Capacitor Sync 通过
- [x] `npm run tauri:build` 回归
- [x] Android Debug APK 构建
- [ ] 未签名 Release APK 与未签名 AAB 构建
- [ ] Android localStorage、IndexedDB、History 与 Replay 跨 Force Stop 验证
- [ ] Android 30 分钟 BLE、Battery Timer、Pixi、Observer 与内存稳定性
- [ ] 正式 keystore、Signed Release APK 与签名包实机验收（本轮明确延期）

## V0.8 Windows / Android 在线更新系统

### 版本与签名配置

- [x] 新增 `release-version.json`，统一 Product、Desktop 与 Android 版本来源
- [x] 版本同步与漂移检查覆盖 package、Tauri 和 Android Gradle
- [x] Windows 产品身份统一为 `RehabGame / com.rehabgame.app`
- [x] Tauri 启用 NSIS、Updater Artifact、公开验证密钥与主窗口 Updater Capability
- [x] Android Release 签名仅从环境变量读取，缺少签名变量时明确终止 Release 任务
- [x] `.gitignore` 忽略私钥、JKS、环境变量、签名属性和发布输出，继续允许提交公开 `.key.pub`

### 通用更新服务与 Provider

- [x] UpdatePolicy、UpdateState、UpdateInfo、进度、Provider 与策略持久化
- [x] Tauri、Android Native、Browser 三平台 Provider Factory
- [x] silent、prompt、manual 三种策略和启动后 3 秒非阻塞检查
- [x] 引用计数式安装安全锁，训练、首次设置和 ROM 标定期间延迟安装
- [x] Windows Updater 分离检查、下载与安装，并正确释放旧 Update 资源
- [x] Android Manifest 的 HTTPS、SHA-256、大小与递增 versionCode 校验

### Android 原生 APK 更新

- [x] Capacitor 本地 AndroidApkUpdaterPlugin 注册及 TypeScript Bridge
- [x] APK 下载到应用缓存目录，并持续发布下载进度
- [x] 下载完成后校验 SHA-256、包名、versionCode 与当前应用签名证书
- [x] Android 26+ 未知来源权限查询和应用专属设置页引导
- [x] PackageInstaller Session、系统确认、成功与失败状态处理
- [x] 切换页面或销毁服务时清理监听与临时更新文件

### 页面与发布工具

- [x] Settings “关于与更新”卡片、版本、策略、状态及手动检查入口
- [x] 全局响应式 UpdateDialog、下载进度、稍后、重试、安装与权限操作
- [x] Windows `latest.json` 与 Android `android-latest.json` / `SHA256SUMS.txt` 生成脚本
- [x] README 记录环境变量、签名构建、首装数据影响和 0.8.1 升级流程

### 自动验证

- [x] 39 个测试文件、155 项单元测试通过
- [x] `npm run build` 通过
- [x] `cargo check` 通过，Release 主程序按产品身份输出为 `RehabGame.exe`
- [x] Android Debug APK 构建通过，Capacitor 本地更新插件可由 Java 编译器正常编译
- [ ] 使用外部 Tauri 私钥执行签名 `npm run tauri:build`（当前机器下载 NSIS 工具包时发生 `unexpected end of file`，尚未进入签名阶段）
- [ ] 使用外部 Android JKS 环境变量生成 Signed Release APK 与 AAB

### Android 检查更新 Fetch Context Fix

- [x] Android 默认 Fetch 改为通过 `globalThis.fetch()` 调用，避免 WebView `illegal invocation`
- [x] 保留 Fetch 依赖注入，并增加原生调用上下文回归测试
- [x] 网络不可达的 `TypeError` 转换为可读中文提示
- [x] `npm run test`、`npm run build` 与 Android Debug APK 构建通过
- [ ] Android 真机确认检查更新可以实际请求 GitHub Manifest

### V0.8 待发布与实机验收

- [ ] 人工创建公开 GitHub Release 并上传两平台更新资产与清单
- [ ] Windows Release 0.8.0 → 0.8.1 的签名下载和安装回归
- [ ] Android 同一 JKS 的 0.8.0 → 0.8.1 下载、校验、授权和覆盖安装回归
- [ ] 校验 SHA-256、包名、versionCode 或签名证书不匹配时均拒绝 Android 安装
- [ ] 验证三种更新策略、训练/ROM 安全锁、网络失败与“稍后更新”
- [ ] 验证升级后 Profile、Binding、训练历史和 Replay 保持不变

## V0.9 森林溪谷漂流与 Game Framework V1

### 个人 ROM 引导式测量

- [x] 新增纯逻辑 `GuidedRomWorkflow`，统一中心、四方向、倒计时、重试、回中心、保存与断线状态
- [x] 固定自然中心、向前、向后、向左、向右五步顺序，并在测量开始前提供 3 秒准备倒计时
- [x] 有效方向结果自动接受；无效结果只重测当前方向，不向普通用户展示工程样本数
- [x] 回中心使用 2° 二维距离、600ms 连续稳定和 5 秒人工确认兜底
- [x] 首次设置与 Settings 重测复用同一引导组件，只有汇总确认后才覆盖旧 MotionProfile
- [x] BLE 断线清空整轮未保存结果，重连后必须从自然中心重新开始
- [x] 桌面五步进度与 390px 手机进度圆点、52px 主按钮和无横向溢出检查
- [x] 43 个测试文件、175 项单元测试、`npm run build`、Android Debug APK 与 `cargo check` 通过
- [ ] Windows Tauri 与 Android 真机完成五步 ROM、自动回中心、断线整套重做和 Profile 应用回归
- [ ] 当前验证进程未注入 Tauri Updater 私钥，需在签名环境中补跑 `npm run tauri:build`

### 框架与训练流程

- [x] `GameDefinition` 增加封面、预计时长、玩法说明和版本化交互引导
- [x] 教程按标准化 `GameInput` 完成左、右、加速、减速 400ms 保持，并使用 `rehab.game-tutorial.v1` 持久化
- [x] 教程位于中心校准之后、训练倒计时之前，不进入训练时长和 Replay
- [x] 训练暂停提供继续、玩法说明与结束入口；未完成训练退出前统一确认且不保存历史
- [x] River 初始开始和恢复均提供 3 秒准备时间

### River 正式游戏

- [x] 固定 10,800 世界单位、六段任务、20 星星、10 训练门、8 障碍和 2 HoldZone
- [x] 控制死区、横向加速度/阻尼、45–80 前进速度、软边界和碰撞减速保护
- [x] 星星、训练门、Hold、Combo 计分以及 assist/normal/challenge 保守动态难度
- [x] River 结果覆盖得分、Combo、收集、三方向门、碰撞、稳定度、反应、速度和输入极值
- [x] TrainingRecord V2 / Replay V1 保持不变，保存 River 世界快照、船体 25Hz 轨迹与事实事件
- [x] River 动态回放和世界坐标完整轨迹不重新运行游戏判定

### 美术、音频与自动验证

- [x] 封面、小船、星星、岩石、漂木与植被正式本地素材及生成记录
- [x] CC0 Forest Ambience、Kenney Interface Sounds 与 Music Jingles 本地打包和许可清单
- [x] 音频音量、暂停/恢复、播放失败降级与销毁流程
- [x] 42 个测试文件、167 项单元测试与 `npm run build` 通过
- [x] Android Debug APK 构建通过，River 图像与音频已随 Web Assets 打包
- [x] Windows Release 主程序与 `RehabGame_0.9.0_x64-setup.exe` 编译完成
- [ ] 当前验证进程缺少 `TAURI_SIGNING_PRIVATE_KEY`，需注入私钥后补验 Updater `.sig`
- [ ] 当前验证进程缺少 Android Release 签名变量，需注入既有 JKS 后补验 Signed APK
- [ ] Windows / Android 双端真实设备方向映射、完整关卡和主动结束回归
- [ ] 暂停、后台、断线重校准、恢复倒计时、历史与 River Replay 实机回归
- [ ] 桌面 60 FPS、Android 目标 60 FPS/最低 30 FPS 与连续多局 30 分钟稳定性验收
