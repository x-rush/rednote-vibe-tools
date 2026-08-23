import type { Ending, GameState } from '../domain/types'
import { conditionsMatch } from './conditions'

export interface EndingResolution {
  primary: Ending
  unlocked: Ending[]
}

export function resolveEnding(state: GameState, endings: Ending[]): EndingResolution | undefined {
  const immediate = endings
    .filter((ending) => ending.immediate && conditionsMatch(ending.conditions, state))
    .sort((left, right) => right.priority - left.priority)
  if (immediate.length > 0) return { primary: immediate[0], unlocked: immediate }
  if (state.day < 100) return undefined
  const unlocked = endings
    .filter((ending) => !ending.immediate && conditionsMatch(ending.conditions, state))
    .sort((left, right) => right.priority - left.priority)
  if (unlocked.length === 0) return undefined
  return { primary: unlocked[0], unlocked }
}
