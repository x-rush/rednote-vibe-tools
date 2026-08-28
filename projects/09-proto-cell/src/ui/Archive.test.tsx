import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { createRef } from 'react'
import { createViewModel } from '../app/view-model'
import { eventLog, testContent } from '../tests/fixtures'
import { Archive } from './Archive'

describe('life archive panel', () => {
  it('renders the immediate restart as its first and largest focusable action', () => {
    const log = eventLog([{ type: 'player-died', cause: 'engulfed', atMs: 9000 }])
    log[0]!.snapshot = {
      runSeed: 727,
      elapsedMs: 9000,
      environmentId: 'env-clear-drop',
      biomass: 0,
      peakBiomass: 188,
      organelleIds: [],
      morphology: { bodyCount: 2, totalMass: 188, radius: 10, stability: 82, organelles: [] },
    }
    const model = createViewModel({
      screen: 'result',
      eventLog: log,
    }, testContent()).archive!
    const html = renderToStaticMarkup(
      <Archive
        model={model}
        restartButtonRef={createRef<HTMLButtonElement>()}
        onRestart={() => undefined}
        onKeyDown={() => undefined}
      />,
    )

    expect(html).toContain('再次孵化')
    expect(html).toContain('archive-panel__restart')
    expect((html.match(/<button/g) ?? [])).toHaveLength(1)
    expect(html).toContain('轮廓在更大的膜内消失')
    expect(html).toContain('data-body-count="2"')
    expect(html).toContain('archive-cell__satellite--1')
  })
})
