import { describe, expect, it } from 'vitest'
import { playerWith } from '../tests/fixtures'
import { advanceFusionStability, splitBody, stepSwarm, tryFuse } from './split'

describe('automatic split and fusion', () => {
  it('conserves mass after explicit split loss and distributes organ ownership', () => {
    const player = playerWith(['organelle-division-ring', 'organelle-repair-vacuole'], { mass: 400 })
    const result = splitBody(player, { count: 2, lossFraction: 0.05 })

    expect(result.children.reduce((sum, child) => sum + child.mass, 0) + result.lostMass).toBeCloseTo(400)
    expect(result.children.flatMap((child) => child.organelles.map((organ) => organ.id)).sort()).toEqual([
      'organelle-division-ring',
      'organelle-repair-vacuole',
    ])
    expect(result.children.reduce((sum, child) => sum + child.membrane, 0)).toBeCloseTo(100)
    expect(result.children.reduce((sum, child) => sum + child.energy, 0)).toBeCloseTo(100)
  })

  it('moves every child with the shared direction while maintaining a centroid formation', () => {
    const children = splitBody(playerWith('organelle-division-ring', { mass: 400 }), { count: 2, lossFraction: 0 }).children
    const moved = stepSwarm(children, { direction: { x: 1, y: 0 }, strength: 1 }, 1000 / 60)

    expect(moved.every((child) => child.velocity.x > 0)).toBe(true)
    expect(moved[0].position).not.toEqual(moved[1].position)
  })

  it('preserves escape momentum and applies a group movement-organ multiplier', () => {
    const children = splitBody(playerWith('organelle-division-ring', { mass: 400 }), { count: 2, lossFraction: 0 }).children
      .map((child) => ({ ...child, velocity: { x: 100, y: 0 } }))
    const normal = stepSwarm(children, { direction: { x: 1, y: 0 }, strength: 1 }, 1000 / 60, 1)
    const boosted = stepSwarm(children, { direction: { x: 1, y: 0 }, strength: 1 }, 1000 / 60, 1.4)

    expect(normal.every((child) => child.velocity.x > 0)).toBe(true)
    expect(boosted[0].velocity.x).toBeGreaterThan(normal[0].velocity.x)
  })

  it('fuses only after proximity remains stable and conserves child mass', () => {
    const children = splitBody(playerWith('organelle-division-ring', { mass: 400 }), { count: 2, lossFraction: 0 }).children

    expect(tryFuse(children, { proximity: 50, stableForMs: 899, requiredStableMs: 900 })).toBeUndefined()
    const fused = tryFuse(children, { proximity: 50, stableForMs: 900, requiredStableMs: 900 })
    expect(fused?.mass).toBeCloseTo(400)
    expect(fused?.organelles).toEqual(playerWith('organelle-division-ring').installedOrganelles)
  })

  it('resets fusion stability as soon as any child leaves proximity', () => {
    const children = splitBody(playerWith('organelle-division-ring', { mass: 400 }), { count: 2, lossFraction: 0 }).children
    const far = children.map((child, index) => index === 0 ? child : { ...child, position: { x: 200, y: 0 } })

    expect(advanceFusionStability(far, 899, 16, 50)).toBe(0)
    expect(advanceFusionStability(children, 0, 16, 50)).toBe(16)
  })
})
