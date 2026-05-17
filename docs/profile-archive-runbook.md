# Profile 归档与恢复 Runbook

## 1. 目标

解决五窗口上限下的复用问题：

1. 创建窗口
2. 归档 profile
3. 删除窗口释放名额
4. 需要时重建窗口
5. 回灌 profile
6. 打开验证

## 2. 前置条件

必须满足：

1. DB 已初始化
2. binding 已注册
3. API key 通过 `credential_ref` 可解析
4. Roxy Browser API 可用

## 3. 初始化 DB

```bash
npm run db:init
```

## 4. 查看绑定

```bash
node --env-file=.env src/browser_modules/cli/binding-cli.js list
```

## 5. 解析绑定

```bash
node --env-file=.env src/browser_modules/cli/binding-cli.js resolve --binding-key=xhs-main-binding
```

## 6. 手动保存 profile

```bash
node --env-file=.env src/browser_modules/cli/profile-archive-cli.js save --binding-key=xhs-main-binding --source-dir-id=<dir_id>
```

## 7. 手动恢复 profile

```bash
node --env-file=.env src/browser_modules/cli/profile-archive-cli.js restore --binding-key=xhs-main-binding --snapshot-key=<snapshot_key>
```

## 8. 闭环验证

```bash
node --env-file=.env src/browser_modules/cli/profile-smoke-cli.js run --binding-key=xhs-main-binding
```

该命令会：

1. 创建测试窗口
2. 打开并关闭窗口
3. 保存 profile snapshot
4. 删除源窗口
5. 新建窗口
6. 回灌 profile
7. 打开验证
8. 关闭并删除测试窗口

## 9. 成功标准

输出：

```json
{
  "status": "ok",
  "restoredOpen": true
}
```

同时确认：

1. `connection_info` 为空
2. `list_v3` 没有测试窗口残留
3. binding 的 `last_verify_result` 已更新

## 10. 注意事项

1. 删除窗口前必须先保存 profile
2. profile 保存前必须关闭窗口
3. 关闭后建议等待 2-3 分钟再做生产级归档
4. smoke 验证可以用短等待，但生产归档不要省等待
5. `.env` 不要进入共享目录
6. API key、代理密码、账号密码只通过 secrets 引用解析
