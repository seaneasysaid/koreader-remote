# KOReader Remote — 安卓 App

[![Downloads](https://img.shields.io/github/downloads/seaneasysaid/koreader-remote/total?style=flat-square&label=Downloads&color=3d8bff&logo=github)](https://github.com/seaneasysaid/koreader-remote/releases)

把 [KOReader 遥控页面](../) 打包成安卓 App：一个轻量 **WebView 壳** + **离线内嵌的遥控页面**。

> 想直接用网页版？看[仓库主页](../)。

## 功能

- 📦 **离线内嵌**：遥控页面打包进 APK，打开即用，无需联网加载界面
- 🔊 **音量键翻页**：音量上 = 上一页，音量下 = 下一页
  - App 内可一键切换「翻页 / 调音量」，选择自动记住
- 📸 **截图存手机**：点截图按钮，通过原生桥把 KOReader 当前屏幕 PNG
  直接写入系统「下载」目录（`MediaStore`，无需存储权限弹窗）
- 🔗 连接 KOReader 设备，默认 `http://192.168.0.100:8080`（可改）

界面、按钮、键盘映射与[网页版](../)完全一致。

## 下载安装

到 [**Releases**](https://github.com/seaneasysaid/koreader-remote/releases) 下载
`koreader-remote-v1.0.0.apk` 直接安装。

- 已用 debug key 签名，Android 11+ 会提示「未知来源」，允许即可
- 系统要求：**Android 7.0+**（minSdk 24）

## 使用

1. 打开 App，填入 KOReader 设备的 **IP:端口**（默认 `192.168.0.100:8080`）。
2. 确认手机与阅读器在**同一 Wi‑Fi**，点 **连接**。
3. 点按钮遥控；**音量上/下键 = 上一页/下一页**。
4. 点「🔊 音量键」可切到「调音量」，让音量键恢复系统默认行为。

---

## 从源码构建

### 环境

- **JDK 17**
- **Android SDK**：`platforms;android-34`、`build-tools;34.0.0`
- Node.js（仅用于跑构建脚本）

### 构建

```bash
node build_apk.js
```

产出：**`out/koreader-remote.apk`**（已签名，v1/v2/v3）。

构建脚本走的是标准工具链，**不需要 Gradle**：

```
javac → d8 → aapt2 compile/link → jar uf → zipalign → apksigner
```

> ⚠️ 两个容易踩的坑（脚本里已处理）：
> 1. Android 11+ 要求 `resources.arsc` **不压缩且 4 字节对齐**。因此不能整包
>    重打包，必须保留 aapt2 的产物，只用 `jar uf` 追加 `classes.dex` 与 `assets/`。
> 2. `d8` 的输出给**目录**时才会直接生成 `classes.dex`；且必须传入**全部**
>    `.class` 文件（含内部类），否则报 `requires its nest mates`。

### 安装到设备

```bash
adb install -r out/koreader-remote.apk
```

Windows + MuMu 模拟器（`127.0.0.1:16384`）可直接跑：

```bat
install.bat
```

---

## 目录结构

```
.
├── build_apk.js                 # 构建脚本（javac/d8/aapt2/zipalign/apksigner）
├── install.bat                  # MuMu 模拟器一键安装
├── out/
│   └── koreader-remote.apk      # 构建产物（已签名）
└── project/app/
    ├── assets/
    │   ├── index.html           # 离线遥控页面（与网页版同源）
    │   ├── icon-192.png
    │   └── icon-512.png
    └── src/main/
        ├── AndroidManifest.xml
        ├── java/com/koreader/remote/MainActivity.java   # WebView 壳 + 原生桥
        └── res/                 # 图标与主题资源
```

### 原生桥（`MainActivity.java`）

页面通过 `window.KR` 调用原生能力：

| 方法 | 作用 |
|------|------|
| `KR.saveScreenshot(baseUrl)` | 拉取 `/koreader/device/screen/bb` 并写入系统下载目录 |
| `KR.setVolumePageMode(bool)` | 设置音量键为「翻页」还是「调音量」 |

音量键在 `dispatchKeyEvent` 中拦截：翻页模式下消费按键（不弹音量条）并调用
`window.runAction('prev'/'next')`；调音量模式则交还系统处理。

> 注：`index.html` 的脚本包在 IIFE 里，`runAction` 等函数默认不是全局的，
> 因此文件末尾显式挂了 `window.runAction` —— 否则原生层注入的调用会静默失败。

---

## 说明与限制

- 本目录**未包含**约 1 GB 的 `build/` 工具链缓存（JDK、Android SDK 等），
  构建前请自行准备上方的环境。
- 截图与所有遥控指令都需要手机与阅读器在**同一局域网**。
- 仅支持 KOReader 自带的 HTTP 接口，需设备端开启服务。
