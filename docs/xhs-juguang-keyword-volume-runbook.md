# 小红书聚光搜索量最小采集 Runbook

## 1. 目标

基于已登录的聚光后台关键词规划工具，采集第一批关键词的“月搜索指数”结果。

当前第一轮参考词：

- `ai`
- `ai生视频`
- `ai教程`

## 2. 依赖

依赖 `browser_modules` 已有的：

- `xhs-main-binding`
- 已打开且已登录的聚光窗口
- `binding.profile.current_dir_id`

当前不是裸跑浏览器，而是复用已有指纹浏览器窗口和 profile 登录态。

## 3. 入口

CLI：

```bash
node --env-file=.env src/browser_modules/cli/xhs-juguang-keyword-cli.js run --binding-key=xhs-main-binding --run-key=xhs-juguang-round001 --task-payload=@config/keyword_rounds/xhs_round_001.json
```

## 4. 输出

会落到：

```text
artifacts/run-evidence/xhs-juguang-keyword-volume/<source_round>/<run_key>/
```

包含：

- `results.json`
- `results.csv`

## 5. 字段说明

结果至少包含：

- `keyword`
- `matched_keyword`
- `search_volume`
- `search_volume_field`
- `competition_index`
- `market_bid`
- `recommendation_reason`
- `exact_match`
- `captured_at`
- `source_round`
- `source_platform`

说明：

- 当前页面真实字段是“月搜索指数”，不是“月搜索量”原词
- 因此当前统一落在：
  - `search_volume`
  - `search_volume_field = monthly_search_index`

## 6. 当前接入方式

接入方式：

1. 从 `xhs-main-binding` 读取当前打开窗口的 `current_dir_id`
2. 调 Roxy API 取 `connection_info`
3. 通过 CDP `ws` 接管当前聚光页面
4. 在关键词规划工具左侧主输入框逐个输入关键词
5. 回车触发查询
6. 从结果表格中抓取“精确匹配行”

## 7. 当前最脆弱的点

1. 页面是组件化输入框，不是标准表单
2. 聚光实际字段叫“月搜索指数”
3. 如果当前登录窗口被关闭，脚本无法直接复用
4. 如果页面结构变化，表格 selector 需要调整
5. 当前是逐词查询，频率要保守

## 8. 扩展建议

后续扩成更大词池时，建议：

1. 输入仍沿用 JSON 文件
2. 每批次控制在 `10-20` 个词
3. 增加批次字段：
   - `source_round`
   - `batch_id`
4. 增加失败重试和 `not_found` 标记
5. 如果页面支持批量查词，再升级成批量模式
