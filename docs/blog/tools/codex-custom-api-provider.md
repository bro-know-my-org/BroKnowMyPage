---
title: 使用自定义 API Provider 运行 Codex
description: 给 Codex CLI 配置自建 OpenAI 兼容 API、独立令牌和 Responses 接口的简明步骤。
date: 2026-04-23
updated: 2026-08-31
tags:
  - Codex
  - CLI
  - API
  - 配置
---

# 使用自定义 API Provider 运行 Codex

这篇内容从旧版「兄弟懂我的页面」迁移而来，记录如何让 Codex CLI 使用自建的 OpenAI 兼容 API。示例服务只面向已经获得账号和令牌的用户，不提供公共注册。

## 1. 创建独立令牌

登录你所使用的 API 服务控制台，在令牌管理中创建一个只给 Codex 使用的令牌。不要把令牌写进文章、Git 仓库、截图或聊天记录；不再使用时及时撤销。

## 2. 安装 Codex CLI

项目统一使用 pnpm，可以直接全局安装：

```bash
pnpm add -g @openai/codex
codex --version
```

没有 pnpm 时也可以使用 npm：

```bash
npm install -g @openai/codex
```

## 3. 准备配置目录

Codex 默认从用户目录下的 `.codex` 读取配置：

- Linux、macOS：`~/.codex/`
- Windows：`%USERPROFILE%\.codex\`

目录中需要两个文件：

```text
.codex/
├── auth.json
└── config.toml
```

## 4. 写入 API 令牌

将自己的令牌写入 `auth.json`：

```json
{
  "OPENAI_API_KEY": "替换为你自己的令牌"
}
```

应限制该文件仅当前用户可读。在 Linux 和 macOS 上可以执行：

```bash
chmod 600 ~/.codex/auth.json
```

## 5. 配置自定义 Provider

在 `config.toml` 中加入：

```toml
model_provider = "hhw"
model = "gpt-5.6-sol"
model_reasoning_effort = "high"
disable_response_storage = true
preferred_auth_method = "apikey"

[model_providers.hhw]
name = "HHW"
base_url = "https://api.example.com/v1"
wire_api = "responses"
requires_openai_auth = true
```

示例中的 `base_url` 是占位地址，需要替换为自己所用服务的 API 地址。`wire_api = "responses"` 表示服务端使用 Responses API 兼容接口。模型名必须是当前账号在控制台中实际可用的模型；如果服务端没有提供示例中的模型，就换成控制台列出的名称。

`requires_openai_auth = true` 同样不能省略。它不是说这个地址必须是 OpenAI 官方 API，而是告诉 Codex：这个 Provider 要使用 Codex 的登录凭据，也就是上一步保存在 `auth.json` 里的 API Key。该字段默认是 `false`；从 `codex-cli 0.149.0+` 开始，漏写后更容易出现请求没有带上这份凭据、服务端返回 `401 Unauthorized` 的情况。字段语义可对照 `0.149.1` 的 [ModelProviderInfo 源码](https://github.com/openai/codex/blob/rust-v0.149.1/codex-rs/model-provider-info/src/lib.rs#L139-L144)。

这份配置已按 `codex-cli 0.149.1` 的配置结构复核。Codex 更新后若字段发生变化，以 [Codex 配置参考](https://developers.openai.com/codex/config-reference/) 为准。

## 6. 启动与排错

在任意命令行中运行：

```bash
codex
```

如果启动失败，按顺序检查：

1. `codex --version` 是否能正常输出版本；
2. `auth.json` 是否为合法 JSON，令牌前后有没有多余空格；
3. `config.toml` 中的 `base_url` 是否包含 `/v1`；
4. Provider 名 `hhw` 是否与顶层 `model_provider` 完全一致；
5. `model_providers.hhw` 中是否写了 `requires_openai_auth = true`；
6. 控制台中是否确实开放了所填模型和 Responses 接口。

如果升级到 `0.149.0+` 后 CLI 或 Desktop App 突然返回 `401`，但同一个令牌用 `curl` 可以访问，先检查第 5 项。CLI 与 Desktop App 的会话后端都会读取这份 Provider 配置；只改 `auth.json` 而不声明 Provider 需要 Codex 登录凭据，并不能保证请求会使用其中的令牌。

终端可以使用 Windows Terminal、kitty、Alacritty 等；IDE 用户也可以安装 Codex 插件，但 CLI 配置和 IDE 登录状态不一定共享，遇到问题时应分别检查。
