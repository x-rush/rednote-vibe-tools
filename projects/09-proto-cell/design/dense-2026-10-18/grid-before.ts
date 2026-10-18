import type { EntityState } from '../domain/types'

export type QueryRect = {
  x: number
  y: number
  width: number
  height: number
}

export class SpatialGrid {
  readonly #cellSize: number
  readonly #cells = new Map<string, EntityState[]>()

  constructor(cellSize: number) {
    if (!Number.isFinite(cellSize) || cellSize <= 0) {
      throw new RangeError('cellSize must be positive')
    }
    this.#cellSize = cellSize
  }

  clear(): void {
    this.#cells.clear()
  }

  insert(entity: EntityState): void {
    const bounds = {
      x: entity.body.center.x - entity.body.radius,
      y: entity.body.center.y - entity.body.radius,
      width: entity.body.radius * 2,
      height: entity.body.radius * 2,
    }
    this.#visitCells(bounds, (key) => {
      const entries = this.#cells.get(key)
      if (entries) entries.push(entity)
      else this.#cells.set(key, [entity])
    })
  }

  query(rect: QueryRect): EntityState[] {
    const found = new Map<string, EntityState>()
    this.#visitCells(rect, (key) => {
      for (const entity of this.#cells.get(key) ?? []) {
        found.set(entity.id, entity)
      }
    })
    return [...found.values()]
  }

  #visitCells(rect: QueryRect, visit: (key: string) => void): void {
    const minX = Math.floor(rect.x / this.#cellSize)
    const minY = Math.floor(rect.y / this.#cellSize)
    const maxX = Math.floor((rect.x + Math.max(0, rect.width)) / this.#cellSize)
    const maxY = Math.floor((rect.y + Math.max(0, rect.height)) / this.#cellSize)

    for (let cellY = minY; cellY <= maxY; cellY += 1) {
      for (let cellX = minX; cellX <= maxX; cellX += 1) {
        visit(`${cellX}:${cellY}`)
      }
    }
  }
}
