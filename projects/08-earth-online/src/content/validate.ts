import { ACTION_COPY_IDS, DIFFICULTIES, ENERGY_LEVELS, ENVIRONMENTS, LOCATIONS, PAGE_COPY_IDS, QUEST_CATEGORIES, QUEST_TONES, SOCIAL_LEVELS, TIME_COSTS, TIMES_OF_DAY, UNSUITABLE_REASONS } from './schema'
import type { EarthOnlineContent, Quest, UiContent, ValidationIssue, ValidationResult } from './schema'

const idPattern = /^[a-z][a-z0-9-]*$/
const taskAssetPattern = /^quest-icon-[a-z][a-z0-9-]*$/
const universalSafety = ['no-purchase', 'no-photo-required', 'no-personal-data']
const allowedInapplicableConditions = ['unsafe-weather', 'unfamiliar-area', 'physical-discomfort', 'shared-space-unavailable', 'screen-unavailable', 'materials-unavailable']
const activeTemplatePhrases = ['认真演完这段荒唐，普通日常就会短暂获得剧情。', '只挑战一次已经算赢，任何不舒服都可以立刻撤退。', '不求感谢、不留证明，让善意自然发生后就离场。', '把范围锁小，完成后允许这点进步正式算数。', '用一句话确认刚才发生了什么，不追加更大的目标。', '完成后给这段行动起一个荒唐但正式的任务名，然后立刻收工。']
const xpByDifficulty = { tiny: 20, light: 35, standard: 55, brave: 80 } as const

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
  const requiredRoots = ['categories', 'goals', 'badges', 'tasks', 'retiredTasks', 'legacyTasks', 'filters', 'safetyRules'] as const
  for (const key of requiredRoots) if (!Array.isArray(content.content[key])) issues.push({ path: `$.content.${key}`, message: '必须为数组' })
  if (!isRecord(content.content.ui)) issues.push({ path: '$.content.ui', message: '缺少完整 UI 文案' })
  else validateUi(content.content.ui, issues)
  if (!Array.isArray(content.content.tasks)) return result(issues)
  if (content.content.tasks.length < 100) issues.push({ path: '$.content.tasks', message: '活跃任务不得少于 100 条' })

  const badgeIds = new Set(Array.isArray(content.content.badges) ? content.content.badges.map((badge) => badge.id) : [])
  const goalIds = new Set(Array.isArray(content.content.goals) ? content.content.goals.map((goal) => goal.id) : [])
  const questIds = new Set<string>()
  for (const [index, quest] of content.content.tasks.entries()) validateQuest(quest, `$.content.tasks[${index}]`, issues, questIds, badgeIds, goalIds, true, content.contentVersion)
  if (Array.isArray(content.content.retiredTasks)) for (const [index, quest] of content.content.retiredTasks.entries()) validateQuest(quest, `$.content.retiredTasks[${index}]`, issues, questIds, badgeIds, goalIds, false)
  if (Array.isArray(content.content.legacyTasks)) {
    const activeIds = new Set(content.content.tasks.map(({ questId }) => questId))
    const retiredIds = new Set(Array.isArray(content.content.retiredTasks) ? content.content.retiredTasks.map(({ questId }) => questId) : [])
    const archivedVersionKeys = new Set([
      ...content.content.tasks,
      ...(Array.isArray(content.content.retiredTasks) ? content.content.retiredTasks : []),
    ].map((quest) => `${quest.questId}@${quest.contentVersion}`))
    for (const [index, quest] of content.content.legacyTasks.entries()) {
      const versionKey = `${quest.questId}@${quest.contentVersion}`
      if (archivedVersionKeys.has(versionKey)) issues.push({ path: `$.content.legacyTasks[${index}].contentVersion`, message: '旧版本任务 ID 与内容版本重复' })
      archivedVersionKeys.add(versionKey)
      validateQuest(quest, `$.content.legacyTasks[${index}]`, issues, new Set(), badgeIds, goalIds, false)
      if (!activeIds.has(quest.questId) && !retiredIds.has(quest.questId)) issues.push({ path: `$.content.legacyTasks[${index}].questId`, message: '旧版本任务必须对应活跃或退役目录 ID' })
      if (quest.contentVersion === content.contentVersion) issues.push({ path: `$.content.legacyTasks[${index}].contentVersion`, message: '旧版本任务不能与当前内容版本相同' })
    }
  }
  const normalizedRules = new Set(content.content.tasks.map((quest) => quest.abandonRule.replace(quest.title, '{title}')))
  const normalizedTexts = new Set(content.content.tasks.map((quest) => quest.abandonText.replace(quest.title, '{title}')))
  if (normalizedRules.size !== content.content.tasks.length || normalizedTexts.size !== content.content.tasks.length || content.content.tasks.some((quest) => !quest.abandonRule.includes(quest.steps[0]) || !quest.abandonText.includes(quest.completionMethod))) issues.push({ path: '$.content.tasks', message: '活跃任务必须使用任务专属退出规则和文案' })
  if (!hasReleaseDistribution(content.content.tasks)) issues.push({ path: '$.content.tasks', message: '活跃任务时间、精力或难度分布不符合内容版本契约' })
  return result(issues)
}

function validateUi(ui: UiContent, issues: ValidationIssue[]): void {
  if (!isRecord(ui.brand) || Object.values(ui.brand).some((value) => !nonEmpty(value))) issues.push({ path: '$.content.ui.brand', message: '品牌文案不完整' })
  const navigationIds = Array.isArray(ui.navigation) ? ui.navigation.map(({ id }) => id) : []
  if (navigationIds.join(',') !== 'guildHall,questHistory,badgeList,adventurerProfile' || ui.navigation.some(({ label }) => !nonEmpty(label))) issues.push({ path: '$.content.ui.navigation', message: '导航文案不完整或顺序错误' })
  if (!isRecord(ui.intro) || !Array.isArray(ui.intro.lines) || ui.intro.lines.length !== 3 || ui.intro.lines.some((line) => !nonEmpty(line)) || !nonEmpty(ui.intro.name) || !nonEmpty(ui.intro.role) || !nonEmpty(ui.intro.helpLabel) || !nonEmpty(ui.intro.skipLabel) || !nonEmpty(ui.intro.nextLabel) || !nonEmpty(ui.intro.finishLabel)) issues.push({ path: '$.content.ui.intro', message: '首次引导必须包含身份、操作与三句文案' })
  if (!isRecord(ui.hud) || !allRecordStrings(ui.hud)) issues.push({ path: '$.content.ui.hud', message: '顶栏身份文案不完整' })
  validateCopyRecord(ui.pages, PAGE_COPY_IDS, '$.content.ui.pages', issues, (value) => isRecord(value) && nonEmpty(value.eyebrow) && nonEmpty(value.title) && nonEmpty(value.description))
  validateCopyRecord(ui.actions, ACTION_COPY_IDS, '$.content.ui.actions', issues, nonEmpty)
  validateCopyRecord(ui.reasons, UNSUITABLE_REASONS, '$.content.ui.reasons', issues, nonEmpty)
  if (!isRecord(ui.helpDialogue) || !allRecordStrings(ui.helpDialogue)) issues.push({ path: '$.content.ui.helpDialogue', message: '弥拉会面对话文案不完整' })
  if (!Array.isArray(ui.help) || ui.help.length !== 5 || ui.help.some((item) => !isRecord(item) || !nonEmpty(item.id) || !nonEmpty(item.title) || !nonEmpty(item.body))) issues.push({ path: '$.content.ui.help', message: '帮助内容必须恰好五项' })
  if (!isRecord(ui.notices) || ['privacy', 'noProof', 'noPressure', 'temporary', 'indexedDb'].some((key) => !nonEmpty(ui.notices[key as keyof UiContent['notices']]))) issues.push({ path: '$.content.ui.notices', message: '隐私与恢复提示不完整' })
  if (!isRecord(ui.checkIn) || !isRecord(ui.checkIn.legends) || Object.values(ui.checkIn.legends).some((value) => !nonEmpty(value)) || !Array.isArray(ui.checkIn.energyLabels) || ui.checkIn.energyLabels.length !== 3) issues.push({ path: '$.content.ui.checkIn', message: '状态登记文案不完整' })
  if (!isRecord(ui.quest) || !isRecord(ui.quest.labels) || Object.values(ui.quest.labels).some((value) => !nonEmpty(value)) || !isRecord(ui.quest.tones) || QUEST_TONES.some((tone) => !nonEmpty(ui.quest.tones[tone])) || !isRecord(ui.quest.values) || !Array.isArray(ui.quest.neverRelaxed) || ui.quest.neverRelaxed.length !== 5 || ui.quest.neverRelaxed.some((value) => !nonEmpty(value))) issues.push({ path: '$.content.ui.quest', message: '任务纸文案不完整' })
  if (!isRecord(ui.matching) || !isRecord(ui.matching.stages) || Object.values(ui.matching.stages).some((stage) => !isRecord(stage) || !nonEmpty(stage.reason) || !Array.isArray(stage.relaxed)) || !allRecordStrings(ui.matching.positive) || !isRecord(ui.matching.noMatch) || !nonEmpty(ui.matching.noMatch.reason) || !Array.isArray(ui.matching.noMatch.neverRelaxed) || ui.matching.noMatch.neverRelaxed.length !== 5) issues.push({ path: '$.content.ui.matching', message: '匹配解释文案不完整' })
  if (!allRecordStrings(ui.sheets)) issues.push({ path: '$.content.ui.sheets', message: '确认弹层文案不完整' })
  if (!isRecord(ui.archive) || !allRecordStrings(ui.archive.filters) || !allRecordStrings(ui.archive.statuses) || Object.entries(ui.archive).some(([key, value]) => !['filters', 'statuses'].includes(key) && !nonEmpty(value))) issues.push({ path: '$.content.ui.archive', message: '日志与图鉴文案不完整' })
  if (!allRecordStrings(ui.profile)) issues.push({ path: '$.content.ui.profile', message: '档案文案不完整' })
  if (!allRecordStrings(ui.recovery)) issues.push({ path: '$.content.ui.recovery', message: '恢复文案不完整' })
}

function validateCopyRecord<T extends string>(value: unknown, keys: readonly T[], path: string, issues: ValidationIssue[], valid: (entry: unknown) => boolean): void {
  if (!isRecord(value) || keys.some((key) => !valid(value[key])) || Object.keys(value).some((key) => !keys.includes(key as T))) issues.push({ path, message: '文案键不完整或包含未知项' })
}

function validateQuest(quest: Quest, base: string, issues: ValidationIssue[], questIds: Set<string>, badgeIds: Set<string>, goalIds: Set<string>, active: boolean, packageContentVersion?: string): void {
  if (!idPattern.test(quest.questId ?? '')) issues.push({ path: `${base}.questId`, message: '任务 ID 必须为 kebab-case' })
  if (questIds.has(quest.questId)) issues.push({ path: `${base}.questId`, message: '任务 ID 重复' })
  questIds.add(quest.questId)
  if (!nonEmpty(quest.title)) issues.push({ path: `${base}.title`, message: '标题不能为空' })
  if (!nonEmpty(quest.description)) issues.push({ path: `${base}.description`, message: '描述不能为空' })
  if (!nonEmpty(quest.contentVersion)) issues.push({ path: `${base}.contentVersion`, message: '内容版本不能为空' })
  if (typeof quest.approved !== 'boolean') issues.push({ path: `${base}.approved`, message: '审核状态必须为布尔值' })
  enumValue(quest.tone, QUEST_TONES, `${base}.tone`, issues)
  if (!nonEmpty(quest.guildBrief) || quest.guildBrief.trim().length < 8 || quest.guildBrief.trim().length > 64) issues.push({ path: `${base}.guildBrief`, message: '公会简报必须为 8–64 字' })
  enumValue(quest.category, QUEST_CATEGORIES, `${base}.category`, issues)
  enumValue(quest.timeCost, TIME_COSTS, `${base}.timeCost`, issues)
  enumValue(quest.energyLevel, ENERGY_LEVELS, `${base}.energyLevel`, issues)
  enumValue(quest.locationCondition, LOCATIONS, `${base}.locationCondition`, issues)
  enumValue(quest.socialLevel, SOCIAL_LEVELS, `${base}.socialLevel`, issues)
  enumValue(quest.difficulty, DIFFICULTIES, `${base}.difficulty`, issues)
  arrayEnums(quest.environments, ENVIRONMENTS, `${base}.environments`, issues)
  arrayEnums(quest.times, TIMES_OF_DAY, `${base}.times`, issues)
  if (!Number.isInteger(quest.xp) || quest.xp < 1 || quest.xp > 100) issues.push({ path: `${base}.xp`, message: 'XP 必须是 1–100 的整数' })
  if (active && xpByDifficulty[quest.difficulty] !== quest.xp) issues.push({ path: `${base}.xp`, message: 'XP 必须与难度档位一致' })
  if (active && quest.approved !== true) issues.push({ path: `${base}.approved`, message: '活跃任务必须通过审核' })
  if (active && quest.contentVersion !== packageContentVersion) issues.push({ path: `${base}.contentVersion`, message: '活跃任务内容版本必须与内容包一致' })
  if (active && ![3, 7, 14].includes(quest.cooldownDays)) issues.push({ path: `${base}.cooldownDays`, message: '冷却只能为 3、7 或 14 天' })
  if (active && activeTemplatePhrases.some((phrase) => `${quest.description}\n${quest.steps?.join('\n') ?? ''}`.includes(phrase))) issues.push({ path: `${base}.description`, message: '活跃任务不得使用旧通用文案模板' })
  if (quest.maxCost !== 0 || quest.costRequired !== false) issues.push({ path: `${base}.maxCost`, message: '首发任务必须为 0 元' })
  if (!taskAssetPattern.test(quest.iconAssetId ?? '')) issues.push({ path: `${base}.iconAssetId`, message: 'asset ID 格式错误' })
  if (!Array.isArray(quest.steps) || quest.steps.length < 1 || quest.steps.length > 4) issues.push({ path: `${base}.steps`, message: '步骤必须为 1–4 项' })
  for (const safety of universalSafety) if (!quest.safetyTags?.includes(safety)) issues.push({ path: `${base}.safetyTags`, message: `缺少 ${safety}` })
  if (quest.environments?.includes('outdoor')) {
    for (const safety of ['familiar-area-only', 'public-area-only']) if (!quest.safetyTags.includes(safety)) issues.push({ path: `${base}.safetyTags`, message: `户外任务缺少 ${safety}` })
    const isNightSafe = quest.safetyTags.includes('night-safe')
    if (!isNightSafe && !quest.safetyTags.includes('daylight-only')) issues.push({ path: `${base}.safetyTags`, message: '户外任务必须限制白天或通过夜间安全审核' })
    if (isNightSafe) {
      for (const safety of ['well-lit-only', 'no-road-crossing', 'skip-if-unsuitable']) if (!quest.safetyTags.includes(safety)) issues.push({ path: `${base}.safetyTags`, message: `夜间户外任务缺少 ${safety}` })
      if (!quest.times?.includes('night')) issues.push({ path: `${base}.times`, message: '夜间安全任务必须允许夜间' })
      if (quest.safetyTags.includes('daylight-only')) issues.push({ path: `${base}.safetyTags`, message: '夜间安全任务不能同时限制为白天' })
    }
  }
  if (quest.category === 'move') for (const safety of ['comfort-range', 'skip-if-unsuitable']) if (!quest.safetyTags?.includes(safety)) issues.push({ path: `${base}.safetyTags`, message: `运动任务缺少 ${safety}` })
  for (const [badgeIndex, id] of (quest.relatedBadgeIds ?? []).entries()) if (!badgeIds.has(id)) issues.push({ path: `${base}.relatedBadgeIds[${badgeIndex}]`, message: '徽章引用不存在' })
  for (const [goalIndex, id] of (quest.goalIds ?? []).entries()) if (!goalIds.has(id)) issues.push({ path: `${base}.goalIds[${goalIndex}]`, message: '目标引用不存在' })
  for (const [conditionIndex, condition] of (quest.inapplicableConditions ?? []).entries()) if (!allowedInapplicableConditions.includes(condition)) issues.push({ path: `${base}.inapplicableConditions[${conditionIndex}]`, message: '不适用条件非法' })
}

function required(value: Record<string, unknown>, key: string, type: 'string' | 'number', issues: ValidationIssue[]): void {
  if (typeof value[key] !== type) issues.push({ path: `$.${key}`, message: `必须为 ${type}` })
}
function hasReleaseDistribution(quests: Quest[]): boolean {
  const count = (key: 'timeCost' | 'energyLevel' | 'difficulty', value: string | number) => quests.filter((quest) => quest[key] === value).length
  const categoryCountsValid = QUEST_CATEGORIES.every((category) => quests.filter((quest) => quest.category === category).length >= 10)
  return categoryCountsValid
    && count('timeCost', 5) >= 30 && count('timeCost', 10) >= 35 && count('timeCost', 15) >= 25 && count('timeCost', 20) >= 10
    && count('energyLevel', 1) >= 45 && count('energyLevel', 2) >= 40 && count('energyLevel', 3) >= 15
    && count('difficulty', 'tiny') >= 35 && count('difficulty', 'light') >= 40 && count('difficulty', 'standard') >= 20 && count('difficulty', 'brave') >= 5
}
function enumValue<T>(value: unknown, allowed: readonly T[], path: string, issues: ValidationIssue[]): void {
  if (!allowed.includes(value as T)) issues.push({ path, message: '枚举值非法' })
}
function arrayEnums<T>(value: unknown, allowed: readonly T[], path: string, issues: ValidationIssue[]): void {
  if (!Array.isArray(value) || value.length === 0 || value.some((item) => !allowed.includes(item as T))) issues.push({ path, message: '枚举数组非法或为空' })
}
function nonEmpty(value: unknown): value is string { return typeof value === 'string' && value.trim().length > 0 }
function allRecordStrings(value: unknown): boolean { return isRecord(value) && Object.keys(value).length > 0 && Object.values(value).every(nonEmpty) }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value) }
function result(issues: ValidationIssue[]): ValidationResult { return { ok: issues.length === 0, issues } }
