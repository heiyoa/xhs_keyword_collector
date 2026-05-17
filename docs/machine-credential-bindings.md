# 机器与指纹浏览器凭据绑定

## 1. 目标

记录每台执行机器绑定的：

- 操作系统登录信息
- 内网 IP
- 公网 IP
- 指纹浏览器账号
- 指纹浏览器操作 API key

## 2. 当前机器

### 2.1 利维坦

- `machine_key`: `leviathan`
- 用户名：`aiops`
- 密码引用：`secrets/browser-foundation/machines/leviathan.json#password`
- 内网 IP：`100.86.229.25`
- 公网 IP：`172.20.129.87`
- 指纹浏览器账号邮箱：`JenniferRobinson4267@outlook.com`
- 指纹浏览器账号密码引用：`secrets/browser-foundation/browser-accounts/roxy_jennifer.json#password`
- 指纹浏览器 API key 引用：`secrets/browser-foundation/api/roxy_leviathan_api_key.txt`

### 2.2 本机开发机

- `machine_key`: `local-dev`
- 内网 IP：`100.86.235.34`
- 指纹浏览器 API key 引用：`secrets/browser-foundation/api/roxy_local_api_key.txt`

## 3. 数据库存储口径

真实值存放在 `secrets/`。

数据库只保存引用：

- `file:secrets/browser-foundation/api/roxy_local_api_key.txt`
- `file:secrets/browser-foundation/api/roxy_leviathan_api_key.txt`
- `file:secrets/browser-foundation/machines/leviathan.json#password`
- `file:secrets/browser-foundation/browser-accounts/roxy_jennifer.json#password`

## 4. 查询命令

查看利维坦指纹浏览器绑定：

```bash
node --env-file=.env src/browser_modules/cli/binding-cli.js resolve-machine-browser --binding-key=leviathan-roxy-jennifer
```

查看本机指纹浏览器绑定：

```bash
node --env-file=.env src/browser_modules/cli/binding-cli.js resolve-machine-browser --binding-key=local-roxy-current
```

如需输出真实密钥：

```bash
node --env-file=.env src/browser_modules/cli/binding-cli.js resolve-machine-browser --binding-key=leviathan-roxy-jennifer --resolve-secrets
```
