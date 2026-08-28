import { describe, expect, it } from 'vitest'
import { entityAt } from '../tests/fixtures'
import { SpatialGrid } from './spatial-grid'

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
})
