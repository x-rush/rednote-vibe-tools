import { describe, expect, it } from 'vitest'
import rawContent from '../content/content.json'
import { parseContent } from '../content/validate'
import { createInitialReplayStateV2, type ReplayPageV2 } from '../state/replayStateV2'
import { buildScreenViewModelV2 } from './viewV2'

const content = parseContent(rawContent)
const pages: ReplayPageV2[] = [
  'landing', 'privacy', 'guide', 'relationship', 'goal', 'scenario', 'fact', 'feeling',
  'inference', 'need', 'request', 'draft', 'practice', 'comparison', 'result', 'saved',
  'exit', 'safety', 'recovery',
]

describe('V2 screen view models', () => {
  it('gives every page a readable title and primary action', () => {
    for (const page of pages) {
      const state = {
        ...createInitialReplayStateV2(),
        page,
        draft: {
          ...createInitialReplayStateV2().draft,
          scenarioId: 'friend-late',
          relationshipType: 'friend' as const,
          communicationGoal: 'coordinate' as const,
          factOptionIds: ['friend-late-fact-observed'],
          feelingIds: ['feel-worried'],
          inferenceExpressionIds: ['expr-accusation'],
          needIds: ['need-reliability'],
          requestOptionId: 'friend-late-request-next',
          selectedTone: 'direct' as const,
          practiceOptionId: 'friend-late-practice-1',
          practiceReplyId: 'friend-late-reply-repair-1',
        },
      }
      const screen = buildScreenViewModelV2(state, content, [])
      expect(screen.title.trim(), page).not.toBe('')
      expect(screen.primaryLabel?.trim(), page).not.toBe('')
      expect(screen.companion.name, page).toBe('迟言')
      expect(screen.companion.invitation.trim(), page).not.toBe('')
      expect(screen.companion.autonomy.trim(), page).not.toBe('')
    }
  })

  it('limits scenario discovery to six matching results', () => {
    const state = {
      ...createInitialReplayStateV2(),
      page: 'scenario' as const,
      draft: { ...createInitialReplayStateV2().draft, relationshipType: 'friend' as const, communicationGoal: 'coordinate' as const },
    }
    const screen = buildScreenViewModelV2(state, content, [])

    expect(screen.options.filter(({ id }) => id !== 'scenario-unsure').length).toBeLessThanOrEqual(6)
    expect(screen.options.at(-1)?.id).toBe('scenario-unsure')
  })

  it('uses featured companion art only on the opening choice pages', () => {
    const featuredPages: ReplayPageV2[] = ['relationship', 'goal', 'scenario']

    for (const page of pages) {
      const screen = buildScreenViewModelV2({ ...createInitialReplayStateV2(), page }, content, [])
      expect(screen.companion.featured, page).toBe(featuredPages.includes(page))
      expect(screen.companion.role, page).toBe('温和编辑搭档')
    }
  })

  it('uses scenario-specific facts and feelings instead of the full vocabulary', () => {
    const base = {
      ...createInitialReplayStateV2(),
      draft: { ...createInitialReplayStateV2().draft, scenarioId: 'friend-late' },
    }
    const fact = buildScreenViewModelV2({ ...base, page: 'fact' }, content, [])
    const feeling = buildScreenViewModelV2({ ...base, page: 'feeling' }, content, [])

    expect(fact.options.map(({ id }) => id)).toEqual(['friend-late-fact-observed'])
    expect(feeling.options.length).toBe(4)
    expect(feeling.options.some(({ id }) => id === 'feel-worried')).toBe(true)
  })

  it('offers scenario-specific words as the inference to check, not editing jargon', () => {
    const rewrites = new Map(content.content.rewrites.map((rewrite) => [rewrite.id, rewrite]))

    for (const scenario of content.content.scenarios) {
      const state = {
        ...createInitialReplayStateV2(),
        page: 'inference' as const,
        draft: { ...createInitialReplayStateV2().draft, scenarioId: scenario.scenarioId },
      }
      const screen = buildScreenViewModelV2(state, content, [])

      expect(screen.options, scenario.scenarioId).toHaveLength(1)
      expect(screen.options[0]?.label, scenario.scenarioId).toBe(rewrites.get(scenario.rewriteId)?.discouragedExpressions[0])
      expect(screen.options[0]?.label, scenario.scenarioId).not.toMatch(/直接指责|用了“总是/)
    }
  })

  it('removes ordinary practice choices from the safety page', () => {
    const state = {
      ...createInitialReplayStateV2(),
      page: 'safety' as const,
      draft: { ...createInitialReplayStateV2().draft, scenarioId: 'friend-late', conflictLevel: 'safety' as const },
    }
    const screen = buildScreenViewModelV2(state, content, [])

    expect(screen.options).toEqual([])
    expect(screen.sections.some(({ id }) => id === 'safety-actions')).toBe(true)
    expect(screen.companion.pose).toBe('safety')
    expect(screen.companion.reassurance).toContain('现实')
    expect(`${screen.companion.invitation}${screen.companion.reassurance}`).not.toContain('演练')
  })

  it('uses plain and capability-accurate guidance across the flow', () => {
    const visibleCopy = pages.map((page) => {
      const screen = buildScreenViewModelV2({ ...createInitialReplayStateV2(), page }, content, [])
      return JSON.stringify(screen)
    }).join('\n')

    expect(visibleCopy).not.toMatch(/冻结情境|虚拟角色|复制最终表达/)
    expect(buildScreenViewModelV2({ ...createInitialReplayStateV2(), page: 'guide', guideStep: 2 }, content, []).primaryLabel).toBe('开始定位情境')
  })
})
