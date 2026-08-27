import { renderToStaticMarkup } from 'react-dom/server'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { AyuanStage } from './AyuanStage'

describe('Ayuan light-Galgame stage', () => {
  it('renders a semantic settlement stage without inline positioning', () => {
    const html = renderToStaticMarkup(<AyuanStage
      variant="settlement"
      tone="warning"
      name="阿沅"
      role="饮子铺店伙计 · 记账搭档"
      text="今日滞销吃掉了不少进项。"
    />)

    expect(html).toContain('class="ayuan-stage ayuan-stage-settlement ayuan-tone-warning"')
    expect(html).toContain('src="./assets/guide/ayuan-master.webp"')
    expect(html).toContain('alt="阿沅"')
    expect(html).toContain('今日滞销吃掉了不少进项。')
    expect(html).toContain('aria-labelledby="ayuan-settlement-name"')
    expect(html).not.toContain('style=')
  })

  it('uses distinct preparation and rest variants', () => {
    const preparation = renderToStaticMarkup(<AyuanStage variant="preparation" tone="neutral" name="阿沅" role="搭档" text="先看今日天色。" />)
    const rest = renderToStaticMarkup(<AyuanStage variant="rest" tone="positive" name="阿沅" role="搭档" text="今日关火歇一日。" />)

    expect(preparation).toContain('ayuan-stage-preparation')
    expect(rest).toContain('ayuan-stage-rest')
  })

  it('supports a dedicated large crisis stage', () => {
    const html = renderToStaticMarkup(<AyuanStage variant="crisis" tone="warning" name="阿沅" role="搭档" text="眼前所得和以后代价都要看清。" />)
    expect(html).toContain('ayuan-stage-crisis')
    expect(html).toContain('眼前所得和以后代价都要看清')
  })

  it('supports large morning and tutorial stages with supplemental dialogue content', () => {
    const MorningStage = AyuanStage as (props: {
      variant: 'morning' | 'tutorial'
      tone: 'neutral'
      name: string
      role: string
      text: string
      children?: ReactNode
    }) => ReactNode
    const morning = renderToStaticMarkup(<MorningStage variant="morning" tone="neutral" name="阿沅" role="搭档" text="先看今日天色。" />)
    const tutorial = renderToStaticMarkup(<MorningStage variant="tutorial" tone="neutral" name="阿沅" role="搭档" text="先看清本金。"><div className="guide-dots">进度</div></MorningStage>)

    expect(morning).toContain('ayuan-stage-morning')
    expect(morning).toContain('ayuan-portrait ayuan-portrait-natural')
    expect(tutorial).toContain('ayuan-stage-tutorial')
    expect(tutorial).toContain('class="guide-dots"')
  })
})
