import type { CollectionEntry } from '../content/types.ts'

export function unlockArtifact(
  collection: readonly CollectionEntry[],
  artifactId: string,
  stars: 1 | 2 | 3,
  unlockedAt: string,
): CollectionEntry[] {
  const existing = collection.find(entry => entry.artifactId === artifactId)
  if (!existing) return [...collection, { artifactId, bestStars: stars, unlockedAt }]
  if (existing.bestStars >= stars) return collection as CollectionEntry[]
  return collection.map(entry => entry.artifactId === artifactId ? { ...entry, bestStars: stars } : entry)
}
