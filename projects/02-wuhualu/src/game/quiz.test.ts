import { describe, expect, it } from 'vitest'
import rawContent from '../content/content.json'
import { parseContent } from '../content/validate.ts'
import type { Artifact, DistractorCandidate } from '../content/types.ts'
import { createQuizQuestion, isQuizGenerationError, selectRoundArtifacts } from './quiz.ts'

const content = parseContent(rawContent)
const artifacts = content.content.artifacts
const candidates = content.content.distractorCandidates

describe('seeded round selection', () => {
  it('reproduces the same five-artifact order for the same seed', () => {
    const first = selectRoundArtifacts(artifacts, 'daily-2026-08-24', [], 5).map(({ id }) => id)
    const second = selectRoundArtifacts(artifacts, 'daily-2026-08-24', [], 5).map(({ id }) => id)
    expect(first).toEqual(second)
    expect(first).toHaveLength(5)
    expect(new Set(first).size).toBe(5)
  })

  it('places enough non-recent artifacts before recent ones on replay', () => {
    const recentIds = artifacts.slice(0, 8).map(({ id }) => id)
    const selected = selectRoundArtifacts(artifacts, 'replay-seed', recentIds, 5)
    expect(selected.every(({ id }) => !recentIds.includes(id))).toBe(true)
  })
})

describe('quiz option generation', () => {
  it('always returns four unique options with exactly one correct answer', () => {
    for (const target of artifacts) {
      const result = createQuizQuestion(target, candidates, `question-${target.id}`)
      expect(isQuizGenerationError(result)).toBe(false)
      if (isQuizGenerationError(result)) throw new Error(result.message)
      expect(result.options).toHaveLength(4)
      expect(new Set(result.options.map(({ label }) => label)).size).toBe(4)
      expect(result.options.filter(({ isCorrect }) => isCorrect)).toHaveLength(1)
      expect(result.options.some(({ id }) => id === result.correctOptionId)).toBe(true)
    }
  })

  it('reproduces option order from the injected seed', () => {
    const first = createQuizQuestion(artifacts[0], candidates, 'same-seed')
    const second = createQuizQuestion(artifacts[0], candidates, 'same-seed')
    expect(first).toEqual(second)
  })

  it('uses a structured fallback error when fewer than three distractors exist', () => {
    const target: Artifact = artifacts[0]
    const tooSmall: DistractorCandidate[] = [
      { id: 'option-only-one', label: '唯一候选', tags: ['shape'], forArtifactIds: [target.id] },
    ]
    const result = createQuizQuestion(target, tooSmall, 'small-pool')
    expect(result).toEqual({
      kind: 'quiz-generation-error',
      code: 'insufficient-distractors',
      artifactId: target.id,
      message: `无法为${target.name}生成三个不重复干扰项`,
    })
  })

  it('never displays a documented but ineligible same-object candidate', () => {
    const target = artifacts[0]
    const pool: DistractorCandidate[] = [
      { id: 'option-ineligible', label: '同器另一件', tags: ['shape'], forArtifactIds: [target.id], eligible: false, note: '同器物不得作普通错误项' },
      { id: 'option-one', label: '候选一', tags: ['shape'], forArtifactIds: [target.id] },
      { id: 'option-two', label: '候选二', tags: ['shape'], forArtifactIds: [target.id] },
      { id: 'option-three', label: '候选三', tags: ['shape'], forArtifactIds: [target.id] },
    ]
    const result = createQuizQuestion(target, pool, 'ineligible')
    if (isQuizGenerationError(result)) throw new Error(result.message)
    expect(result.options.map(({ label }) => label)).not.toContain('同器另一件')
  })
})
