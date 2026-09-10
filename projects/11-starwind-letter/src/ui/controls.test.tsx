import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ReplayControl } from './ReplayControl'
import { SoundToggle } from './SoundToggle'

describe('experience controls', () => {
  it('exposes the current sound state with a semantic button', () => {
    const html = renderToStaticMarkup(<SoundToggle muted={false} onToggle={() => undefined} />)
    expect(html).toContain('<button')
    expect(html).toContain('aria-label="关闭音效"')
  })

  it('uses the approved lightweight replay copy', () => {
    const html = renderToStaticMarkup(<ReplayControl onReplay={() => undefined} />)
    expect(html).toContain('再听一次星空')
    expect(html).toContain('<button')
  })
})
