import type { WuhualuContentPackage } from './types.ts'

export type ContentIssue = { path: string; message: string }
export type ContentValidationResult = { issues: ContentIssue[] }

const ID_PATTERN = /^[a-z][a-z0-9-]*$/
const ASSET_PATTERN = /^asset-[a-z0-9-]+$/
const PERIOD_GROUPS = new Set(['prehistoric', 'shang-zhou', 'spring-autumn-warring', 'han', 'tang'])
const DIFFICULTIES = new Set(['easy', 'normal', 'hard'])
const TAGS = new Set(['shape', 'use', 'period', 'material', 'pattern', 'category'])
const FACT_STATUSES = new Set(['verified-from-provided-source', 'pending-review'])
const SOURCE_LEVELS = new Set(['A', 'B'])
const SET_IDS = new Set(['first-fire', 'ritual-bronze', 'chu-sound', 'han-light', 'tang-world'])
const STORY_IDS = ['first-look', 'making', 'lived-world', 'journey', 'why-now'] as const
const NARRATIVE_MODES = new Set(['verified-fact', 'bounded-context', 'open-question'])
const OBSERVATION_CATEGORIES = new Set(['shape', 'material', 'craft', 'trace'])
const OBSERVATION_ROLES = new Set(['observation'])
const CLUE_CATEGORIES = ['shape', 'material', 'provenance'] as const
const CLUE_LABELS = ['看形', '辨材', '问来历'] as const
const STORY_STATUSES = new Set(['verified', 'mixed-with-bounded-context', 'pending'])
const GUIDE_LINE_KEYS = ['beforeObservation', 'clueOpened', 'correct', 'incorrect', 'archived'] as const

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const nonEmpty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0
const textLength = (value: string): number => Array.from(value.trim()).length
const finiteBetween = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max

export function validateContent(input: unknown): ContentValidationResult {
  const issues: ContentIssue[] = []
  const issue = (path: string, message: string) => issues.push({ path, message })

  if (!isRecord(input)) return { issues: [{ path: '$', message: '内容包必须是对象' }] }
  const rootKeys = new Set(['schemaVersion', 'contentVersion', 'projectId', 'meta', 'sources', 'content'])
  Object.keys(input).forEach(key => {
    if (!rootKeys.has(key)) issue(`$.${key}`, '未知顶层字段')
  })
  if (input.schemaVersion !== 1) issue('$.schemaVersion', '必须为 1')
  if (input.projectId !== 'wuhualu') issue('$.projectId', '必须为 wuhualu')
  if (!nonEmpty(input.contentVersion)) issue('$.contentVersion', '内容版本不能为空')
  if (!isRecord(input.meta) || !nonEmpty(input.meta.title) || input.meta.locale !== 'zh-CN' || !nonEmpty(input.meta.updatedAt)) {
    issue('$.meta', 'meta 必须包含 title、zh-CN locale 与 updatedAt')
  }
  if (!Array.isArray(input.sources)) issue('$.sources', 'sources 必须是数组')
  if (!isRecord(input.content)) return { issues: [...issues, { path: '$.content', message: 'content 必须是对象' }] }
  const contentKeys = new Set(['artifacts', 'sets', 'categories', 'distractorCandidates', 'rounds', 'collectionRules', 'assetManifest', 'copy'])
  Object.keys(input.content).forEach(key => {
    if (!contentKeys.has(key)) issue(`$.content.${key}`, '未知业务根字段')
  })

  const sources = Array.isArray(input.sources) ? input.sources : []
  const sourceIds = new Set<string>()
  const sourceLevels = new Map<string, string>()
  sources.forEach((source, index) => {
    const path = `$.sources[${index}]`
    if (!isRecord(source)) return issue(path, '来源必须是对象')
    if (!nonEmpty(source.id) || !ID_PATTERN.test(source.id)) issue(`${path}.id`, '来源 ID 非法')
    else if (sourceIds.has(source.id)) issue(`${path}.id`, '来源 ID 重复')
    else {
      sourceIds.add(source.id)
      if (SOURCE_LEVELS.has(String(source.level))) sourceLevels.set(source.id, String(source.level))
    }
    if (!nonEmpty(source.title)) issue(`${path}.title`, '来源标题不能为空')
    if (!nonEmpty(source.url) || !/^https:\/\//.test(source.url)) issue(`${path}.url`, '来源 URL 必须使用 HTTPS')
    if (!SOURCE_LEVELS.has(String(source.level))) issue(`${path}.level`, '来源等级必须为 A 或 B')
  })

  const categories = Array.isArray(input.content.categories) ? input.content.categories : []
  const categoryIds = new Set<string>()
  categories.forEach((category, index) => {
    const path = `$.content.categories[${index}]`
    if (!isRecord(category)) return issue(path, '分类必须是对象')
    if (!nonEmpty(category.id) || !ID_PATTERN.test(category.id)) issue(`${path}.id`, '分类 ID 非法')
    else if (categoryIds.has(category.id)) issue(`${path}.id`, '分类 ID 重复')
    else categoryIds.add(category.id)
    if (!nonEmpty(category.name)) issue(`${path}.name`, '分类名称不能为空')
  })

  const sets = Array.isArray(input.content.sets) ? input.content.sets : []
  if (sets.length !== 5) issue('$.content.sets', '必须恰好包含五个专题套组')
  const setIds = new Set<string>()
  sets.forEach((set, index) => {
    const path = `$.content.sets[${index}]`
    if (!isRecord(set)) return issue(path, '套组必须是对象')
    if (!nonEmpty(set.id) || !SET_IDS.has(set.id)) issue(`${path}.id`, '套组 ID 非法')
    else if (setIds.has(set.id)) issue(`${path}.id`, '套组 ID 重复')
    else setIds.add(set.id)
    for (const key of ['name', 'description', 'sealLabel']) {
      if (!nonEmpty(set[key])) issue(`${path}.${key}`, `${key} 不能为空`)
    }
    if (!Array.isArray(set.guideCompleteLines) || set.guideCompleteLines.length < 3) issue(`${path}.guideCompleteLines`, '套组完成台词至少需要三条')
    else set.guideCompleteLines.forEach((line, child) => {
      if (!nonEmpty(line) || textLength(line) < 12 || textLength(line) > 52) issue(`${path}.guideCompleteLines[${child}]`, '套组完成台词必须为 12–52 字')
    })
  })

  const artifacts = Array.isArray(input.content.artifacts) ? input.content.artifacts : []
  if (artifacts.length !== 20) issue('$.content.artifacts', '首发内容必须恰好包含 20 件文物')
  const declaredArtifactIds = new Set(artifacts.flatMap(artifact => isRecord(artifact) && nonEmpty(artifact.id) ? [artifact.id] : []))
  const artifactIds = new Set<string>()
  const timelineOrders = new Set<number>()
  const artifactSetCounts = new Map<string, number>()
  artifacts.forEach((artifact, index) => {
    const path = `$.content.artifacts[${index}]`
    if (!isRecord(artifact)) return issue(path, '文物必须是对象')
    if (!nonEmpty(artifact.id) || !ID_PATTERN.test(artifact.id)) issue(`${path}.id`, '文物 ID 非法')
    else if (artifactIds.has(artifact.id)) issue(`${path}.id`, '文物 ID 重复')
    else artifactIds.add(artifact.id)
    for (const key of ['name', 'period', 'material', 'use', 'summary', 'highlight', 'culturalNote', 'unlockCopy', 'wrongAnswerExplanation', 'sourceNote', 'contentVersion']) {
      if (!nonEmpty(artifact[key])) issue(`${path}.${key}`, `${key} 不能为空`)
    }
    if (!PERIOD_GROUPS.has(String(artifact.periodGroup))) issue(`${path}.periodGroup`, '历史阶段非法')
    if (!DIFFICULTIES.has(String(artifact.difficulty))) issue(`${path}.difficulty`, '难度非法')
    if (!FACT_STATUSES.has(String(artifact.factCheckStatus))) issue(`${path}.factCheckStatus`, '核验状态非法')
    if (!nonEmpty(artifact.setId) || !setIds.has(artifact.setId)) issue(`${path}.setId`, '引用了不存在的专题套组')
    else artifactSetCounts.set(artifact.setId, (artifactSetCounts.get(artifact.setId) ?? 0) + 1)
    if (!Number.isInteger(artifact.timelineOrder) || !finiteBetween(artifact.timelineOrder, 1, 20)) issue(`${path}.timelineOrder`, '时间轴序号必须是 1–20 的整数')
    else if (timelineOrders.has(artifact.timelineOrder)) issue(`${path}.timelineOrder`, '时间轴序号重复')
    else timelineOrders.add(artifact.timelineOrder)
    if (!Array.isArray(artifact.categoryIds) || artifact.categoryIds.length === 0) issue(`${path}.categoryIds`, '至少需要一个分类')
    else artifact.categoryIds.forEach((id, child) => {
      if (!categoryIds.has(String(id))) issue(`${path}.categoryIds[${child}]`, '引用了不存在的分类')
    })
    if (!Array.isArray(artifact.distractorTags) || artifact.distractorTags.length === 0) issue(`${path}.distractorTags`, '至少需要一个干扰标签')
    else artifact.distractorTags.forEach((tag, child) => {
      if (!TAGS.has(String(tag))) issue(`${path}.distractorTags[${child}]`, '干扰标签非法')
    })
    if (!Array.isArray(artifact.sourceIds) || artifact.sourceIds.length === 0) issue(`${path}.sourceIds`, '至少需要一个来源')
    else artifact.sourceIds.forEach((id, child) => {
      if (!sourceIds.has(String(id))) issue(`${path}.sourceIds[${child}]`, '引用了不存在的来源')
    })
    if (!Array.isArray(artifact.clues) || artifact.clues.length !== 3) issue(`${path}.clues`, '每件文物必须有三条线索')
    else artifact.clues.forEach((clue, child) => {
      const cluePath = `${path}.clues[${child}]`
      if (!isRecord(clue) || clue.level !== child + 1 || !nonEmpty(clue.id) || !nonEmpty(clue.text)) issue(cluePath, '线索必须有稳定 ID、递增级别和文字')
      if (isRecord(clue) && nonEmpty(artifact.name) && nonEmpty(clue.text) && clue.text.includes(artifact.name)) issue(`${cluePath}.text`, '线索不得直接泄露完整名称')
    })
    if (!isRecord(artifact.assetRefs)) issue(`${path}.assetRefs`, '资源引用必须是对象')
    else {
      for (const key of ['fullAssetId', 'fallbackAssetId', 'thumbnailAssetId']) {
        if (!nonEmpty(artifact.assetRefs[key]) || !ASSET_PATTERN.test(String(artifact.assetRefs[key]))) issue(`${path}.assetRefs.${key}`, 'asset ID 非法')
      }
      if (!Array.isArray(artifact.assetRefs.detailAssetIds) || artifact.assetRefs.detailAssetIds.length === 0) issue(`${path}.assetRefs.detailAssetIds`, '至少需要一个局部图 asset ID')
      else artifact.assetRefs.detailAssetIds.forEach((id, child) => {
        if (!nonEmpty(id) || !ASSET_PATTERN.test(id)) issue(`${path}.assetRefs.detailAssetIds[${child}]`, 'asset ID 非法')
      })
    }

    if (artifact.experienceV2 !== undefined) {
      const experiencePath = `${path}.experienceV2`
      if (!isRecord(artifact.experienceV2)) return issue(experiencePath, 'V2 体验必须是完整对象')
      const experience = artifact.experienceV2
      if (!nonEmpty(experience.storyHook) || textLength(experience.storyHook) < 18 || textLength(experience.storyHook) > 48) issue(`${experiencePath}.storyHook`, '故事钩子必须为 18–48 字')

      let storyTotal = 0
      let hasOpenQuestion = false
      if (!Array.isArray(experience.story) || experience.story.length !== STORY_IDS.length) issue(`${experiencePath}.story`, '故事必须包含固定顺序的五段')
      else experience.story.forEach((section, child) => {
        const sectionPath = `${experiencePath}.story[${child}]`
        if (!isRecord(section)) return issue(sectionPath, '故事段必须是对象')
        if (section.id !== STORY_IDS[child]) issue(`${sectionPath}.id`, `故事段必须为 ${STORY_IDS[child]}`)
        if (!nonEmpty(section.title)) issue(`${sectionPath}.title`, '故事段标题不能为空')
        if (!nonEmpty(section.body) || textLength(section.body) < 80 || textLength(section.body) > 180) issue(`${sectionPath}.body`, '故事正文必须为 80–180 字')
        else storyTotal += textLength(section.body)
        if (!NARRATIVE_MODES.has(String(section.narrativeMode))) issue(`${sectionPath}.narrativeMode`, '叙事模式非法')
        if (section.narrativeMode === 'open-question') hasOpenQuestion = true
        if (!Array.isArray(section.sourceIds) || section.sourceIds.length === 0) issue(`${sectionPath}.sourceIds`, '故事段至少需要一个来源')
        else section.sourceIds.forEach((id, sourceIndex) => {
          if (!sourceIds.has(String(id))) issue(`${sectionPath}.sourceIds[${sourceIndex}]`, '引用了不存在的来源')
        })
        if (section.narrativeMode === 'verified-fact' &&
            (!Array.isArray(section.sourceIds) || !section.sourceIds.some(id => sourceLevels.get(String(id)) === 'A'))) {
          issue(`${sectionPath}.sourceIds`, 'verified-fact 必须引用至少一个 A 级来源')
        }
      })
      if (storyTotal > 800 || storyTotal < (hasOpenQuestion ? 360 : 480)) issue(`${experiencePath}.story`, '五段故事总长不符合 480–800 字门禁；含开放问题时最低 360 字')

      if (!Array.isArray(experience.observationSpots) || experience.observationSpots.length !== 3) issue(`${experiencePath}.observationSpots`, '黄金体验必须包含三个观察点')
      else {
        const spotIds = new Set<string>()
        experience.observationSpots.forEach((spot, child) => {
          const spotPath = `${experiencePath}.observationSpots[${child}]`
          if (!isRecord(spot)) return issue(spotPath, '观察点必须是对象')
          if (!nonEmpty(spot.id) || !ID_PATTERN.test(spot.id)) issue(`${spotPath}.id`, '观察点 ID 非法')
          else if (spotIds.has(spot.id)) issue(`${spotPath}.id`, '观察点 ID 重复')
          else spotIds.add(spot.id)
          if (!finiteBetween(spot.x, 0, 1) || !finiteBetween(spot.y, 0, 1)) issue(spotPath, '观察点坐标必须在 0–1 之间')
          if (!finiteBetween(spot.radius, 0.04, 0.25)) issue(`${spotPath}.radius`, '观察点半径必须在 0.04–0.25 之间')
          if (!nonEmpty(spot.label)) issue(`${spotPath}.label`, '观察点标签不能为空')
          if (!nonEmpty(spot.note) || textLength(spot.note) < 18 || textLength(spot.note) > 60) issue(`${spotPath}.note`, '观察札记必须为 18–60 字')
          if (!OBSERVATION_CATEGORIES.has(String(spot.clueCategory))) issue(`${spotPath}.clueCategory`, '观察点类别非法')
          if (!OBSERVATION_ROLES.has(String(spot.assetRole))) issue(`${spotPath}.assetRole`, '观察点资源角色非法')
        })
      }

      if (!Array.isArray(experience.clueCards) || experience.clueCards.length !== 3) issue(`${experiencePath}.clueCards`, '必须包含三枚线索印')
      else {
        const clueCardIds = new Set<string>()
        experience.clueCards.forEach((card, child) => {
          const cardPath = `${experiencePath}.clueCards[${child}]`
          if (!isRecord(card)) return issue(cardPath, '线索印必须是对象')
          if (!nonEmpty(card.id) || !ID_PATTERN.test(card.id)) issue(`${cardPath}.id`, '线索印 ID 非法')
          else if (clueCardIds.has(card.id)) issue(`${cardPath}.id`, '线索印 ID 重复')
          else clueCardIds.add(card.id)
          if (card.category !== CLUE_CATEGORIES[child]) issue(`${cardPath}.category`, `线索类别必须为 ${CLUE_CATEGORIES[child]}`)
          if (card.label !== CLUE_LABELS[child]) issue(`${cardPath}.label`, `线索标签必须为 ${CLUE_LABELS[child]}`)
          if (!nonEmpty(card.text) || textLength(card.text) < 18 || textLength(card.text) > 52) issue(`${cardPath}.text`, '线索文字必须为 18–52 字')
          if (!nonEmpty(card.npcHint) || textLength(card.npcHint) < 12 || textLength(card.npcHint) > 52) issue(`${cardPath}.npcHint`, '许照提示必须为 12–52 字')
          if (card.starCost !== 0 && card.starCost !== 1) issue(`${cardPath}.starCost`, '线索代价必须为 0 或 1')
          if (nonEmpty(card.text) && nonEmpty(artifact.name) && card.text.includes(artifact.name)) issue(`${cardPath}.text`, '线索不得直接泄露完整名称')
        })
      }

      const memory = experience.memoryChallenge
      if (!isRecord(memory)) issue(`${experiencePath}.memoryChallenge`, '离柜一问必须是完整对象')
      else {
        if (!nonEmpty(memory.prompt)) issue(`${experiencePath}.memoryChallenge.prompt`, '记忆题不能为空')
        const options = Array.isArray(memory.options) ? memory.options : []
        if (options.length < 2 || options.length > 4) issue(`${experiencePath}.memoryChallenge.options`, '记忆题必须有 2–4 个选项')
        const optionIds = new Set<string>()
        options.forEach((option, child) => {
          const optionPath = `${experiencePath}.memoryChallenge.options[${child}]`
          if (!isRecord(option) || !nonEmpty(option.id) || !nonEmpty(option.label)) issue(optionPath, '记忆题选项必须有稳定 ID 和文字')
          else if (optionIds.has(option.id)) issue(`${optionPath}.id`, '记忆题选项 ID 重复')
          else optionIds.add(option.id)
        })
        if (!nonEmpty(memory.answerId) || !optionIds.has(memory.answerId)) issue(`${experiencePath}.memoryChallenge.answerId`, '记忆题答案必须引用现有选项')
        if (!nonEmpty(memory.explanation) || textLength(memory.explanation) < 30 || textLength(memory.explanation) > 100) issue(`${experiencePath}.memoryChallenge.explanation`, '记忆题解释必须为 30–100 字')
        if (!Array.isArray(memory.sourceIds) || memory.sourceIds.length === 0) issue(`${experiencePath}.memoryChallenge.sourceIds`, '记忆题至少需要一个来源')
        else memory.sourceIds.forEach((id, child) => {
          if (!sourceIds.has(String(id))) issue(`${experiencePath}.memoryChallenge.sourceIds[${child}]`, '引用了不存在的来源')
        })
      }

      if (!Array.isArray(experience.relatedArtifacts) || experience.relatedArtifacts.length === 0) issue(`${experiencePath}.relatedArtifacts`, '至少需要一件关联文物')
      else experience.relatedArtifacts.forEach((related, child) => {
        const relatedPath = `${experiencePath}.relatedArtifacts[${child}]`
        if (!isRecord(related) || !nonEmpty(related.artifactId) || !declaredArtifactIds.has(related.artifactId) || related.artifactId === artifact.id) issue(`${relatedPath}.artifactId`, '关联文物 ID 非法')
        if (!isRecord(related) || !nonEmpty(related.reason)) issue(`${relatedPath}.reason`, '关联理由不能为空')
      })

      const guideLines = experience.guideLines
      if (!isRecord(guideLines)) issue(`${experiencePath}.guideLines`, '许照台词必须是完整对象')
      else GUIDE_LINE_KEYS.forEach(key => {
        const lines = guideLines[key]
        if (!Array.isArray(lines) || lines.length < 3) issue(`${experiencePath}.guideLines.${key}`, '每类许照台词至少需要三条')
        else lines.forEach((line, child) => {
          if (!nonEmpty(line) || textLength(line) < 12 || textLength(line) > 70) issue(`${experiencePath}.guideLines.${key}[${child}]`, '许照台词必须为 12–70 字')
        })
      })
      if (!STORY_STATUSES.has(String(experience.storyFactCheckStatus))) issue(`${experiencePath}.storyFactCheckStatus`, '故事核验状态非法')
      if (!nonEmpty(experience.storyContentVersion)) issue(`${experiencePath}.storyContentVersion`, '故事内容版本不能为空')
    }
  })
  for (const setId of setIds) {
    if ((artifactSetCounts.get(setId) ?? 0) !== 4) issue('$.content.artifacts', `${setId} 必须恰好包含四件文物`)
  }

  const candidates = Array.isArray(input.content.distractorCandidates) ? input.content.distractorCandidates : []
  const candidateIds = new Set<string>()
  const candidateCount = new Map<string, number>()
  candidates.forEach((candidate, index) => {
    const path = `$.content.distractorCandidates[${index}]`
    if (!isRecord(candidate)) return issue(path, '干扰候选必须是对象')
    if (!nonEmpty(candidate.id) || !ID_PATTERN.test(candidate.id)) issue(`${path}.id`, '候选 ID 非法')
    else if (candidateIds.has(candidate.id)) issue(`${path}.id`, '候选 ID 重复')
    else candidateIds.add(candidate.id)
    if (!nonEmpty(candidate.label)) issue(`${path}.label`, '候选名称不能为空')
    if (!Array.isArray(candidate.tags) || !candidate.tags.every(tag => TAGS.has(String(tag)))) issue(`${path}.tags`, '候选标签非法')
    if (candidate.eligible !== undefined && typeof candidate.eligible !== 'boolean') issue(`${path}.eligible`, 'eligible 必须是布尔值')
    if (candidate.eligible === false && !nonEmpty(candidate.note)) issue(`${path}.note`, '不可用候选必须说明原因')
    if (!Array.isArray(candidate.forArtifactIds) || candidate.forArtifactIds.length === 0) issue(`${path}.forArtifactIds`, '候选必须关联至少一件首发文物')
    else candidate.forArtifactIds.forEach((id, child) => {
      if (!artifactIds.has(String(id))) issue(`${path}.forArtifactIds[${child}]`, '引用了不存在的文物')
      else candidateCount.set(String(id), (candidateCount.get(String(id)) ?? 0) + 1)
    })
  })
  for (const artifactId of artifactIds) {
    if ((candidateCount.get(artifactId) ?? 0) < 3) issue('$.content.distractorCandidates', `${artifactId} 的已审校干扰项不足三个`)
  }

  const copy = input.content.copy
  const requiredCopy = [
    'brand', 'subtitle', 'landingTitle', 'landingBody', 'startAction', 'continueAction', 'introTitle',
    'introBody', 'introAction', 'introObserveTitle', 'introObserveBody', 'introClueTitle', 'introClueBody',
    'introArchiveTitle', 'introArchiveBody', 'modeTitle', 'dailyMode', 'practiceMode', 'clueAction', 'submitAction',
    'nextAction', 'collectionTitle', 'emptyCollection', 'summaryTitle', 'errorTitle', 'resetAction',
    'backAction', 'exitAction', 'collectionAction', 'retryAction', 'replayAction', 'closeAction',
    'factsTitle', 'cluesTitle', 'optionsTitle', 'placeholderText', 'lockedText', 'scoreLabel',
    'bestScoreLabel', 'progressLabel', 'sourceStatusTitle',
    'storageCorruptMessage', 'storageVersionMessage', 'storageInvalidMessage', 'contentMissingMessage',
    'verifiedLabel', 'pendingLabel', 'collectorPerfect', 'collectorHigh', 'collectorMid', 'collectorLow',
    'guideHomeLine', 'guideLandingImageAlt', 'guideIntroImageAlt', 'guideTaskLine', 'guideIntroLine', 'guideHelpBody',
    'guideName', 'guideRole', 'guideAskAction', 'guideReturnAction', 'taskBoardLabel',
    'observationEyebrow', 'observationTitle', 'wrongReviewEyebrow', 'wrongReviewTitle',
    'wrongReviewAction', 'revealStoryAction', 'readingGate',
    'setCompleteEyebrow', 'setCompleteAction', 'lockedDetailEyebrow',
    'lockedDetailBody', 'memoryEyebrow', 'memoryTitle', 'memorySubmitAction', 'memoryCorrect',
    'memoryIncorrect', 'memoryArchiveAction', 'archiveNextAction', 'archiveRelatedTitle',
    'observationInstruction', 'observationGuideLabel',
    'observationGuideFirst', 'observationGuideContinue', 'observationGuideComplete',
    'observationMarkerLabel', 'observationProgressLabel', 'clueBoxLabel', 'clueBoxTitle',
    'clueFirstFree', 'clueOpenPrefix', 'clueStarBand', 'archivePrompt', 'guideEliminated',
    'archiveStampAction', 'archiveSealCharacter', 'storyEyebrow', 'storyNavLabel',
    'storySectionPrefix', 'storySourcesLabel', 'storySourceLevelSuffix', 'storyReadAction', 'storyReadDone',
  ]
  if (!isRecord(copy)) issue('$.content.copy', '界面文案必须是对象')
  else requiredCopy.forEach(key => {
    if (!nonEmpty(copy[key])) issue(`$.content.copy.${key}`, '界面文案不能为空')
  })

  const assetManifest = input.content.assetManifest
  if (!isRecord(assetManifest) || assetManifest.status !== 'planned' || !isRecord(assetManifest.global)) {
    issue('$.content.assetManifest', '资源 manifest 必须处于 planned 状态并包含全局资源')
  } else {
    for (const key of ['placeholderAssetId', 'shareCoverAssetId']) {
      if (!nonEmpty(assetManifest.global[key]) || !ASSET_PATTERN.test(String(assetManifest.global[key]))) issue(`$.content.assetManifest.global.${key}`, 'asset ID 非法')
    }
    if (!nonEmpty(assetManifest.pathPattern) || !assetManifest.pathPattern.startsWith('./assets/') || /^(?:https?:|data:|blob:|\/)/i.test(assetManifest.pathPattern)) issue('$.content.assetManifest.pathPattern', '资源路径规则必须是 ./assets/ 下的相对路径')
  }

  const serialized = JSON.stringify(input)
  if (/data:[^,]+;base64,/i.test(serialized)) issue('$', '禁止 Base64 数据')
  if (/"(?:full|detail|fallback|thumbnail)AssetId"\s*:\s*"https?:\/\//i.test(serialized)) issue('$', '资源不得使用远程 URL')
  return { issues }
}

export class ContentValidationError extends Error {
  readonly issues: ContentIssue[]

  constructor(issues: ContentIssue[]) {
    super(issues.map(({ path, message }) => `${path}: ${message}`).join('\n'))
    this.name = 'ContentValidationError'
    this.issues = issues
  }
}

export function parseContent(input: unknown): WuhualuContentPackage {
  const result = validateContent(input)
  if (result.issues.length > 0) throw new ContentValidationError(result.issues)
  return input as WuhualuContentPackage
}
