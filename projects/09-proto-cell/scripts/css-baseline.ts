import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const postcss = createRequire(require.resolve('vite/package.json'))('postcss')

function args(value: string): string[] {
  let depth = 0, start = 0
  const result: string[] = []
  for (let i = 0; i < value.length; i++) {
    if (value[i] === '(') depth++
    if (value[i] === ')') depth--
    if (value[i] === ',' && depth === 0) { result.push(value.slice(start, i).trim()); start = i + 1 }
  }
  result.push(value.slice(start).trim()); return result
}
function fallback(value: string): string {
  const match = /\b(min|max|clamp|env|color-mix)\(/.exec(value)
  if (!match) return value
  let end = match.index + match[0].length, depth = 1
  while (end < value.length && depth) { if (value[end] === '(') depth++; if (value[end] === ')') depth--; end++ }
  const values = args(value.slice(match.index + match[0].length, end - 1))
  const selected = match[1] === 'env' ? values[1] ?? '0px' : match[1] === 'clamp' || match[1] === 'color-mix' ? values[1] : values[0]
  return value.slice(0, match.index) + fallback((selected ?? '0px').replace(/\s+\d+(?:\.\d+)?%$/, '')) + fallback(value.slice(end))
}
export function baselineCss(source: string): string {
  const root = postcss.parse(source), rules: any[] = []
  root.walkRules((rule: any) => { rules.push(rule) })
  for (const rule of rules) {
    let tail = rule
    const declarations = rule.nodes.slice()
    for (const decl of declarations) {
      if (decl.type !== 'decl') continue
      const functions = Array.from(decl.value.matchAll(/\b(min|max|clamp|env|color-mix)\(/g), (match: RegExpMatchArray) => match[1])
      if (functions.length) {
        const probes: Record<string, string> = { min: '(width: min(1px, 2px))', max: '(width: max(1px, 2px))', clamp: '(width: clamp(1px, 2px, 3px))', env: '(top: env(safe-area-inset-top))', 'color-mix': '(color: color-mix(in srgb, red, blue))' }
        const enhanced = postcss.atRule({ name: 'supports', params: [...new Set(functions)].map((name) => probes[name as string]).join(' and ') })
        enhanced.append(rule.clone({ nodes: [] }).append(decl.clone()))
        decl.value = fallback(decl.value)
        rule.parent.insertAfter(tail, enhanced); tail = enhanced
      }
      if (decl.prop === 'gap' || decl.prop === 'row-gap' || decl.prop === 'column-gap') decl.cloneBefore({ prop: decl.prop === 'gap' ? 'grid-gap' : 'grid-' + decl.prop })
    }
  }
  return root.toString()
}
