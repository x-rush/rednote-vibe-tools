import type { CSSProperties } from 'react'
import type { StarMessage } from '../content/messages'
import { sampleLetterFlight } from './letterFlight'

interface StarbornePhraseProps {
  readonly message: StarMessage
  readonly progress: number
  readonly complete: boolean
  readonly reducedMotion: boolean
}

export function StarbornePhrase({ message, progress, complete, reducedMotion }: StarbornePhraseProps) {
  const samples = sampleLetterFlight(message.text, progress, reducedMotion)
  return (
    <>
      <p className="starborne-phrase" data-letter-flight="true" aria-hidden="true">
        {samples.map((sample) => (
          <span
            className="starborne-char"
            data-flight-char
            key={`${message.id}-${sample.index}`}
            style={{
              '--flight-x': `${sample.translateX}px`,
              '--flight-y': `${sample.translateY}px`,
              '--flight-rotation': `${sample.rotationDeg}deg`,
              '--flight-blur': `${sample.blurPx}px`,
              '--flight-opacity': sample.opacity,
              '--flight-sparkle': sample.sparkle,
            } as CSSProperties}
          >
            {sample.character}
          </span>
        ))}
      </p>
      {complete && (
        <span className="starborne-announcement" aria-live="polite">
          {message.text}
        </span>
      )}
    </>
  )
}
