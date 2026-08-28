import { useEffect, useState, type CSSProperties, type KeyboardEventHandler, type RefObject } from 'react'
import type { ArchiveViewModel } from '../app/view-model'

export function Archive({
  model,
  restartButtonRef,
  onRestart,
  onKeyDown,
}: {
  model: ArchiveViewModel
  restartButtonRef: RefObject<HTMLButtonElement | null>
  onRestart(): void
  onKeyDown: KeyboardEventHandler<HTMLElement>
}) {
  const paletteStyle = {
    '--archive-deep': model.palette[0] ?? '#073d66',
    '--archive-glow': model.palette[1] ?? '#72f5ff',
    '--archive-accent': model.palette[2] ?? '#ffbf69',
    '--archive-cell-scale': String(Math.min(1.22, Math.max(0.84, (model.finalMorphology?.radius ?? 12) / 12))),
    '--archive-membrane-opacity': String(0.56 + (model.finalMorphology?.stability ?? 100) / 230),
  } as CSSProperties

  return (
    <section
      className="archive-panel"
      style={paletteStyle}
      role="dialog"
      aria-modal="true"
      aria-labelledby="archive-title"
      onKeyDown={onKeyDown}
    >
      <header className="archive-panel__header">
        <p className="hatchery-region">{model.environmentName}</p>
        <h2 id="archive-title">{model.title}</h2>
        <p className="archive-panel__outcome">{model.endingName ?? model.deathText}</p>
      </header>

      <button ref={restartButtonRef} className="archive-panel__restart" type="button" onClick={onRestart}>
        {model.restartLabel}
      </button>

      {model.finalMorphology && (
        <div
          className="archive-cell"
          role="img"
          aria-label={model.cellLabel}
          data-body-count={model.finalMorphology.bodyCount}
          data-mass={Math.round(model.finalMorphology.totalMass)}
          data-stability={Math.round(model.finalMorphology.stability)}
        >
          {Array.from({ length: Math.max(0, model.finalMorphology.bodyCount - 1) }, (_, index) => (
            <span key={index} className={`archive-cell__satellite archive-cell__satellite--${index + 1}`} />
          ))}
          <span className="archive-cell__membrane" />
          <span className="archive-cell__core" />
          {model.visualOrganelles.slice(0, 6).map((organ, index) => (
            <span
              key={`${organ.id}-${organ.anchor}-${index}`}
              className={`archive-cell__organ archive-cell__organ--${organ.anchor}`}
              data-stage={organ.stage}
              title={organ.name}
            />
          ))}
        </div>
      )}

      <dl className="archive-stats">
        <Stat label={model.labels.survival} value={model.survivalMs} format={formatElapsed} />
        <Stat label={model.labels.peakBiomass} value={model.maxBiomass} format={formatNumber} />
        <div>
          <dt>{model.labels.environment}</dt>
          <dd>{model.environmentName}</dd>
        </div>
        <div>
          <dt>{model.labels.dishCode}</dt>
          <dd>{model.dishCode}</dd>
        </div>
        <Stat label={model.labels.speciesSeed} value={model.speciesNameSeed} format={formatNumber} />
      </dl>

      <div className="archive-traits">
        <section>
          <h3>{model.labels.keyOrgans}</h3>
          <p>{model.keyOrgans.length > 0 ? model.keyOrgans.join(' · ') : model.labels.noOrgans}</p>
        </section>
        {model.synergies.length > 0 && (
          <section>
            <h3>{model.labels.synergies}</h3>
            <p>{model.synergies.join(' · ')}</p>
          </section>
        )}
      </div>
    </section>
  )
}

function Stat({ label, value, format }: { label: string; value: number; format(value: number): string }) {
  const displayed = useCountUp(value)
  return (
    <div>
      <dt>{label}</dt>
      <dd aria-label={format(value)}>{format(displayed)}</dd>
    </div>
  )
}

function useCountUp(target: number): number {
  const [value, setValue] = useState(() => typeof window === 'undefined' ? target : 0)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setValue(target)
      return
    }
    const startedAt = performance.now()
    let frameId = 0
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / 720)
      setValue(Math.round(target * (1 - (1 - progress) ** 3)))
      if (progress < 1) frameId = window.requestAnimationFrame(tick)
    }
    frameId = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frameId)
  }, [target])
  return value
}

function formatElapsed(elapsedMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000))
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`
}

function formatNumber(value: number): string {
  return Math.max(0, Math.round(value)).toLocaleString('zh-CN')
}
