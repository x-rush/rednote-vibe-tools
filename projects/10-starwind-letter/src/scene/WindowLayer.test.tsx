import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { WindowLayer } from './WindowLayer'

describe('window scene markup', () => {
  it('renders a fixed frame, clear crescent, and two moonlight planes without a sash', () => {
    const html = renderToStaticMarkup(<WindowLayer revealProgress={1} />)
    expect(html).toContain('viewBox="0 0 390 844"')
    expect(html).toContain('data-window-state="fixed"')
    expect(html).toContain('data-layer="fixed-window-frame"')
    expect(html).toContain('data-layer="moon-crescent"')
    expect(html.match(/data-layer="moonlight-plane"/g)).toHaveLength(2)
    expect(html).not.toContain('data-layer="window-sash"')
    expect(html).not.toContain('window-handle')
  })

  it('keeps the room dark before the curtain reveal', () => {
    const html = renderToStaticMarkup(<WindowLayer revealProgress={0} />)
    expect(html).toContain('data-interior-light="dark"')
  })
})
