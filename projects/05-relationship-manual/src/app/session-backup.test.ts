import { describe, expect, it } from 'vitest'
import type { QuestionnaireAnswer, RelationshipQuestion } from '../content/schema'
import { buildSessionBackupText } from './session-backup'

const questions = [{
  questionId: 'close-contact-busy',
  prompt: '忙碌时，你希望怎样保持联系？',
  options: [
    { optionId: 'brief', text: '简短说一声' },
    { optionId: 'later', text: '之后认真聊' },
  ],
}] as RelationshipQuestion[]

describe('session backup', () => {
  it('builds a selectable plain-text answer backup without media data', () => {
    const answers: QuestionnaireAnswer[] = [{
      questionId: 'close-contact-busy', optionIds: ['brief'], skipped: false, updatedAt: '2026-08-26T00:00:00.000Z',
    }]

    const text = buildSessionBackupText('亲密关系', questions, answers, null)

    expect(text).toContain('关系说明书 · 当前会话备份')
    expect(text).toContain('亲密关系')
    expect(text).toContain('忙碌时，你希望怎样保持联系？')
    expect(text).toContain('简短说一声')
    expect(text).not.toMatch(/data:image|;base64,|blob:/u)
  })

  it('includes generated result paragraphs when a card exists', () => {
    const text = buildSessionBackupText('好友关系', [], [], {
      title: '我希望被这样对待',
      relationshipLabel: '好友关系',
      shareSummary: '摘要',
      disclaimer: '说明',
      contentVersion: '3.1.0',
      sections: [{
        sectionId: 'contact', title: '回信的节奏', paragraphs: ['希望重要消息最终有回应。'],
        paragraphRoles: ['need'], paragraphIds: ['one'], paragraphSourceTextKeys: [null],
        paragraphProvenanceIds: [[]], sensitive: false, visible: true, order: 0,
      }],
    })

    expect(text).toContain('【回信的节奏】')
    expect(text).toContain('希望重要消息最终有回应。')
  })

  it('backs up edited visible card items instead of stale generated paragraphs', () => {
    const baseCard = {
      title: '我希望被这样对待', relationshipLabel: '好友关系', shareSummary: '摘要', disclaimer: '说明', contentVersion: '3.1.0',
      sections: [{
        sectionId: 'contact' as const, title: '回信的节奏', paragraphs: ['旧文字', '需要隐藏'],
        paragraphRoles: ['need' as const, 'action' as const], paragraphIds: ['one', 'two'],
        paragraphSourceTextKeys: [null, null], paragraphProvenanceIds: [[], []], sensitive: false, visible: true, order: 0,
      }],
    }
    const text = buildSessionBackupText('好友关系', [], [], baseCard, [
      { itemId: 'one', sectionId: 'contact', role: 'need', provenanceIds: [], suggestedText: '旧文字', editedText: '我的手工改写', visible: true, sensitive: false, order: 1, needsReview: false },
      { itemId: 'two', sectionId: 'contact', role: 'action', provenanceIds: [], suggestedText: '需要隐藏', editedText: '隐藏后的文字', visible: false, sensitive: false, order: 0, needsReview: false },
    ])

    expect(text).toContain('我的手工改写')
    expect(text).not.toContain('旧文字')
    expect(text).not.toContain('隐藏后的文字')
  })
})
