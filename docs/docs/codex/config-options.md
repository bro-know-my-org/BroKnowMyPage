---
title: Codex TUI 可自定义配置项速查
description: Codex TUI 配置分层、模型、权限、界面和外部集成配置项速查。
date: 2026-08-06
updated: 2026-08-10
tags:
  - Codex
  - 配置
  - AI 工具
---

# Codex TUI 可自定义配置项速查

> 已按 `codex-cli 0.147.0` 复核，文末完整示例已通过 `--strict-config` 解析检查。完整字段以当前版本的配置架构为准，运行中的配置分层可用 `/debug-config` 查看。

## 配置文件放在哪

配置按下面的顺序从多层 `config.toml` 合并，后加载的层覆盖先加载的层：

1. 系统级：`/etc/codex/config.toml`（Windows 是 `%ProgramData%\OpenAI\Codex\config.toml`）
2. 用户级：`$CODEX_HOME/config.toml`（默认 `~/.codex/config.toml`）
3. 配置档案：`$CODEX_HOME/<name>.config.toml`（选中 `profile` 时）
4. 当前目录：`./config.toml`
5. 目录树：从当前目录向上找 `.codex/config.toml`
6. 仓库根：`$(git rev-parse --show-toplevel)/.codex/config.toml`
7. 运行时：命令行参数、TUI 里的选择器等

项目级 `.codex/config.toml` 在目录不受信任时会被忽略。想确认某条配置到底来自哪一层，用 `/debug-config`。

## 常用顶层配置

### 模型与推理

| 配置项 | 作用 |
| --- | --- |
| `model` | 默认模型 |
| `review_model` | `/review` 用的模型 |
| `model_provider` | 使用 `model_providers` 里的哪个 provider |
| `model_providers` | 自定义 provider 表 |
| `model_context_window` | 模型上下文窗口大小（token） |
| `model_auto_compact_token_limit` | 触发自动压缩的 token 阈值 |
| `model_auto_compact_token_limit_scope` | 压缩统计范围：`total` 或 `body_after_prefix` |
| `model_reasoning_effort` | 默认推理强度 |
| `plan_mode_reasoning_effort` | Plan 模式下的推理强度 |
| `model_reasoning_summary` | 推理摘要：`auto` / `concise` / `detailed` / `none` |
| `model_verbosity` | GPT-5 系列回复详细程度 |
| `personality` | 默认沟通风格 |
| `service_tier` | 服务档位（如 `default`、`priority`、`flex`） |
| `model_catalog_json` | 启动时加载的 JSON 模型目录 |
| `oss_provider` | 本地模型首选 provider，如 `lmstudio`、`ollama` |

### 权限与沙箱

| 配置项 | 可选值 / 说明 |
| --- | --- |
| `approval_policy` | `untrusted`、`on-request`（默认）、`granular`、`never` |
| `approvals_reviewer` | `user`（默认）或 `auto_review`（旧名 `guardian_subagent`） |
| `auto_review.policy` | 给自动审查 guardian 的额外策略说明 |
| `allow_login_shell` | 是否允许 shell 工具使用 login shell，默认 `true` |
| `sandbox_mode` | `read-only`（默认）、`workspace-write`、`danger-full-access` |
| `sandbox_workspace_write.writable_roots` | workspace-write 模式下可写的根目录列表 |
| `sandbox_workspace_write.network_access` | workspace-write 是否允许网络 |
| `sandbox_workspace_write.exclude_tmpdir_env_var` | 是否排除临时目录环境变量 |
| `sandbox_workspace_write.exclude_slash_tmp` | 是否排除 `/tmp` |
| `default_permissions` | 默认权限档案名，`:xxx` 是内置档案 |
| `[permissions.<name>]` | 自定义权限档案（filesystem、network、workspace_roots 等） |

### 指令与上下文

| 配置项 | 作用 |
| --- | --- |
| `instructions` | 附加系统指令 |
| `developer_instructions` | 以 developer 角色注入的额外指令 |
| `model_instructions_file` | 覆盖内置模型指令的文件（官方不推荐使用） |
| `compact_prompt` | 压缩历史用的提示词 |
| `include_permissions_instructions` | 是否注入权限说明块 |
| `include_apps_instructions` | 是否注入 Apps 说明块 |
| `include_collaboration_mode_instructions` | 是否注入协作模式说明块 |
| `include_environment_context` | 是否注入环境上下文块 |
| `project_doc_max_bytes` | AGENTS.md 最多读取的字节数，默认 32 KB |
| `project_doc_fallback_filenames` | 没有 AGENTS.md 时尝试的备用文件名 |
| `project_root_markers` | 项目根标记，默认 `[".git"]` |

### 历史、日志与状态

| 配置项 | 作用 / 默认 |
| --- | --- |
| `history.persistence` | `save-all`（默认）或 `none` |
| `history.max_bytes` | 历史文件大小上限，超出丢最旧 |
| `log_dir` | 日志目录，默认 `$CODEX_HOME/log`；显式设置会同时启用 TUI 文本日志 |
| `sqlite_home` | SQLite 状态库目录 |
| `tool_output_token_limit` | 工具输出保存进上下文的 token 上限 |
| `background_terminal_max_timeout` | 后台终端输出最长等待毫秒数，默认 `300000`（5 分钟） |
| `check_for_update_on_startup` | 启动时检查更新，默认 `true` |
| `disable_paste_burst` | 关闭快速粘贴的缓冲检测 |
| `analytics.enabled` | 是否收集分析数据，默认 `true` |
| `feedback.enabled` | 是否启用反馈流程，默认 `true` |

### 外部集成

| 配置项 | 作用 |
| --- | --- |
| `notify` | 每次 turn 完成后执行的外部命令，如 `["notify-send", "Codex"]` |
| `file_opener` | 输出里的文件引用使用哪种 URI 打开 |
| `mcp_servers` | MCP 服务器定义 |
| `mcp_oauth_credentials_store` | MCP OAuth 凭据存储：`keyring` / `file` / `auto` |
| `mcp_oauth_callback_port` | MCP OAuth 回调端口 |
| `mcp_oauth_callback_url` | MCP OAuth 重定向 URI |
| `web_search` | 网页搜索模式 |
| `tools` | 工具开关（如 `web_search`、`update_plan`） |
| `agents` | 多代理线程数量、子代理默认模型/推理强度等 |
| `memories` | 记忆子系统设置 |
| `skills` | 技能配置 |
| `hooks` | 生命周期钩子 |
| `plugins`、`marketplaces` | 插件与市场配置 |
| `features` | 集中式功能开关 |
| `profiles` | 命名配置档案 |
| `profile` | 当前使用的档案名 |
| `projects` | 按项目路径设置的信任级别等 |

## `[tui]` 专属配置

| 配置项 | 默认 | 说明 |
| --- | --- | --- |
| `animations` | `true` | 启动动画、shimmer、spinner |
| `show_tooltips` | `true` | 启动欢迎页提示 |
| `vim_mode_default` | `false` | 启动时直接进入 Vim 模式 |
| `raw_output_mode` | `false` | 启动时启用原始滚动模式 |
| `alternate_screen` | `"auto"` | `auto` / `always` / `never`；`never` 不切备用屏幕，保留终端滚动 |
| `status_line` | `["model-with-reasoning", "current-dir"]` | 状态栏项目及顺序 |
| `status_line_use_colors` | `true` | 状态栏是否用主题配色 |
| `terminal_title` | `["activity", "project-name"]` | 终端标题项目及顺序 |
| `theme` | 自动检测 | 语法高亮主题名，可用 `/theme` 选择；自定义主题放 `$CODEX_HOME/themes` |
| `pet` | 无 | 终端宠物 id，自定义宠物放 `$CODEX_HOME/pets/<id>/pet.json` |
| `pet_anchor` | `"composer"` | `composer`（跟随输入框）或 `screen-bottom`（屏幕底部） |
| `session_picker_view` | `"dense"` | resume/fork 选择器布局：`dense` / `comfortable` |
| `resume_cwd` | 未设置 | `current`（用启动目录）或 `session`（用会话记录目录） |
| `terminal_resize_reflow_max_rows` | 终端相关默认 | 终端缩放重放的最大行数，`0` 表示全部保留 |

### TUI 通知

通知设置在 `[tui]` 下面直接写：

```toml
[tui]
notifications = true                      # 或 false，或事件名列表
notification_method = "auto"              # auto / osc9 / bel
notification_condition = "unfocused"      # unfocused / always
```

`notifications` 可以是布尔值，也可以是事件名数组：

- `"agent-turn-complete"`：任务完成
- `"approval-requested"`：需要审批
- `"plan-mode-prompt"`：Plan 模式等待输入

## `[tui.keymap]` 自定义快捷键

按键写在对应上下文里，可以给一个键位或一组键位；空列表表示明确取消绑定。键位写法如 `"ctrl-a"`、`"alt-enter"`、`"shift-tab"`、`"escape"`、`"page-up"`。支持 F1–F24。

上下文有：`global`、`chat`、`composer`、`editor`、`vim_normal`、`vim_operator`、`vim_text_object`、`pager`、`list`、`approval`。生效优先级：具体上下文 > `global` > 内置默认。

示例：

```toml
[tui.keymap.global]
copy = "ctrl-o"
clear_terminal = "ctrl-l"
toggle_raw_output = "alt-r"

[tui.keymap.chat]
interrupt_turn = "escape"
increase_reasoning_effort = ["alt-.", "shift-up"]

[tui.keymap.composer]
submit = "enter"
history_search_previous = "ctrl-r"

[tui.keymap.pager]
close = ["q", "ctrl-c"]
```

注意：大写字母动作在配置里写成 `shift-a` 这类形式（例如 Vim 的 `A` 就是 `shift-a`）。

## 状态栏可用项目（`status_line`）

| 标识 | 含义 |
| --- | --- |
| `model` | 当前模型名 |
| `model-with-reasoning` | 模型名 + 推理强度 |
| `reasoning` | 当前推理强度 |
| `current-dir` | 当前工作目录 |
| `project-name` | 项目名（检测不到时不显示） |
| `git-branch` | Git 分支 |
| `pull-request-number` | 当前分支的 PR 号 |
| `branch-changes` | 相对默认分支的改动统计 |
| `run-state` | Ready / Working / Thinking 等状态 |
| `permissions` | 当前权限档案或沙箱模式 |
| `approval-mode` | 审批模式 |
| `context-remaining` | 剩余上下文百分比 |
| `context-used` | 已用上下文百分比 |
| `five-hour-limit` | 主用量限额剩余 |
| `weekly-limit` | 周用量限额剩余 |
| `codex-version` | 版本号 |
| `context-window-size` | 上下文窗口大小 |
| `used-tokens` | 本会话已用 token |
| `total-input-tokens` | 累计输入 token |
| `total-output-tokens` | 累计输出 token |
| `thread-id` | 当前线程 ID |
| `fast-mode` | Fast mode 是否开启 |
| `raw-output` | 原始滚动模式是否开启 |
| `thread-title` | 当前线程标题 |
| `workspace-headline` | 工作区通知标题 |
| `task-progress` | 最新任务清单进度 |

## 终端标题可用项目（`terminal_title`）

| 标识 | 含义 |
| --- | --- |
| `app-name` | Codex 应用名 |
| `project-name` | 项目名（回退到当前目录名） |
| `current-dir` | 当前工作目录 |
| `activity` | 工作时转圈、被阻塞时显示提示 |
| `run-state` | 会话状态文本 |
| `thread-title` | 当前线程标题 |
| `git-branch` | Git 分支 |
| `context-remaining` / `context-used` | 上下文剩余 / 已用百分比 |
| `five-hour-limit` / `weekly-limit` | 用量限额剩余 |
| `codex-version` | 版本号 |
| `used-tokens` | 本会话已用 token |
| `total-input-tokens` / `total-output-tokens` | 累计输入 / 输出 token |
| `thread-id` | 当前线程 ID |
| `fast-mode` | Fast mode 状态 |
| `model` / `model-with-reasoning` / `reasoning` | 模型相关信息 |
| `task-progress` | 最新任务清单进度 |

## 一个完整示例

```toml
model = "gpt-5.6-sol"
model_reasoning_effort = "high"
approval_policy = "on-request"
sandbox_mode = "workspace-write"

[history]
persistence = "save-all"
max_bytes = 50_000_000

[tui]
vim_mode_default = true
raw_output_mode = true
alternate_screen = "never"
theme = "dracula"
status_line = ["model-with-reasoning", "git-branch", "context-remaining", "current-dir"]
terminal_title = ["activity", "project-name", "git-branch"]
notifications = ["agent-turn-complete", "approval-requested"]

[tui.keymap.global]
copy = "ctrl-o"
clear_terminal = "ctrl-l"
toggle_raw_output = "alt-r"

[tui.keymap.chat]
interrupt_turn = "escape"
```

改完配置后用 `/debug-config` 查看生效结果；改快捷键还可以直接在 TUI 里 `/keymap` 操作，保存效果等价。
