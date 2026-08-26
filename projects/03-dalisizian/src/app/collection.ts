import type { CaseVerdict, ContentIndex, Difficulty } from '../content/types'
import type { CaseVerdictRecord, EvaluationRating, ProjectSaveData } from '../storage/types'
import { getVerdictLabel } from './viewModel'

export type CaseCollectionEntry = {
  caseId: string
  order: number
  title: string
  subtitle: string
  coreCharacter: string
  difficulty: Difficulty
  sceneAssetId?: string
  completed: boolean
  unlocked: boolean
  rating?: EvaluationRating
  score?: number
  completedAt?: string
  initialVerdict?: CaseVerdict
  finalVerdict?: CaseVerdict
  endingTitle?: string
  verdictReason?: string
  clueCount?: number
  evidenceCount?: number
  detailRecovered: boolean
  story?: {
    rumor: string
    summary: string
    chapters: Array<{ id: string; title: string; summary: string; category: string }>
    verdictReason: string
    uncertainty: string
    closingText: string
  }
}

export type CollectionStoryModel = {
  caseId: string
  caseNumber: string
  title: string
  subtitle: string
  coreCharacter: string
  difficulty: Difficulty
  sceneAssetId?: string
  rumor: string
  summary: string
  chapters: Array<{ id: string; title: string; summary: string; category: string }>
  initialVerdictLabel: string
  finalVerdictLabel: string
  verdictReason: string
  uncertainty: string
  closingText: string
  rating?: EvaluationRating
  score?: number
  dateLabel?: string
  detailRecovered: boolean
}

export type ShareCardModel = {
  caseId: string
  caseNumber: string
  title: string
  subtitle: string
  coreCharacter: string
  difficulty: Difficulty
  sceneAssetId?: string
  initialVerdictLabel: string
  finalVerdictLabel: string
  endingTitle: string
  rating: EvaluationRating
  score: number
  dateLabel: string
  clueCount?: number
  evidenceCount?: number
  truthHook: string
  clueSignets: string[]
  shareLine: string
  detailRecovered: boolean
}

const shareLines: Record<EvaluationRating, string> = {
  明镜高悬: '证据成链，流言归档。',
  慎思明辨: '慎取一证，明辨一字。',
  案牍清通: '旧说入卷，新证落印。',
  重审有得: '回卷不是退步，是再看一眼。',
}
const validRatings = new Set<EvaluationRating>(Object.keys(shareLines) as EvaluationRating[])
const validVerdicts = new Set<CaseVerdict>(['credible', 'partial', 'uncertain', 'myth'])

function isDetailedRecord(record: CaseVerdictRecord | undefined, caseId: string): record is CaseVerdictRecord {
  return Boolean(record
    && record.caseId === caseId
    && validRatings.has(record.rating)
    && validVerdicts.has(record.officialVerdict)
    && Number.isFinite(record.score)
    && typeof record.completedAt === 'string')
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '日期未记'
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value
  return `${part('year')}.${part('month')}.${part('day')}`
}

function safeCount(value: number | undefined): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : undefined
}

export function getCollectionEntries(
  index: ContentIndex,
  save: ProjectSaveData,
  records: Record<string, CaseVerdictRecord>,
): CaseCollectionEntry[] {
  const completedIds = new Set(save.completedCaseIds)
  const unlockedIds = new Set(save.unlockedCaseIds)

  return [...index.cases.values()].sort((a, b) => a.order - b.order).map((caseData) => {
    const completed = completedIds.has(caseData.caseId)
    const best = completed ? save.bestRatings[caseData.caseId] : undefined
    const record = completed && isDetailedRecord(records[caseData.caseId], caseData.caseId) ? records[caseData.caseId] : undefined
    const evaluation = best ?? record
    const ending = index.endings.get(caseData.endingIds[0])
    const archiveScene = caseData.scenes.find((scene) => scene.assetId.endsWith('-archive')) ?? caseData.scenes[0]

    return {
      caseId: caseData.caseId,
      order: caseData.order,
      title: caseData.title,
      subtitle: caseData.subtitle,
      coreCharacter: caseData.coreCharacter,
      difficulty: caseData.difficulty,
      sceneAssetId: archiveScene?.assetId,
      completed,
      unlocked: unlockedIds.has(caseData.caseId),
      ...(completed && evaluation ? {
        rating: evaluation.rating,
        score: Math.max(0, Math.min(100, evaluation.score)),
        completedAt: evaluation.completedAt,
        initialVerdict: record?.initialVerdict && validVerdicts.has(record.initialVerdict) ? record.initialVerdict : undefined,
        finalVerdict: record?.finalVerdict && validVerdicts.has(record.finalVerdict) ? record.finalVerdict : caseData.correctConclusion,
        endingTitle: ending?.title,
        verdictReason: ending?.verdictReason,
        clueCount: safeCount(record?.clueCount),
        evidenceCount: safeCount(record?.evidenceCount),
      } : {}),
      ...(completed ? {
        story: {
          rumor: caseData.opening,
          summary: caseData.summary,
          chapters: caseData.clues.map((clue) => ({
            id: clue.id,
            title: clue.title,
            summary: clue.summary,
            category: clue.category,
          })),
          verdictReason: ending?.verdictReason ?? caseData.coreKnowledge,
          uncertainty: ending?.scholarlyUncertainty ?? caseData.coreKnowledge,
          closingText: ending?.closingText ?? '此案已按现有证据范围归档。',
        },
      } : {}),
      detailRecovered: completed && !record,
    }
  })
}

export function createCollectionStoryModel(entry: CaseCollectionEntry): CollectionStoryModel | undefined {
  if (!entry.completed || !entry.story) return undefined
  return {
    caseId: entry.caseId,
    caseNumber: String(entry.order).padStart(2, '0'),
    title: entry.title,
    subtitle: entry.subtitle,
    coreCharacter: entry.coreCharacter,
    difficulty: entry.difficulty,
    sceneAssetId: entry.sceneAssetId,
    ...entry.story,
    initialVerdictLabel: getVerdictLabel(entry.initialVerdict),
    finalVerdictLabel: getVerdictLabel(entry.finalVerdict),
    rating: entry.rating,
    score: entry.score,
    dateLabel: entry.completedAt ? formatDate(entry.completedAt) : undefined,
    detailRecovered: entry.detailRecovered,
  }
}

export function createShareCardModel(entry: CaseCollectionEntry): ShareCardModel | undefined {
  if (!entry.completed || !entry.rating || entry.score === undefined || !entry.completedAt) return undefined
  return {
    caseId: entry.caseId,
    caseNumber: String(entry.order).padStart(2, '0'),
    title: entry.title,
    subtitle: entry.subtitle,
    coreCharacter: entry.coreCharacter,
    difficulty: entry.difficulty,
    sceneAssetId: entry.sceneAssetId,
    initialVerdictLabel: getVerdictLabel(entry.initialVerdict),
    finalVerdictLabel: getVerdictLabel(entry.finalVerdict),
    endingTitle: entry.endingTitle ?? '此案已结',
    rating: entry.rating,
    score: entry.score,
    dateLabel: formatDate(entry.completedAt),
    clueCount: entry.clueCount,
    evidenceCount: entry.evidenceCount,
    truthHook: entry.story?.verdictReason ?? entry.subtitle,
    clueSignets: entry.story?.chapters.slice(0, 3).map((chapter) => chapter.title) ?? [],
    shareLine: shareLines[entry.rating],
    detailRecovered: entry.detailRecovered,
  }
}
