# 社媒窗口复用验证结论

## 1. 总结论

结论不是“绝对复制”，而是“在受控条件下可复用”。

已验证成立的受控条件：

- 同一台机器
- 相同 Roxy/Rosie 本地环境
- 相同或等效的 SOCKS5 / IP 出口
- 相同浏览器核心版本、UA、窗口配置、代理配置
- 使用保存下来的窗口配置和运行时 Cookies

在以上条件下，本轮实测：

- Bilibili：可直接复用
- 小红书创作服务平台：可直接复用
- 微信视频号助手：可直接复用

但这仍然不等于“所有社媒绝对复制”，因为不同平台可能额外依赖：

- IndexedDB
- Service Worker
- 本地 profile 文件
- 服务端风控画像
- 设备 / 环境一致性校验

## 2. 平台结论矩阵

### 2.1 Bilibili

- 同账号删除重建：成功
- 跨 Roxy 账号重建：成功
- `cookie-only`：成功
- `full-web-state`：成功
- 结论：`can-reuse-directly`

判定依据：

- `https://api.bilibili.com/x/web-interface/nav` 返回 `isLogin = true`
- 返回了有效 `mid`
- `SESSDATA`、`DedeUserID`、`bili_jct` 存在

### 2.2 小红书创作服务平台

- `cookie-only`：成功
- `full-web-state`：成功
- 结论：`can-reuse-directly`

判定依据：

- 恢复后页面仍在 `https://creator.xiaohongshu.com/new/home`
- 页面存在“发布笔记”“笔记管理”“数据看板”
- 关键 Cookies 存在：
  - `galaxy_creator_session_id`
  - `access-token-creator.xiaohongshu.com`
  - `x-user-id-creator.xiaohongshu.com`
- 关键 Local Storage 存在：
  - `USER_INFO`
  - `USER_INFO_FOR_BIZ`

### 2.3 微信视频号助手

- `cookie-only`：成功
- `full-web-state`：成功
- 结论：`can-reuse-directly`

判定依据：

- 恢复后页面仍在 `https://channels.weixin.qq.com/platform`
- 页面存在账号面板信号：
  - “视频号ID”
  - “关注者”
  - “昨日数据”
- 关键 Cookies 存在：
  - `sessionid`
  - `wxuin`

补充说明：

- 菜单文字如“内容管理”“互动管理”“数据中心”在恢复态不稳定，不能作为唯一成功标记
- 视频号更稳的成功信号是“已进入平台页 + 账号面板存在 + 关键 Cookie 存在”

## 3. 工程口径

当前更可靠的工程结论：

1. 不要对“各大社媒绝对复制”做承诺。
2. 可以对“同机、同 IP / 代理、同配置窗口下，保存窗口配置 + Cookies 后重建复用”做承诺。
3. 新平台接入时，先按三档归类：
   - `can-reuse-directly`
   - `needs-more-validation`
   - `high-risk`
4. 一旦某平台只靠 Cookies 失败，再补 `localStorage/sessionStorage`
5. 如果 `Cookies + Web Storage` 都失败，再考虑更重的 profile 级迁移

## 4. 最小复用代码

通用实验脚本：

- `src/social-window-reuse.js`

脚本能力：

- 读取已打开源窗口
- 抓取窗口配置、Cookies、Web Storage
- 删除源窗口
- 以 `cookie-only` 或 `full-web-state` 重建
- 输出站点级成功判定

## 5. 实验产物

- Bilibili:
  - `artifacts/window-reuse/`
- 小红书:
  - `artifacts/social-window-reuse/xiaohongshu/`
- 微信视频号:
  - `artifacts/social-window-reuse/wechat-channels/`

## 6. 下一步建议

如果你后面要扩更多平台，优先顺序建议是：

1. X / Twitter
2. Instagram
3. TikTok

原因：

- 这三类平台更能验证“Cookies 是否足够”
- 也更能暴露“平台是否依赖更强的设备 / 风控绑定”
