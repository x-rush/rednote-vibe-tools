import type { SbtiContentPackage } from '../content/types'
import { restoreQuizProgress } from '../app/state'
import { generateResultSummary } from '../quiz/scoring'
import type { DimensionResult, QuizProgress, QuizResult } from '../quiz/types'

export const STORAGE_KEY = 'xhs-tool:sbti:state:v1'

export type StorageLike = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export type StoredQuizResult = {
  code: string
  completedAt: string
  contentVersion: string
  dimensions: DimensionResult[]
}

export type StoragePayload = {
  schemaVersion: 1
  quizVersion: string
  updatedAt: string
  data: {
    activeProgress?: QuizProgress
    recentResult?: StoredQuizResult
    settings: { muted: boolean; reducedMotion: boolean }
  }
}

export type StorageLoadResult =
  | { status: 'empty' }
  | { status: 'ready'; payload: StoragePayload }
  | { status: 'recovered'; reason: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function recover(storage: StorageLike, reason: string): StorageLoadResult {
  storage.removeItem(STORAGE_KEY)
  return { status: 'recovered', reason }
}

function validatePayload(value: unknown, content: SbtiContentPackage): StoragePayload {
  if (!isRecord(value) || !isRecord(value.data) || typeof value.quizVersion !== 'string' || typeof value.updatedAt !== 'string') throw new Error('fields')
  if (value.schemaVersion !== 1) throw new Error('schema')
  if (value.quizVersion !== content.contentVersion) throw new Error('quiz-version')
  const settings = value.data.settings
  if (!isRecord(settings) || typeof settings.muted !== 'boolean' || typeof settings.reducedMotion !== 'boolean') throw new Error('fields')
  if (value.data.activeProgress !== undefined) {
    if (!isRecord(value.data.activeProgress)) throw new Error('fields')
    try {
      restoreQuizProgress(value.data.activeProgress as QuizProgress, content)
    } catch {
      throw new Error('references')
    }
  }
  if (value.data.recentResult !== undefined) {
    const result = value.data.recentResult
    if (!isRecord(result) || typeof result.code !== 'string' || typeof result.completedAt !== 'string' || typeof result.contentVersion !== 'string' || !Array.isArray(result.dimensions)) throw new Error('fields')
    if (!content.content.resultTypes.some((type) => type.code === result.code)) throw new Error('references')
  }
  return value as StoragePayload
}

export function loadStorage(storage: StorageLike, content: SbtiContentPackage): StorageLoadResult {
  const stored = storage.getItem(STORAGE_KEY)
  if (stored === null) return { status: 'empty' }
  let parsed: unknown
  try {
    parsed = JSON.parse(stored)
  } catch {
    return recover(storage, '数据不是有效 JSON')
  }
  try {
    return { status: 'ready', payload: validatePayload(parsed, content) }
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'fields'
    if (reason === 'schema') return recover(storage, '不支持的存储版本')
    if (reason === 'quiz-version') return recover(storage, '题库版本不匹配')
    if (reason === 'references') return recover(storage, '存档引用的题目或选项已失效')
    return recover(storage, '字段缺失')
  }
}

export function saveStorage(storage: StorageLike, payload: StoragePayload, content: SbtiContentPackage) {
  const valid = validatePayload(payload, content)
  storage.setItem(STORAGE_KEY, JSON.stringify(valid))
}

export function clearStorage(storage: StorageLike) {
  storage.removeItem(STORAGE_KEY)
}

export function toStoredResult(result: QuizResult): StoredQuizResult {
  return { code: result.code, completedAt: result.completedAt, contentVersion: result.contentVersion, dimensions: result.summary.dimensions }
}

export function hydrateStoredResult(result: StoredQuizResult, content: SbtiContentPackage): QuizResult {
  return {
    code: result.code,
    completedAt: result.completedAt,
    contentVersion: result.contentVersion,
    summary: generateResultSummary(result.code, result.dimensions, content),
  }
}

