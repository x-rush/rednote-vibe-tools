import { describe, expect, it } from 'vitest'
import { contentIndex } from '../content'
import type { CaseRuntimeState } from '../content/types'
import {
  acquireClue,
  acquireEvidence,
  calculateVerdict,
  chooseOption,
  createInitialCaseState,
  enterNode,
  markRouteReviewed,
  restartCase,
  setFlag,
  submitDeductionAnswer,
  unlockScene,
} from './engine'

const homeCase = contentIndex.cases.get('case-home-roof-pig')
if (!homeCase) throw new Error('home case fixture missing')

function expectSuccess(result: ReturnType<typeof enterNode>): CaseRuntimeState {
  expect(result.ok).toBe(true)
  if (!result.ok) throw new Error(result.message)
  return result.state
}

describe('case engine', () => {
  it('initializes and enters a case at its briefing node', () => {
    const initial = createInitialCaseState(homeCase)
    const entered = expectSuccess(enterNode(initial, homeCase.startNodeId, contentIndex))

    expect(entered.currentNodeId).toBe('node-home-00')
    expect(entered.screen).toBe('briefing')
    expect(entered.visitedNodeIds).toEqual(['node-home-00'])
  })

  it('updates flags, clues, evidence, and scenes idempotently', () => {
    const initial = createInitialCaseState(homeCase)
    const updated = unlockScene(
      acquireEvidence(
        acquireEvidence(
          acquireClue(acquireClue(setFlag(initial, 'flag-reviewed', true), 'clue-home-form'), 'clue-home-form'),
          'evidence-home-early-form',
        ),
        'evidence-home-early-form',
      ),
      'scene-home-court',
    )

    expect(updated.flags['flag-reviewed']).toBe(true)
    expect(updated.clueIds).toEqual(['clue-home-form'])
    expect(updated.evidenceIds).toEqual(['evidence-home-early-form'])
    expect(updated.unlockedSceneIds).toEqual(['scene-home-court'])
  })

  it('chooses formal node options and applies their effects', () => {
    let state = expectSuccess(enterNode(createInitialCaseState(homeCase), 'node-home-02', contentIndex))
    const result = chooseOption(state, 'choice-home-initial-partial', contentIndex)
    state = expectSuccess(result)

    expect(state.initialVerdict).toBe('partial')
    expect(state.styleTags).toContain('语境派')
    expect(state.currentNodeId).toBe('node-home-03')
  })

  it('routes condition nodes according to collected clues', () => {
    const emptyResult = enterNode(createInitialCaseState(homeCase), 'node-home-15', contentIndex)
    expect(expectSuccess(emptyResult).currentNodeId).toBe('node-home-03')

    const ready = homeCase.requiredClueIds.reduce(acquireClue, createInitialCaseState(homeCase))
    const readyResult = enterNode(ready, 'node-home-15', contentIndex)
    expect(expectSuccess(readyResult).currentNodeId).toBe('node-home-16')
  })

  it('keeps wrong deductions in place with feedback and advances correct answers', () => {
    const ready = homeCase.requiredClueIds.reduce(acquireClue, createInitialCaseState(homeCase))
    let state = expectSuccess(enterNode(ready, 'node-home-16', contentIndex))

    const wrong = submitDeductionAnswer(state, 'option-home-method-a', contentIndex)
    state = expectSuccess(wrong)
    expect(state.currentNodeId).toBe('node-home-16')
    expect(state.deductionFeedback).toContain('证据链没有闭合')
    expect(state.deductionFeedback).toContain('验字形')

    const correct = submitDeductionAnswer(state, 'option-home-method-b', contentIndex)
    state = expectSuccess(correct)
    expect(state.currentNodeId).toBe('node-home-17')
    expect(state.deductionAnswers['deduction-home-method']).toBe('option-home-method-b')
  })

  it('keeps the first deduction answer while counting every retry', () => {
    const ready = homeCase.requiredClueIds.reduce(acquireClue, createInitialCaseState(homeCase))
    let state = expectSuccess(enterNode(ready, 'node-home-16', contentIndex))

    state = expectSuccess(submitDeductionAnswer(state, 'option-home-method-a', contentIndex))
    state = expectSuccess(submitDeductionAnswer(state, 'option-home-method-b', contentIndex))

    expect(state.firstDeductionAnswers['deduction-home-method']).toBe('option-home-method-a')
    expect(state.deductionAttempts['deduction-home-method']).toBe(2)
    expect(state.deductionAnswers['deduction-home-method']).toBe('option-home-method-b')
  })

  it('marks a reviewed route idempotently', () => {
    const initial = createInitialCaseState(homeCase)
    const reviewed = markRouteReviewed(markRouteReviewed(initial, 'route-home-form'), 'route-home-form')

    expect(reviewed.reviewedRouteIds).toEqual(['route-home-form'])
  })

  it('blocks a deduction when its required clues are missing', () => {
    const state = expectSuccess(enterNode(createInitialCaseState(homeCase), 'node-home-18', contentIndex))
    const result = submitDeductionAnswer(state, 'option-home-verdict-partial', contentIndex)

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected missing clue failure')
    expect(result.code).toBe('missing-required-clues')
  })

  it('scores a completed case and unlocks the next case', () => {
    let state = createInitialCaseState(homeCase)
    state = homeCase.requiredClueIds.reduce(acquireClue, state)
    state = homeCase.evidenceIds.reduce(acquireEvidence, state)
    state = {
      ...state,
      completed: true,
      finalVerdict: 'partial',
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
    }

    const verdict = calculateVerdict(state, contentIndex, [])
    expect(verdict.score).toBe(100)
    expect(verdict.rating).toBe('明镜高悬')
    expect(verdict.unlockedCaseId).toBe('case-rest-under-tree')
    expect(verdict.ending.officialVerdict).toBe('partial')
  })

  it('restarts case progress without mutating the completed result input', () => {
    const completed = { ...createInitialCaseState(homeCase), completed: true, clueIds: ['clue-home-form'] }
    const restarted = restartCase(homeCase)

    expect(restarted.completed).toBe(false)
    expect(restarted.clueIds).toEqual([])
    expect(completed.completed).toBe(true)
  })
})
