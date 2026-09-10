---
author: 假发
title: 给 Codex 配个小模型跑腿，高级模型调用量直接腰斩
description: 用 quick_explorer 接手搜索、盘点和配置核对，我的实测中高级模型调用量大约减半。记录配置方法，以及这种分工为什么能省额度。
date: 2026-09-10
updated: 2026-09-10
tags:
  - Codex
  - AI
  - 配置
---

# 给 Codex 配个小模型跑腿，高级模型调用量直接腰斩

受隔壁群友指点，给 Codex 配了个小模型子代理。用了之后，高级模型调用量大约少了一半，省下不少额度，把配置分享出来。

我用 Astra 当主模型，Luna 当子代理 `quick_explorer`。查文件、统计数量、对比配置这些活交给 Luna，判断方案、写代码还是 Astra 来。

## 为什么能省

Codex 查东西也要一轮轮调用模型：搜索、读文件、看结果，再决定要不要继续查。全让 Astra 做，这几轮都消耗它的额度。

交给 Luna 之后，中间的查询由 Luna 完成，只把结论和文件位置发回来。Astra 少跑几轮，也可以少读一堆原始搜索结果。省的主要就是这部分。

## 配置

新建 `~/.codex/agents/quick_explorer.toml`：

```toml
name = "quick_explorer"
description = "Bounded, low-ambiguity, read-only checks with independently verifiable results."
model = "gpt-5.6-luna"
model_reasoning_effort = "max"
sandbox_mode = "read-only"
developer_instructions = """
Handle deterministic searches, inventories, comparisons, and mechanical verification.
Do not edit files. Return concise findings with evidence and file references.
Escalate ambiguity to the parent agent instead of expanding scope.
"""
```

Luna 只负责查，不改文件；遇到拿不准的问题交回主模型。模型名要是你用的服务支持的。

然后在已有的 `~/.codex/AGENTS.md` 后面追加：

```markdown
- Use `quick_explorer` as the default and only routinely spawned subagent.
- Delegate deterministic searches, inventories, counts, configuration-value checks, and mechanical comparisons to `quick_explorer`, including a single such subtask, when the work requires file inspection, tool calls, or scanning that would otherwise be performed by the main agent.
- Use `explorer` only when the user explicitly requests it, or when the main agent determines or `quick_explorer` reports that a bounded, unusually large read-heavy investigation is outside `quick_explorer`'s deterministic scope and would materially benefit from separate context.
```

这几条让主代理平时优先叫 `quick_explorer`，连单个查询也交出去。普通 `explorer` 留给明确指定或超出小模型能力的大型调查。只建配置不写分工规则，主模型可能还是自己把活全干了。

保存后新开 Codex 会话。

## 大概能省多少

我这里 Luna 和 Astra 的额度消耗比例大约是 **1:3 到 1:2**，所用服务里 Astra 的单价差不多是 Luna 的 **10 倍**。

按扣费额度算，假设有效单价相差 10 倍，可以反推：

| Luna : Astra 扣费 | Luna : Astra 计费 Token | 相比相同 Token 全用 Astra，理论省费 |
| --- | --- | --- |
| 1:3 | 约 3.3:1 | 约 69% |
| 1:2 | 5:1 | 75% |

比如 Luna 花 1 份额度，Astra 花 3 份，总共花 4 份。Luna 处理的那些 Token 换成 Astra 要花 10 份，加上原来的 3 份就是 13 份。这样算下来省了 `1 - 4 / 13 ≈ 69%`。1:2 同理，省 `1 - 3 / 12 = 75%`。

也就是 **Luna 处理了约 77%～83% 的计费 Token，只花了总额度的 25%～33%**。

这个七成左右是按相同 Token 用量估出来的费用差，不是实测账单降幅。输入、输出、缓存的单价要分别看，子代理传话也有额外开销。我目前实测的是高级模型调用量大约减半。
