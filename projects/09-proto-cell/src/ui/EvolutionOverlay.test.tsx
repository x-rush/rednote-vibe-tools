import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { mutationContext } from '../tests/fixtures'
import { offerMutations } from '../evolution/mutation'
import { EvolutionOverlay } from './EvolutionOverlay'

describe('evolution overlay', () => {
  it('renders three content-driven tap choices and one confirmation action', () => {
    const html = renderToStaticMarkup(
      <EvolutionOverlay choices={offerMutations(mutationContext())} onConfirm={() => undefined} />,
    )

    expect(html).toContain('膜正在重写自己')
    expect(html).toContain('确认进化')
    expect((html.match(/class="evolution-choice"/g) ?? [])).toHaveLength(3)
    expect((html.match(/data-anchor=/g) ?? [])).toHaveLength(3)
    expect(html).toContain('disabled=""')
    expect(html).not.toContain('draggable')
  })

  it('warns which installed organ a full-body choice will replace', () => {
    const html = renderToStaticMarkup(
      <EvolutionOverlay
        choices={offerMutations(mutationContext({
          organIds: ['organelle-flagellum'],
          matureOrganIds: ['organelle-flagellum'],
          capacity: 1,
        }))}
        onConfirm={() => undefined}
      />,
    )

    expect(html).toContain('将替换')
    expect(html).toContain('长鞭毛')
  })
})
