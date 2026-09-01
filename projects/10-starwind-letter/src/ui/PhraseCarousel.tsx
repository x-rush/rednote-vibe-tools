import type { CSSProperties } from 'react'
import type { StarMessage } from '../content/messages'
import type { ExperienceState } from '../experience/machine'

interface PhraseCarouselProps {
  readonly state: ExperienceState
  readonly selected?: StarMessage
  readonly visibleMessages: readonly StarMessage[]
  readonly progress: number
}

function phraseTone(state: ExperienceState) {
  if (state.tag === 'wind' || state.tag === 'window-opening') return 'dimmed'
  if (state.tag === 'stars-entering') return 'returning'
  if (state.tag === 'result') return 'luminous'
  return 'clear'
}

export function PhraseCarousel({ state, selected, visibleMessages, progress }: PhraseCarouselProps) {
  const isChoosing = state.tag === 'spinning' || state.tag === 'slowing'
  const rows = isChoosing ? visibleMessages : selected ? [selected] : []
  const style = { '--phrase-progress': progress } as CSSProperties

  return (
    <div
      className={`phrase-carousel phrase-carousel--${phraseTone(state)}`}
      data-phrase-treatment="light-dust"
      data-state={state.tag}
      style={style}
      aria-live={state.tag === 'selected' ? 'polite' : 'off'}
    >
      <div className="phrase-reel">
        {rows.map((message, index) => {
          const centerIndex = Math.floor(rows.length / 2)
          const offset = index - centerIndex
          return (
            <p
              className="phrase-row"
              data-phrase-row
              data-offset={offset}
              aria-hidden={isChoosing && offset !== 0 ? true : undefined}
              key={message.id}
            >
              {message.text}
            </p>
          )
        })}
      </div>
    </div>
  )
}
