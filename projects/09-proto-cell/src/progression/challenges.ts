import { getContent, type EnvironmentId, type ModifierId } from '../content'

export type DishCodeValue = { seed: number; contentVersion: string; route: readonly EnvironmentId[] }
export type DishCodeIssue = { code: 'format' | 'checksum' | 'content-version' | 'invalid-payload'; message: string }
export type DishCodeResult = { value?: DishCodeValue; issues: DishCodeIssue[] }

export function dailySeed(date: Date, contentVersion: string): number {
  const localDate = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-')
  return hash32(`${localDate}|${contentVersion}`)
}

export function encodeDishCode(value: DishCodeValue): string {
  if (!isLegalRoute(value.route)) throw new RangeError('dish route must contain one layer-one and one layer-two environment')
  const payload = JSON.stringify({ v: value.contentVersion, s: value.seed >>> 0, r: value.route })
  const encoded = encodeBase64Url(new TextEncoder().encode(payload))
  const checksum = hash32(payload).toString(36).toUpperCase().padStart(7, '0')
  return `PC1.${encoded}.${checksum}`
}

export function decodeDishCode(code: string): DishCodeResult {
  const parts = code.trim().split('.')
  if (parts.length !== 3 || parts[0] !== 'PC1') return issue('format', '培养皿码格式不正确。')
  try {
    const payload = new TextDecoder().decode(decodeBase64Url(parts[1]!))
    if (hash32(payload).toString(36).toUpperCase().padStart(7, '0') !== parts[2]) return issue('checksum', '培养皿码校验失败。')
    const parsed: unknown = JSON.parse(payload)
    if (!isRecord(parsed) || typeof parsed.v !== 'string' || !Number.isInteger(parsed.s) || Number(parsed.s) < 0 || Number(parsed.s) > 0xffffffff || !Array.isArray(parsed.r) || !isLegalRoute(parsed.r)) {
      return issue('invalid-payload', '培养皿码内容不完整。')
    }
    if (parsed.v !== getContent().contentVersion) return issue('content-version', '培养皿码来自其他内容版本。')
    return { value: { seed: Number(parsed.s), contentVersion: parsed.v, route: parsed.r as EnvironmentId[] }, issues: [] }
  } catch {
    return issue('invalid-payload', '培养皿码无法解读。')
  }
}

function isLegalRoute(route: readonly unknown[]): route is [EnvironmentId, EnvironmentId] {
  return route.length === 2
    && (route[0] === 'env-algae-glow' || route[0] === 'env-acid-vesicle')
    && (route[1] === 'env-fiber-maze' || route[1] === 'env-antibody-storm')
}

export type ModifierApplication = {
  activeIds: ModifierId[]
  difficultyWeight: number
  rewardMultiplier: number
  telegraphLeadMs: number
  rules: Record<string, boolean | number>
  issues: Array<{ code: 'unknown-modifier' | 'excluded-pair'; modifierId: string; message: string }>
}

export function applyModifiers(ids: readonly string[], options: { baseTelegraphLeadMs: number }): ModifierApplication {
  const content = getContent()
  const activeIds: ModifierId[] = []
  const issues: ModifierApplication['issues'] = []
  for (const id of new Set(ids)) {
    const definition = content.modifiers.find((item) => item.id === id)
    if (!definition) {
      issues.push({ code: 'unknown-modifier', modifierId: id, message: '未知挑战词缀。' })
      continue
    }
    const conflict = activeIds.find((activeId) => {
      const active = content.modifiers.find((item) => item.id === activeId)!
      return definition.excludes.includes(activeId) || active.excludes.includes(definition.id)
    })
    if (conflict) {
      issues.push({ code: 'excluded-pair', modifierId: definition.id, message: `${definition.id} 与 ${conflict} 互斥。` })
      continue
    }
    activeIds.push(definition.id)
  }
  const active = activeIds.map((id) => content.modifiers.find((item) => item.id === id)!)
  return {
    activeIds,
    difficultyWeight: active.reduce((sum, item) => sum + item.difficultyWeight, 0),
    rewardMultiplier: active.reduce((product, item) => product * item.rewardMultiplier, 1),
    telegraphLeadMs: options.baseTelegraphLeadMs,
    rules: Object.fromEntries(active.map((item) => [item.behaviorId, true])),
    issues,
  }
}

function issue(code: DishCodeIssue['code'], message: string): DishCodeResult {
  return { value: undefined, issues: [{ code, message }] }
}

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
function encodeBase64Url(bytes: Uint8Array): string {
  let output = ''
  for (let index = 0; index < bytes.length; index += 3) {
    const value = (bytes[index]! << 16) | ((bytes[index + 1] ?? 0) << 8) | (bytes[index + 2] ?? 0)
    output += BASE64[(value >>> 18) & 63] + BASE64[(value >>> 12) & 63]
    if (index + 1 < bytes.length) output += BASE64[(value >>> 6) & 63]
    if (index + 2 < bytes.length) output += BASE64[value & 63]
  }
  return output
}

function decodeBase64Url(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new TypeError('invalid base64url')
  const bytes: number[] = []
  for (let index = 0; index < value.length; index += 4) {
    const chars = Array.from(value.slice(index, index + 4), (char) => BASE64.indexOf(char))
    if (chars.some((item) => item < 0)) throw new TypeError('invalid base64url')
    const bits = (chars[0]! << 18) | (chars[1]! << 12) | ((chars[2] ?? 0) << 6) | (chars[3] ?? 0)
    bytes.push((bits >>> 16) & 255)
    if (chars.length > 2) bytes.push((bits >>> 8) & 255)
    if (chars.length > 3) bytes.push(bits & 255)
  }
  return new Uint8Array(bytes)
}

function hash32(value: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
