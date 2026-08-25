import type { CSSProperties } from 'react'
import type { Artifact, ObservationSpot } from '../content/types.ts'
import { ArtifactMedia } from './ArtifactMedia.tsx'

export type SpotlightStageCopy = {
  guideLabel: string
  firstPrompt: string
  continuePrompt: string
  completePrompt: string
  markerLabel: string
  progressLabel: string
  askLabel: string
}

type SpotlightStageProps = {
  artifact: Artifact
  spots: readonly ObservationSpot[]
  foundIds: readonly string[]
  instruction: string
  copy: SpotlightStageCopy
  onDiscover: (spotId: string) => void
  onAsk?: () => void
}

export function SpotlightStage({ artifact, spots, foundIds, instruction, copy, onDiscover, onAsk }: SpotlightStageProps) {
  const foundSpots = spots.filter(spot => foundIds.includes(spot.id))
  const isFirstObservation = foundSpots.length === 0
  const isComplete = spots.length > 0 && foundSpots.length === spots.length
  const guidePrompt = isComplete ? copy.completePrompt : isFirstObservation ? copy.firstPrompt : copy.continuePrompt

  return (
    <section className="spotlight-shell" aria-labelledby="observation-instruction">
      <p id="observation-instruction" className="stage-instruction">{instruction}</p>
      <div className="spotlight-stage">
        <ArtifactMedia artifactId={artifact.id} artifactName={artifact.name} role="observation" eager />
        {spots.map((spot, index) => {
          const found = foundIds.includes(spot.id)
          const markerNumber = String(index + 1).padStart(2, '0')
          const markerState = found ? 'is-found' : isFirstObservation && index === 0 ? 'is-recommended' : isFirstObservation ? 'is-muted' : ''
          return (
            <button
              key={spot.id}
              className={`inspection-marker ${markerState}`.trim()}
              type="button"
              style={{ left: `${spot.x * 100}%`, top: `${spot.y * 100}%` } as CSSProperties}
              aria-label={`${copy.markerLabel} ${markerNumber}`}
              aria-pressed={found}
              onClick={() => onDiscover(spot.id)}
            >
              <span>{markerNumber}</span>
            </button>
          )
        })}
      </div>
      {spots.length > 0 && (
        <>
          <aside className="inspection-guide">
            <img src={`${import.meta.env.BASE_URL}assets/wuhualu/guide/guide-avatar-v1.webp`} alt="" width="160" height="160" />
            <div>
              <p>{copy.guideLabel}</p>
              <blockquote>{guidePrompt}</blockquote>
              {onAsk && <button className="inspection-guide__action" type="button" onClick={onAsk}>{copy.askLabel}</button>}
            </div>
          </aside>
          <div className="inspection-results" aria-live="polite">
            {foundSpots.length > 0 && (
              <ol className="inspection-notes">
                {foundSpots.map(spot => {
                  const index = spots.findIndex(item => item.id === spot.id)
                  return <li key={spot.id}><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{spot.label}</strong><p>{spot.note}</p></div></li>
                })}
              </ol>
            )}
            <p className="inspection-progress">{copy.progressLabel} {foundSpots.length} / {spots.length}</p>
          </div>
        </>
      )}
    </section>
  )
}
