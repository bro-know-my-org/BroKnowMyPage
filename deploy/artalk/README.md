# Artalk + PostgreSQL 部署

这里是单台 1C1G VPS 的最小部署样例。PostgreSQL 没有映射宿主机端口，Artalk 只监听 `127.0.0.1:23366`。公网由 Nginx 接管 `80/443`，并通过 `comment.bro-know-my.org` 反向代理到 Artalk。

## 1. 准备配置

```bash
cd deploy/artalk
cp .env.example .env
openssl rand -base64 36  # 用于 POSTGRES_PASSWORD
openssl rand -hex 32     # 用于 ARTALK_APP_KEY
```

编辑 `.env`，至少替换两个随机值、正式站点 URL 和站点名。`.env` 已在 `.gitignore` 中排除。

`ARTALK_TRUSTED_DOMAINS` 除正式站点域名外，还要保留本地开发与预览端口 `55173`、`55174` 的 `localhost` 和 `127.0.0.1` 来源。缺少这些来源时，评论框能够挂载，但浏览器会通过 CORS 拦截本地请求。

## 2. 启动服务

```bash
docker compose pull
docker compose up -d
docker compose ps
docker compose logs --tail=100 artalk
```

先从 VPS 本机验证：

```bash
curl -I http://127.0.0.1:23366
```

Artalk 容器需要访问 GitHub OAuth 和邮件服务，因此 Compose 网络允许出站连接；PostgreSQL 仍因没有 `ports` 配置而不对公网开放。

## 3. Nginx 与 HTTPS

先为评论域名添加 DNS 记录：

```text
A  comment.bro-know-my.org  -> VPS 公网 IPv4
```

初次部署时，证书文件还不存在，先使用 `nginx/comment.bro-know-my.org.http.conf`：

```bash
sudo install -d -m 0755 /var/www/certbot
sudo cp nginx/comment.bro-know-my.org.http.conf \
  /etc/nginx/sites-available/comment.bro-know-my.org.conf
sudo ln -s /etc/nginx/sites-available/comment.bro-know-my.org.conf \
  /etc/nginx/sites-enabled/comment.bro-know-my.org.conf
sudo nginx -t
sudo systemctl reload nginx
```

DNS 生效且公网 `80` 可访问后，使用 Webroot 申请证书：

```bash
sudo certbot certonly --webroot \
  -w /var/www/certbot \
  -d comment.bro-know-my.org
```

证书签发成功后再换成仓库中的 HTTPS 配置：

```bash
sudo cp nginx/comment.bro-know-my.org.conf \
  /etc/nginx/sites-available/comment.bro-know-my.org.conf
sudo nginx -t
sudo systemctl reload nginx
sudo certbot renew --dry-run
```

最终验证：

```bash
curl -fsS https://comment.bro-know-my.org/api/v2/version
```

将评论域名接入 Cloudflare 代理前，先安装真实访客 IP snippet：

```bash
sudo cp nginx/cloudflare-real-ip.conf /etc/nginx/snippets/cloudflare-real-ip.conf
```

并在评论域名的 HTTPS `server` 块中加入：

```nginx
include /etc/nginx/snippets/cloudflare-real-ip.conf;
```

反向代理使用解析后的地址，不继续拼接客户端可控的 `X-Forwarded-For`：

```nginx
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $remote_addr;
```

Cloudflare 官方代理 IP 段发生变化时，应同步更新 snippet、运行 `nginx -t` 并安全 reload。未安装该配置前不要把评论域名切成橙云，否则 Artalk 日志、频控和审核记录会把 Cloudflare 节点当成访客 IP。

当前 vultr-jp 已完成正式部署：HTTP 自动跳转 HTTPS，Let's Encrypt 自动续期 dry-run 通过。评论域名已接入 Cloudflare，缓存状态保持 `DYNAMIC`，源站继续返回 `Cache-Control: no-store`；Nginx 已验证能够恢复真实访客 IPv4/IPv6。Certbot 账号最初使用无邮箱模式注册；后续有稳定运维邮箱时，应使用 `certbot update_account --email 你的邮箱` 补上证书到期通知地址。

不要把 `23366` 或 PostgreSQL 的 `5432` 开放到公网。若服务器原有程序占用 `80/443`，应先备份配置、把它安全迁移到其他端口并完成可用性验证，再让 Nginx 接管端口。

## 4. Cloudflare Tunnel 备选方案

无法释放服务器 `80/443` 时，可以在 Cloudflare Zero Trust 创建 Tunnel，将 `comment.bro-know-my.org` 指向 `http://127.0.0.1:23366`。仓库中的 `cloudflared/config.yml.example` 可作为 named-tunnel 配置参考。Tunnel Token 和凭据文件只保留在 VPS，不得写入仓库或聊天记录。

无论使用哪种入口，Artalk API、管理入口和 OAuth 回调都不应缓存。

## 5. 站点与登录

当前管理员已经创建，生成密码只保存在 vultr-jp 的 `/root/bkm-artalk-admin-credentials.env`，权限为 `600 root:root`，不进入仓库或聊天记录。首次登录后应把占位管理员邮箱改成实际可接收通知的地址，并妥善轮换密码。

评论策略为必须登录后才能发布；普通登录用户的正常评论直接公开，命中轻量垃圾关键词规则的评论仍进入待审核。渐进式图片验证码频控继续保留。评论、嵌套回复、点赞、登录、退出、删除和通知流程已完成测试。

GitHub OAuth 需要先创建 OAuth App：

```text
Homepage URL: https://bro-know-my.org
Authorization callback URL: https://comment.bro-know-my.org/api/v2/auth/github/callback
```

对应 Artalk 2.10.0 配置为：

```dotenv
ATK_AUTH_ENABLED=true
ATK_AUTH_ANONYMOUS=false
ATK_AUTH_EMAIL_ENABLED=false
ATK_AUTH_CALLBACK=https://comment.bro-know-my.org/api/v2/auth/{provider}/callback
ATK_AUTH_GITHUB_ENABLED=true
ATK_AUTH_GITHUB_CLIENT_ID=替换为真实 Client ID
ATK_AUTH_GITHUB_CLIENT_SECRET=替换为真实 Client Secret
```

Client Secret 只写入 VPS 的 `.env`，不得进入 GitHub Actions Variables、仓库或前端构建产物。

在邮件发送服务配置完成前保持 `ATK_AUTH_EMAIL_ENABLED=false`，避免向访客展示无法完成验证码发送的 Email 登录入口；当前只开放 GitHub 登录。

当前 `ATK_MODERATOR_PENDING_DEFAULT=false`，只关闭默认待审；关键词规则的 `ATK_MODERATOR_KEYWORDS_PENDING=true` 继续生效。

前端构建时设置：

```dotenv
VITE_ARTALK_SERVER=https://comment.bro-know-my.org
VITE_ARTALK_SITE=兄弟懂我的页面
```

已逐项测试评论、嵌套回复、点赞、登录、退出、审核、删除、通知与异常降级；重大配置变更后再重复这组回归测试。

## 6. 人工备份与恢复

升级 Artalk、PostgreSQL 或调整重要配置前执行：

```bash
mkdir -p backups
docker compose exec -T postgres pg_dump \
  -U artalk \
  -d artalk \
  --format=custom \
  > "backups/artalk-$(date +%Y%m%d-%H%M%S).dump"
```

vultr-jp 已完成首次 custom-format `pg_dump`，并通过 `pg_restore --list` 验证目录可读。服务器内备份只是第一层保护；仍需将备份加密后复制到另一台机器或本地存储。

首次备份已经使用 GnuPG AES-256 对称加密后复制到本地，明文临时文件在解密校验成功后删除。加密文件与随机密钥分开保存；密钥不得进入仓库，后续还应复制到密码管理器或另一处离线介质，避免本机磁盘故障时备份和密钥同时丢失。

如果 `.env` 中改过数据库名或用户，请同步替换命令参数。备份文件应离开 VPS、加密后保存到本地安全位置，不要提交到 Git。

恢复前先停止 Artalk，并再次确认目标数据库和备份文件：

```bash
docker compose stop artalk
docker compose exec -T postgres dropdb -U artalk --if-exists artalk
docker compose exec -T postgres createdb -U artalk artalk
docker compose exec -T postgres pg_restore \
  -U artalk \
  -d artalk \
  --clean \
  --if-exists \
  < backups/ARTALK_BACKUP.dump
docker compose start artalk
```

恢复属于破坏性操作，执行前应额外保留当前数据库备份，并在测试环境至少演练一次。

## 7. 更新

镜像使用明确版本，避免 `latest` 在无人值守时引入破坏性变化。更新版本号之前先阅读 Artalk 和 PostgreSQL 的发布说明、执行备份，再运行：

```bash
docker compose pull
docker compose up -d
docker compose logs --tail=100 artalk
```
