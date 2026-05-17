# 利维坦执行手册

适用对象：

- 利维坦机器上的 Kimi
- 任何只负责执行、不负责研发的后续操作者

## 1. 角色边界

利维坦只负责：

1. 读取既定模块
2. 读取数据库和绑定关系
3. 执行指定 CLI
4. 记录结果

利维坦不负责：

1. 重新设计架构
2. 临时修改目录结构
3. 猜测密钥放在哪里
4. 手工拼 API URL
5. 改站点验收规则

## 2. 部署目录

共享目录：

```text
\\100.86.229.25\lobster-share\browser_modules\
```

正式模块路径：

```text
src/browser_modules/
```

CLI 路径：

```text
src/browser_modules/cli/
```

## 3. 首次检查

按顺序检查：

1. 共享目录可访问
2. `.env` 存在
3. `data/browser_foundation.db` 存在
4. `secrets/browser-foundation/` 存在
5. `node_modules/` 存在
6. Roxy Browser API 返回 `health`

## 4. 常用命令

查看绑定列表：

```bash
node --env-file=.env src/browser_modules/cli/binding-cli.js list
```

查看利维坦机器-指纹浏览器绑定：

```bash
node --env-file=.env src/browser_modules/cli/binding-cli.js resolve-machine-browser --binding-key=leviathan-roxy-jennifer
```

如需输出真实凭据：

```bash
node --env-file=.env src/browser_modules/cli/binding-cli.js resolve-machine-browser --binding-key=leviathan-roxy-jennifer --resolve-secrets
```

保存 profile：

```bash
node --env-file=.env src/browser_modules/cli/profile-archive-cli.js save --binding-key=<binding_key> --source-dir-id=<dir_id>
```

恢复 profile：

```bash
node --env-file=.env src/browser_modules/cli/profile-archive-cli.js restore --binding-key=<binding_key> --snapshot-key=<snapshot_key>
```

运行 profile 闭环验证：

```bash
node --env-file=.env src/browser_modules/cli/profile-smoke-cli.js run --binding-key=<binding_key>
```

## 5. 禁止事项

Kimi 不允许：

1. 跳过 profile 归档直接删窗口
2. 手工修改 DB 文件
3. 从临时目录运行脚本
4. 自己新建一套目录结构

## 6. 失败输出要求

失败时必须报告：

1. 当前命令
2. `binding_key`
3. `profile_key`
4. `dirId`
5. 错误信息
6. 下一步人工应检查什么
