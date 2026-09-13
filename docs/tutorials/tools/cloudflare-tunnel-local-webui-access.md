---
author: 假发
title: 没有公网 IP，也能在外面打开家里的 WebUI
description: 用 Cloudflare Tunnel 把本地 WebUI 或其他网页应用接到域名上，再通过 Access 限定登录身份，无需公网 IP 和路由器端口转发。
date: 2026-09-13
updated: 2026-09-13
tags:
  - Cloudflare
  - 内网穿透
  - WebUI
  - 远程访问
---

# 没有公网 IP，也能在外面打开家里的 WebUI

用 **Cloudflare Tunnel + Access**，可以把本地 WebUI、自建笔记或其他网页应用挂到域名上，登录后远程访问。不需要公网 IP、路由器端口转发或额外的 VPS，电脑保持开机联网即可。

下面以 Ubuntu / Debian 为例，假设域名已接入 Cloudflare，本地应用运行在 `http://127.0.0.1:8080`。文中的 `webui.example.com`、邮箱和 Token 都要替换成自己的值。

## 1. 安装 cloudflared

```bash
sudo apt-get update
sudo apt-get install -y curl ca-certificates
sudo mkdir -p --mode=0755 /usr/share/keyrings

curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg \
  | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null

echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main' \
  | sudo tee /etc/apt/sources.list.d/cloudflared.list

sudo apt-get update
sudo apt-get install -y cloudflared
```

Windows、macOS 使用隧道创建页面提供的安装命令。

## 2. 配置 Access 登录

先设置访问权限，再发布路由，避免面板直接暴露。

进入 **Zero Trust → Integrations → Identity providers**，使用已有的 **Cloudflare** 提供商；没有就点 **Add new identity provider → Cloudflare**。自己使用时保留 **Restrict to account members**。

接着进入 **Access controls → Applications → Create new application → Self-hosted and private**，添加公开主机名。旧界面可能叫 **Access → Applications → Add an application → Self-hosted**。

| 配置项 | 填写值 |
| --- | --- |
| Application name | `My WebUI` |
| Public hostname | `webui.example.com` |
| Path | 留空，保护整个站点 |
| Session duration | 例如 `24 hours` |
| Login methods | 只选 Cloudflare |

创建并关联一条 **Allow** 策略：**Include → Emails → 自己的 Cloudflare 登录邮箱**，例如 `you@example.com`。不要选 `Everyone` 或 `Bypass`。

开启 **Apply instant authentication** 可直接跳转账号登录，省去登录方式选择页。保存应用。

## 3. 创建隧道

进入 **Networking → Tunnels → Create a tunnel**。部分界面入口在 **Zero Trust → Networks → Connectors → Cloudflare Tunnels**。

创建隧道，连接器类型选 **Cloudflared**，在本机执行页面给出的 Token 命令：

```bash
sudo cloudflared service install 'YOUR_TUNNEL_TOKEN'
sudo systemctl enable --now cloudflared
sudo systemctl is-active cloudflared
```

预期输出 `active`，控制台显示 `Healthy`。已经安装过该隧道服务就不用重复安装；Token 不要公开。

## 4. 添加已发布应用程序路由

进入隧道的 **Routes → Add route → Published application**，也可能叫 **Published application routes / Public Hostnames**。

| 配置项 | 填写值 |
| --- | --- |
| Subdomain | `webui` |
| Domain | 自己的域名，示例为 `example.com` |
| Path | 留空 |
| Service URL | `http://127.0.0.1:8080` |

如果协议单独选择，就选 **HTTP**，地址填 `127.0.0.1:8080`。Cloudflare 全托管 DNS 的域名会自动创建对应记录。

`localhost:8080` 也能用，但它指的是 **cloudflared 所在的环境**。如果连接器在 Docker 容器里，要填容器能够访问到的应用地址。

用手机移动网络打开 `https://webui.example.com`：登录允许的账号后，应能进入 WebUI。再试一下实际操作和流式输出，确认不只是首页能打开。

## 可选：换成 GitHub 登录

在 GitHub 的 **Settings → Developer settings → OAuth Apps → New OAuth App** 创建应用：

| 字段 | 填写值 |
| --- | --- |
| Application name | `WebUI Access` |
| Homepage URL | `https://YOUR_TEAM.cloudflareaccess.com` |
| Authorization callback URL | `https://YOUR_TEAM.cloudflareaccess.com/cdn-cgi/access/callback` |

`YOUR_TEAM` 使用 Zero Trust 的团队名，可在 **Settings → Team name and domain** 查看；回调地址优先复制 Cloudflare 页面提供的值。

拿到 Client ID 和 Client Secret 后，在 **Integrations → Identity providers → Add new identity provider → GitHub** 中分别填入 **App ID** 和 **Client secret**，保存并完成授权。

用 **Test** 确认返回的邮箱，再把 Access 应用的登录方式改为只选 GitHub，Allow 策略改为该邮箱。开启 **Apply instant authentication** 后，访问网站会直接跳转 GitHub，**不用进入 Cloudflare 管理仪表盘**。

需要验证器 2FA，就在 Cloudflare 或 GitHub 账号安全设置里开启。已有登录会话时，不一定每次访问都重新输入验证码。

## 连不上时查这几项

| 现象 | 检查项 |
| --- | --- |
| 隧道离线 | 电脑是否休眠、断网，`cloudflared` 是否运行 |
| 502 | 本地应用是否启动，协议、端口和容器地址是否正确 |
| 登录后被拒绝 | Allow 策略是否关联，邮箱是否匹配 |
| 没登录就能进入 | Access 是否覆盖正确域名和路径，是否有 Bypass 或已有登录会话 |
| 首页能开、功能不能用 | 应用的外部 URL、Host / Origin、WebSocket 配置，前端是否写死 localhost |

本机检查命令：

```bash
curl -I http://127.0.0.1:8080
sudo journalctl -u cloudflared -n 50 --no-pager
```

Tunnel 负责转发，Access 负责认证，应用计算仍由本机承担。不再使用时，先删已发布路由和对应 DNS，再删 Access 应用，避免留下无认证入口。

参考：[Tunnel 官方教程](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/get-started/create-remote-tunnel/) · [Access 配置](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/) · [GitHub 登录配置](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/github/)
