import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import rawContent from '../content/content.json'
import { parseContent } from '../content/validate.ts'
import { NarrativeInterlude } from './NarrativeInterlude.tsx'

const narrative = parseContent(rawContent).content.narrative
const chapter = narrative.chapters[0]

describe('Xu Zhao narrative interlude', () => {
  it('renders one mobile-readable beat with the fictional-story boundary', () => {
    const markup = renderToStaticMarkup(
      <NarrativeInterlude
        chapter={chapter}
        fictionLabel={narrative.fictionLabel}
        recentResponse={null}
        replay={false}
        continueLabel={narrative.continueActionLabel}
        deferLabel={narrative.deferActionLabel}
        onComplete={() => undefined}
        onDefer={() => undefined}
      />,
    )

    expect(markup).toContain(narrative.fictionLabel)
    expect(markup).toContain(chapter.beats[0].body)
    expect(markup).not.toContain(chapter.beats[1].body)
    expect(markup).toContain('narrative-interlude__portrait')
    expect(markup).toContain('稍后再看')
  })

  it('does not offer deferral for the finale or a replay', () => {
    const finale = narrative.chapters.at(-1)
    if (!finale) throw new Error('missing finale')
    const markup = renderToStaticMarkup(
      <NarrativeInterlude
        chapter={finale}
        fictionLabel={narrative.fictionLabel}
        recentResponse={null}
        replay
        continueLabel={narrative.continueActionLabel}
        deferLabel={narrative.deferActionLabel}
        onComplete={() => undefined}
        onDefer={() => undefined}
      />,
    )

    expect(markup).not.toContain('稍后再看')
  })
})
