# 共享目录布局规范

共享目录根路径：

```text
\\100.86.229.25\lobster-share\browser_modules\
```

## 1. 正式目录结构

```text
browser_modules/
  package.json
  package-lock.json
  .env
  .env.example
  config/
  docs/
  src/
    browser_modules/
      core/
      db/
      bindings/
      profile/
      sessions/
      sites/
      cli/
  data/
  runtime/
    logs/
    locks/
    temp/
  artifacts/
    profile-archives/
    run-evidence/
  secrets/
    browser-foundation/
  scripts/
  node_modules/
```

## 2. 后续代码放置位置

- `src/browser_modules/core/`: Roxy/Rosie API 接入和浏览器资源服务
- `src/browser_modules/db/`: SQLite、migration、repository
- `src/browser_modules/bindings/`: profile/account/proxy/api/machine 绑定
- `src/browser_modules/profile/`: profile 定位、归档、恢复
- `src/browser_modules/sessions/`: Cookies、storage、运行态快照
- `src/browser_modules/sites/`: 站点适配和验收规则
- `src/browser_modules/cli/`: 给人工和 Kimi 执行的命令入口

## 3. 当前同步口径

当前共享目录为用户本人三台机器私有环境，默认全量同步：

- `.env`
- `data/`
- `artifacts/`
- `secrets/`
- `node_modules/`

其中 `node_modules/` 是为了让 Kimi 直接执行，减少依赖安装失败。

## 4. 禁止事项

- 不要把临时代码放到共享目录根目录
- 不要手工修改 `data/browser_foundation.db`
- 不要跳过 CLI 直接编辑 binding
- 不要跳过 profile 归档直接删窗口
