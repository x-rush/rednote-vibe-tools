import { describe, expect, it } from 'vitest'
import { saveFixture } from '../tests/fixtures'
import { decodeSave, encodeSave } from './codec'

describe('versioned save codec', () => {
  it.each([
    ['microbe', 'form-primal-cell'],
    ['hunter', 'form-primal-cell'],
    ['specialist', 'form-colony-body'],
    ['dominant', 'form-colony-body'],
    ['ascendant', 'form-ciliate-composite'],
  ] as const)('maps legacy stage %s conservatively to %s', (stage, formId) => {
    const fixture = saveFixture()
    fixture.lifeArchives[0]!.finalBodyStage = stage
    delete (fixture.lifeArchives[0] as Partial<typeof fixture.lifeArchives[0]>).finalFormId
    expect(decodeSave(fixture).value?.lifeArchives[0]?.finalFormId).toBe(formId)
  })

  it('drops unknown fields and caps archives at thirty', () => {
    const save = saveFixture({ extra: 'blocked', archiveCount: 35 })
    const decoded = decodeSave(save)

    expect(decoded.issues).toEqual([])
    expect(decoded.value && 'extra' in decoded.value).toBe(false)
    expect(decoded.value?.lifeArchives).toHaveLength(30)
    expect(decoded.value?.lifeArchives[0]?.dishCode).toBe(save.lifeArchives[5]?.dishCode)
  })

  it('rejects unknown content ids and media-shaped strings with structured issues', () => {
    const unknown = saveFixture()
    unknown.progression.unlockedIds = ['organelle-missing']
    const media = saveFixture()
    ;(media as Record<string, unknown>).extra = ' \n data:image/png;base64,AAAA'
    const mediaKey = saveFixture()
    mediaKey.codex = { ' blob:unsafe-media': 'seen' }

    expect(decodeSave(unknown)).toMatchObject({ value: undefined, issues: [expect.objectContaining({ path: '$.progression.unlockedIds[0]' })] })
    expect(decodeSave(media)).toMatchObject({ value: undefined, issues: [expect.objectContaining({ message: expect.stringContaining('media') })] })
    expect(decodeSave(mediaKey)).toMatchObject({ value: undefined, issues: [expect.objectContaining({ code: 'media-not-allowed' })] })
    expect(decodeSave({ payload: `${'A'.repeat(1024)}\n${'A'.repeat(1024)}` })).toMatchObject({ value: undefined, issues: [expect.objectContaining({ code: 'media-not-allowed' })] })
  })

  it('round-trips only the whitelisted structured save shape', () => {
    const fixture = saveFixture()
    fixture.progression.rewardCounts['environment:env-clear-drop'] = 900
    fixture.lifeArchives[0]!.finalMorphology = {
      bodyCount: 1,
      totalMass: 144,
      radius: 12,
      stability: 82,
      organelles: [{ id: 'organelle-guard-symbiont', stage: 'mature', anchor: 'symbiont', charges: 2 }],
    }
    const decoded = decodeSave(encodeSave(fixture))

    expect(decoded.issues).toEqual([])
    expect(decoded.value).toEqual(decodeSave(fixture).value)
    expect(decoded.value?.lifeArchives[0]?.finalMorphology?.organelles[0]?.charges).toBe(2)
    expect(decoded.value?.progression.rewardCounts['environment:env-clear-drop']).toBe(900)
  })

  it('migrates a v1 archive without inventing a completed body stage', () => {
    const fixture = saveFixture()
    delete (fixture.lifeArchives[0] as Partial<typeof fixture.lifeArchives[0]>).finalBodyStage
    delete (fixture.lifeArchives[0] as Partial<typeof fixture.lifeArchives[0]>).buildRouteCounts
    delete (fixture.lifeArchives[0] as Partial<typeof fixture.lifeArchives[0]>).journeyStageIndex

    const migrated = decodeSave(fixture)

    expect(migrated.value?.lifeArchives[0]?.finalBodyStage).toBe('microbe')
    expect(migrated.value?.lifeArchives[0]?.buildRouteCounts).toEqual({ predation: 0, survival: 0, colony: 0 })
    expect(migrated.issues).toEqual([])
  })

  it('rejects unknown or invalid reward counters', () => {
    const unknown = saveFixture()
    unknown.progression.rewardCounts['environment:env-missing'] = 1
    const fractional = saveFixture()
    fractional.progression.rewardCounts['environment:env-clear-drop'] = 1.5

    expect(decodeSave(unknown)).toMatchObject({ value: undefined, issues: [expect.objectContaining({ code: 'unknown-id' })] })
    expect(decodeSave(fractional)).toMatchObject({ value: undefined, issues: [expect.objectContaining({ code: 'invalid-number' })] })
  })

  it('fails closed on malformed or oversized JSON without raw parser errors', () => {
    expect(decodeSave('{oops').issues[0]).toMatchObject({ path: '$', code: 'invalid-json' })
    expect(decodeSave(JSON.stringify({ payload: 'x'.repeat(1024 * 1024) })).issues[0]).toMatchObject({ code: 'too-large' })
    expect(decodeSave({ payload: '!'.repeat(1024 * 1024) }).issues[0]).toMatchObject({ code: 'too-large' })
  })
})
