import { describe, expect, it } from 'vitest'
import { objectiveScreenCue, reversalPresentation, screenImpactOffset, useSimpleCell } from './renderer'
import { entity } from '../tests/fixtures'

describe('impact feedback', () => {
  it('budgets dense NPC detail while preserving the player, remembered rivals and encounters', () => {
    expect(useSimpleCell(entity('ordinary', 20), 20, 180, 25)).toBe(true)
    expect(useSimpleCell(entity('nearby', 20), 20, 180, 0)).toBe(false)
    expect(useSimpleCell(entity('ordinary', 20), 20, 12, 25)).toBe(false)
    expect(useSimpleCell({ ...entity('player', 20), faction: 'player' }, 4, 180, 100)).toBe(false)
    expect(useSimpleCell(entity('encounter-2', 147), 40, 180, 100)).toBe(false)
    expect(useSimpleCell(entity('carryover-2-old', 22), 4, 180, 100)).toBe(false)
  })
  it('does not shake for a routine small engulf', () => {
    expect(screenImpactOffset([{
      id: 1,
      kind: 'biomass',
      amount: 12,
      entityId: 'player',
      atMs: 100,
      chain: 1,
    }], 180, false)).toEqual({ x: 0, y: 0 })
  })

  it('keeps a short impact for a high-chain engulf', () => {
    const offset = screenImpactOffset([{
      id: 1,
      kind: 'biomass',
      amount: 28,
      entityId: 'player',
      atMs: 100,
      chain: 4,
    }], 180, false)
    expect(Math.hypot(offset.x, offset.y)).toBeGreaterThan(0)
  })

  it('suppresses impacts independently of the local cell animation', () => {
    expect(screenImpactOffset([{ id: 1, kind: 'damage', amount: 8, entityId: 'player', atMs: 100, chain: 1 }], 180, true)).toEqual({ x: 0, y: 0 })
  })

  it('keeps named encounter edge cues out of the host buttons and HUD', () => {
    for (const viewport of [{ width: 375, height: 812 }, { width: 390, height: 844 }, { width: 430, height: 932 }, { width: 844, height: 390 }]) {
      const cue = objectiveScreenCue({ x: -1000, y: -1000 }, viewport)!
      expect(cue.edge).toBe(true)
      expect(cue.y).toBeGreaterThan(150)
      expect(cue.x).toBeGreaterThan(24)
      expect(cue.x).toBeLessThan(viewport.width - 24)
    }
    expect(objectiveScreenCue({ x: 195, y: 400 }, { width: 390, height: 844 })).toMatchObject({ x: 195, y: 400, edge: false })
    expect(objectiveScreenCue({ x: Number.NaN, y: 400 }, { width: 390, height: 844 })).toBeUndefined()
  })

  it('limits reversal feedback to one restrained local 900ms accent', () => {
    expect(reversalPresentation(300, false, false)).toMatchObject({ radiusScale: 1.08 + 0.65 / 3, textOffset: 3 })
    const quiet = reversalPresentation(300, true, true)!
    expect(quiet.radiusScale).toBe(1.15)
    expect(quiet.textOffset).toBe(0)
    expect(quiet.alpha).toBeLessThan(reversalPresentation(300, false, false)!.alpha)
    expect(reversalPresentation(850, false, false)!.alpha).toBeLessThan(reversalPresentation(300, false, false)!.alpha)
    expect(reversalPresentation(900, false, false)).toBeUndefined()
    expect(reversalPresentation(Number.NaN, false, false)).toBeUndefined()
  })
})
