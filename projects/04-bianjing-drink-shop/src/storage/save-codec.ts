import type { ShopContent } from '../content/schema'
import type { GameState, SavePayload } from '../domain/types'

export type SaveRecoveryResult =
  | { status: 'ok'; payload: SavePayload }
  | { status: 'recovered-previous'; payload: SavePayload; reason: string }
  | { status: 'future-version'; reason: string }
  | { status: 'invalid'; reason: string }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function containsUnsafe(value: unknown): boolean {
  if (typeof value === 'string') return /data:[^;]+;base64,/i.test(value)
  if (Array.isArray(value)) return value.some(containsUnsafe)
  if (isRecord(value)) return Object.entries(value).some(([key, item]) => /blob|base64|image/i.test(key) || containsUnsafe(item))
  return false
}

function validState(value: unknown, content: ShopContent): value is GameState {
  if (!isRecord(value) || containsUnsafe(value)) return false
  const numeric = ['day', 'money', 'reputation', 'energy', 'relationships', 'negativeProfitStreak']
  if (numeric.some((key) => typeof value[key] !== 'number' || !Number.isFinite(value[key]))) return false
  if (typeof value.saveId !== 'string' || typeof value.seed !== 'string' || !isRecord(value.rngState) || typeof value.rngState.value !== 'number') return false
  if (!isRecord(value.inventory) || !isRecord(value.prices)) return false
  const productIds = new Set(content.drinks.map((product) => product.productId))
  if (Object.keys(value.inventory).some((id) => !productIds.has(id))) return false
  if (Object.values(value.inventory).some((quantity) => typeof quantity !== 'number' || quantity < 0 || !Number.isFinite(quantity))) return false
  if (!Array.isArray(value.flags) || value.flags.length > 500 || value.flags.some((flag) => typeof flag !== 'string')) return false
  if (!Array.isArray(value.eventHistory) || value.eventHistory.length > 500) return false
  if (!Array.isArray(value.decisionSummaries) || value.decisionSummaries.length > 200) return false
  if (!Array.isArray(value.unlockedProductIds) || value.unlockedProductIds.some((id) => typeof id !== 'string' || !productIds.has(id))) return false
  return true
}

function bounded(payload: SavePayload): SavePayload {
  const boundState = (state: GameState): GameState => ({
    ...state,
    eventHistory: state.eventHistory.slice(-120),
    decisionSummaries: state.decisionSummaries.slice(-30),
    flags: state.flags.slice(-500),
  })
  return {
    ...payload,
    current: boundState(payload.current),
    previousDay: payload.previousDay ? boundState(payload.previousDay) : undefined,
  }
}

export function encodeSave(payload: SavePayload): string {
  if (containsUnsafe(payload)) throw new Error('存档包含禁止的媒体或 Base64 数据')
  return JSON.stringify(bounded(payload))
}

export function decodeSave(raw: string, content: ShopContent): SaveRecoveryResult {
  let value: unknown
  try { value = JSON.parse(raw) } catch { return { status: 'invalid', reason: '存档 JSON 已损坏' } }
  if (!isRecord(value)) return { status: 'invalid', reason: '存档外壳无效' }
  if (typeof value.schemaVersion === 'number' && value.schemaVersion > 1) return { status: 'future-version', reason: '存档来自更高版本' }
  if (value.schemaVersion !== 1 || typeof value.id !== 'string' || typeof value.contentVersion !== 'string' || typeof value.updatedAt !== 'string') {
    return { status: 'invalid', reason: '存档版本或必填字段无效' }
  }
  const base = value as unknown as SavePayload
  if (validState(value.current, content)) return { status: 'ok', payload: bounded(base) }
  if (validState(value.previousDay, content)) {
    const recovered = bounded({ ...base, current: value.previousDay, previousDay: undefined } as SavePayload)
    return { status: 'recovered-previous', payload: recovered, reason: '当前快照损坏，已恢复上一日' }
  }
  return { status: 'invalid', reason: '当前与上一日快照均不可恢复' }
}
