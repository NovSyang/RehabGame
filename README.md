# RehabGame 0.9.0

RehabGame 是面向 BS-BT91 传感器的跨平台康复训练应用。Windows 使用 Tauri，Android 使用 Capacitor，两端共享 BLE 数据解析、运动处理、训练、历史与轨迹回放代码。0.9.0 新增“森林溪谷漂流”，形成三款正式训练游戏。

```text
BS-BT91 → BLE 自动恢复 → 每局中心 Zero → MotionProfile
→ MotionProcessor → GameInput → TargetReach / TrajectoryFollow / Forest River
→ TrainingRecord → History / Replay
```

## 当前能力

- Windows Tauri 与 Android Capacitor BLE：扫描、连接、Notify、Write、断线恢复及电量状态。
- 中心校准、四方向个人 ROM、MotionProfile 持久化与每局训练前置。
- 四方向目标触达、8 字轨迹跟随和森林溪谷漂流三款正式训练游戏。
- River 包含首次交互教程、星星/训练门/避障/保持任务、保守动态难度、结果统计与事实回放。
- IndexedDB 混合训练历史，以及动态、Seek、倍速和完整二维轨迹回放。
- Windows Tauri Updater：签名更新包检查、下载和安装。
- Android 本地更新插件：APK 下载、SHA-256、包名、版本号和签名证书校验，以及 PackageInstaller 安装。
- 更新策略支持“静默、提示、手动”；训练、首次设置和 ROM 标定期间由安全锁延迟安装。

## 开发与验证

Windows 10/11 开发需要 Node.js 22+、Rust stable、Visual Studio C++ Desktop workload 和 WebView2 Runtime。Android 构建还需要 JDK 21、Android SDK 36、Build Tools 36 和 adb。

```powershell
npm install
npm run test
npm run build
npm run tauri:dev
npm run android:build:debug
```

Debug APK 位于 `android/app/build/outputs/apk/debug/app-debug.apk`。浏览器仅用于界面预览，不支持 BLE 和在线更新。

## 版本基线

`release-version.json` 是跨平台版本的唯一来源。修改版本后先同步，再检查是否存在漂移：

```powershell
npm run version:sync
npm run version:check
```

0.9.0 固定使用：

- Windows：`RehabGame / com.rehabgame.app / 0.9.0`
- Android：`versionName 0.9.0 / versionCode 9`
- GitHub Releases：`NovSyang/RehabGame`

## 签名构建

私钥、JKS 和密码必须保留在仓库外，只通过当前构建终端的环境变量注入。可复制 `.env.example` 中的变量名作为参考，但不要把真实值写入项目文件。

```powershell
$env:TAURI_SIGNING_PRIVATE_KEY = 'D:\path\to\rehabgame-updater.key'
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = '***'
npm run tauri:build

$env:REHAB_ANDROID_KEYSTORE_PATH = 'D:\path\to\rehabgame-release.jks'
$env:REHAB_ANDROID_STORE_PASSWORD = '***'
$env:REHAB_ANDROID_KEY_PASSWORD = '***'
$env:REHAB_ANDROID_KEY_ALIAS = 'rehabgame'
npm run android:build:release
npm run android:bundle
```

Android Release 任务缺少签名变量时会主动失败，Debug 构建不受影响。旧 Debug APK 与正式 Release APK 的签名不同，首次切换到 Release 安装时需要卸载 Debug APK；卸载会同时清除应用的 localStorage、IndexedDB、个人 ROM、绑定和训练历史。

## 发布清单

签名构建完成后，在仓库根目录生成 GitHub Release 所需清单。输出目录 `release-output/` 已被 Git 忽略。

```powershell
npm run release:manifest:windows
npm run release:manifest:android
```

脚本默认读取标准 Release 输出路径。需要自定义路径或发布说明时，可直接执行 `node scripts/generate-tauri-update-manifest.mjs --artifact <path> --notes <path>` 或 Android 对应脚本，避免不同 npm 版本对附加参数的处理差异。

人工创建对应版本 GitHub Release，并上传 Windows 更新包、对应 `.sig`、Android Release APK、`latest.json`、`android-latest.json` 和 `SHA256SUMS.txt`。不要上传私钥、JKS、密码或 `.env`。

## River 素材

River 正式美术位于 `public/assets/games/river/`，生成提示保存在同目录 `GENERATED_ASSETS.md`。随包 CC0 音频的来源、许可与文件映射见 `THIRD_PARTY_ASSETS.md`。

## 0.8.1 升级验收

1. 将 `release-version.json` 提升到 0.8.1，并递增 Android `versionCode`，然后执行版本同步。
2. 使用与 0.8.0 相同的 Tauri 私钥和 Android JKS 构建两端 Release。
3. 生成清单并发布 `v0.8.1` 资产。
4. 从已安装的 0.8.0 验证检查、下载、训练安全锁、Android 未知来源授权和覆盖安装。
5. 验证升级后 Profile、Binding、训练历史和 Replay 均保留。

## 安全边界

- 更新端点不内置 GitHub PAT，发布资产必须可公开读取。
- Android APK 必须同时通过 SHA-256、包名、递增版本号和同签名证书校验。
- Windows 更新包由 Tauri Updater 使用配置中的公开密钥验证。
- 在线更新失败只影响更新状态，不得中断 BLE、训练、历史或回放。
