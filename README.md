# BKMPG

一个以 Markdown 为唯一内容源的个人博客、教程与技术文档站。正文由 VitePress 静态构建，GitHub Pages 承载主站，`hny-jp` 承载国内优化静态镜像；评论通过 `vultr-jp` 上独立部署的 Artalk 提供。

## 当前已落地

- VitePress + Vue + TypeScript；
- pnpm 锁定依赖与脚本；
- 自定义内容地图首页，以及博客、教程、文档、标签四类内容入口；
- 栏目页使用紧凑文章列表，404 页、标签筛选和评论区统一为简洁中文界面；
- 本地全文搜索、代码高亮、目录、暗色模式和响应式布局；
- Sitemap、RSS、canonical、Open Graph 和 robots.txt；
- 首页留言和文章评论均由 Artalk 提供，按接近视口时懒加载，未配置或不可用时不影响页面内容；
- GitHub Actions 内容检查、类型检查、构建、Pages 发布与 hny-jp 原子镜像发布；
- `hello-happy.world` 的 Nginx 静态镜像、原子发布和回滚目录；
- Artalk + PostgreSQL Compose、Nginx 及 Certbot 配置样例；
- frontmatter 完整性和常见敏感凭据扫描。

当前没有额外引入图标或 UI 组件库：已有界面由 VitePress 主题能力和少量自定义 Vue 组件完成。后续若出现表单、弹窗、复杂交互等明确需求，统一使用 Naive UI，避免混用多套组件体系。

站点主题色为 `#4B0082`；浅色模式使用该色作为主色，深色模式使用提高亮度后的同色系变量以保证文字和交互状态清晰可见。

主题样式按全局、内容列表、评论区和首页拆分；组件内没有内联 SVG，仅保留独立的小型 `favicon.svg`。

`docs/public/vendor/artalk.css` 来自当前锁定的 Artalk npm 包，用于避免评论样式进入首屏 CSS。升级 Artalk 版本时，需要同步用新包中的 `dist/Artalk.css` 覆盖该文件。

原始 Markdown 从 `/home/halo/Desktop/blog` 迁入时只复制公开文章。`plan.md` 不作为站点内容，包含真实服务器密码与连接信息的 `jpvps` 明确排除。

## 环境要求

- Node.js 22 或更高版本；
- pnpm 10 或更高版本。仓库通过 `packageManager` 固定当前 pnpm 版本。

首次运行：

```bash
corepack enable
pnpm install
cp .env.example .env.local
pnpm dev
```

默认开发地址为 `http://localhost:55173`，生产预览地址为 `http://localhost:55174`。

## 常用命令

```bash
pnpm dev            # 本地开发
pnpm check:content  # 检查元数据、URL 和常见敏感凭据
pnpm typecheck      # TypeScript / Vue 类型检查
pnpm check          # 完整检查并执行一次 VitePress 构建
pnpm build          # 生产构建，并生成 RSS 与 robots.txt
pnpm preview        # 预览生产构建
```

生产构建输出位于 `docs/.vitepress/dist`。

## 部署拓扑

```text
bro-know-my.org
└── GitHub Pages：主站与 canonical 来源

hello-happy.world
└── hny-jp / Nginx：同一份 VitePress 静态构建，作为国内优化镜像

comment.bro-know-my.org
└── vultr-jp / Nginx → Artalk 127.0.0.1:23366 → PostgreSQL
```

两个静态入口共享 Markdown 内容，但 canonical、Sitemap 和 RSS 统一使用 `https://bro-know-my.org`，避免镜像产生重复收录。评论数据始终只写入 vultr-jp 上的一套 Artalk 和 PostgreSQL。

## 内容结构

```text
docs/
├── blog/        # 故障排查、踩坑修复、建站记录和技术思考
├── tutorials/   # 可按步骤从零完成的部署与配置教程
├── docs/        # 面向查找的结构化文档
├── public/      # 无需构建处理的静态资源
└── .vitepress/  # TypeScript 配置、数据加载器和 Vue 主题
```

公开文章必须包含以下 frontmatter：

```yaml
---
title: 文章标题
description: 一句话摘要
date: 2026-08-09
updated: 2026-08-09
tags:
  - Linux
  - 故障排查
---
```

栏目首页等不进入文章列表的页面使用 `listed: false`；不显示评论的页面使用 `comments: false`。文件路径就是永久 URL，发布后不要随意移动。确需调整时，应同时在 Cloudflare 或站点入口增加 301 重定向。

分类规则：

- 博客保留真实问题的现象、排查路径和修复过程，重点是“为什么会这样、当时怎么找到根因”；
- 教程面向明确目标，重点是“读者如何从零完成”，不要求读者重走原作者的排查过程；
- 文档用于稳定、结构化、方便快速查找的参考资料。

## 环境变量

| 变量 | 用途 | 未设置时 |
| --- | --- | --- |
| `SITE_URL` | canonical、Sitemap、RSS 的正式站点来源 | `https://bro-know-my.org` |
| `VITE_ARTALK_SERVER` | Artalk 公网地址 | 评论区显示为暂未配置 |
| `VITE_ARTALK_SITE` | Artalk 站点名 | `兄弟懂我的页面` |

前台品牌名为 `BKMPG`；`VITE_ARTALK_SITE` 仍使用已建站时的内部站点键「兄弟懂我的页面」。不要随意修改该值，否则 Artalk 会把新评论归到另一个站点。

本地变量写入仓库根目录的 `.env.local`，不要提交；首次可从 `.env.example` 复制，修改后需要重启开发服务器。VitePress 已将 Vite 的环境变量目录固定到仓库根目录。GitHub Pages 使用仓库 `Settings → Secrets and variables → Actions → Variables` 中的同名 Variables；它们都是需要写进浏览器产物的公开地址，不应放 OAuth Secret 或数据库密码。

## GitHub Pages 上线

仓库已创建并设置为 `origin`，目前仍为空；首次提交整理完成后再统一 push。上线时：

1. 将整理后的首次提交推送到 `main` 分支；
2. 在仓库 Pages 设置中选择 `GitHub Actions` 作为 Source；
3. 添加 `SITE_URL=https://bro-know-my.org`、`VITE_ARTALK_SERVER=https://comment.bro-know-my.org` 和 `VITE_ARTALK_SITE=兄弟懂我的页面` 三个 Actions Variables；
4. 首次先以 DNS-only 完成自定义域名校验和 GitHub Pages HTTPS；同时复核现有评论域名 A 记录与 CORS；
5. 确认直连正常后再开启 Cloudflare 代理；
6. 静态资源允许缓存，评论 API、管理入口和 OAuth 回调明确绕过缓存。

工作流位于 `.github/workflows/deploy-pages.yml`。每次部署都对应一个 Git commit；需要回滚时，revert 问题 commit 或重新运行目标 commit 对应的工作流。

## Artalk

服务器侧样例和备份恢复步骤见 [`deploy/artalk/README.md`](deploy/artalk/README.md)。GitHub OAuth Secret、Artalk App Key 和数据库密码只留在 VPS 的 `deploy/artalk/.env`，不得进入仓库或 Actions Variables。

生产实例已部署在 vultr-jp，并通过 `https://comment.bro-know-my.org` 提供服务。HTTPS、CORS、管理员、验证码频控和轻量垃圾规则已经验证；PostgreSQL 不开放公网端口。GitHub OAuth 已恢复，匿名和 Email 登录均关闭；登录用户的正常评论直接公开，命中垃圾关键词时才进入待审。评论、回复、点赞、登录、删除和通知流程已完成测试。首次数据库备份已加密保存到服务器之外；当前不要求恢复演练。

## hello-happy.world 静态镜像

`hello-happy.world` 不跳转或整站反代 GitHub Pages，而是直接从 hny-jp 的 Nginx 提供构建产物。发布、验证与回滚步骤见 [`deploy/static-hhw/README.md`](deploy/static-hhw/README.md)。旧版动态博客已经归档并停止，其原 `/api/` 返回 `410 Gone`；服务器上的其他管理路由和子域服务保持独立。

VitePress 构建产物已经完成过手工原子发布验证。外观定稿前，线上暂时切换到独立施工页；当前 release 为 `20260809-maintenance-03`，上一版仍保留可回滚。

## 后续工作

- 首页和整体外观已完成一轮桌面、手机与深色模式收尾；继续统一现有文章格式，再整理首次提交和 push；
- 首次 push 后验证 GitHub Pages 与 hny-jp 两条 Actions 发布链路，并绑定 `bro-know-my.org`；
- Artalk 评论、回复、点赞、登录、删除和通知流程已完成测试；
- 评论数据库已有 VPS 外加密备份，后续补充构建或部署失败提醒；
- 根据实际文章补充图片与站点图标；
- 上线后实测电信、联通、移动和海外网络，不预设 Cloudflare 一定改善大陆访问；
- 发布前检查现有 Codex 速查内容与目标 Codex 版本是否一致。
