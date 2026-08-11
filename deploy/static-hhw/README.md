# hello-happy.world 静态镜像

`hello-happy.world` 由静态镜像服务器的 Nginx 直接提供 VitePress 构建产物。它是 `bro-know-my.org` 的静态镜像，不使用 301 跳转，也不在请求时回源 GitHub Pages。

当前运维状态（2026-08-10）：Actions 正式发布已成功完成，`current` 指向最近一次成功部署的 `main` commit release。施工页源码位于 [`maintenance/index.html`](maintenance/index.html)，施工页和旧 release 继续保留用于应急切换与回滚。

正式发布由 [`.github/workflows/deploy-hhw.yml`](../../.github/workflows/deploy-hhw.yml) 完成。工作流使用受限的 `bkm-deploy` 用户，只能写入发布目录；每次上传到以 commit SHA 命名的 release，再原子切换 `current` 软链接，不需要 sudo 或重载 Nginx。

## 目录布局

```text
/opt/bro-know-my-page/
├── current -> releases/某次发布
└── releases/
    └── 某次发布/
```

Nginx 的 `root` 固定指向 `/opt/bro-know-my-page/current`。每次先上传到新的 release 目录，验证文件完整后再原子切换软链接，避免发布过程中出现半新半旧的资源。

线上 Nginx 对 HTML 使用 `Cache-Control: no-cache`，确保发布后浏览器会重新验证页面；对 Vite 生成的带哈希 `/assets/` 文件使用一年 `immutable` 缓存，并对 HTML、CSS、JavaScript、SVG 和 XML 启用 gzip。

## 构建

镜像仍以主域名作为 canonical 来源：

```bash
SITE_URL=https://bro-know-my.org \
VITE_ARTALK_SERVER=https://comment.bro-know-my.org \
VITE_ARTALK_SITE=兄弟懂我的页面 \
pnpm build
```

构建前应先运行：

```bash
pnpm check:content
pnpm typecheck
```

## 手工发布

以下步骤只用于工作流不可用时的应急发布。示例使用 `mirror-host` 作为本机 SSH Config 中的服务器别名，执行前需要替换或配置为实际主机。

为本次发布选择一个不重复的 `release_id`：

```bash
release_id=20260809-vitepress-01

ssh mirror-host "install -d -m 0755 /opt/bro-know-my-page/releases/$release_id"
rsync -az --delete \
  docs/.vitepress/dist/ \
  "mirror-host:/opt/bro-know-my-page/releases/$release_id/"

ssh mirror-host \
  "ln -sfn /opt/bro-know-my-page/releases/$release_id /opt/bro-know-my-page/current && \
   nginx -t && systemctl reload nginx"
```

`--delete` 只能用于刚创建且路径已经人工确认的 release 目录，不得直接指向 `/opt`、`releases` 或其他宽泛目录。

## 验证

```bash
curl -fsS https://hello-happy.world/ | grep '<title>'
curl -fsS https://hello-happy.world/blog/ -o /dev/null
curl -fsS https://hello-happy.world/sitemap.xml -o /dev/null
curl -fsS https://hello-happy.world/rss.xml -o /dev/null
```

还应使用桌面和移动端浏览器检查首页、长文章、暗色模式、搜索和评论区降级状态。

## 回滚

先查看当前和历史 release：

```bash
ssh mirror-host 'readlink -f /opt/bro-know-my-page/current; ls -1 /opt/bro-know-my-page/releases'
```

确认目标后切换软链接：

```bash
rollback_release=替换为已验证的历史目录名
ssh mirror-host \
  "ln -sfn /opt/bro-know-my-page/releases/$rollback_release /opt/bro-know-my-page/current && \
   nginx -t && systemctl reload nginx"
```

不要在尚未确认新站稳定时删除上一份 release。旧版动态博客的完整归档也只保留在服务器 root 可读的备份目录，不进入 Git 仓库。

## Nginx

VitePress 的无扩展文章 URL 需要按 `$uri.html` 查找，不能沿用旧 SPA 的统一 `/index.html` 回退。基础配置见 [`nginx/hello-happy.world.conf`](nginx/hello-happy.world.conf)。实际服务器还承载独立管理路由，更新站点配置时必须保留这些 location。
