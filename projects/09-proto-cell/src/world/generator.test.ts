import { describe, expect, it } from 'vitest'
import content from '../content/content.json'
import { ecologyGroupPositions, findEnteredRouteRift, generateRegion, generateTierRegion } from './generator'
import { adjacentTierReplacementRatio } from '../content/validate'

describe('seeded region generation', () => {
  it('replaces at least sixty percent of ordinary species between adjacent tiers', () => {
    expect(adjacentTierReplacementRatio(content.scaleTiers[0], content.scaleTiers[1], content.creatures)).toBeGreaterThanOrEqual(0.6)
    expect(adjacentTierReplacementRatio(content.scaleTiers[1], content.scaleTiers[2], content.creatures)).toBeGreaterThanOrEqual(0.6)
  })

  it('keeps every generated tier corridor wider than the largest tier body', () => {
    for (let seed = 0; seed < 20; seed += 1) {
      const region = generateTierRegion(seed, content.scaleTiers[1])
      expect(region.minimumCorridorWidth).toBeGreaterThanOrEqual(content.scaleTiers[1].radiusRange[1] * 2.4)
    }
  })

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

  it('re-angles edge spawns instead of clamping them close to the player', () => {
    const center = { x: 28, y: 28 }
    const positions = ecologyGroupPositions({
      seed: 727,
      groupId: 'edge-warning-group',
      center,
      distance: 250,
      angle: -Math.PI * 0.75,
      count: 4,
      width: 640,
      height: 1100,
      margin: 18,
    })

    expect(positions.every((position) => Math.hypot(position.x - center.x, position.y - center.y) >= 237.5)).toBe(true)
  })
})
