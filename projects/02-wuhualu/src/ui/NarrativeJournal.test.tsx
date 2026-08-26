import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import rawContent from '../content/content.json'
import { parseContent } from '../content/validate.ts'
import { buildNarrativeJournalModel } from '../app/page-model.ts'
import { NarrativeJournal } from './NarrativeJournal.tsx'

const narrative = parseContent(rawContent).content.narrative

describe('closed-museum narrative journal', () => {
  it('offers the first pending chapter without exposing locked chapter copy', () => {
    const model = buildNarrativeJournalModel(narrative, 4, ['act-1'], [])
    const markup = renderToStaticMarkup(<NarrativeJournal narrative={narrative} model={model} onOpen={() => undefined} />)

    expect(markup).toContain(narrative.journalTitle)
    expect(markup).toContain(narrative.pendingActionLabel)
    expect(markup).toContain(narrative.chapters[1].title)
    expect(markup).not.toContain(narrative.chapters[2].title)
  })

  it('shows the shared completion seal and finale replay at 20/20', () => {
    const seen = narrative.chapters.map(({ id }) => id)
    const model = buildNarrativeJournalModel(narrative, 20, seen, [])
    const markup = renderToStaticMarkup(<NarrativeJournal narrative={narrative} model={model} onOpen={() => undefined} />)

    expect(markup).toContain(narrative.completionSeal)
    expect(markup).toContain(narrative.completionLine)
    expect(markup).toContain(narrative.replayActionLabel)
  })
})
