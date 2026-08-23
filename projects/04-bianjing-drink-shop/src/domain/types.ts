import type { RngState } from './rng'

export type ShopStatKey = 'reputation' | 'energy' | 'relationships'
export type PageState =
  | 'landing'
  | 'newGame'
  | 'tutorial'
  | 'morning'
  | 'preparation'
  | 'opening'
  | 'event'
  | 'settlement'
  | 'milestone'
  | 'bankruptcy'
  | 'finalEnding'
  | 'continueGame'
  | 'error'

export interface Product {
  productId: string
  name: string
  flavor: string
  unitCost: number
  basePrice: number
  complexity: 1 | 2 | 3
  preferenceTags: string[]
  keepRate: number
  initiallyUnlocked: boolean
  assetId: string
}

export interface Ingredient {
  ingredientId: string
  name: string
  unitCost: number
  unit: string
  provisional: boolean
}

export interface Recipe {
  recipeId: string
  productId: string
  ingredients: { ingredientId: string; quantity: number }[]
}

export interface PriceSetting {
  productId: string
  price: number
}

export interface InventoryItem {
  productId: string
  quantity: number
}

export interface ShopStats {
  money: number
  reputation: number
  energy: number
  relationships: number
}

export interface DayContext {
  day: number
  weatherId: string
  seasonId: string
  eventVisitorDelta: number
  activeTags: string[]
}

export interface MenuDecision {
  productId: string
  prepare: number
  price: number
}

export interface DailyDecision {
  menu: MenuDecision[]
  closeEarly: boolean
  strategyId: string
}

export type EventCondition =
  | { type: 'day-range'; min: number; max: number }
  | { type: 'stat-at-least'; stat: ShopStatKey; value: number }
  | { type: 'stat-at-most'; stat: ShopStatKey; value: number }
  | { type: 'money-at-least'; value: number }
  | { type: 'money-at-most'; value: number }
  | { type: 'has-flag'; flag: string }
  | { type: 'lacks-flag'; flag: string }
  | { type: 'event-seen'; eventId: string }
  | { type: 'event-not-seen'; eventId: string }
  | { type: 'chain-status'; chainId: string; status: ChainStatus }
  | { type: 'completed-chain-count-at-least'; value: number }
  | { type: 'inventory-at-least'; productId: string; value: number }
  | { type: 'all'; conditions: EventCondition[] }
  | { type: 'any'; conditions: EventCondition[] }
  | { type: 'not'; condition: EventCondition }

export interface ScheduledEffect {
  scheduledEffectId: string
  dueDay: number
  effects: EventEffect[]
}

export type EventEffect =
  | { type: 'stat-delta'; stat: ShopStatKey; value: number; labelId: string }
  | { type: 'money-delta'; value: number; labelId: string }
  | { type: 'inventory-delta'; productId: string; value: number; labelId: string }
  | { type: 'add-flag'; flag: string }
  | { type: 'remove-flag'; flag: string }
  | { type: 'unlock-product'; productId: string }
  | { type: 'set-modifier'; modifierId: string; value: number; durationDays: number }
  | { type: 'schedule-effect'; delayDays: number; effects: EventEffect[] }
  | { type: 'advance-chain'; chainId: string; nodeId: string }
  | { type: 'interrupt-chain'; chainId: string; reason: string }

export interface EventChoice {
  choiceId: string
  text: string
  impactTags: string[]
  effects: EventEffect[]
  followUpEventIds: string[]
}

export interface BusinessEvent {
  eventId: string
  title: string
  content: string
  category: string
  weight: number
  dayRange: [number, number]
  conditions: EventCondition[]
  cooldownDays: number
  oncePerSave: boolean
  conflictTags: string[]
  tags: string[]
  choices: EventChoice[]
  assetId: string
  provisional: boolean
}

export type ChainStatus = 'inactive' | 'active' | 'completed' | 'interrupted'

export interface EventChainNode {
  nodeId: string
  title: string
  content: string
  minDelayDays: number
  maxDelayDays: number
  choices: EventChoice[]
  assetId: string
}

export interface EventChain {
  chainId: string
  title: string
  startEventId: string
  startChoiceId: string
  startDayMax: number
  nodes: EventChainNode[]
}

export interface Ending {
  endingId: string
  title: string
  conditions: EventCondition[]
  priority: number
  content: string
  evaluation: string
  shareText: string
  assetId: string
  immediate: boolean
  provisional: boolean
}

export interface ChainProgress {
  chainId: string
  status: ChainStatus
  nodeIndex: number
  startedDay: number
  lastAdvancedDay: number
  currentNodeId?: string
  reason?: string
}

export interface EventHistoryItem {
  day: number
  eventId: string
  choiceId: string
  moneyDelta: number
  statDeltas: Partial<Record<ShopStatKey, number>>
}

export interface DecisionSummary {
  day: number
  productIds: string[]
  prepared: number
  averagePrice: number
  closeEarly: boolean
}

export interface LedgerLine {
  kind: 'income' | 'stock-cost' | 'waste-return' | 'fixed-cost' | 'event' | 'scheduled'
  labelId: string
  amount: number
  entityId?: string
}

export interface ProductSale {
  productId: string
  prepared: number
  demand: number
  sold: number
  unsold: number
  price: number
}

export interface DailyResult {
  day: number
  weatherId: string
  visitors: number
  sales: ProductSale[]
  ledger: LedgerLine[]
  moneyDelta: number
  eventId?: string
  choiceId?: string
  endingId?: string
  nextState: GameState
}

export interface ActiveModifier {
  modifierId: string
  value: number
  expiresDay: number
}

export interface PendingOpening {
  resolutionId: string
  dayContext: DayContext
  decision: DailyDecision
  visitors: number
  sales: ProductSale[]
  ledger: LedgerLine[]
  eventId?: string
  selectionKind: 'none' | 'event' | 'chain'
  chainId?: string
  nodeId?: string
  rngState: RngState
}

export interface GameState extends ShopStats {
  schemaVersion: number
  contentVersion: string
  saveId: string
  seed: string
  rngState: RngState
  day: number
  page: PageState
  inventory: Record<string, number>
  prices: Record<string, number>
  unlockedProductIds: string[]
  flags: string[]
  triggeredEventIds: string[]
  eventLastTriggeredDay: Record<string, number>
  eventHistory: EventHistoryItem[]
  chainProgress: Record<string, ChainProgress>
  pendingEffects: ScheduledEffect[]
  modifiers: ActiveModifier[]
  decisionSummaries: DecisionSummary[]
  unlockedEndingIds: string[]
  currentEndingId?: string
  pendingOpening?: PendingOpening
  lastResolutionId?: string
  negativeProfitStreak: number
}

export interface SavePayload {
  schemaVersion: number
  contentVersion: string
  id: string
  updatedAt: string
  current: GameState
  previousDay?: GameState
}
