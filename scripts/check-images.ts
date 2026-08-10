import { access, readdir, readFile, stat } from 'node:fs/promises'
import { dirname, extname, join, relative, resolve } from 'node:path'
import sharp from 'sharp'

const root = resolve(import.meta.dirname, '..')
const docsRoot = join(root, 'docs')
const rasterExtensions = new Set(['.avif', '.gif', '.jpeg', '.jpg', '.png', '.webp'])
const ignoredDirectories = new Set(['.vitepress'])
const maxBytes = 500 * 1024
const maxWidth = 1920
const errors: string[] = []

async function filesIn(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(
    entries
      .filter((entry) => !ignoredDirectories.has(entry.name))
      .map((entry) => {
        const path = join(directory, entry.name)
        return entry.isDirectory() ? filesIn(path) : [path]
      }),
  )
  return nested.flat()
}

function report(file: string, message: string) {
  errors.push(`${relative(root, file)}: ${message}`)
}

function contentWithoutFencedCode(content: string): string {
  let fence: string | undefined
  return content
    .split('\n')
    .map((line) => {
      const marker = line.match(/^\s*(```+|~~~+)/)?.[1]
      if (marker) {
        if (!fence) fence = marker[0]
        else if (marker[0] === fence) fence = undefined
        return ''
      }
      return fence ? '' : line
    })
    .join('\n')
}

function localImagePath(markdownFile: string, rawTarget: string): string | undefined {
  if (/^(?:[a-z]+:|#)/i.test(rawTarget)) return undefined

  const withoutQuery = rawTarget.split(/[?#]/, 1)[0]
  let pathname: string
  try {
    pathname = decodeURIComponent(withoutQuery)
  } catch {
    report(markdownFile, `图片路径无法解码：${rawTarget}`)
    return undefined
  }

  return pathname.startsWith('/')
    ? join(docsRoot, 'public', pathname.slice(1))
    : resolve(dirname(markdownFile), pathname)
}

async function checkReference(markdownFile: string, target: string) {
  const path = localImagePath(markdownFile, target)
  if (!path) return

  if (!path.startsWith(`${docsRoot}/`)) {
    report(markdownFile, `本地图片不能位于 docs 之外：${target}`)
    return
  }

  try {
    await access(path)
  } catch {
    report(markdownFile, `找不到本地图片：${target}`)
  }
}

const files = await filesIn(docsRoot)
const images = files.filter((file) => rasterExtensions.has(extname(file).toLowerCase()))
const markdownFiles = files.filter((file) => extname(file).toLowerCase() === '.md')

for (const file of images) {
  const info = await stat(file)
  if (info.size > maxBytes) report(file, `文件为 ${(info.size / 1024).toFixed(1)} KiB，超过 500 KiB`)

  try {
    const metadata = await sharp(file, { animated: true }).metadata()
    if (metadata.width && metadata.width > maxWidth) report(file, `宽度为 ${metadata.width}px，超过 ${maxWidth}px`)
    if (metadata.exif || metadata.iptc || metadata.xmp) report(file, '仍包含 EXIF、IPTC 或 XMP 元数据')
  } catch (error) {
    report(file, `无法读取图片：${error instanceof Error ? error.message : String(error)}`)
  }
}

for (const file of markdownFiles) {
  const content = contentWithoutFencedCode(await readFile(file, 'utf8'))
  const markdownImages = content.matchAll(/!\[([^\]]*)\]\((?:<([^>]+)>|([^\s)]+))(?:\s+["'][^"']*["'])?\)/g)

  for (const match of markdownImages) {
    if (!match[1].trim()) report(file, 'Markdown 图片缺少 alt 文本')
    await checkReference(file, match[2] || match[3])
  }

  const htmlImages = content.matchAll(/<img\b([^>]*)>/gi)
  for (const match of htmlImages) {
    const attributes = match[1]
    const alt = attributes.match(/\balt=["']([^"']*)["']/i)?.[1]
    const src = attributes.match(/\bsrc=["']([^"']+)["']/i)?.[1]
    if (!alt?.trim()) report(file, 'HTML 图片缺少非空 alt 属性')
    if (src) await checkReference(file, src)
  }
}

if (errors.length > 0) {
  console.error(`图片检查失败（${errors.length} 项）：\n${errors.map((error) => `- ${error}`).join('\n')}`)
  process.exit(1)
}

console.log(`图片检查通过：${images.length} 张本地图片，${markdownFiles.length} 个 Markdown 文件。`)
