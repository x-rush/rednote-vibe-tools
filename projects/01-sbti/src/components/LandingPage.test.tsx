import { renderToStaticMarkup } from 'react-dom/server'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import rawContent from '../content/content.json'
import { validateContent } from '../content/validate'
import { LandingPage } from './LandingPage'

const copy = validateContent(rawContent).content.experience

describe('landing guide scene', () => {
  beforeAll(() => {
    vi.stubGlobal('window', { localStorage: { getItem: () => null, setItem: vi.fn(), removeItem: vi.fn() } })
  })

  afterAll(() => vi.unstubAllGlobals())

  it('uses the full Wenshan portrait without repeating a miniature avatar', () => {
    const html = renderToStaticMarkup(
      <LandingPage
        copy={copy}
        hasRecent={false}
        muted={false}
        reducedMotion={false}
        onIntro={vi.fn()}
        onRestart={vi.fn()}
        onContinue={vi.fn()}
        onHistory={vi.fn()}
        onMuted={vi.fn()}
        onReducedMotion={vi.fn()}
        onClear={vi.fn()}
      />,
    )

    expect(html.match(/<img/g)).toHaveLength(1)
    expect(html).toContain('guide-master-v1.webp')
    expect(html).toContain('请闻山说明当前卷页')
  })
})
