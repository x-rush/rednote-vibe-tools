import { describe, expect, it } from 'vitest'
import { ecologyGroupPositions, findEnteredRouteRift, generateRegion } from './generator'

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

  it('seeds two timed route rifts with hazard, resource, and affinity identities', () => {
    const region = generateRegion(727, 'env-clear-drop')

    expect(region.routeRifts).toHaveLength(2)
    expect(region.routeRifts.every((rift) => rift.opensAtMs >= 110_000)).toBe(true)
    expect(region.routeRifts.every((rift) => rift.hazardId && rift.resourceId && rift.affinityIconId)).toBe(true)
    expect(region.routeRifts).toEqual(generateRegion(727, 'env-clear-drop').routeRifts)
    const rift = region.routeRifts[0]
    expect(findEnteredRouteRift(region.routeRifts, { position: rift.position, radius: 12 }, rift.opensAtMs - 1)).toBeUndefined()
    expect(findEnteredRouteRift(region.routeRifts, { position: rift.position, radius: 12 }, rift.opensAtMs)?.id).toBe(rift.id)
  })

  it('materializes ecology groups deterministically inside world bounds', () => {
    const input = { seed: 727, groupId: 'eco-group-4', center: { x: 320, y: 550 }, distance: 380, count: 5, width: 640, height: 1100, margin: 12 }
    const first = ecologyGroupPositions(input)

    expect(first).toEqual(ecologyGroupPositions(input))
    expect(first).toHaveLength(5)
    expect(first.every((position) => position.x >= 12 && position.x <= 628 && position.y >= 12 && position.y <= 1088)).toBe(true)
  })
})
