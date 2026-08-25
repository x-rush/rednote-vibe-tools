import { useRef } from 'react'
import type { CSSProperties, PointerEvent } from 'react'
import type { Artifact, ObservationSpot } from '../content/types.ts'
import { hitObservationSpot } from '../game/experience.ts'
import { ArtifactMedia } from './ArtifactMedia.tsx'

type SpotlightStageProps = {
  artifact: Artifact
  spots: readonly ObservationSpot[]
  foundIds: readonly string[]
  revealedClueCount: number
  instruction: string
  onDiscover: (spotId: string) => void
}

export function SpotlightStage({ artifact, spots, foundIds, revealedClueCount, instruction, onDiscover }: SpotlightStageProps) {
  const stageRef = useRef<HTMLDivElement>(null)

  const inspectPoint = (event: PointerEvent<HTMLDivElement>) => {
    const stage = stageRef.current
    if (!stage) return
    const rect = stage.getBoundingClientRect()
    const x = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
    const y = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height))
    stage.style.setProperty('--spot-x', `${x * 100}%`)
    stage.style.setProperty('--spot-y', `${y * 100}%`)
    const found = hitObservationSpot(spots, { x, y }, foundIds)
    if (found) onDiscover(found.id)
  }

  return (
    <section className="spotlight-shell" aria-labelledby="observation-instruction">
      <p id="observation-instruction" className="stage-instruction">{instruction}</p>
      <div
        ref={stageRef}
        className="spotlight-stage"
        style={{ '--spot-x': '50%', '--spot-y': '48%' } as CSSProperties}
        onPointerMove={inspectPoint}
        onPointerDown={event => {
          event.currentTarget.setPointerCapture(event.pointerId)
          inspectPoint(event)
        }}
      >
        <ArtifactMedia artifactId={artifact.id} artifactName={artifact.name} role="clue" revealedClueCount={revealedClueCount} eager />
        {spots.length > 0 && <div className="spotlight-veil" aria-hidden="true" />}
        {foundIds.map(id => {
          const spot = spots.find(item => item.id === id)
          return spot ? <span key={id} className="spot-found-ring" style={{ left: `${spot.x * 100}%`, top: `${spot.y * 100}%` }} aria-hidden="true" /> : null
        })}
      </div>
      {spots.length > 0 && (
        <div className="spot-keyboard-list" aria-label="键盘观察入口">
          {spots.map((spot, index) => {
            const found = foundIds.includes(spot.id)
            return (
              <button key={spot.id} className={found ? 'spot-key found' : 'spot-key'} type="button" onClick={() => onDiscover(spot.id)}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <strong>{found ? spot.label : '观察这一处'}</strong>
                {found && <small>{spot.note}</small>}
              </button>
            )
          })}
        </div>
      )}
      <p className="sr-status" aria-live="polite">已找到 {foundIds.length} / {spots.length} 处观察点</p>
    </section>
  )
}
