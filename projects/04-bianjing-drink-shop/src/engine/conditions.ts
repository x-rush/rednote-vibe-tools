import type { DayContext, EventCondition, GameState } from '../domain/types'

export function evaluateCondition(condition: EventCondition, state: GameState, context?: DayContext): boolean {
  switch (condition.type) {
    case 'day-range': return state.day >= condition.min && state.day <= condition.max
    case 'stat-at-least': return state[condition.stat] >= condition.value
    case 'stat-at-most': return state[condition.stat] <= condition.value
    case 'money-at-least': return state.money >= condition.value
    case 'money-at-most': return state.money <= condition.value
    case 'has-flag': return state.flags.includes(condition.flag)
    case 'lacks-flag': return !state.flags.includes(condition.flag)
    case 'event-seen': return state.triggeredEventIds.includes(condition.eventId)
    case 'event-not-seen': return !state.triggeredEventIds.includes(condition.eventId)
    case 'chain-status': return (state.chainProgress[condition.chainId]?.status ?? 'inactive') === condition.status
    case 'completed-chain-count-at-least':
      return Object.values(state.chainProgress).filter((progress) => progress.status === 'completed').length >= condition.value
    case 'inventory-at-least': return (state.inventory[condition.productId] ?? 0) >= condition.value
    case 'weather-is': return context?.weatherId === condition.weatherId
    case 'weather-in': return context !== undefined && condition.weatherIds.includes(context.weatherId)
    case 'season-is': return context?.seasonId === condition.seasonId
    case 'season-in': return context !== undefined && condition.seasonIds.includes(context.seasonId)
    case 'all': return condition.conditions.every((item) => evaluateCondition(item, state, context))
    case 'any': return condition.conditions.some((item) => evaluateCondition(item, state, context))
    case 'not': return !evaluateCondition(condition.condition, state, context)
  }
}

export const conditionsMatch = (conditions: EventCondition[], state: GameState, context?: DayContext) =>
  conditions.every((condition) => evaluateCondition(condition, state, context))
