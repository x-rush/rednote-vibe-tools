import type { EditableCardItem, QuestionnaireAnswer, RelationshipCardViewModel, RelationshipQuestion } from '../content/schema'
import { buildDisplayCard } from './view-model'

export function buildSessionBackupText(
  relationshipLabel: string,
  questions: RelationshipQuestion[],
  answers: QuestionnaireAnswer[],
  card: RelationshipCardViewModel | null,
  cardItems?: EditableCardItem[],
): string {
  const answerByQuestionId = new Map(answers.map((answer) => [answer.questionId, answer]))
  const answerLines = questions.flatMap((question, index) => {
    const answer = answerByQuestionId.get(question.questionId)
    if (!answer) return []
    const selected = answer.skipped
      ? '暂不确定'
      : question.options.filter((option) => answer.optionIds.includes(option.optionId)).map((option) => option.text).join('、')
    return [`${index + 1}. ${question.prompt}\n${selected || '未记录'}`]
  })
  const currentCard = card && cardItems && cardItems.length > 0
    ? buildDisplayCard(card, cardItems, false, true)
    : card
  const cardLines = currentCard?.sections.filter((section) => section.visible).flatMap((section) => [
    `【${section.title}】`,
    ...section.paragraphs,
  ]) ?? []
  return [
    '关系说明书 · 当前会话备份',
    `关系语境：${relationshipLabel}`,
    '',
    ...(answerLines.length > 0 ? ['已记录的回答', ...answerLines] : []),
    ...(cardLines.length > 0 ? ['', '已生成的说明书', ...cardLines] : []),
    '',
    '提示：当前存储不可用，关闭页面后本次进度不会保留。请长按选择文字手动复制，或直接截图保存。',
  ].join('\n')
}
