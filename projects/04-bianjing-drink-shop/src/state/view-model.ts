import type { ShopContent } from '../content/schema'
import type {
  DailyDecision,
  DailyResult,
  EventActorRole,
  EventLocation,
  EventScene,
  EventTiming,
  GameState,
  ImpactHint,
  LedgerLine,
  OperatingMode,
  SettlementReason,
  ShelfClass,
  ShopStatKey,
} from '../domain/types'
import { resolveChainNodePresentation } from '../engine/events'
import { deriveSettlementReason } from '../engine/settlement-insight'
import { estimateOpeningBudget } from '../engine/economy'
import { estimateProductDemandBands } from '../engine/demand'
import { availableCrisisContracts } from '../engine/financial-health'
import { campaignChapter } from '../engine/campaign'
import { buildEndingPosterModel, type EndingPosterModel } from './ending-poster'

export interface PresentationContext {
  decision?: DailyDecision
  result?: DailyResult
}

export interface LedgerView {
  kind: LedgerLine['kind']
  label: string
  amount: number
  entityId?: string
}

export interface EventSceneView extends EventScene {
  timingLabel: string
  locationLabel: string
  actorLabel: string
}

export interface EventView {
  id: string
  title: string
  content: string
  assetId: string
  category: string
  isChain: boolean
  scene: EventSceneView
  choices: { choiceId: string; text: string; impactHints: ImpactHint[] }[]
}

export interface EventResolutionView {
  eventId: string
  choiceId: string
  title: string
  choiceText: string
  resultText: string
  deltas: { id: 'money' | ShopStatKey; label: string; value: number }[]
  modifierDetails: { label: string; remainingDays: number; remainingText: string }[]
  chainTitle?: string
  chainStatusLabel?: string
}

export interface MorningIntelView {
  weatherName: string
  weatherEffect: string
  marketSignal: string
  seasonName: string
  yesterdayInsight: string
}

export interface ProductForecastView {
  productId: string
  minimum: number
  maximum: number
  tendency: 'hot' | 'steady' | 'quiet'
  tendencyLabel: string
  shelfClass: ShelfClass
  shelfLabel: string
}

export interface DemandBreakdownView {
  potentialBuyers: number
  servedCustomers: number
  losses: { id: 'stockout' | 'menuMismatch' | 'price' | 'service'; label: string; count: number }[]
  products: { productId: string; name: string; directSold: number; substituteSold: number; stockoutLost: number; unsold: number }[]
}

export interface BusinessBeatView {
  stage: 0 | 1 | 2 | 3
  kind: string
  count: number
  text: string
  productName?: string
  unit?: string
}

export interface FinancialCrisisView {
  title: string
  status: string
  phase: string
  rescueUsed: boolean
  graceDaysRemaining?: number
  pendingScene?: { title: string; content: string; assetId: string; actorRole: EventActorRole; actorLabel: string; trigger: string }
  contracts: { contractId: string; title: string; content: string; eligible: boolean; immediateBenefit: string; obligation: string }[]
}

export interface GameViewModel {
  title: string
  dayLabel: string
  calendarLabel: string
  chapterLabel: string
  stats: { id: string; label: string; value: number }[]
  products: {
    productId: string
    name: string
    basePrice: number
    unitCost: number
    complexity: number
    inventory: number
    assetPath: string
  }[]
  weather?: { id: string; name: string; effect: string }
  season?: { id: string; name: string }
  morningIntel?: MorningIntelView
  budget?: { stockCost: number; rentCost: number; operatingCost: number; cashAfterOpening: number; remainingMoney: number; preparedCount: number; selectedProducts: number; projectedMinimum: number; projectedMaximum: number; risk: 'safe' | 'possible-debt' | 'certain-debt'; riskLabel: string }
  productForecasts?: ProductForecastView[]
  demandBreakdown?: DemandBreakdownView
  businessBeats?: BusinessBeatView[]
  financialCrisis?: FinancialCrisisView
  ticker: { productId?: string; text: string }[]
  ledger: LedgerView[]
  event?: EventView
  eventResolution?: EventResolutionView
  chainInterruptions: { chainId: string; title: string; text: string; statusLabel: string }[]
  operatingModes: { id: OperatingMode; label: string; consequence: string; disabled: boolean }[]
  ayuanPreparation?: { name: string; role: string; mode: OperatingMode; text: string }
  settlementInsight?: { reason: SettlementReason; name: string; role: string; text: string }
  demandSummary?: { footTraffic: number; buyers: number; unserved: number; conversionRate: number }
  outcome?: { id: string; title: string; content: string; evaluation: string; shareText: string; poster: EndingPosterModel }
}

const defaultActor = (category: string): EventActorRole => {
  if (category === 'customer') return 'worker'
  if (category === 'neighborhood') return 'neighbor-woman'
  if (category === 'opportunity-growth') return 'merchant'
  return 'none'
}

const sceneView = (scene: EventScene, category: string, ui: Record<string, string>): EventSceneView => {
  const timing: EventTiming = scene.timing
  const location: EventLocation = scene.location
  const actorRole: EventActorRole = scene.actorRole ?? defaultActor(category)
  const timingLabels: Record<EventTiming, string> = { opening: ui.timingOpening, business: ui.timingBusiness, closing: ui.timingClosing }
  const locationLabels: Record<EventLocation, string> = {
    counter: ui.locationCounter,
    street: ui.locationStreet,
    kitchen: ui.locationKitchen,
    market: ui.locationMarket,
    'back-room': ui.locationBackRoom,
  }
  const actorLabels: Record<EventActorRole, string> = {
    none: ui.actorNone,
    worker: ui.actorWorker,
    merchant: ui.actorMerchant,
    scholar: ui.actorScholar,
    youth: ui.actorYouth,
    elder: ui.actorElder,
    'neighbor-woman': ui.actorNeighborWoman,
    runner: ui.actorRunner,
  }
  return {
    timing,
    location,
    actorRole,
    timingLabel: timingLabels[timing],
    locationLabel: locationLabels[location],
    actorLabel: actorLabels[actorRole],
  }
}

const contractObligation = (contract: ShopContent['crisisContracts'][number]) => {
  const obligation = contract.obligation
  if (obligation.type === 'operating-modifier') return `未来 ${obligation.operatingDays} 个营业日，每日多耗 ${obligation.value} 点体力`
  if (obligation.type === 'repayment') return obligation.installments
    .map((installment) => `第 ${installment.delayDays} 个经营日归还 ${Math.abs(installment.amount)} 文`).join('，')
  return `3 个经营日内交付 ${obligation.targetCount} 盏合约口味；完成再得 ${obligation.successMoney} 文与 ${obligation.successReputation} 点口碑，失约损失 ${Math.abs(obligation.failureReputation)} 点口碑`
}

function findResolvedChoice(result: NonNullable<DailyResult['eventResolution']>, content: ShopContent, state: GameState) {
  const event = content.events.find((item) => item.eventId === result.eventId)
  if (event) return { title: event.title, choice: event.choices.find((choice) => choice.choiceId === result.choiceId) }
  const chain = result.chainId ? content.chains.find((item) => item.chainId === result.chainId) : undefined
  const node = chain?.nodes.find((item) => `${chain.chainId}-${item.nodeId}` === result.eventId)
  const presentation = node ? resolveChainNodePresentation(node, state, undefined, result.variantId) : undefined
  return { title: presentation?.title ?? chain?.title ?? result.eventId, choice: presentation?.choices.find((choice) => choice.choiceId === result.choiceId) }
}

function ledgerLabel(line: LedgerLine, content: ShopContent, state: GameState, result?: DailyResult) {
  const product = line.entityId ? content.drinks.find((item) => item.productId === line.entityId) : undefined
  const suffix = product ? ` · ${product.name}` : ''
  switch (line.kind) {
    case 'income': return `${content.ui.ledgerSalesIncome}${suffix}`
    case 'stock-cost': return `${content.ui.ledgerStockCost}${suffix}`
    case 'waste-return': return `${content.ui.ledgerWasteReturn}${suffix}`
    case 'fixed-cost': return line.labelId === 'daily-rent' ? content.ui.ledgerRent
      : line.labelId === 'daily-operating-cost' ? content.ui.ledgerOperatingCost
        : content.ui.ledgerFixedCost
    case 'event': {
      if (!result?.eventResolution || line.entityId !== result.eventResolution.eventId) return content.ui.ledgerEvent
      const resolved = findResolvedChoice(result.eventResolution, content, state)
      return `${content.ui.ledgerEvent} · ${resolved.title} · ${resolved.choice?.text ?? result.eventResolution.choiceId}`
    }
    case 'scheduled': return content.ui.ledgerScheduled
  }
}

export function buildGameViewModel(state: GameState, content: ShopContent, context: PresentationContext = {}): GameViewModel {
  const opening = state.pendingOpening
  let event: GameViewModel['event']
  if (opening?.selectionKind === 'event') {
    const definition = content.events.find((item) => item.eventId === opening.eventId)
    if (definition) event = {
      id: definition.eventId,
      title: definition.title,
      content: definition.content,
      assetId: definition.assetId,
      category: definition.category,
      isChain: false,
      scene: sceneView(definition.scene, definition.category, content.ui),
      choices: definition.choices.map((choice) => ({
        choiceId: choice.choiceId,
        text: choice.text,
        impactHints: choice.impactHints,
      })),
    }
  } else if (opening?.selectionKind === 'chain') {
    const chain = content.chains.find((item) => item.chainId === opening.chainId)
    const node = chain?.nodes.find((item) => item.nodeId === opening.nodeId)
    const presentation = node ? resolveChainNodePresentation(node, state, opening.dayContext, opening.variantId) : undefined
    if (chain && presentation) event = {
      id: `${chain.chainId}-${presentation.nodeId}`,
      title: presentation.title,
      content: presentation.content,
      assetId: presentation.assetId,
      category: 'chain',
      isChain: true,
      scene: sceneView(presentation.scene, 'chain', content.ui),
      choices: presentation.choices.map((choice) => ({
        choiceId: choice.choiceId,
        text: choice.text,
        impactHints: choice.impactHints,
      })),
    }
  }

  const forecast = state.dayForecast
  const weatherId = opening?.dayContext.weatherId ?? context.result?.weatherId ?? forecast?.weatherId
  const weatherDefinition = weatherId ? content.weather.find((item) => item.weatherId === weatherId) : undefined
  const seasonId = opening?.dayContext.seasonId ?? forecast?.seasonId
  const seasonDefinition = seasonId ? content.seasons.find((item) => item.seasonId === seasonId) : undefined
  const signalDefinition = forecast ? content.marketSignals.find((item) => item.signalId === forecast.marketSignalId) : undefined
  const budgetEstimate = context.decision && forecast ? estimateOpeningBudget(state, context.decision, forecast, content) : undefined
  const unlockedProducts = content.drinks.filter((product) => state.unlockedProductIds.includes(product.productId))
  const demandBands = context.decision && forecast ? Object.fromEntries(unlockedProducts.map((product) => {
    const selected = context.decision?.menu.some((item) => item.productId === product.productId)
    const candidateDecision: DailyDecision = selected ? context.decision! : {
      ...context.decision!,
      menu: [...context.decision!.menu, { productId: product.productId, prepare: 0, price: product.basePrice }],
    }
    return [product.productId, estimateProductDemandBands(state, forecast, candidateDecision, content)[product.productId]]
  })) : undefined
  const playbackSales = opening?.sales ?? context.result?.sales
  const ticker = playbackSales?.filter((sale) => sale.sold > 0).map((sale) => {
    const product = content.drinks.find((item) => item.productId === sale.productId)
    return {
      productId: sale.productId,
      text: `${product?.name ?? sale.productId}${content.ui.tickerSold} ${sale.sold} ${content.ui.tickerUnit} · ${content.ui.tickerRemaining} ${sale.unsold} ${content.ui.tickerUnit}`,
    }
  }) ?? []
  const ending = state.currentEndingId ? content.endings.find((item) => item.endingId === state.currentEndingId) : undefined
  const resolution = context.result?.eventResolution
  const resolved = resolution ? findResolvedChoice(resolution, content, state) : undefined
  const statLabels: Record<ShopStatKey, string> = {
    reputation: content.ui.reputation,
    energy: content.ui.energy,
    relationships: content.ui.relationships,
  }
  const eventResolution: EventResolutionView | undefined = resolution && resolved ? {
    eventId: resolution.eventId,
    choiceId: resolution.choiceId,
    title: resolved.title,
    choiceText: resolved.choice?.text ?? resolution.choiceId,
    resultText: resolved.choice?.resultText ?? content.ui.eventResultRecorded,
    deltas: [
      ...(resolution.moneyDelta === 0 ? [] : [{ id: 'money' as const, label: content.ui.money, value: resolution.moneyDelta }]),
      ...Object.entries(resolution.statDeltas).map(([id, value]) => ({
        id: id as ShopStatKey,
        label: statLabels[id as ShopStatKey],
        value: value ?? 0,
      })),
    ],
    modifierDetails: resolution.activatedModifierIds.map((modifierId) => {
      const active = state.modifiers.find((modifier) => modifier.modifierId === modifierId)
      const effect = resolved.choice?.effects.find((candidate) => candidate.type === 'set-modifier' && candidate.modifierId === modifierId)
      const label = active?.playerLabel ?? (effect?.type === 'set-modifier' ? effect.playerLabel : undefined) ?? modifierId
      const resolvedDay = context.result?.day ?? state.day
      const remainingDays = active?.durationBasis === 'operating'
        ? Math.max(0, active.remainingOperatingDays ?? 0)
        : Math.max(0, (active?.expiresDay ?? resolvedDay) - resolvedDay)
      return { label, remainingDays, remainingText: `${content.ui.modifierRemainingDays} ${remainingDays} ${content.ui.dayUnit}` }
    }),
    chainTitle: resolution.chainId ? content.chains.find((chain) => chain.chainId === resolution.chainId)?.title : undefined,
    chainStatusLabel: resolution.chainStatus ? ({
      active: content.ui.chainStatusActive,
      completed: content.ui.chainStatusCompleted,
      interrupted: content.ui.chainStatusInterrupted,
      inactive: content.ui.chainStatusInactive,
    })[resolution.chainStatus] : undefined,
  } : undefined
  const chainInterruptions = (context.result?.chainInterruptions ?? []).map((interruption) => {
    const chain = content.chains.find((item) => item.chainId === interruption.chainId)
    const node = chain?.nodes.find((item) => item.nodeId === interruption.nodeId)
    return {
      chainId: interruption.chainId,
      title: chain?.title ?? interruption.chainId,
      text: node?.interruptionText ?? content.ui.chainStatusInterrupted,
      statusLabel: content.ui.chainStatusInterrupted,
    }
  })
  const operatingMode: OperatingMode = context.decision?.operatingMode ?? 'full'
  const preparationCopy: Record<OperatingMode, string> = {
    full: content.ui.ayuanPreparationFull,
    half: content.ui.ayuanPreparationHalf,
    rest: state.energy === 0 ? content.ui.ayuanPreparationEnergyEmpty : content.ui.ayuanPreparationRest,
  }
  const settlementReason = context.result ? deriveSettlementReason(context.result, content.drinks) : undefined
  const settlementCopy: Record<SettlementReason, string> = {
    rested: content.ui.ayuanSettlementRested,
    profitable: content.ui.ayuanSettlementProfitable,
    loss: content.ui.ayuanSettlementLoss,
    'price-high': content.ui.ayuanSettlementPriceHigh,
    'poor-fit': content.ui.ayuanSettlementPoorFit,
    'low-energy': content.ui.ayuanSettlementLowEnergy,
    stockout: content.ui.ayuanSettlementStockout,
    waste: content.ui.ayuanSettlementWaste,
  }
  const shelfLabels: Record<ShelfClass, string> = {
    fresh: content.ui.shelfFresh,
    brewed: content.ui.shelfBrewed,
    dry: content.ui.shelfDry,
    concentrate: content.ui.shelfConcentrate,
  }
  const tendencyLabels = { hot: content.ui.tendencyHot, steady: content.ui.tendencySteady, quiet: content.ui.tendencyQuiet }
  const demand = opening?.demandResolution ?? context.result?.demandResolution
  const beats = opening?.businessBeats ?? context.result?.businessBeats
  const beatCopy = {
    'direct-sale': content.ui.beatDirectSale,
    substitute: content.ui.beatSubstitute,
    stockout: content.ui.beatStockout,
    'menu-mismatch': content.ui.beatMenuMismatch,
    'price-left': content.ui.beatPriceLeft,
    quiet: content.ui.beatQuiet,
  }
  const eligibleContracts = new Set(availableCrisisContracts(state, content).map((contract) => contract.contractId))
  const pendingContract = state.pendingContractScene
    ? content.crisisContracts.find((contract) => contract.contractId === state.pendingContractScene?.contractId)
    : undefined
  const pendingScene = pendingContract?.scenes.find((scene) => scene.trigger === state.pendingContractScene?.trigger)
  const actorLabels: Record<EventActorRole, string> = {
    none: content.ui.actorNone, worker: content.ui.actorWorker, merchant: content.ui.actorMerchant,
    scholar: content.ui.actorScholar, youth: content.ui.actorYouth, elder: content.ui.actorElder,
    'neighbor-woman': content.ui.actorNeighborWoman, runner: content.ui.actorRunner,
  }

  const operatingDay = context.result?.operatingDay ?? state.operatingDay
  const calendarDay = context.result?.day ?? state.day
  const chapter = campaignChapter(operatingDay, content.balance.campaign)

  return {
    title: content.ui.landingTitle,
    dayLabel: `${content.ui.operatingDayLabel} ${operatingDay}/${content.balance.campaign.operatingDays.length}`,
    calendarLabel: `${content.ui.calendarDayLabel} · 第 ${calendarDay} 日`,
    chapterLabel: chapter?.title ?? '',
    stats: [
      { id: 'money', label: content.ui.money, value: state.money },
      { id: 'reputation', label: content.ui.reputation, value: state.reputation },
      { id: 'energy', label: content.ui.energy, value: state.energy },
      { id: 'relationships', label: content.ui.relationships, value: state.relationships },
    ],
    products: unlockedProducts.map((product) => ({
      productId: product.productId,
      name: product.name,
      basePrice: product.basePrice,
      unitCost: product.unitCost,
      complexity: product.complexity,
      inventory: state.inventory[product.productId] ?? 0,
      assetPath: `./assets/drinks/${product.productId}.webp`,
    })),
    weather: weatherDefinition ? { id: weatherDefinition.weatherId, name: weatherDefinition.name, effect: weatherDefinition.operatingEffect } : undefined,
    season: seasonDefinition ? { id: seasonDefinition.seasonId, name: seasonDefinition.name } : undefined,
    morningIntel: forecast && weatherDefinition && seasonDefinition && signalDefinition ? {
      weatherName: weatherDefinition.name,
      weatherEffect: weatherDefinition.operatingEffect,
      marketSignal: signalDefinition.text,
      seasonName: seasonDefinition.name,
      yesterdayInsight: state.lastDecision
        ? `${content.ui.yesterdayInsightLabel}：上架 ${state.lastDecision.menu.length} 种、共备 ${state.lastDecision.menu.reduce((sum, item) => sum + item.prepare, 0)} 盏。`
        : content.ui.yesterdayFirstDay,
    } : undefined,
    budget: context.decision && budgetEstimate ? {
      ...budgetEstimate,
      remainingMoney: budgetEstimate.cashAfterOpening,
      preparedCount: context.decision.menu.reduce((sum, item) => sum + item.prepare, 0),
      selectedProducts: context.decision.menu.length,
      riskLabel: ({ safe: content.ui.riskSafe, 'possible-debt': content.ui.riskPossibleDebt, 'certain-debt': content.ui.riskCertainDebt })[budgetEstimate.risk],
    } : undefined,
    productForecasts: demandBands ? unlockedProducts.map((product) => ({
      productId: product.productId,
      ...(demandBands[product.productId] ?? { minimum: 0, maximum: 0, tendency: 'quiet' as const }),
      tendencyLabel: tendencyLabels[demandBands[product.productId]?.tendency ?? 'quiet'],
      shelfClass: product.shelfClass,
      shelfLabel: shelfLabels[product.shelfClass],
    })) : undefined,
    demandBreakdown: demand ? {
      potentialBuyers: demand.potentialBuyers,
      servedCustomers: demand.servedCustomers,
      losses: [
        { id: 'menuMismatch', label: content.ui.lossMenuMismatch, count: demand.losses.menuMismatch },
        { id: 'price', label: content.ui.lossPrice, count: demand.losses.price },
        { id: 'service', label: content.ui.lossService, count: demand.losses.service },
        { id: 'stockout', label: content.ui.lossStockout, count: demand.losses.stockout },
      ],
      products: demand.products.map((item) => ({
        productId: item.productId,
        name: content.drinks.find((product) => product.productId === item.productId)?.name ?? item.productId,
        directSold: item.directSold,
        substituteSold: item.substituteSold,
        stockoutLost: item.stockoutLost,
        unsold: item.unsold,
      })),
    } : undefined,
    businessBeats: beats?.map((beat) => ({
      stage: beat.stage,
      kind: beat.kind,
      count: beat.count,
      text: beatCopy[beat.kind],
      unit: beat.kind === 'direct-sale' || beat.kind === 'substitute' ? content.ui.tickerUnit : content.ui.personUnit,
      productName: beat.productId || beat.alternativeProductId
        ? content.drinks.find((product) => product.productId === (beat.productId ?? beat.alternativeProductId))?.name
        : undefined,
    })),
    financialCrisis: state.page === 'financialCrisis' || state.pendingContractScene || state.financialHealth?.phase === 'offer' || state.financialHealth?.phase === 'grace' ? {
      title: content.ui.crisisTitle,
      status: content.ui.crisisStatus,
      phase: state.financialHealth?.phase ?? 'offer',
      rescueUsed: state.financialHealth?.rescueUsed ?? false,
      graceDaysRemaining: state.financialHealth?.activeContract
        ? Math.max(0, state.financialHealth.activeContract.graceEndsDay - state.day)
        : undefined,
      pendingScene: pendingScene && state.pendingContractScene ? {
        title: pendingScene.title,
        content: pendingScene.content,
        assetId: pendingScene.assetId,
        actorRole: pendingScene.actorRole,
        actorLabel: actorLabels[pendingScene.actorRole],
        trigger: state.pendingContractScene.trigger,
      } : undefined,
      contracts: content.crisisContracts.map((contract) => ({
        contractId: contract.contractId,
        title: contract.title,
        content: contract.content,
        eligible: eligibleContracts.has(contract.contractId),
        immediateBenefit: `+${contract.immediateMoney} ${content.ui.moneyUnit}`,
        obligation: contractObligation(contract),
      })),
    } : undefined,
    ticker: ticker.length > 0 ? ticker : (opening || context.result) ? [{ text: content.ui.tickerQuiet }] : [],
    ledger: context.result?.ledger.map((line) => ({ ...line, label: ledgerLabel(line, content, state, context.result) })) ?? [],
    event,
    eventResolution,
    chainInterruptions,
    operatingModes: [
      { id: 'full', label: content.ui.operatingModeFull, consequence: content.ui.operatingModeFullConsequence, disabled: state.energy === 0 },
      { id: 'half', label: content.ui.operatingModeHalf, consequence: content.ui.operatingModeHalfConsequence, disabled: state.energy === 0 },
      { id: 'rest', label: content.ui.operatingModeRest, consequence: content.ui.operatingModeRestConsequence, disabled: false },
    ],
    ayuanPreparation: context.decision ? {
      name: content.ui.guideName,
      role: content.ui.guideRole,
      mode: operatingMode,
      text: preparationCopy[operatingMode],
    } : undefined,
    settlementInsight: settlementReason ? {
      reason: settlementReason,
      name: content.ui.guideName,
      role: content.ui.guideRole,
      text: settlementCopy[settlementReason],
    } : undefined,
    demandSummary: context.result ? {
      footTraffic: context.result.footTraffic ?? context.result.visitors,
      buyers: context.result.buyers ?? context.result.sales.reduce((sum, sale) => sum + sale.demand, 0),
      unserved: context.result.unserved ?? 0,
      conversionRate: context.result.conversionRate ?? 0,
    } : undefined,
    outcome: ending ? {
      id: ending.endingId,
      title: ending.title,
      content: ending.content,
      evaluation: ending.evaluation,
      shareText: ending.shareText,
      poster: buildEndingPosterModel(state, content)!,
    } : undefined,
  }
}
