import { describe, expect, it } from 'vitest'
import { shopContent } from './index'
import type { BusinessEvent, EventChain } from '../domain/types'
import { validateEventPresentation, validateEventQuality } from './event-quality'

const choice = (overrides: Record<string, unknown> = {}) => ({
  choiceId: 'a',
  text: '认真处理',
  impactTags: [],
  impactHints: [{ axis: 'money', direction: 'down', text: '需要花一些钱' }],
  resultText: '你把该做的事料理妥当，柜前重新安稳下来。',
  effects: [{ type: 'money-delta', value: -3, labelId: 'event-a-a-money' }],
  followUpEventIds: [],
  ...overrides,
})

const event = (overrides: Record<string, unknown> = {}): BusinessEvent => ({
  eventId: 'event-a',
  title: '柜前小事',
  content: '午后柜前忽然忙乱起来，一位客人发现自己的杯盏拿错了。两边都赶着走，你得先把次序理清。',
  category: 'daily',
  weight: 1,
  dayRange: [1, 100],
  conditions: [],
  cooldownDays: 3,
  oncePerSave: false,
  conflictTags: [],
  tags: ['daily'],
  scene: { timing: 'business', location: 'counter', actorRole: 'worker' },
  choices: [choice(), choice({ choiceId: 'b', text: '先记下名字', effects: [
    { type: 'stat-delta', stat: 'reputation', value: 2, labelId: 'event-a-b-reputation' },
    { type: 'stat-delta', stat: 'energy', value: -2, labelId: 'event-a-b-energy' },
  ], impactHints: [
    { axis: 'reputation', direction: 'up', text: '有利于口碑' },
    { axis: 'energy', direction: 'down', text: '会多耗一些体力' },
  ] })],
  assetId: 'event-a-illustration',
  provisional: false,
  ...overrides,
} as BusinessEvent)

const contentWith = (events: BusinessEvent[], chains: EventChain[] = []) => ({ ...shopContent.content, events, chains })

describe('event content quality', () => {
  it('accepts authored presentation with hints matching immediate effects', () => {
    expect(validateEventPresentation([event()], [])).toEqual([])
    expect(validateEventQuality(contentWith([event()]))).toEqual([])
  })

  it('rejects title-template prose, internal codes, missing results, and reversed directions', () => {
    const invalid = event({
      content: '柜前小事摆在柜前，你要如何应对？',
      choices: [
        choice({ impactHints: [{ axis: 'money', direction: 'down', text: 'M' }], resultText: '' }),
        choice({ choiceId: 'b', effects: [{ type: 'money-delta', value: 3, labelId: 'event-a-b-money' }], impactHints: [{ axis: 'money', direction: 'down', text: '需要花一些钱' }] }),
      ],
    })

    expect(validateEventPresentation([invalid], [])).toEqual(expect.arrayContaining([
      'event-a.content: 禁止标题模板正文',
      'event-a/a.impactHints[0].text: 禁止内部缩写',
      'event-a/a.resultText: 必填',
      'event-a/b.impactHints[money]: 与确定效果方向不一致',
    ]))
  })

  it('rejects exact-number previews and choices outside the one-to-three hint limit', () => {
    const invalid = event({
      choices: [
        choice({ impactHints: [{ axis: 'money', direction: 'down', text: '当日资金减少 3 文' }] }),
        choice({ choiceId: 'b', impactHints: [
          { axis: 'money', direction: 'down', text: '会占用一笔现钱' },
          { axis: 'energy', direction: 'down', text: '会多耗一些体力' },
          { axis: 'reputation', direction: 'up', text: '可能抬高街面口碑' },
          { axis: 'future', direction: 'uncertain', text: '后续影响仍待观察' },
        ] }),
      ],
    })
    expect(validateEventPresentation([invalid], [])).toEqual(expect.arrayContaining([
      'event-a/a.impactHints[0].text: 确认前不得揭示精确数值',
      'event-a/b.impactHints: 必须包含 1–3 项',
    ]))
  })

  it('rejects a choice that has neither an immediate effect nor a real future consequence', () => {
    const emptyChoice = event({
      choices: [
        choice({ effects: [] }),
        choice({ choiceId: 'b' }),
      ],
    })

    expect(validateEventQuality(contentWith([emptyChoice]))).toContain(
      'event-a/a.effects: 选择没有任何可执行后果',
    )
  })

  it('rejects a future hint when the choice only has an immediate effect', () => {
    const falsePromise = event({
      choices: [
        choice({
          effects: [{ type: 'money-delta', value: -3, labelId: 'event-a-a-money' }],
          impactHints: [
            { axis: 'money', direction: 'down', text: '需要花一些钱' },
            { axis: 'future', direction: 'uncertain', text: '此事以后还会有变化' },
          ],
        }),
        choice({ choiceId: 'b' }),
      ],
    })

    expect(validateEventQuality(contentWith([falsePromise]))).toContain(
      'event-a/a.impactHints[future]: 长期提示没有真实后续',
    )
  })

  it('rejects an immediate cash loss below the crisis debt floor', () => {
    const ruinous = event({
      choices: [
        choice({ effects: [{ type: 'money-delta', value: -21, labelId: 'ruinous-loss' }] }),
        choice({ choiceId: 'b' }),
      ],
    })
    expect(validateEventQuality(contentWith([ruinous]))).toContainEqual(
      expect.stringContaining('即时现钱损失不得低于 -20'),
    )
  })

  it('rejects a counter-trading scene marked as rest eligible', () => {
    const invalid = event({ allowedOperatingModes: ['rest'], scene: { timing: 'business', location: 'counter', actorRole: 'merchant' } })
    expect(validateEventQuality(contentWith([invalid]))).toContainEqual(
      expect.stringContaining('休息日不得触发营业中事件'),
    )
  })

  it('rejects an option that is strictly worse on every modeled benefit without a distinct future', () => {
    const dominated = event({
      choices: [
        choice({
          effects: [{ type: 'stat-delta', stat: 'reputation', value: 3, labelId: 'event-a-a-reputation' }],
          impactHints: [{ axis: 'reputation', direction: 'up', text: '有利于街面口碑' }],
        }),
        choice({
          choiceId: 'b',
          effects: [{ type: 'stat-delta', stat: 'reputation', value: 1, labelId: 'event-a-b-reputation' }],
          impactHints: [{ axis: 'reputation', direction: 'up', text: '略有利于街面口碑' }],
        }),
      ],
    })

    expect(validateEventQuality(contentWith([dominated]))).toContain(
      'event-a/b: 被同事件另一选择严格支配',
    )
  })

  it('rejects flags without any event, chain, or ending consumer', () => {
    const flagged = event({ choices: [choice({ effects: [{ type: 'add-flag', flag: 'never-read' }], impactHints: [{ axis: 'future', direction: 'uncertain', text: '此事可能留下后续' }] }), choice({ choiceId: 'b' })] })
    expect(validateEventQuality(contentWith([flagged]))).toContain('flag:never-read: 没有任何条件消费')
  })

  it('rejects random, multiply referenced, or unreachable follow-up events', () => {
    const followUp = event({ eventId: 'event-follow-up', weight: 1, dayRange: [1, 5], oncePerSave: true, tags: ['follow-up'] })
    const starter = event({
      eventId: 'event-starter',
      dayRange: [10, 20],
      choices: [
        choice({ followUpEventIds: [followUp.eventId] }),
        choice({ choiceId: 'b', followUpEventIds: [followUp.eventId] }),
      ],
    })

    expect(validateEventQuality(contentWith([starter, followUp]))).toEqual(expect.arrayContaining([
      'event-follow-up.weight: 回访事件不得进入普通随机池',
      'event-follow-up: 必须且只能由一个前序选择排入队列',
      'event-starter/a.followUpEventIds[0]: 回访事件在最早可排期日已经过期',
      'event-starter/b.followUpEventIds[0]: 回访事件在最早可排期日已经过期',
    ]))
  })

  it('rejects malformed presentation enums and unsupported modifier targets', () => {
    const malformed = event({
      scene: { timing: 'midnight', location: 'palace', actorRole: 'emperor' },
      choices: [choice({ effects: [{ type: 'set-modifier', modifierId: 'bad', target: 'luck', operation: 'add', value: 1, durationDays: 2, playerLabel: '运气' }], impactHints: [{ axis: 'future', direction: 'uncertain', text: '日后或有变化' }] }), choice({ choiceId: 'b' })],
    })
    expect(validateEventPresentation([malformed], [])).toEqual(expect.arrayContaining([
      'event-a.scene.timing: 非法事件时段',
      'event-a.scene.location: 非法场景位置',
      'event-a.scene.actorRole: 非法角色类型',
      'event-a/a.effects[0].target: 不支持的长期效果目标',
    ]))
  })

  it.each([
    [['daily', 'weather-season'], 20],
    [['customer', 'market-supply'], 20],
    [['energy-self', 'neighborhood'], 20],
    [['risk', 'opportunity-growth'], 20],
  ] as const)('has complete authored presentation for %s', (categories, expectedCount) => {
    const events = shopContent.content.events.filter((item) => categories.includes(item.category as never))
    expect(events).toHaveLength(expectedCount)
    expect(events.flatMap((item) => item.choices)).toHaveLength(expectedCount * 2)
    expect(validateEventPresentation(events, [])).toEqual([])
  })

  it('uses exactly five explicit chain entrances in the growth group', () => {
    const entrances = shopContent.content.events.flatMap((item) => item.choices.flatMap((itemChoice) =>
      itemChoice.effects.filter((effect) => effect.type === 'start-chain'),
    ))
    expect(entrances).toHaveLength(5)
    expect(new Set(entrances.map((effect) => effect.type === 'start-chain' ? effect.chainId : '')).size).toBe(5)
  })

  it('validates authored branch choices and requires the complete two-then-four shape', () => {
    const chains = structuredClone(shopContent.content.chains)
    chains[0].nodes[1].variants![0].choices[0].effects = []
    chains[0].nodes[2].variants = chains[0].nodes[2].variants?.slice(0, 3)

    expect(validateEventQuality({ ...shopContent.content, chains })).toEqual(expect.arrayContaining([
      'chain-poet/poet-song-spreads/gentle-debt/a.effects: 选择没有任何可执行后果',
      'chain-poet.nodes[2].variants: 第三幕必须覆盖四种前序组合',
    ]))
  })

  it('passes the complete 92-event, 274-authored-choice production quality gate', () => {
    const ordinaryChoices = shopContent.content.events.flatMap((item) => item.choices)
    const chainChoices = shopContent.content.chains.flatMap((chain) => chain.nodes.flatMap((node) => node.choices))
    const variantChoices = shopContent.content.chains.flatMap((chain) => chain.nodes.flatMap((node) =>
      (node.variants ?? []).flatMap((variant) => variant.choices),
    ))
    expect(ordinaryChoices).toHaveLength(184)
    expect(chainChoices).toHaveLength(30)
    expect(variantChoices).toHaveLength(60)
    expect([...ordinaryChoices, ...chainChoices, ...variantChoices].every((itemChoice) =>
      (itemChoice.impactHints?.length ?? 0) >= 1 && (itemChoice.impactHints?.length ?? 0) <= 3 && (itemChoice.resultText?.length ?? 0) >= 12,
    )).toBe(true)
    expect(validateEventQuality(shopContent.content)).toEqual([])
  })
})
