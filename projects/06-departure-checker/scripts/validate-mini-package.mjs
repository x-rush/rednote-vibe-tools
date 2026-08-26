import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { extname, join, relative, resolve } from 'node:path'

const root = resolve(process.argv[2] ?? 'dist')
const allowedExtensions = new Set([
  '.html', '.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.woff', '.woff2', '.json',
])
const failures = []

const walk = (directory) => readdirSync(directory).flatMap((name) => {
  const path = join(directory, name)
  return statSync(path).isDirectory() ? walk(path) : [path]
})

if (!existsSync(root)) {
  failures.push(`构建目录不存在：${root}`)
} else {
  const files = walk(root)
  const relativeFiles = files.map((path) => relative(root, path).replaceAll('\\', '/'))
  const htmlFiles = relativeFiles.filter((path) => extname(path) === '.html')

  if (!relativeFiles.includes('index.html')) failures.push('index.html 不在包根目录')
  if (htmlFiles.length !== 1) failures.push(`HTML 入口数量应为 1，实际为 ${htmlFiles.length}`)

  for (const path of relativeFiles) {
    if (!allowedExtensions.has(extname(path).toLowerCase())) failures.push(`不支持的文件类型：${path}`)
    if (path.endsWith('.map') || path.includes('node_modules/') || path.includes('.git/')) {
      failures.push(`包内含开发文件：${path}`)
    }
  }

  const indexPath = join(root, 'index.html')
  if (existsSync(indexPath)) {
    const html = readFileSync(indexPath, 'utf8')
    const requiredHtml = [
      [/<!doctype html>/i, '缺少 DOCTYPE'],
      [/<html[^>]+lang=["']zh-CN["']/i, 'html.lang 必须为 zh-CN'],
      [/<meta[^>]+charset=["']?UTF-8/i, '缺少 UTF-8 charset'],
      [/name=["']viewport["'][^>]+width=device-width/i, 'viewport 缺少 width=device-width'],
      [/name=["']viewport["'][^>]+initial-scale=1\.0/i, 'viewport 缺少 initial-scale=1.0'],
      [/name=["']viewport["'][^>]+viewport-fit=cover/i, 'viewport 缺少 viewport-fit=cover'],
    ]
    for (const [pattern, message] of requiredHtml) {
      if (!pattern.test(html)) failures.push(message)
    }

    const forbiddenHtml = [
      [/<script(?![^>]+src=)[^>]*>/i, '禁止内联脚本'],
      [/<script[^>]+type=["']module["']/i, '脚本必须为经典脚本'],
      [/\son[a-z]+\s*=/i, '禁止行内事件处理器'],
      [/javascript\s*:/i, '禁止 javascript: URI'],
      [/<base\b/i, '禁止 base 标签'],
      [/<(?:iframe|object)\b/i, '禁止 iframe/object'],
      [/<meta[^>]+http-equiv=["']Content-Security-Policy["']/i, '禁止自建 CSP'],
      [/https?:\/\//i, '禁止外部网络资源'],
    ]
    for (const [pattern, message] of forbiddenHtml) {
      if (pattern.test(html)) failures.push(message)
    }

    const head = html.match(/<head>([\s\S]*?)<\/head>/i)?.[1] ?? ''
    if (/<script\b(?![^>]*\bdefer\b)[^>]*\bsrc=/i.test(head)) {
      failures.push('head 中的经典脚本必须使用 defer')
    }

    const referencedPaths = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/gi)].map((match) => match[1])
    for (const path of referencedPaths) {
      if (!path.startsWith('./')) failures.push(`资源必须使用 ./ 相对路径：${path}`)
      const cleanPath = path.replace(/^\.\//, '').split(/[?#]/)[0]
      if (cleanPath && !existsSync(join(root, cleanPath))) failures.push(`引用资源不存在：${path}`)
    }
  }

  const scripts = files.filter((path) => extname(path) === '.js').map((path) => readFileSync(path, 'utf8')).join('\n')
  const styles = [
    ...files.filter((path) => extname(path) === '.css').map((path) => readFileSync(path, 'utf8')),
    scripts,
  ].join('\n')
  const forbiddenScript = [
    [/\bimport\s*(?:\(|["'{*])/m, '禁止 import'],
    [/\bexport\s+(?:default|const|let|var|function|class|\{)/m, '禁止 export'],
    [/\bfetch\s*\(/, '禁止 fetch'],
    [/\bXMLHttpRequest\b/, '禁止 XMLHttpRequest'],
    [/\b(?:WebSocket|EventSource|RTCPeerConnection)\b/, '禁止实时联网 API'],
    [/navigator\.(?:geolocation|clipboard|bluetooth|usb|hid|serial|serviceWorker)/, '禁止受限 navigator API'],
    [/\b(?:SharedWorker|Worker|WebAssembly)\b/, '禁止 Worker/WebAssembly'],
    [/\beval\s*\(|\bnew\s+Function\b/, '禁止动态执行代码'],
    [/\bwindow\.(?:open|prompt)\s*\(/, '禁止新窗口或 prompt'],
  ]
  for (const [pattern, message] of forbiddenScript) {
    if (pattern.test(scripts)) failures.push(message)
  }

  if (!styles.includes('var(--safe-area-inset-bottom,env(safe-area-inset-bottom,0px))')) {
    failures.push('底部安全区未兼容模拟器变量与真机 env')
  }
  if (!/touch-action:\s*manipulation/.test(styles)) failures.push('缺少触摸 manipulation 适配')
}

if (failures.length > 0) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'))
  process.exit(1)
}

console.log(`小工具静态包校验通过：${root}`)
