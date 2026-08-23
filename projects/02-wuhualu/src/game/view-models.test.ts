import { describe, expect, it } from 'vitest'
import rawContent from '../content/content.json'
import { parseContent } from '../content/validate.ts'
import type { QuizSession } from '../content/types.ts'
import { buildArtifactDetailViewModel, buildRoundSummaryViewModel } from './view-models.ts'

const content = parseContent(rawContent)

describe('artifact detail view model', () => {
  it('contains every fact, collection, asset, and verification field needed by the page', () => {
    const artifact = content.content.artifacts[0]
    const model = buildArtifactDetailViewModel(
      artifact,
      { artifactId: artifact.id, bestStars: 2, unlockedAt: '2026-08-24T00:00:00.000Z' },
      content.content.categories,
      { verified: '来源已确认测试', pending: '来源待确认测试' },
    )
    expect(model).toMatchObject({
      id: artifact.id,
      title: artifact.name,
      subtitle: `${artifact.period} · ${artifact.material}`,
      unlocked: true,
      bestStars: 2,
      asset: artifact.assetRefs,
    })
    expect(model.categoryNames.length).toBeGreaterThan(0)
    expect(model.facts).toEqual([artifact.summary, artifact.highlight, artifact.culturalNote])
    expect(model.verificationLabel.length).toBeGreaterThan(0)
    expect(model.verificationLabel).toBe('来源已确认测试')
  })
})

describe('round summary view model', () => {
  it('summarizes a five-answer session with a hand-checked streak', () => {
    const ids = content.content.artifacts.slice(0, 5).map(({ id }) => id)
    const session: QuizSession = {
      seed: 'summary', artifactIds: ids, index: 5, revealedClueIds: [], score: 720, streak: 1,
      answers: [
        { artifactId: ids[0], optionId: 'a', correct: true, additionalCluesUsed: 0, stars: 3, points: 300 },
        { artifactId: ids[1], optionId: 'b', correct: true, additionalCluesUsed: 1, stars: 2, points: 210 },
        { artifactId: ids[2], optionId: 'c', correct: false, additionalCluesUsed: 2, stars: 1, points: 0 },
        { artifactId: ids[3], optionId: 'd', correct: true, additionalCluesUsed: 2, stars: 1, points: 100 },
        { artifactId: ids[4], optionId: 'e', correct: true, additionalCluesUsed: 2, stars: 1, points: 110 },
      ],
    }
    expect(buildRoundSummaryViewModel(session, {
      title: '总结标题测试', perfect: '全对测试', high: '高分测试', mid: '中段测试', low: '低段测试',
    })).toEqual({
      title: '总结标题测试', score: 720, correctCount: 4, totalCount: 5, bestStreak: 2,
      earnedStars: 8, unlockedArtifactIds: ids, collectorTitle: '高分测试',
    })
  })
})
