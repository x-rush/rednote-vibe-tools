import { describe, expect, it } from 'vitest'
import rawContent from '../content/content.json'
import { parseContent } from '../content/validate'
import { buildReplayResult } from '../domain/result'
import { initialReplayState, type ReplayPage, type ReplayState } from '../state/replayState'
import { buildSavedReplayViewModels, buildScreenViewModel } from './view'

const content = parseContent(rawContent)
const result = buildReplayResult({
  relationshipType: 'friend',
  communicationGoal: 'coordinate',
  conflictLevel: 'medium',
  emotionId: 'feel-uneasy',
  originalExpressionId: 'expr-accusation',
  responseId: 'response-discussed',
  intention: 'repair-now',
}, content)

describe('semantic screen view models', () => {
  it('resolves saved replay titles in the presentation model', () => {
    const saved = buildSavedReplayViewModels([{
      id: 'save-view',
      savedAt: '2026-08-24T00:00:00.000Z',
      answers: {
        relationshipType: 'friend', communicationGoal: 'coordinate', conflictLevel: 'medium',
        emotionId: 'feel-uneasy', originalExpressionId: 'expr-accusation', responseId: 'response-discussed',
        intention: 'repair-now', scenarioId: 'friend-late',
      },
      scenarioId: 'friend-late',
    }], content)

    expect(saved[0]?.scenarioTitle).toBe('朋友迟到')
  })
  it.each([
    ['landing', '当时这样说就好了'],
    ['intro', '先说好：这次复盘由你掌握'],
    ['scenarioSelect', '哪一种情境更接近当时？'],
    ['comparison', '原表达和新结构，差在哪里？'],
    ['result', '如果再说一次'],
    ['savedResults', '保存在本机的复盘'],
    ['safetyNotice', '先把安全放在表达前面'],
    ['error', '这次没有顺利打开'],
  ] as const)('builds the %s page', (page, title) => {
    const state: ReplayState = { ...initialReplayState, page: page as ReplayPage, result, error: '测试错误' }
    expect(buildScreenViewModel(state, content).title).toBe(title)
  })

  it('builds every wizard step from structured content choices', () => {
    const steps = ['relationship', 'goal', 'conflict', 'emotion', 'expression', 'response', 'intention'] as const
    const optionCounts = steps.map((wizardStep) => buildScreenViewModel({
      ...initialReplayState,
      page: 'replayWizard',
      wizardStep,
    }, content).options.length)

    expect(optionCounts).toEqual([5, 5, 4, 48, 8, 6, 2])
  })

  it('shows all 32 scenarios plus the option-driven fallback entry', () => {
    const screen = buildScreenViewModel({ ...initialReplayState, page: 'scenarioSelect' }, content)
    expect(screen.options).toHaveLength(33)
    expect(screen.options.at(-1)?.id).toBe('scenario-unsure')
  })

  it('exposes result content without components reaching into raw content', () => {
    const screen = buildScreenViewModel({ ...initialReplayState, page: 'result', result }, content)
    expect(screen.sections.length).toBeGreaterThan(0)
    expect(screen.toneCards).toHaveLength(3)
  })
})
