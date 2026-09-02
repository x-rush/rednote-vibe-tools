import { getContent } from '../content'
import type { Vec2 } from '../domain/types'

export type RadarMarkerKind = 'boundary' | 'encounter' | 'exit' | 'warned-threat'
export type RadarMarker = { kind: RadarMarkerKind; x: number; y: number }
export type RadarInput = {
  world: { width: number; height: number }
  playerPosition: Vec2
  encounterPosition?: Vec2
  exitPosition?: Vec2
  warnedThreats: readonly Vec2[]
}

export function radarMarkers(input: RadarInput): RadarMarker[] {
  const markers: RadarMarker[] = [{ kind: 'boundary', x: 0, y: 0 }]
  const project = (point: Vec2): { x: number; y: number } => ({
    x: clamp((point.x - input.playerPosition.x) / Math.max(1, input.world.width / 2), -1, 1),
    y: clamp((point.y - input.playerPosition.y) / Math.max(1, input.world.height / 2), -1, 1),
  })
  if (input.encounterPosition) markers.push({ kind: 'encounter', ...project(input.encounterPosition) })
  if (input.exitPosition) markers.push({ kind: 'exit', ...project(input.exitPosition) })
  for (const threat of input.warnedThreats) markers.push({ kind: 'warned-threat', ...project(threat) })
  return markers
}

export function EcologyRadar({ input }: { input: RadarInput }) {
  const label = getContent().ui.labels.ecologyRadar ?? getContent().ui.hud.combatStatus
  return <div className="ecology-radar" role="img" aria-label={label}>{radarMarkers(input).map((marker, index) => <i key={`${marker.kind}-${index}`} data-kind={marker.kind} style={{ left: `${50 + marker.x * 42}%`, top: `${50 + marker.y * 42}%` }} />)}</div>
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : 0))
}
