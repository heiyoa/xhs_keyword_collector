# Windows / 编码 / 共享目录注意事项

这份文档给后续 Agent、Kimi、Codex 使用。

当前项目运行在 Windows + PowerShell + UNC 共享目录环境，容易出现一些不是业务逻辑错误的问题。遇到失败时先检查本文件。

## 1. PowerShell 中文显示乱码

现象：

- `Get-Content docs/*.md` 时中文显示成乱码
- 例如中文被显示成 `绐楀彛`、`娴忚鍣` 等

判断：

- 这通常是 PowerShell 控制台编码显示问题
- 不一定代表文件本身坏了
- Markdown 文件应按 UTF-8 保存

建议：

1. 不要因为终端显示乱码就重写整份文档
2. 如果要确认内容，优先用编辑器打开
3. 新增/编辑文件时保持 UTF-8
4. 代码文件默认 ASCII，文档允许中文 UTF-8

## 2. PowerShell 参数中的 JSON 容易被转义破坏

现象：

- CLI 参数传 JSON 时失败
- 报错类似：

```text
Expected property name or '}' in JSON at position 1
```

原因：

- PowerShell 对引号、反斜杠和 JSON 字符串处理复杂

建议：

1. CLI 参数尽量避免直接传复杂 JSON
2. 优先传简单字段
3. 复杂数据后续应支持 `--file=<json_path>`
4. 如果必须传 JSON，用单引号包裹，但仍需小心 Windows 转义

## 3. UNC 路径不能直接作为 npm 工作目录

现象：

在共享目录执行：

```powershell
npm install
```

可能报：

```text
UNC paths are not supported. Defaulting to Windows directory.
Could not read package.json
```

原因：

- `cmd.exe` 不支持 UNC 当前目录
- npm 底层可能退回 `C:\Windows`

正确做法：

1. 使用映射盘符
2. 或者在利维坦本机把共享目录映射成固定盘符

示例：

```cmd
net use Z: \\100.86.229.25\lobster-share\browser_modules
cd /d Z:\
npm install
```

当前项目已经默认同步 `node_modules/`，通常不需要在共享目录上重新安装。

## 4. better-sqlite3 是原生依赖

现象：

运行 CLI 时可能报：

```text
Cannot find package better-sqlite3
```

或：

```text
Cannot find better_sqlite3.node
```

原因：

- `better-sqlite3` 有 native binary
- `node_modules` 不完整或与当前 Node/系统不匹配

处理：

1. 先确认文件存在：

```text
node_modules/better-sqlite3/build/Release/better_sqlite3.node
```

2. 如果不存在，重新同步 `node_modules`
3. 如果存在但仍加载失败，在目标机器执行：

```bash
npm install
```

## 5. node_modules 同步很慢

现象：

- 同步 `node_modules` 可能耗时数分钟
- 网络共享盘上文件很多，速度慢

当前策略：

- 默认同步 `node_modules`
- 因为 Kimi 很笨，尽量让它开箱即用

如果只改代码或文档，可跳过：

```powershell
.\scripts\sync-to-leviathan.ps1 -SkipNodeModules
```

## 6. artifacts/profile 同步很慢

现象：

- `artifacts/profile-archives/` 下 profile 文件很多
- `robocopy` 可能耗时很久
- 中途可能出现网络错误但重试后成功

判断：

- `robocopy` 返回码 `0-7` 通常不算失败
- 本项目脚本按 `>7` 才认为失败

建议：

1. 不要轻易中断 profile 同步
2. 同步后检查文件数量或关键 snapshot 目录
3. profile 归档是核心资产，不能随意删除

## 7. cmd / PowerShell 运行共享目录 CLI 的推荐方式

推荐使用盘符映射：

```cmd
net use Z: \\100.86.229.25\lobster-share\browser_modules
cd /d Z:\
node --env-file=.env src\browser_modules\cli\binding-cli.js list
net use Z: /delete /y
```

不要直接：

```cmd
cd \\100.86.229.25\lobster-share\browser_modules
```

## 8. 路径里有中文时的注意事项

本机开发路径：

```text
d:\zhuomian\rb指纹验证
```

注意：

- 一些老工具或日志输出会把中文路径显示成乱码
- 只要命令实际成功，不要误判
- 后续利维坦共享目录使用英文 `browser_modules`，比本机路径更稳

## 9. .env 同步策略

当前项目口径：

- `.env` 会同步到共享目录
- 因为三台机器都是同一用户私有环境

但 Agent 仍要注意：

1. 不要随意覆盖 `.env`
2. 改 `.env` 后要说明改了哪些字段
3. 不要把 `.env` 路径改成不存在的位置

## 10. DB 文件不要手工编辑

数据库位置：

```text
data/browser_foundation.db
```

禁止：

- 手工编辑 DB
- 手工删除表
- 手工改 binding

必须通过 CLI 或 migration：

```bash
node --env-file=.env src/browser_modules/cli/binding-cli.js ...
```

## 11. Roxy 窗口清理必须回查

经验问题：

- 有时 `/browser/delete` 返回成功，但窗口进程仍短暂存在
- 必须回查 `connection_info`

正确流程：

1. `close`
2. `delete`
3. 等待几秒
4. 查 `/browser/connection_info`
5. 查 `/browser/list_v3`

不要只看 delete 返回成功。

## 12. profile 归档前必须关闭窗口

profile 文件包含 SQLite、LevelDB、缓存等文件。

如果窗口还开着：

- 文件可能未 flush
- 文件可能被锁
- profile 归档不完整

生产级流程：

1. 关闭窗口
2. 等待 2-3 分钟
3. 复制 profile
4. 记录 snapshot
5. 再删除窗口

smoke 测试可以等待较短，但正式归档不要省等待。

## 13. 后续 Agent 首先应读的文档

按顺序读：

1. `README.md`
2. `docs/windows-encoding-agent-notes.md`
3. `docs/leviathan-operator-guide.md`
4. `docs/development-maintenance-update.md`
5. `docs/profile-archive-runbook.md`
