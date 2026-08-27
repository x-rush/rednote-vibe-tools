import type { EventEffect, GameState, LedgerLine, OperatingMode, ShopStatKey } from '../domain/types'
import type { CampaignDefinition } from '../content/schema'
import { shopContent } from '../content'
import { clampStat } from '../domain/numbers'
import { calendarDayAfterTurns } from './campaign'

export interface EffectContext {
  day: number
  operatingDay?: number
  sourceId: string
  ledgerKind?: LedgerLine['kind']
  campaign?: CampaignDefinition
}
export interface EffectApplication {
  state: GameState
  ledger: LedgerLine[]
  statDeltas: Partial<Record<ShopStatKey, number>>
  activatedModifierIds: string[]
}

const unique = (values: string[]) => [...new Set(values)]

export function advanceOperatingModifiers(state: GameState, operatingMode: OperatingMode): GameState {
  if (operatingMode === 'rest') return state
  const modifiers = state.modifiers.flatMap((modifier) => {
    if (modifier.durationBasis !== 'operating') return [modifier]
    const remainingOperatingDays = Math.max(0, (modifier.remainingOperatingDays ?? 0) - 1)
    return remainingOperatingDays === 0 ? [] : [{ ...modifier, remainingOperatingDays }]
  })
  return { ...state, modifiers }
}

export function applyEffects(initial: GameState, effects: EventEffect[], context: EffectContext): EffectApplication {
  const campaign = context.campaign ?? shopContent.content.balance.campaign
  let state: GameState = {
    ...initial,
    inventory: { ...initial.inventory },
    flags: [...initial.flags],
    unlockedProductIds: [...initial.unlockedProductIds],
    modifiers: [...initial.modifiers],
    pendingEffects: [...initial.pendingEffects],
    chainProgress: { ...initial.chainProgress },
  }
  const ledger: LedgerLine[] = []
  const statDeltas: Partial<Record<ShopStatKey, number>> = {}
  const activatedModifierIds: string[] = []

  effects.forEach((effect, index) => {
    switch (effect.type) {
      case 'money-delta':
        state = { ...state, money: state.money + effect.value }
        ledger.push({ kind: context.ledgerKind ?? 'event', labelId: effect.labelId, amount: effect.value, entityId: context.sourceId })
        break
      case 'stat-delta': {
        const before = state[effect.stat]
        const after = clampStat(before + effect.value)
        state = { ...state, [effect.stat]: after }
        statDeltas[effect.stat] = (statDeltas[effect.stat] ?? 0) + after - before
        break
      }
      case 'inventory-delta':
        state.inventory[effect.productId] = Math.max(0, (state.inventory[effect.productId] ?? 0) + effect.value)
        break
      case 'add-flag':
        state.flags = unique([...state.flags, effect.flag])
        break
      case 'remove-flag':
        state.flags = state.flags.filter((flag) => flag !== effect.flag)
        break
      case 'unlock-product':
        state.unlockedProductIds = unique([...state.unlockedProductIds, effect.productId])
        break
      case 'set-modifier': {
        state.modifiers = [
          ...state.modifiers.filter((item) => item.modifierId !== effect.modifierId),
          {
            modifierId: effect.modifierId,
            target: effect.target,
            operation: effect.operation,
            value: effect.value,
            expiresDay: campaign.totalCalendarDays,
            productId: effect.productId,
            playerLabel: effect.playerLabel,
            durationBasis: 'operating',
            remainingOperatingDays: effect.durationDays,
          },
        ]
        activatedModifierIds.push(effect.modifierId)
        break
      }
      case 'schedule-effect':
        state.pendingEffects = [...state.pendingEffects, {
          scheduledEffectId: `${context.sourceId}-${context.day}-${index}`,
          dueDay: calendarDayAfterTurns(context.day, effect.delayDays, campaign),
          effects: effect.effects,
        }]
        break
      case 'start-chain':
        state.chainProgress[effect.chainId] = {
          chainId: effect.chainId,
          status: 'active',
          nodeIndex: -1,
          startedDay: context.day,
          lastAdvancedDay: context.day,
        }
        break
      case 'advance-chain': {
        const current = state.chainProgress[effect.chainId]
        if (!current || current.status !== 'active') throw new Error(`连锁尚未开始：${effect.chainId}`)
        const completed = effect.nodeId === 'complete'
        state.chainProgress[effect.chainId] = {
          chainId: effect.chainId,
          status: completed ? 'completed' : 'active',
          nodeIndex: current.nodeIndex + 1,
          startedDay: current.startedDay,
          lastAdvancedDay: context.day,
          currentNodeId: completed ? current.currentNodeId : effect.nodeId,
        }
        if (completed) state.flags = unique([...state.flags, `${effect.chainId}-completed`])
        break
      }
      case 'interrupt-chain': {
        const current = state.chainProgress[effect.chainId]
        state.chainProgress[effect.chainId] = {
          chainId: effect.chainId,
          status: 'interrupted',
          nodeIndex: current?.nodeIndex ?? 0,
          startedDay: current?.startedDay ?? context.day,
          lastAdvancedDay: context.day,
          currentNodeId: current?.currentNodeId,
          reason: effect.reason,
        }
        break
      }
    }
  })

  return { state, ledger, statDeltas, activatedModifierIds }
}
