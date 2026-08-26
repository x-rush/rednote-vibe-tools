import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, extname, join, resolve } from 'node:path'
import vm from 'node:vm'

const projectDir = resolve(import.meta.dirname, '..')
const distDir = join(projectDir, 'dist')
const errors = []
const allowedExtensions = new Set([
  '.html', '.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.woff', '.woff2', '.json',
])

function check(condition, message) {
  if (!condition) errors.push(message)
}

function listFiles(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name)
    return statSync(path).isDirectory() ? listFiles(path) : [path]
  })
}

check(existsSync(join(distDir, 'index.html')), 'dist/index.html must exist at the package root')

if (errors.length === 0) {
  const files = listFiles(distDir)
  const html = readFileSync(join(distDir, 'index.html'), 'utf8')
  const sourceReferences = [...html.matchAll(/\b(?:src|href)="([^"]+)"/g)].map((match) => match[1])
  const scriptReferences = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/g)].map((match) => match[1])
  const scriptContents = []

  check(/^<!doctype html>/i.test(html), 'index.html must declare a doctype')
  check(/<html\b[^>]*\blang="zh-CN"/i.test(html), 'index.html must use lang="zh-CN"')
  check(/<meta\b[^>]*\bcharset="UTF-8"/i.test(html), 'index.html must declare UTF-8')
  check(/name="viewport"[^>]*content="[^"]*width=device-width[^"]*initial-scale=1\.0[^"]*viewport-fit=cover/i.test(html), 'viewport must include width, initial scale, and viewport-fit=cover')
  check(!/\btype="module"/i.test(html), 'module scripts are forbidden')
  check(!/<script\b(?![^>]*\bsrc=)[^>]*>/i.test(html), 'inline scripts are forbidden')
  check(!/\bon\w+\s*=/i.test(html), 'inline event handlers are forbidden')
  check(!/<(?:base|iframe|object)\b/i.test(html), 'base, iframe, and object elements are forbidden')
  check(scriptReferences.length === 1, 'exactly one external classic entry script is required')

  for (const reference of sourceReferences) {
    if (reference.startsWith('data:') || reference.startsWith('#')) continue
    check(reference.startsWith('./'), `resource path must be relative: ${reference}`)
    check(!/^https?:\/\//i.test(reference), `external resource is forbidden: ${reference}`)
    check(existsSync(resolve(dirname(join(distDir, 'index.html')), reference)), `referenced resource is missing: ${reference}`)
  }

  for (const file of files) {
    const relative = file.slice(distDir.length + 1)
    check(allowedExtensions.has(extname(file).toLowerCase()), `unsupported package file: ${relative}`)
    check(!relative.endsWith('.map'), `source map is forbidden: ${relative}`)
  }

  for (const reference of scriptReferences) {
    const scriptPath = resolve(distDir, reference)
    if (!existsSync(scriptPath)) continue
    const script = readFileSync(scriptPath, 'utf8')
    scriptContents.push(script)
    try {
      new vm.Script(script, { filename: reference })
    } catch (error) {
      errors.push(`entry must parse as a classic script: ${error.message}`)
    }
    const forbiddenScriptPatterns = [
      ['fetch(', /\bfetch\s*\(/],
      ['XMLHttpRequest', /\bXMLHttpRequest\b/],
      ['navigator.connection', /\bnavigator\.connection\b/],
      ['WebSocket', /\bnew\s+WebSocket\s*\(/],
      ['Worker', /\bnew\s+(?:Shared)?Worker\s*\(/],
      ['Service Worker', /\bnavigator\.serviceWorker\b/],
      ['window.open', /\bwindow\.open\s*\(/],
      ['window.prompt', /\bwindow\.prompt\s*\(/],
      ['WebAssembly', /\bWebAssembly\./],
      ['eval', /\beval\s*\(/],
      ['new Function', /\bnew\s+Function\s*\(/],
    ]
    for (const [label, pattern] of forbiddenScriptPatterns) {
      check(!pattern.test(script), `forbidden runtime capability remains in entry script: ${label}`)
    }
  }

  const styleSources = [
    ...files.filter((file) => extname(file) === '.css').map((file) => readFileSync(file, 'utf8')),
    ...scriptContents,
  ].join('\n')
  check(styleSources.includes('var(--safe-area-inset-top,env(safe-area-inset-top,0px))'), 'top safe area must support the simulator CSS variable and env()')
  check(styleSources.includes('var(--safe-area-inset-bottom,env(safe-area-inset-bottom,0px))'), 'bottom safe area must support the simulator CSS variable and env()')
}

if (errors.length > 0) {
  for (const error of errors) console.error(`- ${error}`)
  process.exitCode = 1
} else {
  console.log('Mini-tool dist verification passed')
}
