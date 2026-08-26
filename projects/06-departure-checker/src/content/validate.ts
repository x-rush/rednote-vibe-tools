import type {
  ChecklistRule,
  DepartureContentPackage,
  RuleCondition,
  RuleEffect,
} from './schema'

export type ValidationMode = 'envelope' | 'production'

export type ValidationIssue = {
  path: string
  code: string
  message: string
}

export type ValidationResult = {
  success: boolean
  issues: ValidationIssue[]
}

const ID_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/
const ICON_PATTERN = /^icon-[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/
const PRIORITIES = new Set(['must', 'should', 'optional'])
const ENTRY_TYPES = new Set(['carry', 'confirmation'])
const INPUT_TYPES = new Set(['boolean', 'single', 'multiple', 'number'])
const OPERATORS = new Set(['equals', 'not-equals', 'gt', 'gte', 'lt', 'lte', 'includes', 'truthy'])

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0

const push = (issues: ValidationIssue[], path: string, code: string, message: string) => {
  issues.push({ path, code, message })
}

const expectArray = (value: unknown, path: string, issues: ValidationIssue[]): unknown[] => {
  if (!Array.isArray(value)) {
    push(issues, path, 'invalid-type', '应为数组')
    return []
  }
  return value
}

const validateId = (value: unknown, path: string, issues: ValidationIssue[]) => {
  if (!isNonEmptyString(value) || !ID_PATTERN.test(value)) {
    push(issues, path, 'invalid-id', 'ID 必须为小写 kebab-case')
  }
}

const validateIcon = (value: unknown, path: string, issues: ValidationIssue[]) => {
  if (!isNonEmptyString(value) || !ICON_PATTERN.test(value)) {
    push(issues, path, 'invalid-asset-id', '图标 asset ID 必须以 icon- 开头并使用 kebab-case')
  }
}

const validateText = (value: unknown, path: string, issues: ValidationIssue[]) => {
  if (!isNonEmptyString(value) || value !== value.trim()) {
    push(issues, path, 'invalid-text', '文本不能为空且不能含首尾空白')
  }
}

const collectUniqueIds = (
  values: unknown[],
  field: string,
  path: string,
  issues: ValidationIssue[],
): Set<string> => {
  const ids = new Set<string>()
  values.forEach((value, index) => {
    if (!isRecord(value)) {
      push(issues, `${path}[${index}]`, 'invalid-type', '实体应为对象')
      return
    }
    const id = value[field]
    validateId(id, `${path}[${index}].${field}`, issues)
    if (typeof id !== 'string') return
    if (ids.has(id)) {
      push(issues, `${path}[${index}].${field}`, 'duplicate-id', `${id} 重复`)
    }
    ids.add(id)
  })
  return ids
}

const validateReferenceList = (
  value: unknown,
  allowed: Set<string>,
  path: string,
  issues: ValidationIssue[],
) => {
  expectArray(value, path, issues).forEach((id, index) => {
    if (typeof id !== 'string' || !allowed.has(id)) {
      push(issues, `${path}[${index}]`, 'missing-reference', `引用 ${String(id)} 不存在`)
    }
  })
}

const validateCondition = (
  value: unknown,
  path: string,
  conditionIds: Set<string>,
  issues: ValidationIssue[],
) => {
  if (!isRecord(value)) {
    push(issues, path, 'invalid-type', '规则条件应为对象')
    return
  }
  if (typeof value.key !== 'string' || !conditionIds.has(value.key)) {
    push(issues, `${path}.key`, 'invalid-condition', `条件 ${String(value.key)} 未定义`)
  }
  if (typeof value.operator !== 'string' || !OPERATORS.has(value.operator)) {
    push(issues, `${path}.operator`, 'invalid-enum', '规则操作符非法')
  }
  if (value.operator !== 'truthy' && value.value === undefined) {
    push(issues, `${path}.value`, 'required-field', '该操作符需要比较值')
  }
}

const validateEffect = (
  effect: unknown,
  path: string,
  itemIds: Set<string>,
  issues: ValidationIssue[],
) => {
  if (!isRecord(effect)) {
    push(issues, path, 'invalid-type', '规则效果应为对象')
    return
  }
  for (const field of ['addItemIds', 'removeItemIds']) {
    if (effect[field] !== undefined) {
      validateReferenceList(effect[field], itemIds, `${path}.${field}`, issues)
    }
  }
  for (const field of ['upgrades', 'downgrades']) {
    if (effect[field] === undefined) continue
    expectArray(effect[field], `${path}.${field}`, issues).forEach((change, index) => {
      const changePath = `${path}.${field}[${index}]`
      if (!isRecord(change)) {
        push(issues, changePath, 'invalid-type', '优先级变化应为对象')
        return
      }
      if (typeof change.itemId !== 'string' || !itemIds.has(change.itemId)) {
        push(issues, `${changePath}.itemId`, 'missing-reference', '优先级项目不存在')
      }
      if (typeof change.priority !== 'string' || !PRIORITIES.has(change.priority)) {
        push(issues, `${changePath}.priority`, 'invalid-enum', '优先级非法')
      }
    })
  }
  if (effect.replacements !== undefined) {
    expectArray(effect.replacements, `${path}.replacements`, issues).forEach((replacement, index) => {
      const replacementPath = `${path}.replacements[${index}]`
      if (!isRecord(replacement)) {
        push(issues, replacementPath, 'invalid-type', '替代关系应为对象')
        return
      }
      for (const field of ['replaceItemId', 'withItemId']) {
        if (typeof replacement[field] !== 'string' || !itemIds.has(replacement[field] as string)) {
          push(issues, `${replacementPath}.${field}`, 'missing-reference', '替代项目不存在')
        }
      }
    })
  }
  if (effect.conflicts !== undefined) {
    expectArray(effect.conflicts, `${path}.conflicts`, issues).forEach((conflict, index) => {
      const conflictPath = `${path}.conflicts[${index}]`
      if (!isRecord(conflict)) {
        push(issues, conflictPath, 'invalid-type', '冲突关系应为对象')
        return
      }
      validateReferenceList(conflict.itemIds, itemIds, `${conflictPath}.itemIds`, issues)
      if (typeof conflict.keepItemId !== 'string' || !itemIds.has(conflict.keepItemId)) {
        push(issues, `${conflictPath}.keepItemId`, 'missing-reference', '冲突保留项目不存在')
      }
      if (Array.isArray(conflict.itemIds) && !conflict.itemIds.includes(conflict.keepItemId)) {
        push(issues, `${conflictPath}.keepItemId`, 'invalid-conflict', '保留项目必须属于冲突项目')
      }
    })
  }
}

const findReplacementCycle = (rules: unknown[]): boolean => {
  const graph = new Map<string, string[]>()
  for (const rule of rules) {
    if (!isRecord(rule) || !isRecord(rule.effect) || !Array.isArray(rule.effect.replacements)) continue
    for (const replacement of rule.effect.replacements) {
      if (!isRecord(replacement)) continue
      if (typeof replacement.replaceItemId !== 'string' || typeof replacement.withItemId !== 'string') continue
      const targets = graph.get(replacement.replaceItemId) ?? []
      targets.push(replacement.withItemId)
      graph.set(replacement.replaceItemId, targets)
    }
  }
  const visiting = new Set<string>()
  const visited = new Set<string>()
  const visit = (id: string): boolean => {
    if (visiting.has(id)) return true
    if (visited.has(id)) return false
    visiting.add(id)
    for (const target of graph.get(id) ?? []) {
      if (visit(target)) return true
    }
    visiting.delete(id)
    visited.add(id)
    return false
  }
  return [...graph.keys()].some(visit)
}

const rulesCanAddToScenario = (rules: unknown[], scenarioId: string): boolean =>
  rules.some((rule) => {
    if (!isRecord(rule) || !isRecord(rule.effect)) return false
    const applies = !Array.isArray(rule.scenarioIds) || rule.scenarioIds.length === 0 || rule.scenarioIds.includes(scenarioId)
    return applies && Array.isArray(rule.effect.addItemIds) && rule.effect.addItemIds.length > 0
  })

export const validateContent = (value: unknown, mode: ValidationMode = 'production'): ValidationResult => {
  const issues: ValidationIssue[] = []
  if (!isRecord(value)) return { success: false, issues: [{ path: '$', code: 'invalid-type', message: '内容包应为对象' }] }

  if (value.schemaVersion !== 1) push(issues, 'schemaVersion', 'unsupported-version', '只支持 schemaVersion 1')
  if (value.projectId !== 'departure-checker') push(issues, 'projectId', 'invalid-project', '项目 ID 不匹配')
  validateText(value.contentVersion, 'contentVersion', issues)

  if (!isRecord(value.meta)) {
    push(issues, 'meta', 'invalid-type', 'meta 应为对象')
  } else {
    validateText(value.meta.title, 'meta.title', issues)
    if (value.meta.locale !== 'zh-CN') push(issues, 'meta.locale', 'invalid-enum', 'locale 必须为 zh-CN')
    validateText(value.meta.updatedAt, 'meta.updatedAt', issues)
  }
  expectArray(value.sources, 'sources', issues)
  if (!isRecord(value.content)) {
    push(issues, 'content', 'invalid-type', 'content 应为对象')
    return { success: false, issues }
  }

  const content = value.content
  const categories = expectArray(content.categories, 'content.categories', issues)
  const locations = expectArray(content.locations, 'content.locations', issues)
  const conditionDefinitions = expectArray(content.conditionDefinitions, 'content.conditionDefinitions', issues)
  const questions = expectArray(content.scenarioQuestions, 'content.scenarioQuestions', issues)
  const scenarios = expectArray(content.scenarios, 'content.scenarios', issues)
  const items = expectArray(content.items, 'content.items', issues)
  const rules = expectArray(content.rules, 'content.rules', issues)

  const categoryIds = collectUniqueIds(categories, 'categoryId', 'content.categories', issues)
  const locationIds = collectUniqueIds(locations, 'locationId', 'content.locations', issues)
  const conditionIds = collectUniqueIds(conditionDefinitions, 'key', 'content.conditionDefinitions', issues)
  const questionIds = collectUniqueIds(questions, 'questionId', 'content.scenarioQuestions', issues)
  const scenarioIds = collectUniqueIds(scenarios, 'scenarioId', 'content.scenarios', issues)
  const itemIds = collectUniqueIds(items, 'itemId', 'content.items', issues)
  collectUniqueIds(rules, 'ruleId', 'content.rules', issues)

  categories.forEach((category, index) => {
    if (!isRecord(category)) return
    validateText(category.label, `content.categories[${index}].label`, issues)
    validateIcon(category.iconAssetId, `content.categories[${index}].iconAssetId`, issues)
  })
  locations.forEach((location, index) => {
    if (!isRecord(location)) return
    validateText(location.label, `content.locations[${index}].label`, issues)
    validateIcon(location.iconAssetId, `content.locations[${index}].iconAssetId`, issues)
  })
  conditionDefinitions.forEach((definition, index) => {
    if (!isRecord(definition)) return
    validateText(definition.label, `content.conditionDefinitions[${index}].label`, issues)
    if (typeof definition.inputType !== 'string' || !INPUT_TYPES.has(definition.inputType)) {
      push(issues, `content.conditionDefinitions[${index}].inputType`, 'invalid-enum', '条件输入类型非法')
    }
  })
  questions.forEach((question, index) => {
    if (!isRecord(question)) return
    if (typeof question.conditionKey !== 'string' || !conditionIds.has(question.conditionKey)) {
      push(issues, `content.scenarioQuestions[${index}].conditionKey`, 'invalid-condition', '问题引用的条件不存在')
    }
    validateText(question.prompt, `content.scenarioQuestions[${index}].prompt`, issues)
  })
  scenarios.forEach((scenario, index) => {
    if (!isRecord(scenario)) return
    validateText(scenario.name, `content.scenarios[${index}].name`, issues)
    validateText(scenario.description, `content.scenarios[${index}].description`, issues)
    validateIcon(scenario.iconAssetId, `content.scenarios[${index}].iconAssetId`, issues)
    validateReferenceList(scenario.baseItemIds, itemIds, `content.scenarios[${index}].baseItemIds`, issues)
    validateReferenceList(scenario.questionIds, questionIds, `content.scenarios[${index}].questionIds`, issues)
    if (mode === 'production' && Array.isArray(scenario.baseItemIds) && scenario.baseItemIds.length === 0 &&
        typeof scenario.scenarioId === 'string' && !rulesCanAddToScenario(rules, scenario.scenarioId)) {
      push(issues, `content.scenarios[${index}]`, 'empty-scenario', '场景无法生成任何项目')
    }
  })
  items.forEach((item, index) => {
    if (!isRecord(item)) return
    const basePath = `content.items[${index}]`
    validateText(item.label, `${basePath}.label`, issues)
    if (typeof item.categoryId !== 'string' || !categoryIds.has(item.categoryId)) {
      push(issues, `${basePath}.categoryId`, 'missing-reference', '分类不存在')
    }
    if (typeof item.locationId !== 'string' || !locationIds.has(item.locationId)) {
      push(issues, `${basePath}.locationId`, 'missing-reference', '位置不存在')
    }
    if (typeof item.entryType !== 'string' || !ENTRY_TYPES.has(item.entryType)) {
      push(issues, `${basePath}.entryType`, 'invalid-enum', '条目类型非法')
    }
    if (typeof item.defaultPriority !== 'string' || !PRIORITIES.has(item.defaultPriority)) {
      push(issues, `${basePath}.defaultPriority`, 'invalid-enum', '优先级非法')
    }
    validateId(item.dedupeKey, `${basePath}.dedupeKey`, issues)
    validateText(item.hint, `${basePath}.hint`, issues)
    if (!isNonEmptyString(item.suggestedReason)) {
      push(issues, `${basePath}.suggestedReason`, 'required-reason', '必带及建议项目必须说明原因')
    }
    validateIcon(item.iconAssetId, `${basePath}.iconAssetId`, issues)
    expectArray(item.safetyTags, `${basePath}.safetyTags`, issues)
    if (item.version !== 1) push(issues, `${basePath}.version`, 'unsupported-version', '项目版本必须为 1')
  })
  rules.forEach((rule, index) => {
    if (!isRecord(rule)) return
    const basePath = `content.rules[${index}]`
    if (rule.scenarioIds !== undefined) validateReferenceList(rule.scenarioIds, scenarioIds, `${basePath}.scenarioIds`, issues)
    for (const field of ['all', 'any']) {
      if (rule[field] === undefined) continue
      expectArray(rule[field], `${basePath}.${field}`, issues).forEach((condition, conditionIndex) =>
        validateCondition(condition, `${basePath}.${field}[${conditionIndex}]`, conditionIds, issues),
      )
    }
    validateEffect(rule.effect, `${basePath}.effect`, itemIds, issues)
    validateText(rule.reason, `${basePath}.reason`, issues)
    if (rule.safetyMandatory === true && !isNonEmptyString(rule.reason)) {
      push(issues, `${basePath}.reason`, 'required-reason', '安全规则必须有可解释原因')
    }
    if (typeof rule.priority !== 'number' || !Number.isInteger(rule.priority)) {
      push(issues, `${basePath}.priority`, 'invalid-type', '规则优先级必须为整数')
    }
  })

  if (findReplacementCycle(rules)) {
    push(issues, 'content.rules', 'replacement-cycle', '替代关系不能形成循环')
  }
  if (mode === 'production') {
    if (scenarios.length !== 8) push(issues, 'content.scenarios', 'invalid-count', '生产内容必须包含 8 个场景')
    if (items.length < 60 || items.length > 90) push(issues, 'content.items', 'invalid-count', '生产内容必须包含 60–90 个项目')
  }
  return { success: issues.length === 0, issues }
}

export class ContentValidationError extends Error {
  readonly issues: ValidationIssue[]

  constructor(issues: ValidationIssue[]) {
    super(`内容包校验失败：${issues.map((issue) => `${issue.path} ${issue.message}`).join('；')}`)
    this.name = 'ContentValidationError'
    this.issues = issues
  }
}

export const loadContent = (value: unknown): DepartureContentPackage => {
  const result = validateContent(value, 'production')
  if (!result.success) throw new ContentValidationError(result.issues)
  return value as DepartureContentPackage
}

export type RecoverableContentLoadResult =
  | { status: 'ok'; content: DepartureContentPackage }
  | {
    status: 'recovered'
    content: DepartureContentPackage
    diagnosticCode: 'CONTENT_RULE_REFERENCE'
  }
  | { status: 'error'; issues: ValidationIssue[] }

export const loadContentRecoverably = (value: unknown): RecoverableContentLoadResult => {
  const strictResult = validateContent(value, 'production')
  if (strictResult.success) return { status: 'ok', content: value as DepartureContentPackage }
  if (!isRecord(value) || !isRecord(value.content) || !Array.isArray(value.content.rules)) {
    return { status: 'error', issues: strictResult.issues }
  }

  const ruleIndexes = new Set<number>()
  for (const issue of strictResult.issues) {
    const match = /^content\.rules\[(\d+)\]/.exec(issue.path)
    if (!match || issue.code !== 'missing-reference') {
      return { status: 'error', issues: strictResult.issues }
    }
    ruleIndexes.add(Number(match[1]))
  }
  if (ruleIndexes.size === 0) return { status: 'error', issues: strictResult.issues }

  const candidate = structuredClone(value)
  if (!isRecord(candidate) || !isRecord(candidate.content) || !Array.isArray(candidate.content.rules)) {
    return { status: 'error', issues: strictResult.issues }
  }
  candidate.content.rules = candidate.content.rules.filter((_rule, index) => !ruleIndexes.has(index))
  const recoveredResult = validateContent(candidate, 'production')
  if (!recoveredResult.success) return { status: 'error', issues: recoveredResult.issues }

  return {
    status: 'recovered',
    content: candidate as DepartureContentPackage,
    diagnosticCode: 'CONTENT_RULE_REFERENCE',
  }
}

export const matchesRuleCondition = (
  condition: RuleCondition,
  conditions: Record<string, unknown>,
): boolean => {
  const actual = conditions[condition.key]
  switch (condition.operator) {
    case 'equals': return actual === condition.value
    case 'not-equals': return actual !== condition.value
    case 'gt': return typeof actual === 'number' && typeof condition.value === 'number' && actual > condition.value
    case 'gte': return typeof actual === 'number' && typeof condition.value === 'number' && actual >= condition.value
    case 'lt': return typeof actual === 'number' && typeof condition.value === 'number' && actual < condition.value
    case 'lte': return typeof actual === 'number' && typeof condition.value === 'number' && actual <= condition.value
    case 'includes': return Array.isArray(actual) && !Array.isArray(condition.value) && actual.includes(condition.value)
    case 'truthy': return Boolean(actual)
  }
}

export const ruleMatches = (
  rule: ChecklistRule,
  scenarioId: string,
  conditions: Record<string, unknown>,
): boolean => {
  if (rule.scenarioIds?.length && !rule.scenarioIds.includes(scenarioId)) return false
  const all = rule.all ?? []
  const any = rule.any ?? []
  return all.every((condition) => matchesRuleCondition(condition, conditions)) &&
    (any.length === 0 || any.some((condition) => matchesRuleCondition(condition, conditions)))
}

export const getEffectItemIds = (effect: RuleEffect): string[] => [
  ...(effect.addItemIds ?? []),
  ...(effect.removeItemIds ?? []),
  ...(effect.upgrades ?? []).map((change) => change.itemId),
  ...(effect.downgrades ?? []).map((change) => change.itemId),
]
