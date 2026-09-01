import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { getContent } from '../content'
import { MigrationOverlay } from './MigrationOverlay'

describe('migration overlay', () => {
  it('renders two content-driven route choices without pausing the game canvas', () => {
    const routes = getContent().journey.stages[0].routeOffers
    const html = renderToStaticMarkup(<MigrationOverlay routes={routes} onSelect={() => undefined} />)

    expect(html).toContain('迁徙分岔')
    expect(html).toContain('藻光层')
    expect(html).toContain('酸性囊泡')
    expect(html).toContain('高密度藻糖')
    expect((html.match(/<button/g) ?? [])).toHaveLength(2)
    expect(html).not.toContain('aria-modal')
  })
})
