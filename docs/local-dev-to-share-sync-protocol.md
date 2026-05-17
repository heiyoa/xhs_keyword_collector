# 本机开发到共享目录同步协议

## 1. 原则

本机是开发目录，共享目录是发布源。

Windows 上不建议直接从共享目录运行带 native module 的 CLI。

推荐分两层：

1. 本机开发目录
2. 共享目录发布源
3. 利维坦本机运行镜像

## 2. 同步流程

### 2.1 开发机 -> 共享目录

```powershell
.\scripts\sync-to-leviathan.ps1
```

### 2.2 共享目录 -> 利维坦本机运行镜像

```powershell
.\scripts\prepare-local-runtime.ps1
```

## 3. 运行位置

不要直接在 UNC 共享路径运行浏览器模块 CLI。

应在本机运行镜像目录执行：

```text
C:\browser_modules_runtime
```

## 4. 验证顺序

1. 在开发机验证
2. 同步到共享目录
3. 在利维坦本机运行镜像验证
