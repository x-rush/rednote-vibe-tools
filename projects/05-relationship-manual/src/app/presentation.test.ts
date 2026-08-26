import { describe, expect, it } from 'vitest'
import { getValidatedContent } from '../content/validate'
import { getRelationshipBank } from '../content/bank'
import type { QuestionnaireAnswer } from '../content/schema'
import { buildTopicProgress, getCardSectionArtwork, resetViewport } from './presentation'

const content = getValidatedContent()
const now = '2026-08-26T00:00:00.000Z'

function answerQuestion(questionId: string, optionId: string): QuestionnaireAnswer {
  return { questionId, optionIds: [optionId], skipped: false, updatedAt: now }
}

describe('editorial presentation model', () => {
  it('groups the real questionnaire into seven topics and marks the active topic', () => {
    const questions = getRelationshipBank(content, 'close-relationship').questions
    const answers = [
      answerQuestion('close-contact-busy', 'close-contact-busy-brief'),
      answerQuestion('close-contact-delay', 'close-contact-delay-estimate'),
      answerQuestion('close-contact-plan-change', 'close-contact-plan-change-early'),
    ]

    const topics = buildTopicProgress(questions, 3, answers)

    expect(topics).toHaveLength(7)
    expect(topics.map((topic) => topic.category)).toEqual([
      'contact',
      'listening',
      'conflict',
      'space',
      'care',
      'boundary',
      'repair',
    ])
    expect(topics[0]).toMatchObject({ label: '联系', status: 'complete', answeredCount: 3, questionCount: 3 })
    expect(topics[1]).toMatchObject({ label: '倾听', status: 'current', answeredCount: 0, questionCount: 3 })
    expect(topics[6]).toMatchObject({ label: '修复', status: 'upcoming', questionCount: 3 })
  })

  it('provides artwork for every section rendered by the relationship card', () => {
    const artwork = content.content.cardRules.sections.map((section) => getCardSectionArtwork(section.sectionId))

    expect(artwork).toHaveLength(7)
    expect(artwork.every((item) => item.iconUrl.length > 0 && item.shortLabel.length > 0)).toBe(true)
  })

  it('resets a newly opened page to the top-left edge', () => {
    const calls: ScrollToOptions[] = []

    resetViewport((options) => calls.push(options))

    expect(calls).toEqual([{ top: 0, left: 0, behavior: 'auto' }])
  })
})
