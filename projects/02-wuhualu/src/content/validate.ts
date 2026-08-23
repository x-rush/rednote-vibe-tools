import type { WuhualuContentPackage } from './types.ts'

export type ContentIssue = { path: string; message: string }
export type ContentValidationResult = { issues: ContentIssue[] }

const ID_PATTERN = /^[a-z][a-z0-9-]*$/
const ASSET_PATTERN = /^asset-[a-z0-9-]+$/
const PERIOD_GROUPS = new Set(['prehistoric', 'shang-zhou', 'spring-autumn-warring', 'han', 'tang'])
const DIFFICULTIES = new Set(['easy', 'normal', 'hard'])
const TAGS = new Set(['shape', 'use', 'period', 'material', 'pattern', 'category'])
const FACT_STATUSES = new Set(['verified-from-provided-source', 'pending-review'])

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const nonEmpty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0

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
  const contentKeys = new Set(['artifacts', 'categories', 'distractorCandidates', 'rounds', 'collectionRules', 'assetManifest', 'copy'])
  Object.keys(input.content).forEach(key => {
    if (!contentKeys.has(key)) issue(`$.content.${key}`, '未知业务根字段')
  })

  const sources = Array.isArray(input.sources) ? input.sources : []
  const sourceIds = new Set<string>()
  sources.forEach((source, index) => {
    const path = `$.sources[${index}]`
    if (!isRecord(source)) return issue(path, '来源必须是对象')
    if (!nonEmpty(source.id) || !ID_PATTERN.test(source.id)) issue(`${path}.id`, '来源 ID 非法')
    else if (sourceIds.has(source.id)) issue(`${path}.id`, '来源 ID 重复')
    else sourceIds.add(source.id)
    if (!nonEmpty(source.title)) issue(`${path}.title`, '来源标题不能为空')
    if (!nonEmpty(source.url) || !/^https:\/\//.test(source.url)) issue(`${path}.url`, '来源 URL 必须使用 HTTPS')
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

  const artifacts = Array.isArray(input.content.artifacts) ? input.content.artifacts : []
  if (artifacts.length !== 20) issue('$.content.artifacts', '首发内容必须恰好包含 20 件文物')
  const artifactIds = new Set<string>()
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
  })

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
    'introBody', 'introAction', 'modeTitle', 'dailyMode', 'practiceMode', 'clueAction', 'submitAction',
    'nextAction', 'collectionTitle', 'emptyCollection', 'summaryTitle', 'errorTitle', 'resetAction',
    'backAction', 'exitAction', 'collectionAction', 'retryAction', 'replayAction', 'closeAction',
    'factsTitle', 'cluesTitle', 'optionsTitle', 'placeholderText', 'lockedText', 'scoreLabel',
    'bestScoreLabel', 'progressLabel', 'sourceStatusTitle',
    'storageCorruptMessage', 'storageVersionMessage', 'storageInvalidMessage', 'contentMissingMessage',
    'verifiedLabel', 'pendingLabel', 'collectorPerfect', 'collectorHigh', 'collectorMid', 'collectorLow',
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
