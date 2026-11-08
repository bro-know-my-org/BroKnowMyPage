---
author: 假发
title: 让 Codex 委派只读调查：agy-delegate-rs 与 dsh-delegate-rs
description: 通过 MCP 将搜索、读代码和查配置等调查工作卸载给 agy 或 dsh，降低主模型上下文与 Token 消耗。
date: 2026-10-12
updated: 2026-11-08
tags:
  - Codex
  - AI
  - MCP
---

# 让 Codex 委派只读调查：agy-delegate-rs 与 dsh-delegate-rs

在复杂开发任务中，主模型亲自遍历目录、搜索关键词和通读配置会占用大量上下文与思考轮次。

[`agy-delegate-rs`](https://github.com/JIAFALSEDREAM/agy-delegate-rs) 与 [`dsh-delegate-rs`](https://github.com/JIAFALSEDREAM/dsh-delegate-rs) 通过 MCP 协议，将这些繁琐的只读调查任务委派给响应更快、单价更低的轻量模型 CLI（如 Gemini Flash 或 DeepSeek Flash）执行，由外部 CLI 在后台完成搜寻并回传提炼后的结论与行列号，主模型即可专注于方案设计与代码实现。

---

## 核心机制与安全边界

- **外部 CLI 独立调度**：多轮文件遍历由外部子进程处理，主模型仅负责派发任务与解析结构化报告。
- **异步非阻塞**：提交任务后立即返回 Task ID，Codex 可并行处理其他任务；超时等待不中断后台进程。
- **会话持久追问**：支持基于同一上下文复用会话继续下钻排查，每次追问生成独立 Task ID。
- **只读沙箱隔离**：严格受 `codex sandbox` 只读机制限制；沙箱启动失败时直接终止任务，杜绝项目写操作（注：沙箱保留网络访问权限，不隔离凭据）。

| 特性 / 工具 | [`agy-delegate-rs`](https://github.com/JIAFALSEDREAM/agy-delegate-rs) | [`dsh-delegate-rs`](https://github.com/JIAFALSEDREAM/dsh-delegate-rs) |
| :--- | :--- | :--- |
| **安装依赖** | npm 安装需要 Node.js 22.14+ | 源码编译需要 Rust 1.88+、C 编译工具链；dsh 需要 Node.js 24.9.0+ |
| **后端 CLI** | Antigravity CLI (`agy`) | `dsh` |
| **推荐模型** | Gemini 3.8 Flash (High) | DeepSeek V4.1 Flash（通过 CommandCode 等 Provider） |
| **执行模式** | 官方 Harness 调用 | PTC（模型编写程序调工具） |

---

## 安装与配置

根据工作流选择其中一套部署即可。**两套工具均依赖宿主机已安装且沙箱功能正常的 Codex CLI。**

### 选项 A：agy-delegate-rs（npm 安装）

先安装并配置好 Antigravity CLI（`agy`），确认能正常调用模型。

**1. 全局安装与注册**

```bash
npm install -g agy-delegate-rs
agy-delegate-rs install
```

> `install` 指令会自动校验环境沙箱、向 Codex 注册 MCP 服务，并写入使 Codex 优先委派只读调查的 `AGENTS` 路由规则。若仅需注册 MCP，可运行 `agy-delegate-rs register`。

**2. 连通性测试**

```bash
agy-delegate-rs run --cwd /absolute/path/to/repo --task '查找配置加载入口，附文件行号'
```

---

### 选项 B：dsh-delegate-rs（源码安装）

先安装 dsh，并准备上表中的编译依赖。运行时固定使用 PTC，模型自主编写控制程序筛选调用。

**1. 编译安装**

```bash
git clone https://github.com/JIAFALSEDREAM/dsh-delegate-rs.git
cd dsh-delegate-rs
cargo install --path . --locked
dsh-delegate-rs init
```

`init` 会生成配置文件（Linux 路径一般为 `~/.config/dsh-delegate-rs/config.toml`）。默认使用 `deepseek-official/deepseek-flash` 并读取环境变量 `DEEPSEEK_API_KEY`。

**2. 配置凭据与 Provider（以 CommandCode 插件为例）**

若复用 dsh 界面已有的插件与认证，在 `config.toml` 中配置（已有同名配置项直接修改，路径换成自己的绝对路径；程序直接在内存中传递凭据，不修改原文件）：

```toml
provider = "commandcode"
model = "deepseek/deepseek-v4.1-flash"
dsh_credentials_file = "/home/you/.dsh/.credentials.yaml"
dsh_credential_refs = ["COMMANDCODE_API_KEY"]
dsh_plugins = ["/home/you/.dsh/profiles/web/node_modules/@mars-sea/dsh-commandcode-provider"]
dsh_patches = ["/absolute/path/dsh-delegate-rs/examples/commandcode.yml"]
```

**3. 环境诊断与真机测试**

```bash
# 验证环境依赖与配置格式（不调用 API）
dsh-delegate-rs doctor

# 真实排查测试（验证模型可用性与凭据加载）
dsh-delegate-rs run --cwd /absolute/path/to/repo --task '查找配置加载入口，附文件行号'
```

**4. 接入 Codex**

```bash
dsh-delegate-rs install
```

> 同样支持 `dsh-delegate-rs register` 单独更新 MCP 注册项。**后续若修改了模型或凭据配置文件，必须重新执行 `register` 以同步 MCP 配置。**

---

## 交互流程

接入成功后启动新的 Codex 会话，直接下达调研任务，Codex 会自动调用 MCP 工具链处理：

```text
帮我查一下这个仓库的配置加载顺序，附关键文件位置。
```

### 工具调用链路

```text
[发起任务]         [轮询/阻塞等待]              [获取结果]
submit 工具  ───>  status / wait 工具  ───>  解析只读报告
                        │
                        └── (若需深化排查) ───> followup 工具 (沿用会话上下文)
```

* **agy 套件**：`agy_submit` → `agy_wait` / `agy_status` → `agy_followup`
* **dsh 套件**：`dsh_submit` → `dsh_wait` / `dsh_status` → `dsh_followup`
* **辅助管理**：`list` 查看当前及历史任务列表；`cancel` 请求停止任务对应的本地子进程树，需检查最终状态确认已停止。

### 异常处理建议

* **状态校验**：主模型获取到报告后应首先检查运行状态，未完成或执行失败的任务不可直接采信。
* **降级回退**：任务失败后先排查原因。修复环境、确认旧进程已停止且存在可恢复会话后，可用原 Task ID 执行 `followup`；没有可恢复会话则重新提交，也可回退至 `quick_explorer` 等内置搜寻工具。

*(注：当前两套实现均已在 Linux 环境下验证跑通，macOS 与 Windows 兼容性待后续测试。)*
