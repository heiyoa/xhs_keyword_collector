# Profile 资产生命周期

## 1. 核心原则

在 `browser_modules` 中：

- `profile` 是长期资产
- `window` 是临时资源
- 登录态优先保存在 `profile`
- `cookies/localStorage/sessionStorage` 是 profile 的站点状态子集，不应替代 profile 本身

## 2. 为什么登录态优先靠 profile

只存 cookies 的问题：

1. 不完整
2. 丢失浏览器历史与站点环境
3. 丢失 IndexedDB、Service Worker、扩展数据
4. 对复杂平台不稳定

profile 的优势：

1. 能承载更完整的登录态
2. 更适合跨窗口重建
3. 更适合在 5 窗口上限下反复复用

所以口径必须是：

```text
登录态长期依附于 profile
窗口只是承载 profile 的临时实例
```

## 3. 5 窗口上限下的操作口径

推荐生命周期：

1. `create-window`
   - 基于 profile 元数据创建新窗口壳

2. `archive-retire`
   - 关闭当前窗口
   - 等待 flush
   - 保存 profile snapshot
   - 删除窗口释放槽位

3. `rebuild-window`
   - 基于最新 snapshot 创建新窗口
   - 回灌 profile
   - 打开新窗口

4. `retire-window`
   - 当窗口只是运行态资源、不再需要时关闭并删除

## 4. 当前稳定 CLI

查看 profile 资产状态：

```bash
node --env-file=.env src/browser_modules/cli/profile-lifecycle-cli.js asset-status --binding-key=xhs-main-binding
```

基于 profile 创建窗口：

```bash
node --env-file=.env src/browser_modules/cli/profile-lifecycle-cli.js create-window --binding-key=xhs-main-binding
```

归档并退役当前窗口：

```bash
node --env-file=.env src/browser_modules/cli/profile-lifecycle-cli.js archive-retire --binding-key=xhs-main-binding
```

从最新 snapshot 重建窗口：

```bash
node --env-file=.env src/browser_modules/cli/profile-lifecycle-cli.js rebuild-window --binding-key=xhs-main-binding
```

直接退役当前窗口：

```bash
node --env-file=.env src/browser_modules/cli/profile-lifecycle-cli.js retire-window --binding-key=xhs-main-binding
```

## 5. 资产状态建议

当前 `profiles.status` 可按以下语义使用：

- `active`
  - profile 已登记

- `window_created`
  - 已创建窗口但未打开

- `window_open`
  - 当前有打开窗口

- `window_restored`
  - 已从 snapshot 恢复窗口

- `profile_archived_ready`
  - 当前无活动窗口，但 profile snapshot 已可用于重建

## 6. 当前模块已支持什么

已支持：

1. profile 资产建模
2. binding 解析
3. profile snapshot 保存
4. 基于最新 snapshot 重建窗口
5. 基于 profile 创建新窗口
6. 退役当前窗口

## 7. 当前还不做什么

当前不做：

1. 多平台完整页面执行
2. 自动发布
3. 调度系统
4. profile 深度版本治理

## 8. 推荐后续平台接入方式

以后无论是小红书、聚光、TK、视频号，都沿用同一口径：

1. 平台脚本只认 `binding_key`
2. profile 生命周期由 `profile-lifecycle-cli` 负责
3. 平台脚本不自己猜 window / profile / cookies 路径
