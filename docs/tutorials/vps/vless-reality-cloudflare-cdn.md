---
title: 日本 VPS 自建 VLESS + Reality 与 Cloudflare CDN 双线路
description: 使用 VLESS + Reality 直连与 Cloudflare WebSocket TLS 线路互为兜底的完整部署记录。
date: 2026-08-07
updated: 2026-08-07
tags:
  - VPS
  - VLESS
  - Cloudflare
  - 网络
---

# 日本 VPS 自建双线路代理：VLESS + Reality 直连 + Cloudflare CDN 兜底

> 合规提醒：自建代理属于敏感用途，请确认你所在地区的法律法规允许，风险自负。本文只记录技术部署过程，不构成任何使用建议。

## 一、方案概览

一套同时满足 Windows / macOS / Android / iPhone 全设备的自建方案，两条线路互为兜底：

1. **直连线路**：VLESS + Reality，监听 443。不需要域名和证书，速度快，日常主力。
2. **兜底线路**：Cloudflare CDN + VLESS + WebSocket + TLS。客户端连域名 443，Cloudflare 回源到服务器的 8443；直连 IP 被针对时切这条。

证书走 Let's Encrypt + acme.sh 的 HTTP-01 验证，不需要 Cloudflare API Token，签发和续期全自动。

## 二、准备工作

- 一台日本 VPS，安装 Debian 12（64 位）
- 一个域名，NS 已托管到 Cloudflare
- 所有操作通过 SSH 手动执行，不用一键脚本

## 三、服务器基础设置

### 1. 系统更新

```bash
apt update && apt upgrade -y
```

### 2. 安装 Xray

使用官方安装脚本，它只负责安装程序和 systemd 服务，不碰配置：

```bash
apt install -y curl ca-certificates openssl
bash -c "$(curl -L https://github.com/XTLS/Xray-install/raw/main/install-release.sh)" @ install
xray version
```

### 3. 防火墙

Debian 12 可能默认就开着 ufw，只放行了 22。按需放行：

```bash
ufw allow 22/tcp          # 如果 SSH 已改高位端口，改成你的端口
ufw allow 80/tcp          # HTTP-01 证书验证
ufw allow 443/tcp         # Reality 直连
ufw allow 8443/tcp        # Cloudflare 回源
```

### 4. SSH 加固（强烈建议）

```bash
ufw allow 55222/tcp
printf "Port 55222\n" > /etc/ssh/sshd_config.d/99-port.conf
sshd -t
systemctl restart ssh
```

确认新端口能登录后，再删掉 22 的放行规则：

```bash
ufw delete allow 22/tcp
```

有条件的话再关掉密码登录，只保留密钥：

```text
# /etc/ssh/sshd_config.d/99-hardening.conf
PasswordAuthentication no
PubkeyAuthentication yes
PermitRootLogin prohibit-password
```

## 四、配置 Reality 直连线路

### 1. 生成参数

```bash
xray uuid
xray x25519
openssl rand -hex 8
```

分别得到：UUID、Reality 私钥/公钥对、shortId。**私钥只放服务器，公钥给客户端。**

### 2. 写入配置

```json
{
  "log": {
    "loglevel": "warning"
  },
  "inbounds": [
    {
      "listen": "0.0.0.0",
      "port": 443,
      "protocol": "vless",
      "settings": {
        "clients": [
          {
            "id": "YOUR_UUID",
            "flow": "xtls-rprx-vision"
          }
        ],
        "decryption": "none"
      },
      "streamSettings": {
        "network": "tcp",
        "security": "reality",
        "realitySettings": {
          "show": false,
          "dest": "www.apple.com:443",
          "xver": 0,
          "serverNames": [
            "www.apple.com"
          ],
          "privateKey": "YOUR_PRIVATE_KEY",
          "shortIds": [
            "YOUR_SHORT_ID"
          ]
        }
      }
    }
  ],
  "outbounds": [
    {
      "protocol": "freedom",
      "tag": "direct"
    },
    {
      "protocol": "blackhole",
      "tag": "block"
    }
  ]
}
```

写入 `/usr/local/etc/xray/config.json`，然后校验并启动：

```bash
xray run -test -config /usr/local/etc/xray/config.json
systemctl restart xray
systemctl status xray --no-pager | head -n 5
ss -tlnp | grep 443
```

### 3. 客户端（Clash Verge Rev 为例）

Clash Verge Rev 不能直接粘贴 vless:// 链接，需要手动建一个 Local 配置：

1. 「订阅」→「新建」→ 类型选 Local；
2. 右键 →「打开文件」，粘贴下面的 YAML；
3. 保存后右键 →「使用」。

```yaml
mixed-port: 7890
allow-lan: false
mode: rule
log-level: info

proxies:
  - name: "Reality-日本"
    type: vless
    server: YOUR_VPS_IP
    port: 443
    uuid: YOUR_UUID
    network: tcp
    udp: true
    tls: true
    flow: xtls-rprx-vision
    servername: www.apple.com
    reality-opts:
      public-key: YOUR_PUBLIC_KEY
      short-id: YOUR_SHORT_ID
    client-fingerprint: chrome

proxy-groups:
  - name: "PROXY"
    type: select
    proxies:
      - "Reality-日本"

rules:
  - GEOIP,CN,DIRECT
  - MATCH,PROXY
```

v2rayN / v2rayNG / Shadowrocket 等可以直接导入：

```text
vless://YOUR_UUID@YOUR_VPS_IP:443?encryption=none&security=reality&sni=www.apple.com&fp=chrome&pbk=YOUR_PUBLIC_KEY&sid=YOUR_SHORT_ID&flow=xtls-rprx-vision&type=tcp#Reality
```

## 五、Cloudflare CDN 兜底线路

### 1. DNS 解析

在 Cloudflare 给代理子域名（例如 `go.example.com`）加一条 A 记录指向 VPS IP，**先保持灰云（DNS only）**，证书签完再开橙云。

### 2. 签发证书

```bash
curl -L https://get.acme.sh | sh -s email=admin@go.example.com
/root/.acme.sh/acme.sh --issue --standalone -d go.example.com --server letsencrypt --keylength ec-256
```

安装证书到 Xray 目录（注意续期命令用 restart 而不是 reload，见踩坑 5）：

```bash
/root/.acme.sh/acme.sh --install-cert -d go.example.com --ecc \
  --key-file /usr/local/etc/xray/cdn-key.pem \
  --fullchain-file /usr/local/etc/xray/cdn-cert.pem \
  --reloadcmd "chmod 644 /usr/local/etc/xray/cdn-key.pem; systemctl restart xray"
```

### 3. 在 Xray 配置里加第二个 inbound

生成 CDN 线路专用的 UUID 和随机 WS 路径：

```bash
xray uuid
openssl rand -hex 8
```

在 `inbounds` 数组里追加：

```json
{
  "listen": "0.0.0.0",
  "port": 8443,
  "protocol": "vless",
  "settings": {
    "clients": [
      {
        "id": "CDN_UUID",
        "flow": ""
      }
    ],
    "decryption": "none"
  },
  "streamSettings": {
    "network": "ws",
    "security": "tls",
    "tlsSettings": {
      "certificates": [
        {
          "certificateFile": "/usr/local/etc/xray/cdn-cert.pem",
          "keyFile": "/usr/local/etc/xray/cdn-key.pem"
        }
      ]
    },
    "wsSettings": {
      "path": "/YOUR_WS_PATH",
      "headers": {
        "Host": "go.example.com"
      }
    }
  }
}
```

校验并重启：

```bash
xray run -test -config /usr/local/etc/xray/config.json
systemctl restart xray
ss -tlnp | grep 8443
```

### 4. Cloudflare 面板设置

1. **SSL/TLS**：加密模式设为 **Full (strict)**；
2. **Rules → Origin Rules**：
   - 加一条规则：`主机名 等于 go.example.com` → 重写目标端口 **8443**；
   - 再加一条续期规则：`主机名 等于 go.example.com and URI 路径 开头为 /.well-known/acme-challenge/` → 重写目标端口 **80**；
3. **SSL/TLS → Edge Certificates**：确认 **Always Use HTTPS 关闭**；
4. 最后把 DNS 记录的云朵点成**橙色（Proxied）**。

### 5. 客户端配置

```text
vless://CDN_UUID@go.example.com:443?encryption=none&security=tls&sni=go.example.com&fp=chrome&type=ws&host=go.example.com&path=%2FYOUR_WS_PATH#CDN
```

Clash YAML 里加第二个节点：

```yaml
  - name: "CDN-Cloudflare"
    type: vless
    server: go.example.com
    port: 443
    uuid: CDN_UUID
    network: ws
    udp: true
    tls: true
    servername: go.example.com
    client-fingerprint: chrome
    ws-opts:
      path: /YOUR_WS_PATH
      headers:
        Host: go.example.com
```

## 六、长期无人值守

### BBR 加速

```bash
printf "net.core.default_qdisc=fq\nnet.ipv4.tcp_congestion_control=bbr\n" > /etc/sysctl.d/99-bbr.conf
sysctl --system
```

### 自动安全更新

Debian 12 默认就配置了 unattended-upgrades，确认：

```bash
cat /etc/apt/apt.conf.d/20auto-upgrades
```

建议再开启「按需自动重启」，内核更新后也能生效：

```bash
sed -i 's|^//Unattended-Upgrade::Automatic-Reboot "false";|Unattended-Upgrade::Automatic-Reboot "true";|' \
  /etc/apt/apt.conf.d/50unattended-upgrades
sed -i 's|^//Unattended-Upgrade::Automatic-Reboot-Time "02:00";|Unattended-Upgrade::Automatic-Reboot-Time "03:00";|' \
  /etc/apt/apt.conf.d/50unattended-upgrades
```

## 七、踩坑记录

### 坑 1：www.microsoft.com 不适合做 Reality 伪装站

**症状**：客户端全部连不上，日志里是 `REALITY: processed invalid connection`，客户端表现为 TLS 握手被立刻断开（EOF / connection reset）。

**原因**：微软调整过官网的 TLS 设置（证书链体积等），导致 Reality 握手阶段解析失败。这不是密钥配错，也不是 IP 被墙——用同一个版本、密钥完全正确的 Xray 客户端在服务器本机回环连接都一样失败。

**排查方法**：在服务器本机起一个同版本 xray 客户端连 `127.0.0.1:443`，如果也失败，就说明是服务端/伪装站问题，跟网络无关。

**解决**：把 `dest` 和 `serverNames` 从 `www.microsoft.com` 换成 `www.apple.com`，改完立刻恢复。换别的伪装站前建议先用 RealiTLScanner 扫描验证。

### 坑 2：证书私钥权限导致 Xray 启动失败

**症状**：加入 CDN inbound 后 `systemctl status xray` 显示 failed，日志提示读配置失败。

**原因**：acme.sh 安装的私钥文件是 600 权限（仅 root 可读），而官方 Xray 服务以 `nobody` 用户运行，读不了私钥。

**解决**：

```bash
chmod 644 /usr/local/etc/xray/cdn-key.pem
systemctl restart xray
```

并且续期 reloadcmd 里也要带上 chmod，否则下次续期又复现：

```bash
--reloadcmd "chmod 644 /usr/local/etc/xray/cdn-key.pem; systemctl restart xray"
```

### 坑 3：Cloudflare Origin Rules 的顺序坑（后面的覆盖前面的）

**症状**：按“acme-80 规则在前、8443 规则在后”的顺序配，续期请求依然被转到 8443，实测返回 `400 Client sent an HTTP request to an HTTPS server.`

**原因**：Origin Rules 的“重写端口”是非终止动作，同一阶段里**后面的规则会覆盖前面规则改过的值**。两条规则都匹配时，排后面的 8443 规则把 80 覆盖回去了。

**解决（推荐）**：让 8443 规则排除续期路径，不依赖顺序：

```text
主机名 等于 go.example.com and URI 路径 开头不是 /.well-known/acme-challenge/
```

如果坚持用两条规则，则 **80 规则必须排在 8443 规则后面**。

验证方法：在服务器 80 端口临时起个服务，再从外网请求 `http://go.example.com/.well-known/acme-challenge/test`，能拿到 200 说明规则生效。

### 坑 4：Always Use HTTPS 会破坏 HTTP-01 续期

HTTP-01 走的是明文 80 端口，如果 Cloudflare 开了 Always Use HTTPS，续期请求会被 301 重定向到 HTTPS，Let's Encrypt 不跟随重定向，验证失败。证书续期前务必确认它是关闭状态。

### 坑 5：`systemctl reload xray` 不可用

官方 Xray systemd 单元没有定义 ExecReload，直接 `systemctl reload xray` 会报 `Job type reload is not applicable`。acme.sh 的 reloadcmd 要用 `systemctl restart xray`。

### 坑 6：忘了放行防火墙端口

服务器 443 从外网连不上，先查 `ufw status`。Debian 12 部分镜像默认 ufw 只放行 22，443 / 8443 / 80 都需要手动放行。

### 坑 7：本机 dig 结果被 Clash fake-ip 污染

开着 Clash 时 dig 任何域名都可能返回 `198.18.x.x` 的假 IP，甚至 `dig @8.8.8.8` 也一样。验证 DNS 解析时，在服务器上执行，或从没开代理的设备上执行：

```bash
dig @1.1.1.1 +short go.example.com A
```

## 八、常用排查命令

```bash
# Xray 状态和日志
systemctl status xray
journalctl -u xray -n 50

# 端口监听
ss -tlnp | grep -E ":443 |:8443 "

# 配置校验
xray run -test -config /usr/local/etc/xray/config.json

# 手动续期（验证整个链路）
/root/.acme.sh/acme.sh --renew -d go.example.com --ecc --force
```

## 九、写在最后

这套方案的优点是：直连线路没有域名和证书依赖、速度快；CDN 线路在 IP 被针对时兜底；证书全自动续期；服务器可以长期无人值守。缺点也很明显：CDN 线路带宽和速度受 Cloudflare 免费版限制，只适合兜底。

所有密钥和 UUID 都属于你的服务器凭据，发布文章时记得像我这样用占位符替换，不要公开真实值。
