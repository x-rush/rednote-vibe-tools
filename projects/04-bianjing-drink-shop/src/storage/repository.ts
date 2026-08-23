import type { SavePayload } from '../domain/types'

export interface SaveRepository {
  load(id: string): Promise<SavePayload | undefined>
  save(payload: SavePayload): Promise<void>
  remove(id: string): Promise<void>
  list(): Promise<SavePayload[]>
  clear(): Promise<void>
}

export class MemorySaveRepository implements SaveRepository {
  private readonly saves = new Map<string, SavePayload>()

  async load(id: string) { return this.saves.get(id) }
  async save(payload: SavePayload) { this.saves.set(payload.id, payload) }
  async remove(id: string) { this.saves.delete(id) }
  async list() { return [...this.saves.values()].sort((left, right) => left.id.localeCompare(right.id)) }
  async clear() { this.saves.clear() }
}
