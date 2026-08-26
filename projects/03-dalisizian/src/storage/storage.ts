import type { CaseRuntimeState, ContentIndex, HanziCase, ScreenState } from '../content/types'
import { createInitialCaseState } from '../game/engine'
import type {
  BestEvaluation,
  CaseRecordName,
  CaseRecordStore,
  EvaluationRating,
  LoadResult,
  ProjectSaveData,
  ResilientRead,
  ResilientWrite,
  StorageLike,
  StoredEnvelope,
  WriteResult,
} from './types'

export const STORAGE_KEY = 'xhs-tool:dalisizian:state:v1'
const FALLBACK_RECORD_KEY = 'xhs-tool:dalisizian:records:v1'
const SCHEMA_VERSION = 1
const validRatings = new Set<EvaluationRating>(['明镜高悬', '慎思明辨', '案牍清通', '重审有得'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function uniqueValid(values: unknown, validIds: Set<string>, limit: number): string[] {
  if (!Array.isArray(values)) return []
  return [...new Set(values.filter((value): value is string => typeof value === 'string' && validIds.has(value)))].slice(0, limit)
}

function containsForbiddenMedia(value: unknown, seen = new Set<object>()): boolean {
  if (typeof value === 'string') return /data:[^;]+;base64,/i.test(value)
  if (typeof Blob !== 'undefined' && value instanceof Blob) return true
  if (!value || typeof value !== 'object') return false
  if (seen.has(value)) return true
  seen.add(value)
  if (Array.isArray(value)) return value.some((item) => containsForbiddenMedia(item, seen))
  return Object.values(value).some((item) => containsForbiddenMedia(item, seen))
}

export function createDefaultSave(firstCaseId: string): ProjectSaveData {
  return {
    unlockedCaseIds: [firstCaseId],
    completedCaseIds: [],
    bestRatings: {},
    settings: { muted: false, reducedMotion: false },
  }
}

export function saveLauncher(
  storage: StorageLike,
  data: ProjectSaveData,
  contentVersion: string,
  updatedAt = new Date().toISOString(),
): WriteResult {
  if (containsForbiddenMedia(data)) return { ok: false, issue: '存档包含禁止的媒体或循环值。' }
  const envelope: StoredEnvelope<ProjectSaveData> = { schemaVersion: SCHEMA_VERSION, contentVersion, updatedAt, data }
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(envelope))
    return { ok: true }
  } catch {
    return { ok: false, issue: '浏览器未能写入本地存档。' }
  }
}

export function loadSave(storage: StorageLike, index: ContentIndex, contentVersion: string): LoadResult<ProjectSaveData> {
  const orderedCases = [...index.cases.values()].sort((a, b) => a.order - b.order)
  const firstCaseId = orderedCases[0]?.caseId ?? 'case-home-roof-pig'
  const fallback = createDefaultSave(firstCaseId)
  let raw: string | null
  try {
    raw = storage.getItem(STORAGE_KEY)
  } catch {
    return { data: fallback, recovered: true, issue: '本地存储不可访问，已使用安全初始状态。' }
  }
  if (!raw) return { data: fallback, recovered: false }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { data: fallback, recovered: true, issue: '存档 JSON 已损坏，原数据未被覆盖。' }
  }
  if (!isRecord(parsed) || parsed.schemaVersion !== SCHEMA_VERSION || !isRecord(parsed.data)) {
    return { data: fallback, recovered: true, issue: '存档版本或字段形状不受支持，原数据未被覆盖。' }
  }

  const source = parsed.data
  const validCaseIds = new Set(index.cases.keys())
  const unlocked = uniqueValid(source.unlockedCaseIds, validCaseIds, validCaseIds.size)
  const completed = uniqueValid(source.completedCaseIds, validCaseIds, validCaseIds.size)
  const currentCaseId = typeof source.currentCaseId === 'string' && validCaseIds.has(source.currentCaseId) ? source.currentCaseId : undefined
  const bestRatings: Record<string, BestEvaluation> = {}
  if (isRecord(source.bestRatings)) {
    Object.entries(source.bestRatings).forEach(([caseId, value]) => {
      if (!validCaseIds.has(caseId) || !isRecord(value)) return
      if (typeof value.score !== 'number' || typeof value.rating !== 'string' || !validRatings.has(value.rating as EvaluationRating) || typeof value.completedAt !== 'string') return
      bestRatings[caseId] = { score: Math.max(0, Math.min(100, value.score)), rating: value.rating as EvaluationRating, completedAt: value.completedAt }
    })
  }
  const settings = isRecord(source.settings) ? {
    muted: source.settings.muted === true,
    reducedMotion: source.settings.reducedMotion === true,
  } : fallback.settings
  const data: ProjectSaveData = {
    ...(currentCaseId ? { currentCaseId } : {}),
    unlockedCaseIds: unlocked.length ? unlocked : [firstCaseId],
    completedCaseIds: completed,
    bestRatings,
    settings,
  }
  const recovered = parsed.contentVersion !== contentVersion
    || currentCaseId !== source.currentCaseId
    || data.unlockedCaseIds.length !== (Array.isArray(source.unlockedCaseIds) ? source.unlockedCaseIds.length : 0)
    || data.completedCaseIds.length !== (Array.isArray(source.completedCaseIds) ? source.completedCaseIds.length : 0)
    || Object.keys(data.bestRatings).length !== (isRecord(source.bestRatings) ? Object.keys(source.bestRatings).length : 0)
  return { data, recovered, ...(recovered ? { issue: '存档已按当前内容版本移除失效或重复引用。' } : {}) }
}

export function recordCaseCompletion(
  save: ProjectSaveData,
  caseId: string,
  rating: EvaluationRating,
  score: number,
  unlockedCaseId: string | undefined,
  completedAt: string,
  index: ContentIndex,
): ProjectSaveData {
  if (!index.cases.has(caseId)) return save
  const previous = save.bestRatings[caseId]
  const nextBest = !previous || score > previous.score ? { rating, score, completedAt } : previous
  const validUnlock = unlockedCaseId && index.cases.has(unlockedCaseId) ? unlockedCaseId : undefined
  return {
    ...save,
    completedCaseIds: [...new Set([...save.completedCaseIds, caseId])],
    unlockedCaseIds: [...new Set([...save.unlockedCaseIds, ...(validUnlock ? [validUnlock] : [])])],
    bestRatings: { ...save.bestRatings, [caseId]: nextBest },
  }
}

export function restoreCaseProgress(
  value: unknown,
  caseData: HanziCase,
  index: ContentIndex,
): LoadResult<CaseRuntimeState> {
  const fallback = createInitialCaseState(caseData)
  if (!isRecord(value) || value.caseId !== caseData.caseId || typeof value.currentNodeId !== 'string') {
    return { data: fallback, recovered: true, issue: '案件进度字段损坏，已只重开当前案件。' }
  }
  const currentNode = index.nodes.get(value.currentNodeId)
  if (!currentNode || currentNode.caseId !== caseData.caseId) {
    return { data: fallback, recovered: true, issue: '当前节点已失效，已只重开当前案件。' }
  }

  const clueIds = new Set(caseData.clues.map((item) => item.id))
  const evidenceIds = new Set(caseData.evidenceIds)
  const sceneIds = new Set(caseData.scenes.map((item) => item.id))
  const nodeIds = new Set(caseData.nodeIds)
  const routeIds = new Set((caseData.investigationRoutes ?? []).map((item) => item.id))
  const deductions = new Map(caseData.deductions.map((item) => [item.id, new Set(item.options.map((option) => option.id))]))
  const flags: Record<string, boolean> = {}
  if (isRecord(value.flags)) Object.entries(value.flags).slice(0, 64).forEach(([key, item]) => { if (typeof item === 'boolean') flags[key] = item })
  const deductionAnswers: Record<string, string> = {}
  if (isRecord(value.deductionAnswers)) Object.entries(value.deductionAnswers).forEach(([key, item]) => {
    if (typeof item === 'string' && deductions.get(key)?.has(item)) deductionAnswers[key] = item
  })
  const firstDeductionAnswers: Record<string, string> = {}
  if (isRecord(value.firstDeductionAnswers)) Object.entries(value.firstDeductionAnswers).forEach(([key, item]) => {
    if (typeof item === 'string' && deductions.get(key)?.has(item)) firstDeductionAnswers[key] = item
  })
  const deductionAttempts: Record<string, number> = {}
  if (isRecord(value.deductionAttempts)) Object.entries(value.deductionAttempts).forEach(([key, item]) => {
    if (deductions.has(key) && typeof item === 'number' && Number.isInteger(item) && item > 0) deductionAttempts[key] = Math.min(item, 99)
  })
  const validScreens = new Set<ScreenState>(['landing', 'caseList', 'briefing', 'investigation', 'scene', 'dialogue', 'clueBook', 'evidenceDetail', 'deduction', 'verdict', 'ending', 'error'])
  const screen = typeof value.screen === 'string' && validScreens.has(value.screen as ScreenState) ? value.screen as ScreenState : 'investigation'
  const restored: CaseRuntimeState = {
    caseId: caseData.caseId,
    screen,
    currentNodeId: value.currentNodeId,
    ...(typeof value.currentSceneId === 'string' && sceneIds.has(value.currentSceneId) ? { currentSceneId: value.currentSceneId } : {}),
    flags,
    clueIds: uniqueValid(value.clueIds, clueIds, clueIds.size),
    evidenceIds: uniqueValid(value.evidenceIds, evidenceIds, evidenceIds.size),
    unlockedSceneIds: uniqueValid(value.unlockedSceneIds, sceneIds, sceneIds.size),
    visitedNodeIds: uniqueValid(value.visitedNodeIds, nodeIds, nodeIds.size),
    deductionAnswers,
    deductionAttempts,
    firstDeductionAnswers,
    reviewedRouteIds: uniqueValid(value.reviewedRouteIds, routeIds, routeIds.size),
    ...(typeof value.deductionFeedback === 'string' ? { deductionFeedback: value.deductionFeedback.slice(0, 320) } : {}),
    ...(value.initialVerdict === 'credible' || value.initialVerdict === 'partial' || value.initialVerdict === 'uncertain' || value.initialVerdict === 'myth' ? { initialVerdict: value.initialVerdict } : {}),
    ...(value.finalVerdict === 'credible' || value.finalVerdict === 'partial' || value.finalVerdict === 'uncertain' || value.finalVerdict === 'myth' ? { finalVerdict: value.finalVerdict } : {}),
    styleTags: Array.isArray(value.styleTags) ? [...new Set(value.styleTags.filter((item): item is string => typeof item === 'string' && item.length <= 20))].slice(0, 8) : [],
    completed: value.completed === true,
  }
  const recovered = JSON.stringify(restored) !== JSON.stringify(value)
  return { data: restored, recovered, ...(recovered ? { issue: '案件进度已移除失效、重复或超限字段。' } : {}) }
}

type FallbackRecords = Record<CaseRecordName, Record<string, unknown>>

function readFallback(storage: StorageLike): FallbackRecords {
  try {
    const raw = storage.getItem(FALLBACK_RECORD_KEY)
    if (!raw) return { caseProgress: {}, caseVerdicts: {} }
    const parsed = JSON.parse(raw) as unknown
    if (!isRecord(parsed) || !isRecord(parsed.caseProgress) || !isRecord(parsed.caseVerdicts)) return { caseProgress: {}, caseVerdicts: {} }
    return { caseProgress: parsed.caseProgress, caseVerdicts: parsed.caseVerdicts }
  } catch {
    return { caseProgress: {}, caseVerdicts: {} }
  }
}

function writeFallback(storage: StorageLike, records: FallbackRecords): void {
  if (containsForbiddenMedia(records)) throw new Error('forbidden media')
  storage.setItem(FALLBACK_RECORD_KEY, JSON.stringify(records))
}

export function createResilientCaseRecordStore(primary: CaseRecordStore, storage: StorageLike) {
  return {
    async get<T>(store: CaseRecordName, caseId: string): Promise<ResilientRead<T>> {
      try {
        return { value: await primary.get<T>(store, caseId), degraded: false }
      } catch {
        return { value: readFallback(storage)[store][caseId] as T | undefined, degraded: true, issue: 'IndexedDB 不可用，已从有限本地备份读取。' }
      }
    },
    async put<T>(store: CaseRecordName, caseId: string, value: T): Promise<ResilientWrite> {
      if (containsForbiddenMedia(value)) throw new Error('存档包含禁止媒体。')
      try {
        await primary.put(store, caseId, value)
        return { degraded: false }
      } catch {
        const records = readFallback(storage)
        records[store][caseId] = value
        const keys = Object.keys(records[store])
        while (keys.length > 8) {
          const oldest = keys.shift()
          if (oldest) delete records[store][oldest]
        }
        writeFallback(storage, records)
        return { degraded: true, issue: 'IndexedDB 不可用，已写入最多八案的有限本地备份。' }
      }
    },
    async delete(store: CaseRecordName, caseId: string): Promise<ResilientWrite> {
      try {
        await primary.delete(store, caseId)
        return { degraded: false }
      } catch {
        const records = readFallback(storage)
        delete records[store][caseId]
        writeFallback(storage, records)
        return { degraded: true, issue: 'IndexedDB 不可用，已删除本地备份记录。' }
      }
    },
    async clear(): Promise<ResilientWrite> {
      try {
        await primary.clear()
        storage.removeItem(FALLBACK_RECORD_KEY)
        return { degraded: false }
      } catch {
        storage.removeItem(FALLBACK_RECORD_KEY)
        return { degraded: true, issue: 'IndexedDB 不可用，已清除本地备份。' }
      }
    },
  }
}
