import type { ContentPack } from '../content'
import type { GameEvent } from '../game/interactions'
import { advanceCodex, type CodexState } from '../progression/codex'
import { awardGenes } from '../progression/genes'
import type { SaveDataV1 } from '../storage/codec'

const ranks: Record<CodexState, number> = { seen: 1, 'defeated-by': 2, complete: 3 }
const knownIds = new WeakMap<ContentPack, ReadonlySet<string>>()

/** A combat frame that changes no persistent progress must keep the same save
 * reference, so React does not serialize and write it again during combat. */
export function applyEventProgress(current: SaveDataV1, events: readonly GameEvent[], content: ContentPack): SaveDataV1 {
  let known = knownIds.get(content)
  if (!known) { known = new Set([...content.nutrients, ...content.creatures, ...content.events, ...content.bosses].map((item) => item.id)); knownIds.set(content, known) }
  let codex = current.codex
  const completedIds: string[] = []
  const advance = (id: string, state: CodexState) => {
    if (!known.has(id) || (codex[id] && ranks[codex[id]] >= ranks[state])) return
    if (state === 'complete') completedIds.push(id)
    codex = advanceCodex(codex, id, state)
  }
  for (const event of events) {
    if (event.type === 'event-phase') advance(event.eventId, event.phase === 'expired' ? 'complete' : 'seen')
    if (event.type === 'boss-resolved') advance(event.bossId, 'complete')
    if (event.type === 'engulfed' && event.predatorId.startsWith('player') && event.preyDefinitionId) advance(event.preyDefinitionId, 'complete')
    if (event.type === 'engulfed' && event.preyId.startsWith('player') && event.predatorDefinitionId) advance(event.predatorDefinitionId, 'defeated-by')
    if (event.type === 'player-died' && event.defeatedByDefinitionId) advance(event.defeatedByDefinitionId, 'defeated-by')
  }
  if (codex === current.codex) return current
  if (!completedIds.length) return { ...current, codex }
  const { awarded: _awarded, ...progression } = awardGenes(current.progression, completedIds.map((id) => ({ kind: 'codex-complete', id, first: (current.progression.rewardCounts[`codex-complete:${id}`] ?? 0) === 0 })))
  return { ...current, codex, progression }
}
