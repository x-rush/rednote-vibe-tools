import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { MorningIntelView } from '../state/view-model'
import { MorningIntel } from './MorningIntel'

const intel: MorningIntelView = {
  weatherName: '骤雨', weatherEffect: '行人避雨，清凉饮子转淡',
  marketSignal: '码头散工提早收工，偏暖口味会多些。', seasonName: '长夏',
  yesterdayInsight: '昨日复盘：上架 3 种、共备 12 盏。',
}

describe('morning intelligence stage', () => {
  it('puts exact operating clues beside a large Galgame portrait', () => {
    const html = renderToStaticMarkup(<MorningIntel intel={intel} name="阿沅" role="饮子铺店伙计 · 记账搭档" hint="先照情报排菜单。" copy={{
      todayIntel: '今日情报', forecastWeatherLabel: '今日天色', marketSignalLabel: '街面消息',
      yesterdayInsightLabel: '昨日复盘', goPreparation: '去备货',
    }} onContinue={() => {}} />)
    expect(html).toContain('ayuan-stage-morning')
    expect(html).toContain('骤雨')
    expect(html).toContain('行人避雨，清凉饮子转淡')
    expect(html).toContain('码头散工提早收工')
    expect(html).toContain('昨日复盘：上架 3 种、共备 12 盏')
    expect(html).toContain('去备货')
  })
})
