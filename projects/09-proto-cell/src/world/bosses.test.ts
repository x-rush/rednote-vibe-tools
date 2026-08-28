import { describe, expect, it } from 'vitest'
import { getContent } from '../content'
import { bossFixture, m1BossState } from '../tests/fixtures'
import { bossRamDamage, canResolveBossPath, createBoss, resolveBossPath, stepBoss } from './bosses'

describe('membrane queen validation boss', () => {
  it.each(getContent().bosses.flatMap((boss) => boss.resolutionPaths.map((path) => [boss.id, path] as const)))(
    '%s can reach its declared %s state through the state machine',
    (bossId, path) => expect(canResolveBossPath(bossId, path)).toBe(true),
  )
  it.each([
    ['boss-membrane-queen', 'environment'],
    ['boss-antibody-crown', 'stealth'],
    ['boss-abandoned-host', 'parasite'],
  ] as const)('%s resolves through %s', (bossId, path) => {
    expect(resolveBossPath(bossFixture(bossId, path))).toEqual({ complete: true, path })
  })

  it.each(['combat', 'environment', 'stealth'] as const)('completes the M1 boss by %s', (path) => {
    expect(resolveBossPath(m1BossState(path))).toMatchObject({ complete: true, path })
  })

  it('uses content phases and exposes the core only after the outer membrane breaks', () => {
    const dormant = createBoss('boss-membrane-queen', { seed: 727, atMs: 240_000 })
    const feeding = stepBoss(dormant, { atMs: dormant.telegraphEndsAtMs })
    const exposed = stepBoss(feeding, { atMs: dormant.telegraphEndsAtMs + 1, outerDamage: 999 })

    expect(feeding.phase).toBe('feeding')
    expect(exposed.phase).toBe('exposed')
  })

  it('accepts only the declared acid-like validation hazard for the environment path', () => {
    const boss = { ...m1BossState('environment'), hazardOverlapMs: 0, validationHazardId: undefined, resolutionCandidate: undefined }
    const ignored = stepBoss(boss, { atMs: 250_000, hazardId: 'hazard-warm-current', hazardOverlapMs: 3000 })
    const resolved = stepBoss(ignored, { atMs: 253_000, hazardId: 'hazard-acid-fringe', hazardOverlapMs: 2200 })

    expect(ignored.hazardOverlapMs).toBe(0)
    expect(resolveBossPath(resolved)).toEqual({ complete: true, path: 'environment' })
  })

  it('requires an uninterrupted stay inside the declared environment hazard', () => {
    const active = { ...createBoss('boss-membrane-queen', { seed: 727, atMs: 0 }), phase: 'feeding' as const }
    const partial = stepBoss(active, { atMs: 5000, hazardId: 'hazard-acid-fringe', hazardOverlapMs: 1500 })
    const interrupted = stepBoss(partial, { atMs: 5100, hazardOverlapMs: 0 })

    expect(interrupted.hazardOverlapMs).toBe(0)
  })

  it('requires the passive ram build and traverses exposed then enraged before combat resolves', () => {
    const build = ['organelle-jet-vacuole', 'organelle-shell-plate']
    const feeding = stepBoss(createBoss('boss-membrane-queen', { seed: 727, atMs: 0 }), { atMs: 5000 })
    expect(bossRamDamage(feeding, ['organelle-jet-vacuole'])).toBeUndefined()

    let state = feeding
    while (state.outerMembrane > 0) state = stepBoss(state, { atMs: 5001, ...bossRamDamage(state, build) })
    expect(state.phase).toBe('exposed')
    while (state.coreIntegrity > state.coreIntegrityMax * 0.5) state = stepBoss(state, { atMs: 5002, ...bossRamDamage(state, build) })
    expect(state.phase).toBe('enraged')
    while (state.coreIntegrity > 0) state = stepBoss(state, { atMs: 5003, ...bossRamDamage(state, build) })

    expect(resolveBossPath(state)).toEqual({ complete: true, path: 'combat' })
  })

  it('rejects stealth after the lock ratio has ever exceeded its maximum', () => {
    const active = stepBoss(createBoss('boss-membrane-queen', { seed: 727, atMs: 0 }), { atMs: 5000, lockRatio: 0.9 })
    const escaped = stepBoss(active, { atMs: 6000, territoryCrossed: true, playerEscaped: true, lockRatio: 0.1 })

    expect(escaped.peakLockRatio).toBe(0.9)
    expect(resolveBossPath(escaped)).toEqual({ complete: false })
  })

  it('resolves the abandoned host by maintaining a passive parasite attachment', () => {
    const active = { ...createBoss('boss-abandoned-host', { seed: 727, atMs: 0 }), phase: 'exposed' as const, outerMembrane: 0 }
    const resolved = stepBoss(active, { atMs: 5000, parasiteAttachedMs: 3000 })

    expect(resolveBossPath(resolved)).toEqual({ complete: true, path: 'parasite' })
  })

  it('never resolves a path that the boss did not declare', () => {
    const host = createBoss('boss-abandoned-host', { seed: 727, atMs: 0 })
    const resolved = stepBoss(host, {
      atMs: host.telegraphEndsAtMs,
      territoryCrossed: true,
      playerEscaped: true,
      lockRatio: 0.1,
    })

    expect(resolved.phase).not.toBe('resolved')
    expect(resolved.resolutionCandidate).toBeUndefined()
  })
})
