---
title: kitty 里 Codex 回车与退格重复触发的修复
description: 排查 kitty keyboard protocol 导致 Codex TUI 按键被处理两次的问题，并给出三种修复方式。
date: 2026-08-07
updated: 2026-08-07
tags:
  - kitty
  - Codex
  - Linux
  - 故障排查
---

# kitty 里跑 Codex，回车/退格像被按了两次？

> 环境：Kubuntu 24.04（Ubuntu noble）· kitty 0.32.2 · codex-cli 0.147.0

## 症状

在 kitty 里跑 Codex CLI，输入和发送消息都有点“手滑”：

- 按一次 **Enter**，像是触发了两次回车（消息直接发出去了、或者多了一个空行）；
- 按一次 **Backspace**，一次删掉两个字符；
- 同样的 Codex 换到 Alacritty、GNOME Terminal 等终端里就完全正常。

第一反应是键盘连击，但换终端就没事，说明问题出在“kitty + Codex”这个组合上。

## 排查

### 1. 先排除键盘本身

按住一个键看终端里是否正常重复、用 `xev`/`wev` 看事件，发现单击就是单击，键盘没问题。

### 2. 看 kitty 到底把按键发成了什么

kitty 自带一个查看按键协议事件的工具：

```console
$ kitten show-key -m kitty
```

按一次 Backspace，输出是这样的：

```text
BACKSPACE PRESS
CSI 127 u
BACKSPACE RELEASE
CSI 127 ; 1 : 3 u
```

问题就出在这里：**一次按键被拆成了 press 和 release 两个事件**。Codex 的 TUI 把 release 也当成了有效按键，于是按一次退格 = 删两次。

### 3. 为什么其他终端没事

Codex 从 2025-07-31 的 [PR #1743](https://github.com/openai/codex/pull/1743) 开始，默认启用“键盘增强”（也就是 kitty keyboard protocol / CSI u），目的是让 Shift+Enter 这类修饰键组合能被区分出来。

这套协议里有一个 `REPORT_EVENT_TYPES` 标志，要求终端上报事件类型：

- press（按下）
- repeat（重复）
- release（松开）

Alacritty 等终端不实现或不完整实现这套协议，Codex 就会退回传统输入方式，自然没有 release 事件。而 kitty 0.32.2 完整上报 press/release，Codex 又把 release 当成新按键，就“双击”了。

## 解决

### 方案 A：环境变量关掉 Codex 的键盘增强（推荐，最简单）

Codex 内置了一个隐藏开关：

```bash
CODEX_TUI_DISABLE_KEYBOARD_ENHANCEMENT=1 codex
```

先临时跑一次验证，正常后写进 shell 配置永久生效：

```bash
echo 'export CODEX_TUI_DISABLE_KEYBOARD_ENHANCEMENT=1' >> ~/.bashrc
source ~/.bashrc
```

代价：Shift+Enter 和普通 Enter 可能无法区分。不过 Codex 默认键位里换行本来就有 **Ctrl+J**，所以日常编辑不受影响。

### 方案 B：升级 kitty

Ubuntu 24.04 的 apt 源里 kitty 固定在 0.32.2，没有新版。想升级只能走官方安装脚本或第三方源，有人验证 0.46.2 之后问题消失。

```bash
curl -L https://sw.kovidgoyal.net/kitty/installer.sh | sh /dev/stdin
```

官方安装脚本装到 `~/.local/kitty.app`，重跑一次脚本就是更新，不碰系统目录。但如果你不想多维护一套 kitty，方案 A 就够了。

### 方案 C：用 tmux 包一层

tmux 会把 kitty 的扩展键盘协议转换成传统 PTY 行为，也能绕开：

```bash
sudo apt install tmux
tmux
codex
```

适合本来就在用 tmux 的人，没必要为了这个问题特意引入。

## 为什么“之前没事，更新 Codex 后反而出问题”

不是 Codex 把修好的 bug 改回去了，而是新功能把老终端的兼容问题暴露了出来：

- 2025-08 之前的 Codex 根本不开启键盘增强，所以 kitty 老版本的问题一直“潜伏”；
- 之后 Codex 默认请求事件类型上报，但兼容适配是按终端逐个补的：
  - iTerm2：不请求 release；
  - tmux 的 xterm 扩展键格式：不请求 release；
  - Ghostty：2026-08 刚补上，见 [PR #36834](https://github.com/openai/codex/pull/36834)；
  - kitty：仍然请求完整事件类型，老版本就踩坑。

相关 issue：

- [openai/codex #16716](https://github.com/openai/codex/issues/16716)
- [openai/codex #18564](https://github.com/openai/codex/issues/18564)

## 小结

| 方案 | 成本 | 副作用 |
| --- | --- | --- |
| `CODEX_TUI_DISABLE_KEYBOARD_ENHANCEMENT=1` | 一行环境变量 | Shift+Enter 区分退化，可用 Ctrl+J 换行 |
| 升级 kitty 到 0.46.2+ | 需要维护非 apt 安装 | 基本无 |
| tmux 包一层 | 需要装 tmux | 多一层会话管理 |

如果只是想在 kitty 里舒服地用 Codex，方案 A 是目前最省事的；等 kitty 版本跟上来之后，把环境变量删掉就行。
