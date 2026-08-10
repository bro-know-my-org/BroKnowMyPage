---
title: PipeWire 下 USB DAC 音量到顶问题的排查与修复
description: 从 ALSA 双音量控件定位 PipeWire 遗漏主音量的问题，并用 ACP 用户配置修复。
date: 2026-08-05
updated: 2026-08-10
tags:
  - Linux
  - PipeWire
  - 音频
  - 故障排查
---

# 一次 USB DAC“音量到顶”问题的排查：被 PipeWire 遗忘的主音量

> 环境：Kubuntu 24.04 · PipeWire 1.0.5 · WirePlumber 0.4.17
> 设备：Shanling UA1 Plus（USB DAC）

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

默认 sink 是 Shanling UA1 Plus 的 analog-stereo 节点。接着看这块声卡的 ALSA 控件：

```console
$ amixer -c 2 controls
numid=3,iface=MIXER,name='PCM Playback Volume'
numid=4,iface=MIXER,name='PCM Playback Volume',index=1
```

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

到这里基本可以判断：**音量条控制的只有左右声道音量，主音量被晾在一边，固定 -20dB**。所以整个链路的硬件上限是 0dB + (-20dB) = -20dB，再往上就只能靠软件数字放大，听起来就是“炸”。

### 3. 手动验证主音量确实是瓶颈

把系统音量降到 50%，然后手动把主音量拉到 0dB：

```console
$ wpctl set-volume @DEFAULT_AUDIO_SINK@ 50%
$ amixer -c 2 cset numid=4 127
```

听感立刻接近原来 100% 的响度。这就证实了：不是耳机不行，而是主音量一直没被系统接管。

## 根因

Shanling UA1 Plus 是 USB Audio Class 设备，固件里同时暴露了两个音量控件：

- 一个左右声道音量（`PCM Playback Volume`，index=0）；
- 一个主音量（`PCM Playback Volume`，index=1）。

这是 USB 音频里常见的“双旋钮”结构。PipeWire 使用 ACP（ALSA Card Profiles）来管理硬件音量，而 ACP 的路径配置里只写了 `[Element PCM]`，按名字匹配到的是 **index=0** 那个控件；index=1 的主音量不在配置中，于是从未被读取或设置，一直保持固件出厂值 -20dB。

> 顺带一提：系统里其他声卡（Realtek ALC287、NVidia HDMI）没有这个问题，因为它们的控件要么名字不同、能被 ACP 正确识别，要么根本没有硬件音量控件。

## 解决方案：ACP 用户级配置覆盖

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

- `volume = merge` 表示把该控件并入音量滑块的控制链，而不是写死。PipeWire 在写音量时会先设置左右声道控件，剩下的“配额”给主音量；由于左右声道已经覆盖全部衰减范围，主音量自然停在 0dB，同时音量读回和外部改动也能正确同步。
- `override-map.1 = all` 把单声道主音量映射到左右两个通道。
- 因为 `.include` 是相对于当前文件路径解析的，还需要把 `analog-output.conf.common` 一并复制到用户目录。
- 这个覆盖只对**真正存在第二个 PCM 控件的设备**生效；其他声卡没有这个控件时会被自动忽略，不受影响。

完整命令：

```console
$ mkdir -p ~/.config/alsa-card-profile/mixer/paths
$ cp /usr/share/alsa-card-profile/mixer/paths/analog-output.conf \
     ~/.config/alsa-card-profile/mixer/paths/
$ cp /usr/share/alsa-card-profile/mixer/paths/analog-output.conf.common \
     ~/.config/alsa-card-profile/mixer/paths/
# 编辑 analog-output.conf，追加 [Element PCM,1] 段落
$ systemctl --user restart wireplumber
```

这属于 PipeWire 官方支持的配置机制，不是脚本轮询、不是 udev 黑魔法，重启和重新插拔设备都会自动加载。

## 验证

重启后重新读硬件控件：

| 系统音量 | 左右声道（numid=3） | 主音量（numid=4） |
|---|---|---|
| 20% | 44（-41dB） | 127（0dB） |
| 50% | 91（-18dB） | 127（0dB） |
| 100% | 127（0dB） | 127（0dB） |

再确认 100% 时没有软件增益：

```console
$ pw-dump 35 | grep -A1 softVolumes
"softVolumes": [ 1.000000, 1.000000 ]
```

软件增益为 1.0，说明 100% 就是纯硬件满输出，不再需要数字放大。

## 修复后的注意事项

- 同样的百分比，修复后比修复前大约响了 20dB：以前 50% 听起来接近以前 100% 的响度。这是主音量从 -20dB 恢复到 0dB 的正常结果，不是配置过头。
- 音量条 100% 现在是真正的硬件最大输出，日常不要开 150% 之类的数字增益。
- 想撤销：删除 `~/.config/alsa-card-profile` 再重启 WirePlumber 即可恢复原样。

## 经验总结

1. “音量到顶后继续加没反应、再往上就失真”，优先怀疑**硬件音量链里还有没被接管的控件**，而不是直接归咎于耳机。
2. ALSA 控件名相同不代表只有一个控件，`index` 字段区分同名控件；`amixer controls` + `cget` 是快速定位工具。
3. PipeWire 的 ACP 路径配置按控件名匹配，遇到 USB 声卡的双音量控件时，用户级 `~/.config/alsa-card-profile` 覆盖是干净、可逆的正规解法。
4. 修音频问题时，先量化：把 UI 百分比换算成硬件控件读数，确认“到底谁到了上限”，再动手。
