# RoxyBrowser 统一资源接入方案

## 1. 目标

本方案只验证三件事：

1. 是否能通过 RoxyBrowser MCP / API 读到浏览器资源。
2. MCP 与 API 各自适合承接什么职责。
3. 后续脚本如何复用同一套浏览器资源入口。

不在本轮扩展上传、自动发布和业务流程拍板。

## 2. 当前结论

### 2.1 能力判断

- `@roxybrowser/openapi` 官方支持三种模式：CLI、进程内 MCP、library 二次开发。
- `@roxybrowser/openapi` 暴露了 `roxy_list_workspaces`、`roxy_list_browsers`、`roxy_create_browser`、`roxy_open_browsers`、`roxy_get_connection_info` 等工具，说明“读取窗口”“创建窗口”“打开窗口”都属于 MCP 已覆盖能力。
- `@roxybrowser/playwright-mcp` 的职责不是管理浏览器资源，而是连接已打开窗口的 CDP 端点后执行页面自动化。

### 2.2 本机验证结果

验证时间：2026-04-21

- `GET /health` 成功，说明本地 API 服务在线。
- `GET /browser/connection_info` 初始返回空数组，说明验证开始时没有已打开窗口。
- `GET /browser/workspace` 成功，当前真实工作空间为 `98195`，工作空间名为 `JenniferRobinson4267's Workspace`。
- `GET /browser/list_v3` 成功，初始窗口列表为空。
- `POST /browser/create` 成功，说明资源层可以创建窗口。
- `POST /browser/open` 在默认 `30000ms` 超时下容易误判失败，但在 `120000ms` 超时下已成功返回 `ws`、`http`、`driver`、`pid`，随后 `GET /browser/connection_info` 可读到已打开窗口会话。

结论：本地 API 服务、窗口创建、窗口打开、会话读取链路均已验证通过；当前真正需要在接入层沉淀的是“更长超时”和“显式清理”。

## 3. A. 接入方案

### 3.1 推荐方案

采用“双层接入、单一资源模型”：

1. API 层作为脚本和模块的稳定资源入口。
2. MCP 层作为 AI Agent 的编排入口。
3. Playwright MCP 作为页面执行入口，不直接承担资源管理。

统一资源入口定义为：

- `Workspace`
- `BrowserProfile`
- `OpenedBrowserSession`

推荐链路：

1. `health`
2. `listWorkspaces`
3. `listBrowsers`
4. `createBrowser`
5. `openBrowser`
6. `getConnectionInfo`
7. 将返回的 `ws` / `http` 端点交给 Playwright 执行

### 3.2 为什么不让 MCP 直接成为唯一入口

- MCP 更适合 AI 调度，不适合作为业务代码内部 SDK。
- 后续脚本、定时任务、服务端作业更需要可测试、可封装、可限流的 API Client。
- MCP 工具名和 AI 客户端绑定较强，而 API 更适合沉淀成 repo 内部稳定接口。

### 3.3 最佳开发口径

后续脚本开发最佳方案：

- 浏览器资源管理统一走 repo 内 `RoxyApiClient`。
- AI 场景需要自然语言编排时，再挂 `roxybrowser-openapi` MCP。
- 页面交互统一走 Playwright，连接 `open`/`connection_info` 返回的 CDP 端点。

## 4. B. 最小可运行代码

本目录已提供一版零依赖最小实现：

- `src/roxy-client.js`
- `src/verify-roxy.js`
- `.env.example`
- `config/mcp.roxybrowser.example.json`

### 4.1 运行方式

先准备环境变量：

```bash
ROXY_API_HOST=http://127.0.0.1:50000
ROXY_API_KEY=你的key
ROXY_WORKSPACE_ID=可选
ROXY_TIMEOUT_MS=120000
```

执行只读验证：

```bash
npm run verify
```

显式验证创建窗口：

```bash
npm run verify:create
```

显式验证创建并打开窗口：

```bash
npm run verify:open
```

### 4.2 代码特点

- 默认限流到约 `1300ms/请求`，与 `50 次/分钟` 限制对齐。
- 支持通过 `ROXY_TIMEOUT_MS` 覆盖默认超时，建议在 `open` 链路上使用 `120000`。
- 默认只做健康检查、已打开窗口检查、工作空间检查和窗口列表检查。
- 只有显式传 `--create` 才会创建窗口，避免误消耗资源或配额。

## 5. C. MCP 调用与 API 调用职责边界

### 5.1 MCP 负责什么

- AI 助手驱动下的资源编排。
- 把“列工作空间、创建窗口、打开窗口、取 CDP 地址”暴露成可对话调用工具。
- 与 `roxybrowser-playwright-mcp` 串联，让 AI 在拿到 CDP 端点后继续执行页面动作。

### 5.2 API 负责什么

- 代码内稳定接入。
- 批处理、定时任务、服务化封装。
- 统一鉴权、超时、错误码处理、限流、日志、重试。
- 为后续任何业务模块提供固定的浏览器资源接口。

### 5.3 明确边界

- “有没有窗口、创建哪个窗口、打开哪个窗口”属于资源管理，优先 API。
- “打开后的页面上点什么、填什么、抓什么”属于页面执行，优先 Playwright。
- “让 AI 根据上下文决定下一步工具调用”属于 MCP 编排，不属于业务 SDK。

## 6. D. 后续可复用的资源部署建议

### 6.1 配置口径

- API 密钥只放环境变量，不写死在代码库。
- Roxy 供应商字段保留原名：`ROXY_API_HOST`、`ROXY_API_KEY`。
- 若你内部沿用 “Rosie Browser” 叫法，只在业务层做别名映射，不要改供应商协议字段。

### 6.2 代码口径

统一保留三层目录：

```text
src/
  browser-resource/
    roxy-client.js
    roxy-service.js
    roxy-types.js
  automation/
    playwright-runner.js
  tasks/
    xxx-task.js
```

建议规则：

- `browser-resource` 只负责资源。
- `automation` 只负责页面动作。
- `tasks` 只编排业务步骤。

### 6.3 运行口径

- 本地开发：直连 `http://127.0.0.1:50000`
- AI 编排：挂 `roxybrowser-openapi` + `roxybrowser-playwright-mcp`
- 脚本任务：直接用 repo 内 API Client

### 6.4 观测口径

统一记录以下字段：

- `workspaceId`
- `dirId`
- `windowName`
- `requestId`
- `action`
- `apiCode`
- `apiMsg`
- `wsEndpoint`

### 6.5 风险口径

- `open` 链路可能显著慢于读取类接口，默认 `30000ms` 不一定够。
- `close` 不等于释放配额；删除窗口才释放配额。
- 创建窗口前必须先拿到有效 `workspaceId`。

## 7. 后续建议

下一步不需要扩业务，只要继续做两件事：

1. 将 `open` 链路默认超时提升到你们可接受值，例如 `120000ms`。
2. 后续若要接 Playwright，只需把 `open` / `connection_info` 返回的 `ws` 端点传给执行层，不需要改资源层协议。
