import type { RngState } from './rng'

export type ShopStatKey = 'reputation' | 'energy' | 'relationships'
export type OperatingMode = 'full' | 'half' | 'rest'
export type ShelfClass = 'fresh' | 'brewed' | 'dry' | 'concentrate'
export type FinancialPhase = 'normal' | 'warning' | 'offer' | 'grace'
export type DemandLossReason = 'stockout' | 'menu-mismatch' | 'price' | 'service'
export type PageState =
  | 'landing'
  | 'newGame'
  | 'tutorial'
  | 'morning'
  | 'preparation'
  | 'opening'
  | 'event'
  | 'settlement'
  | 'financialCrisis'
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
  shelfClass: ShelfClass
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
  operatingDay: number
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
  operatingMode: OperatingMode
  strategyId: string
}

export interface PendingFollowUp {
  eventId: string
  earliestDay: number
}

export interface DemandFunnel {
  footTraffic: number
  buyers: number
  unserved: number
  conversionRate: number
  productDemand: Record<string, number>
}

export interface ForecastDemandGroup {
  segmentId: string
  expectedCustomers: number
  actualCustomers: number
}

export interface DayForecast {
  forecastId: string
  day: number
  operatingDay: number
  weatherId: string
  seasonId: string
  marketSignalId: string
  activeTags: string[]
  demandGroups: ForecastDemandGroup[]
}

export interface DemandLosses {
  stockout: number
  menuMismatch: number
  price: number
  service: number
}

export interface ProductDemandOutcome {
  productId: string
  directDemand: number
  directSold: number
  substituteSold: number
  prepared: number
  unsold: number
  stockoutLost: number
}

export interface DemandResolution {
  potentialBuyers: number
  servedCustomers: number
  losses: DemandLosses
  products: ProductDemandOutcome[]
}

export interface DemandBand {
  minimum: number
  maximum: number
  tendency: 'hot' | 'steady' | 'quiet'
}

export type BusinessBeatKind = 'direct-sale' | 'substitute' | 'stockout' | 'menu-mismatch' | 'price-left' | 'quiet'

export interface BusinessBeat {
  stage: 0 | 1 | 2 | 3
  kind: BusinessBeatKind
  count: number
  productId?: string
  alternativeProductId?: string
}

export type SettlementReason =
  | 'rested'
  | 'profitable'
  | 'loss'
  | 'price-high'
  | 'poor-fit'
  | 'low-energy'
  | 'stockout'
  | 'waste'

export type EventTiming = 'opening' | 'business' | 'closing'
export type EventActorRole = 'none' | 'worker' | 'merchant' | 'scholar' | 'youth' | 'elder' | 'neighbor-woman' | 'runner'
export type EventLocation = 'counter' | 'street' | 'kitchen' | 'market' | 'back-room'
export type ImpactAxis = 'money' | 'reputation' | 'energy' | 'relationships' | 'inventory' | 'future'
export type ImpactDirection = 'up' | 'down' | 'mixed' | 'uncertain'
export type ModifierTarget = 'visitor-count' | 'energy-cost' | 'fixed-cost' | 'sales-income' | 'waste-return' | 'product-demand'
export type ModifierOperation = 'add' | 'multiply'

export interface EventScene {
  timing: EventTiming
  location: EventLocation
  actorRole: EventActorRole
}

export interface ImpactHint {
  axis: ImpactAxis
  direction: ImpactDirection
  text: string
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
  | { type: 'weather-is'; weatherId: string }
  | { type: 'weather-in'; weatherIds: string[] }
  | { type: 'season-is'; seasonId: string }
  | { type: 'season-in'; seasonIds: string[] }
  | { type: 'all'; conditions: EventCondition[] }
  | { type: 'any'; conditions: EventCondition[] }
  | { type: 'not'; condition: EventCondition }

export interface ScheduledEffect {
  scheduledEffectId: string
  dueDay: number
  effects: EventEffect[]
  contractId?: string
  contractSceneTrigger?: ContractSceneTrigger
}

export type EventEffect =
  | { type: 'stat-delta'; stat: ShopStatKey; value: number; labelId: string }
  | { type: 'money-delta'; value: number; labelId: string }
  | { type: 'inventory-delta'; productId: string; value: number; labelId: string }
  | { type: 'add-flag'; flag: string }
  | { type: 'remove-flag'; flag: string }
  | { type: 'unlock-product'; productId: string }
  | { type: 'set-modifier'; modifierId: string; value: number; durationDays: number; target: ModifierTarget; operation: ModifierOperation; productId?: string; playerLabel: string }
  | { type: 'schedule-effect'; delayDays: number; effects: EventEffect[] }
  | { type: 'start-chain'; chainId: string }
  | { type: 'advance-chain'; chainId: string; nodeId: string }
  | { type: 'interrupt-chain'; chainId: string; reason: string }

export interface EventChoice {
  choiceId: string
  text: string
  impactHints: ImpactHint[]
  resultText: string
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
  scene: EventScene
  assetId: string
  provisional: boolean
  allowedOperatingModes?: OperatingMode[]
}

export type ChainStatus = 'inactive' | 'active' | 'completed' | 'interrupted'

export interface EventChainNodeVariant {
  variantId: string
  conditions: EventCondition[]
  title: string
  content: string
  choices: EventChoice[]
  scene?: EventScene
  assetId?: string
}

export interface EventChainNode {
  nodeId: string
  title: string
  content: string
  minDelayDays: number
  maxDelayDays: number
  choices: EventChoice[]
  scene: EventScene
  conditions: EventCondition[]
  interruptionText: string
  assetId: string
  variants?: EventChainNodeVariant[]
}

export type ResolvedEventChainNode = Omit<EventChainNode, 'variants'> & { variantId?: string }

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

export interface ChainInterruption {
  chainId: string
  nodeId: string
  chainStatus: 'interrupted'
  reasonId: string
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
  operatingMode: OperatingMode
}

export interface CampaignTotals {
  trackedOperatingDays: number
  totalSold: number
  profitDays: number
  lossDays: number
  breakEvenDays: number
  productSold: Record<string, number>
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
  directSold?: number
  substituteSold?: number
  sold: number
  stockoutLost?: number
  unsold: number
  price: number
}

export type ContractSceneTrigger = 'accepted' | 'first-installment' | 'second-installment' | 'target-success' | 'target-failure' | 'grace-success' | 'grace-failure'

export interface PendingContractScene {
  contractId: string
  trigger: ContractSceneTrigger
}

export interface ActiveCrisisContract {
  contractId: string
  acceptedDay: number
  graceEndsDay: number
  preorderProgress: number
}

export interface FinancialHealthState {
  phase: FinancialPhase
  rescueUsed: boolean
  activeContract?: ActiveCrisisContract
}

export interface EventResolution {
  eventId: string
  choiceId: string
  variantId?: string
  moneyDelta: number
  statDeltas: Partial<Record<ShopStatKey, number>>
  activatedModifierIds: string[]
  chainId?: string
  chainStatus?: ChainStatus
}

export interface DailyResult {
  day: number
  operatingDay: number
  weatherId: string
  visitors: number
  operatingMode?: OperatingMode
  footTraffic?: number
  buyers?: number
  unserved?: number
  conversionRate?: number
  energyDelta?: number
  demandResolution?: DemandResolution
  businessBeats?: BusinessBeat[]
  sales: ProductSale[]
  ledger: LedgerLine[]
  moneyDelta: number
  eventId?: string
  choiceId?: string
  eventResolution?: EventResolution
  chainInterruptions: ChainInterruption[]
  endingId?: string
  nextState: GameState
}

export interface ActiveModifier {
  modifierId: string
  target: ModifierTarget
  operation: ModifierOperation
  value: number
  expiresDay: number
  productId?: string
  playerLabel: string
  durationBasis?: 'calendar' | 'operating'
  remainingOperatingDays?: number
}

export interface PendingOpening {
  resolutionId: string
  dayContext: DayContext
  decision: DailyDecision
  visitors: number
  operatingMode?: OperatingMode
  footTraffic?: number
  buyers?: number
  unserved?: number
  conversionRate?: number
  energyDelta?: number
  demandResolution?: DemandResolution
  businessBeats?: BusinessBeat[]
  sales: ProductSale[]
  ledger: LedgerLine[]
  moneyDelta: number
  energyCost: number
  chainInterruptions: ChainInterruption[]
  eventId?: string
  selectionKind: 'none' | 'event' | 'chain'
  chainId?: string
  nodeId?: string
  variantId?: string
  rngState: RngState
}

export interface GameState extends ShopStats {
  schemaVersion: number
  contentVersion: string
  saveId: string
  seed: string
  rngState: RngState
  day: number
  operatingDay: number
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
  campaignTotals?: CampaignTotals
  unlockedEndingIds: string[]
  currentEndingId?: string
  pendingOpening?: PendingOpening
  lastResolutionId?: string
  negativeProfitStreak: number
  pendingFollowUps?: PendingFollowUp[]
  dayForecast?: DayForecast
  financialHealth?: FinancialHealthState
  pendingContractScene?: PendingContractScene
  lastDecision?: DailyDecision
}

export interface SavePayload {
  schemaVersion: number
  contentVersion: string
  id: string
  updatedAt: string
  current: GameState
  previousDay?: GameState
}
