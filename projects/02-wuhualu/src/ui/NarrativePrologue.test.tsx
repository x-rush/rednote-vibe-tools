import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import rawContent from '../content/content.json'
import { parseContent } from '../content/validate.ts'
import { NarrativePrologue } from './NarrativePrologue.tsx'

const narrative = parseContent(rawContent).content.narrative

describe('first-time narrative prologue', () => {
  it('keeps every prologue beat beside the existing onboarding flow', () => {
    const markup = renderToStaticMarkup(<NarrativePrologue fictionLabel={narrative.fictionLabel} beats={narrative.prologue} />)

    expect(markup).toContain(narrative.fictionLabel)
    for (const beat of narrative.prologue) expect(markup).toContain(beat.body)
  })
})
