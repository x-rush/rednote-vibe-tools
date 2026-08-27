import type { CampaignDefinition, ShopContent } from '../content/schema'
import { shopContent } from '../content'
import type { BusinessEvent, ChainInterruption, DayContext, EventChain, EventChainNode, EventEffect, GameState, OperatingMode, ResolvedEventChainNode } from '../domain/types'
import type { RngState } from '../domain/rng'
import { nextRandom } from '../domain/rng'
import { conditionsMatch } from './conditions'
import { applyEffects } from './effects'
import { calendarDayAfterTurns, operatingDayForCalendarDay, remainingOperatingDays } from './campaign'

export type EventSelection =
  | { kind: 'none'; rngState: RngState }
  | { kind: 'event'; eventId: string; event: BusinessEvent; rngState: RngState }
  | { kind: 'chain'; chainId: string; nodeId: string; variantId?: string; node: ResolvedEventChainNode; rngState: RngState }

function effectTurnsRequired(effect: EventEffect, chains: EventChain[]): number {
  if (effect.type === 'schedule-effect') {
    return effect.delayDays + Math.max(0, ...effect.effects.map((nested) => effectTurnsRequired(nested, chains)))
  }
  if (effect.type !== 'start-chain') return 0
  const chain = chains.find((item) => item.chainId === effect.chainId)
  return chain?.nodes.reduce((turns, node) => turns + Math.max(1, node.minDelayDays), 0) ?? 0
}

function eventTurnsRequired(event: BusinessEvent, chains: EventChain[]): number {
  return Math.max(0, ...event.choices.map((choice) => Math.max(
    choice.followUpEventIds.length > 0 ? 2 : 0,
    ...choice.effects.map((effect) => effectTurnsRequired(effect, chains)),
  )))
}

export function resolveChainNodePresentation(
  node: EventChainNode,
  state: GameState,
  context?: DayContext,
  frozenVariantId?: string,
): ResolvedEventChainNode {
  const variants = node.variants ?? []
  const selected = frozenVariantId
    ? variants.find((variant) => variant.variantId === frozenVariantId)
    : (() => {
        const matching = variants.filter((variant) => conditionsMatch(variant.conditions, state, context))
        if (matching.length > 1) {
          throw new Error(`连锁节点分支条件重叠：${node.nodeId}/${matching.map((variant) => variant.variantId).join(',')}`)
        }
        return matching[0]
      })()
  if (frozenVariantId && !selected) throw new Error(`未知连锁节点分支：${node.nodeId}/${frozenVariantId}`)
  if (!selected) {
    const { variants: _variants, ...base } = node
    return base
  }
  const { variants: _variants, ...base } = node
  return {
    ...base,
    title: selected.title,
    content: selected.content,
    choices: selected.choices,
    scene: selected.scene ?? base.scene,
    assetId: selected.assetId ?? base.assetId,
    variantId: selected.variantId,
  }
}

export function eligibleEvents(
  state: GameState,
  context: DayContext,
  events: BusinessEvent[],
  chains: EventChain[],
  operatingMode: OperatingMode = 'full',
  campaign: CampaignDefinition = shopContent.content.balance.campaign,
): BusinessEvent[] {
  return events.filter((event) => {
    const allowedModes = event.allowedOperatingModes ?? ['full', 'half']
    if (!allowedModes.includes(operatingMode)) return false
    if (context.day < event.dayRange[0] || context.day > event.dayRange[1]) return false
    if (!conditionsMatch(event.conditions, state, context)) return false
    if (event.oncePerSave && state.triggeredEventIds.includes(event.eventId)) return false
    const lastDay = state.eventLastTriggeredDay[event.eventId]
    if (lastDay !== undefined
      && context.operatingDay - operatingDayForCalendarDay(lastDay, campaign) < event.cooldownDays) return false
    if (event.conflictTags.some((tag) => context.activeTags.includes(tag))) return false
    if (eventTurnsRequired(event, chains) > remainingOperatingDays(context.operatingDay, campaign)) return false
    const chain = chains.find((item) => item.startEventId === event.eventId)
    if (chain && context.day > chain.startDayMax) return false
    if (chain && state.chainProgress[chain.chainId] !== undefined) return false
    return true
  })
}

function nextChainNode(state: GameState, context: DayContext, chains: EventChain[]) {
  const candidates = Object.values(state.chainProgress)
    .filter((progress) => progress.status === 'active')
    .sort((left, right) => left.startedDay - right.startedDay || left.chainId.localeCompare(right.chainId))

  for (const progress of candidates) {
    const chain = chains.find((item) => item.chainId === progress.chainId)
    if (!chain) continue
    const node = chain.nodes[progress.nodeIndex + 1]
    if (!node) continue
    const elapsed = state.operatingDay - operatingDayForCalendarDay(progress.lastAdvancedDay, shopContent.content.balance.campaign)
    if (elapsed >= node.minDelayDays && elapsed <= node.maxDelayDays
      && conditionsMatch(node.conditions ?? [], state, context)) {
      return { chain, node: resolveChainNodePresentation(node, state, context) }
    }
  }
  return undefined
}

export function selectDailyEvent(state: GameState, context: DayContext, content: ShopContent, operatingMode: OperatingMode = 'full'): EventSelection {
  const chainCandidate = nextChainNode(state, context, content.chains)
  if (chainCandidate) return {
    kind: 'chain',
    chainId: chainCandidate.chain.chainId,
    nodeId: chainCandidate.node.nodeId,
    variantId: chainCandidate.node.variantId,
    node: chainCandidate.node,
    rngState: state.rngState,
  }

  const dueFollowUps = [...(state.pendingFollowUps ?? [])]
    .filter((pending) => pending.earliestDay <= state.day)
    .sort((left, right) => left.earliestDay - right.earliestDay || left.eventId.localeCompare(right.eventId))
    .map((pending) => content.events.find((event) => event.eventId === pending.eventId))
    .filter((event): event is BusinessEvent => event !== undefined)
  const eligibleFollowUps = eligibleEvents(state, context, dueFollowUps, content.chains, operatingMode, content.balance.campaign)
  if (eligibleFollowUps[0]) return {
    kind: 'event',
    eventId: eligibleFollowUps[0].eventId,
    event: eligibleFollowUps[0],
    rngState: state.rngState,
  }

  const ordinaryEventChance = content.balance.operatingModes[operatingMode].ordinaryEventChance
  if (ordinaryEventChance <= 0) return { kind: 'none', rngState: state.rngState }
  const chanceRoll = nextRandom(state.rngState)
  if (chanceRoll.value >= ordinaryEventChance) {
    return { kind: 'none', rngState: chanceRoll.state }
  }
  const candidates = eligibleEvents(state, context, content.events, content.chains, operatingMode, content.balance.campaign)
  if (candidates.length === 0) return { kind: 'none', rngState: chanceRoll.state }
  const random = nextRandom(chanceRoll.state)
  const total = candidates.reduce((sum, event) => sum + Math.max(0, event.weight), 0)
  if (total <= 0) return { kind: 'none', rngState: random.state }
  let target = random.value * total
  const selected = candidates.find((event) => {
    target -= Math.max(0, event.weight)
    return target < 0
  }) ?? candidates[candidates.length - 1]
  return { kind: 'event', eventId: selected.eventId, event: selected, rngState: random.state }
}

export function queueFollowUps(state: GameState, eventId: string, choiceId: string, content: ShopContent): GameState {
  const choice = content.events.find((event) => event.eventId === eventId)?.choices.find((item) => item.choiceId === choiceId)
  if (!choice || choice.followUpEventIds.length === 0) return state
  const queued = [...(state.pendingFollowUps ?? [])]
  for (const followUpEventId of choice.followUpEventIds) {
    if (queued.some((pending) => pending.eventId === followUpEventId)) continue
    queued.push({ eventId: followUpEventId, earliestDay: calendarDayAfterTurns(state.day, 2, content.balance.campaign) })
  }
  return { ...state, pendingFollowUps: queued.slice(-24) }
}

export function resolveChainChoice(
  state: GameState,
  chain: EventChain,
  nodeId: string,
  choiceId: string,
  context?: DayContext,
  frozenVariantId?: string,
) {
  const node = chain.nodes.find((item) => item.nodeId === nodeId)
  if (!node) throw new Error(`未知连锁节点：${chain.chainId}/${nodeId}`)
  const presentation = resolveChainNodePresentation(node, state, context, frozenVariantId)
  const choice = presentation.choices.find((item) => item.choiceId === choiceId)
  if (!choice) throw new Error(`未知连锁选择：${chain.chainId}/${nodeId}/${choiceId}`)
  return applyEffects(state, choice.effects, { day: state.day, operatingDay: state.operatingDay, sourceId: `${chain.chainId}:${nodeId}` })
}

export function interruptExpiredChains(initial: GameState, chains: EventChain[]): {
  state: GameState
  interruptions: ChainInterruption[]
} {
  let state = initial
  const interruptions: ChainInterruption[] = []
  for (const progress of Object.values(state.chainProgress)) {
    if (progress.status !== 'active') continue
    const chain = chains.find((item) => item.chainId === progress.chainId)
    if (!chain) continue
    const next = chain.nodes[progress.nodeIndex + 1]
    if (!next || state.operatingDay - operatingDayForCalendarDay(progress.lastAdvancedDay, shopContent.content.balance.campaign) <= next.maxDelayDays) continue
    state = applyEffects(state, [{ type: 'interrupt-chain', chainId: chain.chainId, reason: 'timeout' }], {
      day: state.day,
      operatingDay: state.operatingDay,
      sourceId: chain.chainId,
    }).state
    interruptions.push({
      chainId: chain.chainId,
      nodeId: next.nodeId,
      chainStatus: 'interrupted',
      reasonId: 'timeout',
    })
  }
  return { state, interruptions }
}
