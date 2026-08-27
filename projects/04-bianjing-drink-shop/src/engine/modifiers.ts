import type {
  GameState,
  ModifierTarget,
} from '../domain/types'

const matchingModifiers = (
  state: GameState,
  target: ModifierTarget,
  day: number,
  productId?: string,
) => state.modifiers
  .filter((modifier) => modifier.expiresDay >= day && modifier.target === target)
  .filter((modifier) => modifier.durationBasis !== 'operating' || (modifier.remainingOperatingDays ?? 0) > 0)
  .filter((modifier) => modifier.productId === undefined || modifier.productId === productId)

export function modifierAdd(state: GameState, target: ModifierTarget, day: number, productId?: string): number {
  return matchingModifiers(state, target, day, productId)
    .filter((modifier) => modifier.operation === 'add')
    .reduce((sum, modifier) => sum + modifier.value, 0)
}

export function modifierFactor(state: GameState, target: ModifierTarget, day: number, productId?: string): number {
  return matchingModifiers(state, target, day, productId)
    .filter((modifier) => modifier.operation === 'multiply')
    .reduce((factor, modifier) => factor * modifier.value, 1)
}
