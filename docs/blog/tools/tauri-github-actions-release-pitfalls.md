---
title: Tauri 跨平台发布：迁移 macOS Runner 与容忍 DMG 偶发失败
description: 记录 Tauri 项目因旧版 macOS Runner 停止支持而迁移，以及隔离 DMG 偶发失败的 GitHub Actions 调整。
date: 2026-08-11
updated: 2026-08-31
tags:
  - Tauri
  - GitHub Actions
  - CI/CD
  - macOS
---

# Tauri 跨平台发布：迁移 macOS Runner 与容忍 DMG 偶发失败

BroKnowMySparkAnalyzer 和 BroKnowMyGitDesktop 都使用 Tauri 2，并通过 GitHub Actions 构建 Windows、Linux 和 macOS 安装包。维护发布流程时遇到过两个容易混淆的问题：

1. 原来使用的 macOS Runner 版本停止支持，工作流必须迁移。
2. DMG 打包并非必然失败，而是有概率失败，因此只把 DMG 设为可选产物。

前者是构建环境生命周期问题，后者是打包稳定性问题。Runner 迁移不代表放弃旧架构，DMG 可选也不代表整个 macOS 构建都可以失败。

## 旧版 Runner 停止支持后必须迁移

最初的 macOS 构建矩阵使用 `macos-13` 构建 Intel 版本，使用当时的 `macos-latest` 构建 Apple Silicon 版本：

```yaml
- platform: macos-13
  target: x86_64-apple-darwin
- platform: macos-latest
  target: aarch64-apple-darwin
```

后来 GitHub Actions 不再支持对应的旧版 macOS Runner，Intel 构建因此不能继续停留在 `macos-13`。这次修改的直接原因是 Runner 退役，而不是 Tauri 改变了目标架构，也不是新 Runner 编译得更快。

迁移后的对应关系是：

| 架构 | Runner | Rust target |
| --- | --- | --- |
| Apple Silicon | `macos-15` | `aarch64-apple-darwin` |
| Intel | `macos-15-intel` | `x86_64-apple-darwin` |

这里要分别确认 Runner 架构和 Rust target。只把 `runs-on` 改成新标签，却继续使用不匹配的 target，仍然会在后续编译或打包时出错。

除非确实需要一个文件同时覆盖两种 Mac，否则没必要一开始就构建 universal binary。分别构建 Intel 和 Apple Silicon 版本，矩阵关系更直观，失败时也更容易判断是哪条链路出了问题。

## DMG 是偶发失败，不是必然失败

迁移 Runner 之后，Rust 编译和 `.app` 生成可以正常完成，但 DMG 打包仍会偶发失败。同一份代码重新运行有时又能成功，因此它不是稳定复现的编译错误，也不适合让整次跨平台发布一直被阻塞。

处理方式不是给整个 macOS job 加 `continue-on-error`。那样会把 Rust 编译失败、前端构建失败和 `.app` 缺失等真实问题一起吞掉。应该先拆开编译与各类打包步骤，只允许 DMG 失败：

```bash
pnpm tauri build --ci --no-bundle --target "$TARGET" -- --locked
pnpm tauri bundle --ci --bundles app --target "$TARGET"
pnpm tauri bundle --ci --bundles dmg --target "$TARGET"
```

在工作流中，前两个命令保持默认的失败行为，只给最后一个 DMG 步骤设置：

```yaml
- name: Build DMG
  continue-on-error: true
  run: pnpm tauri bundle --ci --bundles dmg --target "$TARGET"
```

各步骤的要求应明确区分：

| 步骤或产物 | 是否必需 | 失败后的处理 |
| --- | --- | --- |
| Rust 与前端编译 | 必需 | 终止该平台构建 |
| macOS `.app` | 必需 | 终止该平台构建 |
| `.app` 归档与上传 | 必需 | 终止该平台构建 |
| macOS DMG | 可选 | 记录失败，继续发布 |
| Windows、DEB、RPM、AppImage | 必需 | 缺失时终止发布 |

`.app` 本身是目录，上传前要使用 ZIP 等能保留目录结构的格式归档。最终发布任务必须检查这个归档存在；DMG 则是“生成成功就一起发布，失败也不阻塞其他必需产物”。

这个边界很重要：可选的是一个存在概率性失败的打包格式，不是 macOS 平台，也不是编译正确性。

## 构建与发布分开

各平台的矩阵任务只负责构建并上传 Actions artifact，等所有必需构建完成后，再由单独的 publish job 创建 Release：

```text
Windows / Linux / macOS build jobs
                ↓
       上传 Actions artifacts
                ↓
            publish job
                ↓
检查必需产物、生成 SHA256SUMS.txt、创建 Release
```

这样做有三个好处：

- 构建任务只需要 `contents: read`，只有 publish job 需要 `contents: write`。
- 矩阵任务不会同时修改同一个 Release。
- publish job 可以统一判断哪些产物必需、哪些产物可选。

发布时应先创建 draft Release，上传资产并核对资产集合，确认无误后再公开。这样即使上传中途失败，也不会留下一个缺少必需安装包的公开 Release。

DMG 如果存在，也应加入 `SHA256SUMS.txt`；如果本次没有生成 DMG，则不应因为它缺失而失败。其他声明为必需的产物仍必须逐项检查。

## 缓存只用于加速，不用于保存产物

Node 和 Rust 依赖可以分别使用 pnpm store 缓存和 Rust 构建缓存：

```yaml
- uses: pnpm/action-setup@v4
  with:
    version: 10

- uses: actions/setup-node@v4
  with:
    node-version: 20
    cache: pnpm

- uses: swatinem/rust-cache@v2
  with:
    workspaces: src-tauri -> target
```

`pnpm/action-setup` 要放在启用 pnpm 缓存的 `setup-node` 前面，使后者能找到 pnpm store。即使命中缓存，也仍然要执行 `pnpm install --frozen-lockfile`。

以下内容不应混进 cache：

- `node_modules` 和前端 `dist`；
- DEB、RPM、NSIS、AppImage、DMG 等最终产物；
- Actions Runner 上安装后的系统目录。

Cache 是可以丢弃并重新生成的加速数据，artifact 才是某次构建需要交给 publish job 的结果。Intel 和 Apple Silicon 也不应共享同一个 Rust `target` 缓存。

示例为了可读性使用了 Action 的主版本 tag。实际发布工作流应固定到审查过的完整 commit SHA，并用注释保留对应版本。

## 发布前后的最低限度校验

发布流程至少应完成这些检查：

1. tag 符合项目约定的版本格式。
2. tag 指向允许发布的提交。
3. Windows、Linux 和 macOS `.app` 等必需产物全部存在。
4. 对实际生成的全部资产计算 SHA-256，包括成功生成的 DMG。
5. Release 资产核对完成后再从 draft 转为公开。

Linux 可以这样验证下载后的校验和文件：

```bash
sha256sum --check SHA256SUMS.txt
```

macOS 自带的 `shasum` 对应命令是：

```bash
shasum --algorithm 256 --check SHA256SUMS.txt
```

如果问题来自工作流定义，简单重跑旧 tag 仍会使用该 tag 对应提交中的旧工作流。此时应修复工作流后发布新的补丁版本，或者通过受信任的手动恢复流程明确检出原 tag。不要随意把已经公开的 tag 强行移动到另一个 commit。

## 结论

这次调整可以归纳为两件互不替代的事：

- `macos-13` 对应的旧 Runner 不再受支持，所以 Intel 构建迁移到 `macos-15-intel`；这是必须做的环境升级。
- DMG 在 Runner 上有概率打包失败，所以只把 DMG 步骤和产物设为可选；编译、`.app` 和其他平台的正式产物仍然必须成功。

把编译、打包和发布拆开之后，偶发的 DMG 问题不会拖垮已经成功的跨平台 Release，真正的编译错误也不会被 `continue-on-error` 掩盖。
