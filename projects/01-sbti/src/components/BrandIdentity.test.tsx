import { renderToStaticMarkup } from 'react-dom/server'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import rawContent from '../content/content.json'
import { validateContent } from '../content/validate'
import { IntroPage } from './IntroPage'
import { LandingPage } from './LandingPage'

const content = validateContent(rawContent)
const copy = content.content.experience

describe('formal SHBTI identity', () => {
  beforeAll(() => {
    vi.stubGlobal('window', { localStorage: { getItem: () => null, setItem: vi.fn(), removeItem: vi.fn() } })
  })

  afterAll(() => vi.unstubAllGlobals())

  it('shows the formal name and Chinese meaning on the landing page', () => {
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
    expect(html).toContain(copy.identity.formalName)
    expect(html).toContain(copy.identity.chineseMeaning)
  })

  it('keeps the English expansion inside the pre-test explanation', () => {
    const html = renderToStaticMarkup(<IntroPage copy={copy} onBack={vi.fn()} onStart={vi.fn()} />)
    expect(html).toContain(copy.identity.englishExpansion)
    expect(html).toContain(copy.identity.boundary)
  })
})
