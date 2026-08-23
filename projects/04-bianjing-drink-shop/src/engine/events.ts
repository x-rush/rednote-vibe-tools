import type { ShopContent } from '../content/schema'
import type { BusinessEvent, DayContext, EventChain, EventChainNode, GameState } from '../domain/types'
import type { RngState } from '../domain/rng'
import { nextRandom } from '../domain/rng'
import { conditionsMatch } from './conditions'
import { applyEffects } from './effects'

export type EventSelection =
  | { kind: 'none'; rngState: RngState }
  | { kind: 'event'; eventId: string; event: BusinessEvent; rngState: RngState }
  | { kind: 'chain'; chainId: string; nodeId: string; node: EventChainNode; rngState: RngState }

const startsChain = (eventId: string, chains: EventChain[]) =>
  chains.some((chain) => chain.startEventId === eventId)

export function eligibleEvents(
  state: GameState,
  context: DayContext,
  events: BusinessEvent[],
  chains: EventChain[],
): BusinessEvent[] {
  return events.filter((event) => {
    if (context.day < event.dayRange[0] || context.day > event.dayRange[1]) return false
    if (!conditionsMatch(event.conditions, state)) return false
    if (event.oncePerSave && state.triggeredEventIds.includes(event.eventId)) return false
    const lastDay = state.eventLastTriggeredDay[event.eventId]
    if (lastDay !== undefined && context.day - lastDay < event.cooldownDays) return false
    if (event.conflictTags.some((tag) => context.activeTags.includes(tag))) return false
    if (context.day > 90 && startsChain(event.eventId, chains)) return false
    const chain = chains.find((item) => item.startEventId === event.eventId)
    if (chain && state.chainProgress[chain.chainId] !== undefined) return false
    return true
  })
}

function nextChainNode(state: GameState, chains: EventChain[]) {
  const candidates = Object.values(state.chainProgress)
    .filter((progress) => progress.status === 'active')
    .sort((left, right) => left.startedDay - right.startedDay || left.chainId.localeCompare(right.chainId))

  for (const progress of candidates) {
    const chain = chains.find((item) => item.chainId === progress.chainId)
    if (!chain) continue
    const node = chain.nodes[progress.nodeIndex + 1]
    if (!node) continue
    const elapsed = state.day - progress.lastAdvancedDay
    if (elapsed >= node.minDelayDays && elapsed <= node.maxDelayDays) return { chain, node }
  }
  return undefined
}

export function selectDailyEvent(state: GameState, context: DayContext, content: ShopContent): EventSelection {
  const chainCandidate = nextChainNode(state, content.chains)
  if (chainCandidate) return {
    kind: 'chain',
    chainId: chainCandidate.chain.chainId,
    nodeId: chainCandidate.node.nodeId,
    node: chainCandidate.node,
    rngState: state.rngState,
  }

  const candidates = eligibleEvents(state, context, content.events, content.chains)
  if (candidates.length === 0) return { kind: 'none', rngState: state.rngState }
  const random = nextRandom(state.rngState)
  const total = candidates.reduce((sum, event) => sum + Math.max(0, event.weight), 0)
  if (total <= 0) return { kind: 'none', rngState: random.state }
  let target = random.value * total
  const selected = candidates.find((event) => {
    target -= Math.max(0, event.weight)
    return target < 0
  }) ?? candidates[candidates.length - 1]
  return { kind: 'event', eventId: selected.eventId, event: selected, rngState: random.state }
}

export function resolveChainChoice(state: GameState, chain: EventChain, nodeId: string, choiceId: string) {
  const node = chain.nodes.find((item) => item.nodeId === nodeId)
  if (!node) throw new Error(`未知连锁节点：${chain.chainId}/${nodeId}`)
  const choice = node.choices.find((item) => item.choiceId === choiceId)
  if (!choice) throw new Error(`未知连锁选择：${chain.chainId}/${nodeId}/${choiceId}`)
  return applyEffects(state, choice.effects, { day: state.day, sourceId: `${chain.chainId}:${nodeId}` })
}

export function interruptExpiredChains(initial: GameState, chains: EventChain[]): GameState {
  let state = initial
  for (const progress of Object.values(state.chainProgress)) {
    if (progress.status !== 'active') continue
    const chain = chains.find((item) => item.chainId === progress.chainId)
    if (!chain) continue
    const next = chain.nodes[progress.nodeIndex + 1]
    if (!next || state.day - progress.lastAdvancedDay <= next.maxDelayDays) continue
    state = applyEffects(state, [{ type: 'interrupt-chain', chainId: chain.chainId, reason: 'timeout' }], {
      day: state.day,
      sourceId: chain.chainId,
    }).state
  }
  return state
}
