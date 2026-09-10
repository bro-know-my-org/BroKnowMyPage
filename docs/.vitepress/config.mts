import { defineConfig, type HeadConfig } from 'vitepress'
import { transformSitemapItems } from './sitemap.mts'

const siteUrl = (process.env.SITE_URL || 'https://bro-know-my.org').replace(/\/$/, '')

function pageUrl(relativePath: string): string {
  const route = relativePath
    .replace(/(^|\/)index\.md$/, '$1')
    .replace(/\.md$/, '')

  return new URL(route, `${siteUrl}/`).toString()
}

function isArticlePage(relativePath: string, listed: unknown): boolean {
  return listed !== false
    && /^(?:blog|tutorials|docs)\//.test(relativePath)
    && !/(^|\/)index\.md$/.test(relativePath)
}

export default defineConfig({
  lang: 'zh-CN',
  title: 'BKMPG',
  titleTemplate: ':title · BKMPG',
  description: 'Linux、VPS、开发工具与 AI 工具的实践笔记、教程和文档。',
  vite: {
    envDir: process.cwd(),
  },
  cleanUrls: true,
  lastUpdated: true,
  sitemap: {
    hostname: siteUrl,
    transformItems: transformSitemapItems,
  },
  head: [
    ['meta', { name: 'theme-color', content: '#4b0082' }],
    ['meta', { name: 'referrer', content: 'strict-origin-when-cross-origin' }],
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    ['link', { rel: 'alternate', type: 'application/rss+xml', title: 'BKMPG RSS', href: '/rss.xml' }],
  ],
  markdown: {
    lineNumbers: true,
    theme: {
      light: 'github-light',
      dark: 'github-dark',
    },
  },
  themeConfig: {
    siteTitle: 'BKMPG',
    nav: [
      { text: '首页', link: '/' },
      { text: '博客', link: '/blog/' },
      { text: '教程', link: '/tutorials/' },
      { text: '文档', link: '/docs/' },
      { text: '标签', link: '/tags' },
      { text: '链接', link: '/links' },
    ],
    sidebar: {
      '/blog/': [
        {
          text: '博客',
          items: [
            { text: '全部文章', link: '/blog/' },
            { text: '建站开篇', link: '/blog/hello' },
          ],
        },
        {
          text: '故障排查记录',
          items: [
            { text: 'PipeWire USB DAC 音量修复', link: '/blog/linux/pipewire-usb-dac-volume-fix' },
            { text: 'kitty 与 Codex 重复按键修复', link: '/blog/tools/kitty-codex-double-keypress-fix' },
            { text: 'Codex 自定义 API Provider', link: '/blog/tools/codex-custom-api-provider' },
            { text: 'Tauri Runner 与 DMG 踩坑', link: '/blog/tools/tauri-github-actions-release-pitfalls' },
          ],
        },
      ],
      '/tutorials/': [
        {
          text: '教程',
          items: [
            { text: '教程索引', link: '/tutorials/' },
          ],
        },
      ],
      '/docs/': [
        {
          text: 'Codex 速查',
          items: [
            { text: '文档索引', link: '/docs/' },
            { text: 'CLI 命令与参数', link: '/docs/codex/cli-commands' },
            { text: '配置项', link: '/docs/codex/config-options' },
            { text: '键盘快捷键', link: '/docs/codex/keyboard-shortcuts' },
            { text: '斜杠命令', link: '/docs/codex/slash-commands' },
          ],
        },
        {
          text: '站点维护',
          items: [
            { text: '如何写文章', link: '/docs/site/writing' },
          ],
        },
      ],
    },
    search: {
      provider: 'local',
      options: {
        translations: {
          button: { buttonText: '搜索', buttonAriaLabel: '搜索' },
          modal: {
            noResultsText: '没有找到相关内容',
            resetButtonTitle: '清除查询',
            footer: { selectText: '选择', navigateText: '切换', closeText: '关闭' },
          },
        },
      },
    },
    outline: { level: [2, 3], label: '本页目录' },
    docFooter: { prev: '上一篇', next: '下一篇' },
    lastUpdated: { text: '最后更新' },
    returnToTopLabel: '返回顶部',
    sidebarMenuLabel: '菜单',
    darkModeSwitchLabel: '外观',
    lightModeSwitchTitle: '切换到浅色模式',
    darkModeSwitchTitle: '切换到深色模式',
    externalLinkIcon: true,
    footer: {
      copyright: `Copyright © ${new Date().getFullYear()} BKMPG`,
    },
  },
  transformHead({ pageData }): HeadConfig[] {
    const canonical = pageUrl(pageData.relativePath)
    const title = pageData.frontmatter.layout === 'home'
      ? 'BKMPG'
      : pageData.frontmatter.title || pageData.title || 'BKMPG'
    const description = pageData.frontmatter.description || 'Linux、VPS、开发工具与 AI 工具的实践笔记。'
    const ogType = isArticlePage(pageData.relativePath, pageData.frontmatter.listed) ? 'article' : 'website'

    return [
      ['link', { rel: 'canonical', href: canonical }],
      ['meta', { property: 'og:type', content: ogType }],
      ['meta', { property: 'og:locale', content: 'zh_CN' }],
      ['meta', { property: 'og:title', content: title }],
      ['meta', { property: 'og:description', content: description }],
      ['meta', { property: 'og:url', content: canonical }],
      ['meta', { name: 'twitter:card', content: 'summary' }],
    ]
  },
})
