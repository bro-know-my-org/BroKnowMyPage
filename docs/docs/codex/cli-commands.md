---
author: 假发
title: Codex CLI 命令与参数速查
description: Codex CLI 全局参数、子命令和常用调用方式的中文速查。
date: 2026-08-06
updated: 2026-08-28
tags:
  - Codex
  - CLI
  - AI 工具
---

# Codex CLI 命令与参数速查

> 已按 `codex-cli 0.149.1` 的 CLI 定义复核。每个子命令的完整参数都可以用 `codex <子命令> --help` 查看；其他版本可能不同。

## 基本用法

```console
codex [OPTIONS] [PROMPT]
codex [OPTIONS] <COMMAND> [ARGS]
```

不带子命令时进入交互式 TUI；给一个 `PROMPT` 就是直接开始一段对话。`-` 作为 prompt 时从 stdin 读取。

## 全局参数

| 参数 | 作用 |
| --- | --- |
| `PROMPT` | 启动会话时的提示词 |
| `-m, --model <MODEL>` | 指定模型 |
| `-i, --image <FILE>...` | 附加一张或多张图片 |
| `--oss` | 使用开源本地模型 |
| `--local-provider <PROVIDER>` | 本地 provider，如 `lmstudio`、`ollama` |
| `-p, --profile <NAME>` | 加载 `$CODEX_HOME/<NAME>.config.toml` |
| `-s, --sandbox <MODE>` | `read-only` / `workspace-write` / `danger-full-access` |
| `--approve-for-me` | 在 `workspace-write` 沙箱中由自动审查处理审批请求 |
| `-a, --ask-for-approval <MODE>` | 审批模式：`on-request` / `never`（交互式 TUI） |
| `-C, --cd <DIR>` | 指定工作目录 |
| `--add-dir <DIR>` | 额外可写目录，可重复 |
| `-c, --config <key=value>` | 覆盖任意配置项，可重复；值按 TOML 解析 |
| `--enable <FEATURE>` | 开启功能开关（等价于 `-c features.<name>=true`） |
| `--disable <FEATURE>` | 关闭功能开关 |
| `--search` | 启用实时网页搜索 |
| `--no-alt-screen` | 不切备用屏幕，保留终端滚动（inline 模式） |
| `--strict-config` | 配置里有未知字段时报错 |
| `--dangerously-bypass-approvals-and-sandbox`（别名 `--yolo`） | 跳过所有审批和沙箱，极危险 |
| `--dangerously-bypass-hook-trust` | 不校验 hooks 信任直接运行 |
| `--remote <ADDR>` | 连接远程 app server，如 `ws://host:port`、`unix://PATH` |
| `--remote-auth-token-env <ENV_VAR>` | 指定存放远程认证 token 的环境变量名 |
| `-h, --help` | 帮助 |
| `-V, --version` | 版本 |

`-c` 示例：

```console
codex -c 'model="gpt-5.6-sol"'
codex -c 'sandbox_workspace_write.network_access=true'
codex -c 'shell_environment_policy.inherit=all'
```

## 子命令总览

| 子命令 | 作用 |
| --- | --- |
| `agents` | 打开共享 app-server 上所有 Agent 会话的总览 |
| `exec` | 非交互式运行 Codex |
| `review` | 非交互式代码审查 |
| `login` | 登录 / 查看登录状态 |
| `logout` | 清除登录凭据 |
| `mcp` | 管理 MCP 服务器 |
| `plugin` | 管理插件和市场 |
| `mcp-server` | 把 Codex 作为 MCP 服务器启动（stdio） |
| `app-server` | 实验性：启动 app server 及相关工具 |
| `remote-control` | 实验性：app-server 远程控制 |
| `app` | 打开桌面 App（macOS / Windows） |
| `completion <shell>` | 生成 shell 补全脚本 |
| `update` | 更新 Codex |
| `doctor` | 检查本地安装、配置、认证和运行环境 |
| `sandbox` | 在 Codex 沙箱里执行命令 |
| `apply <TASK_ID>` | 应用 Codex 任务最新生成的 diff |
| `resume` | 恢复历史会话 |
| `queue` | 给已有会话排队发送消息 |
| `archive` | 归档会话 |
| `delete` | 删除会话 |
| `migrate-rollouts` | 检查或迁移旧版本地会话历史 |
| `unarchive` | 取消归档 |
| `fork` | 分叉历史会话 |
| `cloud` | 实验性：Codex Cloud 任务 |
| `exec-server` | 实验性：独立 exec-server |
| `features` | 查看 / 开启 / 关闭功能开关 |
| `debug` | 调试工具 |

还有几个隐藏的内部命令：`execpolicy`、`responses-api-proxy`、`stdio-to-uds`，日常不需要碰。`mcp-server` 已提示弃用，新集成应使用 `app-server`。

## `codex exec`：非交互模式

```console
codex exec [OPTIONS] [PROMPT]
codex exec [OPTIONS] <COMMAND> [ARGS]
```

| 参数 | 作用 |
| --- | --- |
| `PROMPT` | 任务指令；`-` 表示从 stdin 读 |
| `--json` | 以 JSONL 输出事件 |
| `--output-schema <FILE>` | 指定模型最终回复的 JSON Schema |
| `-o, --output-last-message <FILE>` | 把最后一条回复写入文件 |
| `--color <MODE>` | `always` / `never` / `auto` |
| `--skip-git-repo-check` | 允许在非 git 仓库运行 |
| `--ephemeral` | 不把会话写入磁盘 |
| `--ignore-user-config` | 不加载 `$CODEX_HOME/config.toml` |
| `--ignore-rules` | 不加载用户和项目的 execpolicy `.rules` |
| `--strict-config` | 未知配置字段时报错 |

`exec` 下还有两个子命令：

```console
codex exec resume [SESSION_ID] [--last] [--all] [PROMPT]
codex exec review [--uncommitted | --base BRANCH | --commit SHA] [PROMPT]
```

`review` 参数：

| 参数 | 作用 |
| --- | --- |
| `--uncommitted` | 审查暂存、未暂存和未跟踪改动 |
| `--base <BRANCH>` | 对比某个基础分支 |
| `--commit <SHA>` | 审查某个提交引入的改动 |
| `--title <TITLE>` | 给审查摘要一个提交标题（配 `--commit`） |
| `PROMPT` | 自定义审查指令，`-` 从 stdin 读 |

顶层 `codex review` 用法相同，多了 `--strict-config`。

示例：

```console
codex exec "给这个项目写 README"
printf '修复下面的编译错误' | codex exec -
codex exec --json -o result.txt "跑一遍测试并修复失败"
codex exec review --uncommitted "重点看并发问题"
codex exec review --base main
```

## `codex login` / `codex logout`

```console
codex login                      # 交互式登录
codex login --with-api-key       # 从 stdin 读 API Key
codex login --with-access-token  # 从 stdin 读 Access Token
codex login --device-auth        # 设备码登录
codex login status               # 查看登录状态
codex logout                     # 清除凭据
```

## `codex mcp`

```console
codex mcp list [--json]
codex mcp get <NAME> [--json]
codex mcp add <NAME> [--env KEY=VALUE] -- <COMMAND> [ARGS]
codex mcp add <NAME> --url <URL> [--bearer-token-env-var ENV] [--oauth-client-id ID] [--oauth-resource RES]
codex mcp remove <NAME>
codex mcp login <NAME> [--scopes SCOPE,SCOPE]
codex mcp logout <NAME>
```

## `codex plugin`

```console
codex plugin add <PLUGIN[@MARKETPLACE]> [-m MARKETPLACE] [--json]
codex plugin list [-m MARKETPLACE] [--json] [--available]
codex plugin remove <PLUGIN[@MARKETPLACE]> [-m MARKETPLACE] [--json]
codex plugin marketplace add <SOURCE> [--ref REF] [--sparse PATH] [--json]
codex plugin marketplace list [--json]
codex plugin marketplace upgrade [MARKETPLACE_NAME] [--json]
codex plugin marketplace remove <MARKETPLACE_NAME> [--json]
```

## 会话管理命令

```console
codex agents [-C DIR] [--no-alt-screen]       # 打开跨会话 Agent 总览
codex resume [SESSION_ID] [--last] [--all]
codex resume --last PROMPT            # 恢复最近会话并直接发消息
codex queue --thread <SESSION> --message <TEXT>  # 给已有会话排队发送消息
codex fork [SESSION_ID] [--last] [--all]
codex archive <SESSION>
codex unarchive <SESSION>
codex delete <SESSION> [--force]      # --force 必须传 UUID
codex migrate-rollouts                # 只检查可迁移的旧会话
codex migrate-rollouts --apply        # 实际执行迁移
```

## 其他子命令

### `codex app-server`

```console
codex app-server [--listen URL] [--stdio] [--strict-config]
codex app-server daemon start|restart|stop|version|bootstrap [--remote-control]
codex app-server proxy [--sock PATH]
codex app-server generate-ts -o DIR [--experimental]
codex app-server generate-json-schema -o DIR [--experimental]
```

### `codex remote-control`

```console
codex remote-control [--json]
codex remote-control start|stop|pair [--json]
```

### `codex exec-server`

```console
codex exec-server [--listen URL]
codex exec-server --remote URL --environment-id ID [--name NAME] [--use-agent-identity-auth]
codex exec-server --remote URL --environment-id ID forward --connect WS_URL
```

### `codex cloud`

```console
codex cloud exec --env ENV_ID [--attempts N] [--branch BRANCH] [QUERY]
codex cloud status <TASK_ID>
codex cloud list [--env ENV_ID] [--limit N] [--cursor CURSOR] [--json]
codex cloud apply <TASK_ID> [--attempt N]
codex cloud diff <TASK_ID> [--attempt N]
```

### `codex features`

```console
codex features list
codex features enable <FEATURE>
codex features disable <FEATURE>
```

### `codex doctor`

```console
codex doctor              # 完整检查
codex doctor --summary    # 只显示汇总
codex doctor --json       # 机器可读报告
codex doctor --all --no-color --ascii
```

### `codex debug`

```console
codex debug models [--bundled]
codex debug prompt-input [PROMPT] [-i FILE]
codex debug app-server send-message-v2 <MESSAGE>
```

### `codex completion`

```console
codex completion bash
codex completion zsh
codex completion fish
codex completion powershell
```

## 小贴士

- 交互式 TUI 里能做的事，大部分都能用 `codex exec` 在脚本里做；需要机器可读输出加 `--json`。
- 想临时换个模型、改个配置，不用动 `config.toml`，直接 `-m` / `-c` 覆盖。
- `--full-auto` 已经移除，别用它；自动放行场景改用 `--sandbox workspace-write`。
- 不确定某个参数当前版本是否支持，`codex <子命令> --help` 永远是最准的。
