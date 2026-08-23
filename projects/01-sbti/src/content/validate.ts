import type {
  AnswerOption,
  ChapterCode,
  DimensionCode,
  PersonalityType,
  PoleCode,
  Question,
  SbtiContentPackage,
} from './types'

const ID_PATTERN = /^[a-z][a-z0-9-]*$/
const ASSET_ID_PATTERN = /^creature-[a-z][a-z0-9-]*$/
const DIMENSIONS: DimensionCode[] = ['RH', 'TV', 'LE', 'SM']
const CHAPTERS: ChapterCode[] = ['entry', 'trace', 'change', 'return']
const POLES: Record<DimensionCode, [PoleCode, PoleCode]> = {
  RH: ['R', 'H'], TV: ['T', 'V'], LE: ['L', 'E'], SM: ['S', 'M'],
}
const TYPE_CODES = [
  'RTLS', 'RTLM', 'RTES', 'RTEM', 'RVLS', 'RVLM', 'RVES', 'RVEM',
  'HTLS', 'HTLM', 'HTES', 'HTEM', 'HVLS', 'HVLM', 'HVES', 'HVEM',
]

export class ContentValidationError extends Error {
  readonly issues: string[]

  constructor(issues: string[]) {
    super(`SBTI content validation failed:\n${issues.join('\n')}`)
    this.name = 'ContentValidationError'
    this.issues = issues
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringAt(value: unknown, path: string, issues: string[]): value is string {
  if (typeof value !== 'string' || value.trim() === '') {
    issues.push(`${path}: expected a non-empty string`)
    return false
  }
  return true
}

function idAt(value: unknown, path: string, issues: string[]): value is string {
  if (!stringAt(value, path, issues)) return false
  if (!ID_PATTERN.test(value)) {
    issues.push(`${path}: expected lowercase kebab-case ID`)
    return false
  }
  return true
}

function unique(items: unknown[], getId: (item: Record<string, unknown>) => unknown, path: string, issues: string[]) {
  const seen = new Set<string>()
  items.forEach((item, index) => {
    if (!isRecord(item)) {
      issues.push(`${path}[${index}]: expected an object`)
      return
    }
    const id = getId(item)
    if (!idAt(id, `${path}[${index}].id`, issues)) return
    if (seen.has(id)) issues.push(`${path}[${index}].id: duplicate ID ${id}`)
    seen.add(id)
  })
  return seen
}

function validateOption(option: unknown, path: string, dimension: DimensionCode, issues: string[]): option is AnswerOption {
  if (!isRecord(option)) {
    issues.push(`${path}: expected an object`)
    return false
  }
  idAt(option.id, `${path}.id`, issues)
  stringAt(option.text, `${path}.text`, issues)
  if (!isRecord(option.score)) {
    issues.push(`${path}.score: expected an object`)
    return false
  }
  if (option.score.dimension !== dimension) issues.push(`${path}.score.dimension: expected ${dimension}`)
  const poles = POLES[dimension]
  if (!poles.includes(option.score.pole as PoleCode)) issues.push(`${path}.score.pole: illegal pole for ${dimension}`)
  if (option.score.weight !== 2) issues.push(`${path}.score.weight: launch questions require weight 2`)
  return true
}

function validateQuestion(value: unknown, index: number, issues: string[]): value is Question {
  const path = `$.content.questions[${index}]`
  if (!isRecord(value)) {
    issues.push(`${path}: expected an object`)
    return false
  }
  idAt(value.id, `${path}.id`, issues)
  if (!Number.isInteger(value.displayOrder) || Number(value.displayOrder) < 1) issues.push(`${path}.displayOrder: expected a positive integer`)
  if (!CHAPTERS.includes(value.chapterId as ChapterCode)) issues.push(`${path}.chapterId: illegal chapter`)
  if (!DIMENSIONS.includes(value.primaryDimension as DimensionCode)) {
    issues.push(`${path}.primaryDimension: illegal dimension`)
    return false
  }
  stringAt(value.category, `${path}.category`, issues)
  stringAt(value.prompt, `${path}.prompt`, issues)
  stringAt(value.contentVersion, `${path}.contentVersion`, issues)
  if (!Array.isArray(value.tags) || value.tags.length === 0 || value.tags.some((tag) => typeof tag !== 'string' || !ID_PATTERN.test(tag))) {
    issues.push(`${path}.tags: expected non-empty kebab-case tags`)
  }
  if (typeof value.reverseKeyed !== 'boolean') issues.push(`${path}.reverseKeyed: expected boolean`)
  if (!Array.isArray(value.options) || value.options.length !== 2) {
    issues.push(`${path}.options: expected exactly two options`)
    return false
  }
  const dimension = value.primaryDimension as DimensionCode
  value.options.forEach((option, optionIndex) => validateOption(option, `${path}.options[${optionIndex}]`, dimension, issues))
  const optionIds = value.options.filter(isRecord).map((option) => option.id)
  if (new Set(optionIds).size !== optionIds.length) issues.push(`${path}.options: option IDs must be unique`)
  const scoredPoles = value.options.filter(isRecord).map((option) => isRecord(option.score) ? option.score.pole : undefined)
  if (new Set(scoredPoles).size !== 2) issues.push(`${path}.options: both poles must be represented once`)
  return true
}

function requiredStrings(value: Record<string, unknown>, fields: string[], path: string, issues: string[]) {
  fields.forEach((field) => stringAt(value[field], `${path}.${field}`, issues))
}

function validateType(value: unknown, index: number, creatureIds: Set<string>, issues: string[]): value is PersonalityType {
  const path = `$.content.resultTypes[${index}]`
  if (!isRecord(value)) {
    issues.push(`${path}: expected an object`)
    return false
  }
  if (!TYPE_CODES.includes(String(value.code))) issues.push(`${path}.code: illegal type code`)
  requiredStrings(value, ['chineseName', 'creatureId', 'coreDescription', 'stressState', 'shareTitle', 'shareLine', 'classicalNote', 'creativeNote', 'disclaimer', 'artAssetId', 'contentVersion'], path, issues)
  if (!creatureIds.has(String(value.creatureId))) issues.push(`${path}.creatureId: dangling creature reference`)
  if (typeof value.artAssetId === 'string' && !ASSET_ID_PATTERN.test(value.artAssetId)) issues.push(`${path}.artAssetId: illegal asset ID`)
  for (const field of ['strengths', 'blindSpots', 'relationshipTips', 'selfCareTips', 'neighborCodes']) {
    const items = value[field]
    if (!Array.isArray(items) || items.length === 0 || items.some((item) => typeof item !== 'string' || item.trim() === '')) {
      issues.push(`${path}.${field}: expected non-empty strings`)
    }
  }
  return true
}

export function validateContent(input: unknown): SbtiContentPackage {
  const issues: string[] = []
  if (!isRecord(input)) throw new ContentValidationError(['$: expected an object'])
  if (input.schemaVersion !== 1) issues.push('$.schemaVersion: expected 1')
  if (input.projectId !== 'sbti') issues.push('$.projectId: expected sbti')
  stringAt(input.contentVersion, '$.contentVersion', issues)
  if (!isRecord(input.meta)) issues.push('$.meta: expected an object')
  if (!Array.isArray(input.sources)) issues.push('$.sources: expected an array')
  if (!isRecord(input.content)) {
    issues.push('$.content: expected an object')
    throw new ContentValidationError(issues)
  }

  const content = input.content
  const questions = Array.isArray(content.questions) ? content.questions : []
  const creatures = Array.isArray(content.creatures) ? content.creatures : []
  const resultTypes = Array.isArray(content.resultTypes) ? content.resultTypes : []
  const dimensions = Array.isArray(content.dimensions) ? content.dimensions : []
  const chapters = Array.isArray(content.chapters) ? content.chapters : []
  const tieBreakers = Array.isArray(content.tieBreakers) ? content.tieBreakers : []
  if (questions.length !== 48) issues.push('$.content.questions: expected exactly 48 questions')
  if (creatures.length !== 16) issues.push('$.content.creatures: expected exactly 16 creatures')
  if (resultTypes.length !== 16) issues.push('$.content.resultTypes: expected exactly 16 result types')
  if (dimensions.length !== 4) issues.push('$.content.dimensions: expected exactly 4 dimensions')
  if (chapters.length !== 4) issues.push('$.content.chapters: expected exactly 4 chapters')
  if (tieBreakers.length !== 4) issues.push('$.content.tieBreakers: expected exactly 4 tie breakers')
  if (!isRecord(content.experience)) issues.push('$.content.experience: expected an object')

  const questionIds = unique(questions, (item) => item.id, '$.content.questions', issues)
  const questionById = new Map(questions.filter(isRecord).map((item) => [String(item.id), item]))
  const allOptionIds = new Set<string>()
  questions.forEach((question, index) => {
    if (validateQuestion(question, index, issues) && isRecord(question)) {
      ;(question.options as unknown[]).filter(isRecord).forEach((option, optionIndex) => {
        const id = String(option.id)
        if (allOptionIds.has(id)) issues.push(`$.content.questions[${index}].options[${optionIndex}].id: duplicate option ID ${id}`)
        allOptionIds.add(id)
      })
    }
  })
  unique(creatures, (item) => item.id, '$.content.creatures', issues)
  const creatureIds = new Set(creatures.filter(isRecord).map((item) => String(item.id)))
  const typeCodes = new Set<string>()
  resultTypes.forEach((item, index) => {
    if (validateType(item, index, creatureIds, issues) && isRecord(item)) {
      const code = String(item.code)
      if (typeCodes.has(code)) issues.push(`$.content.resultTypes[${index}].code: duplicate type code ${code}`)
      typeCodes.add(code)
    }
  })
  TYPE_CODES.forEach((code) => {
    if (!typeCodes.has(code)) issues.push(`$.content.resultTypes: missing type ${code}`)
  })
  const mappedCreatures = resultTypes.filter(isRecord).map((item) => item.creatureId)
  if (new Set(mappedCreatures).size !== mappedCreatures.length) issues.push('$.content.resultTypes: each type must map to a unique creature')
  resultTypes.filter(isRecord).forEach((item, index) => {
    if (Array.isArray(item.neighborCodes)) item.neighborCodes.forEach((code, neighborIndex) => {
      if (!typeCodes.has(String(code))) issues.push(`$.content.resultTypes[${index}].neighborCodes[${neighborIndex}]: dangling type reference`)
    })
  })
  const tieDimensions = new Set<string>()
  tieBreakers.forEach((item, index) => {
    const path = `$.content.tieBreakers[${index}]`
    if (!isRecord(item)) return issues.push(`${path}: expected an object`)
    if (!DIMENSIONS.includes(item.dimension as DimensionCode)) issues.push(`${path}.dimension: illegal dimension`)
    if (!questionIds.has(String(item.questionId))) issues.push(`${path}.questionId: dangling question reference`)
    const referenced = questionById.get(String(item.questionId))
    if (referenced && referenced.primaryDimension !== item.dimension) issues.push(`${path}.questionId: tie-breaker must belong to ${String(item.dimension)}`)
    if (tieDimensions.has(String(item.dimension))) issues.push(`${path}.dimension: duplicate tie-breaker dimension`)
    tieDimensions.add(String(item.dimension))
  })
  const sourceIds = new Set((input.sources as unknown[] | undefined)?.filter(isRecord).map((item) => String(item.id)) ?? [])
  creatures.filter(isRecord).forEach((item, index) => {
    requiredStrings(item, ['name', 'classicalNote', 'contentVersion'], `$.content.creatures[${index}]`, issues)
    if (!Array.isArray(item.sourceIds) || item.sourceIds.length === 0) issues.push(`$.content.creatures[${index}].sourceIds: expected source references`)
    else item.sourceIds.forEach((sourceId, sourceIndex) => {
      if (!sourceIds.has(String(sourceId))) issues.push(`$.content.creatures[${index}].sourceIds[${sourceIndex}]: dangling source reference`)
    })
  })
  for (const chapter of CHAPTERS) for (const dimension of DIMENSIONS) {
    const count = questions.filter((question) => isRecord(question) && question.chapterId === chapter && question.primaryDimension === dimension).length
    if (count !== 3) issues.push(`$.content.questions: expected 3 questions for ${chapter} × ${dimension}, received ${count}`)
  }

  if (issues.length > 0) throw new ContentValidationError(issues)
  return input as SbtiContentPackage
}
