import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { extname, join, relative, resolve, sep } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const allowedExtensions = new Set(['.html', '.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.woff', '.woff2', '.json'])
const maxPackageBytes = 10 * 1024 * 1024

const forbiddenJavaScript = [
  ['network fetch', /\bfetch\s*\(/],
  ['XMLHttpRequest', /\bXMLHttpRequest\b/],
  ['WebSocket', /\bnew\s+WebSocket\s*\(/],
  ['EventSource', /\bnew\s+EventSource\s*\(/],
  ['WebRTC', /\bnew\s+RTCPeerConnection\s*\(/],
  ['geolocation', /navigator\.geolocation\b/],
  ['clipboard', /navigator\.clipboard\b|document\.execCommand\s*\(\s*['"](?:copy|cut|paste)/],
  ['hardware connection', /navigator\.(?:bluetooth|usb|hid|serial)\b/],
  ['device information', /navigator\.(?:getBattery|connection|credentials|locks)\b/],
  ['device enumeration', /navigator\.mediaDevices\.(?:enumerateDevices|getDisplayMedia)\b/],
  ['persistent storage', /navigator\.storage\.persist\b/],
  ['service worker', /navigator\.serviceWorker\b/],
  ['worker', /\bnew\s+(?:SharedWorker|Worker)\s*\(/],
  ['sensor', /\b(?:Accelerometer|Gyroscope|Magnetometer|DeviceMotionEvent|DeviceOrientationEvent)\b/],
  ['fullscreen', /\b(?:requestFullscreen|webkitRequestFullscreen)\b/],
  ['dynamic code', /\beval\s*\(|\bnew\s+Function\b|\bWebAssembly\b/],
  ['Node environment variable', /\bprocess\.env\b/],
  ['new window', /\bwindow\.(?:open|prompt)\s*\(/],
  ['external navigation', /\blocation\.(?:href\s*=(?!=)|assign\s*\()/],
]

export function validateMinitoolPath(targetPath) {
  const target = resolve(targetPath)
  if (!existsSync(target)) throw new Error(`Minitool target does not exist: ${target}`)
  if (statSync(target).isDirectory()) return validateDirectory(target)
  if (extname(target).toLowerCase() !== '.zip') throw new Error(`Expected a directory or .zip file: ${target}`)
  return validateArchive(target)
}

function validateArchive(archivePath) {
  if (statSync(archivePath).size > maxPackageBytes) throw new Error('ZIP exceeds the 10MB container limit')
  const entries = run('unzip', ['-Z1', archivePath]).trim().split('\n').filter(Boolean)
  if (!entries.includes('index.html')) throw new Error('ZIP root does not contain index.html')
  if (entries.some((entry) => entry.startsWith('/') || entry.split('/').includes('..'))) throw new Error('ZIP contains an unsafe absolute or parent path')
  if (entries.some((entry) => !entry.endsWith('/') && !allowedExtensions.has(extname(entry).toLowerCase()))) throw new Error('ZIP contains an unsupported file type')
  if (entries.some((entry) => /(?:^|\/)(?:node_modules|\.git)(?:\/|$)|\.map$|\.DS_Store$/.test(entry))) throw new Error('ZIP contains development-only files')

  const extractionRoot = mkdtempSync(join(tmpdir(), 'earth-online-minitool-'))
  try {
    run('unzip', ['-qq', archivePath, '-d', extractionRoot])
    const result = validateDirectory(extractionRoot)
    return { ...result, archiveBytes: statSync(archivePath).size, entries: entries.length }
  } finally {
    rmSync(extractionRoot, { recursive: true, force: true })
  }
}

function validateDirectory(root) {
  const files = walk(root)
  const relativeFiles = files.map((file) => relative(root, file).split(sep).join('/'))
  const htmlFiles = relativeFiles.filter((file) => extname(file).toLowerCase() === '.html')
  if (!relativeFiles.includes('index.html')) throw new Error('index.html must exist at the package root')
  if (htmlFiles.length !== 1) throw new Error('The package must contain exactly one HTML entry')

  for (const file of relativeFiles) {
    const extension = extname(file).toLowerCase()
    if (!allowedExtensions.has(extension)) throw new Error(`Unsupported package file: ${file}`)
    if (/(?:^|\/)(?:node_modules|\.git)(?:\/|$)|\.map$|\.DS_Store$/.test(file)) throw new Error(`Development-only file found: ${file}`)
  }

  const indexSource = readFileSync(join(root, 'index.html'), 'utf8')
  requirePattern(indexSource, /<!doctype html>/i, 'index.html requires a doctype')
  requirePattern(indexSource, /<html\s+lang=["']zh-CN["']/i, 'index.html requires lang="zh-CN"')
  requirePattern(indexSource, /<meta\s+charset=["']UTF-8["']/i, 'index.html requires UTF-8 charset')
  requirePattern(indexSource, /<meta[^>]+name=["']viewport["'][^>]+content=["'][^"']*width=device-width[^"']*initial-scale=1\.0[^"']*viewport-fit=cover/i, 'viewport must include width, initial scale, and viewport-fit=cover')
  rejectPattern(indexSource, /<script\b(?![^>]*\bsrc=)[^>]*>/i, 'Inline script is forbidden')
  rejectPattern(indexSource, /<script\b[^>]*\btype=["']module["']/i, 'Module script is forbidden')
  rejectPattern(indexSource, /\bon\w+\s*=|javascript:/i, 'Inline event handlers and javascript: URLs are forbidden')
  rejectPattern(indexSource, /<base\b|<iframe\b|<object\b|<meta[^>]+http-equiv=["']Content-Security-Policy["']/i, 'base, iframe, object, and custom CSP are forbidden')
  rejectPattern(indexSource, /\btarget=["']_blank["']|\bdownload(?:\s|=|>)/i, 'External-window and download behavior is forbidden')

  const resourceReferences = [...indexSource.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)].map((match) => match[1])
  for (const reference of resourceReferences) {
    if (/^(?:https?:|\/)/i.test(reference)) throw new Error(`Resource path must be local and relative: ${reference}`)
    if (!reference.startsWith('./')) throw new Error(`Resource path must start with ./: ${reference}`)
    const resolvedReference = resolve(root, reference.split(/[?#]/)[0])
    if (!resolvedReference.startsWith(`${root}${sep}`) || !existsSync(resolvedReference)) throw new Error(`Referenced resource is missing: ${reference}`)
  }

  const javaScriptFiles = files.filter((file) => extname(file).toLowerCase() === '.js')
  if (javaScriptFiles.length !== 1) throw new Error('Minitool build must contain exactly one classic JavaScript bundle')
  const javaScript = javaScriptFiles.map((file) => readFileSync(file, 'utf8')).join('\n')
  rejectPattern(javaScript, /(^|[;}\n])\s*import\s*(?:\(|["'{*])/m, 'JavaScript import is forbidden')
  rejectPattern(javaScript, /(^|[;}\n])\s*export\s+/m, 'JavaScript export is forbidden')
  for (const [label, pattern] of forbiddenJavaScript) rejectPattern(javaScript, pattern, `Forbidden capability found: ${label}`)

  const css = files.filter((file) => extname(file).toLowerCase() === '.css').map((file) => readFileSync(file, 'utf8')).join('\n')
  rejectPattern(css, /url\(\s*["']?https?:/i, 'External CSS resource is forbidden')

  const totalBytes = files.reduce((sum, file) => sum + statSync(file).size, 0)
  if (totalBytes > maxPackageBytes) throw new Error('Uncompressed package exceeds the 10MB container limit')
  return { files: files.length, totalBytes }
}

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? walk(path) : [path]
  })
}

function requirePattern(source, pattern, message) {
  if (!pattern.test(source)) throw new Error(message)
}

function rejectPattern(source, pattern, message) {
  if (pattern.test(source)) throw new Error(message)
}

function run(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8' })
  if (result.status !== 0) throw new Error(`${command} failed: ${result.stderr || result.stdout}`)
  return result.stdout
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : ''
if (fileURLToPath(import.meta.url) === invokedPath) {
  try {
    const result = validateMinitoolPath(process.argv[2] ?? 'dist-minitool')
    console.log(`minitool-valid files=${result.files} bytes=${result.totalBytes}${result.archiveBytes ? ` zip=${result.archiveBytes}` : ''}`)
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
