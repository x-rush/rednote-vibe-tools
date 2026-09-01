import type { CSSProperties } from 'react'
import type { StarMessage } from '../content/messages'
import type { ExperienceState } from '../experience/machine'

interface PhraseCarouselProps {
  readonly state: ExperienceState
  readonly selected?: StarMessage
  readonly visibleMessages: readonly StarMessage[]
  readonly progress: number
}

const PHRASE_REVEAL_DURATION_MS = 440
const PHRASE_REVEAL_STAGGER_MS = 220

function phraseTone(state: ExperienceState) {
  if (state.tag === 'wind' || state.tag === 'window-opening') return 'dimmed'
  if (state.tag === 'stars-entering') return 'returning'
  if (state.tag === 'result') return 'luminous'
  return 'clear'
}

export function PhraseCarousel({ state, selected, visibleMessages, progress }: PhraseCarouselProps) {
  const isChoosing = state.tag === 'spinning' || state.tag === 'slowing'
  const rows = isChoosing ? visibleMessages : selected ? [selected] : []
  const characterCount = selected ? Array.from(selected.text).length : 1
  const style = {
    '--phrase-progress': progress,
    '--phrase-reveal-duration': `${PHRASE_REVEAL_DURATION_MS}ms`,
    '--phrase-char-stagger': `${PHRASE_REVEAL_STAGGER_MS / Math.max(1, characterCount - 1)}ms`,
  } as CSSProperties

  return (
    <div
      className={`phrase-carousel phrase-carousel--${phraseTone(state)}`}
      data-phrase-mode={isChoosing ? 'chance' : 'reveal'}
      data-phrase-treatment="light-dust"
      data-reveal-total-ms={!isChoosing && selected ? PHRASE_REVEAL_DURATION_MS + PHRASE_REVEAL_STAGGER_MS : undefined}
      data-state={state.tag}
      style={style}
      aria-live={state.tag === 'selected' ? 'polite' : 'off'}
      aria-hidden={isChoosing ? true : undefined}
    >
      <div className="phrase-reel">
        {rows.map((message, index) => {
          const centerIndex = Math.floor(rows.length / 2)
          const offset = index - centerIndex
          const phraseWidth = Math.min(84, 34 + Array.from(message.text).length * 3.4)
          return (
            <p
              className="phrase-row"
              data-phrase-row
              data-offset={offset}
              aria-hidden={isChoosing && offset !== 0 ? true : undefined}
              aria-label={!isChoosing && offset === 0 ? message.text : undefined}
              key={message.id}
              style={{ '--phrase-width': `${phraseWidth}%` } as CSSProperties}
            >
              {isChoosing
                ? <span className="phrase-streak" aria-hidden="true" />
                : offset === 0
                ? Array.from(message.text).map((character, characterIndex) => (
                    <span
                      aria-hidden="true"
                      className="phrase-char"
                      data-phrase-char
                      key={`${message.id}-${characterIndex}`}
                      style={{ '--char-index': characterIndex } as CSSProperties}
                    >
                      {character}
                    </span>
                  ))
                : message.text}
            </p>
          )
        })}
        <span className="phrase-orbit" aria-hidden="true" />
      </div>
    </div>
  )
}
