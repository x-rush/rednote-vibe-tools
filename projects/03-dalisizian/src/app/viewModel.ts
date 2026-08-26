import type { CaseNode, CaseRuntimeState, CaseVerdict, ContentIndex, DeductionQuestion, Evidence, HanziCase, ScreenState } from '../content/types'
import type { EvaluationRating, ProjectSaveData } from '../storage/types'

export type CaseListItem = {
  caseId: string
  order: number
  title: string
  subtitle: string
  coreCharacter: string
  difficulty: string
  unlocked: boolean
  completed: boolean
  bestRating?: EvaluationRating
  bestScore?: number
}

export type ReturnContext = {
  screen: ScreenState
  nodeId: string
}

export type InvestigationRouteItem = {
  id: string
  title: string
  summary: string
  entryNodeId: string
  accent: 'cinnabar' | 'ink' | 'bronze'
  completed: boolean
  clueTitles: string[]
}

export type DeductionReviewModel = {
  reviewNodeId: string
  routeId?: string
  routeTitle?: string
  evidenceTitles: string[]
}

export function getNodeDisplayText(node: CaseNode, deduction?: DeductionQuestion): string {
  return deduction?.prompt ?? node.text
}

export function getNodeScreen(node: CaseNode, state: CaseRuntimeState): ScreenState {
  switch (node.kind) {
    case 'narration': return 'briefing'
    case 'dialogue': return 'dialogue'
    case 'choice': return state.initialVerdict ? 'investigation' : 'verdict'
    case 'investigation-hub': return 'investigation'
    case 'clue': return 'clueBook'
    case 'condition': return 'investigation'
    case 'scene': return 'scene'
    case 'deduction': return 'deduction'
    case 'ending': return 'ending'
  }
}

export function getCaseListItems(index: ContentIndex, save: ProjectSaveData): CaseListItem[] {
  return [...index.cases.values()].sort((a, b) => a.order - b.order).map((item) => ({
    caseId: item.caseId,
    order: item.order,
    title: item.title,
    subtitle: item.subtitle,
    coreCharacter: item.coreCharacter,
    difficulty: item.difficulty,
    unlocked: save.unlockedCaseIds.includes(item.caseId),
    completed: save.completedCaseIds.includes(item.caseId),
    bestRating: save.bestRatings[item.caseId]?.rating,
    bestScore: save.bestRatings[item.caseId]?.score,
  }))
}

export function getInvestigationRouteItems(
  caseData: HanziCase,
  state: CaseRuntimeState,
  index: ContentIndex,
): InvestigationRouteItem[] {
  return (caseData.investigationRoutes ?? []).map((route) => ({
    ...route,
    completed: route.requiredClueIds.every((id) => state.clueIds.includes(id)),
    clueTitles: route.requiredClueIds
      .filter((id) => state.clueIds.includes(id))
      .map((id) => index.clues.get(id)?.title)
      .filter((title): title is string => Boolean(title)),
  }))
}

export function getDeductionReviewModel(
  deduction: DeductionQuestion,
  state: CaseRuntimeState,
  index: ContentIndex,
): DeductionReviewModel | undefined {
  const answerId = state.deductionAnswers[deduction.id]
  const option = deduction.options.find((item) => item.id === answerId)
  if (!option || option.correct || !option.reviewNodeId) return undefined
  const reviewNode = index.nodes.get(option.reviewNodeId)
  const caseData = index.cases.get(state.caseId)
  const route = caseData?.investigationRoutes?.find((item) => item.id === reviewNode?.routeId)
  return {
    reviewNodeId: option.reviewNodeId,
    ...(route ? { routeId: route.id, routeTitle: route.title } : {}),
    evidenceTitles: (deduction.focusEvidenceIds ?? [])
      .map((id) => index.evidence.get(id)?.title)
      .filter((title): title is string => Boolean(title)),
  }
}

export function getNewEvidenceItems(
  previous: CaseRuntimeState,
  next: CaseRuntimeState,
  index: ContentIndex,
): Evidence[] {
  const previousIds = new Set(previous.evidenceIds)
  return next.evidenceIds
    .filter((id) => !previousIds.has(id))
    .map((id) => index.evidence.get(id))
    .filter((item): item is Evidence => item !== undefined && item.caseId === next.caseId)
}

export function getDeductionEvidenceItems(
  deduction: DeductionQuestion,
  state: CaseRuntimeState,
  index: ContentIndex,
): Array<{ evidence: Evidence; acquired: boolean }> {
  return (deduction.focusEvidenceIds ?? [])
    .map((id) => index.evidence.get(id))
    .filter((item): item is Evidence => item !== undefined && item.caseId === state.caseId)
    .map((evidence) => ({ evidence, acquired: state.evidenceIds.includes(evidence.id) }))
}

export function getReturnTarget(context: ReturnContext | undefined, state: CaseRuntimeState): ReturnContext {
  return context ?? { screen: state.screen, nodeId: state.currentNodeId }
}

export function isClueBookOverlay(screen: ScreenState, context: ReturnContext | undefined): boolean {
  return screen === 'clueBook' && context !== undefined
}

export function getVerdictLabel(verdict: CaseVerdict | undefined): string {
  if (!verdict) return '未记'
  return {
    credible: '基本可信',
    partial: '部分可信',
    uncertain: '证据不足',
    myth: '常见误解',
  }[verdict]
}
