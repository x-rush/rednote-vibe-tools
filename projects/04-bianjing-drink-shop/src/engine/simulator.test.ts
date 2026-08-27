import { describe, expect, it } from 'vitest'
import { shopContent } from '../content'
import type { DailyDecision } from '../domain/types'
import { basicDecision, makeState } from '../tests/fixtures'
import { createNewGame, openDay, resolveDay, simulateDay } from './simulator'

describe('complete deterministic day settlement', () => {
  const content = shopContent.content

  it('creates an isolated documented initial state', () => {
    const state = createNewGame('new-seed', 'save-new', content)
    expect(state).toMatchObject({
      schemaVersion: 5,
      day: 1,
      operatingDay: 1,
      money: 120,
      reputation: 10,
      energy: 80,
      relationships: 5,
      saveId: 'save-new',
      seed: 'new-seed',
      page: 'morning',
      dayForecast: { day: 1 },
      financialHealth: { phase: 'normal', rescueUsed: false },
      campaignTotals: { trackedOperatingDays: 0, totalSold: 0, profitDays: 0, lossDays: 0, breakEvenDays: 0, productSold: {} },
    })
    expect(state.unlockedProductIds).toHaveLength(9)
    expect(state.eventHistory).toEqual([])
  })

  it('runs sales, a deterministic day-one event, effects, and the ledger in order', () => {
    const initial = createNewGame('day-one-0', 'save-day-one', content)
    const opened = openDay(initial, basicDecision, content)
    expect(opened.selection).toMatchObject({ kind: 'event', eventId: 'event-first-customer' })
    expect(opened.state.money).toBe(initial.money)
    expect(opened.state.energy).toBe(initial.energy)
    expect(opened.state.inventory).toEqual(initial.inventory)
    expect(opened.state.day).toBe(initial.day)
    expect(opened.state.pendingOpening?.sales.length).toBeGreaterThan(0)
    expect(opened.state.pendingOpening?.dayContext.weatherId).toBe(initial.dayForecast?.weatherId)
    expect(opened.state.pendingOpening?.businessBeats).toHaveLength(4)
    const demand = opened.state.pendingOpening?.demandResolution
    expect(demand && demand.servedCustomers + Object.values(demand.losses).reduce((sum, value) => sum + value, 0)).toBe(demand?.potentialBuyers)

    const result = resolveDay(opened.state, 'a', content)
    expect(result.eventId).toBe('event-first-customer')
    expect(result.choiceId).toBe('a')
    expect(result.ledger.reduce((sum, line) => sum + line.amount, 0)).toBe(result.moneyDelta)
    expect(result.nextState.money - initial.money).toBe(result.moneyDelta)
    expect(result.nextState.operatingDay).toBe(2)
    expect(result.nextState.day).toBe(4)
    expect(result.nextState.dayForecast).toMatchObject({ operatingDay: 2, day: 4 })
    expect(result.nextState.lastDecision).toEqual(basicDecision)
    expect(result.nextState.inventory).toEqual(expect.objectContaining({ 'drink-green-plum': 0 }))
    expect(Object.values(result.nextState.inventory).every((value) => value >= 0)).toBe(true)
    expect(result.nextState.campaignTotals).toMatchObject({
      trackedOperatingDays: 1,
      totalSold: result.sales.reduce((sum, sale) => sum + sale.sold, 0),
      profitDays: Number(result.moneyDelta > 0),
      lossDays: Number(result.moneyDelta < 0),
      breakEvenDays: Number(result.moneyDelta === 0),
    })
    expect(Object.values(result.nextState.campaignTotals?.productSold ?? {}).reduce((sum, sold) => sum + sold, 0))
      .toBe(result.nextState.campaignTotals?.totalSold)
  })

  it('commits the stored trading plan and confirmed event exactly once', () => {
    const initial = createNewGame('day-one-0', 'save-atomic', content)
    const opened = openDay(initial, basicDecision, content)
    const plan = opened.state.pendingOpening
    expect(plan).toBeDefined()

    const result = resolveDay(opened.state, 'a', content)
    const eventMoney = result.eventResolution?.moneyDelta ?? 0
    expect(result.moneyDelta).toBe((plan?.moneyDelta ?? 0) + eventMoney)
    expect(result.ledger.reduce((sum, line) => sum + line.amount, 0)).toBe(result.moneyDelta)
    expect(result.nextState.money).toBe(initial.money + result.moneyDelta)
    expect(() => resolveDay({ ...opened.state, lastResolutionId: plan?.resolutionId }, 'a', content))
      .toThrow('该营业日已经结算')
  })

  it('resolves a serialized opening plan deterministically', () => {
    const opened = openDay(createNewGame('day-one-0', 'save-replay', content), basicDecision, content)
    const restored = JSON.parse(JSON.stringify(opened.state))
    expect(resolveDay(restored, 'a', content)).toEqual(resolveDay(opened.state, 'a', content))
  })

  it('freezes the selected chain variant through serialization and settlement', () => {
    const state = makeState({
      day: 10,
      flags: ['poet-debt-gentle'],
      chainProgress: {
        'chain-poet': {
          chainId: 'chain-poet',
          status: 'active',
          nodeIndex: 0,
          currentNodeId: 'poet-credit',
          startedDay: 4,
          lastAdvancedDay: 4,
        },
      },
    })
    const opened = openDay(state, basicDecision, content)
    expect(opened.state.pendingOpening).toMatchObject({
      selectionKind: 'chain',
      nodeId: 'poet-song-spreads',
      variantId: 'gentle-debt',
    })

    const restored = JSON.parse(JSON.stringify(opened.state))
    restored.flags = ['poet-debt-formal']
    const result = resolveDay(restored, 'b', content)
    expect(result.eventResolution).toMatchObject({ variantId: 'gentle-debt', moneyDelta: 3 })
    expect(result.eventResolution?.statDeltas).toEqual({ relationships: 3 })
  })

  it('applies due scheduled effects and removes them from the queue', () => {
    const initial = createNewGame('scheduled', 'save-scheduled', content)
    initial.pendingEffects = [{ scheduledEffectId: 'due', dueDay: 1, effects: [{ type: 'money-delta', value: 6, labelId: 'scheduled-income' }] }]
    const result = simulateDay(initial, basicDecision, () => 'b', content)
    expect(result.ledger).toContainEqual({ kind: 'scheduled', labelId: 'scheduled-income', amount: 6, entityId: 'due' })
    expect(result.nextState.pendingEffects).toEqual([])
  })

  it('intercepts first insolvency with a one-time financial offer', () => {
    const expensive: DailyDecision = {
      menu: content.drinks.slice(0, 5).map((product) => ({ productId: product.productId, prepare: 12, price: Math.ceil(product.basePrice * 0.8) })),
      operatingMode: 'full',
      strategyId: 'aggressive-loss',
    }
    const initial = createNewGame('bankrupt', 'save-bankrupt', content)
    initial.money = 1
    const result = simulateDay(initial, expensive, () => 'a', content)
    expect(result.nextState.page).toBe('financialCrisis')
    expect(result.endingId).toBeUndefined()
    expect(result.nextState.financialHealth).toMatchObject({ phase: 'offer', rescueUsed: false })
  })

  it('blocks opening while a contract scene still needs acknowledgment', () => {
    const state = makeState({ pendingContractScene: { contractId: 'crisis-credit', trigger: 'first-installment' } })
    expect(() => openDay(state, basicDecision, content)).toThrow('请先处理周转剧情')
  })

  it('advances a grace deadline on natural rest days', () => {
    const rest: DailyDecision = { menu: [], operatingMode: 'rest', strategyId: 'grace-rest' }
    let state = makeState({
      operatingDay: 4,
      day: 10,
      money: 11,
      financialHealth: {
        phase: 'grace',
        rescueUsed: true,
        activeContract: { contractId: 'crisis-pawn', acceptedDay: 10, graceEndsDay: 22, preorderProgress: 0 },
      },
    })
    for (let index = 0; index < 3; index += 1) state = simulateDay(state, rest, () => undefined, content).nextState
    expect(state).toMatchObject({ operatingDay: 7, day: 22 })
    expect(state.page).toBe('financialCrisis')
    expect(state.pendingContractScene?.trigger).toBe('grace-failure')
  })

  it('resolves day 100 and applies ending priority', () => {
    const initial = makeState({ day: 100, money: 500, reputation: 80, energy: 80, page: 'morning' })
    const result = simulateDay(initial, basicDecision, () => 'b', content)
    expect(result.nextState.page).toBe('finalEnding')
    expect(result.endingId).toBeDefined()
    expect(result.nextState.day).toBe(100)
  })

  it('routes chapter milestones by operating turn and rejects a second resolution', () => {
    const initial = makeState({ operatingDay: 7, day: 22, money: 200, page: 'morning' })
    const opened = openDay(initial, basicDecision, content)
    const result = resolveDay(opened.state, opened.selection.kind === 'none' ? undefined : 'b', content)
    expect(result.nextState.page).toBe('milestone')
    expect(() => resolveDay(result.nextState, 'b', content)).toThrow('没有待结算的营业日')
  })

  it('ends the thirtieth playable decision on calendar day one hundred', () => {
    const initial = makeState({ operatingDay: 30, day: 100, money: 500, reputation: 80, energy: 80, page: 'morning' })
    const result = simulateDay(initial, basicDecision, () => 'b', content)

    expect(result).toMatchObject({ operatingDay: 30, day: 100 })
    expect(result.nextState).toMatchObject({ operatingDay: 30, day: 100, page: 'finalEnding' })
  })

  it('closes a final-turn deficit instead of offering a contract whose deadline cannot occur', () => {
    const expensive: DailyDecision = {
      menu: content.drinks.slice(0, 5).map((product) => ({ productId: product.productId, prepare: 12, price: product.basePrice })),
      operatingMode: 'full',
      strategyId: 'final-deficit',
    }
    const initial = makeState({ operatingDay: 30, day: 100, money: 1, page: 'morning' })
    const result = simulateDay(initial, expensive, () => 'b', content)

    expect(result.nextState.page).toBe('bankruptcy')
    expect(result.nextState.page).not.toBe('financialCrisis')
  })

  it('requires a true rest day after energy reaches zero', () => {
    expect(() => openDay(makeState({ energy: 0 }), basicDecision, content)).toThrow('体力见底，今日只能休息')
  })
})
