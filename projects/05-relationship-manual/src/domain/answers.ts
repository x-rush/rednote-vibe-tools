import type { QuestionnaireAnswer, RelationshipQuestion } from '../content/schema'

export type SelectionError = 'unknown-option' | 'mutually-exclusive' | 'too-few' | 'too-many' | 'cannot-skip'
export type SelectionResult =
  | { valid: true; optionIds: string[] }
  | { valid: false; error: SelectionError }

export function validateSelection(
  question: RelationshipQuestion,
  optionIds: string[],
  skipped = false,
): SelectionResult {
  const uniqueIds = [...new Set(optionIds)]
  const validIds = new Set(question.options.map((option) => option.optionId))
  if (uniqueIds.some((id) => !validIds.has(id))) return { valid: false, error: 'unknown-option' }
  if (skipped) {
    if (!question.skipRule.allowed) return { valid: false, error: 'cannot-skip' }
    if (uniqueIds.length > 0) return { valid: false, error: 'mutually-exclusive' }
    return { valid: true, optionIds: [] }
  }
  const selectedOptions = question.options.filter((option) => uniqueIds.includes(option.optionId))
  if (selectedOptions.some((option) => option.exclusive) && uniqueIds.length > 1) {
    return { valid: false, error: 'mutually-exclusive' }
  }
  if (uniqueIds.length < question.selectionLimit.min) return { valid: false, error: 'too-few' }
  if (uniqueIds.length > question.selectionLimit.max) return { valid: false, error: 'too-many' }
  return { valid: true, optionIds: uniqueIds }
}

export function toggleOption(
  question: RelationshipQuestion,
  currentOptionIds: string[],
  optionId: string,
): string[] {
  const option = question.options.find((item) => item.optionId === optionId)
  if (!option) return currentOptionIds
  if (!question.multiple) return [optionId]
  if (currentOptionIds.includes(optionId)) return currentOptionIds.filter((id) => id !== optionId)
  if (option.exclusive) return [optionId]

  const withoutExclusive = currentOptionIds.filter((id) => {
    const current = question.options.find((item) => item.optionId === id)
    return !current?.exclusive
  })
  if (withoutExclusive.length >= question.selectionLimit.max) return withoutExclusive
  return [...withoutExclusive, optionId]
}

export function applyAnswer(
  answers: QuestionnaireAnswer[],
  question: RelationshipQuestion,
  optionIds: string[],
  updatedAt: string,
  skipped = false,
): QuestionnaireAnswer[] {
  const selection = validateSelection(question, optionIds, skipped)
  if (!selection.valid) throw new RangeError(`Invalid selection: ${selection.error}`)
  const answer: QuestionnaireAnswer = {
    questionId: question.questionId,
    optionIds: selection.optionIds,
    skipped,
    updatedAt,
  }
  const next = answers.filter((item) => item.questionId !== question.questionId)
  const originalIndex = answers.findIndex((item) => item.questionId === question.questionId)
  if (originalIndex < 0) return [...next, answer]
  next.splice(originalIndex, 0, answer)
  return next
}
