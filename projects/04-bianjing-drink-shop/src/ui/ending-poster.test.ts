import { describe, expect, it } from 'vitest'
import type { EndingPosterModel } from '../state/ending-poster'
import { POSTER_SIZE, posterSections } from './ending-poster'

const model: EndingPosterModel = {
  title: '汴京饮子铺：开店一百天', endingId: 'ending-neighbor-heart', endingTitle: '街坊自家人',
  endingContent: '铺子成了街坊说自家的地方。', evaluation: '你把人情经营成可往返的具体关系。', shareText: '百日灯火，街坊常坐。',
  operatingDays: 30, totalOperatingDays: 30, calendarDays: 100, totalCalendarDays: 100,
  totalSold: 214, profitDays: 19, lossDays: 9, breakEvenDays: 2, netMoneyChange: 166,
  stats: [{ id: 'money', label: '资金', value: 286 }, { id: 'reputation', label: '口碑', value: 58 }, { id: 'energy', label: '体力', value: 43 }, { id: 'relationships', label: '人情', value: 82 }],
  favoriteProduct: { productId: 'drink-green-plum', name: '青梅饮', sold: 72 },
  modeCounts: { full: 22, half: 5, rest: 3 }, completedChains: ['一碗换一诗', '灯会三折'],
  keyChoices: [{ title: '找错铜钱', choice: '把多收的铜钱还给老人' }], historyComplete: true,
}
const copy = {
  posterFavorite: '常售饮子', posterCupUnit: '盏', posterNoFavorite: '尚未形成常售饮子', posterNoChains: '这一回尚无完整连锁收束',
  posterStatsTitle: '收官账面', posterBusinessTitle: '百日经营', posterTotalSold: '共售出', posterProfitDays: '盈利', posterLossDays: '亏损',
  posterBreakEvenDays: '持平', posterDayUnit: '日', posterNetChange: '资金净变化', posterStoriesTitle: '铺中故事', posterShareTitle: '百日留句',
  posterTrackingTitle: '统计说明', posterLegacyTracking: '旧存档无法倒推早期销量；以上经营统计自本版本起记录，共', posterOperatingDayUnit: '个经营回合',
}

describe('ending poster drawing contract', () => {
  it('uses a 3:4 high-resolution poster and exposes every summary block', () => {
    expect(POSTER_SIZE).toEqual({ width: 1080, height: 1440 })
    expect(posterSections(model, copy)).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'ending', title: '街坊自家人' }),
      expect.objectContaining({ id: 'stats' }),
      expect.objectContaining({ id: 'business', body: expect.stringContaining('214') }),
      expect.objectContaining({ id: 'stories', body: expect.stringContaining('一碗换一诗') }),
      expect.objectContaining({ id: 'share', body: '百日灯火，街坊常坐。' }),
    ]))
  })

  it('prints an honest partial-history note for upgraded legacy saves', () => {
    expect(posterSections({ ...model, historyComplete: false, operatingDays: 7 }, copy)
      .some((section) => section.body.includes('自本版本起记录'))).toBe(true)
  })
})
