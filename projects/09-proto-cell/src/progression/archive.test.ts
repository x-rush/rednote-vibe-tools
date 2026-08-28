import { describe, expect, it } from 'vitest'
import { eventLog, testContent } from '../tests/fixtures'
import { deriveLifeArchive } from './archive'

describe('life archive derivation', () => {
  it('prefers the actual final fatal event over flavor text', () => {
    const archive = deriveLifeArchive(eventLog([
      { type: 'engulfed', predatorId: 'threat', preyId: 'player', biomass: 12, atMs: 8500 },
      { type: 'damaged', targetId: 'player', source: 'acid', amount: 8, atMs: 9000 },
      { type: 'player-died', cause: 'acid', atMs: 9010 },
    ]), testContent())

    expect(archive.deathTemplateId).toBe('death-acid-corrosion')
  })

  it('derives route, peak biomass, organs, synergies, ending, and a stable dish code', () => {
    const log = eventLog([
      { type: 'engulfed', predatorId: 'player', preyId: 'prey', biomass: 48, atMs: 1000 },
      { type: 'mutation-selected', entityId: 'player', organId: 'organelle-jet-vacuole', action: 'install', atMs: 2000 },
      { type: 'mutation-selected', entityId: 'player', organId: 'organelle-shell-plate', action: 'install', atMs: 3000 },
      { type: 'route-selected', environmentId: 'env-acid-vesicle', atMs: 4000 },
      { type: 'ending-reached', endingId: 'ending-stable-species', atMs: 5000 },
    ])
    log[0]!.snapshot = { runSeed: 727, elapsedMs: 1000, environmentId: 'env-clear-drop', biomass: 192, organelleIds: [] }
    log[4]!.snapshot = {
      runSeed: 727,
      elapsedMs: 5000,
      environmentId: 'env-acid-vesicle',
      biomass: 260,
      organelleIds: ['organelle-jet-vacuole', 'organelle-shell-plate'],
    }

    const first = deriveLifeArchive(log, testContent())
    const second = deriveLifeArchive(log, testContent())

    expect(first).toMatchObject({
      survivalMs: 5000,
      farthestEnvironmentId: 'env-acid-vesicle',
      maxBiomass: 260,
      keyOrganelleIds: ['organelle-jet-vacuole', 'organelle-shell-plate'],
      synergyIds: ['synergy-ram-jet'],
      endingId: 'ending-stable-species',
    })
    expect(first.dishCode).toMatch(/^PC-[A-F0-9]{6}$/)
    expect(first.dishCode).toBe(second.dishCode)
    expect(log.map((entry) => entry.sequence)).toEqual([1, 2, 3, 4, 5])
  })

  it('uses only final simultaneous organs and does not invent a replaced synergy', () => {
    const log = eventLog([
      { type: 'mutation-selected', entityId: 'player', organId: 'organelle-jet-vacuole', action: 'install', atMs: 1000 },
      { type: 'mutation-selected', entityId: 'player', organId: 'organelle-shell-plate', action: 'install', atMs: 2000 },
      { type: 'mutation-selected', entityId: 'player', organId: 'organelle-flagellum', action: 'replace', atMs: 3000 },
      { type: 'player-died', cause: 'engulfed', atMs: 4000 },
    ])
    log[3]!.snapshot = {
      runSeed: 727,
      elapsedMs: 4000,
      environmentId: 'env-clear-drop',
      biomass: 180,
      organelleIds: ['organelle-flagellum', 'organelle-shell-plate'],
    }

    const archive = deriveLifeArchive(log, testContent())

    expect(archive.keyOrganelleIds).toEqual(['organelle-flagellum', 'organelle-shell-plate'])
    expect(archive.synergyIds).not.toContain('synergy-ram-jet')
  })

  it('keeps a contact source as the real cause when its damage ruptures the membrane', () => {
    const archive = deriveLifeArchive(eventLog([
      { type: 'damaged', targetId: 'player', source: 'spine', amount: 20, atMs: 9000 },
      { type: 'ruptured', targetId: 'player', fragmentMasses: [20, 20, 20], atMs: 9000 },
      { type: 'player-died', cause: 'engulfed-or-ruptured', atMs: 9000 },
    ]), testContent())

    expect(archive.deathTemplateId).toBe('death-spine-pulse')
  })

  it('uses the authoritative peak when a drain batch ends after biomass falls', () => {
    const log = eventLog([
      { type: 'engulfed', predatorId: 'player', preyId: 'prey', biomass: 80, atMs: 5000 },
      { type: 'player-died', cause: 'engulfed', atMs: 5000 },
    ])
    for (const entry of log) {
      entry.snapshot = {
        runSeed: 727,
        elapsedMs: 5000,
        environmentId: 'env-clear-drop',
        biomass: 0,
        peakBiomass: 224,
        organelleIds: [],
      }
    }

    expect(deriveLifeArchive(log, testContent()).maxBiomass).toBe(224)
  })

  it('uses content progression order rather than whichever environment event was logged last', () => {
    const archive = deriveLifeArchive(eventLog([
      { type: 'route-selected', environmentId: 'env-acid-vesicle', atMs: 4000 },
      { type: 'route-selected', environmentId: 'env-algae-glow', atMs: 5000 },
      { type: 'player-died', cause: 'engulfed', atMs: 6000 },
    ]), testContent())

    expect(archive.farthestEnvironmentId).toBe('env-acid-vesicle')
  })
})
