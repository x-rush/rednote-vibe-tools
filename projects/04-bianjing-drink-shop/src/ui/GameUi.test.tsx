import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { DailyDecision, EventActorRole } from '../domain/types'
import type { GameViewModel } from '../state/view-model'
import { actorAssetPath } from './actor-assets'
import { EventSituation } from './EventExperience'
import { BusinessTicker, GameHeader, GuideCard, LedgerPanel, OpeningSummary, OutcomePanel, PreparationPanel, ShopScene } from './GameUi'

const view: GameViewModel = {
  title: '汴京饮子铺：开店一百天',
  dayLabel: '经营日 6/30',
  calendarLabel: '百日历 · 第 18 日',
  chapterLabel: '一 · 支起炉火',
  stats: [
    { id: 'money', label: '资金', value: 624 },
    { id: 'reputation', label: '口碑', value: 37 },
    { id: 'energy', label: '体力', value: 68 },
    { id: 'relationships', label: '人情', value: 22 },
  ],
  products: [
    { productId: 'drink-green-plum', name: '青梅饮', basePrice: 7, unitCost: 3, complexity: 1, inventory: 1, assetPath: './assets/drinks/drink-green-plum.webp' },
    { productId: 'drink-ginger-honey', name: '姜蜜水', basePrice: 9, unitCost: 4, complexity: 1, inventory: 0, assetPath: './assets/drinks/drink-ginger-honey.webp' },
    { productId: 'drink-perilla', name: '紫苏熟水', basePrice: 11, unitCost: 5, complexity: 2, inventory: 2, assetPath: './assets/drinks/drink-perilla.webp' },
  ],
  weather: { id: 'weather-rain', name: '骤雨', effect: '客流减少' },
  ticker: [],
  ledger: [
    { kind: 'income', label: '销售收入 · 青梅饮', amount: 28, entityId: 'drink-green-plum' },
    { kind: 'fixed-cost', label: '铺面固定成本', amount: -2 },
  ],
  chainInterruptions: [],
  operatingModes: [
    { id: 'full', label: '全天', consequence: '完整客流', disabled: false },
    { id: 'half', label: '半日', consequence: '较少消耗', disabled: false },
    { id: 'rest', label: '休息', consequence: '恢复体力', disabled: false },
  ],
  ayuanPreparation: { name: '阿沅', role: '饮子铺店伙计', mode: 'full', text: '先看今日天色，再定备货。' },
  budget: {
    stockCost: 39, rentCost: 4, operatingCost: 2, cashAfterOpening: 75, remainingMoney: 75,
    preparedCount: 10, selectedProducts: 3, projectedMinimum: 68, projectedMaximum: 104,
    risk: 'possible-debt', riskLabel: '若客流偏淡，可能欠账',
  },
  productForecasts: [
    { productId: 'drink-green-plum', minimum: 3, maximum: 5, tendency: 'hot', tendencyLabel: '偏热', shelfClass: 'fresh', shelfLabel: '鲜材 · 余货折返一成' },
    { productId: 'drink-ginger-honey', minimum: 1, maximum: 3, tendency: 'steady', tendencyLabel: '平稳', shelfClass: 'concentrate', shelfLabel: '膏酱 · 余货折返四成半' },
    { productId: 'drink-perilla', minimum: 0, maximum: 2, tendency: 'quiet', tendencyLabel: '偏淡', shelfClass: 'brewed', shelfLabel: '现煮 · 余货折返二成半' },
  ],
  businessBeats: [
    { stage: 0, kind: 'direct-sale', count: 4, text: '客人照着心意点中了今日饮子', productName: '青梅饮' },
    { stage: 1, kind: 'substitute', count: 1, text: '首选售罄后，客人接受了替代饮子', productName: '姜蜜水' },
    { stage: 2, kind: 'price-left', count: 2, text: '有人问过价钱，最后收回了铜钱' },
    { stage: 3, kind: 'menu-mismatch', count: 3, text: '有人看遍价牌，也没找到合口味的饮子', unit: '人' },
  ],
  demandBreakdown: {
    potentialBuyers: 12, servedCustomers: 7,
    losses: [
      { id: 'menuMismatch', label: '菜单不合', count: 1 }, { id: 'price', label: '觉得太贵', count: 2 },
      { id: 'service', label: '来不及招呼', count: 1 }, { id: 'stockout', label: '缺货离开', count: 1 },
    ], products: [],
  },
  event: {
    id: 'event-rain',
    title: '雨棚下的旧客',
    content: '旧客站在檐下，仍想要一盏从前常喝的熟水。',
    assetId: 'event-rain-illustration',
    category: 'customer',
    isChain: false,
    scene: {
      timing: 'business', timingLabel: '营业中', location: 'counter', locationLabel: '柜前',
      actorRole: 'worker', actorLabel: '脚夫',
    },
    choices: [
      { choiceId: 'choice-a', text: '先请他坐下', impactHints: [{ axis: 'relationships', direction: 'up', text: '人情增加' }] },
      { choiceId: 'choice-b', text: '只赠半盏', impactHints: [{ axis: 'inventory', direction: 'down', text: '库存减少' }] },
    ],
  },
  outcome: {
    id: 'ending-neighbor-heart', title: '街坊自家人', content: '许多人把这里当成自家铺子。', evaluation: '人情深厚', shareText: '百日灯火，街坊常坐。',
    poster: {
      title: '汴京饮子铺：开店一百天', endingId: 'ending-neighbor-heart', endingTitle: '街坊自家人', endingContent: '许多人把这里当成自家铺子。', evaluation: '人情深厚', shareText: '百日灯火，街坊常坐。',
      operatingDays: 30, totalOperatingDays: 30, calendarDays: 100, totalCalendarDays: 100, totalSold: 200, profitDays: 18, lossDays: 10, breakEvenDays: 2, netMoneyChange: 504,
      stats: [{ id: 'money', label: '资金', value: 624 }, { id: 'reputation', label: '口碑', value: 37 }, { id: 'energy', label: '体力', value: 68 }, { id: 'relationships', label: '人情', value: 22 }],
      favoriteProduct: { productId: 'drink-green-plum', name: '青梅饮', sold: 72 }, modeCounts: { full: 24, half: 4, rest: 2 }, completedChains: [], keyChoices: [], historyComplete: true,
    },
  },
}

const decision: DailyDecision = {
  menu: [
    { productId: 'drink-green-plum', prepare: 4, price: 7 },
    { productId: 'drink-ginger-honey', prepare: 3, price: 9 },
    { productId: 'drink-perilla', prepare: 3, price: 11 },
  ],
  operatingMode: 'full',
  strategyId: 'player',
}

const copy = {
  preparedQuantity: '备货量', sellingPrice: '售价', unitCost: '单份成本', basePrice: '基准价',
  openShop: '开门营业', openingSummary: '开门清单', stockCostLabel: '预计备货', remainingMoneyLabel: '开门后余钱', preparedCountLabel: '备货总数',
  businessTitle: '柜上简讯', quickSettlement: '直接看日结', hearCustomer: '听听来客怎么说', viewEvent: '查看今日事件', settleNoEvent: '照常经营并结算',
  outcomeRoute: '经营路线', restart: '另开一间铺',
  posterGenerate: '生成百日总结图', posterImageAlt: '百日经营总结图', posterSave: '保存到相册', posterShare: '去小红书分享', posterClose: '收起总结图',
  tickerUnit: '饮子单位', moneyUnit: '钱单位', backToPreparation: '返回备货测试', yes: '是', no: '否',
  visitorsPassed: '客人经过测试', continueBusiness: '继续看铺测试', chainClue: '连锁线索测试',
  ledgerTitleV2: '账簿测试', ledgerCollapse: '收起测试', ledgerExpand: '展开测试',
  budgetInsufficient: '钱不够测试', energyMustRest: '体力不足测试',
  preparationHelp: '请选择三至五种饮子。',
  selectedProductsLabel: '上架饮子测试',
  drinkIllustration: '饮子示意', inventoryLabel: '库存', complexityLabel: '工序', decreaseLabel: '减少', increaseLabel: '增加',
  businessEventPending: '柜前人声未歇，账要等这件事落定后再收拢。', marketFlowPending: '来客仍在柜前等候',
  eventSettlementTitle: '今日事件回响', modifierRemainingDays: '还将持续', dayUnit: '日', chainProgressLabel: '连锁进展',
  operatingModeLegend: '今日怎么开门', restDayConfirm: '歇业休息', footTrafficLabel: '经过柜前', buyersLabel: '愿意下单', unservedLabel: '来不及招呼', stockoutLabel: '缺货',
  budgetStockLabel: '备货成本', budgetRentLabel: '今日铺租', budgetOperatingLabel: '营业杂费', cashAfterOpeningLabel: '开门后现金',
  projectedRangeLabel: '预计收摊现金', demandBandLabel: '预计来客', reuseYesterdayPlan: '沿用昨日方案', useAyuanPlan: '采用阿沅建议',
  riskConfirmLabel: '我已看清最差账面可能欠账',
}

describe('V2 game UI components', () => {
  it('maps seven visual roles to local WebPs and none to no character layer', () => {
    const visualRoles: EventActorRole[] = ['worker', 'merchant', 'scholar', 'youth', 'elder', 'neighbor-woman', 'runner']
    for (const role of visualRoles) expect(actorAssetPath(role)).toMatch(/^\.\/assets\/customers\/[a-z-]+\.webp$/)
    expect(actorAssetPath('none')).toBeUndefined()
  })

  it('renders all four named stats and weather as text outside the scene art', () => {
    const html = renderToStaticMarkup(<GameHeader view={view} timeLabel="辰时" />)

    expect(html).toContain('经营日 6/30')
    expect(html).toContain('百日历 · 第 18 日')
    expect(html).toContain('一 · 支起炉火')
    expect(html).toContain('骤雨')
    for (const label of ['资金', '口碑', '体力', '人情']) expect(html).toContain(label)
  })

  it('keeps a textual shop fallback adjacent to the decorative scene image', () => {
    const html = renderToStaticMarkup(<ShopScene phase="morning" alt="白日饮子铺" caption="今日铺面 · 晨光初上" />)

    expect(html).toContain('src="./assets/scenes/shop-base-day.webp"')
    expect(html).toContain('alt="白日饮子铺"')
    expect(html).toContain('今日铺面 · 晨光初上')
    expect(html).toContain('scene-fallback')
  })

  it('marks every panel following a scene with the shared non-overlap layout hook', () => {
    const business = renderToStaticMarkup(<BusinessTicker view={view} stage={0} visitors={8} copy={copy} onNext={() => {}} onSkip={() => {}} onContinue={() => {}} />)
    const event = renderToStaticMarkup(<EventSituation event={view.event!} eyebrow="铺中来事" continueLabel="看看如何处置" onContinue={() => {}} />)
    const outcome = renderToStaticMarkup(<OutcomePanel view={view} label="百日结局" copy={copy} onRestart={() => {}} />)

    for (const html of [business, event, outcome]) expect(html).toContain('scene-followup-panel')
  })

  it('renders readable ledger labels without exposing internal IDs', () => {
    const html = renderToStaticMarkup(<LedgerPanel view={view} netChange={26} expanded copy={copy} onToggle={() => {}} />)

    expect(html).toContain('账簿测试')
    expect(html).toContain('销售收入 · 青梅饮')
    expect(html).toContain('铺面固定成本')
    expect(html).not.toContain('sales-income')
  })

  it('renders guide, preparation, opening, business, and outcome components from typed props', () => {
    const guide = renderToStaticMarkup(<GuideCard name="阿沅" role="饮子铺店伙计"><p>先定今日饮子。</p></GuideCard>)
    const preparation = renderToStaticMarkup(<PreparationPanel view={view} decision={decision} copy={copy} onToggle={() => {}} onPrepare={() => {}} onPrice={() => {}} onOperatingMode={() => {}} onReuse={() => {}} onRecommend={() => {}} onSubmit={() => {}} />)
    const opening = renderToStaticMarkup(<OpeningSummary view={view} decision={decision} copy={copy} riskConfirmed onRiskConfirmed={() => {}} onBack={() => {}} onOpen={() => {}} />)
    const business = renderToStaticMarkup(<BusinessTicker view={{ ...view, ticker: [{ text: '青梅饮售出 4 盏' }] }} stage={3} visitors={12} copy={copy} onNext={() => {}} onSkip={() => {}} onContinue={() => {}} />)
    const outcome = renderToStaticMarkup(<OutcomePanel view={view} label="百日结局" copy={copy} onRestart={() => {}} />)

    expect(guide).toContain('ayuan-master.webp')
    expect(preparation.match(/disabled=""/g)?.length).toBe(3)
    expect(preparation).toContain('product-row product-selected')
    expect(preparation).toContain('aria-describedby="selection-rule"')
    expect(preparation).toContain('id="selection-rule"')
    expect(preparation.match(/class="product-status"/g)?.length).toBe(3)
    expect(preparation).toContain('class="control-field quantity-field"')
    expect(preparation).toContain('class="control-field price-field"')
    expect(preparation).toContain('class="preparation-actions"')
    expect(preparation).toContain('class="operating-mode-grid"')
    expect(preparation.match(/type="radio"/g)?.length).toBe(3)
    expect(preparation).toContain('ayuan-stage-preparation')
    for (const value of ['备货成本', '今日铺租', '营业杂费', '预计收摊现金', '3–5', '鲜材 · 余货折返一成', '沿用昨日方案', '采用阿沅建议']) expect(preparation).toContain(value)
    expect(opening).toContain('预计备货')
    expect(opening).toContain('返回备货测试')
    expect(opening).toContain('钱单位')
    expect(opening).toContain('split-actions action-surface-paper')
    expect(opening).toContain('若客流偏淡，可能欠账')
    expect(business).toContain('没找到合口味的饮子 · 3 人')
    expect(business.match(/class="business-beat/g)?.length).toBe(4)
    expect(business).toContain('客人经过测试')
    expect(outcome).toContain('街坊自家人')
    expect(outcome).toContain('生成百日总结图')
  })

  it('conceals exact visitor and sales figures before a business-timed event is confirmed', () => {
    const html = renderToStaticMarkup(<BusinessTicker view={{ ...view, ticker: [{ text: '青梅饮售出 4 盏 · 余 1 盏' }] }} stage={2} visitors={12} concealExactSales copy={copy} onNext={() => {}} onSkip={() => {}} onContinue={() => {}} />)
    expect(html).toContain('来客仍在柜前等候')
    expect(html).toContain('账要等这件事落定后再收拢')
    expect(html).not.toContain('12')
    expect(html).not.toContain('售出 4')
    expect(html).toContain('听听来客怎么说')
    expect(html.match(/<button/g)).toHaveLength(1)
    expect(html).not.toContain('继续看铺测试')
    expect(html).not.toContain('直接看日结')
  })

  it('blocks opening when stock exceeds cash or zero energy is not protected by early closing', () => {
    const overBudget = renderToStaticMarkup(<PreparationPanel view={{ ...view, budget: { ...view.budget!, remainingMoney: -1 } }} decision={decision} copy={copy} onToggle={() => {}} onPrepare={() => {}} onPrice={() => {}} onOperatingMode={() => {}} onReuse={() => {}} onRecommend={() => {}} onSubmit={() => {}} />)
    const noEnergyView = {
      ...view,
      stats: view.stats.map((stat) => stat.id === 'energy' ? { ...stat, value: 0 } : stat),
      operatingModes: view.operatingModes.map((mode) => ({ ...mode, disabled: mode.id !== 'rest' })),
    }
    const noEnergy = renderToStaticMarkup(<PreparationPanel view={noEnergyView} decision={decision} copy={copy} onToggle={() => {}} onPrepare={() => {}} onPrice={() => {}} onOperatingMode={() => {}} onReuse={() => {}} onRecommend={() => {}} onSubmit={() => {}} />)

    expect(overBudget).toContain('钱不够测试')
    expect(overBudget).toContain('<button class="primary-action" type="submit" disabled="">')
    expect(noEnergy).toContain('体力不足测试')
    expect(noEnergy).toContain('<button class="primary-action" type="submit" disabled="">')
  })

  it('turns rest into a real no-stock preparation state', () => {
    const restView: GameViewModel = {
      ...view,
      ayuanPreparation: { name: '阿沅', role: '饮子铺店伙计', mode: 'rest', text: '今日关火歇一日。' },
    }
    const restDecision: DailyDecision = { menu: [], operatingMode: 'rest', strategyId: 'rest' }
    const html = renderToStaticMarkup(<PreparationPanel view={restView} decision={restDecision} copy={copy} onToggle={() => {}} onPrepare={() => {}} onPrice={() => {}} onOperatingMode={() => {}} onReuse={() => {}} onRecommend={() => {}} onSubmit={() => {}} />)

    expect(html).toContain('ayuan-stage-rest')
    expect(html).toMatch(/checked="" value="rest"/)
    expect(html).not.toContain('class="product-list"')
    expect(html).toContain('歇业休息')
    expect(html).toContain('今日铺租')
    expect(html).toContain('>4<')

    const opening = renderToStaticMarkup(<OpeningSummary view={restView} decision={restDecision} copy={copy} onBack={() => {}} onOpen={() => {}} />)
    expect(opening).toContain('今日铺租')
    expect(opening).toContain('4 钱单位')
  })

  it('requires explicit confirmation for possible debt and blocks certain debt', () => {
    const possible = renderToStaticMarkup(<OpeningSummary view={view} decision={decision} copy={copy} riskConfirmed={false} onRiskConfirmed={() => {}} onBack={() => {}} onOpen={() => {}} />)
    const certain = renderToStaticMarkup(<OpeningSummary view={{ ...view, budget: { ...view.budget!, risk: 'certain-debt', riskLabel: '即使客流偏旺也会欠账' } }} decision={decision} copy={copy} riskConfirmed onRiskConfirmed={() => {}} onBack={() => {}} onOpen={() => {}} />)
    expect(possible).toContain('我已看清最差账面可能欠账')
    expect(possible).toContain('disabled=""')
    expect(certain).toContain('即使客流偏旺也会欠账')
    expect(certain).toContain('disabled=""')
  })

  it('disables yesterday reuse when no valid previous plan exists', () => {
    const html = renderToStaticMarkup(<PreparationPanel view={view} decision={decision} copy={copy} onToggle={() => {}} onPrepare={() => {}} onPrice={() => {}} onOperatingMode={() => {}} onRecommend={() => {}} onSubmit={() => {}} />)
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>沿用昨日方案<\/button>/)
  })
})
