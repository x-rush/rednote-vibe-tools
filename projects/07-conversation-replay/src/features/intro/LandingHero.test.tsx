import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { LandingHero } from './LandingHero'

describe('LandingHero', () => {
  it('renders an illustrated editorial hero instead of a companion note', () => {
    const html = renderToStaticMarkup(<LandingHero
      companion={{
        name: '迟言',
        role: '温和编辑搭档',
        pose: 'welcome',
        featured: false,
        invitation: '如果愿意，我陪你从一个最接近的情境开始。',
        reassurance: '不用贴聊天记录，也不用一次讲完整。',
        autonomy: '你可以随时停下，决定权一直在你。',
        imageSrc: '/assets/guide/chiyan-guide-master.webp',
        fallbackSrc: '/assets/guide/chiyan-placeholder.webp',
      }}
      beforeText="你根本不在乎我。"
      afterText="约定时间过去后，我没有收到回复。"
    />)

    expect(html).toContain('landing-hero')
    expect(html).toContain('landing-hero-art')
    expect(html).toContain('你根本不在乎我。')
    expect(html).toContain('约定时间过去后，我没有收到回复。')
    expect(html).toContain('如果愿意，我陪你从一个最接近的情境开始。')
    expect(html).toContain('你可以随时停下，决定权一直在你。')
    expect(html).not.toContain('companion-note')
    expect(html).not.toContain('textbox')
  })
})
