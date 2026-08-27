import { readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { extname, join, relative } from 'node:path'
import { assertClassicScriptSource } from './minitool-contract.mjs'

const outputDirectory = new URL('../dist-minitool/', import.meta.url)
const entryPath = new URL('index.html', outputDirectory)
const allowedExtensions = new Set(['.html', '.css', '.js', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.woff', '.woff2', '.ttf', '.otf', '.json'])

async function listFiles(directory) {
  const entries = await readdir(directory)
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry)
    return (await stat(path)).isDirectory() ? listFiles(path) : [path]
  }))
  return nested.flat()
}

let html = await readFile(entryPath, 'utf8')
html = html.replace(/<script\s+type="module"\s+crossorigin\s+src="([^"]+)"><\/script>/g, '<script defer src="$1"></script>')
html = html.replace(/<script\s+type="module"\s+src="([^"]+)"><\/script>/g, '<script defer src="$1"></script>')
await writeFile(entryPath, html)

if (/type=["']module["']/.test(html)) throw new Error('小工具入口仍包含 ES Module 脚本')
if (!/viewport-fit=cover/.test(html)) throw new Error('小工具入口缺少安全区 viewport 配置')

const files = await listFiles(outputDirectory.pathname)
for (const file of files) {
  const extension = extname(file).toLowerCase()
  if (!allowedExtensions.has(extension)) {
    throw new Error(`小工具构建包含不允许的文件类型：${relative(outputDirectory.pathname, file)}`)
  }
}

const scripts = files.filter((file) => extname(file).toLowerCase() === '.js')
if (scripts.length !== 1) throw new Error(`小工具构建必须内联为一个经典脚本，当前为 ${scripts.length} 个`)
const scriptSource = (await Promise.all(scripts.map((file) => readFile(file, 'utf8')))).join('\n')
assertClassicScriptSource(scriptSource)
const forbiddenCapabilities = [
  ['网络请求', /\bfetch\s*\(/],
  ['动态执行', /\beval\s*\(|\bnew\s+Function\s*\(/],
  ['新窗口', /\bwindow\.open\s*\(/],
  ['网页分享', /\bnavigator\.share\s*\(/],
  ['Service Worker', /\bserviceWorker\b/],
  ['Web Worker', /\bnew\s+Worker\s*\(/],
  ['WebAssembly', /\bWebAssembly\b/],
]
for (const [label, pattern] of forbiddenCapabilities) {
  if (pattern.test(scriptSource)) throw new Error(`小工具构建包含禁用能力：${label}`)
}

if (/<a\b[^>]*\bdownload(?:=|\s|>)/i.test(html)) throw new Error('小工具入口包含 download 链接')

console.log(`小工具构建检查通过：${files.length} 个文件，入口为经典脚本`)
