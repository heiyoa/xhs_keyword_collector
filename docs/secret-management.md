# 密钥与凭据管理规范

## 1. 核心原则

当前共享目录是用户本人三台机器之间的私有执行环境，因此允许同步本项目内 `secrets/` 目录。

但数据库仍建议只保存凭据引用，原因是脚本和 binding 解析更稳定。

## 2. 本机 secrets 目录

当前项目内同步目录：

```text
secrets/browser-foundation/
  api/
  machines/
  browser-accounts/
```

也兼容每台机器本地维护：

```text
C:\browser_secrets\browser-foundation\
  api\
  proxies\
  accounts\
```

## 3. 引用格式

支持三类引用：

```text
env:ROXY_API_KEY
file:C:\browser_secrets\browser-foundation\api\roxy_prod_api_key.txt
file:C:\browser_secrets\browser-foundation\proxies\proxy_socks5_main.json#password
```

## 4. API key 文件

示例：

```text
C:\browser_secrets\browser-foundation\api\roxy_prod_api_key.txt
```

文件内容只放 key 本体。

## 5. 账号文件

示例：

```json
{
  "platform": "xiaohongshu",
  "login_name": "example",
  "password": "example",
  "notes": "manual login allowed"
}
```

## 6. 代理文件

示例：

```json
{
  "type": "socks5",
  "host": "127.0.0.1",
  "port": 7890,
  "username": "proxy-user",
  "password": "proxy-pass"
}
```

## 7. Kimi 执行规则

Kimi 只读取 `credential_ref`，不猜测、不新增明文。

如果解析失败，直接报：

```text
credential_ref invalid
```

并输出具体引用字符串。
