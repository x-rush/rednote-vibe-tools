import { describe, expect, it } from 'vitest'
import rawContent from './content.json'
import { parseContent, validateContent } from './validate'

describe('conversation replay production content', () => {
  it('contains the frozen launch counts and identity', () => {
    const content = parseContent(rawContent)

    expect(content.projectId).toBe('conversation-replay')
    expect(content.schemaVersion).toBe(1)
    expect(content.content.feelings).toHaveLength(48)
    expect(content.content.needs).toHaveLength(48)
    expect(content.content.scenarios).toHaveLength(32)
  })

  it('keeps scenario and referenced IDs unique', () => {
    const content = parseContent(rawContent)
    const scenarioIds = content.content.scenarios.map(({ scenarioId }) => scenarioId)
    const entityIds = [
      ...content.content.feelings.map(({ id }) => id),
      ...content.content.needs.map(({ id }) => id),
      ...content.content.choices.map(({ id }) => id),
      ...content.content.rewrites.map(({ id }) => id),
      ...content.content.safetyRules.map(({ id }) => id),
    ]

    expect(new Set(scenarioIds).size).toBe(32)
    expect(new Set(entityIds).size).toBe(entityIds.length)
    expect(content.content.scenarios.filter(({ relationshipType }) => relationshipType === 'friend')).toHaveLength(6)
    expect(content.content.scenarios.filter(({ relationshipType }) => relationshipType === 'partner')).toHaveLength(8)
    expect(content.content.scenarios.filter(({ relationshipType }) => relationshipType === 'family')).toHaveLength(6)
    expect(content.content.scenarios.filter(({ relationshipType }) => relationshipType === 'coworker')).toHaveLength(8)
    expect(content.content.scenarios.filter(({ relationshipType }) => relationshipType === 'general')).toHaveLength(4)
  })

  it('provides complete alternatives and executable next steps', () => {
    const content = parseContent(rawContent)
    const rewrites = new Map(content.content.rewrites.map((rewrite) => [rewrite.id, rewrite]))

    for (const scenario of content.content.scenarios) {
      const rewrite = rewrites.get(scenario.rewriteId)
      expect(rewrite, scenario.scenarioId).toBeDefined()
      expect(rewrite?.tones.gentle.trim(), scenario.scenarioId).not.toBe('')
      expect(rewrite?.tones.direct.trim(), scenario.scenarioId).not.toBe('')
      expect(rewrite?.tones.firm.trim(), scenario.scenarioId).not.toBe('')
      expect(rewrite?.nextSteps.length, scenario.scenarioId).toBeGreaterThan(0)
    }
  })

  it('requires a safety notice for every safety scenario', () => {
    const content = parseContent(rawContent)
    const safetyRuleIds = new Set(content.content.safetyRules.map(({ id }) => id))

    for (const scenario of content.content.scenarios.filter(({ safetyLevel }) => safetyLevel === 'safety')) {
      expect(scenario.safetyRuleId, scenario.scenarioId).toBeTruthy()
      expect(safetyRuleIds.has(scenario.safetyRuleId ?? ''), scenario.scenarioId).toBe(true)
    }
  })

  it('reports paths for malformed or dangling content', () => {
    const invalid = structuredClone(rawContent) as Record<string, unknown>
    const content = invalid.content as { scenarios: Array<Record<string, unknown>> }
    content.scenarios[0] = { ...content.scenarios[0], rewriteId: 'rewrite-missing' }

    const result = validateContent(invalid, 'production')

    expect(result.ok).toBe(false)
    expect(result.errors.some(({ path }) => path.includes('content.scenarios[0].rewriteId'))).toBe(true)
  })

  it('rejects blank nested copy and duplicate nested IDs', () => {
    const invalid = structuredClone(rawContent) as Record<string, unknown>
    const nested = invalid.content as {
      scenarios: Array<{ riskPoints: string[] }>
      rewrites: Array<{ nextSteps: Array<{ id: string; description: string }> }>
    }
    nested.scenarios[0]!.riskPoints[0] = ' '
    nested.rewrites[1]!.nextSteps[0]!.id = nested.rewrites[0]!.nextSteps[0]!.id
    nested.rewrites[1]!.nextSteps[0]!.description = ''

    const result = validateContent(invalid, 'production')

    expect(result.ok).toBe(false)
    expect(result.errors.some(({ path }) => path.includes('content.scenarios[0].riskPoints[0]'))).toBe(true)
    expect(result.errors.some(({ path }) => path.includes('content.rewrites[1].nextSteps[0].id'))).toBe(true)
    expect(result.errors.some(({ path }) => path.includes('content.rewrites[1].nextSteps[0].description'))).toBe(true)
  })

  it('reports malformed collection items without throwing', () => {
    const invalid = structuredClone(rawContent) as Record<string, unknown>
    const nested = invalid.content as { feelings: unknown[] }
    nested.feelings[0] = null

    expect(() => validateContent(invalid, 'production')).not.toThrow()
    const result = validateContent(invalid, 'production')
    expect(result.ok).toBe(false)
    expect(result.errors.some(({ path }) => path === 'content.feelings[0]')).toBe(true)
  })

  it('rejects invalid enums and mismatched reciprocal rewrite references', () => {
    const invalid = structuredClone(rawContent) as Record<string, unknown>
    const nested = invalid.content as {
      feelings: Array<{ category: string }>
      rewrites: Array<{ scenarioId: string }>
    }
    nested.feelings[0]!.category = 'invented'
    nested.rewrites[0]!.scenarioId = 'friend-cancel'

    const result = validateContent(invalid, 'production')

    expect(result.ok).toBe(false)
    expect(result.errors.some(({ path }) => path === 'content.feelings[0].category')).toBe(true)
    expect(result.errors.some(({ path }) => path === 'content.rewrites[0].scenarioId')).toBe(true)
  })
})
