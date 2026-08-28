import { describe, expect, it } from 'vitest'
import { failingIndexedDb, memoryIndexedDb, memorySettingsStorage, saveFixture } from '../tests/fixtures'
import { createRepository } from './repository'

describe('game save repository', () => {
  it('falls back to session mode without destroying the rejected payload', async () => {
    const repo = createRepository(failingIndexedDb())

    expect((await repo.load()).mode).toBe('session')
    expect(repo.recoveryPayload()).toBeDefined()
  })

  it('keeps settings in local storage and structured progress in IndexedDB', async () => {
    const driver = memoryIndexedDb()
    const settings = memorySettingsStorage()
    const repo = createRepository(driver, settings)
    const save = saveFixture()
    save.settings.music = false
    save.settings.reducedShake = true
    save.settings.graphics = 'low'
    save.progression.genePoints = 12

    await repo.save(save)
    const stored = driver.value('save', 'current') as Record<string, unknown>
    const loaded = await repo.load()

    expect(stored.settings).toBeUndefined()
    expect(settings.getItem('proto-cell:settings')).toContain('"music":false')
    expect(loaded).toMatchObject({ mode: 'persistent', value: { settings: { music: false, reducedShake: true, graphics: 'low' }, progression: { genePoints: 12 } } })
  })

  it('preserves a rejected import for recovery until explicit clear', async () => {
    const driver = memoryIndexedDb()
    const settings = memorySettingsStorage()
    const repo = createRepository(driver, settings)
    const result = await repo.importJson('{bad')

    expect(result.issues).not.toEqual([])
    expect(repo.recoveryPayload()).toBe('{bad')

    const reloadedRepo = createRepository(driver, settings)
    await reloadedRepo.load()
    expect(reloadedRepo.recoveryPayload()).toBe('{bad')

    await repo.clear()
    expect(repo.recoveryPayload()).toBeUndefined()

    const clearedRepo = createRepository(driver, settings)
    await clearedRepo.load()
    expect(clearedRepo.recoveryPayload()).toBeUndefined()
  })

  it('exports the current sanitized value and imports a valid replacement', async () => {
    const repo = createRepository(memoryIndexedDb(), memorySettingsStorage())
    const save = saveFixture()
    save.records.maxBiomass = 727

    expect((await repo.importJson(JSON.stringify(save))).issues).toEqual([])
    expect(JSON.parse(await repo.exportJson()).records.maxBiomass).toBe(727)
  })

  it('never persists rejected media or oversized raw payloads in recovery', async () => {
    const driver = memoryIndexedDb()
    const repo = createRepository(driver, memorySettingsStorage())

    await repo.importJson(JSON.stringify({ payload: ' \n data:image/png;base64,AAAA' }))
    expect(JSON.stringify(repo.recoveryPayload())).not.toContain('base64,AAAA')
    expect(JSON.stringify(driver.value('recovery', 'rejected'))).not.toContain('base64,AAAA')

    const mediaKey = saveFixture()
    mediaKey.codex = { ' blob:unsafe-media': 'seen' }
    await repo.importJson(JSON.stringify(mediaKey))
    expect(JSON.stringify(repo.recoveryPayload())).not.toContain('unsafe-media')
    expect(JSON.stringify(driver.value('recovery', 'rejected'))).not.toContain('unsafe-media')

    const oversized = JSON.stringify({ payload: '!'.repeat(1024 * 1024) })
    await repo.importJson(oversized)
    expect(JSON.stringify(repo.recoveryPayload())).not.toContain('!'.repeat(1024))
    expect(JSON.stringify(driver.value('recovery', 'rejected'))).not.toContain('!'.repeat(1024))
  })
})
