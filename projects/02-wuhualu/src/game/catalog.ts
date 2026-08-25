import type { Artifact, ArtifactSetDefinition, CollectionEntry } from '../content/types.ts'

export type SetCollectionArtifact = Pick<Artifact, 'id' | 'name' | 'period' | 'timelineOrder'> & {
  unlocked: boolean
  bestStars: 0 | 1 | 2 | 3
}

export type SetCollectionViewModel = {
  id: ArtifactSetDefinition['id']
  name: string
  description: string
  sealLabel: string
  archivedCount: number
  complete: boolean
  artifacts: SetCollectionArtifact[]
}

export function buildSetCollectionViewModel(
  artifacts: readonly Artifact[],
  collection: readonly CollectionEntry[],
  sets: readonly ArtifactSetDefinition[],
): SetCollectionViewModel[] {
  const collectionMap = new Map(collection.map(entry => [entry.artifactId, entry]))
  return sets.map(set => {
    const items = artifacts
      .filter(artifact => artifact.setId === set.id)
      .sort((a, b) => a.timelineOrder - b.timelineOrder)
      .map(artifact => {
        const entry = collectionMap.get(artifact.id)
        const bestStars: 0 | 1 | 2 | 3 = entry?.bestStars ?? 0
        return {
          id: artifact.id,
          name: artifact.name,
          period: artifact.period,
          timelineOrder: artifact.timelineOrder,
          unlocked: Boolean(entry),
          bestStars,
        }
      })
    const archivedCount = items.filter(({ unlocked }) => unlocked).length
    return { ...set, artifacts: items, archivedCount, complete: archivedCount === items.length && items.length > 0 }
  })
}
