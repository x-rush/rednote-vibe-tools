import { useState } from 'react'
import type { MemoryChallenge as MemoryChallengeData } from '../content/types.ts'

type MemoryChallengeProps = {
  challenge: MemoryChallengeData
  answeredId: string | null
  onAnswer: (optionId: string) => void
  onArchive: () => void
  copy: { eyebrow: string; title: string; submit: string; correct: string; incorrect: string; archive: string }
}

export function MemoryChallenge({ challenge, answeredId, onAnswer, onArchive, copy }: MemoryChallengeProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const answered = answeredId !== null
  return (
    <section className="memory-card" aria-labelledby="memory-title">
      <p className="section-label">{copy.eyebrow}</p>
      <h1 id="memory-title">{copy.title}</h1>
      <p className="memory-prompt">{challenge.prompt}</p>
      <div className="memory-options">
        {challenge.options.map(option => {
          const correct = answered && option.id === challenge.answerId
          const chosen = (answeredId ?? selectedId) === option.id
          return <button key={option.id} className={`${chosen ? 'chosen ' : ''}${correct ? 'correct' : ''}`.trim()} type="button" disabled={answered} aria-pressed={chosen} onClick={() => setSelectedId(option.id)}>{option.label}</button>
        })}
      </div>
      {!answered && <button className="primary-button" type="button" disabled={!selectedId} onClick={() => selectedId && onAnswer(selectedId)}>{copy.submit}</button>}
      {answered && <div className="memory-explanation" aria-live="polite"><strong>{answeredId === challenge.answerId ? copy.correct : copy.incorrect}</strong><p>{challenge.explanation}</p><button className="primary-button" type="button" onClick={onArchive}>{copy.archive}</button></div>}
    </section>
  )
}
