---
author: 假发
title: R9000P 在 Linux 下只有 80W？把 NVIDIA Dynamic Boost 配起来
description: R9000P 2021H 的 RTX 3060 在 Ubuntu 下显示 80W 上限，补齐 nvidia-powerd 服务与 D-Bus 权限后，实测上限升到 130W。
date: 2026-09-06
updated: 2026-09-06
tags:
  - Linux
  - NVIDIA
  - Ubuntu
  - 故障排查
---

# R9000P 在 Linux 下只有 80W？把 NVIDIA Dynamic Boost 配起来

起因很简单：想看看自己的 N 卡是不是被限功耗了。一查，RTX 3060 Laptop GPU 的当前上限只有 **80W**，最大值却写着 **130W**。

最后补齐 `nvidia-powerd` 服务和 D-Bus 权限，读数依次变成了 **80W → 115W → 130W**。这篇记录实际排查过程，以及可以复用的配置步骤。

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

本机没有找到对应的 NVIDIA D-Bus 策略文件。针对日志明确拒绝的 `nvidia.powerd.server`，为以 root 身份运行的服务添加最小配置。

下面的命令会写入指定文件，适用于该文件尚不存在的情况。如果已有配置，先检查内容；发行版自带的策略应优先使用。

```bash
sudo tee /etc/dbus-1/system.d/nvidia-powerd.conf > /dev/null <<'EOF'
<!DOCTYPE busconfig PUBLIC "-//freedesktop//DTD D-BUS Bus Configuration 1.0//EN"
 "http://www.freedesktop.org/standards/dbus/1.0/busconfig.dtd">
<busconfig>
  <policy user="root">
    <allow own="nvidia.powerd.server"/>
    <allow send_destination="nvidia.powerd.server"/>
  </policy>
</busconfig>
EOF
sudo chmod 644 /etc/dbus-1/system.d/nvidia-powerd.conf
sudo systemctl reload dbus
sudo systemctl restart nvidia-powerd
```

这里重新加载 D-Bus 配置即可，不需要重启整个 D-Bus 服务。

再次检查当前服务状态和功耗：

```bash
systemctl status nvidia-powerd --no-pager
nvidia-smi -q -d POWER,PERFORMANCE
```

这次启动日志出现了：

```text
DBus Connection is established
```

同时观察到：

```text
Current Power Limit : 130.00 W
Default Power Limit : 80.00 W
Max Power Limit : 130.00 W
```

默认值仍然是 80W，但当前上限已经到 130W。这也说明为什么一开始不能只盯着 `Default Power Limit`。

115W 和 130W 是两次检查时的读数；因为没有控制负载做对照实验，不能把补权限后的全部变化都归因于这一项配置。能确认的是：D-Bus 错误消失了，服务在运行，当前功耗上限达到了 130W。

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
| 补权限并重启后 | 130W | 运行中，D-Bus 连接成功 |

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
