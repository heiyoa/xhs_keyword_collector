# 开发、维护、更新规范

## 1. 开发原则

本机负责研发与验证，利维坦负责执行。

所有新能力先在本机验证，再同步到：

```text
\\100.86.229.25\lobster-share\browser_modules\
```

## 2. 代码开发位置

正式模块代码只能放：

```text
src/browser_modules/
```

旧的 `src/*.js` 保留为历史验证脚本，不再作为新模块入口。

## 3. 模块边界

- `core/`: 浏览器资源 API
- `db/`: SQLite 和 migration
- `bindings/`: 账号/IP/API/profile/machine 绑定
- `profile/`: profile 归档与恢复
- `sessions/`: Cookies 和 storage 快照
- `sites/`: 平台验证规则
- `cli/`: 执行入口

## 4. 数据库更新规范

数据库结构只能通过 migration 更新。

新增 migration 放在：

```text
src/browser_modules/db/migrations/
```

命名规则：

```text
003_xxx.sql
004_xxx.sql
```

不要直接手改 `data/browser_foundation.db`。

## 5. CLI 规范

所有给 Kimi 执行的能力必须有 CLI。

CLI 放在：

```text
src/browser_modules/cli/
```

CLI 输出必须是 JSON。

## 6. 本机验证流程

每次修改后至少跑：

```bash
npm run db:init
node --check src/browser_modules/cli/binding-cli.js
node --check src/browser_modules/cli/profile-archive-cli.js
node --env-file=.env src/browser_modules/cli/binding-cli.js list
```

涉及 profile 归档/恢复时，还要跑：

```bash
node --env-file=.env src/browser_modules/cli/profile-smoke-cli.js run --binding-key=xhs-main-binding
```

## 7. 同步到共享目录

默认全量同步：

```powershell
.\scripts\sync-to-leviathan.ps1
```

默认同步内容：

- `package.json`
- `package-lock.json`
- `.env`
- `.env.example`
- `config/`
- `docs/`
- `src/`
- `scripts/`
- `data/`
- `artifacts/`
- `secrets/`
- `node_modules/`

如果不想同步 `node_modules`：

```powershell
.\scripts\sync-to-leviathan.ps1 -SkipNodeModules
```

## 8. 利维坦更新流程

进入共享目录后执行：

```bash
node --env-file=.env src/browser_modules/cli/binding-cli.js list
node --env-file=.env src/browser_modules/cli/binding-cli.js resolve-machine-browser --binding-key=leviathan-roxy-jennifer
```

如果 native 依赖损坏，再执行：

```bash
npm install
```

## 9. 当前稳定入口

```bash
node --env-file=.env src/browser_modules/cli/binding-cli.js list
node --env-file=.env src/browser_modules/cli/binding-cli.js resolve --binding-key=<binding_key>
node --env-file=.env src/browser_modules/cli/binding-cli.js resolve-machine-browser --binding-key=<machine_browser_binding>
node --env-file=.env src/browser_modules/cli/profile-archive-cli.js save --binding-key=<binding_key> --source-dir-id=<dir_id>
node --env-file=.env src/browser_modules/cli/profile-archive-cli.js restore --binding-key=<binding_key> --snapshot-key=<snapshot_key>
node --env-file=.env src/browser_modules/cli/profile-smoke-cli.js run --binding-key=<binding_key>
```
