import type { ShopContent } from '../content/schema'
import type {
  ActiveModifier,
  ChainProgress,
  EventCondition,
  EventEffect,
  GameState,
  PageState,
  SavePayload,
} from '../domain/types'
import { createNewGame } from '../engine/simulator'

export type SaveMigrationResult =
  | { status: 'migrated'; payload: SavePayload }
  | { status: 'unrecoverable-pending'; reason: string }
  | { status: 'invalid'; reason: string }

const pages = new Set<PageState>([
  'landing', 'newGame', 'tutorial', 'morning', 'preparation', 'opening', 'event',
  'settlement', 'milestone', 'bankruptcy', 'finalEnding', 'continueGame', 'error',
])
const chainStatuses = new Set(['inactive', 'active', 'completed', 'interrupted'])
const modifierTargets = new Set(['visitor-count', 'energy-cost', 'fixed-cost', 'sales-income', 'waste-return', 'product-demand'])
const modifierOperations = new Set(['add', 'multiply'])
const legacyModifiers: Record<string, Pick<ActiveModifier, 'target' | 'operation'> & { valueFactor: number }> = {
  'autumn-sales': { target: 'visitor-count', operation: 'add', valueFactor: 1 },
  'sales-volume': { target: 'visitor-count', operation: 'add', valueFactor: 1 },
  capacity: { target: 'visitor-count', operation: 'add', valueFactor: 1 },
  'profit-margin': { target: 'fixed-cost', operation: 'add', valueFactor: -1 },
  'stage-money': { target: 'fixed-cost', operation: 'add', valueFactor: -1 },
  'apprentice-wage': { target: 'fixed-cost', operation: 'add', valueFactor: -1 },
  'daily-journal-energy': { target: 'energy-cost', operation: 'add', valueFactor: -1 },
  'apprentice-energy': { target: 'energy-cost', operation: 'add', valueFactor: -1 },
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const stringArray = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []

function copyNumberRecord(value: unknown, allowedIds?: Set<string>, minimum = Number.NEGATIVE_INFINITY): Record<string, number> {
  if (!isRecord(value)) return {}
  return Object.entries(value).reduce<Record<string, number>>((result, [id, item]) => {
    if ((allowedIds === undefined || allowedIds.has(id)) && finite(item) && item >= minimum) result[id] = item
    return result
  }, {})
}

function migrateChains(value: unknown, day: number, content: ShopContent): Record<string, ChainProgress> {
  if (!isRecord(value)) return {}
  const chains = new Map(content.chains.map((chain) => [chain.chainId, chain]))
  const migrated: Record<string, ChainProgress> = {}
  for (const [chainId, raw] of Object.entries(value)) {
    const chain = chains.get(chainId)
    if (!chain || !isRecord(raw) || !chainStatuses.has(String(raw.status)) || !finite(raw.nodeIndex)) continue
    const progress: ChainProgress = {
      chainId,
      status: raw.status as ChainProgress['status'],
      nodeIndex: Math.max(-1, Math.min(chain.nodes.length, Math.trunc(raw.nodeIndex))),
      startedDay: finite(raw.startedDay) ? Math.trunc(raw.startedDay) : day,
      lastAdvancedDay: finite(raw.lastAdvancedDay) ? Math.trunc(raw.lastAdvancedDay) : day,
      currentNodeId: typeof raw.currentNodeId === 'string' ? raw.currentNodeId : undefined,
      reason: typeof raw.reason === 'string' ? raw.reason : undefined,
    }
    const isUnadvancedEntrance = progress.nodeIndex === -1
    const isBugTimeout = progress.status === 'interrupted'
      && progress.reason === 'timeout'
      && progress.currentNodeId === chain.nodes[0]?.nodeId
    if ((progress.status === 'active' && isUnadvancedEntrance) || (isUnadvancedEntrance && isBugTimeout)) {
      progress.status = 'active'
      progress.lastAdvancedDay = day
      progress.currentNodeId = undefined
      progress.reason = undefined
    }
    migrated[chainId] = progress
  }
  return migrated
}

function migrateModifiers(value: unknown, content: ShopContent): ActiveModifier[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((raw) => {
    if (!isRecord(raw) || typeof raw.modifierId !== 'string' || !finite(raw.value) || !finite(raw.expiresDay)) return []
    const legacy = legacyModifiers[raw.modifierId]
    const target = typeof raw.target === 'string' ? raw.target as ActiveModifier['target'] : legacy?.target
    const operation = typeof raw.operation === 'string' ? raw.operation as ActiveModifier['operation'] : legacy?.operation
    if (!target || !operation || !modifierTargets.has(target) || !modifierOperations.has(operation)) return []
    const productId = typeof raw.productId === 'string' && content.drinks.some((product) => product.productId === raw.productId) ? raw.productId : undefined
    const normalized: ActiveModifier = {
      modifierId: raw.modifierId,
      target,
      operation,
      value: raw.value * (raw.target && raw.operation ? 1 : (legacy?.valueFactor ?? 1)),
      expiresDay: Math.trunc(raw.expiresDay),
      productId,
      playerLabel: typeof raw.playerLabel === 'string' && raw.playerLabel ? raw.playerLabel : raw.modifierId,
    }
    return [normalized]
  })
}

function walkEffects(effects: EventEffect[], flags: Set<string>) {
  for (const effect of effects) {
    if (effect.type === 'add-flag' || effect.type === 'remove-flag') flags.add(effect.flag)
    if (effect.type === 'schedule-effect') walkEffects(effect.effects, flags)
  }
}

function walkConditions(conditions: EventCondition[] | undefined, flags: Set<string>) {
  for (const condition of conditions ?? []) {
    if (condition.type === 'has-flag' || condition.type === 'lacks-flag') flags.add(condition.flag)
    if (condition.type === 'all' || condition.type === 'any') walkConditions(condition.conditions, flags)
    if (condition.type === 'not') walkConditions([condition.condition], flags)
  }
}

function knownFlags(content: ShopContent) {
  const flags = new Set(content.chains.map((chain) => `${chain.chainId}-completed`))
  for (const event of content.events) {
    walkConditions(event.conditions, flags)
    for (const choice of event.choices) walkEffects(choice.effects, flags)
  }
  for (const chain of content.chains) for (const node of chain.nodes) {
    walkConditions(node.conditions, flags)
    for (const choice of node.choices) walkEffects(choice.effects, flags)
  }
  for (const ending of content.endings) walkConditions(ending.conditions, flags)
  return flags
}

function migrateState(value: unknown, content: ShopContent): GameState | undefined {
  if (!isRecord(value) || typeof value.saveId !== 'string' || typeof value.seed !== 'string') return undefined
  if (!finite(value.day) || !finite(value.money) || !finite(value.reputation) || !finite(value.energy) || !finite(value.relationships)) return undefined
  const base = createNewGame(value.seed, value.saveId, content)
  const productIds = new Set(content.drinks.map((product) => product.productId))
  const eventIds = new Set(content.events.map((event) => event.eventId))
  const endingIds = new Set(content.endings.map((ending) => ending.endingId))
  const flags = knownFlags(content)
  const day = Math.trunc(value.day)
  const rngValue = isRecord(value.rngState) && finite(value.rngState.value) ? value.rngState.value : base.rngState.value
  const page = typeof value.page === 'string' && pages.has(value.page as PageState) ? value.page as PageState : 'morning'
  return {
    ...base,
    schemaVersion: 3,
    contentVersion: base.contentVersion,
    rngState: { value: rngValue },
    day,
    page,
    money: value.money,
    reputation: value.reputation,
    energy: value.energy,
    relationships: value.relationships,
    inventory: { ...base.inventory, ...copyNumberRecord(value.inventory, productIds, 0) },
    prices: { ...base.prices, ...copyNumberRecord(value.prices, productIds, 1) },
    unlockedProductIds: stringArray(value.unlockedProductIds).filter((id) => productIds.has(id)),
    flags: stringArray(value.flags).filter((flag) => flags.has(flag)).slice(-500),
    triggeredEventIds: stringArray(value.triggeredEventIds).filter((eventId) => eventIds.has(eventId)).slice(-500),
    eventLastTriggeredDay: copyNumberRecord(value.eventLastTriggeredDay, eventIds, 0),
    eventHistory: Array.isArray(value.eventHistory) ? value.eventHistory.flatMap((item) => {
      if (!isRecord(item) || !finite(item.day) || !eventIds.has(String(item.eventId)) || typeof item.choiceId !== 'string'
        || !finite(item.moneyDelta) || !isRecord(item.statDeltas)) return []
      const statDeltas = copyNumberRecord(item.statDeltas, new Set(['reputation', 'energy', 'relationships']))
      return [{ day: Math.trunc(item.day), eventId: String(item.eventId), choiceId: item.choiceId, moneyDelta: item.moneyDelta, statDeltas }]
    }).slice(-120) : [],
    chainProgress: migrateChains(value.chainProgress, day, content),
    pendingEffects: [],
    modifiers: migrateModifiers(value.modifiers, content),
    decisionSummaries: Array.isArray(value.decisionSummaries) ? value.decisionSummaries.flatMap((item) => {
      if (!isRecord(item) || !finite(item.day) || !Array.isArray(item.productIds) || !finite(item.prepared)
        || !finite(item.averagePrice) || typeof item.closeEarly !== 'boolean') return []
      const ids = stringArray(item.productIds).filter((productId) => productIds.has(productId)).slice(0, 5)
      return [{
        day: Math.trunc(item.day), productIds: ids, prepared: item.prepared, averagePrice: item.averagePrice,
        operatingMode: item.closeEarly ? 'half' as const : 'full' as const,
      }]
    }).slice(-30) : [],
    unlockedEndingIds: stringArray(value.unlockedEndingIds).filter((endingId) => endingIds.has(endingId)),
    currentEndingId: typeof value.currentEndingId === 'string' && endingIds.has(value.currentEndingId) ? value.currentEndingId : undefined,
    pendingOpening: undefined,
    lastResolutionId: typeof value.lastResolutionId === 'string' ? value.lastResolutionId : undefined,
    negativeProfitStreak: finite(value.negativeProfitStreak) ? Math.max(0, Math.trunc(value.negativeProfitStreak)) : 0,
    pendingFollowUps: [],
  }
}

export function migrateV1Save(value: unknown, content: ShopContent): SaveMigrationResult {
  if (!isRecord(value) || value.schemaVersion !== 1 || typeof value.id !== 'string'
    || typeof value.contentVersion !== 'string' || typeof value.updatedAt !== 'string' || !isRecord(value.current)) {
    return { status: 'invalid', reason: 'V1 存档外壳无效' }
  }
  const hasPendingDay = value.current.pendingOpening !== undefined
  const source = hasPendingDay ? value.previousDay : value.current
  if (hasPendingDay && !isRecord(source)) {
    return { status: 'unrecoverable-pending', reason: '旧版营业日已部分结算且缺少安全快照' }
  }
  const current = migrateState(source, content)
  if (!current) {
    return hasPendingDay
      ? { status: 'unrecoverable-pending', reason: '旧版营业日的上一日快照不可恢复' }
      : { status: 'invalid', reason: 'V1 当前快照无效' }
  }
  if (hasPendingDay) current.page = 'morning'
  return {
    status: 'migrated',
    payload: {
      schemaVersion: 3,
      contentVersion: current.contentVersion,
      id: value.id,
      updatedAt: value.updatedAt,
      current,
      previousDay: undefined,
    },
  }
}
