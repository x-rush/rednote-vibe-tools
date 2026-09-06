import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { createBuildState } from '../evolution/build'
import { createResultViewModel } from '../app/view-model'
import { getContent } from '../content'
import { ResultOverlay } from './ResultOverlay'

describe('truthful result overlay', () => {
  it('renders authoritative outcome facts and immediate restart actions', () => {
    const model = createResultViewModel({
      events: [{ type: 'player-died', cause: 'predator-engulf', atMs: 360_000 }],
      finalBuild: createBuildState({ bodyStage: 'dominant', traitIds: ['organelle-flagellum'], routeCounts: { predation: 3, survival: 0, colony: 0 } }),
      journeyStageIndex: 4,
      environmentIds: ['env-clear-drop', 'env-algae-glow'],
      engulfScore: 6528,
      survivalMs: 360_000,
      seed: 727,
    }, getContent())
    const html = renderToStaticMarkup(<ResultOverlay model={model} onRestart={() => undefined} onLab={() => undefined} onReplaySeed={() => undefined} />)

    expect(html).toContain('吞噬')
    expect(html).toContain('统治体')
    expect(html).toContain('立即重生')
    expect(html).toContain('返回培养皿')
    expect(html).toContain('长鞭毛')
  })
})
