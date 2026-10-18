import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { getContent } from '../content'
import { createNursery } from '../progression/lineage'
import { Nursery } from './Nursery'

describe('nursery interface', () => {
  it('exposes session-only storage instead of promising persistent offspring', () => {
    const content = getContent()
    const html = renderToStaticMarkup(<Nursery content={content} nursery={createNursery()} reducedMotion={false} storageMode="session" onHatch={() => undefined} onSelect={() => undefined} onRetire={() => undefined} onClose={() => undefined} />)
    expect(html).toContain(content.ui.screens.storageFallback)
    expect(html).not.toContain(content.ui.labels.lineageLocal)
  })
  it('explains an empty seed bank and keeps the exit reachable', () => {
    const content = getContent()
    const html = renderToStaticMarkup(<Nursery content={content} nursery={createNursery()} reducedMotion={false} onHatch={() => undefined} onSelect={() => undefined} onRetire={() => undefined} onClose={() => undefined} />)
    expect(html).toContain(content.ui.screens.nurseryEmpty)
    expect(html).toContain(content.ui.actions.backToLab)
    expect(html).not.toContain('class="nursery-incubation"')
  })
})
