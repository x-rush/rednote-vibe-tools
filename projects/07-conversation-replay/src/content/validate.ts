import type {
  AlternativeExpression,
  ChoiceDefinition,
  CommunicationGoal,
  ConflictLevel,
  ConversationContentPackage,
  ConversationScenario,
  EmotionOption,
  NpcMomentKey,
  NpcPose,
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
const selfCondemningCopy = /(刚才我攻击了你|我刚才(?:也)?攻击了|我刚才用反话伤人|我刚才评价了你|刚才那句话带了攻击)/
const npcMomentKeys: NpcMomentKey[] = [
  'landing', 'privacy', 'guide', 'relationship', 'goal', 'scenario', 'fact', 'feeling',
  'inference', 'need', 'request', 'draft', 'practice', 'comparison', 'result', 'saved',
  'exit', 'safety', 'recovery',
]
const npcPoses = new Set<NpcPose>(['welcome', 'attend', 'observe', 'sort', 'pause', 'compose', 'complete', 'safety'])
const npcCopyRisks = [
  { pattern: /只有(我|迟言).{0,8}(懂|理解|需要|陪)/, message: '包含排他依赖暗示' },
  { pattern: /(我会|迟言会).{0,6}(永远|一直).{0,8}(陪|守着|在)/, message: '包含永久承诺' },
  { pattern: /(?<!不)(一定会|保证).{0,12}(理解|答应|原谅|改变)/, message: '包含结果保证' },
  { pattern: /(必须|现在).{0,10}(当面)?对质/, message: '包含强迫对质建议' },
] as const

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

  const arrayRootKeys = ['feelings', 'needs', 'scenarios', 'choices', 'rewrites', 'safetyRules']
  const rootKeys = ['intro', 'npc', ...arrayRootKeys]
  if (!objectAt(input.content.intro)) add('content.intro', '入口文案必须是对象')
  if (!objectAt(input.content.npc)) add('content.npc', 'NPC 内容必须是对象')
  for (const key of arrayRootKeys) if (!arrayAt(input.content[key])) add(`content.${key}`, '必须是数组')
  for (const key of Object.keys(input.content)) if (!rootKeys.includes(key)) add(`content.${key}`, '未知业务根字段')
  if (errors.length > 0 || mode === 'envelope') return { ok: errors.length === 0, errors }

  const npc = input.content.npc as Record<string, unknown>
  const intro = input.content.intro as Record<string, unknown>
  const requireIntroCopy = (value: unknown, path: string) => {
    if (!nonEmpty(value)) {
      add(path, '入口文案不能为空')
      return
    }
    if (forbiddenContent.test(value)) add(path, '包含诊断式或操控性文案')
    for (const risk of npcCopyRisks) if (risk.pattern.test(value)) add(path, risk.message)
  }
  const introFields = {
    landing: ['eyebrow', 'lead', 'primaryLabel', 'secondaryLabel', 'beforeText', 'afterText', 'privacyNoteTitle', 'privacyNoteBody'],
    privacy: ['eyebrow', 'title', 'lead', 'primaryLabel', 'secondaryLabel', 'ephemeralDescription', 'localDescription'],
    replayCard: [
      'saveLabel', 'savingLabel', 'savedMessage', 'unavailableMessage', 'generationFailedMessage',
      'writeFailedMessage', 'permissionFailedMessage', 'brandLabel', 'attributionLabel', 'factLabel',
      'feelingLabel', 'inferenceLabel', 'inferenceHint', 'needLabel', 'requestLabel', 'statementLabel',
      'responsibilityNotice', 'footerNote', 'emptyFact', 'emptyFeeling', 'emptyInference', 'emptyNeed', 'emptyRequest',
    ],
    result: [
      'gentleLabel', 'directLabel', 'firmLabel', 'incompleteMessage', 'cardIncompleteMessage', 'editorLabel',
      'toneNoteTitle', 'toneNoteBody', 'practiceActionLabel', 'compareActionLabel', 'practicePromptLabel',
      'practiceReplyLabel', 'practiceNote', 'beforeLabel', 'beforeFallback', 'beforeExplanation', 'afterLabel',
      'viewCardLabel', 'cardEyebrow',
    ],
    system: [
      'localSaveSuccess', 'localSaveFailure', 'unnamedScenario', 'requestNoteTitle', 'requestNoteBody',
      'recoveryMemoryTitle', 'recoveryMemoryBody',
    ],
  } as const
  for (const [page, fields] of Object.entries(introFields)) {
    const screen = intro[page]
    if (!objectAt(screen)) {
      add(`content.intro.${page}`, '入口页面文案必须是对象')
      continue
    }
    for (const field of fields) requireIntroCopy(screen[field], `content.intro.${page}.${field}`)
  }
  const privacy = intro.privacy
  if (objectAt(privacy)) {
    if (!arrayAt(privacy.sections) || privacy.sections.length !== 3) add('content.intro.privacy.sections', '隐私保证必须恰好三项')
    else {
      const expectedIds = new Set(['no-upload', 'no-judgment', 'local-only'])
      privacy.sections.forEach((section, index) => {
        const path = `content.intro.privacy.sections[${index}]`
        if (!objectAt(section)) {
          add(path, '隐私保证必须是对象')
          return
        }
        if (!nonEmpty(section.id) || !expectedIds.delete(section.id)) add(`${path}.id`, '隐私保证 ID 缺失或重复')
        requireIntroCopy(section.title, `${path}.title`)
        requireIntroCopy(section.body, `${path}.body`)
      })
      if (expectedIds.size > 0) add('content.intro.privacy.sections', '缺少必需的隐私保证')
    }
  }
  const system = intro.system
  if (objectAt(system)) {
    if (!arrayAt(system.exitItems) || system.exitItems.length !== 3) add('content.intro.system.exitItems', '退出提示必须恰好三项')
    else system.exitItems.forEach((item, index) => requireIntroCopy(item, `content.intro.system.exitItems[${index}]`))
  }
  const requireNpcCopy = (value: unknown, path: string) => {
    if (!nonEmpty(value)) {
      add(path, '陪伴文案不能为空')
      return
    }
    for (const risk of npcCopyRisks) if (risk.pattern.test(value)) add(path, risk.message)
  }
  if (npc.id !== 'chiyan') add('content.npc.id', 'NPC ID 必须为 chiyan')
  for (const key of ['name', 'role']) requireNpcCopy(npc[key], `content.npc.${key}`)
  if (!arrayAt(npc.boundaries) || npc.boundaries.length === 0) add('content.npc.boundaries', '陪伴边界不能为空')
  else npc.boundaries.forEach((boundary, index) => requireNpcCopy(boundary, `content.npc.boundaries[${index}]`))
  if (!objectAt(npc.moments)) add('content.npc.moments', '陪伴时刻必须是对象')
  else {
    for (const key of npcMomentKeys) {
      const path = `content.npc.moments.${key}`
      const moment = npc.moments[key]
      if (!objectAt(moment)) {
        add(path, '缺少陪伴时刻')
        continue
      }
      if (!npcPoses.has(moment.pose as NpcPose)) add(`${path}.pose`, '立绘姿态不合法')
      requireNpcCopy(moment.invitation, `${path}.invitation`)
      requireNpcCopy(moment.autonomy, `${path}.autonomy`)
      if (moment.reassurance !== undefined) requireNpcCopy(moment.reassurance, `${path}.reassurance`)
    }
    for (const key of Object.keys(npc.moments)) if (!npcMomentKeys.includes(key as NpcMomentKey)) add(`content.npc.moments.${key}`, '未知陪伴时刻')

    const safety = npc.moments.safety
    if (objectAt(safety)) {
      if (safety.pose !== 'safety') add('content.npc.moments.safety.pose', '安全时刻必须使用 safety 姿态')
      if (!nonEmpty(safety.reassurance) || !safety.reassurance.includes('现实')) add('content.npc.moments.safety.reassurance', '安全提示必须明确现实支持优先')
      const safetyCopy = [safety.invitation, safety.reassurance, safety.autonomy].filter(nonEmpty).join(' ')
      if (/(演练|对质)/.test(safetyCopy)) add('content.npc.moments.safety.reassurance', '安全时刻不能引导继续演练或对质')
    }
  }

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
  const requireRecommendedText = (owner: Record<string, unknown>, key: string, path: string) => {
    requireText(owner, key, path)
    if (nonEmpty(owner[key]) && selfCondemningCopy.test(owner[key])) add(`${path}.${key}`, '包含可能加重自责的定性表达')
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
    if (!objectAt(item.replay)) add(`${path}.replay`, '五层复盘内容必须是对象')
    else {
      const replay = item.replay
      if (!arrayAt(replay.factOptions) || replay.factOptions.length === 0) add(`${path}.replay.factOptions`, '至少需要一个可观察事实')
      else replay.factOptions.forEach((option, optionIndex) => {
        const optionPath = `${path}.replay.factOptions[${optionIndex}]`
        if (!objectAt(option)) add(optionPath, '事实选项必须是对象')
        else {
          registerId(option.id, `${optionPath}.id`)
          requireText(option, 'label', optionPath)
          requireText(option, 'explanation', optionPath)
        }
      })
      if (!arrayAt(replay.inferenceExpressionIds) || replay.inferenceExpressionIds.length === 0) add(`${path}.replay.inferenceExpressionIds`, '至少需要一个推测对照')
      else replay.inferenceExpressionIds.forEach((id, refIndex) => {
        if (!nonEmpty(id) || !originalIds.has(id)) add(`${path}.replay.inferenceExpressionIds[${refIndex}]`, '悬空原表达引用')
      })
      if (!arrayAt(replay.requestOptions) || replay.requestOptions.length === 0) add(`${path}.replay.requestOptions`, '至少需要一个具体请求')
      else replay.requestOptions.forEach((option, optionIndex) => {
        const optionPath = `${path}.replay.requestOptions[${optionIndex}]`
        if (!objectAt(option)) add(optionPath, '请求选项必须是对象')
        else {
          registerId(option.id, `${optionPath}.id`)
          requireText(option, 'label', optionPath)
          if (!objectAt(option.structure)) add(`${optionPath}.structure`, '请求必须包含时间、行为和边界')
          else for (const key of ['when', 'behavior', 'boundary']) requireText(option.structure, key, `${optionPath}.structure`)
        }
      })
      if (!arrayAt(replay.practiceOptions) || replay.practiceOptions.length === 0) add(`${path}.replay.practiceOptions`, '至少需要一个可观察回应')
      else replay.practiceOptions.forEach((option, optionIndex) => {
        const optionPath = `${path}.replay.practiceOptions[${optionIndex}]`
        if (!objectAt(option)) add(optionPath, '演练选项必须是对象')
        else {
          registerId(option.id, `${optionPath}.id`)
          requireText(option, 'label', optionPath)
          if (!nonEmpty(option.responseId) || !responseIds.has(option.responseId)) add(`${optionPath}.responseId`, '悬空回应引用')
          if (!arrayAt(option.replyOptions) || option.replyOptions.length < 2) add(`${optionPath}.replyOptions`, '每个演练至少需要两个下一句')
          else option.replyOptions.forEach((reply, replyIndex) => {
            const replyPath = `${optionPath}.replyOptions[${replyIndex}]`
            if (!objectAt(reply)) add(replyPath, '演练下一句必须是对象')
            else {
              registerId(reply.id, `${replyPath}.id`)
              requireRecommendedText(reply, 'label', replyPath)
              const validActions = ['clarify', 'repair', 'coordinate', 'pause', 'document', 'seek-support']
              if (!validActions.includes(String(reply.action))) add(`${replyPath}.action`, '演练动作不合法')
              if (item.safetyLevel === 'safety' && !['pause', 'document', 'seek-support'].includes(String(reply.action))) add(`${replyPath}.action`, '安全情境不能建议普通对质')
            }
          })
        }
      })
    }
    const alignedRewrite = rewrites.find(({ id }) => id === item.rewriteId)
    const direct = objectAt(alignedRewrite?.tones) && nonEmpty(alignedRewrite.tones.direct) ? alignedRewrite.tones.direct : undefined
    if (item.safetyLevel !== 'safety' && direct && objectAt(item.replay)) {
      const requestOptions = arrayAt(item.replay.requestOptions) ? item.replay.requestOptions : []
      if (!requestOptions.some((option) => objectAt(option) && option.label === direct)) add(`${path}.replay.requestOptions`, '请求答案必须包含可直接说出的直接版表达')
      const practiceOptions = arrayAt(item.replay.practiceOptions) ? item.replay.practiceOptions : []
      practiceOptions.forEach((practice, practiceIndex) => {
        const replies = objectAt(practice) && arrayAt(practice.replyOptions) ? practice.replyOptions : []
        if (!replies.some((reply) => objectAt(reply) && reply.label === direct)) add(`${path}.replay.practiceOptions[${practiceIndex}].replyOptions`, '演练必须包含与直接版表达一致的下一句')
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
    else for (const tone of ['gentle', 'direct', 'firm']) requireRecommendedText(item.tones, tone, `${path}.tones`)
    requireText(item, 'misunderstanding', path)
    for (const key of ['repairLine', 'nextTimeLine', 'summary', 'shareSummary']) requireRecommendedText(item, key, path)
    if (owner?.safetyLevel !== 'safety' && objectAt(item.tones) && nonEmpty(item.tones.direct) && item.nextTimeLine !== item.tones.direct) add(`${path}.nextTimeLine`, '下次表达必须与直接版表达保持一致')
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
