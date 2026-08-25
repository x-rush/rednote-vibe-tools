import type { ClueSealViewModel } from './experience-view-model.ts'

type ClueSealRailProps = {
  seals: readonly ClueSealViewModel[]
  onOpen: (clueId: string) => void
  copy: { label: string; title: string; firstFree: string; openPrefix: string; starBand: string }
}

export function ClueSealRail({ seals, onOpen, copy }: ClueSealRailProps) {
  return (
    <section className="seal-section" aria-labelledby="seal-title">
      <div className="section-heading"><p>{copy.label}</p><h2 id="seal-title">{copy.title}</h2></div>
      <div className="seal-rail">
        {seals.map((seal, index) => (
          <button
            key={seal.id}
            className={seal.opened ? 'clue-seal opened' : 'clue-seal'}
            type="button"
            aria-expanded={seal.opened}
            onClick={() => onOpen(seal.id)}
          >
            <span className="seal-number">{String(index + 1).padStart(2, '0')}</span>
            <strong>{seal.label}</strong>
            <small>{seal.opened ? `${seal.starsAfterOpen} ${copy.starBand}` : seal.costsStar ? `${copy.openPrefix} ${seal.starsAfterOpen} 星` : copy.firstFree}</small>
            {seal.opened && <p>{seal.text}</p>}
          </button>
        ))}
      </div>
    </section>
  )
}
