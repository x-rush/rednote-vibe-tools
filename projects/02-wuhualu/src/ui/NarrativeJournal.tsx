import type { NarrativeChapterId, NarrativeContent } from '../content/types.ts'
import type { NarrativeJournalModel } from '../app/page-model.ts'

type NarrativeJournalProps = {
  narrative: NarrativeContent
  model: NarrativeJournalModel
  onOpen: (chapterId: NarrativeChapterId) => void
}

export function NarrativeJournal({ narrative, model, onOpen }: NarrativeJournalProps) {
  return (
    <section className={`narrative-journal${model.complete ? ' narrative-journal--complete' : ''}`} aria-labelledby="journal-title">
      <header>
        <div>
          <p>{narrative.fictionLabel}</p>
          <h2 id="journal-title">{narrative.journalTitle}</h2>
        </div>
        {model.complete && <span className="narrative-journal__seal">{narrative.completionSeal}</span>}
      </header>
      <p className="narrative-journal__intro">{model.complete ? narrative.completionLine : narrative.journalIntro}</p>
      <ol>
        {model.entries.filter(({ unlocked }) => unlocked).map((entry, index) => {
          const canOpen = model.pendingId === entry.id || model.replayableIds.includes(entry.id)
          return (
            <li key={entry.id} className={entry.seen ? 'is-seen' : entry.deferred ? 'is-deferred' : 'is-new'}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <div><strong>{entry.title}</strong><p>{entry.summary}</p></div>
              {canOpen && (
                <button type="button" onClick={() => onOpen(entry.id)}>
                  {model.pendingId === entry.id ? narrative.pendingActionLabel : narrative.replayActionLabel}
                </button>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
