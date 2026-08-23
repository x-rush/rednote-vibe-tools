import type { BusinessEvent, Ending, EventChain, Ingredient, Product, Recipe } from '../domain/types'

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

export interface BalanceDefinition {
  initial: { money: number; reputation: number; energy: number; relationships: number }
  stageBaseVisitors: { dayRange: [number, number]; visitors: number }[]
  reputation: { linearUntil: number; pointsPerVisitor: number; afterThresholdDivisor: number }
  price: { minimumRatio: number; maximumRatio: number; weight: number }
  preferenceWeight: number
  reputationWeight: number
  serviceWeight: number
  baseOpenEnergy: number
  earlyCloseEnergyProtection: number
  earlyCloseVisitorMultiplier: number
  dailyFixedCost: number
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
const contentKeys = new Set([
  'drinks', 'ingredients', 'recipes', 'customers', 'weather', 'seasons',
  'events', 'chains', 'endings', 'balance', 'ui',
])

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

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
    const requiredCounts: Record<string, number> = { drinks: 10, ingredients: 10, recipes: 10, customers: 12, weather: 6, seasons: 4, events: 80, chains: 5, endings: 8 }
    for (const [key, count] of Object.entries(requiredCounts)) {
      const items = value.content[key]
      if (!Array.isArray(items) || items.length !== count) errors.push(`$.content.${key}: 必须恰好包含 ${count} 项`)
    }
    if (errors.length === 0) validateReferences(value.content, errors)
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
  const events = content.events as unknown[]
  const chains = content.chains as unknown[]
  const endings = content.endings as unknown[]
  const productIds = collectIds(drinks, 'productId', '$.content.drinks', errors)
  const ingredientIds = collectIds(ingredients, 'ingredientId', '$.content.ingredients', errors)
  collectIds(recipes, 'recipeId', '$.content.recipes', errors)
  collectIds(customers, 'customerId', '$.content.customers', errors)
  collectIds(weather, 'weatherId', '$.content.weather', errors)
  collectIds(seasons, 'seasonId', '$.content.seasons', errors)
  const eventIds = collectIds(events, 'eventId', '$.content.events', errors)
  const chainIds = collectIds(chains, 'chainId', '$.content.chains', errors)
  collectIds(endings, 'endingId', '$.content.endings', errors)

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
    validateConditions(item.conditions, `$.content.events[${index}].conditions`, productIds, eventIds, chainIds, errors)
    item.choices.forEach((choice, choiceIndex) => {
      if (!isRecord(choice)) return
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
      collectIds(node.choices, 'choiceId', `$.content.chains[${index}].nodes[${nodeIndex}].choices`, errors)
      node.choices.forEach((nodeChoice, choiceIndex) => {
        if (isRecord(nodeChoice)) validateEffects(nodeChoice.effects, `$.content.chains[${index}].nodes[${nodeIndex}].choices[${choiceIndex}].effects`, productIds, chainIds, errors)
      })
    })
  })
  endings.forEach((item, index) => {
    if (isRecord(item)) validateConditions(item.conditions, `$.content.endings[${index}].conditions`, productIds, eventIds, chainIds, errors)
  })
}

function validateConditions(value: unknown, path: string, products: Set<string>, events: Set<string>, chains: Set<string>, errors: string[]) {
  if (!Array.isArray(value)) return
  value.forEach((condition, index) => {
    if (!isRecord(condition)) return
    const itemPath = `${path}[${index}]`
    if ((condition.type === 'event-seen' || condition.type === 'event-not-seen') && !events.has(String(condition.eventId))) errors.push(`${itemPath}.eventId: 引用不存在`)
    if (condition.type === 'inventory-at-least' && !products.has(String(condition.productId))) errors.push(`${itemPath}.productId: 引用不存在`)
    if (condition.type === 'chain-status' && !chains.has(String(condition.chainId))) errors.push(`${itemPath}.chainId: 引用不存在`)
    if ((condition.type === 'all' || condition.type === 'any')) validateConditions(condition.conditions, `${itemPath}.conditions`, products, events, chains, errors)
    if (condition.type === 'not') validateConditions([condition.condition], `${itemPath}.condition`, products, events, chains, errors)
  })
}

function validateEffects(value: unknown, path: string, products: Set<string>, chains: Set<string>, errors: string[]) {
  if (!Array.isArray(value)) return
  value.forEach((effect, index) => {
    if (!isRecord(effect)) return
    if ((effect.type === 'inventory-delta' || effect.type === 'unlock-product') && !products.has(String(effect.productId))) errors.push(`${path}[${index}].productId: 引用不存在`)
    if ((effect.type === 'advance-chain' || effect.type === 'interrupt-chain') && !chains.has(String(effect.chainId))) errors.push(`${path}[${index}].chainId: 引用不存在`)
  })
}
