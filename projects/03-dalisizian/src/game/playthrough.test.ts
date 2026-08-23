import { describe, expect, it } from 'vitest'
import { contentIndex } from '../content'
import type { CaseRuntimeState } from '../content/types'
import { chooseOption, createInitialCaseState, enterNode, submitDeductionAnswer } from './engine'

function runCase(caseId: string): CaseRuntimeState {
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
    } else {
      const choice = node.choices?.[0]
      if (!choice) throw new Error(`missing playable choice for ${node.id}`)
      result = chooseOption(state, choice.id, contentIndex)
    }
  }

  if (!result.ok) throw new Error(`${result.code}: ${result.message}`)
  if (guard >= 80) throw new Error(`playthrough guard exceeded for ${caseId}`)
  return result.state
}

describe('complete automatic case playthroughs', () => {
  it.each([
    ['case-home-roof-pig', 'partial'],
    ['case-martial-stop-spear', 'partial'],
    ['case-law-water-go', 'myth'],
  ] as const)('completes %s through public option APIs', (caseId, verdict) => {
    const state = runCase(caseId)
    expect(state.completed).toBe(true)
    expect(state.finalVerdict).toBe(verdict)
    expect(state.screen).toBe('ending')
  })
})
