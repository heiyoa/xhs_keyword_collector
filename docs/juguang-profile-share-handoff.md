# 聚光登录态 Profile 交接说明

## 1. 本次交接目标

将当前电脑中可正常登录聚光的指纹浏览器 profile 复制到共享目录，供利维坦后续继续复用。

## 2. 本次确认的目标资产

- `binding_key`: `xhs-main-binding`
- `profile_key`: `xhs-exam-main`
- `source_dir_id`: `ed8816f10fd87e08a6f5276daea66b09`

本次 fresh snapshot：

- `snapshot_key`: `xhs-exam-main-20260425162127-e1027d`

## 3. 共享目录中的复用位置

共享目录目标路径：

```text
\\100.86.229.25\lobster-share\browser_modules\artifacts\profile-archives\xhs-exam-main\xhs-exam-main-20260425162127-e1027d
```

交接 manifest：

```text
\\100.86.229.25\lobster-share\browser_modules\artifacts\profile-archives\xhs-exam-main\latest-juguang-share.json
```

## 4. 利维坦后续如何引用

### 4.1 先准备本机运行镜像

```powershell
.\scripts\prepare-local-runtime.ps1
```

### 4.2 查看资产状态

```bash
node --env-file=.env src/browser_modules/cli/profile-lifecycle-cli.js asset-status --binding-key=xhs-main-binding
```

### 4.3 直接基于本次 snapshot 重建窗口

```bash
node --env-file=.env src/browser_modules/cli/profile-lifecycle-cli.js rebuild-window --binding-key=xhs-main-binding --snapshot-key=xhs-exam-main-20260425162127-e1027d
```

### 4.4 后续继续跑聚光链路

重建成功后，再继续访问：

```text
https://ad.xiaohongshu.com/
```

或直接跑聚光相关 CLI。

## 5. 注意事项

1. 这次复用的核心是 snapshot，不是旧窗口实例
2. 不要依赖旧 `dirId` 继续跑
3. 如果共享目录可达但 native module 不稳定，必须走本机运行镜像目录
