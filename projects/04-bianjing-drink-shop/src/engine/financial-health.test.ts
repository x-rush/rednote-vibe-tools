import { describe, expect, it } from 'vitest'
import { shopContent } from '../content'
import type { DailyResult, ProductSale } from '../domain/types'
import { makeState } from '../tests/fixtures'
import {
  acceptCrisisContract,
  acknowledgeCrisisScene,
  advanceCrisisDay,
  assessFinancialHealth,
  availableCrisisContracts,
  queueContractScene,
  recordContractSales,
  requiredFinancialPage,
} from './financial-health'

const content = shopContent.content

describe('one-time financial recovery', () => {
  it('acknowledges crisis scenes without skipping preorder failure or the final closure scene', () => {
    const accepted = makeState({ page: 'financialCrisis', pendingContractScene: { contractId: 'crisis-pawn', trigger: 'accepted' } })
    expect(acknowledgeCrisisScene(accepted).page).toBe('morning')
    expect(acknowledgeCrisisScene(accepted).pendingContractScene).toBeUndefined()

    const targetFailure = makeState({
      page: 'financialCrisis', flags: ['financial-crisis-close'],
      pendingContractScene: { contractId: 'crisis-preorder', trigger: 'target-failure' },
    })
    expect(acknowledgeCrisisScene(targetFailure)).toMatchObject({
      page: 'financialCrisis', pendingContractScene: { contractId: 'crisis-preorder', trigger: 'grace-failure' },
    })
    expect(acknowledgeCrisisScene({ ...targetFailure, pendingContractScene: { contractId: 'crisis-preorder', trigger: 'grace-failure' } })).toMatchObject({
      page: 'bankruptcy', currentEndingId: 'ending-closed-early', pendingContractScene: undefined,
    })
  })
  it('assesses exact normal, warning, offer, debt-floor, and post-rescue states', () => {
    expect(assessFinancialHealth(makeState({ money: 16 }), content)).toBe('normal')
    expect(assessFinancialHealth(makeState({ money: 15 }), content)).toBe('warning')
    expect(assessFinancialHealth(makeState({ money: -1 }), content)).toBe('offer')
    expect(requiredFinancialPage(makeState({ money: -1 }), content)).toBe('financialCrisis')
    expect(assessFinancialHealth(makeState({ money: -21 }), content)).toBe('offer')
    expect(assessFinancialHealth(makeState({ money: -1, financialHealth: { phase: 'normal', rescueUsed: true } }), content)).toBe('bankruptcy')
    expect(requiredFinancialPage(makeState({
      pendingContractScene: { contractId: 'crisis-credit', trigger: 'first-installment' },
    }), content)).toBe('financialCrisis')
  })

  it('exposes only contracts whose relationship or reputation requirements are met', () => {
    expect(availableCrisisContracts(makeState({ relationships: 34, reputation: 34 }), content).map((item) => item.contractId)).toEqual(['crisis-pawn'])
    expect(availableCrisisContracts(makeState({ relationships: 35, reputation: 34 }), content).map((item) => item.contractId)).toEqual(['crisis-pawn', 'crisis-credit'])
    expect(availableCrisisContracts(makeState({ relationships: 34, reputation: 35 }), content).map((item) => item.contractId)).toEqual(['crisis-pawn', 'crisis-preorder'])
  })

  it('accepts pawn once and installs seven operating days of extra effort', () => {
    const accepted = acceptCrisisContract(makeState({ operatingDay: 4, day: 10, money: -1 }), 'crisis-pawn', content)
    expect(accepted.state).toMatchObject({
      money: 27,
      financialHealth: { phase: 'grace', rescueUsed: true, activeContract: { contractId: 'crisis-pawn', acceptedDay: 10, graceEndsDay: 22 } },
      pendingContractScene: { contractId: 'crisis-pawn', trigger: 'accepted' },
    })
    expect(accepted.state.modifiers).toContainEqual(expect.objectContaining({
      target: 'energy-cost', value: 2, durationBasis: 'operating', remainingOperatingDays: 7,
    }))
    expect(accepted.ledger.reduce((sum, line) => sum + line.amount, 0)).toBe(28)
    expect(() => acceptCrisisContract(accepted.state, 'crisis-pawn', content)).toThrow('周转机会已经使用')
  })

  it('sets the latest valid rescue deadline exactly on the final playable turn', () => {
    const accepted = acceptCrisisContract(makeState({ operatingDay: 27, day: 94, money: -1 }), 'crisis-pawn', content).state

    expect(accepted.financialHealth?.activeContract?.graceEndsDay).toBe(100)
    const failed = advanceCrisisDay({ ...accepted, operatingDay: 30, day: 100, money: -1, pendingContractScene: undefined }, content)
    expect(failed.shouldClose).toBe(true)
    expect(failed.state.pendingContractScene?.trigger).toBe('grace-failure')
  })

  it('does not offer a three-turn rescue when fewer than three playable turns remain', () => {
    expect(assessFinancialHealth(makeState({ operatingDay: 28, day: 96, money: -1 }), content)).toBe('bankruptcy')
    expect(availableCrisisContracts(makeState({ operatingDay: 28, day: 96, money: -1 }), content)).toEqual([])
  })

  it('schedules both credit installments with stable scene triggers', () => {
    const accepted = acceptCrisisContract(makeState({ day: 10, money: -1, relationships: 35 }), 'crisis-credit', content)
    expect(accepted.state.money).toBe(21)
    expect(accepted.state.pendingEffects).toEqual(expect.arrayContaining([
      expect.objectContaining({ dueDay: 26, contractId: 'crisis-credit', contractSceneTrigger: 'first-installment' }),
      expect.objectContaining({ dueDay: 38, contractId: 'crisis-credit', contractSceneTrigger: 'second-installment' }),
    ]))
  })

  it('counts only qualifying preorder sales and awards the configured completion', () => {
    const accepted = acceptCrisisContract(makeState({ day: 10, money: -1, reputation: 35 }), 'crisis-preorder', content).state
    const sale = (productId: string, sold: number): ProductSale => ({ productId, prepared: sold, demand: sold, directSold: sold, substituteSold: 0, sold, stockoutLost: 0, unsold: 0, price: 8 })
    const result = (sales: ProductSale[]): DailyResult => ({
      day: 14, operatingDay: 5, weatherId: 'weather-clear', visitors: 10, sales, ledger: [], moneyDelta: 0, chainInterruptions: [], nextState: accepted,
    })
    const partial = recordContractSales(accepted, result([sale('drink-green-plum', 7), sale('drink-signature', 4)]), content)
    expect(partial.financialHealth?.activeContract?.preorderProgress).toBe(7)
    const completed = recordContractSales(partial, result([sale('drink-ginger-honey', 5)]), content)
    expect(completed.money).toBe(31)
    expect(completed.reputation).toBe(39)
    expect(completed.pendingContractScene).toEqual({ contractId: 'crisis-preorder', trigger: 'target-success' })
  })

  it('uses playable-turn grace, succeeds at zero, fails below zero, and closes below the hard floor early', () => {
    const active = acceptCrisisContract(makeState({ day: 10, money: -1 }), 'crisis-pawn', content).state
    expect(advanceCrisisDay({ ...active, operatingDay: 6, day: 18, money: -1 }, content).shouldClose).toBe(false)
    const recovered = advanceCrisisDay({ ...active, operatingDay: 7, day: 22, money: 0, pendingContractScene: undefined }, content)
    expect(recovered.shouldClose).toBe(false)
    expect(recovered.state.financialHealth).toMatchObject({ phase: 'warning', rescueUsed: true })
    expect(recovered.state.pendingContractScene?.trigger).toBe('grace-success')
    const failed = advanceCrisisDay({ ...active, operatingDay: 7, day: 22, money: -1, pendingContractScene: undefined }, content)
    expect(failed.shouldClose).toBe(true)
    expect(failed.state.pendingContractScene?.trigger).toBe('grace-failure')
    expect(advanceCrisisDay({ ...active, operatingDay: 5, day: 14, money: -21 }, content).shouldClose).toBe(true)
  })

  it('shows preorder target success before the deadline success scene when both happen on day three', () => {
    const active = acceptCrisisContract(makeState({ day: 10, money: -1, reputation: 35 }), 'crisis-preorder', content).state
    const completed = {
      ...active,
      operatingDay: 7,
      day: 22,
      money: 4,
      flags: [...active.flags, 'crisis-preorder-target-complete'],
      pendingContractScene: { contractId: 'crisis-preorder', trigger: 'target-success' as const },
    }
    const advanced = advanceCrisisDay(completed, content).state
    expect(advanced.pendingContractScene?.trigger).toBe('target-success')
    const acknowledged = acknowledgeCrisisScene(advanced)
    expect(acknowledged.pendingContractScene?.trigger).toBe('grace-success')
    expect(acknowledged.page).toBe('financialCrisis')
  })

  it('queues scenes by stable contract and trigger IDs', () => {
    const active = acceptCrisisContract(makeState({ money: -1 }), 'crisis-pawn', content).state
    expect(queueContractScene({ ...active, pendingContractScene: undefined }, 'grace-success').pendingContractScene)
      .toEqual({ contractId: 'crisis-pawn', trigger: 'grace-success' })
  })
})
