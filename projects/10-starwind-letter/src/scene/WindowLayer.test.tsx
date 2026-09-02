import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { WindowLayer } from './WindowLayer'

describe('window scene markup', () => {
  it('renders a fixed frame, layered night sky, dimensional moon, and projected window shadow', () => {
    const html = renderToStaticMarkup(<WindowLayer revealProgress={1} />)
    expect(html).toContain('viewBox="0 0 390 844"')
    expect(html).toContain('data-window-state="fixed"')
    expect(html).toContain('data-layer="fixed-window-frame"')
    expect(html).toContain('data-layer="moon-crescent"')
    expect(html.match(/data-layer="moon-halo"/g)).toHaveLength(3)
    expect(html.match(/data-layer="starfield-depth"/g)).toHaveLength(3)
    expect(html).toContain('data-layer="star-mist"')
    expect(html.match(/data-layer="tyndall-beam"/g)).toHaveLength(2)
    expect(html).toContain('mix-blend-mode:screen')
    expect(html).toContain('data-layer="tyndall-dust"')
    expect(html).toContain('data-sky-tone="near-black"')
    expect(html.match(/data-layer="floor-window-pane"/g)).toHaveLength(2)
    expect(html.match(/data-layer="projected-window-frame-shadow"/g)).toHaveLength(3)
    expect(html.match(/data-layer="projected-sash-shadow"/g)).toHaveLength(1)
    expect(html).not.toContain('data-layer="projected-window-light"')
    expect(html).not.toContain('data-layer="projected-window-frame"')
    expect(html).not.toContain('data-layer="moonlight-plane"')
    expect(html).not.toContain('data-layer="window-sash"')
    expect(html).not.toContain('window-handle')
  })

  it('keeps the room dark before the curtain reveal', () => {
    const html = renderToStaticMarkup(<WindowLayer revealProgress={0} />)
    expect(html).toContain('data-interior-light="dark"')
    expect(html).toContain('data-layer="volumetric-moonlight" opacity="0"')
    expect(html).toContain('data-layer="floor-window-projection" opacity="0"')
  })
})
