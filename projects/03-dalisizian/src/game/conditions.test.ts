import { describe, expect, it } from 'vitest'
import { contentIndex } from '../content'
import type { CaseNode, CaseRuntimeState, ConditionExpression } from '../content/types'
import { evaluateCondition, getAvailableOptions } from './conditions'

const state: CaseRuntimeState = {
  caseId: 'case-home-roof-pig',
  screen: 'investigation',
  currentNodeId: 'node-home-05',
  flags: { 'flag-home-rumor-noted': true },
  clueIds: ['clue-home-form'],
  evidenceIds: ['evidence-home-early-form'],
  unlockedSceneIds: ['scene-home-court'],
  visitedNodeIds: ['node-home-00'],
  deductionAnswers: { 'deduction-home-method': 'option-home-method-b' },
  styleTags: [],
  completed: false,
}

describe('finite condition expressions', () => {
  it('evaluates nested all, any, and not expressions against whitelisted state', () => {
    const condition: ConditionExpression = {
      all: [
        { field: 'clueIds', operator: 'includes', value: 'clue-home-form' },
        { field: 'flags', operator: 'equals', key: 'flag-home-rumor-noted', value: true },
        { not: { field: 'evidenceIds', operator: 'includes', value: 'evidence-home-social-leap' } },
        {
          any: [
            { field: 'unlockedSceneIds', operator: 'includes', value: 'scene-home-archive' },
            { field: 'deductionAnswers', operator: 'answer-is', key: 'deduction-home-method', value: 'option-home-method-b' },
          ],
        },
      ],
    }

    expect(evaluateCondition(condition, state, [])).toBe(true)
  })

  it('supports negative collection membership and completed-case checks', () => {
    expect(evaluateCondition({ field: 'clueIds', operator: 'not-includes', value: 'clue-home-context' }, state, [])).toBe(true)
    expect(evaluateCondition({ field: 'completedCaseIds', operator: 'includes', value: 'case-home-roof-pig' }, state, ['case-home-roof-pig'])).toBe(true)
  })

  it('only exposes node options whose conditions are satisfied', () => {
    const node: CaseNode = {
      id: 'node-test-options',
      caseId: state.caseId,
      kind: 'choice',
      text: '测试选项',
      critical: false,
      choices: [
        { id: 'choice-open', text: '已解锁', nextNodeId: 'node-home-06', condition: { field: 'clueIds', operator: 'includes', value: 'clue-home-form' } },
        { id: 'choice-locked', text: '未解锁', nextNodeId: 'node-home-06', condition: { field: 'clueIds', operator: 'includes', value: 'clue-home-context' } },
      ],
    }

    expect(getAvailableOptions(node, state, contentIndex).map((option) => option.id)).toEqual(['choice-open'])
  })
})
