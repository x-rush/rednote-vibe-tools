import type { CaseRuntimeState, CaseVerdict } from '../content/types'

export type EvaluationRating = '明镜高悬' | '慎思明辨' | '案牍清通' | '重审有得'

export type BestEvaluation = {
  rating: EvaluationRating
  score: number
  completedAt: string
}

export type ProjectSaveData = {
  currentCaseId?: string
  unlockedCaseIds: string[]
  completedCaseIds: string[]
  bestRatings: Record<string, BestEvaluation>
  settings: {
    muted: boolean
    reducedMotion: boolean
  }
}

export type StoredEnvelope<T> = {
  schemaVersion: 1
  contentVersion: string
  updatedAt: string
  data: T
}

export type LoadResult<T> = {
  data: T
  recovered: boolean
  issue?: string
}

export type WriteResult = {
  ok: boolean
  issue?: string
}

export type StorageLike = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export type CaseRecordName = 'caseProgress' | 'caseVerdicts'

export type CaseVerdictRecord = {
  caseId: string
  initialVerdict?: CaseVerdict
  finalVerdict?: CaseVerdict
  officialVerdict: CaseVerdict
  score: number
  rating: EvaluationRating
  completedAt: string
  clueCount?: number
  evidenceCount?: number
}

export type CaseRecordStore = {
  get<T>(store: CaseRecordName, caseId: string): Promise<T | undefined>
  put<T>(store: CaseRecordName, caseId: string, value: T): Promise<void>
  delete(store: CaseRecordName, caseId: string): Promise<void>
  clear(): Promise<void>
}

export type ResilientRead<T> = {
  value?: T
  degraded: boolean
  issue?: string
}

export type ResilientWrite = {
  degraded: boolean
  issue?: string
}

export type StoredCaseProgress = CaseRuntimeState
