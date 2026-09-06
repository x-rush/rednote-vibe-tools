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
      engulfScore: 320,
      journeyIndex: 1,
      journeyTotal: 6,
      bodyStage: 'microbe',
      bodyStageProgress: 0.8,
      formId: 'form-primal-cell',
      tierIndex: 0,
      tierProgress: 0.8,
      membraneRatio: 1,
      swarm: { bodyCount: 2, minimumRemainingMs: 0, fusionProgress: 0.5 },
    }} onPause={() => undefined} />)

    expect(html).toContain('群体 ×2')
    expect(html).toContain('游动保持，停下融合')
    expect(html).toContain('width:50%')
  })

  it('renders score, journey, body stage, progress, membrane, and pause only', () => {
    const html = renderToStaticMarkup(<Hud snapshot={{
      membrane: 82,
      energy: 100,
      stability: 100,
      biomass: 144,
      peakBiomass: 144,
      evolutionThreshold: 240,
      elapsedMs: 0,
      environmentId: 'env-clear-drop',
      paused: false,
      engulfScore: 6528,
      journeyIndex: 1,
      journeyTotal: 6,
      bodyStage: 'microbe',
      bodyStageProgress: 0.32,
      formId: 'form-primal-cell',
      tierIndex: 0,
      tierProgress: 0.32,
      membraneRatio: 0.82,
    }} onPause={() => undefined} />)

    expect(html).toContain('6528')
    expect(html).toContain('01/06')
    expect(html).toContain('微生体')
    expect(html).toContain('82%')
    expect(html).not.toContain('能量')
    expect(html).not.toContain('稳定度')
  })
})
