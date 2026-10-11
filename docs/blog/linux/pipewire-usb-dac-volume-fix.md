---
author: 假发
title: PipeWire 下 USB DAC 音量到顶问题的排查与修复
description: 从 ALSA 双音量控件定位额外衰减，记录 ACP 硬件音量方案的前提、验证与回退，并补充软件混音配置的复查结果。
date: 2026-08-05
updated: 2026-10-11
tags:
  - Linux
  - PipeWire
  - 音频
  - 故障排查
---

# 一次 USB DAC“音量到顶”问题的排查：被 PipeWire 遗忘的主音量

> 环境：Kubuntu 24.04 · PipeWire 1.0.5 · WirePlumber 0.4.17
> 设备：Shanling UA1 Plus（USB DAC）

本文保留 2026 年 8 月的 ACP 硬件音量排查记录。2026-10-11 复查时，本机已使用软件音量配置，与下文的硬件方案不同；本次补充配置前提、验证范围和撤销方式，当前配置见文末。

## 症状

耳机音量有个很诡异的表现：

- 音量条拉到 100% 之后，再往上加“不加响度”；
- 强行拉到 150% 时声音会“炸”，是那种被软件强行放大的失真感；
- 即使停在 100%，也总觉得不如别的声音大，日常使用偏轻。

## 排查思路

### 1. 先确认系统音量对应的硬件控件

先看默认输出设备：

```console
$ wpctl status
```

默认 sink 是 Shanling UA1 Plus 的 analog-stereo 节点。再用 `cat /proc/asound/cards` 确认它对应的 ALSA 声卡编号，接着看这块声卡的控件：

```console
$ amixer -c 2 controls
numid=3,iface=MIXER,name='PCM Playback Volume'
numid=4,iface=MIXER,name='PCM Playback Volume',index=1
```

下文的声卡编号 `2`、控件 `numid=3/4` 和验证时的 PipeWire 节点 `35` 都是当时的示例。应根据自己的 `wpctl status`、`/proc/asound/cards` 和 `amixer controls` 输出替换，重启或重新插拔后不要沿用旧 ID。

同一块声卡上出现了**两个同名**的 `PCM Playback Volume`，只是 index 不同。查一下各自的类型和范围：

```console
$ amixer -c 2 cget numid=3
  ; type=INTEGER,access=rw---R--,values=2,min=0,max=127,step=0
  : values=91,91
  | dBminmax-min=-63.50dB,max=0.00dB

$ amixer -c 2 cget numid=4
  ; type=INTEGER,access=rw---R--,values=1,min=0,max=127,step=0
  : values=87
  | dBminmax-min=-63.50dB,max=0.00dB
```

- `numid=3`：左右声道音量（2 个值），范围 -63.5dB ~ 0dB；
- `numid=4`：**主音量**（单值，mono），范围同样是 -63.5dB ~ 0dB，但一直停在 87，也就是约 **-20dB**。

### 2. 把音量条和硬件读数对应起来

逐档拖动音量，同时读 `numid=3`：

| 系统音量 | numid=3 | 说明 |
|---|---|---|
| 50% | 91（-18dB） | 正常跟随 |
| 80% | 116（-5.5dB） | 正常跟随 |
| 90% | 122（-2.5dB） | 正常跟随 |
| 100% | 127（0dB） | **已经到硬件上限** |
| 150% | 127（0dB） | 硬件不再变化，只剩软件增益 |

而 `numid=4`（主音量）始终是 87（-20dB），一动不动。

这组读数说明：**当时音量条只带动左右声道控件，主音量保持在 -20dB**。两个控件的累计衰减是 0dB + (-20dB) = -20dB；这项硬件衰减仍在，继续提高软件数字增益还可能造成削波失真。

### 3. 手动验证主音量确实是瓶颈

把系统音量降到 50%，然后手动把主音量拉到 0dB：

```console
$ wpctl set-volume @DEFAULT_AUDIO_SINK@ 50%
$ amixer -c 2 cset numid=4 127
```

听感立刻接近原来 100% 的响度。这支持了额外 -20dB 衰减是本次响度偏低的重要原因，但不能单凭这次试听评价耳机或 DAC 的全部表现。

## 根因

Shanling UA1 Plus 是 USB Audio Class 设备，固件里同时暴露了两个音量控件：

- 一个左右声道音量（`PCM Playback Volume`，index=0）；
- 一个主音量（`PCM Playback Volume`，index=1）。

使用 ACP（ALSA Card Profiles）管理硬件音量时，`[Element PCM]` 没有显式指定索引，对应的是 **index=0**。当时的路径配置未将 index=1 的主音量纳入控制，这与它不随桌面音量变化的观测一致。排查时它保持在 -20dB；这个读数是否来自出厂状态、此前的硬件状态或 ALSA 状态恢复，本次没有验证。

> 顺带一提：系统里其他声卡（Realtek ALC287、NVidia HDMI）没有这个问题，因为它们的控件要么名字不同、能被 ACP 正确识别，要么根本没有硬件音量控件。

## 解决方案：ACP 用户级配置覆盖

### 前提：设备使用 ACP 硬件音量控制

先确认该设备使用 ACP 配置及本文修改的 `analog-output` 路径，并且没有启用 `api.alsa.soft-mixer = true`。可从 `wpctl status` 获取 ALSA **Device** 的 ID，再用 `wpctl inspect` 检查设备属性，同时核对 WirePlumber 的设备规则。

[WirePlumber 官方说明](https://pipewire.pages.freedesktop.org/wireplumber/daemon/configuration/alsa.html)指出，`api.alsa.soft-mixer = true` 会将音量与静音交给软件处理，硬件混音器不参与这两项调节。在这种配置下，仅添加下面的 ACP 控件段落，不能让桌面滑块按本文的方式控制两个硬件音量控件。如果要验证硬件方案，应先移除或禁用针对该设备的软件混音设置，再重新加载并确认实际属性。

### 配置路径与覆盖范围

PipeWire 的 ACP 支持在用户目录覆盖路径配置：

```text
~/.config/alsa-card-profile/mixer/paths/
```

做法是把系统自带的 `analog-output.conf` 复制一份到用户目录，然后追加一个控件定义，把主音量也纳入管理：

```ini
; 系统自带的 analog-output.conf 内容……
.include analog-output.conf.common

; 追加：把 index=1 的主音量也并入音量链
[Element PCM,1]
volume = merge
override-map.1 = all
```

几个要点：

- `volume = merge` 表示把该控件并入音量控制链。ACP 按路径中的控件顺序分配音量，先设置左右声道控件，再将剩余调整量分配给主音量。在本次验证的 20%～100% 范围内，左右声道控件足以承担衰减，主音量保持在 0dB；这不是对所有设备和所有音量范围的保证。
- `override-map.1 = all` 把单声道主音量映射到左右两个通道。
- 因为 `.include` 是相对于当前文件路径解析的，还需要把 `analog-output.conf.common` 一并复制到用户目录。
- `analog-output.conf` 是通用路径配置名，覆盖会影响其他使用该路径的设备。没有第二个 PCM 控件时，新增元素通常被忽略；其他同样带有 `PCM,index=1` 的设备也可能套用这项规则，需要分别检查。复制整个文件还会遮住软件包对此文件的后续更新。

文件已存在时先保存备份，再复制和编辑；不要覆盖自己已有的定制。确认没有同名用户文件后，创建覆盖的命令如下：

```console
$ mkdir -p ~/.config/alsa-card-profile/mixer/paths
$ cp /usr/share/alsa-card-profile/mixer/paths/analog-output.conf \
     ~/.config/alsa-card-profile/mixer/paths/
$ cp /usr/share/alsa-card-profile/mixer/paths/analog-output.conf.common \
     ~/.config/alsa-card-profile/mixer/paths/
# 编辑 analog-output.conf，追加 [Element PCM,1] 段落
$ systemctl --user restart wireplumber
```

PipeWire 1.0.5 的 [ACP 路径查找实现](https://github.com/PipeWire/pipewire/blob/1.0.5/spa/plugins/alsa/acp/compat.c#L246)会优先检查用户配置目录；[配置解析器](https://github.com/PipeWire/pipewire/blob/1.0.5/spa/plugins/alsa/acp/conf-parser.c#L86)也支持相对 `.include`。这是现有配置机制，重新初始化设备时会读取；能否生效仍需按下面的方法确认。

## 验证

重启后重新读硬件控件：

| 系统音量 | 左右声道（numid=3） | 主音量（numid=4） |
|---|---|---|
| 20% | 44（-41dB） | 127（0dB） |
| 50% | 91（-18dB） | 127（0dB） |
| 100% | 127（0dB） | 127（0dB） |

再检查 100% 时该输出节点的 `softVolumes`（将 `35` 替换为当前节点 ID）：

```console
$ pw-dump 35 | grep -A1 softVolumes
"softVolumes": [ 1.000000, 1.000000 ]
```

该节点的 `softVolumes` 为 1.0，说明这一处没有额外软件增益；结合两个硬件控件都为 127/0dB，可以确认所检查的控件没有继续衰减。仅凭 `softVolumes` 不能证明应用音量、整个播放链和设备内部增益均达到最大输出。

## 修复后的注意事项

- 同样的百分比，两个控件的累计衰减减少约 20dB；本次试听中，**修复后 50% 接近修复前 100%** 的响度。主音量从 -20dB 变为 0dB 后，应从较低音量开始重新调整。
- 本次硬件方案在 100% 时，两个已检查控件都到达 0dB；继续增加软件增益可能产生失真，不应依靠 150% 补偿遗漏的硬件衰减。
- 想撤销：仅删除本次新建的 `analog-output.conf` 与 `analog-output.conf.common`；如果替换过已有文件，则恢复备份，然后重启 WirePlumber。保留该目录里的其他配置。

## 2026-10-11 复查：本机当前使用软件音量

复查时系统已使用 PipeWire 1.6.2 和 WirePlumber 0.5 的配置格式。`~/.config/alsa-card-profile/mixer/paths/` 目录为空；针对 Shanling UA1 Plus 的设备规则设置了 `api.alsa.soft-mixer = true`。旧 WirePlumber 0.4 Lua 规则也包含相同属性，本次迁移保留了它。

在设备连接时，已确认 UA1 Plus 被枚举为默认输出，设备属性中 `api.alsa.soft-mixer` 为 `true`。这说明当前采用的是软件音量方案，不能用当前状态验证上文 ACP 硬件联动方案。该属性本身也不会保证两个硬件控件都处于 0dB，若仍遇到响度问题，仍需核对硬件读数。

本文更新时 DAC 已断开，本次没有重新执行硬件控件联动或听感测试。上面的表格保留为原始排查记录；当前配置与当时记录分别说明，避免将两种方案混用。

## 经验总结

1. “音量到顶后继续加没反应、再往上就失真”，优先怀疑**硬件音量链里还有没被接管的控件**，而不是直接归咎于耳机。
2. ALSA 控件名相同不代表只有一个控件，`index` 字段区分同名控件；`amixer controls` + `cget` 是快速定位工具。
3. 确认使用 ACP 硬件音量控制后，可以通过用户级路径覆盖补充遗漏的控件，同时限定影响范围、保存原配置并验证实际联动。
4. 修音频问题时，先量化：把 UI 百分比换算成硬件控件读数，确认“到底谁到了上限”，再动手。
