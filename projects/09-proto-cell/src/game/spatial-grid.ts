import type { EntityState } from '../domain/types'

export type QueryRect = {
  x: number
  y: number
  width: number
  height: number
}

export class SpatialGrid {
  readonly #cellSize: number
  readonly #rows = new Map<number, Map<number, EntityState[]>>()

  constructor(cellSize: number) {
    if (!Number.isFinite(cellSize) || cellSize <= 0) {
      throw new RangeError('cellSize must be positive')
    }
    this.#cellSize = cellSize
  }

  clear(): void {
    this.#rows.clear()
  }

  insert(entity: EntityState): void {
    const x = entity.body.center.x - entity.body.radius
    const y = entity.body.center.y - entity.body.radius
    const extent = Math.max(0, entity.body.radius * 2)
    const minX = Math.floor(x / this.#cellSize)
    const minY = Math.floor(y / this.#cellSize)
    const maxX = Math.floor((x + extent) / this.#cellSize)
    const maxY = Math.floor((y + extent) / this.#cellSize)

    for (let cellY = minY; cellY <= maxY; cellY += 1) {
      let row = this.#rows.get(cellY)
      if (!row) {
        row = new Map<number, EntityState[]>()
        this.#rows.set(cellY, row)
      }
      for (let cellX = minX; cellX <= maxX; cellX += 1) {
        const entries = row.get(cellX)
        if (entries) entries.push(entity)
        else row.set(cellX, [entity])
      }
    }
  }

  query(rect: QueryRect): EntityState[] {
    const found = new Map<string, EntityState>()
    const minX = Math.floor(rect.x / this.#cellSize)
    const minY = Math.floor(rect.y / this.#cellSize)
    const maxX = Math.floor((rect.x + Math.max(0, rect.width)) / this.#cellSize)
    const maxY = Math.floor((rect.y + Math.max(0, rect.height)) / this.#cellSize)

    for (let cellY = minY; cellY <= maxY; cellY += 1) {
      const row = this.#rows.get(cellY)
      if (!row) continue
      for (let cellX = minX; cellX <= maxX; cellX += 1) {
        const entries = row.get(cellX)
        if (!entries) continue
        for (const entity of entries) found.set(entity.id, entity)
      }
    }
    return [...found.values()]
  }
}
