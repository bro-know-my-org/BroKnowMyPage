---
title: Codex TUI 斜杠命令速查
description: Codex TUI 会话、配置、调试和 Agent 相关斜杠命令速查。
date: 2026-08-06
updated: 2026-08-10
tags:
  - Codex
  - 命令
  - AI 工具
---

# Codex TUI 斜杠命令速查

> 已按 `codex-cli 0.147.0` 的 TUI 命令菜单和实际命令复核。在输入框直接打 `/` 会弹出命令列表；插件、技能等还可以带来额外命令。

## 会话管理

| 命令 | 作用 | 参数 / 备注 |
| --- | --- | --- |
| `/new [名字]` | 开始一个新会话，保留当前屏幕内容 | 带参数可直接给新会话命名 |
| `/clear [名字]` | 清空终端并开始一个新会话 | 相当于“清屏 + `/new`” |
| `/resume [ID或名字]` | 恢复历史会话 | 不带参数会打开会话选择器 |
| `/fork` | 分叉（fork）当前会话 | |
| `/archive` | 归档当前会话并退出 Codex | |
| `/delete` | 永久删除当前会话并退出 | 不可恢复 |
| `/rename [新名字]` | 重命名当前线程 | |
| `/app` | 在当前桌面 App 里继续这个会话 | 仅 macOS / Windows 可用 |
| `/agent`、`/subagents` | 切换当前活动的 agent 线程 | 两者作用相同 |
| `/side [内容]`、`/btw [内容]` | 开一个临时 fork 的侧边对话 | 带参数会直接把内容发给侧边对话 |
| `/goal [目标\|clear\|edit\|pause\|resume]` | 查看、设置或控制长期任务目标 | 例：`/goal 提升测试覆盖率`、`/goal pause` |
| `/plan [任务]` | 切换到 Plan 模式并开始规划 | |
| `/compact` | 总结当前对话，压缩上下文 | |
| `/quit`、`/exit` | 退出 Codex | 两者作用相同 |
| `/logout` | 登出 Codex | |

## 编码与上下文

| 命令 | 作用 | 参数 / 备注 |
| --- | --- | --- |
| `/review [指示]` | 审查当前改动并找问题 | 带参数按自定义指示审查 |
| `/diff` | 显示 git diff（包含未跟踪文件） | 非 git 仓库会提示 |
| `/mention` | 在输入框插入 `@` 引用文件 | |
| `/copy` | 把上一条回复复制为 Markdown | |
| `/raw [on\|off]` | 切换原始滚动模式，方便终端选中复制 | |
| `/init` | 生成 `AGENTS.md` 项目指令文件 | |
| `/ide [on\|off\|status]` | 开启 / 关闭 / 查看 IDE 上下文 | 会带入当前选中内容和打开的标签页 |
| `/import` | 从 Claude Code 导入配置、项目和最近会话 | |
| `/status` | 查看当前会话配置和 token 用量 | |
| `/usage [daily\|weekly\|cumulative]` | 查看账户用量，或使用用量重置 | |
| `/debug-config` | 查看配置分层和来源，排查配置问题 | |
| `/rollout` | 打印当前 rollout 文件路径 | 仅调试构建显示 |
| `/test-approval` | 测试审批请求弹窗 | 仅调试构建显示 |

## 设置与自定义

| 命令 | 作用 | 参数 / 备注 |
| --- | --- | --- |
| `/model` | 选择模型和推理强度 | |
| `/fast` | 切换 Fast mode | 速度更快，用量会增加 |
| `/personality` | 选择 Codex 的沟通风格 | |
| `/permissions` | 选择允许 Codex 做什么 | 审批策略 / 权限配置 |
| `/keymap [debug]` | 查看、重映射 TUI 快捷键 | `/keymap debug` 打开按键检查器 |
| `/vim` | 切换输入框 Vim 模式 | |
| `/title` | 配置终端标题显示哪些内容 | |
| `/statusline` | 配置状态栏显示哪些内容 | |
| `/theme` | 选择语法高亮主题 | |
| `/pets [ID\|disable]`、`/pet` | 选择或隐藏终端宠物 | `/pet` 是同义命令 |
| `/experimental` | 开关实验性功能 | |
| `/memories` | 配置记忆的启用和生成 | |
| `/skills` | 打开技能菜单 | |
| `/hooks` | 查看和管理生命周期钩子 | |
| `/mcp [verbose]` | 列出已配置的 MCP 工具 | `/mcp verbose` 显示详细状态 |
| `/apps` | 管理已连接的应用 | |
| `/plugins` | 浏览插件 | |
| `/feedback` | 向维护者发送日志 / 反馈 | |
| `/approve` | 批准一次最近的自动审查拒绝重试 | |
| `/ps` | 列出后台终端 | |
| `/stop`、`/clean` | 停止所有后台终端 | `/clean` 是旧名/别名 |
| `/setup-default-sandbox` | 设置提升权限的沙箱 | 主要用于 Windows 降级沙箱 |
| `/sandbox-add-read-dir <绝对路径>` | 让沙箱可读取某个目录 | 仅 Windows 显示 |

## 调试与内部命令

| 命令 | 说明 |
| --- | --- |
| `/debug-m-drop`、`/debug-m-update` | 记忆维护的调试命令，源码标注为 DO NOT USE，普通使用不要碰 |

## 小贴士

- `/new` 和 `/clear` 都会开始全新会话，旧会话不会作为上下文继续传入；区别只在于 `/clear` 会先清屏。旧会话都可以用 `/resume` 找回。
- 默认 `Ctrl+L` 等同于 `/clear`，可以在 `/keymap` 里重映射。
- 任务进行中部分命令（如 `/new`、`/clear`、`/compact`、`/review`）会被禁用。
