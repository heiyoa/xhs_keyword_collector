# RoxyBrowser 资源部署口径

## 1. 统一原则

- 资源入口统一定义为 “浏览器资源层”。
- 浏览器资源层只处理工作空间、窗口、已打开会话。
- 页面自动化不直接进入资源层。

## 2. 环境变量

统一使用：

```text
ROXY_API_HOST
ROXY_API_KEY
ROXY_WORKSPACE_ID
ROXY_TIMEOUT_MS
```

可选扩展：

```text
ROXY_REQUEST_INTERVAL_MS
```

## 3. MCP 部署口径

统一挂两个服务：

1. `roxybrowser-openapi`
2. `roxybrowser-playwright-mcp`

职责固定：

- `roxybrowser-openapi`: 资源管理
- `roxybrowser-playwright-mcp`: 页面自动化

## 4. 模块复用口径

任何后续模块都不要自己重新拼 Roxy API URL。

统一只依赖：

- `RoxyApiClient`
- `BrowserResourceService`

推荐暴露的方法名：

- `health()`
- `listWorkspaces()`
- `listBrowsers()`
- `createBrowser()`
- `openBrowser()`
- `getConnectionInfo()`
- `closeBrowser()`

## 5. 日志口径

每次动作至少打印：

- 时间
- 动作名
- `workspaceId`
- `dirId`
- API 状态码
- API 消息

## 6. 安全口径

- key 不入库。
- 配置文件只保留示例模板。
- 真正执行创建/打开动作必须显式开关触发。

## 7. 验收口径

最小验收通过条件：

1. `health` 成功。
2. 能读到 `connection_info`。
3. 能读到 `workspace`。
4. 能读到 `list_v3`。
5. 能创建窗口。
6. 能打开窗口并拿到 `ws` 或 `http` 端点。

如果第 1 步成功而第 3 步失败，优先排查 Roxy 客户端环境，不修改资源层边界。
