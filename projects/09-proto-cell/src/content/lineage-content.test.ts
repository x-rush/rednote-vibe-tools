import { describe, expect, it } from 'vitest'
import rawContent from './content.json'
import { validateContent } from './validate'

describe('heritable cell content', () => {
  it('provides three distinct bounded starter lineages with real organ choices', () => {
    const pack = validateContent(rawContent).value!
    expect(pack.lineage.maxInheritedOrgans).toBe(1)
    expect(pack.lineage.archetypes.map((item) => item.route).sort()).toEqual(['colony', 'predation', 'survival'])
    expect(new Set(pack.lineage.archetypes.map((item) => item.visualRecipeId)).size).toBe(3)
    for (const item of pack.lineage.archetypes) {
      expect(item.inheritancePool.length).toBeGreaterThan(2)
      expect(item.strength.length).toBeGreaterThan(0)
      expect(item.weakness.length).toBeGreaterThan(0)
    }
  })
  it('rejects unknown inherited organs and unbounded capacity', () => {
    const invalid = structuredClone(rawContent) as unknown as Record<string, unknown>
    invalid.lineage = { maxSeeds: 100000, maxLineages: 12, maxInheritedOrgans: 6, hatchDurationMs: 3200, archetypes: [] }
    expect(validateContent(invalid).issues.some((issue) => issue.path.startsWith('$.lineage'))).toBe(true)
  })
})
