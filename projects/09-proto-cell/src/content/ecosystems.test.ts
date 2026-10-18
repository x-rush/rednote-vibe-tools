import { describe, expect, it } from 'vitest'
import rawContent from './content.json'
import { validateContent } from './validate'
import { cameraZoomFor } from '../rendering/camera'

describe('playable food-chain content', () => {
  it('gives all three scales real hunting and encounter gates', () => {
    const pack = validateContent(rawContent).value!
    expect(pack.ecosystems).toHaveLength(3)
    for (const [index, ecology] of pack.ecosystems.entries()) {
      expect(ecology.tierIndex).toBe(index)
      expect(ecology.activeBiomassTarget).toBeGreaterThan(0)
      expect(ecology.mutationPressures[0]).toBeLessThan(ecology.mutationPressures[1])
      expect(ecology.encounterRadius).toBeLessThan(pack.scaleTiers[index]!.radiusRange[1] / 1.15)
      expect(ecology.enemyNotes.length).toBeGreaterThanOrEqual(4)
    }
  })

  it('keeps an earlier predator physically edible after the next evolution', () => {
    const pack = validateContent(rawContent).value!
    for (const index of [1, 2]) {
      const previous = pack.ecosystems[index - 1]!
      const next = pack.ecosystems[index]!
      expect(next.carryoverCreatureIds).toContain(previous.encounterCreatureId)
      const creature = pack.creatures.find((item) => item.id === previous.encounterCreatureId)!
      expect(creature.sizeRange[1]).toBeLessThan(pack.scaleTiers[index]!.radiusRange[0])
    }
  })

  it('includes flocking prey on the actual three-scale route', () => {
    const pack = validateContent(rawContent).value!
    const schoolIds = new Set(pack.creatures.filter((creature) => pack.behaviorProfiles.find((profile) => profile.id === creature.behaviorProfileId)?.family === 'school').map((creature) => creature.id))
    expect(pack.spawnTables.some((table) => pack.scaleTiers.some((tier) => tier.environmentId === table.environmentId) && table.entries.some((entry) => schoolIds.has(entry.creatureId)))).toBe(true)
  })

  it('reveals a larger physical world and makes the same old enemy visibly smaller after a leap', () => {
    const pack = validateContent(rawContent).value!
    const viewport = { width: 390, height: 844 }
    for (const index of [1, 2]) {
      const previous = pack.scaleTiers[index - 1]!
      const next = pack.scaleTiers[index]!
      const before = cameraZoomFor({ viewport, radius: previous.radiusRange[1], screenDiameterRatio: previous.screenDiameterRange[1] })
      const after = cameraZoomFor({ viewport, radius: next.radiusRange[0], screenDiameterRatio: next.screenDiameterRange[0] })
      expect(viewport.width / after).toBeGreaterThan(viewport.width / before * 1.4)
      const oldEnemyRadius = pack.ecosystems[index - 1]!.encounterRadius
      expect(oldEnemyRadius * after).toBeLessThan(oldEnemyRadius * before * 0.72)
    }
  })

  it('rejects missing, duplicate and impossible ecology configurations', () => {
    const missing = structuredClone(rawContent) as Record<string, unknown>
    delete missing.ecosystems
    expect(validateContent(missing).issues.some((issue) => issue.path.startsWith('$.ecosystems'))).toBe(true)
    const invalid = structuredClone(rawContent) as unknown as { ecosystems: Array<{ tierIndex: number; encounterRadius: number; mutationPressures: number[] }> }
    invalid.ecosystems[0]!.encounterRadius = 9999
    invalid.ecosystems[1]!.tierIndex = 0
    invalid.ecosystems[2]!.mutationPressures = [0.7, 0.2]
    expect(validateContent(invalid).issues.filter((issue) => issue.path.startsWith('$.ecosystems')).length).toBeGreaterThanOrEqual(3)
  })
})
