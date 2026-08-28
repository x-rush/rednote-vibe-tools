import { getContent } from '../content'

export type CodexState = 'seen' | 'defeated-by' | 'complete'
export type CodexProgress = Record<string, CodexState>

const RANK: Record<CodexState, number> = { seen: 1, 'defeated-by': 2, complete: 3 }

export function advanceCodex(progress: CodexProgress, id: string, state: CodexState): CodexProgress {
  const content = getContent()
  const known = [...content.nutrients, ...content.creatures, ...content.events, ...content.bosses].some((item) => item.id === id)
  if (!known) throw new RangeError(`Unknown codex id: ${id}`)
  const current = progress[id]
  if (current && RANK[current] >= RANK[state]) return { ...progress }
  return { ...progress, [id]: state }
}

export function codexCompletion(progress: CodexProgress): { complete: number; total: number; ratio: number } {
  const content = getContent()
  const total = content.nutrients.length + content.creatures.length + content.events.length + content.bosses.length
  const complete = Object.values(progress).filter((state) => state === 'complete').length
  return { complete, total, ratio: total === 0 ? 1 : complete / total }
}
