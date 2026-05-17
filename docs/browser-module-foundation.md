# 浏览器模块底座设计

【1. 模块总体职责】

浏览器模块底座负责：

1. 统一接入 Roxy/Rosie Browser 的 API 资源层
2. 管理 profile 资产、窗口元数据、账号/IP/API 绑定关系
3. 提供窗口创建、打开、关闭、删除、复建、状态归档等正式能力
4. 为后续采样、采词、人工登录、状态复用脚本提供稳定调用入口
5. 为本机开发验证与利维坦执行环境提供同一套脚本协议

当前阶段负责：

1. 浏览器资源接入
2. profile 识别与读取
3. 账号/IP/API 绑定建模
4. Cookies / 窗口状态复用验证
5. profile 级归档/恢复的模块边界设计

当前阶段不负责：

1. 自动发布
2. 商品上架
3. 采词业务逻辑
4. 内容生产链路
5. 调度系统本身

【2. 我本机开发目录结构】

建议本机开发目录：

```text
rb-browser-foundation/
  package.json
  package-lock.json
  .env.example
  config/
    mcp.roxybrowser.example.json
    sites.example.json
  docs/
    browser-module-foundation.md
    shared-directory-layout.md
    secret-management.md
    leviathan-operator-guide.md
    roxy-unified-access-plan.md
    roxy-resource-deployment.md
    roxy-window-reuse-plan.md
    social-window-reuse-results.md
    schema.md
    runbooks/
      first-machine-dev.md
      leviathan-deploy.md
      profile-archive.md
  src/
    browser_modules/
      core/
        roxy-client.js
        browser-resource-service.js
        browser-errors.js
      db/
        sqlite.js
        migrations/
        repositories/
      bindings/
        binding-service.js
        credential-resolver.js
      profile/
        profile-locator.js
        profile-archive-service.js
        profile-restore-service.js
      sessions/
        session-state-service.js
        cookie-state-service.js
      sites/
        site-definitions.js
        social-window-reuse.js
      cli/
        verify-roxy.js
        binding-cli.js
        profile-archive-cli.js
        site-verify-cli.js
  data/
    browser_foundation.db
  artifacts/
    run-evidence/
    profile-archives/
  scripts/
    bootstrap.ps1
    sync-to-leviathan.ps1
  tests/
```

目录职责：

- `config/`: 示例配置模板，不放真实密钥
- `docs/`: 所有参数、限制、调用方式、执行文档
- `src/browser_modules/core/`: 正式 API 接入层
- `src/browser_modules/db/`: SQLite、迁移、仓储层
- `src/browser_modules/bindings/`: 账号/IP/API/profile 绑定逻辑
- `src/browser_modules/profile/`: profile 定位、归档、恢复
- `src/browser_modules/sessions/`: Cookies、storage、运行态快照
- `src/browser_modules/sites/`: 各平台验证逻辑
- `src/browser_modules/cli/`: 给人和利维坦调用的命令行入口
- `data/`: 本机开发数据库
- `artifacts/`: profile 归档和验证证据
- `scripts/`: 启动、同步、部署辅助

【3. 利维坦部署目录结构】

共享目录默认路径：

- `\\100.86.229.25\lobster-share\browser_modules\`

建议利维坦正式布局：

```text
browser_modules/
  README.md
  package.json
  package-lock.json
  config/
    sites.example.json
    runtime.example.json
  docs/
    browser-module-foundation.md
    shared-directory-layout.md
    secret-management.md
    leviathan-operator-guide.md
    roxy-unified-access-plan.md
    roxy-resource-deployment.md
    roxy-window-reuse-plan.md
    social-window-reuse-results.md
    schema.md
  src/
    browser_modules/
      core/
      db/
      bindings/
      profile/
      sessions/
      sites/
      cli/
  data/
    browser_foundation.db
  runtime/
    logs/
    locks/
    temp/
  artifacts/
    profile-archives/
    run-evidence/
```

原则：

1. 利维坦只运行正式模块，不依赖 MCP
2. 所有文档必须和代码一起进入共享目录
3. `data/`、`runtime/`、`artifacts/` 与代码分开
4. 临时实验脚本不进入利维坦正式执行目录

后续脚本模块的正式放置位置已经固定：

- `browser_modules/src/browser_modules/core/`
- `browser_modules/src/browser_modules/db/`
- `browser_modules/src/browser_modules/bindings/`
- `browser_modules/src/browser_modules/profile/`
- `browser_modules/src/browser_modules/sessions/`
- `browser_modules/src/browser_modules/sites/`
- `browser_modules/src/browser_modules/cli/`

【4. 数据库设计】

建议先用 SQLite。

原因：

1. 单文件，方便本机开发和复制到利维坦
2. 足够支撑当前绑定关系和状态管理
3. 后续可迁移，当前复杂度不值得上重型数据库

核心表建议：

### 4.1 `profiles`

表示长期浏览器资产。

关键字段：

- `id`
- `profile_key`
- `platform`
- `display_name`
- `workspace_id`
- `project_id`
- `current_dir_id`
- `browser_core_version`
- `user_agent`
- `os_name`
- `os_version`
- `fingerprint_json`
- `proxy_template_json`
- `default_open_urls_json`
- `local_profile_path`
- `archive_root_path`
- `status`
- `last_verified_at`
- `created_at`
- `updated_at`

### 4.2 `accounts`

表示业务账号。

关键字段：

- `id`
- `account_key`
- `platform`
- `login_name`
- `display_name`
- `credential_ref`
- `credential_type`
- `status`
- `notes`
- `created_at`
- `updated_at`

### 4.3 `ip_resources`

表示代理或出口 IP 资源。

关键字段：

- `id`
- `proxy_key`
- `proxy_type`
- `host`
- `port`
- `username_ref`
- `password_ref`
- `provider`
- `country`
- `region`
- `city`
- `exit_ip`
- `check_url`
- `status`
- `created_at`
- `updated_at`

### 4.4 `api_credentials`

表示 Roxy/Rosie API 凭据。

关键字段：

- `id`
- `credential_key`
- `provider`
- `api_host`
- `api_key_ref`
- `workspace_id`
- `project_id`
- `status`
- `created_at`
- `updated_at`

### 4.5 `bindings`

表示 profile 与 account/ip/api 的绑定关系。

关键字段：

- `id`
- `binding_key`
- `profile_id`
- `account_id`
- `ip_resource_id`
- `api_credential_id`
- `binding_mode`
- `is_primary`
- `status`
- `last_restore_at`
- `last_verify_result`
- `created_at`
- `updated_at`

### 4.6 `profile_snapshots`

表示 profile 级归档版本。

关键字段：

- `id`
- `profile_id`
- `snapshot_key`
- `snapshot_type`
- `archive_path`
- `metadata_path`
- `source_dir_id`
- `source_profile_path`
- `cookie_count`
- `storage_origin_count`
- `size_bytes`
- `created_at`
- `verified_at`
- `status`

### 4.7 `session_states`

表示轻量运行态快照。

关键字段：

- `id`
- `profile_id`
- `snapshot_id`
- `site_name`
- `state_type`
- `cookie_json`
- `local_storage_json`
- `session_storage_json`
- `indexeddb_hint`
- `captured_at`

### 4.8 `runs`

表示执行记录。

关键字段：

- `id`
- `run_key`
- `binding_id`
- `script_name`
- `machine_role`
- `status`
- `started_at`
- `finished_at`
- `result_json`
- `error_text`

【5. profile / 窗口 / Cookies 关系设计】

设计结论：

1. `profile` 是核心资产
2. `窗口` 是 profile 在当前 Roxy 环境下的实例壳
3. `Cookies / localStorage / sessionStorage / IndexedDB` 是 profile 内的站点状态子集

持久化口径：

- 必须持久化：
  - profile 元数据
  - binding 关系
  - profile snapshot
  - session 快照
  - 验证结果

- 只算运行时状态：
  - `dirId`
  - `ws/http`
  - `pid`
  - 当前打开页

关键原则：

- `profile_key` 才是长期主键
- `dirId` 不应被视为长期资产主键
- 只存 Cookies 不够稳，profile snapshot 才是删窗复建的核心资产

【6. 开发期与执行期分层】

### 6.1 开发期

开发期运行在你本机，允许：

- Codex + MCP 辅助观察
- 人工登录
- Playwright 调试
- 站点验收规则实验

### 6.2 执行期

执行期运行在利维坦，只保留正式能力：

- API 接入
- DB 读取绑定关系
- profile 归档与恢复
- 窗口创建、删除、复建
- 站点脚本执行

执行期不应依赖：

- MCP 常驻
- 手工交互
- 临时实验脚本

### 6.3 必须沉成正式模块的能力

- `RoxyApiClient`
- `BrowserResourceService`
- `BindingService`
- `CredentialResolver`
- `ProfileArchiveService`
- `ProfileRestoreService`
- `SessionStateService`
- `SQLite schema + migrations`

【7. 第一阶段最小实现顺序】

建议顺序：

1. `browser resource layer`
   - API 接入
   - 工作空间、窗口创建/打开/关闭/删除
   - 限流、超时、错误处理

2. `db foundation`
   - SQLite
   - 基础表与迁移
   - profiles/accounts/ip_resources/api_credentials/bindings

3. `binding layer`
   - 绑定 profile 与 account/ip/api
   - 解析某 profile 当前应使用的资源

4. `session snapshot layer`
   - Cookies/localStorage/sessionStorage 快照
   - 站点级恢复验证

5. `profile archive layer`
   - 本地 profile 目录识别
   - 归档
   - 恢复
   - 归档版本记录

6. `site verification layer`
   - B站/小红书/视频号规则沉淀

【8. 当前最值得先做的 1~2 个模块 / 脚本】

### 8.1 `binding-service + sqlite schema`

理由：

- profile 不可能脱离账号/IP/API 孤立运行
- 这是未来利维坦每日执行的基础入口

建议接口：

- `registerProfile()`
- `registerAccount()`
- `registerProxy()`
- `registerApiCredential()`
- `bindResources()`
- `resolveBinding(bindingKey)`

### 8.2 `profile-archive-service`

理由：

- 当前真实卡点是“五窗口上限，删后要反复创建”
- 只存 Cookies 不够稳
- 必须把“删窗口前归档、重建后回灌”做成正式能力

建议接口：

- `saveProfileSnapshot(bindingKey)`
- `restoreProfileSnapshot(bindingKey, snapshotKey)`
- `locateProfilePath(dirId)`
- `verifyRestoredProfile(bindingKey)`

【9. 需要我补充给你的信息】

如果要进入正式实现，我最需要你确认这些：

1. 正式模块是否继续沿用 Node.js
2. 是否确认利维坦侧使用 SQLite
3. 是否确认 profile 归档放进共享目录：
   - `\\100.86.229.25\lobster-share\browser_modules\artifacts\profile-archives\`
4. 是否确认 API key、代理密码、账号密码统一只存“引用”，不存明文
5. 是否让我下一步直接开始：
   - `SQLite schema + migration`
   - `binding-service`
   - `profile-archive-service`

当前新增的正式文档：

- `docs/shared-directory-layout.md`
- `docs/secret-management.md`
- `docs/leviathan-operator-guide.md`

这三份文档与本文件一起，构成未来复制到利维坦的浏览器模块底座说明。
