import type { NarrativeChapter, NarrativeChapterId } from '../content/types.ts'

export function unlockedNarrativeChapters(
  chapters: readonly NarrativeChapter[],
  collectionCount: number,
): NarrativeChapter[] {
  return chapters.filter(chapter => chapter.unlockCount <= collectionCount)
}

export function nextUnreadNarrativeChapter(
  chapters: readonly NarrativeChapter[],
  collectionCount: number,
  seenIds: readonly NarrativeChapterId[],
  deferredIds: readonly NarrativeChapterId[],
): NarrativeChapter | null {
  const seen = new Set(seenIds)
  const deferred = new Set(deferredIds)
  const next = unlockedNarrativeChapters(chapters, collectionCount)
    .find(chapter => !seen.has(chapter.id) && !deferred.has(chapter.id)) ?? null
  if (next?.id === 'finale' && !seen.has('act-5')) return null
  return next
}

function stableHash(value: string): number {
  let hash = 0x811c9dc5
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0
    hash = Math.imul(hash, 0x01000193)
  }
  hash ^= hash >>> 16
  hash = Math.imul(hash, 0x85ebca6b)
  hash ^= hash >>> 13
  hash = Math.imul(hash, 0xc2b2ae35)
  hash ^= hash >>> 16
  return hash >>> 0
}

export function pickGuideLine(
  lines: readonly string[],
  roundSeed: string,
  artifactId: string,
  phase: string,
): string {
  if (lines.length === 0) return ''
  return lines[stableHash(`${roundSeed}:${artifactId}:${phase}`) % lines.length]
}

export function formatRecentArtifactResponse(
  template: string,
  artifactName: string,
  evidenceLabel: string,
): string {
  return template
    .replaceAll('{artifact}', artifactName)
    .replaceAll('{evidence}', evidenceLabel)
}
