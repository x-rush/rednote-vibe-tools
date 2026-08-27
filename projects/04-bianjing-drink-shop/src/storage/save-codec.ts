import type { ShopContent } from '../content/schema'
import type { EventCondition, EventEffect, GameState, SavePayload } from '../domain/types'
import { migrateV1Save } from './migrate-v1'
import { migrateV2Save } from './migrate-v2'
import { migrateV3Save } from './migrate-v3'
import { migrateV4Save } from './migrate-v4'
import { calendarDayForOperatingDay } from '../engine/campaign'

export type SaveRecoveryResult =
  | { status: 'ok'; payload: SavePayload }
  | { status: 'migrated'; payload: SavePayload }
  | { status: 'recovered-previous'; payload: SavePayload; reason: string }
  | { status: 'unrecoverable-pending'; reason: string }
  | { status: 'future-version'; reason: string }
  | { status: 'invalid'; reason: string }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const pages = new Set(['landing', 'newGame', 'tutorial', 'morning', 'preparation', 'opening', 'event', 'settlement', 'financialCrisis', 'milestone', 'bankruptcy', 'finalEnding', 'continueGame', 'error'])
const chainStatuses = new Set(['inactive', 'active', 'completed', 'interrupted'])
const modifierTargets = new Set(['visitor-count', 'energy-cost', 'fixed-cost', 'sales-income', 'waste-return', 'product-demand'])
const modifierOperations = new Set(['add', 'multiply'])
const ledgerKinds = new Set(['income', 'stock-cost', 'waste-return', 'fixed-cost', 'event', 'scheduled'])
const selectionKinds = new Set(['none', 'event', 'chain'])
const operatingModes = new Set(['full', 'half', 'rest'])
const financialPhases = new Set(['normal', 'warning', 'offer', 'grace'])
const contractSceneTriggers = new Set(['accepted', 'first-installment', 'second-installment', 'target-success', 'target-failure', 'grace-success', 'grace-failure'])
const beatKinds = new Set(['direct-sale', 'substitute', 'stockout', 'menu-mismatch', 'price-left', 'quiet'])
const finiteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const shortString = (value: unknown, maximum = 240): value is string => typeof value === 'string' && value.length > 0 && value.length <= maximum

function stringList(value: unknown, maximum: number, allowed?: Set<string>) {
  return Array.isArray(value) && value.length <= maximum
    && value.every((item) => shortString(item) && (allowed === undefined || allowed.has(item)))
}

function numberRecord(value: unknown, allowed: Set<string>, minimum = Number.NEGATIVE_INFINITY): value is Record<string, number> {
  return isRecord(value) && Object.entries(value).every(([key, item]) => allowed.has(key) && finiteNumber(item) && item >= minimum)
}

function collectEffectFlags(effects: EventEffect[], flags: Set<string>) {
  for (const effect of effects) {
    if (effect.type === 'add-flag' || effect.type === 'remove-flag') flags.add(effect.flag)
    if (effect.type === 'schedule-effect') collectEffectFlags(effect.effects, flags)
  }
}

function collectConditionFlags(conditions: EventCondition[] | undefined, flags: Set<string>) {
  for (const condition of conditions ?? []) {
    if (condition.type === 'has-flag' || condition.type === 'lacks-flag') flags.add(condition.flag)
    if (condition.type === 'all' || condition.type === 'any') collectConditionFlags(condition.conditions, flags)
    if (condition.type === 'not') collectConditionFlags([condition.condition], flags)
  }
}

function knownFlags(content: ShopContent) {
  const flags = new Set(content.chains.map((chain) => `${chain.chainId}-completed`))
  ;['crisis-preorder-target-complete', 'crisis-preorder-target-failed', 'financial-crisis-close'].forEach((flag) => flags.add(flag))
  for (const event of content.events) {
    collectConditionFlags(event.conditions, flags)
    for (const choice of event.choices) collectEffectFlags(choice.effects, flags)
  }
  for (const chain of content.chains) for (const node of chain.nodes) {
    collectConditionFlags(node.conditions, flags)
    for (const choice of node.choices) collectEffectFlags(choice.effects, flags)
    for (const variant of node.variants ?? []) {
      collectConditionFlags(variant.conditions, flags)
      for (const choice of variant.choices) collectEffectFlags(choice.effects, flags)
    }
  }
  for (const ending of content.endings) collectConditionFlags(ending.conditions, flags)
  return flags
}

function validDecision(value: unknown, content: ShopContent) {
  if (!isRecord(value) || !Array.isArray(value.menu) || !shortString(value.strategyId) || !operatingModes.has(String(value.operatingMode))) return false
  const products = new Set(content.drinks.map((item) => item.productId))
  if (value.operatingMode === 'rest') return value.menu.length === 0
  return value.menu.length >= 3 && value.menu.length <= 5 && value.menu.every((entry) => isRecord(entry)
    && products.has(String(entry.productId)) && Number.isInteger(entry.prepare) && Number(entry.prepare) >= 0 && Number(entry.prepare) <= 12
    && Number.isInteger(entry.price) && Number(entry.price) > 0)
}

function validForecast(value: unknown, day: number, operatingDay: number, content: ShopContent) {
  if (!isRecord(value) || value.day !== day || value.operatingDay !== operatingDay || !shortString(value.forecastId)
    || !content.weather.some((item) => item.weatherId === value.weatherId)
    || !content.seasons.some((item) => item.seasonId === value.seasonId)
    || !content.marketSignals.some((item) => item.signalId === value.marketSignalId)
    || !stringList(value.activeTags, 30) || !Array.isArray(value.demandGroups)
    || value.demandGroups.length !== content.demandSegments.length) return false
  const ids = new Set<string>()
  return value.demandGroups.every((group) => {
    if (!isRecord(group) || !content.demandSegments.some((item) => item.segmentId === group.segmentId)
      || ids.has(String(group.segmentId)) || !Number.isInteger(group.expectedCustomers) || Number(group.expectedCustomers) < 0
      || !Number.isInteger(group.actualCustomers) || Number(group.actualCustomers) < 0) return false
    ids.add(String(group.segmentId))
    return true
  })
}

function validDemandResolution(value: unknown, content: ShopContent) {
  if (!isRecord(value) || !Number.isInteger(value.potentialBuyers) || Number(value.potentialBuyers) < 0
    || !Number.isInteger(value.servedCustomers) || Number(value.servedCustomers) < 0 || !isRecord(value.losses)
    || !Array.isArray(value.products) || value.products.length > 5) return false
  const losses = value.losses
  const lossKeys = ['stockout', 'menuMismatch', 'price', 'service']
  if (!lossKeys.every((key) => Number.isInteger(losses[key]) && Number(losses[key]) >= 0)) return false
  const lossTotal = lossKeys.reduce((sum, key) => sum + Number(losses[key]), 0)
  if (Number(value.servedCustomers) + lossTotal !== Number(value.potentialBuyers)) return false
  return value.products.every((item) => isRecord(item) && content.drinks.some((product) => product.productId === item.productId)
    && ['directDemand', 'directSold', 'substituteSold', 'prepared', 'unsold', 'stockoutLost'].every((key) => Number.isInteger(item[key]) && Number(item[key]) >= 0)
    && Number(item.directSold) + Number(item.substituteSold) <= Number(item.prepared)
    && Number(item.unsold) === Number(item.prepared) - Number(item.directSold) - Number(item.substituteSold))
}

function validBusinessBeats(value: unknown) {
  return Array.isArray(value) && value.length === 4 && value.every((beat, index) => isRecord(beat)
    && beat.stage === index && beatKinds.has(String(beat.kind)) && Number.isInteger(beat.count) && Number(beat.count) >= 0
    && (beat.productId === undefined || shortString(beat.productId))
    && (beat.alternativeProductId === undefined || shortString(beat.alternativeProductId)))
}

function validEffect(value: unknown, content: ShopContent, depth = 0): value is EventEffect {
  if (!isRecord(value) || depth > 4 || !shortString(value.type, 40)) return false
  const products = new Set(content.drinks.map((item) => item.productId))
  const chains = new Set(content.chains.map((item) => item.chainId))
  switch (value.type) {
    case 'money-delta': return finiteNumber(value.value) && shortString(value.labelId)
    case 'stat-delta': return ['reputation', 'energy', 'relationships'].includes(String(value.stat)) && finiteNumber(value.value) && shortString(value.labelId)
    case 'inventory-delta': return products.has(String(value.productId)) && finiteNumber(value.value) && shortString(value.labelId)
    case 'add-flag':
    case 'remove-flag': return shortString(value.flag)
    case 'unlock-product': return products.has(String(value.productId))
    case 'set-modifier': return shortString(value.modifierId) && finiteNumber(value.value) && finiteNumber(value.durationDays)
      && value.durationDays >= 0 && modifierTargets.has(String(value.target)) && modifierOperations.has(String(value.operation))
      && (value.productId === undefined || products.has(String(value.productId))) && shortString(value.playerLabel)
    case 'schedule-effect': return finiteNumber(value.delayDays) && value.delayDays >= 0 && Array.isArray(value.effects)
      && value.effects.length <= 20 && value.effects.every((effect) => validEffect(effect, content, depth + 1))
    case 'start-chain': return chains.has(String(value.chainId))
    case 'advance-chain': return chains.has(String(value.chainId)) && shortString(value.nodeId)
    case 'interrupt-chain': return chains.has(String(value.chainId)) && shortString(value.reason)
    default: return false
  }
}

function validPendingOpening(value: unknown, content: ShopContent) {
  if (!isRecord(value) || !shortString(value.resolutionId) || !isRecord(value.dayContext) || !isRecord(value.decision) || !isRecord(value.rngState)) return false
  const products = new Set(content.drinks.map((item) => item.productId))
  const weather = new Set(content.weather.map((item) => item.weatherId))
  const seasons = new Set(content.seasons.map((item) => item.seasonId))
  const selectionKind = String(value.selectionKind)
  if (!selectionKinds.has(selectionKind) || !finiteNumber(value.visitors) || value.visitors < 0 || !finiteNumber(value.moneyDelta)
    || !finiteNumber(value.energyCost) || value.energyCost < 0 || !finiteNumber(value.energyDelta)
    || !finiteNumber(value.footTraffic) || value.footTraffic < 0 || !finiteNumber(value.buyers) || value.buyers < 0
    || value.buyers > value.footTraffic || !finiteNumber(value.unserved) || value.unserved < 0
    || !finiteNumber(value.conversionRate) || value.conversionRate < 0 || value.conversionRate > 1
    || !operatingModes.has(String(value.operatingMode)) || !finiteNumber(value.rngState.value)) return false
  if (!finiteNumber(value.dayContext.day) || !finiteNumber(value.dayContext.operatingDay)
    || !weather.has(String(value.dayContext.weatherId)) || !seasons.has(String(value.dayContext.seasonId))
    || !finiteNumber(value.dayContext.eventVisitorDelta) || !stringList(value.dayContext.activeTags, 30)) return false
  if (!validDecision(value.decision, content)) return false
  if (!Array.isArray(value.sales) || value.sales.length > 5 || !value.sales.every((sale) => isRecord(sale)
    && products.has(String(sale.productId)) && ['prepared', 'demand', 'sold', 'unsold', 'price'].every((key) => finiteNumber(sale[key]) && Number(sale[key]) >= 0))) return false
  if (!Array.isArray(value.ledger) || value.ledger.length > 80 || !value.ledger.every((line) => isRecord(line)
    && ledgerKinds.has(String(line.kind)) && shortString(line.labelId) && finiteNumber(line.amount)
    && (line.entityId === undefined || shortString(line.entityId)))) return false
  if (!Array.isArray(value.chainInterruptions) || value.chainInterruptions.length > content.chains.length
    || !value.chainInterruptions.every((item) => isRecord(item) && content.chains.some((chain) => chain.chainId === item.chainId)
      && shortString(item.nodeId) && item.chainStatus === 'interrupted' && shortString(item.reasonId))) return false
  if (!validDemandResolution(value.demandResolution, content) || !validBusinessBeats(value.businessBeats)) return false
  if (selectionKind === 'event') return shortString(value.eventId) && content.events.some((event) => event.eventId === value.eventId)
  if (selectionKind === 'chain') return shortString(value.eventId) && shortString(value.chainId) && shortString(value.nodeId)
    && content.chains.some((chain) => chain.chainId === value.chainId && chain.nodes.some((node) => node.nodeId === value.nodeId
      && (value.variantId === undefined || (shortString(value.variantId) && node.variants?.some((variant) => variant.variantId === value.variantId)))))
  return value.eventId === undefined && value.chainId === undefined && value.nodeId === undefined
}

function containsUnsafe(value: unknown): boolean {
  if (typeof value === 'string') return /data:[^;]+;base64,/i.test(value)
  if (Array.isArray(value)) return value.some(containsUnsafe)
  if (isRecord(value)) return Object.entries(value).some(([key, item]) => /blob|base64|image/i.test(key) || containsUnsafe(item))
  return false
}

function validState(value: unknown, content: ShopContent): value is GameState {
  if (!isRecord(value) || containsUnsafe(value)) return false
  if (value.schemaVersion !== 5) return false
  const numeric = ['day', 'operatingDay', 'money', 'reputation', 'energy', 'relationships', 'negativeProfitStreak']
  if (numeric.some((key) => !finiteNumber(value[key]))) return false
  if (Number(value.day) < 1 || Number(value.day) > content.balance.campaign.totalCalendarDays
    || !Number.isInteger(value.operatingDay) || Number(value.operatingDay) < 1
    || Number(value.operatingDay) > content.balance.campaign.operatingDays.length
    || calendarDayForOperatingDay(Number(value.operatingDay), content.balance.campaign) !== Number(value.day)
    || Number(value.negativeProfitStreak) < 0 || !pages.has(String(value.page))) return false
  if (!shortString(value.contentVersion) || !shortString(value.saveId) || !shortString(value.seed) || !isRecord(value.rngState) || !finiteNumber(value.rngState.value)) return false
  if (!isRecord(value.inventory) || !isRecord(value.prices)) return false
  const productIds = new Set(content.drinks.map((product) => product.productId))
  const eventIds = new Set(content.events.map((event) => event.eventId))
  const endingIds = new Set(content.endings.map((ending) => ending.endingId))
  const allowedFlags = knownFlags(content)
  if (!numberRecord(value.inventory, productIds, 0) || !numberRecord(value.prices, productIds, 1)) return false
  if (!stringList(value.flags, 500, allowedFlags) || !stringList(value.triggeredEventIds, 500, eventIds)
    || !Array.isArray(value.unlockedProductIds) || !stringList(value.unlockedProductIds, content.drinks.length, productIds) || value.unlockedProductIds.length < 3
    || !stringList(value.unlockedEndingIds, content.endings.length, endingIds)) return false
  if (value.currentEndingId !== undefined && !endingIds.has(String(value.currentEndingId))) return false
  if (!numberRecord(value.eventLastTriggeredDay, eventIds, 0)) return false
  if (!Array.isArray(value.eventHistory) || value.eventHistory.length > 500 || !value.eventHistory.every((item) => isRecord(item)
    && finiteNumber(item.day) && eventIds.has(String(item.eventId))
    && content.events.some((event) => event.eventId === item.eventId && event.choices.some((choice) => choice.choiceId === item.choiceId))
    && finiteNumber(item.moneyDelta)
    && isRecord(item.statDeltas) && Object.entries(item.statDeltas).every(([key, delta]) => ['reputation', 'energy', 'relationships'].includes(key) && finiteNumber(delta)))) return false
  if (!isRecord(value.chainProgress) || !Object.entries(value.chainProgress).every(([chainId, progress]) => {
    const chain = content.chains.find((item) => item.chainId === chainId)
    return chain && isRecord(progress) && progress.chainId === chainId && chainStatuses.has(String(progress.status))
      && finiteNumber(progress.nodeIndex) && progress.nodeIndex >= -1 && progress.nodeIndex <= chain.nodes.length
      && finiteNumber(progress.startedDay) && finiteNumber(progress.lastAdvancedDay)
      && (progress.currentNodeId === undefined || chain.nodes.some((node) => node.nodeId === progress.currentNodeId))
      && (progress.reason === undefined || shortString(progress.reason))
  })) return false
  if (!Array.isArray(value.pendingEffects) || value.pendingEffects.length > 120 || !value.pendingEffects.every((pending) => isRecord(pending)
    && shortString(pending.scheduledEffectId) && finiteNumber(pending.dueDay) && Array.isArray(pending.effects)
    && pending.effects.length <= 20 && pending.effects.every((effect) => validEffect(effect, content))
    && ((pending.contractId === undefined && pending.contractSceneTrigger === undefined)
      || (content.crisisContracts.some((contract) => contract.contractId === pending.contractId) && contractSceneTriggers.has(String(pending.contractSceneTrigger)))))) return false
  if (!Array.isArray(value.modifiers) || value.modifiers.length > 100 || !value.modifiers.every((modifier) => isRecord(modifier)
    && shortString(modifier.modifierId) && modifierTargets.has(String(modifier.target)) && modifierOperations.has(String(modifier.operation))
    && finiteNumber(modifier.value) && finiteNumber(modifier.expiresDay) && shortString(modifier.playerLabel)
    && (modifier.productId === undefined || productIds.has(String(modifier.productId)))
    && (modifier.durationBasis === undefined
      ? modifier.remainingOperatingDays === undefined
      : modifier.durationBasis === 'calendar'
        ? modifier.remainingOperatingDays === undefined
        : modifier.durationBasis === 'operating' && Number.isInteger(modifier.remainingOperatingDays) && Number(modifier.remainingOperatingDays) > 0))) return false
  if (!Array.isArray(value.decisionSummaries) || value.decisionSummaries.length > 200 || !value.decisionSummaries.every((summary) => isRecord(summary)
    && finiteNumber(summary.day) && stringList(summary.productIds, 5, productIds) && finiteNumber(summary.prepared)
    && finiteNumber(summary.averagePrice) && operatingModes.has(String(summary.operatingMode)))) return false
  if (value.campaignTotals !== undefined) {
    const totals = value.campaignTotals
    if (!isRecord(totals)
      || !['trackedOperatingDays', 'totalSold', 'profitDays', 'lossDays', 'breakEvenDays'].every((key) => Number.isInteger(totals[key]) && Number(totals[key]) >= 0)
      || Number(totals.trackedOperatingDays) > content.balance.campaign.operatingDays.length
      || Number(totals.profitDays) + Number(totals.lossDays) + Number(totals.breakEvenDays) !== Number(totals.trackedOperatingDays)
      || !numberRecord(totals.productSold, productIds, 0)
      || Object.values(totals.productSold).reduce((sum, sold) => sum + Number(sold), 0) !== Number(totals.totalSold)) return false
  }
  if (!Array.isArray(value.pendingFollowUps) || value.pendingFollowUps.length > 24
    || !value.pendingFollowUps.every((pending) => isRecord(pending) && eventIds.has(String(pending.eventId))
      && finiteNumber(pending.earliestDay) && pending.earliestDay >= 1)) return false
  if (value.pendingOpening !== undefined && !validPendingOpening(value.pendingOpening, content)) return false
  if (!validForecast(value.dayForecast, Number(value.day), Number(value.operatingDay), content)) return false
  if (!isRecord(value.financialHealth) || !financialPhases.has(String(value.financialHealth.phase)) || typeof value.financialHealth.rescueUsed !== 'boolean') return false
  if (value.financialHealth.activeContract !== undefined) {
    const active = value.financialHealth.activeContract
    if (!isRecord(active) || value.financialHealth.rescueUsed !== true || value.financialHealth.phase !== 'grace'
      || !content.crisisContracts.some((contract) => contract.contractId === active.contractId)
      || !Number.isInteger(active.acceptedDay) || !Number.isInteger(active.graceEndsDay) || Number(active.graceEndsDay) <= Number(active.acceptedDay)
      || !Number.isInteger(active.preorderProgress) || Number(active.preorderProgress) < 0) return false
  }
  if (value.pendingContractScene !== undefined) {
    const scene = value.pendingContractScene
    if (!isRecord(scene) || !content.crisisContracts.some((contract) => contract.contractId === scene.contractId)
      || !contractSceneTriggers.has(String(scene.trigger))) return false
  }
  if (value.lastDecision !== undefined && !validDecision(value.lastDecision, content)) return false
  return true
}

function bounded(payload: SavePayload): SavePayload {
  const boundState = (state: GameState): GameState => ({
    ...state,
    eventHistory: state.eventHistory.slice(-120),
    decisionSummaries: state.decisionSummaries.slice(-30),
    flags: state.flags.slice(-500),
  })
  return {
    ...payload,
    current: boundState(payload.current),
    previousDay: payload.previousDay ? boundState(payload.previousDay) : undefined,
  }
}

export function encodeSave(payload: SavePayload): string {
  if (containsUnsafe(payload)) throw new Error('存档包含禁止的媒体或 Base64 数据')
  return JSON.stringify(bounded(payload))
}

export function decodeSave(raw: string, content: ShopContent): SaveRecoveryResult {
  let value: unknown
  try { value = JSON.parse(raw) } catch { return { status: 'invalid', reason: '存档 JSON 已损坏' } }
  if (!isRecord(value)) return { status: 'invalid', reason: '存档外壳无效' }
  if (containsUnsafe(value)) return { status: 'invalid', reason: '存档包含禁止的媒体或 Base64 数据' }
  if (typeof value.schemaVersion === 'number' && value.schemaVersion > 5) return { status: 'future-version', reason: '存档来自更高版本' }
  const finalizeMigration = (legacy: ReturnType<typeof migrateV1Save> | ReturnType<typeof migrateV2Save>) => {
    if (legacy.status !== 'migrated') return legacy
    const v4 = migrateV3Save(legacy.payload, content)
    if (v4.status === 'invalid') return v4
    const migrated = migrateV4Save(v4.payload, content)
    if (migrated.status === 'invalid') return migrated
    if (!validState(migrated.payload.current, content)) return { status: 'invalid' as const, reason: '迁移后的存档仍含无效结构' }
    return { status: 'migrated' as const, payload: bounded(migrated.payload) }
  }
  if (value.schemaVersion === 1) {
    return finalizeMigration(migrateV1Save(value, content))
  }
  if (value.schemaVersion === 2) {
    return finalizeMigration(migrateV2Save(value, content))
  }
  if (value.schemaVersion === 3) {
    const v4 = migrateV3Save(value, content)
    if (v4.status === 'invalid') return v4
    const migrated = migrateV4Save(v4.payload, content)
    if (migrated.status === 'invalid') return migrated
    if (!validState(migrated.payload.current, content)) return { status: 'invalid', reason: '迁移后的存档仍含无效结构' }
    return { ...migrated, payload: bounded(migrated.payload) }
  }
  if (value.schemaVersion === 4) {
    const migrated = migrateV4Save(value, content)
    if (migrated.status === 'invalid') return migrated
    if (!validState(migrated.payload.current, content)) return { status: 'invalid', reason: '迁移后的存档仍含无效结构' }
    return { ...migrated, payload: bounded(migrated.payload) }
  }
  if (value.schemaVersion !== 5 || typeof value.id !== 'string' || typeof value.contentVersion !== 'string' || typeof value.updatedAt !== 'string') {
    return { status: 'invalid', reason: '存档版本或必填字段无效' }
  }
  const base = value as unknown as SavePayload
  if (validState(value.current, content)) {
    const previousDay = validState(value.previousDay, content) ? value.previousDay : undefined
    return { status: 'ok', payload: bounded({ ...base, previousDay }) }
  }
  if (validState(value.previousDay, content)) {
    const recovered = bounded({ ...base, current: value.previousDay, previousDay: undefined } as SavePayload)
    return { status: 'recovered-previous', payload: recovered, reason: '当前快照损坏，已恢复上一日' }
  }
  return { status: 'invalid', reason: '当前与上一日快照均不可恢复' }
}
