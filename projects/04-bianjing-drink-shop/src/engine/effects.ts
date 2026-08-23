import type { EventEffect, GameState, LedgerLine, ShopStatKey } from '../domain/types'
import { clampStat } from '../domain/numbers'

export interface EffectContext { day: number; sourceId: string; ledgerKind?: LedgerLine['kind'] }
export interface EffectApplication {
  state: GameState
  ledger: LedgerLine[]
  statDeltas: Partial<Record<ShopStatKey, number>>
}

const unique = (values: string[]) => [...new Set(values)]

export function applyEffects(initial: GameState, effects: EventEffect[], context: EffectContext): EffectApplication {
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
      case 'set-modifier':
        state.modifiers = [
          ...state.modifiers.filter((item) => item.modifierId !== effect.modifierId),
          { modifierId: effect.modifierId, value: effect.value, expiresDay: context.day + effect.durationDays },
        ]
        break
      case 'schedule-effect':
        state.pendingEffects = [...state.pendingEffects, {
          scheduledEffectId: `${context.sourceId}-${context.day}-${index}`,
          dueDay: context.day + effect.delayDays,
          effects: effect.effects,
        }]
        break
      case 'advance-chain': {
        const current = state.chainProgress[effect.chainId]
        const completed = effect.nodeId === 'complete'
        state.chainProgress[effect.chainId] = {
          chainId: effect.chainId,
          status: completed ? 'completed' : 'active',
          nodeIndex: completed ? (current?.nodeIndex ?? -1) + 1 : (current?.nodeIndex ?? -2) + 1,
          startedDay: current?.startedDay ?? context.day,
          lastAdvancedDay: context.day,
          currentNodeId: effect.nodeId,
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

  return { state, ledger, statDeltas }
}
