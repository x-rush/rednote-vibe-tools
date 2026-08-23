import type { DimensionCode, PoleCode, SbtiContentPackage } from '../content/types'
import type {
  DimensionResult,
  ProgressSummary,
  QuizAnswer,
  QuizProgress,
  QuizResult,
  ResultSummary,
  ShareCardViewModel,
} from './types'

const DIMENSION_POLES: Record<DimensionCode, [PoleCode, PoleCode]> = {
  RH: ['R', 'H'], TV: ['T', 'V'], LE: ['L', 'E'], SM: ['S', 'M'],
}

function answerMap(answers: QuizAnswer[]) {
  return new Map(answers.map((answer) => [answer.questionId, answer.optionId]))
}

export function recordAnswer(
  answers: QuizAnswer[],
  questionId: string,
  optionId: string,
  content: SbtiContentPackage,
): QuizAnswer[] {
  const question = content.content.questions.find((item) => item.id === questionId)
  if (!question) throw new Error(`Unknown question ID: ${questionId}`)
  if (!question.options.some((option) => option.id === optionId)) throw new Error(`Unknown option ID for ${questionId}: ${optionId}`)
  return [...answers.filter((answer) => answer.questionId !== questionId), { questionId, optionId }]
}

export function isQuestionAnswered(answers: QuizAnswer[], questionId: string) {
  return answers.some((answer) => answer.questionId === questionId)
}

export function calculateProgress(questionIds: string[], answers: QuizAnswer[]): ProgressSummary {
  const selected = new Set(questionIds)
  const answered = new Set(answers.filter((answer) => selected.has(answer.questionId)).map((answer) => answer.questionId)).size
  return { answered, total: questionIds.length, percent: questionIds.length === 0 ? 0 : Math.round((answered / questionIds.length) * 100) }
}

export function aggregateDimensionScores(
  questionIds: string[],
  answers: QuizAnswer[],
  content: SbtiContentPackage,
) {
  const scores = Object.fromEntries(['R', 'H', 'T', 'V', 'L', 'E', 'S', 'M'].map((pole) => [pole, 0])) as Record<PoleCode, number>
  const selected = new Set(questionIds)
  const byQuestion = answerMap(answers)
  for (const questionId of selected) {
    const question = content.content.questions.find((item) => item.id === questionId)
    if (!question) throw new Error(`Unknown selected question ID: ${questionId}`)
    const optionId = byQuestion.get(questionId)
    if (!optionId) continue
    const option = question.options.find((item) => item.id === optionId)
    if (!option) throw new Error(`Unknown option ID for ${questionId}: ${optionId}`)
    scores[option.score.pole] += option.score.weight
  }
  return scores
}

function dimensionResults(questionIds: string[], answers: QuizAnswer[], content: SbtiContentPackage): DimensionResult[] {
  const scores = aggregateDimensionScores(questionIds, answers, content)
  const byQuestion = answerMap(answers)
  return (Object.entries(DIMENSION_POLES) as Array<[DimensionCode, [PoleCode, PoleCode]]>).map(([dimension, [leftPole, rightPole]]) => {
    const leftScore = scores[leftPole]
    const rightScore = scores[rightPole]
    let preferredPole = leftScore >= rightScore ? leftPole : rightPole
    const isBalanced = leftScore === rightScore
    if (isBalanced) {
      const tieQuestionId = content.content.tieBreakers.find((item) => item.dimension === dimension)?.questionId
      const tieQuestion = content.content.questions.find((item) => item.id === tieQuestionId)
      const tieOption = tieQuestion?.options.find((option) => option.id === byQuestion.get(tieQuestion.id))
      if (!tieOption) throw new Error(`Missing frozen tie-breaker answer for ${dimension}`)
      preferredPole = tieOption.score.pole
    }
    const total = leftScore + rightScore
    const strength = total === 0 ? 0 : Math.abs(leftScore - rightScore) / total
    return {
      dimension, leftPole, rightPole, leftScore, rightScore, preferredPole, strength,
      label: strength < 0.17 ? '游移' : strength < 0.5 ? '轻偏' : '明显偏好',
      isBalanced,
    }
  })
}

function assertComplete(questionIds: string[], answers: QuizAnswer[]) {
  const progress = calculateProgress(questionIds, answers)
  if (questionIds.length !== 24 || progress.answered !== 24) throw new Error('A formal result requires exactly 24 answered questions')
}

export function determineTypeCode(questionIds: string[], answers: QuizAnswer[], content: SbtiContentPackage) {
  assertComplete(questionIds, answers)
  return dimensionResults(questionIds, answers, content).map((item) => item.preferredPole).join('')
}

export function findBeastForType(code: string, content: SbtiContentPackage) {
  const type = content.content.resultTypes.find((item) => item.code === code)
  if (!type) throw new Error(`Unknown personality type: ${code}`)
  const creature = content.content.creatures.find((item) => item.id === type.creatureId)
  if (!creature) throw new Error(`Missing creature for personality type: ${code}`)
  return { type, creature }
}

export function generateResultSummary(
  code: string,
  dimensions: DimensionResult[],
  content: SbtiContentPackage,
): ResultSummary {
  const { type, creature } = findBeastForType(code, content)
  const weakestIndex = dimensions.reduce((best, item, index) => item.strength < dimensions[best]!.strength ? index : best, 0)
  const neighborCode = type.neighborCodes.find((neighbor) => neighbor[weakestIndex] !== code[weakestIndex]) ?? type.neighborCodes[0]!
  return {
    code,
    typeName: type.chineseName,
    creatureId: creature.id,
    creatureName: creature.name,
    coreDescription: type.coreDescription,
    neighborCode,
    dimensions,
  }
}

export function generateQuizResult(
  questionIds: string[],
  answers: QuizAnswer[],
  content: SbtiContentPackage,
  completedAt = 'local-result',
): QuizResult {
  assertComplete(questionIds, answers)
  const dimensions = dimensionResults(questionIds, answers, content)
  const code = dimensions.map((item) => item.preferredPole).join('')
  return { code, completedAt, contentVersion: content.contentVersion, summary: generateResultSummary(code, dimensions, content) }
}

export function generateShareCardViewModel(result: QuizResult, content?: SbtiContentPackage): ShareCardViewModel {
  if (!content) {
    return {
      code: result.code,
      typeName: result.summary.typeName,
      creatureName: result.summary.creatureName,
      title: `我的山海兽格是${result.summary.creatureName}·${result.summary.typeName}`,
      line: result.summary.coreDescription,
      disclaimer: '娱乐性文化创作，不用于心理诊断。',
      artAssetId: result.summary.creatureId,
    }
  }
  const { type, creature } = findBeastForType(result.code, content)
  return { code: result.code, typeName: type.chineseName, creatureName: creature.name, title: type.shareTitle, line: type.shareLine, disclaimer: type.disclaimer, artAssetId: type.artAssetId }
}

export function resetQuiz(seed: string, questionIds: string[]): QuizProgress {
  return { seed, questionIds: [...questionIds], currentIndex: 0, answers: [] }
}

