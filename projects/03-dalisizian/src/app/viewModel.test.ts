import { describe, expect, it } from 'vitest'
import { contentIndex } from '../content'
import type { CaseNode, CaseRuntimeState, ScreenState } from '../content/types'
import { createDefaultSave } from '../storage/storage'
import { getCaseListItems, getNodeScreen, getReturnTarget, isClueBookOverlay } from './viewModel'

const baseState: CaseRuntimeState = {
  caseId: 'case-home-roof-pig', screen: 'investigation', currentNodeId: 'node-home-00', flags: {}, clueIds: [], evidenceIds: [],
  unlockedSceneIds: [], visitedNodeIds: [], deductionAnswers: {}, styleTags: [], completed: false,
}

describe('semantic page view model', () => {
  it.each([
    ['narration', 'briefing'],
    ['dialogue', 'dialogue'],
    ['choice', 'verdict'],
    ['clue', 'clueBook'],
    ['condition', 'investigation'],
    ['scene', 'scene'],
    ['deduction', 'deduction'],
    ['ending', 'ending'],
  ] as const)('maps %s nodes to the %s screen', (kind, expected) => {
    const node: CaseNode = { id: `node-test-${kind}`, caseId: baseState.caseId, kind, text: '测试', critical: false }
    expect(getNodeScreen(node, baseState)).toBe(expected)
  })

  it('maps case unlock, completion, and best evaluation status', () => {
    const save = createDefaultSave('case-home-roof-pig')
    save.completedCaseIds = ['case-home-roof-pig']
    save.bestRatings['case-home-roof-pig'] = { rating: '慎思明辨', score: 82, completedAt: '2026-08-24T00:00:00.000Z' }

    const items = getCaseListItems(contentIndex, save)
    expect(items).toHaveLength(8)
    expect(items[0]).toMatchObject({ caseId: 'case-home-roof-pig', unlocked: true, completed: true, bestRating: '慎思明辨' })
    expect(items[1]).toMatchObject({ caseId: 'case-rest-under-tree', unlocked: false, completed: false })
  })

  it('returns from clue and evidence overlays to the exact previous dialogue state', () => {
    const returnContext = { screen: 'dialogue' as ScreenState, nodeId: 'node-home-08' }
    expect(getReturnTarget(returnContext, baseState)).toEqual({ screen: 'dialogue', nodeId: 'node-home-08' })
    expect(getReturnTarget(undefined, baseState)).toEqual({ screen: 'investigation', nodeId: 'node-home-00' })
  })

  it('distinguishes a manually opened clue book from a playable clue node', () => {
    expect(isClueBookOverlay('clueBook', { screen: 'dialogue', nodeId: 'node-home-08' })).toBe(true)
    expect(isClueBookOverlay('clueBook', undefined)).toBe(false)
    expect(isClueBookOverlay('dialogue', { screen: 'dialogue', nodeId: 'node-home-08' })).toBe(false)
  })
})
