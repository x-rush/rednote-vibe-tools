import { DIFFICULTIES, ENERGY_LEVELS, ENVIRONMENTS, LOCATIONS, QUEST_CATEGORIES, SOCIAL_LEVELS, TIME_COSTS, TIMES_OF_DAY } from './schema'
import type { EarthOnlineContent, Quest, ValidationIssue, ValidationResult } from './schema'

const idPattern = /^[a-z][a-z0-9-]*$/
const taskAssetPattern = /^quest-icon-[a-z][a-z0-9-]*$/
const universalSafety = ['no-purchase', 'no-photo-required', 'no-personal-data']
const allowedInapplicableConditions = ['unsafe-weather', 'unfamiliar-area', 'physical-discomfort', 'shared-space-unavailable', 'screen-unavailable', 'materials-unavailable']

export function validateContent(input: unknown, mode: 'envelope' | 'production' = 'production'): ValidationResult {
  const issues: ValidationIssue[] = []
  if (!isRecord(input)) return result([{ path: '$', message: '内容包必须是对象' }])
  required(input, 'schemaVersion', 'number', issues)
  required(input, 'contentVersion', 'string', issues)
  if (input.projectId !== 'earth-online') issues.push({ path: '$.projectId', message: '项目 ID 必须为 earth-online' })
  if (!isRecord(input.meta)) issues.push({ path: '$.meta', message: '缺少 meta' })
  if (!Array.isArray(input.sources)) issues.push({ path: '$.sources', message: 'sources 必须为数组' })
  if (!isRecord(input.content)) issues.push({ path: '$.content', message: '缺少 content' })
  if (mode === 'envelope' || !isRecord(input.content)) return result(issues)

  const content = input as unknown as EarthOnlineContent
  const requiredRoots = ['categories', 'goals', 'badges', 'tasks', 'filters', 'safetyRules'] as const
  for (const key of requiredRoots) if (!Array.isArray(content.content[key])) issues.push({ path: `$.content.${key}`, message: '必须为数组' })
  if (!Array.isArray(content.content.tasks)) return result(issues)
  if (content.content.tasks.length !== 100) issues.push({ path: '$.content.tasks', message: '首发任务必须恰好 100 条' })

  const badgeIds = new Set(Array.isArray(content.content.badges) ? content.content.badges.map((badge) => badge.id) : [])
  const goalIds = new Set(Array.isArray(content.content.goals) ? content.content.goals.map((goal) => goal.id) : [])
  const questIds = new Set<string>()
  for (const [index, quest] of content.content.tasks.entries()) validateQuest(quest, index, issues, questIds, badgeIds, goalIds)
  return result(issues)
}

function validateQuest(quest: Quest, index: number, issues: ValidationIssue[], questIds: Set<string>, badgeIds: Set<string>, goalIds: Set<string>): void {
  const base = `$.content.tasks[${index}]`
  if (!idPattern.test(quest.questId ?? '')) issues.push({ path: `${base}.questId`, message: '任务 ID 必须为 kebab-case' })
  if (questIds.has(quest.questId)) issues.push({ path: `${base}.questId`, message: '任务 ID 重复' })
  questIds.add(quest.questId)
  if (!nonEmpty(quest.title)) issues.push({ path: `${base}.title`, message: '标题不能为空' })
  if (!nonEmpty(quest.description)) issues.push({ path: `${base}.description`, message: '描述不能为空' })
  enumValue(quest.category, QUEST_CATEGORIES, `${base}.category`, issues)
  enumValue(quest.timeCost, TIME_COSTS, `${base}.timeCost`, issues)
  enumValue(quest.energyLevel, ENERGY_LEVELS, `${base}.energyLevel`, issues)
  enumValue(quest.locationCondition, LOCATIONS, `${base}.locationCondition`, issues)
  enumValue(quest.socialLevel, SOCIAL_LEVELS, `${base}.socialLevel`, issues)
  enumValue(quest.difficulty, DIFFICULTIES, `${base}.difficulty`, issues)
  arrayEnums(quest.environments, ENVIRONMENTS, `${base}.environments`, issues)
  arrayEnums(quest.times, TIMES_OF_DAY, `${base}.times`, issues)
  if (!Number.isInteger(quest.xp) || quest.xp < 1 || quest.xp > 100) issues.push({ path: `${base}.xp`, message: 'XP 必须是 1–100 的整数' })
  if (quest.maxCost !== 0 || quest.costRequired !== false) issues.push({ path: `${base}.maxCost`, message: '首发任务必须为 0 元' })
  if (!taskAssetPattern.test(quest.iconAssetId ?? '')) issues.push({ path: `${base}.iconAssetId`, message: 'asset ID 格式错误' })
  if (!Array.isArray(quest.steps) || quest.steps.length < 1 || quest.steps.length > 4) issues.push({ path: `${base}.steps`, message: '步骤必须为 1–4 项' })
  for (const safety of universalSafety) if (!quest.safetyTags?.includes(safety)) issues.push({ path: `${base}.safetyTags`, message: `缺少 ${safety}` })
  if (quest.environments?.includes('outdoor')) {
    for (const safety of ['daylight-only', 'familiar-area-only', 'public-area-only']) if (!quest.safetyTags.includes(safety)) issues.push({ path: `${base}.safetyTags`, message: `户外任务缺少 ${safety}` })
    if (quest.environments.length === 1 && quest.times?.includes('night')) issues.push({ path: `${base}.times`, message: '仅户外任务不可在夜间出现' })
  }
  if (quest.category === 'move') for (const safety of ['comfort-range', 'skip-if-unsuitable']) if (!quest.safetyTags?.includes(safety)) issues.push({ path: `${base}.safetyTags`, message: `运动任务缺少 ${safety}` })
  for (const [badgeIndex, id] of (quest.relatedBadgeIds ?? []).entries()) if (!badgeIds.has(id)) issues.push({ path: `${base}.relatedBadgeIds[${badgeIndex}]`, message: '徽章引用不存在' })
  for (const [goalIndex, id] of (quest.goalIds ?? []).entries()) if (!goalIds.has(id)) issues.push({ path: `${base}.goalIds[${goalIndex}]`, message: '目标引用不存在' })
  for (const [conditionIndex, condition] of (quest.inapplicableConditions ?? []).entries()) if (!allowedInapplicableConditions.includes(condition)) issues.push({ path: `${base}.inapplicableConditions[${conditionIndex}]`, message: '不适用条件非法' })
}

function required(value: Record<string, unknown>, key: string, type: 'string' | 'number', issues: ValidationIssue[]): void {
  if (typeof value[key] !== type) issues.push({ path: `$.${key}`, message: `必须为 ${type}` })
}
function enumValue<T>(value: unknown, allowed: readonly T[], path: string, issues: ValidationIssue[]): void {
  if (!allowed.includes(value as T)) issues.push({ path, message: '枚举值非法' })
}
function arrayEnums<T>(value: unknown, allowed: readonly T[], path: string, issues: ValidationIssue[]): void {
  if (!Array.isArray(value) || value.length === 0 || value.some((item) => !allowed.includes(item as T))) issues.push({ path, message: '枚举数组非法或为空' })
}
function nonEmpty(value: unknown): value is string { return typeof value === 'string' && value.trim().length > 0 }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value) }
function result(issues: ValidationIssue[]): ValidationResult { return { ok: issues.length === 0, issues } }
