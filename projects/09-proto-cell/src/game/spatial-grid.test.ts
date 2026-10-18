import { describe, expect, it, vi } from 'vitest'
import type { EntityState } from '../domain/types'
import { entity, entityAt } from '../tests/fixtures'
import { SpatialGrid, type QueryRect } from './spatial-grid'

/** Retain the previous bucket traversal as a behavioral oracle, including order. */
class LegacySpatialGrid {
  readonly cells = new Map<string, EntityState[]>()
  readonly cellSize: number

  constructor(cellSize: number) { this.cellSize = cellSize }

  clear() { this.cells.clear() }

  insert(item: EntityState) {
    this.visit({
      x: item.body.center.x - item.body.radius,
      y: item.body.center.y - item.body.radius,
      width: item.body.radius * 2,
      height: item.body.radius * 2,
    }, (key) => {
      const entries = this.cells.get(key)
      if (entries) entries.push(item)
      else this.cells.set(key, [item])
    })
  }

  query(rect: QueryRect) {
    const found = new Map<string, EntityState>()
    this.visit(rect, (key) => {
      for (const item of this.cells.get(key) ?? []) found.set(item.id, item)
    })
    return [...found.values()]
  }

  visit(rect: QueryRect, callback: (key: string) => void) {
    const minX = Math.floor(rect.x / this.cellSize)
    const minY = Math.floor(rect.y / this.cellSize)
    const maxX = Math.floor((rect.x + Math.max(0, rect.width)) / this.cellSize)
    const maxY = Math.floor((rect.y + Math.max(0, rect.height)) / this.cellSize)
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) callback(`${x}:${y}`)
    }
  }
}

function expectSameReferences(actual: EntityState[], expected: EntityState[]) {
  expect(actual).toHaveLength(expected.length)
  actual.forEach((item, index) => expect(item).toBe(expected[index]))
}

describe('spatial grid', () => {
  it('returns only entities in intersecting cells without duplicates', () => {
    const grid = new SpatialGrid(64)
    grid.insert(entityAt('near', 10, 10))
    grid.insert(entityAt('far', 500, 500))

    expect(grid.query({ x: 0, y: 0, width: 80, height: 80 }).map((item) => item.id)).toEqual(['near'])
  })

  it('clears all indexed entities between simulation steps', () => {
    const grid = new SpatialGrid(64)
    grid.insert(entityAt('near', 10, 10))
    grid.clear()

    expect(grid.query({ x: 0, y: 0, width: 80, height: 80 })).toEqual([])
  })

  it('matches legacy bucket unions and reference order across seeded coordinates and extents', () => {
    const grid = new SpatialGrid(96)
    const legacy = new LegacySpatialGrid(96)
    let seed = 727
    const random = () => {
      seed = (Math.imul(seed, 1_664_525) + 1_013_904_223) >>> 0
      return seed / 4_294_967_296
    }
    const inserts = Array.from({ length: 80 }, (_, index) => entity(
      `seeded-${index}`,
      1 + random() * 200,
      { x: random() * 8192 - 4096, y: random() * 8192 - 4096 },
    ))
    inserts.push(entityAt('far-negative', -1_000_000_000, -1_000_000_000))
    inserts.push(entityAt('far-positive', 1_000_000_000, 1_000_000_000))
    for (const item of inserts) { grid.insert(item); legacy.insert(item) }
    const queries: QueryRect[] = Array.from({ length: 80 }, () => ({
      x: random() * 8192 - 4096,
      y: random() * 8192 - 4096,
      width: random() * 1800 - 100,
      height: random() * 1800 - 100,
    }))
    queries.push({ x: -1_000_000_010, y: -1_000_000_010, width: 20, height: 20 })
    queries.push({ x: 999_999_990, y: 999_999_990, width: 20, height: 20 })
    for (const query of queries) expectSameReferences(grid.query(query), legacy.query(query))
  })

  it('preserves inclusive boundaries, duplicate ID replacement and clear/reinsert order', () => {
    const grid = new SpatialGrid(64)
    const legacy = new LegacySpatialGrid(64)
    const inserts = [
      entity('wide', 64, { x: 0, y: 0 }),
      entityAt('duplicate', 32, 32),
      entityAt('negative', -32, -32),
      entityAt('duplicate', -32, -32),
      entityAt('edge', 64, 64),
    ]
    const queries = [
      { x: -64, y: -64, width: 128, height: 128 },
      { x: 0, y: 0, width: 0, height: 0 },
      { x: -64, y: -64, width: 64, height: 64 },
      { x: 64, y: 64, width: -128, height: -128 },
    ]
    for (let pass = 0; pass < 2; pass += 1) {
      for (const item of inserts) { grid.insert(item); legacy.insert(item) }
      for (const query of queries) expectSameReferences(grid.query(query), legacy.query(query))
      grid.clear()
      legacy.clear()
      expectSameReferences(grid.query(queries[0]!), legacy.query(queries[0]!))
      inserts.reverse()
    }
  })

  it('returns independent result arrays without cloning indexed entities', () => {
    const grid = new SpatialGrid(64)
    const item = entityAt('near', 32, 32)
    grid.insert(item)
    const query = { x: 0, y: 0, width: 64, height: 64 }
    const first = grid.query(query)
    const second = grid.query(query)
    expect(first).not.toBe(second)
    expect(first[0]).toBe(item)
    first.length = 0
    second.push(entityAt('caller-only', 32, 32))
    expectSameReferences(grid.query(query), [item])
  })

  it('skips bucket lookups across empty rows of a large perception query', () => {
    const grid = new SpatialGrid(96)
    const item = entityAt('near', 32, 32)
    grid.insert(item)
    const lookup = vi.spyOn(Map.prototype, 'get')
    let result: EntityState[]
    let lookups: number
    try {
      result = grid.query({ x: -6000, y: -6000, width: 12000, height: 12000 })
      lookups = lookup.mock.calls.length
    } finally {
      lookup.mockRestore()
    }
    expectSameReferences(result, [item])
    // 126 row checks + 126 bucket checks in the sole occupied row, not 126².
    expect(lookups).toBeLessThanOrEqual(260)
  })
})
