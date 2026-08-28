import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Hud } from './Hud'

describe('swarm HUD feedback', () => {
  it('explains movement-only split retention and shows fusion progress', () => {
    const html = renderToStaticMarkup(<Hud snapshot={{
      membrane: 100,
      energy: 100,
      stability: 92,
      biomass: 320,
      peakBiomass: 320,
      evolutionThreshold: 400,
      elapsedMs: 8000,
      environmentId: 'env-clear-drop',
      paused: false,
      swarm: { bodyCount: 2, minimumRemainingMs: 0, fusionProgress: 0.5 },
    }} onPause={() => undefined} />)

    expect(html).toContain('群体 ×2')
    expect(html).toContain('游动保持，停下融合')
    expect(html).toContain('width:50%')
  })
})
