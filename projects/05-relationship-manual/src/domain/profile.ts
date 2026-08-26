import type {
  PreferenceScore,
  QuestionnaireAnswer,
  RelationshipContentPackage,
  RelationshipContext,
  RelationshipOption,
  RelationshipProfile,
  RelationshipQuestion,
} from '../content/schema'
import { getRelationshipBank } from '../content/bank'

function unique<T>(values: T[]): T[] {
  return [...new Set(values)]
}

function calculateMaximums(
  content: RelationshipContentPackage,
  questions: RelationshipQuestion[],
  answeredQuestionIds: Set<string>,
): Map<string, number> {
  const maximums = new Map(content.content.dimensions.map((dimension) => [dimension.dimensionId, 0]))
  for (const question of questions.filter((item) => answeredQuestionIds.has(item.questionId))) {
    for (const dimension of content.content.dimensions) {
      const scores = question.options
        .map((option) => option.dimensionEffects.find((effect) => effect.dimensionId === dimension.dimensionId)?.score ?? 0)
        .sort((a, b) => b - a)
      const take = question.multiple ? question.selectionLimit.max : 1
      maximums.set(dimension.dimensionId, (maximums.get(dimension.dimensionId) ?? 0) + scores.slice(0, take).reduce((sum, score) => sum + score, 0))
    }
  }
  return maximums
}

function rankScores(scores: PreferenceScore[]): PreferenceScore[] {
  const ordered = [...scores].sort((a, b) => b.normalized - a.normalized)
  let previous = Number.NaN
  let rank = 0
  return ordered.map((score, index, all) => {
    if (score.normalized !== previous) rank = index + 1
    previous = score.normalized
    const tied = score.normalized > 0 && all.filter((item) => item.normalized === score.normalized).length > 1
    return { ...score, rank, tied }
  })
}

export function buildRelationshipProfile(
  content: RelationshipContentPackage,
  relationshipContext: RelationshipContext,
  answers: QuestionnaireAnswer[],
  generatedAt: string,
): RelationshipProfile {
  const bank = getRelationshipBank(content, relationshipContext)
  const questions = bank.questions
  const questionIds = new Set(questions.map((question) => question.questionId))
  const validAnswers = answers.filter((answer) => questionIds.has(answer.questionId))
  const optionById = new Map(questions.flatMap((question) => question.options).map((option) => [option.optionId, option]))
  const selectedEntries: Array<{ answer: QuestionnaireAnswer; optionId: string; option: RelationshipOption }> = validAnswers.flatMap((answer) => (
    answer.optionIds.flatMap((optionId) => {
      const option = optionById.get(optionId)
      return option ? [{ answer, optionId, option }] : []
    })
  ))
  const selectedOptions = selectedEntries.map((entry) => entry.option)
  const totals = new Map(content.content.dimensions.map((dimension) => [dimension.dimensionId, 0]))
  for (const option of selectedOptions) {
    for (const effect of option.dimensionEffects) totals.set(effect.dimensionId, (totals.get(effect.dimensionId) ?? 0) + effect.score)
  }

  const maximums = calculateMaximums(content, questions, new Set(validAnswers.filter((answer) => !answer.skipped).map((answer) => answer.questionId)))
  const scores = rankScores(content.content.dimensions.map((dimension) => {
    const score = totals.get(dimension.dimensionId) ?? 0
    const maxPossible = maximums.get(dimension.dimensionId) ?? 0
    return {
      dimensionId: dimension.dimensionId,
      score,
      maxPossible,
      normalized: maxPossible === 0 ? 0 : Number((score / maxPossible).toFixed(4)),
      rank: 0,
      tied: false,
    }
  }))
  const highest = scores[0]?.normalized ?? 0
  const priorityDimensionIds = highest === 0 ? [] : scores.filter((score) => score.normalized === highest).map((score) => score.dimensionId)
  const selectedBoundaryIds = unique(selectedOptions.flatMap((option) => option.boundaryIds))
  const selectedFragments: RelationshipProfile['selectedFragments'] = selectedEntries.flatMap(({ answer, optionId, option }) => option.resultTextKeys.map((textKey) => ({
    provenanceId: `${answer.questionId}:${optionId}:${textKey}`,
    textKey,
    questionId: answer.questionId,
    optionId,
  })))
  const selectedTextKeys = unique(selectedFragments.map((fragment) => fragment.textKey))

  if (selectedOptions.length > 0) {
    const commitmentRules = new Map(bank.boundaryCommitmentRules
      .map((rule) => [rule.boundaryId, rule.textKeys]))
    const matchingCommitments = unique(selectedBoundaryIds.flatMap((boundaryId) => commitmentRules.get(boundaryId) ?? []))
    for (const key of [...matchingCommitments, ...bank.defaultCommitmentTextKeys]) {
      if (selectedTextKeys.filter((item) => item.startsWith('commit-')).length >= 2) break
      if (!selectedTextKeys.includes(key)) {
        selectedTextKeys.push(key)
        selectedFragments.push({ provenanceId: `commitment-fallback:${key}`, textKey: key })
      }
    }
  }

  const selectedOptionIds = new Set(selectedOptions.map((option) => option.optionId))
  const conflictRuleIds = bank.conflictMergeRules
    .filter((rule) => rule.optionIds.every((optionId) => selectedOptionIds.has(optionId)))
    .map((rule) => rule.ruleId)

  return {
    relationshipContext,
    answers: validAnswers,
    scores,
    priorityDimensionIds,
    selectedTextKeys,
    selectedFragments,
    selectedBoundaryIds,
    conflictRuleIds,
    generatedAt,
  }
}
