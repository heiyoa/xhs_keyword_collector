# 小红书最小试运行 Runbook

目标：

- 围绕 `xhs-main-binding`
- 支撑利维坦直接做一轮最小试运行
- 不扩展到采词、发布、业务逻辑

## 1. 输入约束

本轮小红书试运行入口只接受：

- `binding_key`
- `task_payload`
- `run_key`

禁止：

- 手工写死 `dirId`
- 手工猜 profile 路径
- 手工猜 API key
- 手工拼 proxy

## 2. 重要执行口径

Windows 上 `better-sqlite3` 这类 native module 不应直接从共享目录执行。

利维坦应当：

1. 以共享目录为发布源
2. 先同步到本机运行镜像目录
3. 再从本机运行镜像目录执行 CLI

推荐本机运行镜像目录：

```text
C:\browser_modules_runtime
```

准备命令：

```powershell
.\scripts\prepare-local-runtime.ps1
```

## 3. 入口命令

在本机运行镜像目录中执行：

```bash
node --env-file=.env src/browser_modules/cli/xhs-trial-cli.js run --binding-key=xhs-main-binding --run-key=<run_key> --task-payload=<json_or_@file>
```

## 4. 推荐 task_payload

### 4.1 最轻量 resolve

```json
{
  "mode": "resolve",
  "machine_browser_binding_key": "leviathan-roxy-jennifer"
}
```

### 4.2 preflight

```json
{
  "mode": "preflight",
  "machine_browser_binding_key": "leviathan-roxy-jennifer"
}
```

### 4.3 smoke

```json
{
  "mode": "smoke",
  "machine_browser_binding_key": "leviathan-roxy-jennifer",
  "target_url": "https://creator.xiaohongshu.com/",
  "close_after_run": true,
  "delete_after_run": true
}
```

## 5. 推荐执行顺序

1. `resolve`
2. `preflight`
3. `smoke`

## 6. 示例命令

### resolve

```bash
node --env-file=.env src/browser_modules/cli/xhs-trial-cli.js run --binding-key=xhs-main-binding --run-key=xhs-resolve-001 --task-payload=@runtime/temp/xhs-resolve.json
```

### preflight

```bash
node --env-file=.env src/browser_modules/cli/xhs-trial-cli.js run --binding-key=xhs-main-binding --run-key=xhs-preflight-001 --task-payload=@runtime/temp/xhs-preflight.json
```

### smoke

```bash
node --env-file=.env src/browser_modules/cli/xhs-trial-cli.js run --binding-key=xhs-main-binding --run-key=xhs-smoke-001 --task-payload=@runtime/temp/xhs-smoke.json
```

## 7. 成功标准

### resolve 成功

```json
{
  "status": "ok",
  "mode": "resolve"
}
```

### preflight 成功

```json
{
  "status": "ok",
  "mode": "preflight"
}
```

### smoke 成功

```json
{
  "status": "ok",
  "mode": "smoke",
  "smoke": {
    "smoke_passed": true,
    "cleanup_passed": true
  }
}
```

## 8. 当前已知风险

1. 共享目录原生依赖不能保证直接执行稳定
2. `better-sqlite3` 必须与目标 Node 版本匹配
3. PowerShell 直接传 JSON 易出错，推荐 `@payload.json`
4. preflight 如果失败且 `failed_stage=api-health`，说明浏览器 API 当前不可达
