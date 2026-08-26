import type { NarrativeBeat } from '../content/types.ts'

export function NarrativePrologue({ fictionLabel, beats }: { fictionLabel: string; beats: readonly NarrativeBeat[] }) {
  return (
    <section className="narrative-prologue" aria-label={fictionLabel}>
      <p>{fictionLabel}</p>
      <div>
        {beats.map(beat => (
          <blockquote key={beat.id}>
            <span>{beat.speaker}</span>
            {beat.body}
          </blockquote>
        ))}
      </div>
    </section>
  )
}
