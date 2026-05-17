# Browser Modules Foundation

本目录是浏览器模块底座，不是单个临时脚本。

目标是支撑“小红书考试资料搜索流量路径”后续任务中的浏览器资源、profile、账号、IP、API key、窗口复用和站点执行。

## 1. 当前定位

本模块负责：

- Roxy/Rosie Browser API 接入
- profile 归档与恢复
- 账号 / IP / API key / 指纹浏览器账号绑定
- Cookies / storage / 窗口状态复用
- 后续社媒矩阵脚本的统一浏览器入口

本模块当前不负责：

- 自动发布
- 商品上架
- 搜索词采集业务逻辑
- 内容生成
- 调度系统

## 2. 技术架构

当前采用分层技术栈：

```text
Node.js + SQLite
  负责浏览器模块底座

Python + DrissionPage
  未来负责社媒页面执行层

Playwright
  保留用于状态采样、CDP 验证、截图、cookie/storage 检测

Roxy/Rosie Browser API
  负责窗口资源管理
```

## 3. 技术边界

### 3.1 Node.js 负责底座

Node.js 是当前正式底座语言。

负责：

- `core/`: Roxy API 接入
- `db/`: SQLite 和 migrations
- `bindings/`: 账号/IP/API/profile/machine 绑定
- `profile/`: profile 定位、归档、恢复
- `sessions/`: Cookies 和 storage 快照
- `cli/`: 给人和 Kimi 执行的命令

不要用 Python 重写这些底座能力。

### 3.2 Python + DrissionPage 负责页面执行

后续如果引入 DrissionPage，只放在页面执行层。

建议目录：

```text
runners/
  python/
    drission/
      requirements.txt
      connect_check.py
      xiaohongshu/
      wechat_channels/
      bilibili/
```

DrissionPage 适合：

- 接管 Roxy 已打开窗口
- 点击页面
- 输入内容
- 处理 iframe
- 等待元素
- 做社媒页面操作

DrissionPage 不负责：

- 管理 Roxy API key
- 管理 DB binding
- 管理 profile 归档
- 决定哪个账号用哪个 IP

### 3.3 Playwright 保留

Playwright 保留用于：

- CDP 连接验证
- Cookies / storage 抽取
- 页面截图
- 登录态验证
- 调试阶段状态采样

不要把 Playwright 当成唯一页面执行技术，也不要删除现有 Playwright 验证能力。

## 4. 跨语言协作协议

不同语言不直接抢职责，通过以下方式协作：

- `binding_key`
- SQLite
- CLI JSON
- Roxy 返回的 `ws/http` CDP endpoint

Python runner 的推荐流程：

1. 调 Node CLI 解析 binding
2. 调 Node CLI 创建/恢复/打开窗口
3. 获取 `ws/http` endpoint
4. DrissionPage 接管窗口
5. 输出 JSON 结果
6. Node CLI 或 DB 记录执行结果

## 5. 正式模块目录

正式模块只放：

```text
src/browser_modules/
```

结构：

```text
src/browser_modules/
  core/
  db/
  bindings/
  profile/
  sessions/
  sites/
  cli/
```

不要把新正式模块放到 `src/` 根目录。

`src/` 根目录下旧脚本只作为历史验证脚本保留。

## 6. 当前稳定 CLI

查看绑定：

```bash
node --env-file=.env src/browser_modules/cli/binding-cli.js list
```

解析业务 binding：

```bash
node --env-file=.env src/browser_modules/cli/binding-cli.js resolve --binding-key=xhs-main-binding
```

解析机器-指纹浏览器 binding：

```bash
node --env-file=.env src/browser_modules/cli/binding-cli.js resolve-machine-browser --binding-key=leviathan-roxy-jennifer
```

保存 profile：

```bash
node --env-file=.env src/browser_modules/cli/profile-archive-cli.js save --binding-key=xhs-main-binding --source-dir-id=<dir_id>
```

恢复 profile：

```bash
node --env-file=.env src/browser_modules/cli/profile-archive-cli.js restore --binding-key=xhs-main-binding --snapshot-key=<snapshot_key>
```

闭环验证：

```bash
node --env-file=.env src/browser_modules/cli/profile-smoke-cli.js run --binding-key=xhs-main-binding
```

## 7. 共享目录

共享目录：

```text
\\100.86.229.25\lobster-share\browser_modules\
```

当前同步策略是全量同步，包括：

- `.env`
- `data/`
- `artifacts/`
- `secrets/`
- `node_modules/`

同步命令：

```powershell
.\scripts\sync-to-leviathan.ps1
```

利维坦本机运行镜像准备命令：

```powershell
.\scripts\prepare-local-runtime.ps1
```

## 8. 当前已登记的机器绑定

### 8.1 本机

- `machine_key`: `local-dev`
- 内网 IP: `100.86.235.34`
- API credential: `roxy-local`
- machine-browser binding: `local-roxy-current`

### 8.2 利维坦

- `machine_key`: `leviathan`
- 用户名: `aiops`
- 内网 IP: `100.86.229.25`
- 公网 IP: `172.20.129.87`
- API credential: `roxy-leviathan`
- machine-browser binding: `leviathan-roxy-jennifer`

## 9. 后续开发优先级

下一步优先级：

1. 保持 Node 底座稳定
2. 增加 Python/DrissionPage runner 最小接管验证
3. 将小红书页面动作放入 `runners/python/drission/xiaohongshu/`
4. 视频号、B站按同样方式扩展

不要做：

- 不要推翻 Node 底座
- 不要让 Python 直接管理 DB 和 profile 归档
- 不要把 DrissionPage 脚本散放在共享目录根目录

## 10. 必读文档

后续开发先读：

- `docs/windows-encoding-agent-notes.md`
- `docs/development-maintenance-update.md`
- `docs/leviathan-operator-guide.md`
- `docs/browser-module-foundation.md`
- `docs/profile-asset-lifecycle.md`
- `docs/machine-credential-bindings.md`
- `docs/profile-archive-runbook.md`

## 11. Windows 与编码风险

当前项目运行在 Windows + PowerShell + UNC 共享目录环境。

后续 Agent 必须先看：

```text
docs/windows-encoding-agent-notes.md
```

里面记录了：

- PowerShell 中文乱码
- UNC 路径运行 npm 的问题
- better-sqlite3 原生依赖问题
- node_modules/profile 同步很慢
- Roxy 窗口 delete 后仍需回查
- profile 归档前必须关闭窗口

另外，带 native module 的 CLI 应从本机运行镜像目录执行，不建议直接在 UNC 共享路径运行。
