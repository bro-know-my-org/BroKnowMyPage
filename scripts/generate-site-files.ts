import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { extname, join, relative, resolve } from 'node:path'
import { Feed } from 'feed'
import matter from 'gray-matter'

const root = resolve(import.meta.dirname, '..')
const docsRoot = join(root, 'docs')
const dist = join(docsRoot, '.vitepress', 'dist')
const siteUrl = (process.env.SITE_URL || 'https://bro-know-my.org').replace(/\/$/, '')

async function markdownFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name)
      return entry.isDirectory() ? markdownFiles(path) : extname(entry.name) === '.md' ? [path] : []
    }),
  )
  return nested.flat()
}

const feed = new Feed({
  title: 'BKMPG',
  description: 'Linux、VPS、开发工具与 AI 工具的实践笔记、教程和文档。',
  id: siteUrl,
  link: siteUrl,
  language: 'zh-CN',
  favicon: `${siteUrl}/favicon.svg`,
  copyright: `Copyright © ${new Date().getFullYear()} BKMPG`,
  updated: new Date(),
  feedLinks: { rss2: `${siteUrl}/rss.xml` },
})

const files = (
  await Promise.all(['blog', 'tutorials', 'docs'].map((directory) => markdownFiles(join(docsRoot, directory))))
).flat()

const articles = await Promise.all(
  files.map(async (file) => {
    const { data } = matter(await readFile(file, 'utf8'))
    const route = relative(docsRoot, file)
      .replace(/\\/g, '/')
      .replace(/(^|\/)index\.md$/, '$1')
      .replace(/\.md$/, '')
    return { file, data, url: new URL(route, `${siteUrl}/`).toString() }
  }),
)

articles
  .filter(({ data }) => data.listed !== false && data.title && data.date)
  .sort((a, b) => Date.parse(String(b.data.updated || b.data.date)) - Date.parse(String(a.data.updated || a.data.date)))
  .forEach(({ data, url }) => {
    feed.addItem({
      title: String(data.title),
      id: url,
      link: url,
      description: String(data.description || ''),
      date: new Date(data.updated || data.date),
      category: Array.isArray(data.tags) ? data.tags.map((tag: unknown) => ({ name: String(tag) })) : [],
    })
  })

await mkdir(dist, { recursive: true })
await Promise.all([
  writeFile(join(dist, 'rss.xml'), feed.rss2(), 'utf8'),
  writeFile(join(dist, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`, 'utf8'),
])

console.log(`已生成 RSS 和 robots.txt（${articles.filter(({ data }) => data.listed !== false).length} 篇内容）。`)
