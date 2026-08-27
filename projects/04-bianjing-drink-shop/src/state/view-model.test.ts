import { describe, expect, it } from 'vitest'
import { shopContent } from '../content'
import { basicDecision, makeState } from '../tests/fixtures'
import { createNewGame, openDay, resolveDay } from '../engine/simulator'
import { buildGameViewModel } from './view-model'
import { estimateProductDemandBands } from '../engine/demand'

describe('typed game view model', () => {
  it('names the playable turn, hundred-day calendar, and current chapter separately', () => {
    const view = buildGameViewModel(makeState({ operatingDay: 6, day: 18 }), shopContent.content)

    expect(view).toMatchObject({
      dayLabel: '经营日 6/30',
      calendarLabel: '百日历 · 第 18 日',
      chapterLabel: '一 · 支起炉火',
    })
  })

  it('exposes frozen morning intelligence, full opening costs, and product demand bands', () => {
    const base = makeState()
    const state = makeState({
      dayForecast: { ...base.dayForecast!, weatherId: 'weather-hot', marketSignalId: 'signal-dock-unloading' },
      lastDecision: basicDecision,
      unlockedProductIds: shopContent.content.drinks.filter((product) => product.initiallyUnlocked).map((product) => product.productId),
    })
    const view = buildGameViewModel(state, shopContent.content, { decision: basicDecision })
    expect(view.morningIntel).toMatchObject({ weatherName: '暑热', marketSignal: expect.any(String), yesterdayInsight: expect.any(String) })
    expect(view.budget).toMatchObject({ stockCost: 39, rentCost: 4, operatingCost: 6, cashAfterOpening: 71, risk: expect.stringMatching(/^(safe|possible-debt|certain-debt)$/) })
    expect(view.productForecasts).toHaveLength(state.unlockedProductIds.length)
    expect(view.productForecasts?.every((item) => item.minimum >= 0 && item.maximum >= item.minimum && item.shelfLabel.length > 0)).toBe(true)
    const sameMenuBands = estimateProductDemandBands(state, state.dayForecast!, basicDecision, shopContent.content)
    basicDecision.menu.forEach((entry) => expect(view.productForecasts?.find((item) => item.productId === entry.productId)).toMatchObject(sameMenuBands[entry.productId]))
  })

  it('exposes three operating choices and contextual Ayuan preparation/rest feedback', () => {
    const state = makeState({ energy: 0 })
    const restDecision = { menu: [], operatingMode: 'rest' as const, strategyId: 'rest' }
    const preparation = buildGameViewModel(state, shopContent.content, { decision: restDecision })

    expect(preparation.operatingModes).toEqual([
      { id: 'full', label: '全天营业', consequence: '完整客流 · 消耗较多', disabled: true },
      { id: 'half', label: '半日营业', consequence: '客流减少 · 消耗较少', disabled: true },
      { id: 'rest', label: '休息一日', consequence: '今日无营业 · 恢复体力', disabled: false },
    ])
    expect(preparation.ayuanPreparation).toMatchObject({
      name: '阿沅',
      mode: 'rest',
      text: '体力已经见底。今日关火歇一日，只付铺租，把精神养回来。',
    })

    const opened = openDay(state, restDecision, shopContent.content)
    const result = resolveDay(opened.state, undefined, shopContent.content)
    const settlement = buildGameViewModel(result.nextState, shopContent.content, { result })
    expect(settlement.settlementInsight).toMatchObject({
      reason: 'rested',
      name: '阿沅',
      text: '今日没有开门，铺租照付，体力已经缓过来一些。明日再看天色备货。',
    })
  })

  it('resolves product, stat, event, and choice copy from content', () => {
    const state = createNewGame('view', 'save-view', shopContent.content)
    const opened = openDay(state, basicDecision, shopContent.content)
    const view = buildGameViewModel(opened.state, shopContent.content)
    expect(view.title).toBe(shopContent.content.ui.landingTitle)
    expect(view.stats.map((item) => item.label)).toEqual(['资金','口碑','体力','人情'])
    expect(view.products[0]?.name).toBe('青梅饮')
    expect(view.event?.title).toBe('第一位客人')
    expect(view.event?.choices.map((item) => item.text)).toEqual(['添一小盏，请他带回去解渴','照价卖一盏，把今日第一笔账记清'])
    expect(view.event?.scene.actorLabel).toBeTruthy()
    expect(view.event?.scene.locationLabel).toBeTruthy()
    expect(view.event?.choices[0].impactHints.map((hint) => hint.text)).toEqual([
      '会占用一笔现钱', '有助于拉近街坊人情', '可能抬高街面口碑',
    ])
  })

  it('presents product art, inventory, and a hand-checkable preparation budget', () => {
    const state = createNewGame('view-budget', 'save-view-budget', shopContent.content)
    const view = buildGameViewModel(state, shopContent.content, { decision: basicDecision })

    expect(view.products[0]).toMatchObject({
      productId: 'drink-green-plum',
      assetPath: './assets/drinks/drink-green-plum.webp',
      inventory: 0,
    })
    expect(view.budget).toMatchObject({
      stockCost: 39,
      rentCost: 4,
      operatingCost: 6,
      remainingMoney: 71,
      cashAfterOpening: 71,
      preparedCount: 10,
      selectedProducts: 3,
    })
  })

  it('presents conserved loss details and exactly four authored business moments', () => {
    const state = createNewGame('view-demand', 'save-view-demand', shopContent.content)
    const opened = openDay(state, basicDecision, shopContent.content)
    const view = buildGameViewModel(opened.state, shopContent.content, { decision: basicDecision })
    expect(view.businessBeats).toHaveLength(4)
    expect(view.businessBeats?.map((beat) => beat.stage)).toEqual([0, 1, 2, 3])
    expect(view.demandBreakdown).toMatchObject({
      potentialBuyers: expect.any(Number),
      servedCustomers: expect.any(Number),
      losses: expect.arrayContaining([expect.objectContaining({ id: 'menuMismatch', label: '菜单不合' })]),
    })
  })

  it('builds eligible crisis contracts and content-defined scene copy', () => {
    const state = makeState({
      money: -1,
      reputation: 35,
      page: 'financialCrisis',
      financialHealth: { phase: 'offer', rescueUsed: false },
    })
    const view = buildGameViewModel(state, shopContent.content)
    expect(view.financialCrisis).toMatchObject({ phase: 'offer', rescueUsed: false, title: '三个经营日周转' })
    expect(view.financialCrisis?.contracts.map((contract) => contract.contractId)).toEqual(['crisis-pawn', 'crisis-credit', 'crisis-preorder'])
    expect(view.financialCrisis?.contracts.filter((contract) => contract.eligible).map((contract) => contract.contractId)).toEqual(['crisis-pawn', 'crisis-preorder'])
    expect(view.financialCrisis?.contracts.every((contract) => contract.immediateBenefit && contract.obligation)).toBe(true)
  })

  it('never leaks internal M/H/R abbreviations into player-facing labels', () => {
    const view = buildGameViewModel(makeState(), shopContent.content, { decision: basicDecision })
    const texts = JSON.stringify(view).match(/"([^"\\]*(?:\\.[^"\\]*)*)"/g) ?? []
    expect(texts.map((text) => text.slice(1, -1))).not.toEqual(expect.arrayContaining(['M', 'H', 'R', 'M/H/R']))
  })

  it('turns deterministic sales and ledger IDs into readable shop feedback', () => {
    const state = createNewGame('view', 'save-view-ledger', shopContent.content)
    const opened = openDay(state, basicDecision, shopContent.content)
    const openingView = buildGameViewModel(opened.state, shopContent.content, { decision: basicDecision })
    const choiceId = openingView.event?.choices[0]?.choiceId
    const result = resolveDay(opened.state, choiceId, shopContent.content)
    const settlementView = buildGameViewModel(result.nextState, shopContent.content, { result })

    expect(openingView.weather?.name).toBeTruthy()
    expect(openingView.ticker.some((item) => item.text.includes('售出'))).toBe(true)
    expect(settlementView.ledger.some((line) => line.label === '销售收入 · 青梅饮')).toBe(true)
    expect(settlementView.ledger.some((line) => line.label === '每日铺租')).toBe(true)
    expect(settlementView.ledger.some((line) => line.label === '营业杂费')).toBe(true)
    expect(settlementView.ledger.every((line) => !line.label.includes('sales-income'))).toBe(true)
    expect(settlementView.ledger.some((line) => line.label.includes('第一位客人') && line.label.includes('添一小盏，请他带回去解渴'))).toBe(true)
    expect(settlementView.eventResolution).toMatchObject({
      eventId: 'event-first-customer',
      choiceId: 'a',
      title: '第一位客人',
      choiceText: '添一小盏，请他带回去解渴',
      deltas: [
        { id: 'money', label: '资金', value: -2 },
        { id: 'relationships', label: '人情', value: 4 },
        { id: 'reputation', label: '口碑', value: 2 },
      ],
    })
  })

  it('shows the frozen chain branch before and after settlement', () => {
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
    const opened = openDay(state, basicDecision, shopContent.content)
    const eventView = buildGameViewModel(opened.state, shopContent.content)
    expect(eventView.event).toMatchObject({
      title: '宽限换来的诗稿',
      content: expect.stringContaining('没有被催期'),
    })

    const changedFlags = { ...opened.state, flags: ['poet-debt-formal'] }
    const result = resolveDay(changedFlags, 'b', shopContent.content)
    const settlementView = buildGameViewModel(result.nextState, shopContent.content, { result })
    expect(settlementView.eventResolution).toMatchObject({
      title: '宽限换来的诗稿',
      choiceText: '售出抄词小笺，把所得记入他的欠账',
    })
  })
})
