import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ScreenFrame } from './ScreenFrame'

describe('ScreenFrame', () => {
  it('declares its surface and a stable programmatic focus target', () => {
    const html = renderToStaticMarkup(
      <ScreenFrame className="guide-screen" labelledBy="guide-title" surface="dark">
        <h1 id="guide-title">Guide</h1>
      </ScreenFrame>,
    )

    expect(html).toContain('id="screen-root"')
    expect(html).toContain('tabindex="-1"')
    expect(html).toContain('surface-dark')
    expect(html).toContain('screen-entering')
    expect(html).toContain('aria-labelledby="guide-title"')
  })
})
