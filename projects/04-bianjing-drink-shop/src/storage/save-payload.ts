import type { GameState, SavePayload } from '../domain/types'

export function createSavePayload(current: GameState, previousDay?: GameState, updatedAt = new Date().toISOString()): SavePayload {
  return {
    schemaVersion: 5,
    contentVersion: current.contentVersion,
    id: current.saveId,
    updatedAt,
    current,
    previousDay,
  }
}
