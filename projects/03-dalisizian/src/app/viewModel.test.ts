import { describe, expect, it } from 'vitest'
import { contentIndex, contentPackage } from '../content'
import type { CaseNode, CaseRuntimeState, ScreenState } from '../content/types'
import { createDefaultSave } from '../storage/storage'
import { getCaseListItems, getDeductionEvidenceItems, getDeductionReviewModel, getInvestigationRouteItems, getNewEvidenceItems, getNodeDisplayText, getNodeScreen, getReturnTarget, getVerdictLabel, isClueBookOverlay } from './viewModel'
import * as landingViewModel from './viewModel'

const baseState: CaseRuntimeState = {
  caseId: 'case-home-roof-pig', screen: 'investigation', currentNodeId: 'node-home-00', flags: {}, clueIds: [], evidenceIds: [],
  evidenceObservationIdsByEvidenceId: {},
  unlockedSceneIds: [], visitedNodeIds: [], deductionAnswers: {}, deductionAttempts: {}, firstDeductionAnswers: {}, reviewedRouteIds: [], styleTags: [], completed: false,
}

describe('semantic page view model', () => {
  it('builds a fresh landing desk around Shen Yan and the first unlocked case', () => {
    const getLandingHeroModel = (landingViewModel as Partial<typeof landingViewModel & {
      getLandingHeroModel: (index: typeof contentIndex, save: ReturnType<typeof createDefaultSave>, uiCopy: typeof contentPackage.meta.landingUi) => unknown
    }>).getLandingHeroModel

    expect(getLandingHeroModel?.(contentIndex, createDefaultSave('case-home-roof-pig'), contentPackage.meta.landingUi)).toEqual({
      companion: {
        name: '沈砚',
        title: '大理寺录事',
        role: '管理案卷、说明程序与证据方法，不代替玩家作答。',
        assetId: 'asset-character-temple-official',
      },
      currentCase: undefined,
      primaryCase: { caseId: 'case-home-roof-pig', order: 1, title: '家字失踪案' },
      primaryAction: 'case',
      primaryMode: 'new',
      primaryLabel: '领取第一案',
      primaryStatus: '新案候审',
      primaryTitle: '家字失踪案',
      completedCount: 0,
      totalCases: 8,
    })
  })

  it('turns the primary landing action into an exact continue-case handoff', () => {
    const save = {
      ...createDefaultSave('case-home-roof-pig'),
      currentCaseId: 'case-rest-under-tree',
      unlockedCaseIds: ['case-home-roof-pig', 'case-rest-under-tree'],
      completedCaseIds: ['case-home-roof-pig'],
    }
    const getLandingHeroModel = (landingViewModel as Partial<typeof landingViewModel & {
      getLandingHeroModel: (index: typeof contentIndex, save: ReturnType<typeof createDefaultSave>, uiCopy: typeof contentPackage.meta.landingUi) => unknown
    }>).getLandingHeroModel

    expect(getLandingHeroModel?.(contentIndex, save, contentPackage.meta.landingUi)).toMatchObject({
      currentCase: { caseId: 'case-rest-under-tree', title: '休字树下案' },
      primaryCase: { caseId: 'case-rest-under-tree', title: '休字树下案' },
      primaryAction: 'case',
      primaryMode: 'continue',
      primaryLabel: '继续第二案',
      completedCount: 1,
      totalCases: 8,
    })
  })

  it('offers the earliest unlocked unfinished case after archived cases', () => {
    const save = {
      ...createDefaultSave('case-home-roof-pig'),
      unlockedCaseIds: ['case-home-roof-pig', 'case-rest-under-tree', 'case-take-ear'],
      completedCaseIds: ['case-home-roof-pig', 'case-rest-under-tree'],
    }

    expect(landingViewModel.getLandingHeroModel(contentIndex, save, contentPackage.meta.landingUi)).toMatchObject({
      currentCase: undefined,
      primaryCase: { caseId: 'case-take-ear', title: '取字失耳案' },
      primaryAction: 'case',
      primaryMode: 'new',
      primaryLabel: '领取第三案',
      completedCount: 2,
    })
  })

  it('sends a fully completed archive to the collection instead of reopening a case', () => {
    const caseIds = [...contentIndex.cases.values()].sort((a, b) => a.order - b.order).map((item) => item.caseId)
    const save = {
      ...createDefaultSave('case-home-roof-pig'),
      unlockedCaseIds: caseIds,
      completedCaseIds: caseIds,
    }

    expect(landingViewModel.getLandingHeroModel(contentIndex, save, contentPackage.meta.landingUi)).toMatchObject({
      currentCase: undefined,
      primaryCase: undefined,
      primaryAction: 'collection',
      primaryMode: 'complete',
      primaryLabel: '查看断案图鉴',
      completedCount: 8,
    })
  })

  it.each([
    ['narration', 'briefing'],
    ['dialogue', 'dialogue'],
    ['choice', 'verdict'],
    ['investigation-hub', 'investigation'],
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

  it('presents internal verdict values as player-facing Chinese labels', () => {
    expect(getVerdictLabel('credible')).toBe('基本可信')
    expect(getVerdictLabel('partial')).toBe('部分可信')
    expect(getVerdictLabel('uncertain')).toBe('证据不足')
    expect(getVerdictLabel('myth')).toBe('常见误解')
    expect(getVerdictLabel(undefined)).toBe('未记')
  })

  it('builds completed and pending investigation route cards from content', () => {
    const caseData = contentIndex.cases.get(baseState.caseId)
    if (!caseData) throw new Error('home case fixture missing')

    const items = getInvestigationRouteItems(caseData, { ...baseState, clueIds: ['clue-home-form'] }, contentIndex)

    expect(items.map((item) => [item.id, item.completed])).toEqual([
      ['route-home-form', true],
      ['route-home-gloss', false],
      ['route-home-context', false],
    ])
    expect(items[0].clueTitles).toContain('家字形证')
  })

  it('builds a route-aware review link after a failed deduction', () => {
    const caseData = contentIndex.cases.get(baseState.caseId)
    const deduction = caseData?.deductions.find((item) => item.id === 'deduction-home-method')
    if (!deduction) throw new Error('home deduction fixture missing')
    const failedState: CaseRuntimeState = {
      ...baseState,
      currentNodeId: 'node-home-16',
      deductionAnswers: { [deduction.id]: 'option-home-method-a' },
      deductionFeedback: '需要回查字形材料。',
    }

    expect(getDeductionReviewModel(deduction, failedState, contentIndex)).toMatchObject({
      reviewNodeId: 'node-home-04',
      routeId: 'route-home-form',
      routeTitle: '验字形',
    })
  })

  it('shows the authored deduction prompt instead of stale node bridge copy', () => {
    const caseData = contentIndex.cases.get(baseState.caseId)
    const deduction = caseData?.deductions.find((item) => item.id === 'deduction-home-method')
    const node = contentIndex.nodes.get('node-home-16')
    if (!deduction || !node) throw new Error('home deduction fixture missing')

    expect(getNodeDisplayText(node, deduction)).toBe(deduction.prompt)
    expect(getNodeDisplayText(node)).toBe(node.text)
  })

  it('finds newly acquired evidence from the state transition in authored order', () => {
    const next = {
      ...baseState,
      evidenceIds: ['evidence-home-shuowen', 'evidence-home-early-form'],
    }

    expect(getNewEvidenceItems(baseState, next, contentIndex).map((item) => item.id)).toEqual([
      'evidence-home-shuowen',
      'evidence-home-early-form',
    ])
  })

  it('does not announce another case\'s restored evidence as newly acquired', () => {
    const restoredState = {
      ...baseState,
      caseId: 'case-rest-under-tree',
      evidenceIds: ['evidence-rest-components'],
    }

    expect(getNewEvidenceItems(baseState, restoredState, contentIndex)).toEqual([])
  })

  it('preserves deduction evidence order without granting missing evidence', () => {
    const caseData = contentIndex.cases.get(baseState.caseId)
    const deduction = caseData?.deductions.find((item) => item.id === 'deduction-home-method')
    if (!deduction) throw new Error('home deduction fixture missing')
    const state = { ...baseState, evidenceIds: [deduction.focusEvidenceIds?.[0] ?? ''] }

    expect(getDeductionEvidenceItems(deduction, state, contentIndex).map((item) => ({
      id: item.evidence.id,
      acquired: item.acquired,
    }))).toEqual((deduction.focusEvidenceIds ?? []).map((id, index) => ({ id, acquired: index === 0 })))
  })
})
