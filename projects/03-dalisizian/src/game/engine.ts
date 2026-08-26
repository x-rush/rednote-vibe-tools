import type {
  CaseRuntimeState,
  ContentIndex,
  Ending,
  HanziCase,
  NodeEffect,
  ScreenState,
} from '../content/types'
import { evaluateCondition, getAvailableOptions } from './conditions'

export type EngineSuccess = { ok: true; state: CaseRuntimeState }
export type EngineFailure = { ok: false; code: string; message: string; state: CaseRuntimeState }
export type EngineResult = EngineSuccess | EngineFailure

export type VerdictResult = {
  score: number
  rating: '明镜高悬' | '慎思明辨' | '案牍清通' | '重审有得'
  matchedRuleIds: string[]
  unlockedCaseId?: string
  ending: Ending
}

function uniqueAdd(values: string[], value: string): string[] {
  return values.includes(value) ? values : [...values, value]
}

export function setFlag(state: CaseRuntimeState, flag: string, value: boolean): CaseRuntimeState {
  return { ...state, flags: { ...state.flags, [flag]: value } }
}

export function acquireClue(state: CaseRuntimeState, clueId: string): CaseRuntimeState {
  return { ...state, clueIds: uniqueAdd(state.clueIds, clueId) }
}

export function acquireEvidence(state: CaseRuntimeState, evidenceId: string): CaseRuntimeState {
  return { ...state, evidenceIds: uniqueAdd(state.evidenceIds, evidenceId) }
}

export function unlockScene(state: CaseRuntimeState, sceneId: string): CaseRuntimeState {
  return { ...state, unlockedSceneIds: uniqueAdd(state.unlockedSceneIds, sceneId) }
}

export function markRouteReviewed(state: CaseRuntimeState, routeId: string): CaseRuntimeState {
  return { ...state, reviewedRouteIds: uniqueAdd(state.reviewedRouteIds, routeId) }
}

function addStyleTag(state: CaseRuntimeState, tag: string): CaseRuntimeState {
  return { ...state, styleTags: uniqueAdd(state.styleTags, tag) }
}

function applyEffect(state: CaseRuntimeState, effect: NodeEffect): CaseRuntimeState {
  switch (effect.type) {
    case 'set-flag': return setFlag(state, effect.flag, effect.value)
    case 'add-clue': return acquireClue(state, effect.clueId)
    case 'add-evidence': return acquireEvidence(state, effect.evidenceId)
    case 'unlock-scene': return unlockScene(state, effect.sceneId)
    case 'add-style-tag': return addStyleTag(state, effect.tag)
    case 'set-initial-verdict': return { ...state, initialVerdict: effect.verdict }
    case 'set-final-verdict': return { ...state, finalVerdict: effect.verdict }
  }
}

function screenForNode(kind: string, isStart: boolean, hasInitialVerdict: boolean): ScreenState {
  if (isStart || kind === 'narration') return 'briefing'
  if (kind === 'dialogue') return 'dialogue'
  if (kind === 'scene') return 'scene'
  if (kind === 'clue') return 'clueBook'
  if (kind === 'deduction') return 'deduction'
  if (kind === 'ending') return 'ending'
  if (kind === 'choice' && !hasInitialVerdict) return 'verdict'
  return 'investigation'
}

export function createInitialCaseState(caseData: HanziCase): CaseRuntimeState {
  return {
    caseId: caseData.caseId,
    screen: 'briefing',
    currentNodeId: caseData.startNodeId,
    flags: {},
    clueIds: [],
    evidenceIds: [],
    unlockedSceneIds: [],
    visitedNodeIds: [],
    deductionAnswers: {},
    deductionAttempts: {},
    firstDeductionAnswers: {},
    reviewedRouteIds: [],
    styleTags: [],
    completed: false,
  }
}

export function enterNode(
  state: CaseRuntimeState,
  nodeId: string,
  index: ContentIndex,
  completedCaseIds: string[] = [],
  remainingTransitions?: number,
): EngineResult {
  const caseData = index.cases.get(state.caseId)
  const node = index.nodes.get(nodeId)
  if (!caseData || !node || node.caseId !== state.caseId) {
    return { ok: false, code: 'missing-node', message: `节点 ${nodeId} 不存在或不属于当前案件。`, state: { ...state, screen: 'error' } }
  }

  const limit = remainingTransitions ?? caseData.nodeIds.length + 1
  if (limit <= 0) {
    return { ok: false, code: 'unexpected-loop', message: '剧情节点进入了无法退出的循环。', state: { ...state, screen: 'error' } }
  }

  let nextState: CaseRuntimeState = {
    ...state,
    currentNodeId: nodeId,
    screen: screenForNode(node.kind, nodeId === caseData.startNodeId, Boolean(state.initialVerdict)),
    visitedNodeIds: uniqueAdd(state.visitedNodeIds, nodeId).slice(-caseData.nodeIds.length),
    deductionFeedback: undefined,
  }
  if (node.sceneId) nextState = { ...unlockScene(nextState, node.sceneId), currentSceneId: node.sceneId }
  for (const clueId of node.acquireClueIds ?? []) nextState = acquireClue(nextState, clueId)
  for (const evidenceId of node.acquireEvidenceIds ?? []) nextState = acquireEvidence(nextState, evidenceId)

  if (node.kind === 'ending') return { ok: true, state: { ...nextState, completed: true, screen: 'ending' } }
  if (node.kind !== 'condition') return { ok: true, state: nextState }

  const branch = node.branches?.find((item) => !item.condition || evaluateCondition(item.condition, nextState, completedCaseIds))
  if (!branch) return { ok: false, code: 'no-condition-branch', message: '当前状态没有可用的剧情分支。', state: { ...nextState, screen: 'error' } }
  return enterNode(nextState, branch.nextNodeId, index, completedCaseIds, limit - 1)
}

export function chooseOption(
  state: CaseRuntimeState,
  choiceId: string,
  index: ContentIndex,
  completedCaseIds: string[] = [],
): EngineResult {
  const node = index.nodes.get(state.currentNodeId)
  if (!node || node.caseId !== state.caseId) return { ok: false, code: 'missing-current-node', message: '当前剧情节点不存在。', state: { ...state, screen: 'error' } }
  const choice = getAvailableOptions(node, state, index, completedCaseIds).find((item) => item.id === choiceId)
  if (!choice) return { ok: false, code: 'unavailable-option', message: '该选项尚未解锁或不属于当前节点。', state }

  const effectedState = (choice.effects ?? []).reduce(applyEffect, state)
  return enterNode(effectedState, choice.nextNodeId, index, completedCaseIds)
}

export function submitDeductionAnswer(
  state: CaseRuntimeState,
  optionId: string,
  index: ContentIndex,
  completedCaseIds: string[] = [],
): EngineResult {
  const node = index.nodes.get(state.currentNodeId)
  const caseData = index.cases.get(state.caseId)
  const deduction = caseData?.deductions.find((item) => item.id === node?.deductionId)
  if (!node || node.kind !== 'deduction' || !deduction) return { ok: false, code: 'not-deduction-node', message: '当前节点不能提交推理。', state }

  const missingClues = deduction.requiredClueIds.filter((id) => !state.clueIds.includes(id))
  if (missingClues.length) return { ok: false, code: 'missing-required-clues', message: `尚缺少 ${missingClues.length} 条必要线索。`, state }
  const option = deduction.options.find((item) => item.id === optionId)
  if (!option) return { ok: false, code: 'unknown-deduction-option', message: '推理选项不存在。', state }

  const attempts = (state.deductionAttempts[deduction.id] ?? 0) + 1
  const firstAnswers = state.firstDeductionAnswers[deduction.id]
    ? state.firstDeductionAnswers
    : { ...state.firstDeductionAnswers, [deduction.id]: option.id }
  let answeredState: CaseRuntimeState = {
    ...state,
    deductionAnswers: { ...state.deductionAnswers, [deduction.id]: option.id },
    deductionAttempts: { ...state.deductionAttempts, [deduction.id]: attempts },
    firstDeductionAnswers: firstAnswers,
    deductionFeedback: option.feedback,
  }
  if (!option.correct) return { ok: true, state: answeredState }
  if (option.verdict) answeredState = { ...answeredState, finalVerdict: option.verdict }
  return enterNode(answeredState, option.nextNodeId, index, completedCaseIds)
}

export function calculateVerdict(
  state: CaseRuntimeState,
  index: ContentIndex,
  completedCaseIds: string[] = [],
): VerdictResult {
  const caseData = index.cases.get(state.caseId)
  if (!caseData) throw new Error(`Unknown case ${state.caseId}`)
  const ending = caseData.endingIds.map((id) => index.endings.get(id)).find((item): item is Ending => Boolean(item))
  if (!ending) throw new Error(`Case ${state.caseId} has no ending`)
  const matchedRules = caseData.scoringRules.filter((rule) => evaluateCondition(rule.condition, state, completedCaseIds))
  const score = matchedRules.reduce((total, rule) => total + rule.points, 0)
  const rating = score >= 90 ? '明镜高悬' : score >= 75 ? '慎思明辨' : score >= 60 ? '案牍清通' : '重审有得'
  const nextCase = [...index.cases.values()].find((item) => item.order === caseData.order + 1)
  return {
    score,
    rating,
    matchedRuleIds: matchedRules.map((rule) => rule.id),
    unlockedCaseId: nextCase?.caseId,
    ending,
  }
}

export function restartCase(caseData: HanziCase): CaseRuntimeState {
  return createInitialCaseState(caseData)
}
