import type {
  Artifact,
  ArtifactSetId,
  CollectionEntry,
  MemoryChallenge,
  ObservationSpot,
} from '../content/types.ts'

export type NormalizedPoint = { x: number; y: number }

export function hitObservationSpot(
  spots: readonly ObservationSpot[],
  point: NormalizedPoint,
  foundIds: readonly string[],
): ObservationSpot | null {
  const found = new Set(foundIds)
  for (const spot of spots) {
    if (found.has(spot.id)) continue
    const distance = Math.hypot(point.x - spot.x, point.y - spot.y)
    if (distance <= spot.radius) return spot
  }
  return null
}

export function openClueCard(openedIds: readonly string[], clueId: string): { openedIds: string[]; stars: 1 | 2 | 3 } {
  const opened = [...new Set(openedIds)]
  if (!opened.includes(clueId)) opened.push(clueId)
  const stars = Math.max(1, 4 - opened.length) as 1 | 2 | 3
  return { openedIds: opened, stars }
}

export function gradeMemoryChallenge(
  challenge: MemoryChallenge,
  optionId: string,
): { correct: boolean; explanation: string } {
  return { correct: optionId === challenge.answerId, explanation: challenge.explanation }
}

export function getSetProgress(
  artifacts: readonly Artifact[],
  collection: readonly CollectionEntry[],
  setId: ArtifactSetId,
): { collected: number; total: 4; complete: boolean } {
  const artifactIds = artifacts.filter(artifact => artifact.setId === setId).map(({ id }) => id)
  if (artifactIds.length !== 4) throw new Error(`${setId} 必须恰好包含四件文物`)
  const collectedIds = new Set(collection.map(({ artifactId }) => artifactId))
  const collected = artifactIds.filter(id => collectedIds.has(id)).length
  return { collected, total: 4, complete: collected === 4 }
}
