import type { CaseNode, CaseRuntimeState, ContentIndex, ScreenState } from '../content/types'
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

export function getNodeScreen(node: CaseNode, state: CaseRuntimeState): ScreenState {
  switch (node.kind) {
    case 'narration': return 'briefing'
    case 'dialogue': return 'dialogue'
    case 'choice': return state.initialVerdict ? 'investigation' : 'verdict'
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

export function getReturnTarget(context: ReturnContext | undefined, state: CaseRuntimeState): ReturnContext {
  return context ?? { screen: state.screen, nodeId: state.currentNodeId }
}

export function isClueBookOverlay(screen: ScreenState, context: ReturnContext | undefined): boolean {
  return screen === 'clueBook' && context !== undefined
}
