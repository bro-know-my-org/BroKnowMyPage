---
author: 假发
title: R9000P 在 Linux 下只有 80W？把 NVIDIA Dynamic Boost 配起来
description: R9000P 2021H 的 RTX 3060 在 Ubuntu 下显示 80W 上限，补齐 nvidia-powerd 服务与 D-Bus 权限后，实测上限升到 130W。
date: 2026-09-06
updated: 2026-09-15
tags:
  - Linux
  - NVIDIA
  - Ubuntu
  - 故障排查
---

# R9000P 在 Linux 下只有 80W？把 NVIDIA Dynamic Boost 配起来

起因很简单：想看看自己的 N 卡是不是被限功耗了。一查，RTX 3060 Laptop GPU 的当前上限只有 **80W**，最大值却写着 **130W**。

最初补齐 `nvidia-powerd` 服务和部分 D-Bus 权限后，读数依次变成了 **80W → 115W → 130W**。但 2026-09-15 复查发现，旧配置遗漏普通用户客户端的发送权限，导致认证日志累积到约 6.5 GiB。本文已修正配置步骤，并补充服务端与客户端的双向验证。

先把结果的范围说清楚：这里验证的是**功耗上限恢复到 130W**，没有进行持续满载测试，也没有测游戏帧率提升。

## 环境与最初的读数

| 项目 | 本次环境 |
| --- | --- |
| 笔记本 | 联想 R9000P 2021H，机型代码 82JQ |
| 显卡 | NVIDIA GeForce RTX 3060 Laptop GPU |
| 系统 | Ubuntu 24.04.4 LTS |
| NVIDIA 驱动 | 595.84，安装包为 595-open 系列 |
| 供电与模式 | 已接外部电源，平台模式为 performance |

先读取功耗和限频原因：

```bash
nvidia-smi -q -d POWER,PERFORMANCE
```

最初的关键输出如下：

```text
Current Power Limit : 80.00 W
Requested Power Limit : 80.00 W
Default Power Limit : 80.00 W
Max Power Limit : 130.00 W

SW Power Cap : Not Active
HW Thermal Slowdown : Not Active
```

这里容易误判两次。

第一，`Default Power Limit` 是驱动报告的默认值，不能只看到它是 80W，就认定这台笔记本正常工作时只能用 80W。实际生效的上限要看 `Current Power Limit`，动态功耗管理介入后还会变化。

第二，**有功耗上限，不等于此刻撞到了功耗墙**。当时显卡只消耗约 17～30W，温度约 41～45℃，没有触发功耗或温度限频。这组低负载数据也不能用来判断满载散热是否足够。

另外，本机单独查询 CSV 的 `power.limit` 字段曾返回 `N/A`，而上面的详细查询能显示当前上限。遇到这种情况，可以换详细输出交叉确认。

## 先确认支持，再看服务

Dynamic Boost 会根据平台条件动态调整 CPU 与 GPU 的功耗分配。在 Linux 下，需要检查 `nvidia-powerd` 是否可用，不能只看显卡型号。

这台机器用下面的命令查询支持状态：

```bash
nvidia-settings -q DynamicBoostSupport
```

返回值中包含：

```text
Attribute 'DynamicBoostSupport' (...[gpu:0]): 1.
```

`1` 表示驱动报告支持。如果命令因图形会话或显示连接问题无法查询，不能把查询失败直接当成“不支持”。本次是在本机图形会话里得到的结果。

接着检查程序和服务：

```bash
command -v nvidia-powerd
systemctl status nvidia-powerd --no-pager
```

结果很有意思：**程序已经安装，服务却不存在**。

```text
/usr/bin/nvidia-powerd
Unit nvidia-powerd.service could not be found.
```

继续查看本机驱动包的文件列表：

```bash
dpkg -L nvidia-kernel-common-595
```

里面有现成的服务模板：

```text
/usr/share/doc/nvidia-kernel-common-595/nvidia-powerd.service
```

所以这次缺少的是服务注册和权限配置，不需要重装整套显卡驱动。其他驱动版本的包名、模板路径可能不同；如果系统已经提供服务，直接使用已有服务即可，不要再覆盖一份。

## 注册并启动 nvidia-powerd

以下安装命令适用于本次这种“程序存在、服务缺失、模板存在”的情况：

```bash
sudo install -m 644 \
  /usr/share/doc/nvidia-kernel-common-595/nvidia-powerd.service \
  /etc/systemd/system/nvidia-powerd.service
sudo systemctl daemon-reload
sudo systemctl enable --now nvidia-powerd
```

检查状态与日志：

```bash
systemctl status nvidia-powerd --no-pager
journalctl -u nvidia-powerd -b --no-pager -n 50
nvidia-smi -q -d POWER,PERFORMANCE
```

服务已经是 `active (running)`，功耗上限也从 80W 变成了 **115W**。但日志还有错误：

```text
Error requesting D-Bus name (... is not allowed to own the service "nvidia.powerd.server" due to security policies in the configuration file)
Failed to acquire D-Bus name ((null))
Error setting up DBus connection
```

这说明“进程活着”还不等于初始化完整成功，需要继续补齐 D-Bus 权限。

## 补上 D-Bus 配置

[NVIDIA 595.84 官方说明](https://download.nvidia.com/XFree86/Linux-x86_64/595.84/README/dynamicboost.html)要求安装驱动配套的 `nvidia-dbus.conf`。官方安装布局中的示例路径是 `/usr/share/doc/NVIDIA_GLX-1.0/nvidia-dbus.conf`；发行版打包路径可能不同，应优先使用发行版或同版本驱动提供的文件。

本机 Ubuntu 包没有安装这份策略。原文只为 root 添加了 `own` 和 `send_destination`，虽然解决了服务注册名称失败的问题，却遗漏了普通用户客户端。正确的权限区分是：**只有 root 能注册服务名称，普通用户可以向该服务发送消息**。不能把包含 `own` 的整段策略直接改成对所有用户开放。

本次从 [595.84 官方驱动包](https://download.nvidia.com/XFree86/Linux-x86_64/595.84/NVIDIA-Linux-x86_64-595.84.run)提取 `nvidia-dbus.conf`，并通过安装包自带的 CRC 与 MD5 完整性校验。下面保留原文件内容；策略文件的 SHA-256 为 `67d5c6989ac21625db5a62984a0ecf0d55d241065c29c90a58bbbe63ad8f6a81`。本机沿用 `nvidia-powerd.conf` 文件名替换旧策略；D-Bus 会读取该目录中的 `.conf` 文件，名称无需与包内一致。

文件已存在时先备份；如果发行版已经提供完整策略，应检查并使用它，避免重复维护两份配置。

```bash
sudo cp -a /etc/dbus-1/system.d/nvidia-powerd.conf \
  /etc/dbus-1/system.d/nvidia-powerd.conf.bak
sudo tee /etc/dbus-1/system.d/nvidia-powerd.conf > /dev/null <<'EOF'
<busconfig>
  <type>system</type>
  <policy user="root">
    <allow own="nvidia.powerd.server"/>
  </policy>
  <policy context="default">
    <allow send_destination="nvidia.powerd.server"/>
  </policy>
</busconfig>
EOF
sudo chmod 644 /etc/dbus-1/system.d/nvidia-powerd.conf
sudo systemctl reload dbus
sudo systemctl restart nvidia-powerd
```

备份命令适用于文件已存在且尚未使用该备份名的情况；首次创建可跳过备份，已有备份则换一个文件名保留它。这里只重新加载 D-Bus 配置，不重启整个系统总线。

再次检查服务状态和功耗：

```bash
systemctl status nvidia-powerd --no-pager
journalctl -u nvidia-powerd -b --no-pager -n 50
nvidia-smi -q -d POWER,PERFORMANCE
```

2026-09-06 初次配置时观察到：

```text
DBus Connection is established
Current Power Limit : 130.00 W
Default Power Limit : 80.00 W
Max Power Limit : 130.00 W
```

默认值仍然是 80W，但当前上限已经到 130W。115W 和 130W 是两次检查时的读数；因为没有控制负载做对照实验，不能把全部变化归因于 D-Bus 配置。**连接建立和功耗上限正常，也不能证明所有客户端通信正常。**

## 2026-09-15 复查：为什么认证日志涨到 6.5 GiB

系统盘占用检查发现，`/var/log/auth.log` 和轮转后的 `auth.log.1` 合计约 6.5 GiB。近期日志样本中，大量重复信息形如：

```text
Rejected send message
sender=... uid=1000 comm="...msedge --type=gpu-process..."
interface="nvidia.powerd.datapacket" member="AutoflDatapacket"
destination="nvidia.powerd.server" uid=0 comm="/usr/bin/nvidia-powerd"
```

另一个频繁出现的发送方是桌面合成器 `kwin_x11`。这些普通用户进程中的 NVIDIA 客户端向电源服务发消息，被只允许 root 发送的旧策略拒绝。它们不是登录失败记录，也不意味着浏览器在自行修改显卡功耗上限。

拒绝记录来自 **`dbus-daemon`**，因此只查看 `journalctl -u nvidia-powerd` 会漏掉问题。原文“D-Bus 错误消失了”的说法仅适用于当时服务启动时的连接错误，不能覆盖客户端调用。

补齐策略后，应在浏览器、桌面合成器正常运行时，同时检查：

```bash
systemctl is-active nvidia-powerd
sudo journalctl -b --since '2 minutes ago' _COMM=dbus-daemon --no-pager \
  | grep -E 'Rejected.*nvidia\.powerd|nvidia\.powerd.*Rejected'
sudo tail -n 1000 /var/log/auth.log \
  | grep -E 'Rejected.*nvidia\.powerd|nvidia\.powerd.*Rejected'
nvidia-smi -q -d POWER,PERFORMANCE
```

`grep` 无匹配时返回 1 是正常现象。日志尾部可能仍有修复前的旧记录，应结合时间戳观察新的拒绝是否继续产生，而不是要求旧日志立刻消失。功耗上限会随平台条件变化，不要求任何时刻都固定为 130W。

本机原先按周轮转认证日志，未设置大小阈值；这会放大高频报错造成的空间占用。应先修复通信，再压缩保留旧日志，并设置轮转大小阈值。`logrotate` 的 `maxsize` 只在定时任务执行时检查，**并非实时硬上限**；例如配合每小时检查，才能在每日轮转之间处理超过阈值的日志。不能靠丢弃所有认证日志或屏蔽 D-Bus 错误代替修复。

本次实际将 `/var/log/auth.log` 从原来的 rsyslog 轮转组单独拆出，设置 `daily`、`maxsize 100M`、`rotate 7` 和 `compress`，并把 `logrotate.timer` 改为每小时检查。拆出时必须从旧规则中移除同一日志路径，避免重复定义；其他 rsyslog 日志仍保留原有轮转规则。

修复后实测：服务为 `active`，当前功耗上限仍为 **130W**；连续 20 秒内认证日志没有增长，也没有新增 NVIDIA D-Bus 拒绝。两份历史认证日志合计约 **6.5 GiB**，压缩后约 **143 MiB**，`gzip -t` 完整性检查通过。这里验证的是当时桌面正常运行时的通信和日志情况，未进行持续满载、重启或电池模式测试。

## 日志里剩下的 DC 错误是什么

服务最后仍然输出了这些信息：

```text
ERROR! DC power limits table is not supported
ERROR! Failed to get SysPwrLimitGetInfo!!
ERROR! Client (presumably SBIOS) has requested to disable Dynamic Boost DC controller
```

这些信息指向电池供电相关的 DC 控制器，最后一条还明确写了由客户端请求禁用，程序推测客户端是系统 BIOS。

它们不能直接推出“插电时 Dynamic Boost 也不可用”：本次接着外部电源，已经观察到 130W 上限。这里没有继续修改电池模式或 BIOS 设置。

## 怎么确认实际使用效果

完成配置后的记录是：

| 阶段 | 当前功耗上限 | 服务情况 |
| --- | --- | --- |
| 配置前 | 80W | 服务不存在 |
| 注册服务后 | 115W | 运行中，D-Bus 连接报错 |
| 初次补权限并重启后 | 130W | 服务连接成功，后续发现客户端权限仍不完整 |

最后一次采样的实际功耗只有约 28W，这是低负载下的正常读数。130W 是允许使用的上限，不是让显卡随时消耗 130W，也不代表帧率会按功耗比例上涨。

要看游戏或计算任务是否受益，可以运行自己的常用负载，同时监控：

```bash
nvidia-smi --query-gpu=timestamp,utilization.gpu,power.draw,temperature.gpu,clocks.gr \
  --format=csv -l 1
```

按 `Ctrl+C` 停止。再用详细查询观察当前上限和限频原因：

```bash
nvidia-smi -q -d POWER,PERFORMANCE,TEMPERATURE
```

满载时出现 `SW Power Cap: Active`，表示当时频率受功耗约束，不一定是故障。判断改善效果还要结合任务耗时、帧率和温度。持续满载表现以及重启后的实际读数，本次尚未验证；目前只确认服务已经设置开机自启。

## 如何撤销这次配置

如果完全照本文新增了这两个文件，可以停止服务并删除本次配置：

```bash
sudo systemctl disable --now nvidia-powerd
sudo rm /etc/systemd/system/nvidia-powerd.service
sudo rm /etc/dbus-1/system.d/nvidia-powerd.conf
sudo systemctl daemon-reload
sudo systemctl reload dbus
```

如果文件原先就存在，应该恢复备份，不能直接删除。停止服务也不保证功耗上限立刻回到原值；必要时重启，再读取显卡状态确认。

这次没有手动执行 `nvidia-smi -pl 130`，也没有刷显卡 BIOS。解决问题的关键，是让这台机器已有的动态功耗管理组件真正运行起来。
