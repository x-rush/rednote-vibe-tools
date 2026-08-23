import { describe, expect, it } from 'vitest'
import { getValidatedContent } from '../content/validate'
import type { EditableCardItem, RelationshipCardViewModel } from '../content/schema'
import { buildDisplayCard, findMissingRequiredQuestions, reconcileCardItems } from './view-model'

const content = getValidatedContent()
const baseCard: RelationshipCardViewModel = {
  title: '我希望被这样对待',
  relationshipLabel: '亲密关系',
  sections: [
    { sectionId: 'care', title: '表达关心可以这样做', paragraphs: ['建议一', '建议二'], paragraphIds: ['text:care-one', 'text:care-two'], paragraphSourceTextKeys: ['care-one', 'care-two'], paragraphProvenanceIds: [['q1:o1'], ['q2:o2']], sensitive: false, visible: true, order: 0 },
    { sectionId: 'avoid', title: '请尽量不要', paragraphs: ['敏感边界'], paragraphIds: ['text:avoid-one'], paragraphSourceTextKeys: ['avoid-one'], paragraphProvenanceIds: [['q3:o3']], sensitive: true, visible: true, order: 1 },
  ],
  shareSummary: '摘要',
  disclaimer: '说明',
  contentVersion: '1.0.0',
}

const items: EditableCardItem[] = [
  { itemId: 'text:care-one', sectionId: 'care', suggestedText: '建议一', editedText: '建议一', visible: true, sensitive: false, order: 0, needsReview: false, provenanceIds: ['q1:o1'] },
  { itemId: 'text:care-two', sectionId: 'care', suggestedText: '建议二', editedText: '建议二', visible: true, sensitive: false, order: 1, needsReview: false, provenanceIds: ['q2:o2'] },
  { itemId: 'text:avoid-one', sectionId: 'avoid', suggestedText: '敏感边界', editedText: '敏感边界', visible: true, sensitive: true, order: 2, needsReview: false, provenanceIds: ['q3:o3'] },
]

describe('page view model helpers', () => {
  it('reports required questions but accepts explicitly skipped optional questions', () => {
    const answers = [
      { questionId: 'question-busy-contact', optionIds: ['option-busy-brief'], skipped: false, updatedAt: '2026-08-24T00:00:00.000Z' },
      { questionId: 'question-conflict-tone', optionIds: [], skipped: true, updatedAt: '2026-08-24T00:00:00.000Z' },
      { questionId: 'question-space-not-rejection', optionIds: [], skipped: true, updatedAt: '2026-08-24T00:00:00.000Z' },
    ]

    const missing = findMissingRequiredQuestions(content.content.questions, answers)

    expect(missing).not.toContain('question-busy-contact')
    expect(missing).not.toContain('question-conflict-tone')
    expect(missing).toContain('question-message-delay')
  })

  it('does not let a restored skip marker satisfy a required question', () => {
    const missing = findMissingRequiredQuestions(content.content.questions, [{
      questionId: 'question-busy-contact', optionIds: [], skipped: true, updatedAt: '2026-08-24T00:00:00.000Z',
    }])

    expect(missing).toContain('question-busy-contact')
  })

  it('keeps full preview content but excludes sensitive items from compact preview by default', () => {
    const full = buildDisplayCard(baseCard, items, false, false)
    const compact = buildDisplayCard(baseCard, items, true, false)
    const compactWithSensitive = buildDisplayCard(baseCard, items, true, true)

    expect(full.sections.flatMap((section) => section.paragraphs)).toEqual(['建议一', '建议二', '敏感边界'])
    expect(compact.sections.flatMap((section) => section.paragraphs)).toEqual(['建议一'])
    expect(compactWithSensitive.sections.flatMap((section) => section.paragraphs)).toEqual(['建议一', '敏感边界'])
  })

  it('preserves edited text and marks it for review when regeneration changes the suggestion', () => {
    const previous = [{ ...items[0]!, editedText: '我的手工改写' }]
    const regenerated = [{ ...items[0]!, suggestedText: '新的建议', editedText: '新的建议' }]

    expect(reconcileCardItems(previous, regenerated)).toEqual([{
      ...regenerated[0],
      editedText: '我的手工改写',
      visible: true,
      needsReview: true,
    }])
  })

  it('retains an edited item as review-required when regeneration no longer suggests it', () => {
    const previous = [{ ...items[0]!, editedText: '我仍想保留的表达' }]

    expect(reconcileCardItems(previous, [])).toEqual([{
      ...previous[0],
      needsReview: true,
    }])
  })

  it('matches edits by semantic ID when regenerated order changes', () => {
    const previous = [
      { ...items[0]!, editedText: '第一条的改写' },
      items[1]!,
    ]
    const regenerated = [
      { ...items[1]!, order: 0 },
      { ...items[0]!, order: 1 },
    ]

    const result = reconcileCardItems(previous, regenerated)
    expect(result.find((item) => item.itemId === 'text:care-one')?.editedText).toBe('第一条的改写')
    expect(result.find((item) => item.itemId === 'text:care-two')?.editedText).toBe('建议二')
  })
})
