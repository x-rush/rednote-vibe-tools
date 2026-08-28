import { getContent, type AnchorSlot, type EnvironmentId, type OrganelleId, type SynergyId } from '../content'
import type { PlayerMorphologySnapshot } from '../game/engine'

export const MAX_SAVE_BYTES = 1024 * 1024

export type SaveSettings = {
  music: boolean
  sfx: boolean
  reducedMotion: boolean
  reducedFlash: boolean
  lowParticles: boolean
  reducedShake: boolean
  graphics: 'high' | 'balanced' | 'low'
}

export type LifeArchiveSummary = {
  speciesNameSeed: number
  survivalMs: number
  farthestEnvironmentId: EnvironmentId
  maxBiomass: number
  keyOrganelleIds: OrganelleId[]
  synergyIds: SynergyId[]
  deathTemplateId?: string
  endingId?: string
  dishCode: string
  finalMorphology?: PlayerMorphologySnapshot
}

export type SaveDataV1 = {
  schemaVersion: 1
  contentVersion: string
  settings: SaveSettings
  progression: {
    genePoints: number
    unlockedIds: string[]
    discoveredSynergyIds: string[]
    completedModifierIds: string[]
    rewardCounts: Record<string, number>
  }
  codex: Record<string, 'seen' | 'defeated-by' | 'complete'>
  records: {
    bestSurvivalMs: number
    bestEnvironmentOrder: number
    maxBiomass: number
    dailySeeds: Record<string, number>
  }
  lifeArchives: LifeArchiveSummary[]
}

export type SaveIssue = { path: string; code: string; message: string }
export type DecodeSaveResult = { value?: SaveDataV1; issues: SaveIssue[] }

export function decodeSave(input: unknown): DecodeSaveResult {
  const issues: SaveIssue[] = []
  let parsed = input
  if (typeof input === 'string') {
    if (new TextEncoder().encode(input).byteLength > MAX_SAVE_BYTES) {
      return { value: undefined, issues: [{ path: '$', code: 'too-large', message: 'save JSON exceeds one MiB' }] }
    }
    try {
      parsed = JSON.parse(input)
    } catch {
      return { value: undefined, issues: [{ path: '$', code: 'invalid-json', message: 'save JSON could not be parsed' }] }
    }
  } else if (input !== undefined) {
    let serialized: string
    try {
      serialized = JSON.stringify(input)
    } catch {
      return { value: undefined, issues: [{ path: '$', code: 'invalid-json', message: 'save value is not JSON-serializable' }] }
    }
    if (new TextEncoder().encode(serialized).byteLength > MAX_SAVE_BYTES) {
      return { value: undefined, issues: [{ path: '$', code: 'too-large', message: 'save JSON exceeds one MiB' }] }
    }
  }
  if (containsMediaString(parsed)) {
    return { value: undefined, issues: [{ path: '$', code: 'media-not-allowed', message: 'media-shaped strings are not allowed in structured saves' }] }
  }
  if (!isRecord(parsed)) return { value: undefined, issues: [{ path: '$', code: 'invalid-type', message: 'save must be an object' }] }

  const content = getContent()
  require(parsed.schemaVersion === 1, '$.schemaVersion', 'unsupported-version', 'schemaVersion must be 1')
  require(parsed.contentVersion === content.contentVersion, '$.contentVersion', 'content-version', 'contentVersion must match this release')

  const settings = sanitizeSettings(parsed.settings, issues)
  const knownUnlockIds = new Set<string>([
    ...content.environments.map((item) => item.id),
    ...content.organelles.map((item) => item.id),
    ...content.synergies.map((item) => item.id),
    ...content.origins.map((item) => item.id),
    ...content.modifiers.map((item) => item.id),
  ])
  const progressionInput = isRecord(parsed.progression) ? parsed.progression : {}
  if (!isRecord(parsed.progression)) issue('$.progression', 'invalid-type', 'progression must be an object')
  const progression = {
    genePoints: finiteNonNegative(progressionInput.genePoints, '$.progression.genePoints'),
    unlockedIds: knownStringArray(progressionInput.unlockedIds, '$.progression.unlockedIds', knownUnlockIds),
    discoveredSynergyIds: knownStringArray(progressionInput.discoveredSynergyIds, '$.progression.discoveredSynergyIds', new Set(content.synergies.map((item) => item.id))),
    completedModifierIds: knownStringArray(progressionInput.completedModifierIds, '$.progression.completedModifierIds', new Set(content.modifiers.map((item) => item.id))),
    rewardCounts: optionalRewardCounts(progressionInput.rewardCounts),
  }

  const codex = sanitizeCodex(parsed.codex, issues, new Set<string>([
    ...content.nutrients.map((item) => item.id),
    ...content.creatures.map((item) => item.id),
    ...content.events.map((item) => item.id),
    ...content.bosses.map((item) => item.id),
  ]))
  const records = sanitizeRecords(parsed.records, issues)
  const lifeArchives = sanitizeArchives(parsed.lifeArchives, issues, content).slice(-30)
  if (issues.length > 0) return { value: undefined, issues }
  return {
    issues,
    value: {
      schemaVersion: 1,
      contentVersion: content.contentVersion,
      settings,
      progression,
      codex,
      records,
      lifeArchives,
    },
  }

  function issue(path: string, code: string, message: string) {
    issues.push({ path, code, message })
  }
  function require(condition: boolean, path: string, code: string, message: string) {
    if (!condition) issue(path, code, message)
  }
  function finiteNonNegative(value: unknown, path: string): number {
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value
    issue(path, 'invalid-number', 'value must be a finite non-negative number')
    return 0
  }
  function knownStringArray(value: unknown, path: string, known: Set<string>): string[] {
    if (!Array.isArray(value)) {
      issue(path, 'invalid-type', 'value must be an array')
      return []
    }
    const result: string[] = []
    value.forEach((id, index) => {
      if (typeof id !== 'string' || !known.has(id)) issue(`${path}[${index}]`, 'unknown-id', 'id is not part of this content version')
      else if (!result.includes(id)) result.push(id)
    })
    return result
  }
  function optionalRewardCounts(value: unknown): Record<string, number> {
    if (value === undefined) return {}
    if (!isRecord(value)) {
      issue('$.progression.rewardCounts', 'invalid-type', 'reward counts must be an object')
      return {}
    }
    const known = knownRewardKeys(content)
    const counts: Record<string, number> = {}
    for (const [key, count] of Object.entries(value)) {
      if (!known.has(key)) issue(`$.progression.rewardCounts.${key}`, 'unknown-id', 'reward id is not part of this content version')
      else if (!Number.isSafeInteger(count) || Number(count) < 0) issue(`$.progression.rewardCounts.${key}`, 'invalid-number', 'reward count must be a non-negative integer')
      else counts[key] = Number(count)
    }
    return counts
  }
}

export function encodeSave(value: SaveDataV1): string {
  const decoded = decodeSave(value)
  if (!decoded.value) throw new TypeError(`Cannot encode invalid save: ${decoded.issues.map((item) => item.path).join(', ')}`)
  return JSON.stringify(decoded.value)
}

export function createDefaultSave(): SaveDataV1 {
  const content = getContent()
  return {
    schemaVersion: 1,
    contentVersion: content.contentVersion,
    settings: { music: true, sfx: true, reducedMotion: false, reducedFlash: false, lowParticles: false, reducedShake: false, graphics: 'balanced' },
    progression: { genePoints: 0, unlockedIds: [content.origins[0]?.id ?? 'origin-primal-cell'], discoveredSynergyIds: [], completedModifierIds: [], rewardCounts: {} },
    codex: {},
    records: { bestSurvivalMs: 0, bestEnvironmentOrder: 0, maxBiomass: 0, dailySeeds: {} },
    lifeArchives: [],
  }
}

function sanitizeSettings(value: unknown, issues: SaveIssue[]): SaveSettings {
  const source = isRecord(value) ? value : {}
  if (!isRecord(value)) issues.push({ path: '$.settings', code: 'invalid-type', message: 'settings must be an object' })
  const result = {} as SaveSettings
  for (const key of ['music', 'sfx', 'reducedMotion', 'reducedFlash', 'lowParticles', 'reducedShake'] as const) {
    if (typeof source[key] !== 'boolean') issues.push({ path: `$.settings.${key}`, code: 'invalid-boolean', message: 'setting must be boolean' })
    result[key] = typeof source[key] === 'boolean' ? source[key] : false
  }
  if (source.graphics !== 'high' && source.graphics !== 'balanced' && source.graphics !== 'low') {
    issues.push({ path: '$.settings.graphics', code: 'invalid-enum', message: 'graphics setting must be high, balanced, or low' })
  }
  result.graphics = source.graphics === 'high' || source.graphics === 'low' ? source.graphics : 'balanced'
  return result
}

function sanitizeCodex(value: unknown, issues: SaveIssue[], knownIds: Set<string>): SaveDataV1['codex'] {
  if (!isRecord(value)) {
    issues.push({ path: '$.codex', code: 'invalid-type', message: 'codex must be an object' })
    return {}
  }
  const result: SaveDataV1['codex'] = {}
  for (const [id, state] of Object.entries(value)) {
    if (!knownIds.has(id)) issues.push({ path: `$.codex.${id}`, code: 'unknown-id', message: 'codex id is unknown' })
    else if (state !== 'seen' && state !== 'defeated-by' && state !== 'complete') issues.push({ path: `$.codex.${id}`, code: 'invalid-state', message: 'codex state is invalid' })
    else result[id] = state
  }
  return result
}

function sanitizeRecords(value: unknown, issues: SaveIssue[]): SaveDataV1['records'] {
  const source = isRecord(value) ? value : {}
  if (!isRecord(value)) issues.push({ path: '$.records', code: 'invalid-type', message: 'records must be an object' })
  const number = (key: 'bestSurvivalMs' | 'bestEnvironmentOrder' | 'maxBiomass') => {
    const candidate = source[key]
    if (typeof candidate === 'number' && Number.isFinite(candidate) && candidate >= 0) return candidate
    issues.push({ path: `$.records.${key}`, code: 'invalid-number', message: 'record must be a finite non-negative number' })
    return 0
  }
  const dailySeeds: Record<string, number> = {}
  if (!isRecord(source.dailySeeds)) issues.push({ path: '$.records.dailySeeds', code: 'invalid-type', message: 'dailySeeds must be an object' })
  else for (const [date, seed] of Object.entries(source.dailySeeds)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isInteger(seed) || Number(seed) < 0 || Number(seed) > 0xffffffff) {
      issues.push({ path: `$.records.dailySeeds.${date}`, code: 'invalid-seed', message: 'daily seed entry is invalid' })
    } else dailySeeds[date] = Number(seed)
  }
  return { bestSurvivalMs: number('bestSurvivalMs'), bestEnvironmentOrder: number('bestEnvironmentOrder'), maxBiomass: number('maxBiomass'), dailySeeds }
}

function sanitizeArchives(value: unknown, issues: SaveIssue[], content: ReturnType<typeof getContent>): LifeArchiveSummary[] {
  if (!Array.isArray(value)) {
    issues.push({ path: '$.lifeArchives', code: 'invalid-type', message: 'lifeArchives must be an array' })
    return []
  }
  const environments = new Set(content.environments.map((item) => item.id))
  const organs = new Set(content.organelles.map((item) => item.id))
  const synergies = new Set(content.synergies.map((item) => item.id))
  const deaths = new Set(content.deathTemplates.map((item) => item.id))
  const endings = new Set(content.endings.map((item) => item.id))
  return value.flatMap((entry, index) => {
    const path = `$.lifeArchives[${index}]`
    if (!isRecord(entry)) {
      issues.push({ path, code: 'invalid-type', message: 'archive must be an object' })
      return []
    }
    const finite = (field: string) => {
      const candidate = entry[field]
      if (typeof candidate === 'number' && Number.isFinite(candidate) && candidate >= 0) return candidate
      issues.push({ path: `${path}.${field}`, code: 'invalid-number', message: 'archive number is invalid' })
      return 0
    }
    const environmentId = entry.farthestEnvironmentId
    if (typeof environmentId !== 'string' || !environments.has(environmentId as EnvironmentId)) issues.push({ path: `${path}.farthestEnvironmentId`, code: 'unknown-id', message: 'archive environment is unknown' })
    const keyOrganelleIds = knownIds(entry.keyOrganelleIds, `${path}.keyOrganelleIds`, organs, issues) as OrganelleId[]
    const synergyIds = knownIds(entry.synergyIds, `${path}.synergyIds`, synergies, issues) as SynergyId[]
    const deathTemplateId = optionalKnownId(entry.deathTemplateId, `${path}.deathTemplateId`, deaths, issues)
    const endingId = optionalKnownId(entry.endingId, `${path}.endingId`, endings, issues)
    if (typeof entry.dishCode !== 'string' || !/^PC1\.[A-Za-z0-9_-]+\.[A-Z0-9]{7}$/.test(entry.dishCode)) issues.push({ path: `${path}.dishCode`, code: 'invalid-code', message: 'dish code is invalid' })
    const finalMorphology = sanitizeMorphology(entry.finalMorphology, `${path}.finalMorphology`, organs, issues)
    return [{
      speciesNameSeed: finite('speciesNameSeed'),
      survivalMs: finite('survivalMs'),
      farthestEnvironmentId: (typeof environmentId === 'string' ? environmentId : 'env-clear-drop') as EnvironmentId,
      maxBiomass: finite('maxBiomass'),
      keyOrganelleIds,
      synergyIds,
      deathTemplateId,
      endingId,
      dishCode: typeof entry.dishCode === 'string' ? entry.dishCode : 'PC1.e30.0000000',
      finalMorphology,
    }]
  })
}

function sanitizeMorphology(value: unknown, path: string, organIds: Set<string>, issues: SaveIssue[]): PlayerMorphologySnapshot | undefined {
  if (value === undefined) return undefined
  if (!isRecord(value)) {
    issues.push({ path, code: 'invalid-type', message: 'morphology must be an object' })
    return undefined
  }
  const finite = (field: string) => {
    const candidate = value[field]
    if (typeof candidate === 'number' && Number.isFinite(candidate) && candidate >= 0) return candidate
    issues.push({ path: `${path}.${field}`, code: 'invalid-number', message: 'morphology number is invalid' })
    return 0
  }
  const organelles: PlayerMorphologySnapshot['organelles'] = []
  if (!Array.isArray(value.organelles)) issues.push({ path: `${path}.organelles`, code: 'invalid-type', message: 'organelles must be an array' })
  else value.organelles.forEach((organ, index) => {
    const organPath = `${path}.organelles[${index}]`
    if (!isRecord(organ) || typeof organ.id !== 'string' || !organIds.has(organ.id) || (organ.stage !== 'installed' && organ.stage !== 'mature') || typeof organ.anchor !== 'string' || !ANCHORS.has(organ.anchor as AnchorSlot) || (organ.charges !== undefined && (!Number.isInteger(organ.charges) || Number(organ.charges) < 0))) {
      issues.push({ path: organPath, code: 'invalid-organelle', message: 'installed organelle is invalid' })
    } else organelles.push({
      id: organ.id as OrganelleId,
      stage: organ.stage,
      anchor: organ.anchor as AnchorSlot,
      ...(organ.charges === undefined ? {} : { charges: Number(organ.charges) }),
    })
  })
  return { bodyCount: finite('bodyCount'), totalMass: finite('totalMass'), radius: finite('radius'), stability: finite('stability'), organelles }
}

function knownIds(value: unknown, path: string, known: Set<string>, issues: SaveIssue[]): string[] {
  if (!Array.isArray(value)) {
    issues.push({ path, code: 'invalid-type', message: 'ids must be an array' })
    return []
  }
  const result: string[] = []
  value.forEach((id, index) => {
    if (typeof id !== 'string' || !known.has(id)) issues.push({ path: `${path}[${index}]`, code: 'unknown-id', message: 'archive id is unknown' })
    else if (!result.includes(id)) result.push(id)
  })
  return result
}

function optionalKnownId(value: unknown, path: string, known: Set<string>, issues: SaveIssue[]): string | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'string' || !known.has(value)) issues.push({ path, code: 'unknown-id', message: 'archive id is unknown' })
  return typeof value === 'string' ? value : undefined
}

function containsMediaString(value: unknown, seen = new Set<unknown>()): boolean {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    const compact = trimmed.replace(/[\t\n\f\r ]/g, '')
    return /^(?:data:|blob:)/i.test(trimmed) || /;base64,/i.test(compact) || /^[A-Za-z0-9+/]{2048,}={0,2}$/.test(compact)
  }
  if (!value || typeof value !== 'object' || seen.has(value)) return false
  seen.add(value)
  return Object.entries(value).some(([key, item]) => containsMediaString(key, seen) || containsMediaString(item, seen))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function knownRewardKeys(content: ReturnType<typeof getContent>): Set<string> {
  const codexIds = [...content.nutrients, ...content.creatures, ...content.events, ...content.bosses].map((item) => item.id)
  return new Set([
    ...content.synergies.map((item) => `synergy:${item.id}`),
    ...content.environments.map((item) => `environment:${item.id}`),
    ...content.bosses.flatMap((boss) => boss.resolutionPaths.map((path) => `boss-path:${boss.id}:${path}`)),
    ...codexIds.map((id) => `codex-complete:${id}`),
    ...content.modifiers.map((item) => `modifier:${item.id}`),
    ...content.endings.map((item) => `ending:${item.id}`),
  ])
}

const ANCHORS = new Set<AnchorSlot>(['core', 'membrane', 'front', 'rear', 'left', 'right', 'internal', 'symbiont'])
