import { describe, expect, it } from 'vitest'
import type { DayContext, EventChain, EventChainNode } from '../domain/types'
import { makeState } from '../tests/fixtures'
import { resolveChainChoice, resolveChainNodePresentation, selectDailyEvent } from './events'

const context: DayContext = {
  day: 10,
  operatingDay: 4,
  weatherId: 'weather-clear',
  seasonId: 'season-early-spring',
  eventVisitorDelta: 0,
  activeTags: [],
}

const baseChoice = {
  choiceId: 'a',
  text: '基础选择',
  impactHints: [{ axis: 'money' as const, direction: 'down' as const, text: '会占用现钱' }],
  resultText: '你按基础办法处理了这件事情。',
  effects: [{ type: 'money-delta' as const, value: -2, labelId: 'base-money' }],
  followUpEventIds: [],
}

const node = {
  nodeId: 'test-node',
  title: '基础标题',
  content: '基础正文',
  minDelayDays: 1,
  maxDelayDays: 5,
  choices: [baseChoice, { ...baseChoice, choiceId: 'b' }],
  scene: { timing: 'business' as const, location: 'counter' as const, actorRole: 'worker' as const },
  conditions: [],
  interruptionText: '此事错过了时机。',
  assetId: 'test-node-illustration',
  variants: [
    {
      variantId: 'gentle',
      conditions: [{ type: 'has-flag' as const, flag: 'route-gentle' }],
      title: '宽缓之后',
      content: '此前留了情面，这次对方主动回来。',
      choices: [
        { ...baseChoice, text: '照旧宽缓' },
        { ...baseChoice, choiceId: 'b', text: '这次写清界线' },
      ],
    },
    {
      variantId: 'strict',
      conditions: [{ type: 'has-flag' as const, flag: 'route-strict' }],
      title: '立据之后',
      content: '此前写清了界线，这次对方带着账据回来。',
      choices: [
        { ...baseChoice, text: '按据办妥', effects: [{ type: 'money-delta' as const, value: -7, labelId: 'strict-money' }] },
        { ...baseChoice, choiceId: 'b', text: '另留余地' },
      ],
    },
  ],
} satisfies EventChainNode

describe('chain node presentation variants', () => {
  it('selects the one authored branch whose conditions match prior choices', () => {
    const resolved = resolveChainNodePresentation(node, makeState({ flags: ['route-gentle'] }), context)

    expect(resolved).toMatchObject({
      variantId: 'gentle',
      title: '宽缓之后',
      content: '此前留了情面，这次对方主动回来。',
    })
    expect(resolved.choices.map((choice) => choice.text)).toEqual(['照旧宽缓', '这次写清界线'])
  })

  it('uses a frozen variant id even if the live flags later change', () => {
    const resolved = resolveChainNodePresentation(node, makeState({ flags: ['route-gentle'] }), context, 'strict')

    expect(resolved).toMatchObject({ variantId: 'strict', title: '立据之后' })
  })

  it('rejects ambiguous branch conditions instead of silently choosing the first', () => {
    expect(() => resolveChainNodePresentation(
      node,
      makeState({ flags: ['route-gentle', 'route-strict'] }),
      context,
    )).toThrow('连锁节点分支条件重叠：test-node/gentle,strict')
  })

  it('returns the resolved branch and stable variant id when a chain event is selected', () => {
    const chain: EventChain = {
      chainId: 'chain-test',
      title: '测试连锁',
      startEventId: 'event-start',
      startChoiceId: 'a',
      startDayMax: 90,
      nodes: [{ ...node, nodeId: 'first', variants: undefined }, node],
    }
    const state = makeState({
      flags: ['route-gentle'],
      chainProgress: {
        'chain-test': {
          chainId: 'chain-test',
          status: 'active',
          nodeIndex: 0,
          currentNodeId: 'first',
          startedDay: 4,
          lastAdvancedDay: 5,
        },
      },
    })

    expect(selectDailyEvent(state, context, { events: [], chains: [chain] } as never)).toMatchObject({
      kind: 'chain',
      chainId: 'chain-test',
      nodeId: 'test-node',
      variantId: 'gentle',
      node: { title: '宽缓之后' },
    })
  })

  it('applies the frozen branch choice instead of resolving again from changed flags', () => {
    const chain: EventChain = {
      chainId: 'chain-test',
      title: '测试连锁',
      startEventId: 'event-start',
      startChoiceId: 'a',
      startDayMax: 90,
      nodes: [node],
    }
    const state = makeState({ flags: ['route-gentle'] })

    const resolved = resolveChainChoice(state, chain, 'test-node', 'a', context, 'strict')

    expect(resolved.state.money).toBe(113)
  })
})
