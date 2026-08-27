import { describe, expect, it } from 'vitest'
import rawContent from './content.json'
import { validateContent } from './schema'

describe('production content package', () => {
  it('passes the production schema', () => {
    expect(validateContent(rawContent, 'production')).toEqual({ ok: true, errors: [] })
  })

  it('contains the frozen launch quantities', () => {
    expect(rawContent.content.drinks).toHaveLength(10)
    expect(rawContent.content.ingredients).toHaveLength(10)
    expect(rawContent.content.customers).toHaveLength(12)
    expect(rawContent.content.events).toHaveLength(92)
    expect(rawContent.content.chains).toHaveLength(5)
    expect(rawContent.content.endings).toHaveLength(8)
  })

  it('requires the V5 campaign, demand, shelf-life, and crisis contracts used by the business loop', () => {
    const content = rawContent.content as unknown as Record<string, any>

    expect(rawContent.contentVersion).toBe('5.0.0-thirty-turns')
    expect(content.balance.campaign.operatingDays).toHaveLength(30)
    expect(content.demandSegments).toHaveLength(5)
    expect(content.marketSignals.length).toBeGreaterThanOrEqual(8)
    expect(content.crisisContracts.map((item: { contractId: string }) => item.contractId)).toEqual([
      'crisis-pawn',
      'crisis-credit',
      'crisis-preorder',
    ])
    expect(content.balance.crisis).toEqual({ warningMoney: 16, hardDebtFloor: -20, graceDays: 3 })
    expect(content.balance.shelfReturnRates).toEqual({ fresh: 0.1, brewed: 0.25, dry: 0.35, concentrate: 0.45 })
    expect(content.drinks.every((drink: { shelfClass?: string }) => ['fresh', 'brewed', 'dry', 'concentrate'].includes(drink.shelfClass ?? ''))).toBe(true)

    const invalid = structuredClone(rawContent) as unknown as Record<string, any>
    invalid.content.drinks[0].shelfClass = 'unknown'
    expect(validateContent(invalid, 'production').errors).toContain('$.content.drinks[0].shelfClass: 非法保存类型')
  })

  it('covers every approved taste, season, weather, shelf class, and event chance', () => {
    const content = rawContent.content
    expect(content.demandSegments.map((segment) => segment.primaryTags)).toEqual([
      ['cool', 'sour'], ['sweet', 'warm'], ['herbal', 'light'], ['warm', 'spiced'], ['novel', 'signature'],
    ])
    const coveredSeasons = new Set(content.marketSignals.flatMap((signal) => signal.seasonIds))
    const coveredWeather = new Set(content.marketSignals.flatMap((signal) => signal.weatherIds))
    expect(coveredSeasons).toEqual(new Set(content.seasons.map((season) => season.seasonId)))
    expect(coveredWeather).toEqual(new Set(content.weather.map((weather) => weather.weatherId)))
    expect(Object.fromEntries(content.drinks.map((drink) => [drink.productId, drink.shelfClass]))).toEqual({
      'drink-green-plum': 'fresh', 'drink-ginger-honey': 'concentrate', 'drink-perilla': 'brewed',
      'drink-lychee-paste': 'concentrate', 'drink-fragrant-bean': 'dry', 'drink-lotus': 'brewed',
      'drink-mint': 'fresh', 'drink-cinnamon': 'dry', 'drink-date': 'dry', 'drink-signature': 'brewed',
    })
    expect(content.balance.operatingModes).toMatchObject({
      full: { ordinaryEventChance: 0.72 }, half: { ordinaryEventChance: 0.62 }, rest: { ordinaryEventChance: 0.35 },
    })
  })

  it('rejects duplicate signals, missing segment references, and malformed obligations', () => {
    const duplicate = structuredClone(rawContent) as unknown as Record<string, any>
    duplicate.content.marketSignals[1].signalId = duplicate.content.marketSignals[0].signalId
    expect(validateContent(duplicate, 'production').errors).toContain('$.content.marketSignals[1].signalId: 重复 ID signal-dock-unloading')

    const missingSegment = structuredClone(rawContent) as unknown as Record<string, any>
    missingSegment.content.marketSignals[0].segmentWeights[0].segmentId = 'segment-missing'
    expect(validateContent(missingSegment, 'production').errors).toContain('$.content.marketSignals[0].segmentWeights: 引用不存在')

    const badContract = structuredClone(rawContent) as unknown as Record<string, any>
    badContract.content.crisisContracts[0].obligation = { type: 'operating-modifier', target: 'money', operation: 'multiply', value: -2, operatingDays: 0, playerLabel: '' }
    expect(validateContent(badContract, 'production').errors).toContain('$.content.crisisContracts[0].obligation: 经营负担结构无效')
  })

  it('defines bounded full, half, and rest operating rules for the production economy', () => {
    const balance = rawContent.content.balance as typeof rawContent.content.balance & {
      operatingModes: Record<string, { visitorMultiplier: number; rentCost: number; operatingCost: number; baseEnergyCost: number; energyRecovery: number; ordinaryEventChance: number }>
      conversion: { minimumRate: number; maximumRate: number }
      service: { baseCapacity: number }
    }

    expect(Object.keys(balance.operatingModes).sort()).toEqual(['full', 'half', 'rest'])
    expect(balance.operatingModes.full.visitorMultiplier).toBe(1)
    expect(balance.operatingModes.half.visitorMultiplier).toBeGreaterThan(0)
    expect(balance.operatingModes.half.visitorMultiplier).toBeLessThan(1)
    expect(balance.operatingModes.rest).toMatchObject({ visitorMultiplier: 0, ordinaryEventChance: 0.35 })
    expect(balance.operatingModes.rest.energyRecovery).toBeGreaterThan(0)
    expect(balance.conversion.minimumRate).toBeGreaterThanOrEqual(0)
    expect(balance.conversion.maximumRate).toBeLessThanOrEqual(1)
    expect(balance.conversion.minimumRate).toBeLessThan(balance.conversion.maximumRate)
    expect(balance.service.baseCapacity).toBeGreaterThan(0)
  })

  it('rejects impossible operating, conversion, and service values', () => {
    const invalid = structuredClone(rawContent) as unknown as Record<string, any>
    invalid.content.balance.operatingModes = {
      full: { visitorMultiplier: 1, rentCost: 4, operatingCost: 2, baseEnergyCost: 4, energyRecovery: 0, ordinaryEventChance: 1 },
      half: { visitorMultiplier: 1.2, rentCost: 4, operatingCost: 1, baseEnergyCost: 2, energyRecovery: 0, ordinaryEventChance: -0.1 },
      rest: { visitorMultiplier: 0.2, rentCost: -1, operatingCost: 0, baseEnergyCost: 0, energyRecovery: 0, ordinaryEventChance: 0.3 },
    }
    invalid.content.balance.conversion = {
      baseRate: 0.7, minimumRate: 0.8, maximumRate: 0.4, highPricePenalty: 0.62, lowPriceBonus: 0.1,
      preferenceBonus: 0.12, reputationBonus: 0.1, lowEnergyPenalty: 0.2, varietyBonus: 0.04,
    }
    invalid.content.balance.service = { baseCapacity: 0, energyCapacityFactor: -1 }

    const result = validateContent(invalid, 'production')

    expect(result.errors).toEqual(expect.arrayContaining([
      '$.content.balance.operatingModes.half.visitorMultiplier: 必须在 0–1 之间',
      '$.content.balance.operatingModes.half.ordinaryEventChance: 必须在 0–1 之间',
      '$.content.balance.operatingModes.rest.visitorMultiplier: 休息日必须为 0',
      '$.content.balance.operatingModes.rest.rentCost: 不得为负数',
      '$.content.balance.operatingModes.rest.energyRecovery: 必须大于 0',
      '$.content.balance.conversion: 最小成交率必须小于最大成交率',
      '$.content.balance.service.baseCapacity: 必须大于 0',
      '$.content.balance.service.energyCapacityFactor: 不得为负数',
    ]))
  })

  it('provides the V2 business-stage and recovery copy consumed by the UI', () => {
    const requiredUiKeys = [
      'coverEnglishLabel',
      'coverPromise',
      'todayIntel',
      'preparationBudget',
      'openingSummary',
      'businessTitle',
      'quickSettlement',
      'selectedChoice',
      'confirmChoice',
      'guideName',
      'guideRole',
      'guideLedger',
      'recoveryLoss',
      'outcomeRoute',
      'moneyUnit',
      'backToPreparation',
      'visitorsPassed',
      'continueBusiness',
      'chainClue',
      'ledgerTitleV2',
      'ledgerCollapse',
      'ledgerExpand',
      'guideStepOne',
      'guideStepTwo',
      'guideStepThree',
      'guideNext',
      'guideSkip',
      'coverSubtitle',
      'viewShop',
      'localSaveLine',
      'morningHint',
      'weatherPending',
      'morningSceneCaption',
      'businessSceneCaption',
      'eventSceneCaption',
      'endingSceneCaption',
      'openingLocked',
      'settlementPositive',
      'settlementNegative',
      'budgetInsufficient',
      'energyMustRest',
      'timeMorning',
      'timeNearNoon',
      'timeAfternoon',
      'timeDusk',
      'timeNight',
      'shopAltCover',
      'shopAltMorning',
      'shopAltBusiness',
      'shopAltEvent',
      'shopAltEnding',
      'forecastWeatherLabel',
      'marketSignalLabel',
      'demandBandLabel',
      'projectedRangeLabel',
      'riskCertainDebt',
      'reuseYesterdayPlan',
      'useAyuanPlan',
      'crisisTitle',
      'crisisGraceLabel',
      'crisisAccept',
      'lossMenuMismatch',
      'lossPrice',
      'lossService',
      'lossStockout',
    ] as const

    for (const key of requiredUiKeys) expect(rawContent.content.ui[key]).toBeTruthy()
    expect(rawContent.content.ui.morningHint).toContain('今日天色与街面消息已经定下')
    expect(rawContent.content.ui.morningHint).not.toContain('开门时')
  })

  it('uses unique stable entity and choice IDs', () => {
    const entityIds = [
      ...rawContent.content.drinks.map((item) => item.productId),
      ...rawContent.content.ingredients.map((item) => item.ingredientId),
      ...rawContent.content.recipes.map((item) => item.recipeId),
      ...rawContent.content.customers.map((item) => item.customerId),
      ...rawContent.content.weather.map((item) => item.weatherId),
      ...rawContent.content.seasons.map((item) => item.seasonId),
      ...rawContent.content.events.map((item) => item.eventId),
      ...rawContent.content.chains.map((item) => item.chainId),
      ...rawContent.content.endings.map((item) => item.endingId),
    ]
    expect(new Set(entityIds).size).toBe(entityIds.length)
    for (const event of rawContent.content.events) {
      expect(new Set(event.choices.map((choice) => choice.choiceId)).size).toBe(event.choices.length)
    }
  })

  it('rejects unsafe or malformed envelopes with JSON paths', () => {
    const invalid = {
      schemaVersion: 1,
      contentVersion: '1.0.0',
      projectId: 'bad id',
      meta: { title: ' ', locale: 'zh-CN' },
      sources: [],
      content: { image: 'data:image/png;base64,bad' },
    }
    const result = validateContent(invalid, 'envelope')
    expect(result.ok).toBe(false)
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.stringContaining('$.projectId'),
      expect.stringContaining('$.meta.title'),
      expect.stringContaining('$.meta.updatedAt'),
      expect.stringContaining('$.content.image'),
    ]))
  })

  it('rejects missing event, product, and chain references inside conditions', () => {
    const invalid = structuredClone(rawContent)
    invalid.content.endings[0].conditions = [{ type: 'chain-status', chainId: 'chain-missing', status: 'completed' }]
    const result = validateContent(invalid, 'production')
    expect(result.ok).toBe(false)
    expect(result.errors).toContain('$.content.endings[0].conditions[0].chainId: 引用不存在')
  })

  it('rejects malformed V2 presentation enums and context references', () => {
    const invalid = structuredClone(rawContent) as unknown as Record<string, any>
    invalid.content.events[0].scene = { timing: 'midnight', location: 'palace', actorRole: 'emperor' }
    invalid.content.events[0].conditions = [{ type: 'weather-is', weatherId: 'weather-missing' }]
    invalid.content.events[0].choices[0].impactHints = [{ axis: 'luck', direction: 'sideways', text: '也许' }]
    invalid.content.events[0].choices[0].effects.push({ type: 'set-modifier', modifierId: 'bad', target: 'luck', operation: 'replace', value: 1, durationDays: 2, playerLabel: '运气' })
    invalid.content.events[0].choices[0].effects.push({ type: 'set-modifier', modifierId: 'infinite', target: 'product-demand', operation: 'add', productId: 'drink-missing', value: Number.POSITIVE_INFINITY, durationDays: Number.NaN, playerLabel: '坏数据' })

    const result = validateContent(invalid, 'production')
    expect(result.errors).toEqual(expect.arrayContaining([
      '$.content.events[0].scene.timing: 非法事件时段',
      '$.content.events[0].scene.location: 非法场景位置',
      '$.content.events[0].scene.actorRole: 非法角色类型',
      '$.content.events[0].conditions[0].weatherId: 引用不存在',
      '$.content.events[0].choices[0].impactHints[0].axis: 非法影响维度',
      '$.content.events[0].choices[0].impactHints[0].direction: 非法影响方向',
      '$.content.events[0].choices[0].effects[2].target: 不支持的长期效果目标',
      '$.content.events[0].choices[0].effects[2].operation: 不支持的长期效果运算',
      '$.content.events[0].choices[0].effects[3].productId: 引用不存在',
      '$.content.events[0].choices[0].effects[3].value: 必须是有限数值',
      '$.content.events[0].choices[0].effects[3].durationDays: 必须是有限数值',
    ]))
  })

  it('validates every authored chain variant instead of treating it as unchecked JSON', () => {
    const invalid = structuredClone(rawContent) as unknown as Record<string, any>
    invalid.content.chains[0].nodes[1].variants = [
      {
        variantId: 'same-route',
        conditions: [{ type: 'weather-is', weatherId: 'weather-missing' }],
        title: '分支一',
        content: '分支正文一',
        choices: [structuredClone(invalid.content.chains[0].nodes[1].choices[0])],
        scene: { timing: 'midnight', location: 'counter', actorRole: 'worker' },
      },
      {
        variantId: 'same-route',
        conditions: [],
        title: '分支二',
        content: '分支正文二',
        choices: structuredClone(invalid.content.chains[0].nodes[1].choices),
      },
    ]

    const result = validateContent(invalid, 'production')
    expect(result.errors).toEqual(expect.arrayContaining([
      '$.content.chains[0].nodes[1].variants[1].variantId: 重复 ID same-route',
      '$.content.chains[0].nodes[1].variants[0].conditions[0].weatherId: 引用不存在',
      '$.content.chains[0].nodes[1].variants[0].scene.timing: 非法事件时段',
      '$.content.chains[0].nodes[1].variants[0].choices: 必须恰好两个选择',
    ]))
  })
})
