import type {
  EditableCardItem,
  QuestionnaireAnswer,
  RelationshipCardViewModel,
  RelationshipQuestion,
} from '../content/schema'
import { validateSelection } from '../domain/answers'

export function findMissingRequiredQuestions(
  questions: RelationshipQuestion[],
  answers: QuestionnaireAnswer[],
): string[] {
  const questionById = new Map(questions.map((question) => [question.questionId, question]))
  const answeredIds = new Set(answers.filter((answer) => {
    const question = questionById.get(answer.questionId)
    return question ? validateSelection(question, answer.optionIds, answer.skipped).valid : false
  }).map((answer) => answer.questionId))
  return questions
    .filter((question) => !question.skipRule.allowed && !answeredIds.has(question.questionId))
    .map((question) => question.questionId)
}

export function reconcileCardItems(
  previousItems: EditableCardItem[],
  regeneratedItems: EditableCardItem[],
): EditableCardItem[] {
  const previousById = new Map(previousItems.map((item) => [item.itemId, item]))
  const regeneratedIds = new Set(regeneratedItems.map((item) => item.itemId))
  const reconciled = regeneratedItems.map((item) => {
    const previous = previousById.get(item.itemId)
    if (!previous) return item
    const wasEdited = previous.editedText !== previous.suggestedText
    return {
      ...item,
      editedText: wasEdited ? previous.editedText : item.editedText,
      visible: previous.visible,
      order: previous.order,
      needsReview: wasEdited && previous.suggestedText !== item.suggestedText,
    }
  })
  const editedOrphans = previousItems
    .filter((item) => !regeneratedIds.has(item.itemId) && item.editedText !== item.suggestedText)
    .map((item) => ({ ...item, needsReview: true }))
  return [...reconciled, ...editedOrphans].sort((a, b) => a.order - b.order)
}

export function buildDisplayCard(
  baseCard: RelationshipCardViewModel,
  items: EditableCardItem[],
  compactMode: boolean,
  showSensitiveInCompact: boolean,
): RelationshipCardViewModel {
  const visibleItems = [...items]
    .filter((item) => item.visible && (!compactMode || showSensitiveInCompact || !item.sensitive))
    .sort((a, b) => a.order - b.order)
  const sections = baseCard.sections.flatMap((section) => {
    const matching = visibleItems.filter((item) => item.sectionId === section.sectionId)
    const paragraphs = (compactMode ? matching.slice(0, 1) : matching).map((item) => item.editedText)
    if (paragraphs.length === 0) return []
    return [{
      ...section,
      paragraphs,
      paragraphIds: (compactMode ? matching.slice(0, 1) : matching).map((item) => item.itemId),
      paragraphSourceTextKeys: (compactMode ? matching.slice(0, 1) : matching).map((item) => item.sourceTextKey ?? null),
      paragraphProvenanceIds: (compactMode ? matching.slice(0, 1) : matching).map((item) => item.provenanceIds),
      visible: true,
      sensitive: matching.some((item) => item.sensitive),
      order: Math.min(...matching.map((item) => item.order)),
    }]
  }).sort((a, b) => a.order - b.order)
  return { ...baseCard, sections }
}
