import { describe, expect, it } from 'vitest'
import { shopContent } from '../content'
import type { DailyDecision, EventChoice, GameState } from '../domain/types'
import type { EventSelection } from './events'
import { createNewGame, simulateGame } from './simulator'

const content = shopContent.content
const minimumPrice = (base: number) => Math.ceil(base * .8)

const aggressiveDecision = (): DailyDecision => ({
  menu: [...content.drinks].sort((left, right) => right.unitCost - left.unitCost).filter((product) => product.initiallyUnlocked).slice(0, 5).map((product) => ({ productId: product.productId, prepare: 12, price: minimumPrice(product.basePrice) })),
  operatingMode: 'full',
  strategyId: 'aggressive-loss',
})

const conservativeDecision = (state: GameState): DailyDecision => {
  if (state.energy < 25) return { menu: [], operatingMode: 'rest', strategyId: 'cash-buffer-rest' }
  const overstock = state.money > 300
  return {
    menu: content.drinks.filter((product) => product.initiallyUnlocked).slice(0, overstock ? 5 : 3).map((product) => ({ productId: product.productId, prepare: overstock ? 12 : 1, price: product.basePrice })),
    operatingMode: 'full',
    strategyId: 'cash-buffer',
  }
}

const advantageousDecision = (state: GameState): DailyDecision => state.energy < 12
  ? { menu: [], operatingMode: 'rest', strategyId: 'efficient-premium-rest' }
  : {
      menu: content.drinks.filter((product) => state.unlockedProductIds.includes(product.productId)).sort((left, right) => left.complexity - right.complexity || left.unitCost - right.unitCost).slice(0, 3).map((product) => ({ productId: product.productId, prepare: 3, price: product.basePrice })),
      operatingMode: 'full',
      strategyId: 'efficient-premium',
    }

function choices(selection: EventSelection): EventChoice[] {
  if (selection.kind === 'event') return selection.event.choices
  if (selection.kind === 'chain') return selection.node.choices
  return []
}

function moneyValue(choice: EventChoice) {
  return choice.effects.reduce((sum, effect) => sum + (effect.type === 'money-delta' ? effect.value : 0), 0)
}

const chooseMinimumMoney = (_state: GameState, selection: EventSelection) => [...choices(selection)].sort((left, right) => moneyValue(left) - moneyValue(right))[0]?.choiceId
const chooseSteady = (_state: GameState, selection: EventSelection) => [...choices(selection)].sort((left, right) => Math.abs(moneyValue(left)) - Math.abs(moneyValue(right)))[0]?.choiceId
const balancedValue = (choice: EventChoice) => choice.effects.reduce((sum, effect) => {
  if (effect.type === 'money-delta') return sum + effect.value
  if (effect.type === 'stat-delta') return sum + effect.value * (effect.stat === 'reputation' ? 3 : 1)
  return sum
}, 0)
const chooseStrongBalanced = (_state: GameState, selection: EventSelection) => [...choices(selection)].sort((left, right) => balancedValue(right) - balancedValue(left))[0]?.choiceId

describe('three complete deterministic simulations', () => {
  it('covers an early bankruptcy route', () => {
    const run = simulateGame(createNewGame('simulation-collapse', 'save-collapse', content), aggressiveDecision, chooseMinimumMoney, content)
    expect(run.state.page).toBe('bankruptcy')
    expect(run.results.length).toBeLessThan(30)
    expect(run.state.currentEndingId).toBe('ending-closed-early')
  })

  it('covers a cash-buffer route that reaches day 100 without the rich threshold', () => {
    const run = simulateGame(createNewGame('simulation-survival', 'save-survival', content), conservativeDecision, chooseSteady, content)
    expect(run.results).toHaveLength(30)
    expect(run.state.page).toBe('finalEnding')
    expect(run.state.money).toBeGreaterThanOrEqual(0)
    expect(run.state.money).toBeLessThan(350)
  })

  it('covers a balanced reputation route without restoring the old cash windfall and reproduces its terminal snapshot', () => {
    const first = simulateGame(createNewGame('simulation-strong', 'save-strong', content), advantageousDecision, chooseStrongBalanced, content)
    const replay = simulateGame(createNewGame('simulation-strong', 'save-strong', content), advantageousDecision, chooseStrongBalanced, content)
    expect(first.results).toHaveLength(30)
    expect(first.state.page).toBe('finalEnding')
    expect(first.state.money).toBeGreaterThanOrEqual(120)
    expect(first.state.money).toBeLessThan(300)
    expect(first.state.reputation).toBeGreaterThanOrEqual(45)
    expect(first.state.relationships).toBeGreaterThanOrEqual(25)
    expect(first.state.currentEndingId).toBe('ending-hundred-days')
    expect(replay.state).toEqual(first.state)
  })
})
