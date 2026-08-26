import { describe, expect, it } from 'vitest'
import { contentIndex } from '../content'
import type { CaseRuntimeState } from '../content/types'
import { calculateVerdict, chooseOption, createInitialCaseState, enterNode, markRouteReviewed, submitDeductionAnswer } from './engine'

function expectState(result: ReturnType<typeof enterNode>): CaseRuntimeState {
  if (!result.ok) throw new Error(`${result.code}: ${result.message}`)
  return result.state
}

function runCase(caseId: string, witnessChoiceIndex = 0): CaseRuntimeState {
  const caseData = contentIndex.cases.get(caseId)
  if (!caseData) throw new Error(`missing case ${caseId}`)
  let result = enterNode(createInitialCaseState(caseData), caseData.startNodeId, contentIndex)
  let guard = 0

  while (result.ok && !result.state.completed && guard < 80) {
    guard += 1
    const state = result.state
    const node = contentIndex.nodes.get(state.currentNodeId)
    if (!node) throw new Error(`missing node ${state.currentNodeId}`)
    if (node.kind === 'deduction') {
      const deduction = caseData.deductions.find((item) => item.id === node.deductionId)
      const correct = deduction?.options.find((option) => option.correct)
      if (!correct) throw new Error(`missing correct option for ${node.id}`)
      result = submitDeductionAnswer(state, correct.id, contentIndex)
    } else if (node.kind === 'investigation-hub') {
      const routeEntries = new Set((caseData.investigationRoutes ?? []).map((route) => route.entryNodeId))
      const pendingRoute = caseData.investigationRoutes?.find((route) => route.requiredClueIds.some((id) => !state.clueIds.includes(id)))
      const choice = pendingRoute
        ? node.choices?.find((item) => item.nextNodeId === pendingRoute.entryNodeId)
        : node.choices?.find((item) => !routeEntries.has(item.nextNodeId))
      if (!choice) throw new Error(`missing investigation choice for ${node.id}`)
      result = chooseOption(state, choice.id, contentIndex)
    } else {
      const choice = node.id.endsWith('-13') ? node.choices?.[witnessChoiceIndex] : node.choices?.[0]
      if (!choice) throw new Error(`missing playable choice for ${node.id}`)
      result = chooseOption(state, choice.id, contentIndex)
    }
  }

  if (!result.ok) throw new Error(`${result.code}: ${result.message}`)
  if (guard >= 80) throw new Error(`playthrough guard exceeded for ${caseId}`)
  return result.state
}

describe('complete automatic case playthroughs', () => {
  it.each([...contentIndex.cases.values()].map((item) => [item.caseId, item.correctConclusion] as const))(
    'completes %s through public option APIs',
    (caseId, verdict) => {
      const state = runCase(caseId)
      expect(state.completed).toBe(true)
      expect(state.finalVerdict).toBe(verdict)
      expect(state.screen).toBe('ending')
    },
  )

  it.each([...contentIndex.cases.values()].map((item) => [item.caseId] as const))(
    'makes a real clean playthrough of %s eligible for 100 points',
    (caseId) => {
      const state = runCase(caseId)
      expect(calculateVerdict(state, contentIndex).score).toBe(100)
    },
  )

  it.each([...contentIndex.cases.values()].map((item) => [item.caseId] as const))(
    'closes the alternate witness challenge in %s with every required exhibit archived',
    (caseId) => {
      const caseData = contentIndex.cases.get(caseId)
      if (!caseData) throw new Error(`missing case ${caseId}`)
      const state = runCase(caseId, 1)

      expect(state.completed).toBe(true)
      expect(state.screen).toBe('ending')
      expect(state.clueIds).toEqual(expect.arrayContaining(caseData.requiredClueIds))
      expect(state.evidenceIds).toEqual(expect.arrayContaining(caseData.evidenceIds))
    },
  )

  it('lets the home case archive evidence after choosing routes in a non-default order', () => {
    const caseData = contentIndex.cases.get('case-home-roof-pig')
    if (!caseData) throw new Error('missing home case')
    let state = expectState(enterNode(createInitialCaseState(caseData), caseData.startNodeId, contentIndex))
    state = expectState(chooseOption(state, 'choice-home-open', contentIndex))
    state = expectState(chooseOption(state, 'choice-home-hear', contentIndex))
    state = expectState(chooseOption(state, 'choice-home-initial-partial', contentIndex))

    expect(contentIndex.nodes.get(state.currentNodeId)?.kind).toBe('investigation-hub')
    state = expectState(chooseOption(state, 'choice-home-route-context', contentIndex))
    expect(state.clueIds).not.toContain('clue-home-context')
    state = expectState(chooseOption(state, 'choice-home-street', contentIndex))
    state = expectState(chooseOption(state, 'choice-home-boundary', contentIndex))
    state = expectState(chooseOption(state, 'choice-home-challenge-a', contentIndex))
    expect(state.currentNodeId).toBe('node-home-13a')
    expect(state.clueIds).not.toContain('clue-home-context')
    state = expectState(chooseOption(state, 'choice-home-reaction-a-done', contentIndex))
    expect(state.clueIds).toContain('clue-home-context')
    expect(state.evidenceIds).toEqual(expect.arrayContaining(['evidence-home-phonetic', 'evidence-home-social-leap']))
    state = expectState(chooseOption(state, 'choice-home-context-done', contentIndex))
    expect(contentIndex.nodes.get(state.currentNodeId)?.kind).toBe('investigation-hub')
  })

  it('produces different home-case scores for clean and recovered reasoning', () => {
    const caseData = contentIndex.cases.get('case-home-roof-pig')
    if (!caseData) throw new Error('missing home case')
    const base = {
      ...createInitialCaseState(caseData),
      clueIds: [...caseData.requiredClueIds],
      evidenceIds: [...caseData.evidenceIds],
      completed: true,
      finalVerdict: caseData.correctConclusion,
      deductionAnswers: {
        'deduction-home-method': 'option-home-method-b',
        'deduction-home-knowledge': 'option-home-knowledge-a',
        'deduction-home-verdict': 'option-home-verdict-partial',
      },
      firstDeductionAnswers: {
        'deduction-home-method': 'option-home-method-b',
        'deduction-home-knowledge': 'option-home-knowledge-a',
        'deduction-home-verdict': 'option-home-verdict-partial',
      },
      deductionAttempts: {
        'deduction-home-method': 1,
        'deduction-home-knowledge': 1,
        'deduction-home-verdict': 1,
      },
      flags: { 'flag-home-method-careful': true, 'flag-home-boundary-careful': true },
      styleTags: ['审慎派'],
    } satisfies CaseRuntimeState
    const recovered = markRouteReviewed({
      ...base,
      firstDeductionAnswers: { ...base.firstDeductionAnswers, 'deduction-home-method': 'option-home-method-a' },
      deductionAttempts: { ...base.deductionAttempts, 'deduction-home-method': 2 },
    }, 'route-home-form')

    expect(calculateVerdict(base, contentIndex).score).toBe(100)
    expect(calculateVerdict(recovered, contentIndex).score).toBe(90)
  })
})
