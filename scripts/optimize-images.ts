import { readdir, stat } from 'node:fs/promises'
import { extname, join, parse } from 'node:path'
import sharp from 'sharp'

const supportedExtensions = new Set(['.jpg', '.jpeg', '.png'])
const ignoredDirectories = new Set(['.git', '.vitepress', 'node_modules'])

interface Options {
  paths: string[]
  quality: number
  maxWidth: number
  lossless: boolean
  force: boolean
}

function usage(): never {
  console.error(`用法：pnpm image:optimize <文件或目录...> [选项]

选项：
  --lossless          使用 WebP 无损模式，适合带文字的 UI 截图
  --quality=<1-100>   有损 WebP 质量，默认 80
  --max-width=<px>    最大宽度，默认 1920，不放大小图
  --force             覆盖已存在的同名 .webp 文件`)
  process.exit(1)
}

function positiveInteger(value: string, name: string, maximum?: number): number {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0 || (maximum !== undefined && parsed > maximum)) {
    throw new Error(`${name} 必须是 1${maximum ? `-${maximum}` : ' 以上'}的整数`)
  }
  return parsed
}

function parseOptions(args: string[]): Options {
  const options: Options = {
    paths: [],
    quality: 80,
    maxWidth: 1920,
    lossless: false,
    force: false,
  }

  for (const arg of args) {
    if (arg === '--lossless') options.lossless = true
    else if (arg === '--force') options.force = true
    else if (arg.startsWith('--quality=')) options.quality = positiveInteger(arg.slice(10), 'quality', 100)
    else if (arg.startsWith('--max-width=')) options.maxWidth = positiveInteger(arg.slice(12), 'max-width')
    else if (arg.startsWith('--')) throw new Error(`未知选项：${arg}`)
    else options.paths.push(arg)
  }

  if (options.paths.length === 0) usage()
  return options
}

async function imageFiles(path: string): Promise<string[]> {
  const info = await stat(path)
  if (info.isFile()) return supportedExtensions.has(extname(path).toLowerCase()) ? [path] : []
  if (!info.isDirectory()) return []

  const entries = await readdir(path, { withFileTypes: true })
  const nested = await Promise.all(
    entries
      .filter((entry) => !ignoredDirectories.has(entry.name))
      .map((entry) => imageFiles(join(path, entry.name))),
  )
  return nested.flat()
}

function formatSize(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} KiB`
}

const options = parseOptions(process.argv.slice(2))
const files = [...new Set((await Promise.all(options.paths.map(imageFiles))).flat())]

if (files.length === 0) {
  console.log('没有找到可转换的 JPG 或 PNG 图片。')
  process.exit(0)
}

let converted = 0
let skipped = 0

for (const input of files) {
  const parsed = parse(input)
  const output = join(parsed.dir, `${parsed.name}.webp`)

  if (!options.force) {
    try {
      await stat(output)
      console.log(`跳过：${output} 已存在（使用 --force 覆盖）`)
      skipped += 1
      continue
    } catch {
      // Output does not exist yet.
    }
  }

  const before = (await stat(input)).size
  let pipeline = sharp(input).rotate().resize({ width: options.maxWidth, withoutEnlargement: true })
  pipeline = options.lossless
    ? pipeline.webp({ lossless: true, effort: 6 })
    : pipeline.webp({ quality: options.quality, smartSubsample: true, effort: 6 })

  await pipeline.toFile(output)
  const after = (await stat(output)).size
  const saving = before > 0 ? Math.round((1 - after / before) * 100) : 0
  console.log(`${input} → ${output}（${formatSize(before)} → ${formatSize(after)}，节省 ${saving}%）`)
  converted += 1
}

console.log(`图片处理完成：转换 ${converted} 张，跳过 ${skipped} 张。原图不会自动删除。`)
