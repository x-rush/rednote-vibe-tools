import { getContent, type BossId, type BossResolutionPath } from '../content'

export type BossPath = BossResolutionPath
export type BossPhaseId = 'dormant' | 'feeding' | 'exposed' | 'enraged' | 'resolved'

export type BossState = {
  id: BossId
  seed: number
  phase: BossPhaseId
  spawnedAtMs: number
  telegraphEndsAtMs: number
  outerMembrane: number
  outerMembraneMax: number
  coreIntegrity: number
  coreIntegrityMax: number
  hazardOverlapMs: number
  parasiteAttachedMs: number
  validationHazardId?: string
  territoryCrossed: boolean
  playerEscaped: boolean
  lockRatio: number
  peakLockRatio: number
  resolutionCandidate?: BossPath
}

export type BossStepInput = {
  atMs: number
  outerDamage?: number
  coreDamage?: number
  hazardOverlapMs?: number
  hazardId?: string
  parasiteAttachedMs?: number
  territoryCrossed?: boolean
  playerEscaped?: boolean
  lockRatio?: number
}

export function createBoss(bossId: BossId, context: { seed: number; atMs: number }): BossState {
  const boss = getContent().bosses.find((item) => item.id === bossId)
  if (!boss) throw new RangeError(`Unknown boss id: ${bossId}`)
  return {
    id: boss.id,
    seed: context.seed,
    phase: 'dormant',
    spawnedAtMs: context.atMs,
    telegraphEndsAtMs: context.atMs + boss.rules.telegraphLeadMs,
    outerMembrane: boss.rules.outerMembrane,
    outerMembraneMax: boss.rules.outerMembrane,
    coreIntegrity: boss.rules.coreIntegrity,
    coreIntegrityMax: boss.rules.coreIntegrity,
    hazardOverlapMs: 0,
    parasiteAttachedMs: 0,
    territoryCrossed: false,
    playerEscaped: false,
    lockRatio: 0,
    peakLockRatio: 0,
  }
}

export function stepBoss(state: BossState, input: BossStepInput): BossState {
  if (state.phase === 'resolved') return state
  const definition = getContent().bosses.find((item) => item.id === state.id)
  if (!definition) throw new RangeError(`Unknown boss id: ${state.id}`)

  const validHazard = definition.rules.environmentHazardIds.includes(input.hazardId ?? '')
  const hazardWasSampled = input.hazardId !== undefined || input.hazardOverlapMs !== undefined
  let next: BossState = {
    ...state,
    phase: state.phase === 'dormant' && input.atMs >= state.telegraphEndsAtMs ? 'feeding' : state.phase,
    outerMembrane: Math.max(0, state.outerMembrane - Math.max(0, input.outerDamage ?? 0)),
    hazardOverlapMs: !hazardWasSampled
      ? state.hazardOverlapMs
      : validHazard
      ? state.hazardOverlapMs + Math.max(0, input.hazardOverlapMs ?? 0)
      : 0,
    parasiteAttachedMs: input.parasiteAttachedMs === undefined
      ? state.parasiteAttachedMs
      : Math.max(0, input.parasiteAttachedMs),
    validationHazardId: !hazardWasSampled ? state.validationHazardId : validHazard ? input.hazardId : undefined,
    territoryCrossed: state.territoryCrossed || Boolean(input.territoryCrossed),
    playerEscaped: state.playerEscaped || Boolean(input.playerEscaped),
    lockRatio: input.lockRatio ?? state.lockRatio,
    peakLockRatio: Math.max(state.peakLockRatio, input.lockRatio ?? state.lockRatio),
  }
  if (next.outerMembrane === 0 && next.phase !== 'dormant') next = { ...next, phase: 'exposed' }
  if (next.phase === 'exposed' || next.phase === 'enraged') {
    next = { ...next, coreIntegrity: Math.max(0, next.coreIntegrity - Math.max(0, input.coreDamage ?? 0)) }
    if (next.coreIntegrity > 0 && next.coreIntegrity <= definition.rules.coreIntegrity * 0.5) next = { ...next, phase: 'enraged' }
  }

  const environmentComplete = definition.resolutionPaths.includes('environment')
    && next.hazardOverlapMs >= definition.rules.hazardHoldMs && next.phase !== 'dormant'
  const stealthComplete = definition.resolutionPaths.includes('stealth')
    && next.phase !== 'dormant' && next.territoryCrossed && next.playerEscaped && next.peakLockRatio <= definition.rules.stealthLockMax
  const combatComplete = definition.resolutionPaths.includes('combat') && next.outerMembrane === 0 && next.coreIntegrity === 0
  const parasiteComplete = definition.resolutionPaths.includes('parasite')
    && (next.phase === 'exposed' || next.phase === 'enraged')
    && next.outerMembrane === 0
    && next.parasiteAttachedMs >= definition.rules.parasiteHoldMs
  if (combatComplete && state.phase === 'enraged') return { ...next, phase: 'resolved', resolutionCandidate: 'combat' }
  if (combatComplete) return { ...next, phase: 'enraged' }
  if (environmentComplete) return { ...next, phase: 'resolved', resolutionCandidate: 'environment' }
  if (parasiteComplete) return { ...next, phase: 'resolved', resolutionCandidate: 'parasite' }
  if (stealthComplete) return { ...next, phase: 'resolved', resolutionCandidate: 'stealth' }
  return next
}

export function resolveBossPath(state: BossState): { complete: boolean; path?: BossPath } {
  const definition = getContent().bosses.find((item) => item.id === state.id)
  const path = state.resolutionCandidate
  if (!definition || !path || !definition.resolutionPaths.includes(path)) return { complete: false }
  const complete = path === 'combat'
    ? state.outerMembrane === 0 && state.coreIntegrity === 0
    : path === 'environment'
      ? state.hazardOverlapMs >= definition.rules.hazardHoldMs && definition.rules.environmentHazardIds.includes(state.validationHazardId ?? '')
      : path === 'parasite'
        ? state.outerMembrane === 0 && state.parasiteAttachedMs >= definition.rules.parasiteHoldMs
        : state.territoryCrossed && state.playerEscaped && state.peakLockRatio <= definition.rules.stealthLockMax
  return complete ? { complete: true, path } : { complete: false }
}

export function canResolveBossPath(bossId: BossId, path: BossPath): boolean {
  const definition = getContent().bosses.find((item) => item.id === bossId)
  if (!definition || !definition.resolutionPaths.includes(path)) return false
  let state = createBoss(bossId, { seed: 1, atMs: 0 })
  state = stepBoss(state, { atMs: state.telegraphEndsAtMs })
  if (path === 'combat') {
    state = stepBoss(state, { atMs: state.telegraphEndsAtMs + 1, outerDamage: state.outerMembraneMax, coreDamage: state.coreIntegrityMax })
    state = stepBoss(state, { atMs: state.telegraphEndsAtMs + 2, coreDamage: state.coreIntegrityMax })
  } else if (path === 'environment') {
    state = stepBoss(state, {
      atMs: state.telegraphEndsAtMs + definition.rules.hazardHoldMs,
      hazardId: definition.rules.environmentHazardIds[0],
      hazardOverlapMs: definition.rules.hazardHoldMs,
    })
  } else if (path === 'stealth') {
    state = stepBoss(state, {
      atMs: state.telegraphEndsAtMs + 1,
      territoryCrossed: true,
      playerEscaped: true,
      lockRatio: definition.rules.stealthLockMax,
    })
  } else {
    state = stepBoss(state, { atMs: state.telegraphEndsAtMs + 1, outerDamage: state.outerMembraneMax })
    state = stepBoss(state, {
      atMs: state.telegraphEndsAtMs + definition.rules.parasiteHoldMs,
      parasiteAttachedMs: definition.rules.parasiteHoldMs,
    })
  }
  const resolution = resolveBossPath(state)
  return resolution.complete && resolution.path === path
}

export function bossRamDamage(
  state: BossState,
  installedOrganIds: readonly string[],
): Pick<BossStepInput, 'outerDamage' | 'coreDamage'> | undefined {
  if (!installedOrganIds.includes('organelle-jet-vacuole') || !installedOrganIds.includes('organelle-shell-plate')) return undefined
  const definition = getContent().bosses.find((item) => item.id === state.id)
  if (!definition || state.phase === 'dormant' || state.phase === 'resolved') return undefined
  if (state.phase === 'feeding') return { outerDamage: definition.rules.ramOuterDamage }
  return { coreDamage: definition.rules.ramCoreDamage }
}
