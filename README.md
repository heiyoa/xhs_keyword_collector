# 小红书聚光关键词规划采集模块

英文目录名：`xhs_keyword_collector`

## 概述

`xhs_keyword_collector` 用于在已登录的小红书聚光后台中批量采集关键词规划数据，输出搜索指数、竞争度和出价等结构化结果。

## 核心模块

- `cli/xhs-juguang-keyword-cli.js`：任务入口
- `sites/xhs-juguang-keyword-service.js`：关键词采集主逻辑
- `config/keyword_rounds/`：任务批次配置
- `docs/xhs-juguang-keyword-volume-runbook.md`：运行口径说明

## 架构思路

```text
Keyword Batch Config
        │
        ▼
      CLI
        │   读取本轮采集任务
        ▼
   Binding Resolve
        │   获取已登录环境、窗口和凭据
        ▼
 Browser Reuse Layer
        │   接管当前聚光后台页面
        ▼
 Query Loop
        │   逐词查询关键词规划结果
        ▼
 Result Parser
        │   提取搜索指数、竞争度、出价
        ▼
 JSON / CSV Output
```

## 工作流说明

```text
1. 准备关键词批次
2. 读取已登录环境
3. 接管当前浏览器页面
4. 逐个关键词发起查询
5. 解析返回字段
6. 统一输出结构化文件
```

## 容错设计

```text
- 已登录环境复用：减少重复登录导致的不稳定
- binding 分离：窗口、账号、凭据不直接散落在业务逻辑中
- 结果统一落盘：失败后仍可保留历史结果和中间状态
- runbook 固化执行方式：降低重复执行中的参数误差
```

## 当前状态

当前版本保留了真实历史结果与采集代码结构，受外部浏览器环境影响，实时链路仍需进一步稳定。
