import { describe, expect, it } from 'vitest'
import type { QuestionnaireAnswer, RelationshipCardViewModel } from '../content/schema'
import { createInitialState, relationshipReducer } from './state'
import type { RelationshipState } from './state'

const now = '2026-08-24T00:00:00.000Z'
const answer: QuestionnaireAnswer = {
  questionId: 'question-busy-contact',
  optionIds: ['option-busy-brief'],
  skipped: false,
  updatedAt: now,
}
const card: RelationshipCardViewModel = {
  title: '我希望被这样对待',
  relationshipLabel: '好友关系',
  sections: [{ sectionId: 'companion', title: '我希望你这样陪伴我', paragraphs: ['原始建议'], paragraphIds: ['text:companion'], paragraphSourceTextKeys: ['companion'], paragraphProvenanceIds: [['question:option']], sensitive: false, visible: true, order: 0 }],
  shareSummary: '分享摘要',
  disclaimer: '沟通辅助说明',
  contentVersion: '1.0.0',
}

describe('relationship state reducer', () => {
  it('moves through landing, intro, questionnaire, review, result, edit, and saved result', () => {
    let state = createInitialState()
    state = relationshipReducer(state, { type: 'OPEN_INTRO' })
    state = relationshipReducer(state, { type: 'BEGIN', relationshipContext: 'friendship' })
    state = relationshipReducer(state, { type: 'SET_ANSWER', answer })
    state = relationshipReducer(state, { type: 'OPEN_REVIEW', missingRequiredQuestionIds: [] })
    state = relationshipReducer(state, { type: 'GENERATE', card, generatedAt: now })
    state = relationshipReducer(state, { type: 'EDIT_CARD' })
    state = relationshipReducer(state, { type: 'SAVE_RESULT' })

    expect(state.page).toBe('savedResult')
    expect(state.relationshipContext).toBe('friendship')
    expect(state.lastResult).toEqual(card)
  })

  it('supports previous question and blocks review when required answers are missing', () => {
    let state: RelationshipState = { ...createInitialState(), page: 'questionnaire', currentQuestionIndex: 4 }
    state = relationshipReducer(state, { type: 'PREVIOUS_QUESTION' })
    state = relationshipReducer(state, { type: 'OPEN_REVIEW', missingRequiredQuestionIds: ['question-busy-contact'] })

    expect(state.page).toBe('questionnaire')
    expect(state.currentQuestionIndex).toBe(3)
    expect(state.error).toBe('还有必答题未完成。')
  })

  it('stores an explicit skipped answer and advances to the next question', () => {
    const skipped: QuestionnaireAnswer = { questionId: 'question-conflict-tone', optionIds: [], skipped: true, updatedAt: now }
    const state = relationshipReducer(
      { ...createInitialState(), page: 'questionnaire' },
      { type: 'SET_ANSWER_AND_NEXT', answer: skipped, questionCount: 16 },
    )

    expect(state.answers).toEqual([skipped])
    expect(state.currentQuestionIndex).toBe(1)
  })

  it('edits, hides, and reorders card items without losing the edited text', () => {
    let state = relationshipReducer(createInitialState(), { type: 'GENERATE', card, generatedAt: now })
    const itemId = state.cardItems[0]!.itemId
    state = relationshipReducer(state, { type: 'EDIT_ITEM', itemId, text: '我修改后的表达。' })
    state = relationshipReducer(state, { type: 'TOGGLE_ITEM', itemId })
    state = relationshipReducer(state, { type: 'MOVE_ITEM', itemId, direction: 1 })

    expect(state.cardItems[0]).toMatchObject({ editedText: '我修改后的表达。', visible: false })
  })

  it('restores a draft and clears back to a fresh landing state', () => {
    const draft = {
      schemaVersion: 1 as const,
      contentVersion: '1.0.0',
      updatedAt: now,
      page: 'questionnaire' as const,
      relationshipContext: 'friendship' as const,
      currentQuestionIndex: 6,
      answers: [answer],
      cardItems: [],
      lastResult: null,
      settings: { compactMode: false, showSensitiveInCompact: false },
    }
    const restored = relationshipReducer(createInitialState(true), { type: 'RESTORE', draft })
    const cleared = relationshipReducer(restored, { type: 'CLEAR_ALL' })

    expect(restored).toMatchObject({ page: 'questionnaire', currentQuestionIndex: 6, answers: [answer] })
    expect(cleared).toEqual(createInitialState())
  })

  it('does not begin a new session over an existing draft without clearing first', () => {
    const blocked = relationshipReducer(createInitialState(true), { type: 'BEGIN', relationshipContext: 'friendship' })

    expect(blocked.page).toBe('landing')
    expect(blocked.hasDraft).toBe(true)
    expect(blocked.error).toBe('请先确认是否清除已有草稿。')
  })
})
