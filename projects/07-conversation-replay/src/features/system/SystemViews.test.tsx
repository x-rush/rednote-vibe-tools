import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { GuideRecall } from './SystemViews'

describe('GuideRecall', () => {
  it('shows the current Chiyan portrait above a companion dialogue', () => {
    const html = renderToStaticMarkup(
      <GuideRecall
        companion={{
          name: '迟言',
          role: '温和编辑搭档',
          pose: 'compose',
          featured: false,
          invitation: '这一步，我们把需要变成一个具体请求。',
          reassurance: '清楚请求不等于强迫答应。',
          autonomy: '是否使用，仍然由你决定。',
          imageSrc: '/assets/guide/chiyan-compose.webp',
          fallbackSrc: '/assets/guide/chiyan-placeholder.webp',
        }}
        boundaries={['不判断谁对谁错。']}
        page="请求 · 5 / 5"
        onClose={() => undefined}
        onExit={() => undefined}
      />,
    )

    expect(html).toContain('guide-recall-portrait')
    expect(html).toContain('/assets/guide/chiyan-compose.webp')
    expect(html).toContain('guide-dialogue')
    expect(html).toContain('这一步，我们把需要变成一个具体请求。')
    expect(html).toContain('清楚请求不等于强迫答应。')
    expect(html).toContain('是否使用，仍然由你决定。')
    expect(html).toContain('事实—感受—推测（待核对）—需要—可协商请求')
    expect(html.indexOf('guide-recall-portrait')).toBeLessThan(html.indexOf('guide-dialogue'))
  })
})
