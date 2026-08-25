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
const DIMENSION_DISPLAY: Record<DimensionCode, { name: string; poles: [string, string] }> = {
  RH: { name: '与世界相遇', poles: ['应世', '隐世'] },
  TV: { name: '理解线索', poles: ['察微', '观象'] },
  LE: { name: '衡量选择', poles: ['衡理', '感应'] },
  SM: { name: '面对变化', poles: ['守形', '化生'] },
}
const TYPE_CODES = [
  'RTLS', 'RTLM', 'RTES', 'RTEM', 'RVLS', 'RVLM', 'RVES', 'RVEM',
  'HTLS', 'HTLM', 'HTES', 'HTEM', 'HVLS', 'HVLM', 'HVES', 'HVEM',
]

export class ContentValidationError extends Error {
  readonly issues: string[]

  constructor(issues: string[]) {
    super(`SHBTI content validation failed:\n${issues.join('\n')}`)
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
  if (option.score.weight !== 1 && option.score.weight !== 2) issues.push(`${path}.score.weight: expected 1 or 2`)
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
  if (!Array.isArray(value.options) || value.options.length !== 4) {
    issues.push(`${path}.options: expected exactly four options`)
    return false
  }
  const options = value.options
  const dimension = value.primaryDimension as DimensionCode
  const poles = POLES[dimension]
  options.forEach((option, optionIndex) => validateOption(option, `${path}.options[${optionIndex}]`, dimension, issues))
  const optionIds = options.filter(isRecord).map((option) => option.id)
  if (new Set(optionIds).size !== optionIds.length) issues.push(`${path}.options: option IDs must be unique`)
  const actionTexts = options.filter(isRecord).map((option) => option.text)
  if (new Set(actionTexts).size !== actionTexts.length) issues.push(`${path}.options: action text must be unique`)
  const scoredPoles = options.filter(isRecord).map((option) => isRecord(option.score) ? option.score.pole : undefined)
  if (new Set(scoredPoles).size !== 2) issues.push(`${path}.options: both poles must be represented`)
  const hasPreferenceShape = poles.every((pole) => {
    const weights = options
      .filter(isRecord)
      .filter((option) => isRecord(option.score) && option.score.pole === pole)
      .map((option) => isRecord(option.score) ? option.score.weight : undefined)
      .sort()
    return weights.length === 2 && weights[0] === 1 && weights[1] === 2
  })
  if (!hasPreferenceShape) issues.push(`${path}.options: expected one light and one strong option per pole`)
  return true
}

function requiredStrings(value: Record<string, unknown>, fields: string[], path: string, issues: string[]) {
  fields.forEach((field) => stringAt(value[field], `${path}.${field}`, issues))
}

function recordStringsAt(value: unknown, keys: readonly string[], path: string, issues: string[]) {
  if (!isRecord(value)) {
    issues.push(`${path}: expected an object`)
    return
  }
  keys.forEach((key) => stringAt(value[key], `${path}.${key}`, issues))
}

function stringArrayAt(value: unknown, path: string, issues: string[], exactLength?: number) {
  if (!Array.isArray(value) || value.length === 0 || value.some((item) => typeof item !== 'string' || item.trim() === '')) {
    issues.push(`${path}: expected non-empty strings`)
    return
  }
  if (exactLength !== undefined && value.length !== exactLength) issues.push(`${path}: expected exactly ${exactLength} non-empty strings`)
}

function substantialStringAt(value: unknown, path: string, minimumLength: number, issues: string[]) {
  if (!stringAt(value, path, issues)) return
  if (Array.from(value).length < minimumLength) issues.push(`${path}: expected at least ${minimumLength} characters`)
}

function substantialStringArrayAt(value: unknown, path: string, exactLength: number, minimumLength: number, issues: string[]) {
  stringArrayAt(value, path, issues, exactLength)
  if (!Array.isArray(value)) return
  value.forEach((item, index) => {
    if (typeof item === 'string' && Array.from(item).length < minimumLength) issues.push(`${path}[${index}]: expected at least ${minimumLength} characters`)
  })
}

function guideTopicsAt(value: unknown, path: string, issues: string[]) {
  if (!Array.isArray(value) || value.length !== 3) {
    issues.push(`${path}: expected exactly 3 topics`)
    return
  }
  const ids = new Set<string>()
  value.forEach((topic, index) => {
    const topicPath = `${path}[${index}]`
    if (!isRecord(topic)) {
      issues.push(`${topicPath}: expected an object`)
      return
    }
    if (idAt(topic.id, `${topicPath}.id`, issues)) {
      if (ids.has(topic.id)) issues.push(`${topicPath}.id: duplicate ID ${topic.id}`)
      ids.add(topic.id)
    }
    stringAt(topic.label, `${topicPath}.label`, issues)
    stringAt(topic.answer, `${topicPath}.answer`, issues)
  })
}

function validateType(value: unknown, index: number, creatureIds: Set<string>, issues: string[]): value is PersonalityType {
  const path = `$.content.resultTypes[${index}]`
  if (!isRecord(value)) {
    issues.push(`${path}: expected an object`)
    return false
  }
  if (!TYPE_CODES.includes(String(value.code))) issues.push(`${path}.code: illegal type code`)
  requiredStrings(value, ['chineseName', 'creatureId', 'coreDescription', 'stressState', 'shareTitle', 'shareLine', 'classicalNote', 'creativeNote', 'disclaimer', 'artAssetId', 'contentVersion'], path, issues)
  substantialStringArrayAt(value.longPortrait, `${path}.longPortrait`, 2, 45, issues)
  substantialStringAt(value.innerDrive, `${path}.innerDrive`, 24, issues)
  substantialStringAt(value.misreadAs, `${path}.misreadAs`, 20, issues)
  if (!isRecord(value.journeyScenes)) issues.push(`${path}.journeyScenes: expected an object`)
  else {
    substantialStringAt(value.journeyScenes.arrival, `${path}.journeyScenes.arrival`, 28, issues)
    substantialStringAt(value.journeyScenes.disagreement, `${path}.journeyScenes.disagreement`, 28, issues)
    substantialStringAt(value.journeyScenes.change, `${path}.journeyScenes.change`, 28, issues)
  }
  substantialStringAt(value.relationshipNeed, `${path}.relationshipNeed`, 24, issues)
  substantialStringAt(value.growthPractice, `${path}.growthPractice`, 24, issues)
  substantialStringAt(value.wenshanNote, `${path}.wenshanNote`, 18, issues)
  substantialStringArrayAt(value.shareQuotes, `${path}.shareQuotes`, 3, 12, issues)
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
  else {
    requiredStrings(content.experience, ['title', 'subtitle', 'duration', 'disclaimer', 'calculating', 'emptyHistory'], '$.content.experience', issues)
    if (!Array.isArray(content.experience.intro) || content.experience.intro.some((item) => typeof item !== 'string' || item.trim() === '')) {
      issues.push('$.content.experience.intro: expected non-empty strings')
    }
    if (!isRecord(content.experience.identity)) issues.push('$.content.experience.identity: expected an object')
    else {
      const identity = content.experience.identity
      const identityPath = '$.content.experience.identity'
      requiredStrings(identity, ['formalName', 'englishExpansion', 'chineseMeaning', 'boundary'], identityPath, issues)
      const expected = {
        formalName: 'SHBTI｜山海兽格测试',
        englishExpansion: 'Shanhai Beast Temperament Indicator',
        chineseMeaning: '山海异兽性格倾向指标',
        boundary: '娱乐性自我探索工具，不是专业心理测评。',
      }
      Object.entries(expected).forEach(([key, value]) => {
        if (identity[key] !== value) issues.push(`${identityPath}.${key}: expected ${value}`)
      })
    }
    if (!isRecord(content.experience.guide)) issues.push('$.content.experience.guide: expected an object')
    else {
      const guide = content.experience.guide
      const path = '$.content.experience.guide'
      requiredStrings(guide, ['name', 'role'], path, issues)
      stringArrayAt(guide.intro, `${path}.intro`, issues, 3)
      if (!isRecord(guide.quizCompanion)) issues.push(`${path}.quizCompanion: expected an object`)
      else {
        const quizCompanion = guide.quizCompanion
        requiredStrings(quizCompanion, ['title', 'selected', 'revisiting'], `${path}.quizCompanion`, issues)
        if (!isRecord(quizCompanion.phase)) issues.push(`${path}.quizCompanion.phase: expected an object`)
        else {
          const phase = quizCompanion.phase
          CHAPTERS.forEach((chapter) => recordStringsAt(phase[chapter], ['opening', 'middle', 'closing'], `${path}.quizCompanion.phase.${chapter}`, issues))
        }
        guideTopicsAt(quizCompanion.topics, `${path}.quizCompanion.topics`, issues)
      }
      recordStringsAt(guide.landing, ['fresh', 'resume', 'recent'], `${path}.landing`, issues)
      if (isRecord(guide.landing) && (typeof guide.landing.resume !== 'string' || !guide.landing.resume.includes('{chapter}') || !guide.landing.resume.includes('{current}'))) {
        issues.push(`${path}.landing.resume: expected both {chapter} and {current} placeholders`)
      }
      recordStringsAt(guide.chapterStart, CHAPTERS, `${path}.chapterStart`, issues)
      recordStringsAt(guide.chapterEnd, ['entry', 'trace', 'change'], `${path}.chapterEnd`, issues)
      recordStringsAt(guide.reveal, ['collecting', 'reading', 'complete'], `${path}.reveal`, issues)
      if (!isRecord(guide.resultHelp)) issues.push(`${path}.resultHelp: expected an object`)
      else {
        requiredStrings(guide.resultHelp, ['prompt', 'title'], `${path}.resultHelp`, issues)
        guideTopicsAt(guide.resultHelp.topics, `${path}.resultHelp.topics`, issues)
      }
      recordStringsAt(guide.recovery, ['content', 'storageCleared', 'storageUnavailable', 'storageWriteFailed'], `${path}.recovery`, issues)
      recordStringsAt(guide.recoveryActions, ['content', 'storageCleared', 'storageUnavailable', 'storageWriteFailed'], `${path}.recoveryActions`, issues)
      if (/吉凶|命定|治愈|治疗|更聪明|更优秀|能力更强/.test(JSON.stringify(guide))) {
        issues.push(`${path}: guide copy must remain neutral and non-diagnostic`)
      }
    }
    if (!isRecord(content.experience.surfaces)) issues.push('$.content.experience.surfaces: expected an object')
    else {
      requiredStrings(content.experience.surfaces, [
        'brandCode', 'brandName', 'brandSeal', 'landingEyebrow', 'landingQuestion', 'landingFreshKicker', 'landingContinueKicker',
        'landingMeta', 'landingFootnote', 'introEyebrow', 'introTitle', 'introLead', 'introPrivacy',
      ], '$.content.experience.surfaces', issues)
    }
    if (!isRecord(content.experience.shareCard)) issues.push('$.content.experience.shareCard: expected an object')
    else {
      requiredStrings(content.experience.shareCard, [
        'triggerLabel', 'launchDescription', 'title', 'cardEyebrow', 'guideLabel', 'guideSeal', 'generating', 'previewAlt', 'saveLabel', 'savingLabel',
        'success', 'unsupported', 'failure', 'retryLabel', 'closeLabel',
      ], '$.content.experience.shareCard', issues)
    }
  }

  const questionIds = unique(questions, (item) => item.id, '$.content.questions', issues)
  const dimensionDisplayNames = new Set<string>()
  const dimensionCodes = new Set<DimensionCode>()
  dimensions.forEach((dimension, index) => {
    const path = `$.content.dimensions[${index}]`
    if (!isRecord(dimension)) {
      issues.push(`${path}: expected an object`)
      return
    }
    const code = dimension.code as DimensionCode
    if (!DIMENSIONS.includes(code)) issues.push(`${path}.code: illegal dimension`)
    else {
      if (dimensionCodes.has(code)) issues.push(`${path}.code: duplicate dimension ${code}`)
      dimensionCodes.add(code)
    }
    if (stringAt(dimension.displayName, `${path}.displayName`, issues)) {
      if (dimensionDisplayNames.has(dimension.displayName)) issues.push(`${path}.displayName: duplicate display name`)
      dimensionDisplayNames.add(dimension.displayName)
      if (DIMENSIONS.includes(code) && dimension.displayName !== DIMENSION_DISPLAY[code].name) issues.push(`${path}.displayName: expected ${DIMENSION_DISPLAY[code].name}`)
    }
    if (stringAt(dimension.name, `${path}.name`, issues) && DIMENSIONS.includes(code)) {
      const expectedName = DIMENSION_DISPLAY[code].poles.join(' / ')
      if (dimension.name !== expectedName) issues.push(`${path}.name: expected ${expectedName}`)
    }
    if (!Array.isArray(dimension.poles) || dimension.poles.length !== 2) {
      issues.push(`${path}.poles: expected exactly 2 poles`)
      return
    }
    if (!DIMENSIONS.includes(code)) return
    dimension.poles.forEach((pole, poleIndex) => {
      const polePath = `${path}.poles[${poleIndex}]`
      if (!isRecord(pole)) {
        issues.push(`${polePath}: expected an object`)
        return
      }
      const expectedCode = POLES[code][poleIndex]
      if (pole.code !== expectedCode) issues.push(`${polePath}.code: expected ${expectedCode}`)
      requiredStrings(pole, ['name', 'definition', 'nonMeaning'], polePath, issues)
      if (typeof pole.name === 'string' && pole.name !== DIMENSION_DISPLAY[code].poles[poleIndex]) issues.push(`${polePath}.name: expected ${DIMENSION_DISPLAY[code].poles[poleIndex]}`)
    })
  })
  DIMENSIONS.forEach((code) => {
    if (!dimensionCodes.has(code)) issues.push('$.content.dimensions: missing dimension ' + code)
  })
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
