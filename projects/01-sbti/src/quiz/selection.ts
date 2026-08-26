import type { AnswerOption, ChapterCode, DimensionCode, PoleCode, Question, ShbtiContentPackage } from '../content/types'

const DIMENSION_POLES: Record<DimensionCode, [PoleCode, PoleCode]> = {
  RH: ['R', 'H'],
  TV: ['T', 'V'],
  LE: ['L', 'E'],
  SM: ['S', 'M'],
}

const OPTION_PATTERNS = [
  [0, 1, 2, 3],
  [0, 1, 3, 2],
  [1, 0, 2, 3],
  [2, 3, 0, 1],
  [2, 3, 1, 0],
  [3, 2, 0, 1],
] as const

function hashSeed(seed: string) {
  let value = 2166136261
  for (let index = 0; index < seed.length; index += 1) {
    value ^= seed.charCodeAt(index)
    value = Math.imul(value, 16777619)
  }
  return value >>> 0
}

function createRandom(seed: string) {
  let state = hashSeed(seed) || 1
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 4294967296
  }
}

function shuffle<T>(items: T[], random: () => number) {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1))
    ;[copy[index], copy[target]] = [copy[target]!, copy[index]!]
  }
  return copy
}

function orderChapter(questions: Question[], random: () => number, priorDimension?: DimensionCode) {
  const buckets = new Map<DimensionCode, Question[]>()
  for (const question of shuffle(questions, random)) {
    const bucket = buckets.get(question.primaryDimension) ?? []
    bucket.push(question)
    buckets.set(question.primaryDimension, bucket)
  }
  const result: Question[] = []
  let previous = priorDimension
  while (result.length < questions.length) {
    const candidates = shuffle([...buckets.entries()], random)
      .filter(([dimension, bucket]) => dimension !== previous && bucket.length > 0)
      .sort((left, right) => right[1].length - left[1].length)
    const selected = candidates[0]
    if (!selected) throw new Error('Unable to order questions without adjacent dimensions')
    const [dimension, bucket] = selected
    result.push(bucket.shift()!)
    previous = dimension
  }
  return result
}

export function selectQuestionIds(content: ShbtiContentPackage, seed: string): string[] {
  if (seed.trim() === '') throw new Error('A non-empty seed is required')
  const random = createRandom(seed)
  const chapters: ChapterCode[] = ['entry', 'trace', 'change', 'return']
  const dimensions: DimensionCode[] = ['RH', 'TV', 'LE', 'SM']
  const tieByDimension = new Map(content.content.tieBreakers.map((item) => [item.dimension, item.questionId]))
  const pattern = hashSeed(seed) % 2
  const selected: Question[] = []

  chapters.forEach((chapter, chapterIndex) => {
    dimensions.forEach((dimension, dimensionIndex) => {
      const take = (chapterIndex + dimensionIndex + pattern) % 2 === 0 ? 2 : 1
      const candidates = content.content.questions.filter(
        (question) => question.chapterId === chapter && question.primaryDimension === dimension,
      )
      const tieId = tieByDimension.get(dimension)
      const tieQuestion = candidates.find((question) => question.id === tieId)
      const shuffled = shuffle(candidates.filter((question) => question.id !== tieId), random)
      const cell = tieQuestion ? [tieQuestion, ...shuffled].slice(0, take) : shuffled.slice(0, take)
      if (cell.length !== take) throw new Error(`Insufficient questions for ${chapter} × ${dimension}`)
      selected.push(...cell)
    })
  })

  const ordered: Question[] = []
  for (const chapter of chapters) {
    const chapterQuestions = orderChapter(
      selected.filter((question) => question.chapterId === chapter),
      random,
      ordered.at(-1)?.primaryDimension,
    )
    ordered.push(...chapterQuestions)
  }
  return ordered.map((question) => question.id)
}

function canonicalOptions(question: Question): [AnswerOption, AnswerOption, AnswerOption, AnswerOption] {
  const [leftPole, rightPole] = DIMENSION_POLES[question.primaryDimension]
  const find = (pole: PoleCode, weight: 1 | 2) => question.options.find(
    (option) => option.score.pole === pole && option.score.weight === weight,
  )
  const options = [find(leftPole, 2), find(leftPole, 1), find(rightPole, 1), find(rightPole, 2)]
  if (options.some((option) => !option)) throw new Error(`Question ${question.id} does not contain a complete preference set`)
  return options as [AnswerOption, AnswerOption, AnswerOption, AnswerOption]
}

export function prepareQuestionsForRun(
  content: ShbtiContentPackage,
  questionIds: string[],
  seed: string,
): Question[] {
  if (seed.trim() === '') throw new Error('A non-empty seed is required')
  const byId = new Map(content.content.questions.map((question) => [question.id, question]))
  const dimensionCounts = new Map<DimensionCode, number>()
  const dimensionSettings = new Map(DIMENSION_POLES_KEYS.map((dimension) => {
    const value = hashSeed(`${seed}:options:${dimension}`)
    return [dimension, { offset: value % OPTION_PATTERNS.length, flipSides: ((value >>> 8) & 1) === 1 }]
  }))

  return questionIds.map((questionId) => {
    const question = byId.get(questionId)
    if (!question) throw new Error(`Unknown selected question ID: ${questionId}`)
    const occurrence = dimensionCounts.get(question.primaryDimension) ?? 0
    dimensionCounts.set(question.primaryDimension, occurrence + 1)
    const settings = dimensionSettings.get(question.primaryDimension)!
    const pattern = OPTION_PATTERNS[(occurrence + settings.offset) % OPTION_PATTERNS.length]!
    const canonical = canonicalOptions(question)
    const options = pattern.map((slot) => canonical[settings.flipSides ? 3 - slot : slot]) as unknown as Question['options']
    return { ...question, options }
  })
}

const DIMENSION_POLES_KEYS = Object.keys(DIMENSION_POLES) as DimensionCode[]
