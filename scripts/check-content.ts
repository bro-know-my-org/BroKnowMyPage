import { readdir, readFile } from 'node:fs/promises'
import { extname, join, relative, resolve } from 'node:path'
import matter from 'gray-matter'

const root = resolve(import.meta.dirname, '..')
const docsRoot = join(root, 'docs')
const articleRoots = ['blog', 'tutorials', 'docs'].map((directory) => join(docsRoot, directory))
const errors: string[] = []
const seenRoutes = new Set<string>()

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

function report(file: string, message: string) {
  errors.push(`${relative(root, file)}: ${message}`)
}

for (const file of (await Promise.all(articleRoots.map(markdownFiles))).flat()) {
  const raw = await readFile(file, 'utf8')
  const { content, data } = matter(raw)

  if (/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(raw)) report(file, '检测到私钥内容')
  if (/^Password:\s*\S+/im.test(raw)) report(file, '检测到明文 Password 字段')
  if (/vless:\/\/(?!YOUR_UUID@|CDN_UUID@)[^\s`]+@/i.test(raw)) report(file, '检测到未占位的 VLESS 分享链接')
  if (/\b(?:ghp|github_pat)_[A-Za-z0-9_]{20,}\b/.test(raw)) report(file, '检测到疑似 GitHub Token')

  if (data.listed === false) continue

  const route = relative(docsRoot, file).replace(/\\/g, '/').replace(/\.md$/, '')
  if (seenRoutes.has(route)) report(file, `URL 重复：/${route}`)
  seenRoutes.add(route)

  for (const field of ['title', 'description', 'date', 'updated']) {
    if (!data[field]) report(file, `缺少 frontmatter.${field}`)
  }

  if (!Array.isArray(data.tags) || data.tags.length === 0) report(file, 'frontmatter.tags 必须是非空数组')
  if (Array.isArray(data.tags) && new Set(data.tags.map(String)).size !== data.tags.length) {
    report(file, 'frontmatter.tags 存在重复项')
  }
  if (data.description && String(data.description).length > 160) report(file, 'description 超过 160 个字符')

  for (const field of ['date', 'updated']) {
    if (data[field] && Number.isNaN(Date.parse(String(data[field])))) report(file, `${field} 不是有效日期`)
  }

  if (data.date && data.updated && Date.parse(String(data.updated)) < Date.parse(String(data.date))) {
    report(file, 'updated 不能早于 date')
  }

  let inFence = false
  let h1Count = 0
  let previousHeadingLevel = 0

  content.split('\n').forEach((line, index) => {
    const fence = line.match(/^```(.*)$/)
    if (fence) {
      if (!inFence && !fence[1]?.trim()) report(file, `第 ${index + 1} 行代码块未标注语言`)
      inFence = !inFence
      return
    }

    if (inFence) return

    const heading = line.match(/^(#{1,6})\s+\S/)
    if (!heading) return

    const level = heading[1].length
    if (level === 1) h1Count += 1
    if (previousHeadingLevel > 0 && level > previousHeadingLevel + 1) {
      report(file, `第 ${index + 1} 行标题从 H${previousHeadingLevel} 跳到 H${level}`)
    }
    previousHeadingLevel = level
  })

  if (inFence) report(file, '存在未闭合的代码块')
  if (h1Count !== 1) report(file, `正文必须且只能有一个 H1，当前为 ${h1Count} 个`)
}

if (errors.length > 0) {
  console.error(`内容检查失败（${errors.length} 项）：\n${errors.map((error) => `- ${error}`).join('\n')}`)
  process.exit(1)
}

console.log(`内容检查通过：${seenRoutes.size} 篇公开内容，格式正常，未发现敏感凭据。`)
