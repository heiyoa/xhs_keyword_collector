# Agent Development Protocol

适用对象：

- Codex
- Kimi
- 任何后续接手 `browser_modules` 的 agent

## 1. 开发边界

只在本机开发目录改代码：

```text
d:\zhuomian\rb指纹验证
```

共享目录是发布目录，不是自由开发目录。

## 2. 允许输入

后续任务优先围绕：

- `binding_key`
- `task_payload`
- `run_key`

## 3. 禁止输入方式

- 猜 profile 路径
- 猜 cookies 路径
- 写死窗口 `dirId`
- 手工拼代理或 API key

## 4. 改代码后必须做

1. 本机验证
2. 更新文档
3. 再同步到共享目录
4. 如涉及 native module，必须考虑利维坦本机运行镜像，不要默认直接从 UNC 共享路径执行
