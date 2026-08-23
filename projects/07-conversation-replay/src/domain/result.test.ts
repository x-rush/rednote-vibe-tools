import { describe, expect, it } from 'vitest'
import rawContent from '../content/content.json'
import { parseContent } from '../content/validate'
import { buildReplayCardViewModel, buildReplayResult } from './result'
import type { ReplayAnswers } from './types'

const content = parseContent(rawContent)
const baseAnswers: ReplayAnswers = {
  relationshipType: 'friend',
  communicationGoal: 'coordinate',
  conflictLevel: 'medium',
  emotionId: 'feel-uneasy',
  originalExpressionId: 'expr-accusation',
  responseId: 'response-discussed',
  intention: 'repair-now',
}

describe('replay result', () => {
  it('builds all expression and reflection sections', () => {
    const result = buildReplayResult(baseAnswers, content)

    expect(result.scenarioId).toBe('friend-late')
    expect(result.originalRisk.length).toBeGreaterThan(1)
    expect(result.expressionStructure.length).toBeGreaterThan(0)
    expect(result.alternatives.gentle).toBeTruthy()
    expect(result.alternatives.direct).toBeTruthy()
    expect(result.alternatives.firm).toBeTruthy()
    expect(result.repairLine).toBeTruthy()
    expect(result.nextTimeLine).toBeTruthy()
    expect(result.nextSteps.length).toBeGreaterThan(0)
  })

  it('creates a presentation-only replay card view model', () => {
    const card = buildReplayCardViewModel(buildReplayResult(baseAnswers, content))

    expect(card.title).toContain('朋友迟到')
    expect(card.sections.map(({ id }) => id)).toEqual(['risk', 'structure', 'repair', 'next-time', 'summary'])
    expect(card.toneCards.map(({ tone }) => tone)).toEqual(['gentle', 'direct', 'firm'])
    expect(card.shareSummary).toBeTruthy()
  })

  it.each([
    ['friend-late', 'friend', 'coordinate', 'medium'],
    ['friend-shared-secret', 'friend', 'set-boundary', 'high'],
    ['partner-change-plan', 'partner', 'repair', 'medium'],
    ['partner-alone-time', 'partner', 'set-boundary', 'medium'],
    ['family-appearance', 'family', 'set-boundary', 'high'],
    ['coworker-handoff', 'coworker', 'coordinate', 'medium'],
    ['coworker-scope', 'coworker', 'clarify', 'high'],
    ['general-request-refused', 'general', 'clarify', 'low'],
  ] as const)('completes golden path %s', (scenarioId, relationshipType, communicationGoal, conflictLevel) => {
    const result = buildReplayResult({
      ...baseAnswers,
      scenarioId,
      relationshipType,
      communicationGoal,
      conflictLevel,
    }, content)

    expect(result.scenarioId).toBe(scenarioId)
    expect(result.alternatives.gentle.length).toBeGreaterThan(8)
    expect(result.alternatives.direct.length).toBeGreaterThan(8)
    expect(result.alternatives.firm.length).toBeGreaterThan(8)
    expect(result.nextSteps[0]?.description).toBeTruthy()
  })

  it('returns safety-first guidance instead of ordinary repair advice', () => {
    const result = buildReplayResult({
      ...baseAnswers,
      scenarioId: 'partner-body-boundary',
      relationshipType: 'partner',
      communicationGoal: 'set-boundary',
      conflictLevel: 'safety',
      emotionId: 'feel-afraid',
      originalExpressionId: 'expr-boundary',
      responseId: 'response-refused',
    }, content)

    expect(result.safetyNotice?.title).toContain('安全')
    expect(result.nextSteps[0]?.action).toBe('seek-support')
    expect(result.safetyNotice?.message).toContain('不必独自对质')
  })

  it('uses generic safety copy even when a concrete ordinary scenario was selected first', () => {
    const result = buildReplayResult({
      ...baseAnswers,
      scenarioId: 'friend-late',
      conflictLevel: 'safety',
    }, content)

    expect(result.safetyNotice).toBeDefined()
    expect(result.scenarioTitle).toBe('需要先确认安全')
    expect(result.nextSteps[0]?.action).toBe('seek-support')
    expect(result.alternatives.gentle).toContain('安全')
  })

  it('does not emit diagnostic or manipulative results', () => {
    for (const scenario of content.content.scenarios) {
      const resultText = JSON.stringify(buildReplayResult({
        ...baseAnswers,
        scenarioId: scenario.scenarioId,
        relationshipType: scenario.relationshipType,
        communicationGoal: scenario.communicationGoalIds[0]!,
        conflictLevel: scenario.conflictLevel,
        emotionId: scenario.emotionIds[0]!,
        originalExpressionId: scenario.originalExpressionIds[0]!,
      }, content))

      expect(resultText).not.toMatch(/自恋型人格|人格障碍|让.{0,8}付出代价|情感勒索/)
    }
  })
})
