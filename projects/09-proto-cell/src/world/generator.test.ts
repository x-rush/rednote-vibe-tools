import { describe, expect, it } from 'vitest'
import { generateRegion } from './generator'

describe('seeded region generation', () => {
  it('repeats the initial-drop spawn schedule', () => {
    expect(generateRegion(727, 'env-clear-drop')).toEqual(generateRegion(727, 'env-clear-drop'))
  })

  it('derives stable unique entity ids from the region seed and spawn index', () => {
    const region = generateRegion(727, 'env-clear-drop')
    const ids = region.entities.map((item) => item.id)

    expect(new Set(ids).size).toBe(ids.length)
    expect(ids[0]).toBe('env-clear-drop-727-0')
  })
})
