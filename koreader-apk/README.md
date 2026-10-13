# KOReader Remote — 安卓 App（APK）

把 KOReader 遥控网页打包成一个轻量的安卓 App：**WebView 壳** + **离线内嵌的遥控页面**。

## 功能
- 📦 **离线内嵌**：遥控页面打包进 APK，打开即用，无需联网加载 UI
- 🔊 **音量键翻页**：音量上键 = 上一页，音量下键 = 下一页
  - App 内可一键切换「翻页 / 调音量」模式（选择会自动记住）
- 📸 **截图存手机**：点截图按钮 → 通过原生桥把 KOReader 当前屏幕 PNG 直接写入系统「下载」目录
- 🔗 连接 KOReader 设备（默认 `http://192.168.0.100:8080`，可改）

## 下载安装（推荐）
到 **[Releases](https://github.com/seaneasysaid/koreader-remote/releases)** 页面下载
`koreader-remote-v1.0.0.apk`，安装即可使用（已用 debug key 签名）。

> Android 11+ 安装会提示「未知来源」，允许后即可。若安装失败，确认设备架构与系统版本（minSdk 24 / Android 7.0+）。

## 从源码构建
环境：JDK 17 + Android SDK（`platform-34`、`build-tools 34.0.0`）。

```bash
node build_apk.js
```

产出：`out/koreader-remote.apk`（已签名，v1/v2/v3）。

> 说明：仓库未上传约 1 GB 的 `build/` 工具链目录（JDK、Android SDK 等）。
> `build_apk.js` 直接走 `javac → d8 → aapt2 → zipalign → apksigner` 流水线，无需 Gradle。

## 安装到设备
- MuMu 模拟器（已配置）：`install.bat` 用 MuMu 自带 adb 安装到 `127.0.0.1:16384`
- 任意设备：`adb install out/koreader-remote.apk`

## 使用
1. 打开 App，填 KOReader 设备的 IP:端口（默认 `192.168.0.100:8080`）。
2. 手机/模拟器与 KOReader 设备需在同一局域网。
3. **音量上键 = 上一页，音量下键 = 下一页**；点截图 → 存到「下载」目录。
   - 想用音量键正常调音量时，在「🔊 音量键」处切到「调音量」即可。

## 目录结构
- `project/app/assets/index.html` —— 离线遥控页面
- `project/app/src/main/java/com/koreader/remote/MainActivity.java` —— WebView 壳 + 原生桥
- `project/app/src/main/AndroidManifest.xml` 及 `res/` —— 清单与图标资源
- `out/koreader-remote.apk` —— 已构建并签名的 APK
- `build_apk.js` / `install.bat` —— 构建与安装脚本
