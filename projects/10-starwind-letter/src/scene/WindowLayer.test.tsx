import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { WindowLayer } from './WindowLayer'

describe('window scene markup', () => {
  it('renders a closed perspective window in the shared design space', () => {
    const html = renderToStaticMarkup(<WindowLayer openProgress={0} shakeProgress={0} />)
    expect(html).toContain('viewBox="0 0 390 844"')
    expect(html).toContain('data-layer="window-frame"')
    expect(html).toContain('data-layer="curtain-static"')
    expect(html).toContain('data-window-state="closed"')
  })

  it('marks the sash as open after the threshold', () => {
    const html = renderToStaticMarkup(<WindowLayer openProgress={0.8} shakeProgress={0} />)
    expect(html).toContain('data-window-state="open"')
  })
})
