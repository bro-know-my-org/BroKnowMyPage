---
author: 假发
title: 把 Codex 的只读调查交给 Antigravity：agy-delegate-rs
description: Gemini Flash High 又快又便宜，短任务表现接近 Luna Max。用 agy-delegate-rs 把 Codex 的只读调查交给 Antigravity CLI。
date: 2026-10-12
updated: 2026-10-12
tags:
  - Codex
  - AI
  - MCP
---

# 把 Codex 的只读调查交给 Antigravity：agy-delegate-rs

之前用 [quick_explorer](/blog/tools/codex-quick-explorer) 接手搜索和盘点。这次做工具的原因很直接：**Gemini 3.8 Flash (High) 又快又便宜**。在我常用的短任务、简单任务里，表现和 GPT-6 Luna (Max) 不相上下，拿来搜文件、查配置正合适。

选 Antigravity CLI（`agy`），是因为它用的是 Gemini 官方 harness，算是**哈基米模型的专武**。既然有这套配套工具，那就接起来用。

于是有了 [agy-delegate-rs](https://github.com/JIAFALSEDREAM/agy-delegate-rs)：通过 MCP 把只读调查交给本机的 `agy`，用 Rust 管理后台任务，再把结论和文件位置交回 Codex。默认模型是 `gemini-3.8-flash-high`。

## 和原生 subagent 有什么不同

- **换一套模型服务**：多轮搜索由 agy 中的 Gemini 完成，Codex 负责提交任务、读报告和继续实现。
- **后台执行**：提交后立即返回任务 ID，Codex 可以继续其他工作；等待超时不会取消调查。
- **继续追问**：复用原会话核查细节，追问会产生新的任务 ID。
- **沙箱只读**：通过 `codex sandbox` 限制项目写入；沙箱不可用时任务失败。

适合查配置、找入口、梳理调用链和比较实现。沙箱允许联网，不提供网络或凭据隔离。

## 安装

先准备能正常调用模型的 `agy`、支持命名权限配置且沙箱可用的 Codex CLI，以及 Node.js 22.14+。本项目验证过的 Codex 版本为 `0.160.0`。

```bash
npm install -g agy-delegate-rs
agy-delegate-rs install
```

`install` 会检查依赖和沙箱、注册 MCP，并写入让 Codex 优先委派只读调查的 AGENTS 规则。成功后新开 Codex 会话。只想注册 MCP，用 `agy-delegate-rs register`。

安装检查不调用模型，可以再跑一次真实调查验证认证：

```bash
agy-delegate-rs run --cwd /absolute/path/to/repo --task '查找配置加载入口，附文件行号'
```

依赖安装和升级说明见[安装指南](https://github.com/JIAFALSEDREAM/agy-delegate-rs/blob/main/INSTALL.md)。

## 怎么用

执行 `install` 并新开会话后，Codex 会按写入的规则优先委派只读调查，不用每次点名工具。正常提任务就行：

```text
帮我查一下这个仓库的配置加载顺序，附关键文件位置。
```

工具流程是 `agy_submit` 提交 → `agy_wait` / `agy_status` 取结果 → `agy_followup` 追问。`agy_list` 找回近期任务，`agy_cancel` 请求停止本地进程树。

主代理取回结果后先检查状态，失败或未完成的调查不能当成结论。缺细节就沿原任务追问，工具不可用时可以回退到 `quick_explorer`。

省的是主模型亲自检索的轮次，具体费用和耗时取决于两边的模型、额度和任务大小。当前为预览版：Linux 已验证真实模型调用，macOS、Windows 的真实调用仍待实机验收。
