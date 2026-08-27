import { describe, expect, it } from 'vitest'
import { shopContent } from '../content'
import { makeState } from '../tests/fixtures'
import { buildEndingPosterModel } from './ending-poster'

describe('ending share poster model', () => {
  it('summarizes the completed campaign from persisted cumulative facts', () => {
    const state = makeState({
      day: 100,
      operatingDay: 30,
      page: 'finalEnding',
      currentEndingId: 'ending-neighbor-heart',
      money: 286,
      reputation: 58,
      energy: 43,
      relationships: 82,
      campaignTotals: {
        trackedOperatingDays: 30,
        totalSold: 214,
        profitDays: 19,
        lossDays: 9,
        breakEvenDays: 2,
        productSold: { 'drink-green-plum': 72, 'drink-ginger-honey': 38 },
      },
      decisionSummaries: [
        { day: 94, productIds: ['drink-green-plum'], prepared: 8, averagePrice: 7, operatingMode: 'full' },
        { day: 96, productIds: [], prepared: 0, averagePrice: 0, operatingMode: 'rest' },
        { day: 98, productIds: ['drink-ginger-honey'], prepared: 5, averagePrice: 9, operatingMode: 'half' },
      ],
      chainProgress: {
        'chain-poet': { chainId: 'chain-poet', status: 'completed', nodeIndex: 2, startedDay: 4, lastAdvancedDay: 42 },
      },
      eventHistory: [{ day: 92, eventId: 'event-wrong-change-returned', choiceId: 'a', moneyDelta: -3, statDeltas: { reputation: 5 } }],
    })

    expect(buildEndingPosterModel(state, shopContent.content)).toMatchObject({
      endingId: 'ending-neighbor-heart',
      endingTitle: '街坊自家人',
      operatingDays: 30,
      calendarDays: 100,
      totalSold: 214,
      profitDays: 19,
      lossDays: 9,
      breakEvenDays: 2,
      netMoneyChange: 166,
      favoriteProduct: { name: '青梅饮', sold: 72 },
      modeCounts: { full: 1, half: 1, rest: 1 },
      completedChains: ['一碗换一诗'],
      historyComplete: true,
    })
  })

  it('marks legacy saves as partial instead of inventing historical sales', () => {
    const state = makeState({ day: 100, operatingDay: 30, page: 'finalEnding', currentEndingId: 'ending-hundred-days' })

    expect(buildEndingPosterModel(state, shopContent.content)).toMatchObject({
      totalSold: 0,
      favoriteProduct: undefined,
      historyComplete: false,
    })
  })
})
