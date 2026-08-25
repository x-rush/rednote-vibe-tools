import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { GuidePortraitCard } from './GuidePortraitCard.tsx'

const sharedProps = {
  imageSrc: '/assets/wuhualu/guide/guide-master-v1.webp',
  imageAlt: '闭馆整理员许照手持档案站在工作台前',
  guideName: '许照',
  guideRole: '闭馆整理员',
  line: '今晚一起把五件旧物送回它们的档案。',
}

describe('GuidePortraitCard', () => {
  it('renders the master portrait as the landing workbench companion', () => {
    const markup = renderToStaticMarkup(<GuidePortraitCard {...sharedProps} variant="landing" />)

    expect(markup).toContain('guide-portrait-card--landing')
    expect(markup).toContain('width="900"')
    expect(markup).toContain('height="1200"')
    expect(markup).toContain('aspect-ratio:3 / 4')
    expect(markup).toContain('object-fit:contain')
    expect(markup).toContain('闭馆整理员许照手持档案站在工作台前')
    expect(markup).toContain('今晚一起把五件旧物送回它们的档案。')
  })

  it('renders the same portrait in the uncropped onboarding treatment', () => {
    const markup = renderToStaticMarkup(<GuidePortraitCard {...sharedProps} variant="intro" />)

    expect(markup).toContain('guide-portrait-card--intro')
    expect(markup).toContain('guide-portrait-card__media')
    expect(markup).toContain('aspect-ratio:3 / 4')
    expect(markup).toContain('object-fit:contain')
    expect(markup).toContain('闭馆整理员 · 许照')
  })
})
