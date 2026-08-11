---
title: 如何给 BKMPG 写文章
description: BKMPG 从选择分类、创建 Markdown、处理图片到本地检查和发布的完整写作流程。
date: 2026-08-11
updated: 2026-08-11
tags:
  - BKMPG
  - Markdown
  - VitePress
---

# 如何给 BKMPG 写文章

平时更新站点，基本只会碰三类文件：文章 Markdown、链接入口数据和文章图片。主题组件、部署配置和服务器文件不需要跟着每篇文章改。

## 先判断该放哪

三个栏目按内容用途区分，不按文章长短区分。

| 栏目 | 适合放什么 | 例子 |
| --- | --- | --- |
| 博客 | 已经发生的问题、排查过程、踩坑和修复记录 | PipeWire 音量异常、kitty 重复按键 |
| 教程 | 从零开始，读者可以按步骤完成的部署或配置 | VLESS + Reality 部署 |
| 文档 | 适合反复查找的命令、配置项和维护说明 | Codex CLI 速查、这篇写作说明 |

拿不准时可以这样判断：重点是“我遇到了什么、怎么查出来的”，放博客；重点是“你照着做就能完成”，放教程；重点是“以后回来查某个参数或规则”，放文档。

MC 服务器、中转站、外部榜单之类的宣传入口不写成博客文章，直接修改 `docs/.vitepress/data/links.ts`。需要在首页展示时给条目增加：

```ts
featured: true,
```

## 创建文件

文章分别放在这些目录：

```text
docs/blog/          博客
docs/tutorials/     教程
docs/docs/          文档
```

可以继续按主题建子目录，例如：

```text
docs/blog/linux/example-article.md
docs/tutorials/vps/example-deployment.md
docs/docs/tools/example-reference.md
```

文件名使用小写英文和连字符。文章发布后不要随便改文件名或目录，否则公开 URL 会变化，旧链接也会失效。

## 填写 frontmatter

每篇公开文章开头都要有这几项：

```yaml
---
title: 文章标题
description: 一句话说明文章解决什么问题，不超过 160 个字符。
date: 2026-08-11
updated: 2026-08-11
tags:
  - Linux
  - 示例标签
---
```

- `title` 是列表、搜索和浏览器标题使用的文章名。
- `description` 应直接说明内容，不写“本文将会介绍”之类的套话。
- `date` 是首次发布日，后续修改文章时不要跟着改。
- `updated` 是最后一次实质更新日期。
- `tags` 至少写一个，不要在同一篇文章里重复。

不想进入文章列表、首页最近更新和 RSS 的页面，可以增加：

```yaml
listed: false
```

这通常只用于栏目索引、迁移提示和独立功能页，不要给普通文章使用。

## 正文怎么组织

正文必须只有一个一级标题，并且通常与 frontmatter 的标题一致：

```markdown
# 文章标题
```

不同栏目可以使用不同结构，不需要把所有文章硬套成同一个模板。

博客排障记录可以按这个顺序写：

1. 发生了什么，环境和现象是什么。
2. 做过哪些判断，依据是什么。
3. 最终原因和修复方法。
4. 如何确认问题真的解决。
5. 有风险时补充回滚方法。

教程可以按这个顺序写：

1. 最终要完成什么。
2. 前置条件和适用环境。
3. 按顺序执行的步骤。
4. 验证命令和预期结果。
5. 常见问题、安全注意事项和回滚方法。

文档更适合按命令、配置区域或使用场景分组，开头注明适用版本。不要为了显得完整重复官方文档里与实际使用无关的内容。

## 命令和代码块

代码块必须标注语言。常用类型包括：

~~~markdown
```bash
pnpm check
```

```console
$ pnpm check
内容检查通过
```

```json
{"enabled": true}
```

```text
/etc/example/config
```
~~~

- `bash` 用于可以复制执行的 shell 命令。
- `console` 用于同时展示命令和输出。
- 路径、日志和普通配置片段不确定语言时使用 `text`。
- 不要把真实密码、Token、Cookie、私钥、UUID 或数据库连接串写进文章。
- 示例中的敏感值使用 `YOUR_TOKEN`、`YOUR_UUID` 等明显占位符。

## 添加图片

图片放在对应文章旁边，不放进 `docs/public`。例如：

```text
docs/blog/linux/example-article.md
docs/blog/linux/images/example-screen.webp
```

JPG 或 PNG 先转换为 WebP。带文字的 UI 截图使用无损模式：

```bash
pnpm image:optimize docs/blog/linux/images/example-screen.png --lossless
```

照片使用默认质量即可：

```bash
pnpm image:optimize docs/blog/linux/images/example-photo.jpg --quality=80
```

转换后在 Markdown 里使用相对路径，并写清楚 alt：

```markdown
![PipeWire 音量控件截图](./images/example-screen.webp)
```

处理脚本会限制图片宽度为 1920px，并移除 EXIF、GPS 等元数据。它不会自动删除原图；确认文章已经改用 WebP 后，再决定是否删除不需要提交的 JPG 或 PNG。

完整检查会拦截以下问题：

- 图片超过 500 KiB。
- 图片宽度超过 1920px。
- 仍包含 EXIF、IPTC 或 XMP 元数据。
- Markdown 图片没有 alt。
- 引用的本地图片不存在。

## 内部链接

站内链接使用最终公开路径，不写 `.md`：

```markdown
[Codex 自定义 API Provider](/blog/tools/codex-custom-api-provider)
```

文章图片使用相对路径，其他文章使用从站点根目录开始的绝对路径。这样无论从 GitHub Pages 还是静态镜像访问，链接都保持一致。

## 本地查看

启动开发服务器：

```bash
pnpm dev
```

浏览器打开 `http://localhost:55173`。至少看一遍：

- 标题和摘要是否自然。
- 桌面和手机宽度下是否容易阅读。
- 浅色、深色模式下图片和代码块是否清楚。
- 目录层级是否正确。
- 内部链接和外部链接是否能打开。

## 发布前检查

运行：

```bash
pnpm check
```

它会依次检查文章格式、常见敏感凭据、图片、TypeScript 类型，并执行一次 VitePress 生产构建。任何一步失败都不要直接发布，先按错误信息修正。

还可以查看本次修改范围：

```bash
git status --short
git diff --check
git diff --stat
```

确认没有 `.env`、数据库备份、原始凭据或无关大文件后，再提交和推送。推送 `main` 会同时触发 GitHub Pages 与静态镜像两条 Actions。

## 修改旧文章

更新已经发布的文章时：

1. 保留原来的 `date`。
2. 把 `updated` 改为本次实质修改日期。
3. 不随意改文件路径。
4. 不为了统一措辞覆盖原作者刻意保留的语气。
5. 修正事实或命令后，重新运行相关验证。

只改错别字时是否更新 `updated` 可以自行判断；如果修改会影响读者操作或文章结论，就应该更新。

## 最后检查一遍

- 分类选对了。
- frontmatter 完整。
- 正文只有一个 H1。
- 标题层级没有跳跃。
- 代码块都有语言。
- 敏感值已经替换为占位符。
- 图片完成压缩并带 alt。
- 验证方法和结果写清楚了。
- `pnpm check` 通过。
