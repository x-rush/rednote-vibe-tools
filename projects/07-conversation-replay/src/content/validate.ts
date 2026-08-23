import type {
  AlternativeExpression,
  ChoiceDefinition,
  CommunicationGoal,
  ConflictLevel,
  ConversationContentPackage,
  ConversationScenario,
  EmotionOption,
  RelationshipType,
  ResponseOption,
  SafetyRule,
  VocabularyItem,
} from '../domain/types'

export type ValidationError = { path: string; message: string }
export type ValidationResult = { ok: boolean; errors: ValidationError[] }

const ID_PATTERN = /^[a-z][a-z0-9-]*$/
const relationships = new Set<RelationshipType>(['friend', 'partner', 'family', 'coworker', 'general'])
const goals = new Set<CommunicationGoal>(['clarify', 'repair', 'coordinate', 'set-boundary', 'prepare-next-time'])
const conflicts = new Set<ConflictLevel>(['low', 'medium', 'high', 'safety'])
const responses = new Set<ResponseOption>(['response-explained', 'response-defended', 'response-apologized', 'response-withdrew', 'response-refused', 'response-discussed'])
const feelingCategories = new Set(['supported', 'sad', 'uncertain', 'blocked'])
const needCategories = new Set(['safety', 'connection', 'autonomy', 'coordination', 'growth'])
const safetyLevels = new Set(['standard', 'elevated', 'safety'])
const forbiddenContent = /(自恋型人格|人格障碍|让.{0,8}付出代价|故意操控|威胁.{0,8}服从|情感勒索)/

function objectAt(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function arrayAt(value: unknown): value is unknown[] {
  return Array.isArray(value)
}

export function validateContent(input: unknown, mode: 'envelope' | 'production' = 'production'): ValidationResult {
  const errors: ValidationError[] = []
  const add = (path: string, message: string) => errors.push({ path, message })

  if (!objectAt(input)) return { ok: false, errors: [{ path: '$', message: '内容包必须是对象' }] }
  if (input.schemaVersion !== 1) add('schemaVersion', '必须为 1')
  if (input.projectId !== 'conversation-replay') add('projectId', '项目 ID 不合法')
  if (!nonEmpty(input.contentVersion)) add('contentVersion', '内容版本不能为空')
  if (!objectAt(input.meta)) add('meta', 'meta 必须是对象')
  else {
    if (!nonEmpty(input.meta.title)) add('meta.title', '标题不能为空')
    if (input.meta.locale !== 'zh-CN') add('meta.locale', '只支持 zh-CN')
    if (!nonEmpty(input.meta.updatedAt)) add('meta.updatedAt', '更新时间不能为空')
  }
  if (!arrayAt(input.sources)) add('sources', 'sources 必须是数组')
  else input.sources.forEach((source, index) => {
    const path = `sources[${index}]`
    if (!objectAt(source)) add(path, '资料来源必须是对象')
    else for (const key of ['id', 'title', 'license']) if (!nonEmpty(source[key])) add(`${path}.${key}`, '不能为空')
  })
  if (!objectAt(input.content)) return { ok: false, errors: [...errors, { path: 'content', message: 'content 必须是对象' }] }

  const rootKeys = ['feelings', 'needs', 'scenarios', 'choices', 'rewrites', 'safetyRules']
  for (const key of rootKeys) if (!arrayAt(input.content[key])) add(`content.${key}`, '必须是数组')
  for (const key of Object.keys(input.content)) if (!rootKeys.includes(key)) add(`content.${key}`, '未知业务根字段')
  if (errors.length > 0 || mode === 'envelope') return { ok: errors.length === 0, errors }

  const records = (items: unknown[], path: string) => items.map((item, index) => {
    if (objectAt(item)) return item
    add(`${path}[${index}]`, '必须是对象')
    return {}
  })
  const feelings = records(input.content.feelings as unknown[], 'content.feelings')
  const needs = records(input.content.needs as unknown[], 'content.needs')
  const scenarios = records(input.content.scenarios as unknown[], 'content.scenarios')
  const choices = records(input.content.choices as unknown[], 'content.choices')
  const rewrites = records(input.content.rewrites as unknown[], 'content.rewrites')
  const safetyRules = records(input.content.safetyRules as unknown[], 'content.safetyRules')
  if (feelings.length !== 48) add('content.feelings', '首发必须恰好 48 个感受')
  if (needs.length !== 48) add('content.needs', '首发必须恰好 48 个需要')
  if (scenarios.length !== 32) add('content.scenarios', '首发必须恰好 32 个情境')

  const allIds = new Set<string>()
  const registerId = (value: unknown, path: string) => {
    if (!nonEmpty(value) || !ID_PATTERN.test(value)) add(path, '必须是稳定 kebab-case ID')
    else if (allIds.has(value)) add(path, `重复 ID: ${value}`)
    else allIds.add(value)
  }
  feelings.forEach((item, index) => registerId(item.id, `content.feelings[${index}].id`))
  needs.forEach((item, index) => registerId(item.id, `content.needs[${index}].id`))
  choices.forEach((item, index) => registerId(item.id, `content.choices[${index}].id`))
  rewrites.forEach((item, index) => registerId(item.id, `content.rewrites[${index}].id`))
  safetyRules.forEach((item, index) => registerId(item.id, `content.safetyRules[${index}].id`))

  const scenarioIds = new Set<string>()
  scenarios.forEach((item, index) => {
    const path = `content.scenarios[${index}]`
    if (!nonEmpty(item.scenarioId) || !ID_PATTERN.test(item.scenarioId)) add(`${path}.scenarioId`, '情境 ID 不合法')
    else if (scenarioIds.has(item.scenarioId)) add(`${path}.scenarioId`, `重复情境 ID: ${item.scenarioId}`)
    else scenarioIds.add(item.scenarioId)
  })

  const feelingIds = new Set(feelings.map(({ id }) => id).filter(nonEmpty))
  const needIds = new Set(needs.map(({ id }) => id).filter(nonEmpty))
  const originalIds = new Set(choices.filter(({ kind }) => kind === 'original-expression').map(({ id }) => id).filter(nonEmpty))
  const rewriteIds = new Set(rewrites.map(({ id }) => id).filter(nonEmpty))
  const ruleIds = new Set(safetyRules.map(({ id }) => id).filter(nonEmpty))

  const requireText = (owner: Record<string, unknown>, key: string, path: string) => {
    if (!nonEmpty(owner[key])) add(`${path}.${key}`, '文案不能为空')
    else if (forbiddenContent.test(owner[key] as string)) add(`${path}.${key}`, '包含诊断式或操控性文案')
  }
  feelings.forEach((item, index) => {
    const path = `content.feelings[${index}]`
    requireText(item, 'label', path)
    if (!feelingCategories.has(String(item.category))) add(`${path}.category`, '感受分类不合法')
  })
  needs.forEach((item, index) => {
    const path = `content.needs[${index}]`
    requireText(item, 'label', path)
    if (!needCategories.has(String(item.category))) add(`${path}.category`, '需要分类不合法')
  })
  choices.forEach((item, index) => {
    const path = `content.choices[${index}]`
    requireText(item, 'label', path)
    if (item.kind === 'original-expression') {
      if (!arrayAt(item.risks) || item.risks.length === 0) add(`${path}.risks`, '原表达至少需要一个风险点')
      else item.risks.forEach((risk, riskIndex) => {
        const riskPath = `${path}.risks[${riskIndex}]`
        if (!objectAt(risk)) add(riskPath, '风险点必须是对象')
        else {
          registerId(risk.id, `${riskPath}.id`)
          requireText(risk, 'label', riskPath)
          requireText(risk, 'explanation', riskPath)
        }
      })
    } else {
      const validValues: Record<string, Set<string>> = {
        relationship: relationships,
        goal: goals,
        conflict: conflicts,
        response: responses,
        intention: new Set(['repair-now', 'prepare-next-time']),
      }
      const values = validValues[String(item.kind)]
      if (!values) add(`${path}.kind`, '选项类型不合法')
      else if (!nonEmpty(item.value) || !values.has(item.value)) add(`${path}.value`, '选项值不合法')
    }
  })

  scenarios.forEach((item, index) => {
    const path = `content.scenarios[${index}]`
    for (const key of ['title', 'category', 'description', 'contentVersion']) requireText(item, key, path)
    if (!relationships.has(item.relationshipType as RelationshipType)) add(`${path}.relationshipType`, '关系类型不合法')
    if (!conflicts.has(item.conflictLevel as ConflictLevel)) add(`${path}.conflictLevel`, '冲突程度不合法')
    if (!arrayAt(item.communicationGoalIds) || item.communicationGoalIds.length === 0 || item.communicationGoalIds.some((goal) => !goals.has(goal as CommunicationGoal))) add(`${path}.communicationGoalIds`, '沟通目标不合法')
    const responseIds = new Set(choices.filter(({ kind }) => kind === 'response').map(({ value }) => value).filter(nonEmpty))
    for (const [key, ids] of [['emotionIds', feelingIds], ['needIds', needIds], ['originalExpressionIds', originalIds], ['responseIds', responseIds]] as const) {
      if (!arrayAt(item[key]) || item[key].length === 0) add(`${path}.${key}`, '引用不能为空')
      else item[key].forEach((id, refIndex) => { if (!nonEmpty(id) || !ids.has(id)) add(`${path}.${key}[${refIndex}]`, '悬空引用') })
    }
    if (!nonEmpty(item.rewriteId) || !rewriteIds.has(item.rewriteId)) add(`${path}.rewriteId`, '悬空改写引用')
    if (!safetyLevels.has(String(item.safetyLevel))) add(`${path}.safetyLevel`, '安全等级不合法')
    if (item.contentVersion !== input.contentVersion) add(`${path}.contentVersion`, '必须与内容包版本一致')
    for (const key of ['riskPoints', 'likelyResponses', 'safetyTags']) if (!arrayAt(item[key])) add(`${path}.${key}`, '必须是数组')
    for (const key of ['riskPoints', 'likelyResponses']) {
      if (arrayAt(item[key])) item[key].forEach((text, textIndex) => {
        if (!nonEmpty(text)) add(`${path}.${key}[${textIndex}]`, '文案不能为空')
        else if (forbiddenContent.test(text)) add(`${path}.${key}[${textIndex}]`, '包含诊断式或操控性文案')
      })
    }
    if (item.safetyLevel === 'safety' && (!nonEmpty(item.safetyRuleId) || !ruleIds.has(item.safetyRuleId))) add(`${path}.safetyRuleId`, '安全情境必须引用安全提示')
  })

  rewrites.forEach((item, index) => {
    const path = `content.rewrites[${index}]`
    if (!nonEmpty(item.scenarioId) || !scenarioIds.has(item.scenarioId)) add(`${path}.scenarioId`, '悬空情境引用')
    const owner = scenarios.find(({ rewriteId }) => rewriteId === item.id)
    if (owner && owner.scenarioId !== item.scenarioId) add(`${path}.scenarioId`, '改写与情境的双向引用不一致')
    if (!arrayAt(item.structure) || item.structure.length === 0) add(`${path}.structure`, '表达结构不能为空')
    else item.structure.forEach((text, textIndex) => { if (!nonEmpty(text)) add(`${path}.structure[${textIndex}]`, '文案不能为空') })
    if (!objectAt(item.tones)) add(`${path}.tones`, '三语气版本缺失')
    else for (const tone of ['gentle', 'direct', 'firm']) requireText(item.tones, tone, `${path}.tones`)
    for (const key of ['misunderstanding', 'repairLine', 'nextTimeLine', 'summary', 'shareSummary']) requireText(item, key, path)
    if (!arrayAt(item.discouragedExpressions) || item.discouragedExpressions.length === 0) add(`${path}.discouragedExpressions`, '不建议表达不能为空')
    else item.discouragedExpressions.forEach((text, textIndex) => { if (!nonEmpty(text)) add(`${path}.discouragedExpressions[${textIndex}]`, '文案不能为空') })
    if (!arrayAt(item.nextSteps) || item.nextSteps.length === 0) add(`${path}.nextSteps`, '至少需要一个可执行下一步')
    else item.nextSteps.forEach((step, stepIndex) => {
      const stepPath = `${path}.nextSteps[${stepIndex}]`
      if (!objectAt(step)) add(stepPath, '下一步必须是对象')
      else {
        registerId(step.id, `${stepPath}.id`)
        requireText(step, 'label', stepPath)
        requireText(step, 'description', stepPath)
        if (!['clarify', 'repair', 'coordinate', 'pause', 'document', 'seek-support'].includes(String(step.action))) add(`${stepPath}.action`, '下一步动作不合法')
      }
    })
  })

  safetyRules.forEach((item, index) => {
    const path = `content.safetyRules[${index}]`
    requireText(item, 'title', path)
    requireText(item, 'message', path)
    if (!arrayAt(item.actions) || item.actions.length === 0) add(`${path}.actions`, '安全提示至少需要一个动作')
    else item.actions.forEach((text, textIndex) => { if (!nonEmpty(text)) add(`${path}.actions[${textIndex}]`, '文案不能为空') })
    if (!objectAt(item.fallback)) add(`${path}.fallback`, '安全 fallback 不能为空')
    else {
      const fallback = item.fallback
      for (const key of ['scenarioTitle', 'misunderstanding', 'repairLine', 'nextTimeLine', 'summary', 'shareSummary']) requireText(fallback, key, `${path}.fallback`)
      if (!arrayAt(fallback.structure) || fallback.structure.length === 0 || fallback.structure.some((text) => !nonEmpty(text))) add(`${path}.fallback.structure`, '安全表达结构不能为空')
      if (!objectAt(fallback.tones)) add(`${path}.fallback.tones`, '安全三语气版本缺失')
      else for (const tone of ['gentle', 'direct', 'firm']) requireText(fallback.tones, tone, `${path}.fallback.tones`)
      if (!arrayAt(fallback.nextSteps) || fallback.nextSteps.length === 0) add(`${path}.fallback.nextSteps`, '安全下一步不能为空')
      else fallback.nextSteps.forEach((step, stepIndex) => {
        const stepPath = `${path}.fallback.nextSteps[${stepIndex}]`
        if (!objectAt(step)) add(stepPath, '安全下一步必须是对象')
        else {
          registerId(step.id, `${stepPath}.id`)
          requireText(step, 'label', stepPath)
          requireText(step, 'description', stepPath)
          if (step.action !== 'seek-support') add(`${stepPath}.action`, '安全下一步必须优先寻求支持')
        }
      })
    }
  })

  return { ok: errors.length === 0, errors }
}

export function parseContent(input: unknown): ConversationContentPackage {
  const result = validateContent(input, 'production')
  if (!result.ok) throw new Error(result.errors.map(({ path, message }) => `${path}: ${message}`).join('\n'))
  return input as ConversationContentPackage
}

export type ContentCollections = {
  feelings: EmotionOption[]
  needs: VocabularyItem[]
  scenarios: ConversationScenario[]
  choices: ChoiceDefinition[]
  rewrites: AlternativeExpression[]
  safetyRules: SafetyRule[]
}
