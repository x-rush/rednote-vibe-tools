import { describe, expect, it } from 'vitest'
import type { DraftPayload } from '../content/schema'
import { getValidatedContent } from '../content/validate'
import { clearDraft, loadDraft, saveDraft, STORAGE_KEY } from './storage'

class MemoryStorage implements Storage {
  private values = new Map<string, string>()
  get length() { return this.values.size }
  clear() { this.values.clear() }
  getItem(key: string) { return this.values.get(key) ?? null }
  key(index: number) { return [...this.values.keys()][index] ?? null }
  removeItem(key: string) { this.values.delete(key) }
  setItem(key: string, value: string) { this.values.set(key, value) }
}

const now = '2026-08-24T00:00:00.000Z'
const content = getValidatedContent()
const draft: DraftPayload = {
  schemaVersion: 2,
  contentVersion: '2.0.0',
  updatedAt: now,
  page: 'questionnaire',
  relationshipContext: 'close-relationship',
  currentQuestionIndex: 3,
  seenChapterIds: ['contact'],
  answers: [{ questionId: 'question-busy-contact', optionIds: ['option-busy-brief'], skipped: false, updatedAt: now }],
  cardItems: [],
  lastResult: null,
  settings: { compactMode: false, showSensitiveInCompact: false },
}

describe('draft storage', () => {
  it('migrates a v1 draft without losing stable answers or hand edits', () => {
    const storage = new MemoryStorage()
    const { seenChapterIds: _seenChapterIds, ...draftWithoutV2Fields } = draft
    const legacyDraft = {
      ...draftWithoutV2Fields,
      schemaVersion: 1,
      contentVersion: '1.0.0',
      cardItems: [{
        itemId: 'text:pref-space', sectionId: 'companion', sourceTextKey: 'pref-space',
        provenanceIds: ['question-alone-space:option-space-full'], suggestedText: '旧建议', editedText: '我的旧改写',
        visible: true, sensitive: false, order: 0, needsReview: false,
      }],
    }
    storage.setItem('xhs-tool:relationship-manual:state:v1', JSON.stringify(legacyDraft))

    const result = loadDraft(storage, content.contentVersion, {
      questionsById: new Map(content.content.questions.map((question) => [question.questionId, question])),
      sentenceSectionByTextKey: new Map(content.content.sentenceFragments.map((sentence) => [sentence.textKey, sentence.cardSectionId])),
      sentenceRoleByTextKey: new Map(content.content.sentenceFragments.map((sentence) => [sentence.textKey, sentence.role])),
    })

    expect(result.status).toBe('ok')
    if (result.status !== 'ok') return
    expect(result.payload.schemaVersion).toBe(2)
    expect(result.payload.answers.map((item) => item.questionId)).toContain('question-busy-contact')
    expect(result.payload.cardItems.find((item) => item.itemId === 'text:pref-space')).toMatchObject({
      sectionId: 'space', role: 'need', editedText: '我的旧改写', needsReview: true,
    })
    expect(result.payload.seenChapterIds).toEqual([])
  })

  it('saves and restores one bounded draft envelope', () => {
    const storage = new MemoryStorage()
    expect(saveDraft(storage, draft)).toEqual({ ok: true })
    expect(loadDraft(storage, '2.0.0')).toEqual({ status: 'ok', payload: draft, contentChanged: false })
    expect(storage.length).toBe(1)
  })

  it('reports corrupted JSON without silently deleting the original', () => {
    const storage = new MemoryStorage()
    storage.setItem(STORAGE_KEY, '{broken')

    expect(loadDraft(storage, '2.0.0')).toEqual({ status: 'corrupt', reason: 'invalid-json' })
    expect(storage.getItem(STORAGE_KEY)).toBe('{broken')
  })

  it('reports structurally malformed nested data instead of throwing', () => {
    const storage = new MemoryStorage()
    storage.setItem(STORAGE_KEY, JSON.stringify({ ...draft, cardItems: [{}] }))

    expect(() => loadDraft(storage, '2.0.0')).not.toThrow()
    expect(loadDraft(storage, '2.0.0')).toEqual({ status: 'corrupt', reason: 'invalid-payload' })
  })

  it('reports unavailable storage when reading is blocked', () => {
    const storage = { getItem() { throw new DOMException('blocked') } }

    expect(loadDraft(storage, '2.0.0')).toEqual({ status: 'unavailable' })
  })

  it('rejects an unknown future schema version', () => {
    const storage = new MemoryStorage()
    storage.setItem(STORAGE_KEY, JSON.stringify({ ...draft, schemaVersion: 9 }))

    expect(loadDraft(storage, '2.0.0')).toEqual({ status: 'unsupported-version', schemaVersion: 9 })
  })

  it('restores known IDs after a content update and drops stale answer references', () => {
    const storage = new MemoryStorage()
    saveDraft(storage, {
      ...draft,
      contentVersion: '0.9.0',
      answers: [...draft.answers, { questionId: 'question-removed', optionIds: ['option-removed'], skipped: false, updatedAt: now }],
    })

    const result = loadDraft(storage, '2.0.0', {
      questionsById: new Map(content.content.questions
        .filter((question) => question.questionId === 'question-busy-contact')
        .map((question) => [question.questionId, question])),
    })

    expect(result.status).toBe('ok')
    if (result.status === 'ok') {
      expect(result.contentChanged).toBe(true)
      expect(result.payload.answers).toEqual(draft.answers)
      expect(result.payload.lastResult).toBeNull()
      expect(result.payload.page).toBe('review')
      expect(result.payload.contentVersion).toBe('2.0.0')
    }
  })

  it('drops an option that exists globally but belongs to a different question', () => {
    const storage = new MemoryStorage()
    saveDraft(storage, {
      ...draft,
      answers: [{ ...draft.answers[0]!, optionIds: ['option-care-action'] }],
    })

    const result = loadDraft(storage, '2.0.0', {
      questionsById: new Map(content.content.questions.map((question) => [question.questionId, question])),
    })

    expect(result.status).toBe('ok')
    if (result.status === 'ok') expect(result.payload.answers).toEqual([])
  })

  it('rejects restored answers that skip required questions or violate selection rules', () => {
    const storage = new MemoryStorage()
    const question = structuredClone(content.content.questions.find((item) => item.questionId === 'question-conflict-tone')!)
    question.skipRule.allowed = false
    question.options[2]!.exclusive = true
    saveDraft(storage, {
      ...draft,
      answers: [
        { questionId: question.questionId, optionIds: [], skipped: true, updatedAt: now },
        { questionId: question.questionId, optionIds: [question.options[0]!.optionId, question.options[0]!.optionId], skipped: false, updatedAt: now },
        { questionId: question.questionId, optionIds: [question.options[0]!.optionId, question.options[2]!.optionId], skipped: false, updatedAt: now },
      ],
    })

    const result = loadDraft(storage, '2.0.0', { questionsById: new Map([[question.questionId, question]]) })

    expect(result.status).toBe('ok')
    if (result.status === 'ok') expect(result.payload.answers).toEqual([])
  })

  it('rejects an oversized nested result envelope', () => {
    const storage = new MemoryStorage()
    const oversized = {
      ...draft,
      lastResult: {
        title: '我希望被这样对待', relationshipLabel: '好友关系', shareSummary: '摘要', disclaimer: '说明', contentVersion: '2.0.0',
        sections: Array.from({ length: 8 }, (_, order) => ({
          sectionId: 'care' as const, title: '关心', paragraphs: ['建议'], paragraphIds: [`text:${order}`],
          paragraphRoles: ['need' as const], paragraphSourceTextKeys: ['care'], paragraphProvenanceIds: [[`source:${order}`]], sensitive: false, visible: true, order,
        })),
      },
    }

    expect(saveDraft(storage, oversized)).toEqual({ ok: false, error: 'payload-too-large' })
  })

  it('refuses media-like data and limits edited text to 120 characters', () => {
    const storage = new MemoryStorage()
    const unsafe = {
      ...draft,
      cardItems: [{
        itemId: 'item-1', sectionId: 'care' as const, role: 'need' as const, suggestedText: '建议', editedText: `data:image/png;base64,${'a'.repeat(130)}`,
        visible: true, sensitive: false, order: 0, needsReview: false, provenanceIds: ['question:option'],
      }],
    }

    expect(saveDraft(storage, unsafe)).toEqual({ ok: false, error: 'forbidden-media' })
    expect(storage.length).toBe(0)
  })

  it('clears only this project key', () => {
    const storage = new MemoryStorage()
    storage.setItem(STORAGE_KEY, JSON.stringify(draft))
    storage.setItem('xhs-tool:another-project:state:v1', 'keep')
    clearDraft(storage)

    expect(storage.getItem(STORAGE_KEY)).toBeNull()
    expect(storage.getItem('xhs-tool:another-project:state:v1')).toBe('keep')
  })

  it('does not crash the recovery page when storage deletion is blocked', () => {
    const storage = { removeItem() { throw new DOMException('blocked') } }

    expect(clearDraft(storage)).toBe(false)
  })

  it('migrates a semantically equivalent V2 answer into the selected V3 bank', () => {
    const storage = new MemoryStorage()
    storage.setItem(STORAGE_KEY, JSON.stringify({
      ...draft,
      relationshipContext: 'friendship',
      contentVersion: '2.0.0',
      answers: [{
        questionId: 'question-message-delay',
        optionIds: ['option-delay-estimate'],
        skipped: false,
        updatedAt: now,
      }],
    }))

    const result = loadDraft(storage, content as never)

    expect(result.status).toBe('ok')
    if (result.status !== 'ok') return
    expect(result.payload.answers).toEqual([expect.objectContaining({
      questionId: 'friend-contact-delay',
      optionIds: ['friend-contact-delay-estimate'],
    })])
    expect(result.migration).toEqual({
      preservedAnswerCount: 1,
      needsAnswerQuestionIds: expect.arrayContaining(['friend-contact-frequency']),
    })
    expect(result.migration?.needsAnswerQuestionIds).toHaveLength(20)
  })

  it('drops an answer whose IDs belong to a different relationship bank', () => {
    const storage = new MemoryStorage()
    const closeQuestion = content.content.relationshipBanks!['close-relationship'].questions[0]!
    storage.setItem(STORAGE_KEY, JSON.stringify({
      ...draft,
      contentVersion: '3.0.0',
      relationshipContext: 'family',
      answers: [{
        questionId: closeQuestion.questionId,
        optionIds: [closeQuestion.options[0]!.optionId],
        skipped: false,
        updatedAt: now,
      }],
    }))

    const result = loadDraft(storage, content as never)

    expect(result.status).toBe('ok')
    if (result.status === 'ok') expect(result.payload.answers).toEqual([])
  })
})
