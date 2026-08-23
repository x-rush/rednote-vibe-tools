import { describe, expect, it } from 'vitest'
import rawContent from '../content/content.json'
import { parseContent } from '../content/validate'
import {
  filterByConflictLevel,
  filterByGoal,
  filterByRelationship,
  matchExpressionRisks,
  selectBestScenario,
} from './matching'
import type { ReplayAnswers } from './types'

const content = parseContent(rawContent)
const scenarios = content.content.scenarios

describe('scenario filters', () => {
  it('filters the frozen relationship groups', () => {
    expect(filterByRelationship(scenarios, 'friend')).toHaveLength(6)
    expect(filterByRelationship(scenarios, 'partner')).toHaveLength(8)
    expect(filterByRelationship(scenarios, 'family')).toHaveLength(6)
    expect(filterByRelationship(scenarios, 'coworker')).toHaveLength(8)
    expect(filterByRelationship(scenarios, 'general')).toHaveLength(4)
  })

  it('filters by communication goal', () => {
    const results = filterByGoal(scenarios, 'set-boundary')
    expect(results.length).toBeGreaterThan(0)
    expect(results.every(({ communicationGoalIds }) => communicationGoalIds.includes('set-boundary'))).toBe(true)
  })

  it('filters by conflict level', () => {
    expect(filterByConflictLevel(scenarios, 'low').map(({ scenarioId }) => scenarioId)).toEqual([
      'friend-slow-reply',
      'partner-anniversary',
      'coworker-vague-feedback',
      'general-request-refused',
    ])
  })
})

describe('deterministic matching', () => {
  const exactAnswers: ReplayAnswers = {
    relationshipType: 'friend',
    communicationGoal: 'coordinate',
    conflictLevel: 'medium',
    emotionId: 'feel-uneasy',
    originalExpressionId: 'expr-accusation',
    responseId: 'response-discussed',
    intention: 'repair-now',
  }

  it('matches expression and scenario risks without diagnosing anyone', () => {
    const scenario = scenarios.find(({ scenarioId }) => scenarioId === 'friend-late')!
    const risks = matchExpressionRisks(scenario, 'feel-uneasy', 'expr-accusation', content.content.choices)

    expect(risks).toContain('把一次迟到扩大成对人的判断')
    expect(risks.some((risk) => risk.includes('对方可能先为自己辩护'))).toBe(true)
    expect(risks.join('')).not.toMatch(/人格障碍|自恋型人格/)
  })

  it('selects the exact scenario with an explainable level', () => {
    const match = selectBestScenario(scenarios, exactAnswers)

    expect(match.scenario.scenarioId).toBe('friend-late')
    expect(match.level).toBe('exact')
    expect(match.reason).toContain('关系、目标、冲突程度、情绪和原表达')
  })

  it('uses the documented fallback order when no exact scenario exists', () => {
    const match = selectBestScenario(scenarios, {
      relationshipType: 'family',
      communicationGoal: 'coordinate',
      conflictLevel: 'low',
      emotionId: 'feel-energized',
      originalExpressionId: 'expr-factual',
      responseId: 'response-discussed',
      intention: 'prepare-next-time',
    })

    expect(match.level).toBe('relationship-goal')
    expect(match.scenario.relationshipType).toBe('family')
    expect(match.scenario.communicationGoalIds).toContain('coordinate')
  })

  it('relaxes the response before relaxing the emotion', () => {
    const match = selectBestScenario(scenarios, { ...exactAnswers, responseId: 'response-withdrew' })

    expect(match.scenario.scenarioId).toBe('friend-late')
    expect(match.level).toBe('response-relaxed')
  })

  it('scores partial attributes before using the stable ID tie-break', () => {
    const earlier = { ...scenarios[0]!, scenarioId: 'score-a', conflictLevel: 'high' as const }
    const later = { ...scenarios[0]!, scenarioId: 'score-z', conflictLevel: 'low' as const }
    const match = selectBestScenario([earlier, later], {
      ...exactAnswers,
      conflictLevel: 'low',
      emotionId: 'feel-energized',
      originalExpressionId: 'expr-factual',
    })

    expect(match.level).toBe('relationship-goal')
    expect(match.scenario.scenarioId).toBe('score-z')
  })

  it('always returns the safety scenario for a safety selection', () => {
    const match = selectBestScenario(scenarios, { ...exactAnswers, relationshipType: 'partner', conflictLevel: 'safety' })

    expect(match.scenario.scenarioId).toBe('partner-body-boundary')
    expect(match.scenario.safetyLevel).toBe('safety')
  })

  it.each(['friend', 'partner', 'family', 'coworker', 'general'] as const)(
    'safety overrides an explicitly selected %s scenario',
    (relationshipType) => {
      const match = selectBestScenario(scenarios, {
        ...exactAnswers,
        relationshipType,
        scenarioId: 'friend-late',
        conflictLevel: 'safety',
      })
      expect(match.scenario.safetyLevel).toBe('safety')
      expect(match.reason).toContain('安全')
    },
  )

  it('breaks ties by stable scenario ID', () => {
    const answers = { ...exactAnswers, emotionId: 'feel-worried', originalExpressionId: 'expr-accusation' }
    expect(selectBestScenario(scenarios, answers).scenario.scenarioId).toBe('friend-borrowed-item')
  })
})
