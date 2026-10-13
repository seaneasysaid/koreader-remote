# KOReader Remote — Android App (APK)

把 KOReader 遥控网页打包成安卓 APK：一个轻量 **WebView 壳** + **离线内嵌的遥控页面**。

## 功能
- 离线内嵌遥控页面（打开 App 即可用，无需联网加载 UI）
- **音量键翻页**：音量上键 = 上一页，音量下键 = 下一页
  - App 内可一键切换「翻页 / 调音量」模式（设置会记住）
- **截图保存到手机**：点截图 → 通过原生桥把 KOReader 屏幕 PNG 直接写入系统「下载」目录
- 连接 KOReader 设备（默认 `http://192.168.0.100:8080`）

## 构建
环境：JDK 17 + Android SDK（platform-34、build-tools 34.0.0）。

```bash
node build_apk.js
```

产出：`out/koreader-remote.apk`（已用 debug key 签名，v1/v2/v3）。

> 说明：仓库未上传约 1GB 的 `build/` 工具链目录（JDK、Android SDK 等）。
> `build_apk.js` 直接走 `javac → d8 → aapt2 → zipalign → apksigner` 流水线，无需 Gradle。

## 安装
- Windows（已配 MuMu 模拟器）：`install.bat` 使用 MuMu 自带 adb 安装到 `127.0.0.1:16384`
- 任意设备：`adb install out/koreader-remote.apk`

## 目录结构
- `project/app/assets/index.html` —— 离线遥控页面
- `project/app/src/main/java/com/koreader/remote/MainActivity.java` —— WebView 壳 + 原生桥
- `project/app/src/main/AndroidManifest.xml` 及 `res/` —— 清单与图标资源
- `out/koreader-remote.apk` —— 已构建并签名的 APK
- `build_apk.js` / `install.bat` —— 构建与安装脚本
