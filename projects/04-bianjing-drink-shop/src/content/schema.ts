import type { BusinessEvent, ContractSceneTrigger, Ending, EventActorRole, EventChain, EventCondition, Ingredient, OperatingMode, Product, Recipe, ShelfClass } from '../domain/types'
import { validateEventQuality } from './event-quality'

export interface CustomerDefinition {
  customerId: string
  name: string
  spendingPower: 1 | 2 | 3
  likes: string[]
  dislikes: string[]
}

export interface WeatherDefinition {
  weatherId: string
  name: string
  visitorMultiplier: number
  preferenceTags: string[]
  operatingEffect: string
  weight: number
}

export interface SeasonDefinition {
  seasonId: string
  name: string
  dayRange: [number, number]
  tags: string[]
}

export interface OperatingModeDefinition {
  visitorMultiplier: number
  rentCost: number
  operatingCost: number
  baseEnergyCost: number
  energyRecovery: number
  ordinaryEventChance: number
}

export interface ConversionDefinition {
  baseRate: number
  minimumRate: number
  maximumRate: number
  highPricePenalty: number
  lowPriceBonus: number
  preferenceBonus: number
  reputationBonus: number
  lowEnergyPenalty: number
  varietyBonus: number
}

export interface ServiceDefinition {
  baseCapacity: number
  energyCapacityFactor: number
}

export interface DemandSegmentDefinition {
  segmentId: string
  label: string
  primaryTags: string[]
  acceptableTags: string[]
  maximumPriceRatio: number
  baseWeight: number
  tagWeights: { tag: string; multiplier: number }[]
}

export interface MarketSignalDefinition {
  signalId: string
  text: string
  dayRange: [number, number]
  seasonIds: string[]
  weatherIds: string[]
  activeTags: string[]
  visitorDelta: number
  segmentWeights: { segmentId: string; multiplier: number }[]
  weight: number
}

export type CrisisObligationDefinition =
  | { type: 'operating-modifier'; target: 'energy-cost'; operation: 'add'; value: number; operatingDays: number; playerLabel: string }
  | { type: 'repayment'; installments: { delayDays: number; amount: number; labelId: string }[] }
  | { type: 'sales-target'; targetCount: number; segmentIds: string[]; successMoney: number; successReputation: number; failureReputation: number }

export interface CrisisContractDefinition {
  contractId: string
  title: string
  content: string
  eligibility: EventCondition[]
  immediateMoney: number
  obligation: CrisisObligationDefinition
  scenes: { trigger: ContractSceneTrigger; title: string; content: string; actorRole: EventActorRole; assetId: string }[]
}

export interface CampaignChapterDefinition {
  chapterId: string
  title: string
  operatingDayRange: [number, number]
}

export interface CampaignDefinition {
  totalCalendarDays: number
  operatingDays: number[]
  milestoneOperatingDays: number[]
  chapters: CampaignChapterDefinition[]
}

export interface BalanceDefinition {
  initial: { money: number; reputation: number; energy: number; relationships: number }
  campaign: CampaignDefinition
  stageBaseVisitors: { dayRange: [number, number]; visitors: number }[]
  reputation: { linearUntil: number; pointsPerVisitor: number; afterThresholdDivisor: number }
  price: { minimumRatio: number; maximumRatio: number; weight: number }
  preferenceWeight: number
  reputationWeight: number
  serviceWeight: number
  operatingModes: Record<'full' | 'half' | 'rest', OperatingModeDefinition>
  conversion: ConversionDefinition
  service: ServiceDefinition
  substitution: { baseRate: number; reputationBonus: number; priceDifferencePenalty: number; minimumRate: number; maximumRate: number }
  forecast: { bandPadding: number; hiddenVariation: [number, number] }
  shelfReturnRates: Record<ShelfClass, number>
  crisis: { warningMoney: number; hardDebtFloor: number; graceDays: number }
  historyLimit: number
  provisional: boolean
  notes: string[]
}

export interface ShopContent {
  drinks: Product[]
  ingredients: Ingredient[]
  recipes: Recipe[]
  customers: CustomerDefinition[]
  weather: WeatherDefinition[]
  seasons: SeasonDefinition[]
  demandSegments: DemandSegmentDefinition[]
  marketSignals: MarketSignalDefinition[]
  crisisContracts: CrisisContractDefinition[]
  events: BusinessEvent[]
  chains: EventChain[]
  endings: Ending[]
  balance: BalanceDefinition
  ui: Record<string, string>
}

export interface ShopContentPackage {
  schemaVersion: number
  contentVersion: string
  projectId: 'bianjing'
  meta: { title: string; locale: 'zh-CN'; updatedAt: string }
  sources: { sourceId: string; title: string; nature: string }[]
  content: ShopContent
}

export type ValidationMode = 'envelope' | 'production'
export interface ValidationResult { ok: boolean; errors: string[] }

const stableId = /^[a-z][a-z0-9-]*$/
const eventTimings = new Set(['opening', 'business', 'closing'])
const eventLocations = new Set(['counter', 'street', 'kitchen', 'market', 'back-room'])
const eventActorRoles = new Set(['none', 'worker', 'merchant', 'scholar', 'youth', 'elder', 'neighbor-woman', 'runner'])
const impactAxes = new Set(['money', 'reputation', 'energy', 'relationships', 'inventory', 'future'])
const impactDirections = new Set(['up', 'down', 'mixed', 'uncertain'])
const modifierTargets = new Set(['visitor-count', 'energy-cost', 'fixed-cost', 'sales-income', 'waste-return', 'product-demand'])
const modifierOperations = new Set(['add', 'multiply'])
const shelfClasses = new Set<ShelfClass>(['fresh', 'brewed', 'dry', 'concentrate'])
const operatingModeIds = new Set<OperatingMode>(['full', 'half', 'rest'])
const contractSceneTriggers = new Set<ContractSceneTrigger>(['accepted', 'first-installment', 'second-installment', 'target-success', 'target-failure', 'grace-success', 'grace-failure'])
const contentKeys = new Set([
  'drinks', 'ingredients', 'recipes', 'customers', 'weather', 'seasons',
  'demandSegments', 'marketSignals', 'crisisContracts',
  'events', 'chains', 'endings', 'balance', 'ui',
])

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

function validateBalance(value: unknown, errors: string[]) {
  const path = '$.content.balance'
  if (!isRecord(value)) {
    errors.push(`${path}: 必须是对象`)
    return
  }
  const campaign = value.campaign
  if (!isRecord(campaign)
    || campaign.totalCalendarDays !== 100
    || !Array.isArray(campaign.operatingDays)
    || campaign.operatingDays.length !== 30
    || !campaign.operatingDays.every((day, index, days) => Number.isInteger(day) && day >= 1 && day <= 100 && (index === 0 || day > days[index - 1]))
    || campaign.operatingDays[0] !== 1
    || campaign.operatingDays[29] !== 100
    || !Array.isArray(campaign.milestoneOperatingDays)
    || campaign.milestoneOperatingDays.join(',') !== '7,15,23'
    || !Array.isArray(campaign.chapters)
    || campaign.chapters.length !== 4
    || campaign.chapters.some((chapter) => !isRecord(chapter) || typeof chapter.chapterId !== 'string'
      || typeof chapter.title !== 'string' || !Array.isArray(chapter.operatingDayRange) || chapter.operatingDayRange.length !== 2)) {
    errors.push(`${path}.campaign: 必须定义从第 1 日到第 100 日的 30 个关键经营回合与 7/15/23 里程碑`)
  }
  const modes = value.operatingModes
  if (!isRecord(modes)) errors.push(`${path}.operatingModes: 必须是对象`)
  else for (const modeId of ['full', 'half', 'rest'] as const) {
    const mode = modes[modeId]
    const modePath = `${path}.operatingModes.${modeId}`
    if (!isRecord(mode)) {
      errors.push(`${modePath}: 必须是对象`)
      continue
    }
    for (const key of ['visitorMultiplier', 'ordinaryEventChance'] as const) {
      if (!isFiniteNumber(mode[key]) || mode[key] < 0 || mode[key] > 1) errors.push(`${modePath}.${key}: 必须在 0–1 之间`)
    }
    for (const key of ['rentCost', 'operatingCost', 'baseEnergyCost', 'energyRecovery'] as const) {
      if (!isFiniteNumber(mode[key]) || mode[key] < 0) errors.push(`${modePath}.${key}: 不得为负数`)
    }
  }
  if (isRecord(modes) && isRecord(modes.rest)) {
    if (modes.rest.visitorMultiplier !== 0) errors.push(`${path}.operatingModes.rest.visitorMultiplier: 休息日必须为 0`)
    if (!isFiniteNumber(modes.rest.energyRecovery) || modes.rest.energyRecovery <= 0) errors.push(`${path}.operatingModes.rest.energyRecovery: 必须大于 0`)
  }
  const conversion = value.conversion
  if (!isRecord(conversion)) errors.push(`${path}.conversion: 必须是对象`)
  else {
    for (const key of ['baseRate', 'minimumRate', 'maximumRate'] as const) {
      if (!isFiniteNumber(conversion[key]) || conversion[key] < 0 || conversion[key] > 1) errors.push(`${path}.conversion.${key}: 必须在 0–1 之间`)
    }
    if (isFiniteNumber(conversion.minimumRate) && isFiniteNumber(conversion.maximumRate)
      && conversion.minimumRate >= conversion.maximumRate) errors.push(`${path}.conversion: 最小成交率必须小于最大成交率`)
    for (const key of ['highPricePenalty', 'lowPriceBonus', 'preferenceBonus', 'reputationBonus', 'lowEnergyPenalty', 'varietyBonus'] as const) {
      if (!isFiniteNumber(conversion[key]) || conversion[key] < 0) errors.push(`${path}.conversion.${key}: 不得为负数`)
    }
  }
  const service = value.service
  if (!isRecord(service)) errors.push(`${path}.service: 必须是对象`)
  else {
    if (!isFiniteNumber(service.baseCapacity) || service.baseCapacity <= 0) errors.push(`${path}.service.baseCapacity: 必须大于 0`)
    if (!isFiniteNumber(service.energyCapacityFactor) || service.energyCapacityFactor < 0) errors.push(`${path}.service.energyCapacityFactor: 不得为负数`)
  }
  const substitution = value.substitution
  if (!isRecord(substitution)) errors.push(`${path}.substitution: 必须是对象`)
  else {
    for (const key of ['baseRate', 'reputationBonus', 'priceDifferencePenalty', 'minimumRate', 'maximumRate'] as const) {
      if (!isFiniteNumber(substitution[key]) || substitution[key] < 0 || substitution[key] > 1) errors.push(`${path}.substitution.${key}: 必须在 0–1 之间`)
    }
    if (isFiniteNumber(substitution.minimumRate) && isFiniteNumber(substitution.maximumRate)
      && substitution.minimumRate >= substitution.maximumRate) errors.push(`${path}.substitution: 最小接受率必须小于最大接受率`)
  }
  const forecast = value.forecast
  if (!isRecord(forecast) || !isFiniteNumber(forecast.bandPadding) || forecast.bandPadding < 0
    || !Array.isArray(forecast.hiddenVariation) || forecast.hiddenVariation.length !== 2
    || !forecast.hiddenVariation.every(isFiniteNumber)) errors.push(`${path}.forecast: 预测配置无效`)
  const returns = value.shelfReturnRates
  if (!isRecord(returns)) errors.push(`${path}.shelfReturnRates: 必须是对象`)
  else for (const shelfClass of shelfClasses) {
    if (!isFiniteNumber(returns[shelfClass]) || returns[shelfClass] < 0 || returns[shelfClass] > 1) errors.push(`${path}.shelfReturnRates.${shelfClass}: 必须在 0–1 之间`)
  }
  const crisis = value.crisis
  if (!isRecord(crisis) || crisis.warningMoney !== 16 || crisis.hardDebtFloor !== -20 || crisis.graceDays !== 3) {
    errors.push(`${path}.crisis: 必须使用已确认的 16/-20/3 周转规则`)
  }
}

function scanUnsafe(value: unknown, path: string, errors: string[]) {
  if (typeof value === 'string' && (/data:[^;]+;base64,/i.test(value) || /^https?:\/\//i.test(value))) {
    errors.push(`${path}: 禁止 Base64 或远程运行时资源`)
  } else if (Array.isArray(value)) {
    value.forEach((item, index) => scanUnsafe(item, `${path}[${index}]`, errors))
  } else if (isRecord(value)) {
    for (const [key, item] of Object.entries(value)) scanUnsafe(item, `${path}.${key}`, errors)
  }
}

function collectIds(items: unknown[], key: string, path: string, errors: string[]) {
  const ids = new Set<string>()
  items.forEach((item, index) => {
    const id = isRecord(item) ? item[key] : undefined
    if (typeof id !== 'string' || !stableId.test(id)) errors.push(`${path}[${index}].${key}: 非法稳定 ID`)
    else if (ids.has(id)) errors.push(`${path}[${index}].${key}: 重复 ID ${id}`)
    else ids.add(id)
  })
  return ids
}

export function validateContent(value: unknown, mode: ValidationMode): ValidationResult {
  const errors: string[] = []
  if (!isRecord(value)) return { ok: false, errors: ['$：内容包必须是对象'] }
  if (value.schemaVersion !== 1) errors.push('$.schemaVersion: 必须为 1')
  if (typeof value.contentVersion !== 'string' || value.contentVersion.trim() === '') errors.push('$.contentVersion: 必填')
  if (value.projectId !== 'bianjing') errors.push('$.projectId: 必须为合法 bianjing')
  if (!isRecord(value.meta)) errors.push('$.meta: 必须是对象')
  else {
    if (typeof value.meta.title !== 'string' || value.meta.title.trim() === '') errors.push('$.meta.title: 必填且非空')
    if (value.meta.locale !== 'zh-CN') errors.push('$.meta.locale: 必须为 zh-CN')
    if (typeof value.meta.updatedAt !== 'string' || value.meta.updatedAt.trim() === '') errors.push('$.meta.updatedAt: 必填')
  }
  if (!isRecord(value.content)) errors.push('$.content: 必须是对象')
  else {
    for (const key of Object.keys(value.content)) {
      if (!contentKeys.has(key)) errors.push(`$.content.${key}: 未知业务根字段`)
    }
  }
  scanUnsafe(value, '$', errors)
  if (mode === 'production' && isRecord(value.content)) {
    const requiredCounts: Record<string, number> = { drinks: 10, ingredients: 10, recipes: 10, customers: 12, weather: 6, seasons: 4, demandSegments: 5, marketSignals: 12, crisisContracts: 3, events: 92, chains: 5, endings: 8 }
    for (const [key, count] of Object.entries(requiredCounts)) {
      const items = value.content[key]
      if (!Array.isArray(items) || items.length !== count) errors.push(`$.content.${key}: 必须恰好包含 ${count} 项`)
    }
    validateBalance(value.content.balance, errors)
    if (errors.length === 0) validateReferences(value.content, errors)
    if (errors.length === 0) errors.push(...validateEventQuality(value.content as unknown as ShopContent))
  }
  return { ok: errors.length === 0, errors }
}

function validateReferences(content: Record<string, unknown>, errors: string[]) {
  const drinks = content.drinks as unknown[]
  const ingredients = content.ingredients as unknown[]
  const recipes = content.recipes as unknown[]
  const customers = content.customers as unknown[]
  const weather = content.weather as unknown[]
  const seasons = content.seasons as unknown[]
  const demandSegments = content.demandSegments as unknown[]
  const marketSignals = content.marketSignals as unknown[]
  const crisisContracts = content.crisisContracts as unknown[]
  const events = content.events as unknown[]
  const chains = content.chains as unknown[]
  const endings = content.endings as unknown[]
  const productIds = collectIds(drinks, 'productId', '$.content.drinks', errors)
  const ingredientIds = collectIds(ingredients, 'ingredientId', '$.content.ingredients', errors)
  collectIds(recipes, 'recipeId', '$.content.recipes', errors)
  collectIds(customers, 'customerId', '$.content.customers', errors)
  const weatherIds = collectIds(weather, 'weatherId', '$.content.weather', errors)
  const seasonIds = collectIds(seasons, 'seasonId', '$.content.seasons', errors)
  const segmentIds = collectIds(demandSegments, 'segmentId', '$.content.demandSegments', errors)
  collectIds(marketSignals, 'signalId', '$.content.marketSignals', errors)
  collectIds(crisisContracts, 'contractId', '$.content.crisisContracts', errors)
  const eventIds = collectIds(events, 'eventId', '$.content.events', errors)
  const chainIds = collectIds(chains, 'chainId', '$.content.chains', errors)
  collectIds(endings, 'endingId', '$.content.endings', errors)

  drinks.forEach((item, index) => {
    if (!isRecord(item) || !shelfClasses.has(item.shelfClass as ShelfClass)) errors.push(`$.content.drinks[${index}].shelfClass: 非法保存类型`)
  })
  events.forEach((item, index) => {
    if (!isRecord(item) || item.allowedOperatingModes === undefined) return
    if (!Array.isArray(item.allowedOperatingModes) || item.allowedOperatingModes.some((mode) => !operatingModeIds.has(mode as OperatingMode))
      || new Set(item.allowedOperatingModes).size !== item.allowedOperatingModes.length) {
      errors.push(`$.content.events[${index}].allowedOperatingModes: 必须是无重复的经营方式`)
    }
  })
  marketSignals.forEach((item, index) => {
    if (!isRecord(item)) return
    if (!Array.isArray(item.seasonIds) || item.seasonIds.some((id) => !seasonIds.has(String(id)))) errors.push(`$.content.marketSignals[${index}].seasonIds: 引用不存在`)
    if (!Array.isArray(item.weatherIds) || item.weatherIds.some((id) => !weatherIds.has(String(id)))) errors.push(`$.content.marketSignals[${index}].weatherIds: 引用不存在`)
    if (!Array.isArray(item.segmentWeights) || item.segmentWeights.some((weight) => !isRecord(weight) || !segmentIds.has(String(weight.segmentId)))) {
      errors.push(`$.content.marketSignals[${index}].segmentWeights: 引用不存在`)
    }
  })
  crisisContracts.forEach((item, index) => {
    if (!isRecord(item) || !isFiniteNumber(item.immediateMoney) || !isRecord(item.obligation)) {
      errors.push(`$.content.crisisContracts[${index}]: 契约结构无效`)
      return
    }
    validateConditions(item.eligibility, `$.content.crisisContracts[${index}].eligibility`, productIds, eventIds, chainIds, weatherIds, seasonIds, errors)
    const obligation = item.obligation
    if (obligation.type === 'operating-modifier') {
      if (obligation.target !== 'energy-cost' || obligation.operation !== 'add' || !isFiniteNumber(obligation.value) || obligation.value <= 0
        || typeof obligation.operatingDays !== 'number' || !Number.isInteger(obligation.operatingDays) || obligation.operatingDays <= 0
        || typeof obligation.playerLabel !== 'string' || obligation.playerLabel.trim() === '') {
        errors.push(`$.content.crisisContracts[${index}].obligation: 经营负担结构无效`)
      }
    } else if (obligation.type === 'repayment') {
      if (!Array.isArray(obligation.installments) || obligation.installments.length !== 2 || obligation.installments.some((installment) =>
        !isRecord(installment) || typeof installment.delayDays !== 'number' || !Number.isInteger(installment.delayDays) || installment.delayDays <= 0
        || !isFiniteNumber(installment.amount) || installment.amount >= 0
        || typeof installment.labelId !== 'string' || installment.labelId.trim() === '')) {
        errors.push(`$.content.crisisContracts[${index}].obligation: 还款结构无效`)
      }
    } else if (obligation.type === 'sales-target') {
      if (typeof obligation.targetCount !== 'number' || !Number.isInteger(obligation.targetCount) || obligation.targetCount <= 0
        || !Array.isArray(obligation.segmentIds) || obligation.segmentIds.length === 0 || obligation.segmentIds.some((id) => !segmentIds.has(String(id)))
        || !isFiniteNumber(obligation.successMoney) || obligation.successMoney <= 0
        || !isFiniteNumber(obligation.successReputation) || obligation.successReputation <= 0
        || !isFiniteNumber(obligation.failureReputation) || obligation.failureReputation >= 0) {
        errors.push(`$.content.crisisContracts[${index}].obligation: 预订目标结构无效`)
      }
    } else errors.push(`$.content.crisisContracts[${index}].obligation: 未知契约负担`)
    const scenes = item.scenes
    if (!Array.isArray(scenes) || scenes.some((scene) => !isRecord(scene) || !contractSceneTriggers.has(scene.trigger as ContractSceneTrigger)
      || !eventActorRoles.has(String(scene.actorRole)) || typeof scene.title !== 'string' || scene.title.trim() === ''
      || typeof scene.content !== 'string' || scene.content.trim() === '' || typeof scene.assetId !== 'string' || scene.assetId.trim() === '')) {
      errors.push(`$.content.crisisContracts[${index}].scenes: 契约剧情节点无效`)
    } else {
      const triggers = new Set(scenes.map((scene) => isRecord(scene) ? scene.trigger : undefined))
      const required = ['accepted', 'grace-success', 'grace-failure']
      if (obligation.type === 'repayment') required.push('first-installment', 'second-installment')
      if (obligation.type === 'sales-target') required.push('target-success', 'target-failure')
      if (required.some((trigger) => !triggers.has(trigger)) || triggers.size !== scenes.length) {
        errors.push(`$.content.crisisContracts[${index}].scenes: 契约剧情节点不完整或重复`)
      }
    }
  })

  recipes.forEach((item, index) => {
    if (!isRecord(item)) return
    if (!productIds.has(String(item.productId))) errors.push(`$.content.recipes[${index}].productId: 引用不存在`)
    if (Array.isArray(item.ingredients)) item.ingredients.forEach((part, partIndex) => {
      if (isRecord(part) && !ingredientIds.has(String(part.ingredientId))) errors.push(`$.content.recipes[${index}].ingredients[${partIndex}].ingredientId: 引用不存在`)
    })
  })
  events.forEach((item, index) => {
    if (!isRecord(item) || !Array.isArray(item.choices) || item.choices.length !== 2) {
      errors.push(`$.content.events[${index}].choices: 必须恰好两个选择`)
      return
    }
    const choices = collectIds(item.choices, 'choiceId', `$.content.events[${index}].choices`, errors)
    if (choices.size !== 2) errors.push(`$.content.events[${index}].choices: choiceId 必须唯一`)
    validateScene(item.scene, `$.content.events[${index}].scene`, errors)
    validateConditions(item.conditions, `$.content.events[${index}].conditions`, productIds, eventIds, chainIds, weatherIds, seasonIds, errors)
    item.choices.forEach((choice, choiceIndex) => {
      if (!isRecord(choice)) return
      validateImpactHints(choice.impactHints, `$.content.events[${index}].choices[${choiceIndex}].impactHints`, errors)
      if (typeof choice.resultText !== 'string' || choice.resultText.trim() === '') errors.push(`$.content.events[${index}].choices[${choiceIndex}].resultText: 必填`)
      if ('impactTags' in choice) errors.push(`$.content.events[${index}].choices[${choiceIndex}].impactTags: 已废弃`)
      if (Array.isArray(choice.followUpEventIds)) choice.followUpEventIds.forEach((id, refIndex) => {
        if (!eventIds.has(String(id))) errors.push(`$.content.events[${index}].choices[${choiceIndex}].followUpEventIds[${refIndex}]: 引用不存在`)
      })
      validateEffects(choice.effects, `$.content.events[${index}].choices[${choiceIndex}].effects`, productIds, chainIds, errors)
    })
  })
  chains.forEach((item, index) => {
    if (!isRecord(item) || !eventIds.has(String(item.startEventId))) errors.push(`$.content.chains[${index}].startEventId: 引用不存在`)
    if (isRecord(item) && Array.isArray(item.nodes)) item.nodes.forEach((node, nodeIndex) => {
      if (!isRecord(node) || !Array.isArray(node.choices)) return
      const nodePath = `$.content.chains[${index}].nodes[${nodeIndex}]`
      validateScene(node.scene, `$.content.chains[${index}].nodes[${nodeIndex}].scene`, errors)
      validateConditions(node.conditions, `$.content.chains[${index}].nodes[${nodeIndex}].conditions`, productIds, eventIds, chainIds, weatherIds, seasonIds, errors)
      if (typeof node.interruptionText !== 'string' || node.interruptionText.trim() === '') errors.push(`$.content.chains[${index}].nodes[${nodeIndex}].interruptionText: 必填`)
      collectIds(node.choices, 'choiceId', `$.content.chains[${index}].nodes[${nodeIndex}].choices`, errors)
      node.choices.forEach((nodeChoice, choiceIndex) => {
        if (isRecord(nodeChoice)) {
          validateImpactHints(nodeChoice.impactHints, `$.content.chains[${index}].nodes[${nodeIndex}].choices[${choiceIndex}].impactHints`, errors)
          if (typeof nodeChoice.resultText !== 'string' || nodeChoice.resultText.trim() === '') errors.push(`$.content.chains[${index}].nodes[${nodeIndex}].choices[${choiceIndex}].resultText: 必填`)
          if ('impactTags' in nodeChoice) errors.push(`$.content.chains[${index}].nodes[${nodeIndex}].choices[${choiceIndex}].impactTags: 已废弃`)
          validateEffects(nodeChoice.effects, `$.content.chains[${index}].nodes[${nodeIndex}].choices[${choiceIndex}].effects`, productIds, chainIds, errors)
        }
      })
      if (Array.isArray(node.variants)) {
        collectIds(node.variants, 'variantId', `${nodePath}.variants`, errors)
        node.variants.forEach((variant, variantIndex) => {
          if (!isRecord(variant)) return
          const variantPath = `${nodePath}.variants[${variantIndex}]`
          if (typeof variant.title !== 'string' || variant.title.trim() === '') errors.push(`${variantPath}.title: 必填`)
          if (typeof variant.content !== 'string' || variant.content.trim() === '') errors.push(`${variantPath}.content: 必填`)
          validateConditions(variant.conditions, `${variantPath}.conditions`, productIds, eventIds, chainIds, weatherIds, seasonIds, errors)
          if (variant.scene !== undefined) validateScene(variant.scene, `${variantPath}.scene`, errors)
          if (!Array.isArray(variant.choices) || variant.choices.length !== 2) {
            errors.push(`${variantPath}.choices: 必须恰好两个选择`)
          }
          if (!Array.isArray(variant.choices)) return
          collectIds(variant.choices, 'choiceId', `${variantPath}.choices`, errors)
          variant.choices.forEach((variantChoice, choiceIndex) => {
            if (!isRecord(variantChoice)) return
            validateImpactHints(variantChoice.impactHints, `${variantPath}.choices[${choiceIndex}].impactHints`, errors)
            if (typeof variantChoice.resultText !== 'string' || variantChoice.resultText.trim() === '') errors.push(`${variantPath}.choices[${choiceIndex}].resultText: 必填`)
            if ('impactTags' in variantChoice) errors.push(`${variantPath}.choices[${choiceIndex}].impactTags: 已废弃`)
            validateEffects(variantChoice.effects, `${variantPath}.choices[${choiceIndex}].effects`, productIds, chainIds, errors)
          })
        })
      }
    })
  })
  endings.forEach((item, index) => {
    if (isRecord(item)) validateConditions(item.conditions, `$.content.endings[${index}].conditions`, productIds, eventIds, chainIds, weatherIds, seasonIds, errors)
  })
}

function validateScene(value: unknown, path: string, errors: string[]) {
  if (value === undefined) {
    errors.push(`${path}: 必填`)
    return
  }
  if (!isRecord(value)) {
    errors.push(`${path}: 必须是对象`)
    return
  }
  if (!eventTimings.has(String(value.timing))) errors.push(`${path}.timing: 非法事件时段`)
  if (!eventLocations.has(String(value.location))) errors.push(`${path}.location: 非法场景位置`)
  if (!eventActorRoles.has(String(value.actorRole))) errors.push(`${path}.actorRole: 非法角色类型`)
}

function validateImpactHints(value: unknown, path: string, errors: string[]) {
  if (value === undefined) {
    errors.push(`${path}: 必填`)
    return
  }
  if (!Array.isArray(value)) {
    errors.push(`${path}: 必须是数组`)
    return
  }
  value.forEach((hint, index) => {
    if (!isRecord(hint)) return
    if (!impactAxes.has(String(hint.axis))) errors.push(`${path}[${index}].axis: 非法影响维度`)
    if (!impactDirections.has(String(hint.direction))) errors.push(`${path}[${index}].direction: 非法影响方向`)
  })
}

function validateConditions(value: unknown, path: string, products: Set<string>, events: Set<string>, chains: Set<string>, weather: Set<string>, seasons: Set<string>, errors: string[]) {
  if (!Array.isArray(value)) return
  value.forEach((condition, index) => {
    if (!isRecord(condition)) return
    const itemPath = `${path}[${index}]`
    if ((condition.type === 'event-seen' || condition.type === 'event-not-seen') && !events.has(String(condition.eventId))) errors.push(`${itemPath}.eventId: 引用不存在`)
    if (condition.type === 'inventory-at-least' && !products.has(String(condition.productId))) errors.push(`${itemPath}.productId: 引用不存在`)
    if (condition.type === 'chain-status' && !chains.has(String(condition.chainId))) errors.push(`${itemPath}.chainId: 引用不存在`)
    if (condition.type === 'weather-is' && !weather.has(String(condition.weatherId))) errors.push(`${itemPath}.weatherId: 引用不存在`)
    if (condition.type === 'weather-in' && Array.isArray(condition.weatherIds)) condition.weatherIds.forEach((id, refIndex) => {
      if (!weather.has(String(id))) errors.push(`${itemPath}.weatherIds[${refIndex}]: 引用不存在`)
    })
    if (condition.type === 'season-is' && !seasons.has(String(condition.seasonId))) errors.push(`${itemPath}.seasonId: 引用不存在`)
    if (condition.type === 'season-in' && Array.isArray(condition.seasonIds)) condition.seasonIds.forEach((id, refIndex) => {
      if (!seasons.has(String(id))) errors.push(`${itemPath}.seasonIds[${refIndex}]: 引用不存在`)
    })
    if ((condition.type === 'all' || condition.type === 'any')) validateConditions(condition.conditions, `${itemPath}.conditions`, products, events, chains, weather, seasons, errors)
    if (condition.type === 'not') validateConditions([condition.condition], `${itemPath}.condition`, products, events, chains, weather, seasons, errors)
  })
}

function validateEffects(value: unknown, path: string, products: Set<string>, chains: Set<string>, errors: string[]) {
  if (!Array.isArray(value)) return
  value.forEach((effect, index) => {
    if (!isRecord(effect)) return
    if ((effect.type === 'inventory-delta' || effect.type === 'unlock-product') && !products.has(String(effect.productId))) errors.push(`${path}[${index}].productId: 引用不存在`)
    if ((effect.type === 'start-chain' || effect.type === 'advance-chain' || effect.type === 'interrupt-chain') && !chains.has(String(effect.chainId))) errors.push(`${path}[${index}].chainId: 引用不存在`)
    if (effect.type === 'set-modifier' && !modifierTargets.has(String(effect.target))) errors.push(`${path}[${index}].target: 不支持的长期效果目标`)
    if (effect.type === 'set-modifier' && !modifierOperations.has(String(effect.operation))) errors.push(`${path}[${index}].operation: 不支持的长期效果运算`)
    if (effect.type === 'set-modifier' && (typeof effect.playerLabel !== 'string' || effect.playerLabel.trim() === '')) errors.push(`${path}[${index}].playerLabel: 必填`)
    if (effect.type === 'set-modifier' && effect.productId !== undefined && !products.has(String(effect.productId))) errors.push(`${path}[${index}].productId: 引用不存在`)
    if (effect.type === 'set-modifier' && !Number.isFinite(effect.value)) errors.push(`${path}[${index}].value: 必须是有限数值`)
    if (effect.type === 'set-modifier' && !Number.isFinite(effect.durationDays)) errors.push(`${path}[${index}].durationDays: 必须是有限数值`)
  })
}
