import { readdir, readFile } from 'node:fs/promises'
import { extname, join, relative, resolve } from 'node:path'
import matter from 'gray-matter'

interface SitemapItemLike {
  url: string
  lastmod?: string | number | Date
  lastmodfile?: unknown
  lastmodISO?: string
  lastmodrealtime?: boolean
}

const docsRoot = resolve(import.meta.dirname, '..')
const excludedRoutes = /(^|\/)(?:404|blog\/archive\/old-site-links|tutorials\/vps\/vless-reality-cloudflare-cdn)(?:\.html)?$/

async function markdownFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(
    entries
      .filter((entry) => entry.name !== '.vitepress')
      .map((entry) => {
        const path = join(directory, entry.name)
        return entry.isDirectory() ? markdownFiles(path) : extname(entry.name) === '.md' ? [path] : []
      }),
  )
  return nested.flat()
}

function pageRoute(file: string): string {
  const route = relative(docsRoot, file)
    .replace(/\\/g, '/')
    .replace(/(^|\/)index\.md$/, '$1')
    .replace(/\.md$/, '')

  return `/${route}`
}

function sitemapRoute(url: string): string {
  return new URL(url, 'https://bkmpg.invalid/').pathname.replace(/\.html$/, '')
}

async function contentDates(): Promise<Map<string, string>> {
  const dates = new Map<string, string>()

  await Promise.all(
    (await markdownFiles(docsRoot)).map(async (file) => {
      const { data } = matter(await readFile(file, 'utf8'))
      const value = data.updated || data.date
      if (!value) return

      const timestamp = Date.parse(String(value))
      if (!Number.isNaN(timestamp)) dates.set(pageRoute(file), new Date(timestamp).toISOString())
    }),
  )

  return dates
}

export async function transformSitemapItems<T extends SitemapItemLike>(items: T[]): Promise<T[]> {
  const dates = await contentDates()

  return items
    .filter((item) => !excludedRoutes.test(item.url))
    .map((item) => {
      const next = { ...item }
      delete next.lastmod
      delete next.lastmodfile
      delete next.lastmodISO
      delete next.lastmodrealtime

      const lastmod = dates.get(sitemapRoute(item.url))
      if (lastmod) next.lastmod = lastmod
      return next
    })
}
