# RoxyBrowser 窗口数据 / Cookies 复用验证

## 1. 结论口径

这轮验证关注的不是“同一个 Roxy 账号双机同时在线”，而是：

1. 本地是否能保存窗口配置。
2. 本地是否能保存运行中的登录态数据。
3. 删除原窗口后，是否能用代码重新创建一个配置尽量一致的有头窗口。
4. 切换到另一个 Roxy 账号后，是否还能基于本地快照再次复建。

## 2. A. 需保留的数据范围

### 2.1 必保留

- 窗口配置：`coreVersion`、`os`、`osVersion`、`userAgent`、`searchEngine`、`windowRemark`
- 指纹配置：`fingerInfo`
- 代理配置：`proxyInfo`
- 打开页配置：`defaultOpenUrl`
- 运行中 Cookies：来自运行中浏览器上下文，而不是只看 `/browser/detail`

### 2.2 建议额外保留

- `storageState.origins[].localStorage`
- `sessionStorage`
- 截图证据
- 页面 URL

### 2.3 不建议直接跨账号复用的字段

- `workspaceId`
- `dirId`
- `projectId`
- `labelIds` / `labelInfo`
- `windowPlatformList`
- `moduleId` 形式的代理资源引用
- `userName` / `openStatus` / `statusInfo` / 时间戳类字段

这些字段要么是工作空间绑定资源，要么是窗口实例态，不适合作为跨账号复建输入。

## 3. B. 实验方案

### 3.1 实验一：同账号窗口删除重建

1. 创建一个干净源窗口，默认打开 `https://www.bilibili.com/`
2. 人工登录
3. 程序抓取：
   - `/browser/detail`
   - 运行中 Cookies
   - `storageState`
   - `sessionStorage`
4. 删除原窗口
5. 用快照重建新窗口，分两种策略：
   - `cookie-only`
   - `full-web-state`
6. 打开 Bilibili，截图并检查是否保留登录态

### 3.2 实验二：切换 Roxy 账号后复建

1. 保留本地快照文件
2. 退出当前 Roxy 账号
3. 登录另一个 Roxy 账号
4. 读取新账号下当前工作空间
5. 用同一份快照再次创建窗口并恢复
6. 检查是否仍保留 Bilibili 登录态

## 4. C. 最小验证代码

脚本文件：

- `src/window-reuse-experiment.js`

命令：

```bash
npm run window-reuse:start
npm run window-reuse:capture
npm run window-reuse:restore:cookie
npm run window-reuse:restore:full
npm run window-reuse:cleanup
```

实验产物：

- `artifacts/window-reuse/experiment-state.json`
- `artifacts/window-reuse/snapshot.json`
- `artifacts/window-reuse/*.png`

## 5. D. 可行 / 不可行判断标准

### 5.1 可行

满足以下任意一条即可判定当前站点复用方案可行：

- `cookie-only` 重建后仍保持登录
- `full-web-state` 重建后保持登录

### 5.2 不可行

以下情况视为“仅靠当前保留范围不可行”：

- Cookies 恢复后仍掉登录
- Cookies + local/sessionStorage 恢复后仍掉登录
- 站点依赖 IndexedDB / Service Worker / 本地缓存，而当前方案未覆盖

## 6. E. 替代方案

### 6.1 优先替代

- 不删窗口，直接保留原窗口长期复用

这是最稳的，因为不需要跨实例迁移状态。

### 6.2 次优替代

- 保留窗口配置 + Cookies + Web Storage 快照，再由代码注入恢复

适用于“删除后重建”，但不保证所有站点都稳。

### 6.3 更重的替代

- 直接备份整个浏览器 profile 数据目录

这是最接近完整迁移的方案，但不属于当前 API / MCP 标准口径，需要额外定位 Roxy 本地 profile 存储目录并处理文件锁、版本兼容和账号归属问题。
