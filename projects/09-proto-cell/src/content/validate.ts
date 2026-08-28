import type { ContentPack } from './schema'

export type ContentIssue = { path: string; message: string }
export type ContentValidationResult = { issues: ContentIssue[]; value?: ContentPack }

const LEGAL_ANCHOR_SLOTS = new Set(['core', 'membrane', 'front', 'rear', 'left', 'right', 'internal', 'symbiont'])
const LEGAL_ORGAN_CATEGORIES = new Set(['sense', 'move', 'feed', 'defend', 'attack', 'metabolism', 'reproduce', 'symbiosis'])
const LEGAL_RARITIES = new Set(['common', 'uncommon', 'rare'])
const LEGAL_CREATURE_ROLES = new Set(['resource', 'prey', 'scavenger', 'hunter', 'parasite', 'swarm', 'elite'])
const LEGAL_BOSS_PATHS = new Set(['combat', 'environment', 'stealth', 'parasite'])
const LEGAL_VISUAL_KINDS = new Set(['cell', 'organelle', 'synergy', 'environment', 'event', 'boss', 'ui'])
const FROZEN_ORGAN_CATEGORIES: Record<string, string> = {
  'organelle-eye-spot': 'sense',
  'organelle-echo-sac': 'sense',
  'organelle-vibration-cilia': 'sense',
  'organelle-flagellum': 'move',
  'organelle-cilia-ring': 'move',
  'organelle-jet-vacuole': 'move',
  'organelle-wide-mouth': 'feed',
  'organelle-needle-mouth': 'feed',
  'organelle-filter-gill': 'feed',
  'organelle-shell-plate': 'defend',
  'organelle-transparent-membrane': 'defend',
  'organelle-mucus-coat': 'defend',
  'organelle-electric-sac': 'attack',
  'organelle-toxin-spine': 'attack',
  'organelle-shock-pulse': 'attack',
  'organelle-photosome': 'metabolism',
  'organelle-acid-gland': 'metabolism',
  'organelle-repair-vacuole': 'metabolism',
  'organelle-division-ring': 'reproduce',
  'organelle-bud-sac': 'reproduce',
  'organelle-recombination-core': 'reproduce',
  'organelle-cleaner-symbiont': 'symbiosis',
  'organelle-lure-symbiont': 'symbiosis',
  'organelle-guard-symbiont': 'symbiosis',
}
const FROZEN_SYNERGY_REQUIREMENTS: Record<string, string[]> = {
  'synergy-ram-jet': ['organelle-jet-vacuole', 'organelle-shell-plate'],
  'synergy-guardian-division': ['organelle-division-ring', 'organelle-guard-symbiont'],
}

const COLLECTION_PREFIXES: Record<string, string | RegExp> = {
  environments: 'env-',
  nutrients: 'nutrient-',
  organelles: 'organelle-',
  synergies: 'synergy-',
  creatures: /^(creature|predator)-/,
  events: 'event-',
  bosses: 'boss-',
  origins: 'origin-',
  modifiers: 'modifier-',
  endings: 'ending-',
  deathTemplates: 'death-',
  visualRecipes: 'visual-',
  spawnTables: 'spawn-',
  geneNodes: 'gene-',
}

export function validateContent(input: unknown): ContentValidationResult {
  const issues: ContentIssue[] = []
  if (!isRecord(input)) return { issues: [{ path: '$', message: 'content must be an object' }] }

  require(input.schemaVersion === 1, '$.schemaVersion', 'schemaVersion must be 1')
  require(input.projectId === 'proto-cell', '$.projectId', 'projectId must identify proto-cell')
  require(typeof input.contentVersion === 'string' && /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(input.contentVersion), '$.contentVersion', 'contentVersion must be semantic')
  validateMeta(input.meta)
  validateUi(input.ui)

  const collections = new Map<string, Record<string, unknown>[]>()
  const globalIds = new Set<string>()
  for (const [key, prefix] of Object.entries(COLLECTION_PREFIXES)) {
    const items = recordsAt(input[key], `$.${key}`)
    collections.set(key, items)
    validateIds(key, items, prefix, globalIds)
  }

  const environmentIds = idsOf(collections, 'environments')
  const organelleIds = idsOf(collections, 'organelles')
  const synergyIds = idsOf(collections, 'synergies')
  const creatureIds = idsOf(collections, 'creatures')
  const eventIds = idsOf(collections, 'events')
  const bossIds = idsOf(collections, 'bosses')
  const modifierIds = idsOf(collections, 'modifiers')
  const originIds = idsOf(collections, 'origins')
  const spawnTableIds = idsOf(collections, 'spawnTables')
  const geneIds = idsOf(collections, 'geneNodes')
  const unlockableIds = new Set([...environmentIds, ...organelleIds, ...synergyIds, ...originIds, ...modifierIds])

  const visualsByKind = validateVisualRecipes(collections.get('visualRecipes') ?? [])
  validateNutrients(collections.get('nutrients') ?? [], visualsByKind.cell)
  validateOrganelles(collections.get('organelles') ?? [], organelleIds, environmentIds, visualsByKind.organelle)
  validateSynergies(collections.get('synergies') ?? [], organelleIds, visualsByKind.synergy)
  validateCreatures(collections.get('creatures') ?? [], environmentIds, visualsByKind.cell)
  validateEvents(collections.get('events') ?? [], environmentIds)
  validateBosses(collections.get('bosses') ?? [], environmentIds, visualsByKind.boss, globalIds)
  validateOrigins(collections.get('origins') ?? [], organelleIds, visualsByKind.cell)
  validateModifiers(collections.get('modifiers') ?? [], modifierIds)
  validateDeathTemplates(collections.get('deathTemplates') ?? [])
  validateSpawnTables(collections.get('spawnTables') ?? [], environmentIds, creatureIds)
  validateEndings(collections.get('endings') ?? [])
  validateGeneNodes(collections.get('geneNodes') ?? [], geneIds, unlockableIds)
  const m0Entities = validateM0(input.m0, environmentIds, visualsByKind.cell)
  validateOriginsEntityReferences(collections.get('origins') ?? [], m0Entities.playerIds)
  validateEnvironments(collections.get('environments') ?? [], spawnTableIds, eventIds, bossIds)
  validateM1(input.m1, eventIds)

  require((collections.get('organelles') ?? []).length >= 6, '$.organelles', 'M1 requires six organs')
  require((collections.get('synergies') ?? []).length >= 2, '$.synergies', 'M1 requires two synergies')
  const roles = new Set((collections.get('creatures') ?? []).map((item) => item.role))
  for (const role of ['prey', 'swarm', 'scavenger', 'hunter', 'elite']) require(roles.has(role), '$.creatures', `M1 creature role is missing: ${role}`)
  require((collections.get('bosses') ?? []).length >= 1, '$.bosses', 'M1 requires a boss')
  require((collections.get('endings') ?? []).length >= 1, '$.endings', 'M1 requires an ending')
  require((collections.get('deathTemplates') ?? []).length >= 3, '$.deathTemplates', 'M1 requires truthful death templates')

  return issues.length === 0 ? { issues, value: input as ContentPack } : { issues }

  function validateMeta(value: unknown) {
    if (!isRecord(value)) {
      issues.push({ path: '$.meta', message: 'metadata is required' })
      return
    }
    requiredString(value.title, '$.meta.title')
    require(value.locale === 'zh-CN', '$.meta.locale', 'locale must be zh-CN')
    requiredString(value.tagline, '$.meta.tagline')
    requiredString(value.fictionDisclaimer, '$.meta.fictionDisclaimer')
  }

  function validateUi(value: unknown) {
    if (!isRecord(value)) {
      issues.push({ path: '$.ui', message: 'UI copy is required' })
      return
    }
    for (const key of ['actions', 'labels', 'hud', 'screens']) {
      require(isRecord(value[key]) && Object.values(value[key]).every((copy) => typeof copy === 'string' && copy.length > 0), `$.ui.${key}`, 'UI copy group must contain non-empty strings')
    }
    const requiredCopy: Record<string, string[]> = {
      actions: ['start', 'pause', 'resume', 'restart'],
      labels: ['prototypeCell', 'openingRegion', 'gameCanvas'],
      hud: ['membrane', 'energy', 'stability', 'biomass', 'evolution'],
      screens: ['pauseTitle', 'pauseDescription', 'resultTitle', 'resultDescription', 'survival', 'contentErrorTitle', 'contentErrorDescription'],
    }
    for (const [group, keys] of Object.entries(requiredCopy)) {
      const copyGroup = isRecord(value[group]) ? value[group] : {}
      for (const key of keys) requiredString(copyGroup[key], `$.ui.${group}.${key}`)
    }
  }

  function validateEnvironments(items: Record<string, unknown>[], spawnIds: Set<string>, events: Set<string>, bosses: Set<string>) {
    items.forEach((item, index) => {
      const base = `$.environments[${index}]`
      requiredString(item.name, `${base}.name`)
      require(Number.isInteger(item.order) && Number(item.order) >= 0, `${base}.order`, 'environment order must be a non-negative integer')
      requireTuple(item.durationTargetSec, `${base}.durationTargetSec`)
      finiteRange(item.visibility, 0, 1, `${base}.visibility`)
      finiteRange(item.viscosity, 0, 1, `${base}.viscosity`)
      requireStringArray(item.hazardTags, `${base}.hazardTags`, false)
      reference(item.spawnTableId, spawnIds, `${base}.spawnTableId`, 'spawn table')
      references(item.eventIds, events, `${base}.eventIds`, 'event')
      if (item.bossId !== undefined) reference(item.bossId, bosses, `${base}.bossId`, 'boss')
      requireStringArray(item.visualPalette, `${base}.visualPalette`, true)
      requiredString(item.ambientAudioId, `${base}.ambientAudioId`)
    })
  }

  function validateNutrients(items: Record<string, unknown>[], visuals: Set<string>) {
    items.forEach((item, index) => {
      requiredString(item.name, `$.nutrients[${index}].name`)
      requiredString(item.behaviorId, `$.nutrients[${index}].behaviorId`)
      requireStringArray(item.riskTags, `$.nutrients[${index}].riskTags`, false)
      reference(item.visualRecipeId, visuals, `$.nutrients[${index}].visualRecipeId`, 'visual recipe')
    })
  }

  function validateOrganelles(items: Record<string, unknown>[], organs: Set<string>, environments: Set<string>, visuals: Set<string>) {
    items.forEach((item, index) => {
      const base = `$.organelles[${index}]`
      requiredString(item.name, `${base}.name`)
      require(typeof item.category === 'string' && LEGAL_ORGAN_CATEGORIES.has(item.category), `${base}.category`, 'organelle category is invalid')
      const id = typeof item.id === 'string' ? item.id : ''
      if (FROZEN_ORGAN_CATEGORIES[id]) require(item.category === FROZEN_ORGAN_CATEGORIES[id], `${base}.category`, 'published organ category cannot change')
      requireStringArray(item.slots, `${base}.slots`, true)
      if (Array.isArray(item.slots)) item.slots.forEach((slot, slotIndex) => require(typeof slot === 'string' && LEGAL_ANCHOR_SLOTS.has(slot), `${base}.slots[${slotIndex}]`, 'anchor slot is invalid'))
      require(typeof item.rarity === 'string' && LEGAL_RARITIES.has(item.rarity), `${base}.rarity`, 'rarity is invalid')
      require(isRecord(item.cost) && Object.values(item.cost).some((cost) => typeof cost === 'number' && Number.isFinite(cost) && cost >= 0), `${base}.cost`, 'at least one numeric cost is required')
      requireStringArray(item.tags, `${base}.tags`, true)
      references(item.conflicts, organs, `${base}.conflicts`, 'organelle')
      references(item.environmentIds, environments, `${base}.environmentIds`, 'environment', true)
      shortCopy(item.shortEffect, `${base}.shortEffect`, 64)
      shortCopy(item.triggerDescription, `${base}.triggerDescription`, 72)
      requiredString(item.behaviorId, `${base}.behaviorId`)
      reference(item.visualMutationId, visuals, `${base}.visualMutationId`, 'visual recipe')
    })
  }

  function validateSynergies(items: Record<string, unknown>[], organs: Set<string>, visuals: Set<string>) {
    items.forEach((item, index) => {
      const base = `$.synergies[${index}]`
      requiredString(item.name, `${base}.name`)
      references(item.requires, organs, `${base}.requires`, 'organelle', true)
      require(Array.isArray(item.requires) && item.requires.length >= 2, `${base}.requires`, 'synergy requires two organs')
      if (item.excludes !== undefined) references(item.excludes, organs, `${base}.excludes`, 'organelle')
      require(item.revealRule === 'on-trigger' || item.revealRule === 'on-install', `${base}.revealRule`, 'reveal rule is invalid')
      requiredString(item.behaviorId, `${base}.behaviorId`)
      shortCopy(item.shortEffect, `${base}.shortEffect`, 64)
      reference(item.visualMutationId, visuals, `${base}.visualMutationId`, 'visual recipe')
      const id = typeof item.id === 'string' ? item.id : ''
      const frozen = FROZEN_SYNERGY_REQUIREMENTS[id]
      if (frozen) require(sameMembers(item.requires, frozen), `${base}.requires`, 'published synergy meaning cannot change')
    })
  }

  function validateCreatures(items: Record<string, unknown>[], environments: Set<string>, visuals: Set<string>) {
    items.forEach((item, index) => {
      const base = `$.creatures[${index}]`
      requiredString(item.name, `${base}.name`)
      require(typeof item.role === 'string' && LEGAL_CREATURE_ROLES.has(item.role), `${base}.role`, 'creature role is invalid')
      requireTuple(item.sizeRange, `${base}.sizeRange`)
      requiredString(item.behaviorId, `${base}.behaviorId`)
      requireStringArray(item.organelleTags, `${base}.organelleTags`, false)
      references(item.environmentIds, environments, `${base}.environmentIds`, 'environment', true)
      requiredString(item.warningCueId, `${base}.warningCueId`)
      requireStringArray(item.responseTags, `${base}.responseTags`, true)
      require(Array.isArray(item.responseTags) && item.responseTags.length >= 2, `${base}.responseTags`, 'two response tags are required')
      requiredString(item.dropTableId, `${base}.dropTableId`)
      reference(item.visualRecipeId, visuals, `${base}.visualRecipeId`, 'visual recipe')
    })
  }

  function validateEvents(items: Record<string, unknown>[], environments: Set<string>) {
    items.forEach((item, index) => {
      const base = `$.events[${index}]`
      requiredString(item.name, `${base}.name`)
      requiredString(item.behaviorId, `${base}.behaviorId`)
      references(item.environmentIds, environments, `${base}.environmentIds`, 'environment', true)
      requireTuple(item.durationSec, `${base}.durationSec`)
      requireStringArray(item.telegraphIds, `${base}.telegraphIds`, true)
      requireStringArray(item.variantIds, `${base}.variantIds`, true)
      require(Array.isArray(item.variantIds) && item.variantIds.length >= 3, `${base}.variantIds`, 'three event variants are required')
      require(typeof item.telegraphLeadMs === 'number' && Number.isFinite(item.telegraphLeadMs) && item.telegraphLeadMs >= 1000, `${base}.telegraphLeadMs`, 'event telegraph lead must be at least one second')
      const variantIds = new Set(Array.isArray(item.variantIds) ? item.variantIds : [])
      const structuredVariantIds = new Set(Array.isArray(item.variants) ? item.variants.map((variant) => isRecord(variant) ? variant.id : undefined) : [])
      require(Array.isArray(item.variantIds) && variantIds.size === item.variantIds.length, `${base}.variantIds`, 'event variant ids must be unique')
      require(Array.isArray(item.variants) && item.variants.length === variantIds.size && structuredVariantIds.size === item.variants.length && item.variants.every((variant) => (
        isRecord(variant)
        && variantIds.has(variant.id)
        && ['radius', 'resourceCount', 'attractionStrength', 'flow'].every((field) => typeof variant[field] === 'number' && Number.isFinite(variant[field]) && Number(variant[field]) >= 0)
      )), `${base}.variants`, 'event variants must provide finite parameters for every variant id')
    })
  }

  function validateBosses(items: Record<string, unknown>[], environments: Set<string>, visuals: Set<string>, knownIds: Set<string>) {
    items.forEach((item, index) => {
      const base = `$.bosses[${index}]`
      requiredString(item.name, `${base}.name`)
      reference(item.environmentId, environments, `${base}.environmentId`, 'environment')
      const expectedPhases = ['dormant', 'feeding', 'exposed', 'enraged', 'resolved']
      require(Array.isArray(item.phases) && item.phases.length === expectedPhases.length && item.phases.every((phase, phaseIndex) => (
        isRecord(phase)
        && phase.id === expectedPhases[phaseIndex]
        && typeof phase.behaviorId === 'string'
        && phase.behaviorId.length > 0
      )), `${base}.phases`, 'boss phases must follow dormant, feeding, exposed, enraged, resolved')
      requireStringArray(item.telegraphIds, `${base}.telegraphIds`, true)
      if (!Array.isArray(item.resolutionPaths)) issues.push({ path: `${base}.resolutionPaths`, message: 'resolution paths are required' })
      else item.resolutionPaths.forEach((path, pathIndex) => require(typeof path === 'string' && LEGAL_BOSS_PATHS.has(path), `${base}.resolutionPaths[${pathIndex}]`, 'boss path is invalid'))
      const paths = Array.isArray(item.resolutionPaths) ? item.resolutionPaths : []
      require(paths.length >= 3 && paths.includes('combat') && paths.some((path) => path !== 'combat'), `${base}.resolutionPaths`, 'three paths including non-combat are required')
      references(item.rewardIds, knownIds, `${base}.rewardIds`, 'reward', true)
      reference(item.visualRecipeId, visuals, `${base}.visualRecipeId`, 'visual recipe')
      if (!isRecord(item.rules)) issues.push({ path: `${base}.rules`, message: 'boss rules are required' })
      else {
        for (const field of ['telegraphLeadMs', 'outerMembrane', 'coreIntegrity', 'hazardHoldMs', 'ramOuterDamage', 'ramCoreDamage', 'ramCooldownMs']) {
          require(typeof item.rules[field] === 'number' && Number.isFinite(item.rules[field]) && Number(item.rules[field]) > 0, `${base}.rules.${field}`, 'boss rule must be positive')
        }
        require(typeof item.rules.stealthLockMax === 'number' && item.rules.stealthLockMax >= 0 && item.rules.stealthLockMax <= 1, `${base}.rules.stealthLockMax`, 'stealth lock maximum must be between zero and one')
        requireStringArray(item.rules.environmentHazardIds, `${base}.rules.environmentHazardIds`, true)
      }
      if (!isRecord(item.entity)) issues.push({ path: `${base}.entity`, message: 'boss entity definition is required' })
      else {
        validateEntityDefinition(item.entity, `${base}.entity`, visuals)
        require(item.entity.role === 'boss' && item.entity.faction === 'hostile', `${base}.entity`, 'boss entity must be a hostile boss')
      }
    })
  }

  function validateM1(value: unknown, events: Set<string>) {
    if (!isRecord(value)) {
      issues.push({ path: '$.m1', message: 'M1 pacing configuration is required' })
      return
    }
    requireTuple(value.sliceTargetMs, '$.m1.sliceTargetMs')
    require(Array.isArray(value.sliceTargetMs) && Number(value.sliceTargetMs[0]) >= 300_000 && Number(value.sliceTargetMs[1]) <= 480_000, '$.m1.sliceTargetMs', 'M1 slice must target five to eight minutes')
    require(typeof value.bossSpawnAtMs === 'number' && Number.isFinite(value.bossSpawnAtMs) && value.bossSpawnAtMs > 0, '$.m1.bossSpawnAtMs', 'M1 boss spawn time is required')
    if (!Array.isArray(value.eventSchedule)) issues.push({ path: '$.m1.eventSchedule', message: 'M1 event schedule is required' })
    else value.eventSchedule.forEach((entry, index) => {
      const path = `$.m1.eventSchedule[${index}]`
      if (!isRecord(entry)) issues.push({ path, message: 'event schedule entry must be an object' })
      else {
        reference(entry.eventId, events, `${path}.eventId`, 'event')
        require(typeof entry.atMs === 'number' && Number.isFinite(entry.atMs) && entry.atMs >= 0, `${path}.atMs`, 'event time must be non-negative')
      }
    })
    if (!Array.isArray(value.routeRifts) || value.routeRifts.length < 2) {
      issues.push({ path: '$.m1.routeRifts', message: 'two route rifts are required' })
      return
    }
    const ids = new Set<string>()
    value.routeRifts.forEach((rift, index) => {
      const path = `$.m1.routeRifts[${index}]`
      if (!isRecord(rift)) {
        issues.push({ path, message: 'route rift must be an object' })
        return
      }
      requiredString(rift.id, `${path}.id`)
      require(typeof rift.id === 'string' && rift.id.startsWith('route-rift-') && !ids.has(rift.id), `${path}.id`, 'route rift id must be unique')
      if (typeof rift.id === 'string') ids.add(rift.id)
      require(typeof rift.destinationEnvironmentId === 'string' && rift.destinationEnvironmentId.startsWith('env-'), `${path}.destinationEnvironmentId`, 'route destination must be an environment id')
      require(typeof rift.opensAtMs === 'number' && Number.isFinite(rift.opensAtMs) && rift.opensAtMs >= 300_000, `${path}.opensAtMs`, 'route rift must open after five minutes')
      for (const field of ['hazardId', 'resourceId', 'affinityIconId']) requiredString(rift[field], `${path}.${field}`)
    })
  }

  function validateOrigins(items: Record<string, unknown>[], organs: Set<string>, visuals: Set<string>) {
    items.forEach((item, index) => {
      const base = `$.origins[${index}]`
      requiredString(item.name, `${base}.name`)
      requiredString(item.entityDefinitionId, `${base}.entityDefinitionId`)
      references(item.initialOrganelleIds, organs, `${base}.initialOrganelleIds`, 'organelle')
      reference(item.visualRecipeId, visuals, `${base}.visualRecipeId`, 'visual recipe')
    })
  }

  function validateOriginsEntityReferences(items: Record<string, unknown>[], entityIds: Set<string>) {
    items.forEach((item, index) => reference(item.entityDefinitionId, entityIds, `$.origins[${index}].entityDefinitionId`, 'entity definition'))
  }

  function validateModifiers(items: Record<string, unknown>[], modifiers: Set<string>) {
    items.forEach((item, index) => {
      const base = `$.modifiers[${index}]`
      requiredString(item.name, `${base}.name`)
      shortCopy(item.shortEffect, `${base}.shortEffect`, 72)
      requiredString(item.behaviorId, `${base}.behaviorId`)
      finiteRange(item.difficultyWeight, 0, 10, `${base}.difficultyWeight`)
      finiteRange(item.rewardMultiplier, 1, 10, `${base}.rewardMultiplier`)
      references(item.excludes, modifiers, `${base}.excludes`, 'modifier')
      requiredString(item.accessibilityImpact, `${base}.accessibilityImpact`)
    })
  }

  function validateDeathTemplates(items: Record<string, unknown>[]) {
    items.forEach((item, index) => {
      const base = `$.deathTemplates[${index}]`
      requiredString(item.eventType, `${base}.eventType`)
      if (item.requiredTags !== undefined) requireStringArray(item.requiredTags, `${base}.requiredTags`, false)
      if (item.excludedTags !== undefined) requireStringArray(item.excludedTags, `${base}.excludedTags`, false)
      require(typeof item.priority === 'number' && Number.isFinite(item.priority), `${base}.priority`, 'priority is required')
      shortCopy(item.text, `${base}.text`, 72)
    })
  }

  function validateEndings(items: Record<string, unknown>[]) {
    items.forEach((item, index) => {
      requiredString(item.name, `$.endings[${index}].name`)
      requiredString(item.conditionId, `$.endings[${index}].conditionId`)
    })
  }

  function validateVisualRecipes(items: Record<string, unknown>[]): Record<string, Set<string>> {
    const byKind: Record<string, Set<string>> = Object.fromEntries([...LEGAL_VISUAL_KINDS].map((kind) => [kind, new Set<string>()]))
    items.forEach((item, index) => {
      const base = `$.visualRecipes[${index}]`
      require(typeof item.kind === 'string' && LEGAL_VISUAL_KINDS.has(item.kind), `${base}.kind`, 'visual kind is invalid')
      requireStringArray(item.palette, `${base}.palette`, true)
      if (typeof item.id === 'string' && typeof item.kind === 'string' && LEGAL_VISUAL_KINDS.has(item.kind)) byKind[item.kind].add(item.id)
    })
    return byKind
  }

  function validateSpawnTables(items: Record<string, unknown>[], environments: Set<string>, creatures: Set<string>) {
    items.forEach((item, index) => {
      const base = `$.spawnTables[${index}]`
      reference(item.environmentId, environments, `${base}.environmentId`, 'environment')
      if (!Array.isArray(item.entries) || item.entries.length === 0) issues.push({ path: `${base}.entries`, message: 'spawn entries are required' })
      else item.entries.forEach((entry, entryIndex) => {
        const path = `${base}.entries[${entryIndex}]`
        if (!isRecord(entry)) issues.push({ path, message: 'spawn entry must be an object' })
        else {
          reference(entry.creatureId, creatures, `${path}.creatureId`, 'creature')
          require(typeof entry.weight === 'number' && Number.isFinite(entry.weight) && entry.weight > 0, `${path}.weight`, 'spawn weight must be positive')
          require(typeof entry.minAtMs === 'number' && Number.isFinite(entry.minAtMs) && entry.minAtMs >= 0, `${path}.minAtMs`, 'spawn time must be non-negative')
        }
      })
    })
  }

  function validateGeneNodes(items: Record<string, unknown>[], genes: Set<string>, knownIds: Set<string>) {
    items.forEach((item, index) => {
      const base = `$.geneNodes[${index}]`
      requiredString(item.name, `${base}.name`)
      references(item.requires, genes, `${base}.requires`, 'gene')
      references(item.unlockIds, knownIds, `${base}.unlockIds`, 'content', true)
      require(typeof item.cost === 'number' && Number.isFinite(item.cost) && item.cost >= 0, `${base}.cost`, 'gene cost is invalid')
    })
  }

  function validateM0(value: unknown, environments: Set<string>, visuals: Set<string>): { playerIds: Set<string> } {
    const playerIds = new Set<string>()
    if (!isRecord(value) || !Array.isArray(value.environments) || value.environments.length === 0) {
      issues.push({ path: '$.m0.environments', message: 'playable environments are required' })
      return { playerIds }
    }
    value.environments.forEach((environment, index) => {
      const base = `$.m0.environments[${index}]`
      if (!isRecord(environment)) {
        issues.push({ path: base, message: 'environment must be an object' })
        return
      }
      reference(environment.id, environments, `${base}.id`, 'environment')
      require(typeof environment.width === 'number' && Number.isFinite(environment.width) && environment.width > 0, `${base}.width`, 'world width must be positive')
      require(typeof environment.height === 'number' && Number.isFinite(environment.height) && environment.height > 0, `${base}.height`, 'world height must be positive')
      if (isRecord(environment.playerDefinition)) {
        validateEntityDefinition(environment.playerDefinition, `${base}.playerDefinition`, visuals)
        require(environment.playerDefinition.role === 'player', `${base}.playerDefinition.role`, 'player role must be player')
        require(environment.playerDefinition.faction === 'player', `${base}.playerDefinition.faction`, 'player faction must be player')
        require(typeof environment.playerDefinition.stability === 'number' && Number.isFinite(environment.playerDefinition.stability), `${base}.playerDefinition.stability`, 'player stability is required')
        require(typeof environment.playerDefinition.evolutionThreshold === 'number' && Number.isFinite(environment.playerDefinition.evolutionThreshold) && environment.playerDefinition.evolutionThreshold > 0, `${base}.playerDefinition.evolutionThreshold`, 'evolution threshold must be positive')
        require(typeof environment.playerDefinition.evolutionThresholdGrowth === 'number' && Number.isFinite(environment.playerDefinition.evolutionThresholdGrowth) && environment.playerDefinition.evolutionThresholdGrowth > 1, `${base}.playerDefinition.evolutionThresholdGrowth`, 'evolution threshold growth must be greater than one')
        if (typeof environment.playerDefinition.id === 'string') playerIds.add(environment.playerDefinition.id)
      }
      else issues.push({ path: `${base}.playerDefinition`, message: 'player definition is required' })
      const spawnableIds = new Set<string>()
      if (Array.isArray(environment.entityDefinitions)) environment.entityDefinitions.forEach((definition, definitionIndex) => {
        const path = `${base}.entityDefinitions[${definitionIndex}]`
        if (!isRecord(definition)) {
          issues.push({ path, message: 'entity definition must be an object' })
          return
        }
        validateEntityDefinition(definition, path, visuals)
        require(definition.role !== 'player', `${path}.role`, 'spawnable entity cannot use player role')
        if (typeof definition.id === 'string') spawnableIds.add(definition.id)
      })
      else issues.push({ path: `${base}.entityDefinitions`, message: 'entity definitions are required' })
      if (!Array.isArray(environment.spawnSchedule)) issues.push({ path: `${base}.spawnSchedule`, message: 'spawn schedule is required' })
      else environment.spawnSchedule.forEach((spawn, spawnIndex) => {
        const path = `${base}.spawnSchedule[${spawnIndex}]`
        if (!isRecord(spawn)) issues.push({ path, message: 'spawn must be an object' })
        else {
          reference(spawn.definitionId, spawnableIds, `${path}.definitionId`, 'spawnable entity definition')
          require(typeof spawn.atMs === 'number' && Number.isFinite(spawn.atMs) && spawn.atMs >= 0, `${path}.atMs`, 'spawn time must be non-negative')
          require(Number.isInteger(spawn.count) && Number(spawn.count) > 0, `${path}.count`, 'spawn count must be a positive integer')
        }
      })
    })
    return { playerIds }
  }

  function validateEntityDefinition(definition: Record<string, unknown>, path: string, visuals: Set<string>) {
    requiredString(definition.id, `${path}.id`)
    require(typeof definition.role === 'string' && ['player', 'nutrient', 'prey', 'competitor', 'scavenger', 'predator', 'elite', 'boss', 'fragment'].includes(definition.role), `${path}.role`, 'entity role is invalid')
    require(typeof definition.faction === 'string' && ['player', 'neutral', 'hostile'].includes(definition.faction), `${path}.faction`, 'entity faction is invalid')
    for (const field of ['radius', 'mass', 'membrane', 'energy', 'maxSpeed']) {
      require(typeof definition[field] === 'number' && Number.isFinite(definition[field]) && Number(definition[field]) >= 0, `${path}.${field}`, 'entity number must be finite and non-negative')
    }
    reference(definition.visualRecipeId, visuals, `${path}.visualRecipeId`, 'cell visual recipe')
    if (definition.contactDamage !== undefined) {
      const damagePath = `${path}.contactDamage`
      if (!isRecord(definition.contactDamage)) issues.push({ path: damagePath, message: 'contact damage must be an object' })
      else {
        require(typeof definition.contactDamage.source === 'string' && ['acid', 'electric', 'spine', 'ram'].includes(definition.contactDamage.source), `${damagePath}.source`, 'damage source is invalid')
        for (const field of ['amount', 'periodMs', 'activeMs', 'phaseOffsetMs']) require(typeof definition.contactDamage[field] === 'number' && Number.isFinite(definition.contactDamage[field]), `${damagePath}.${field}`, 'damage number is required')
      }
    }
  }

  function recordsAt(value: unknown, path: string): Record<string, unknown>[] {
    if (!Array.isArray(value)) {
      issues.push({ path, message: 'collection is required' })
      return []
    }
    const records = value.filter(isRecord)
    if (records.length !== value.length) issues.push({ path, message: 'collection items must be objects' })
    return records
  }

  function validateIds(key: string, items: Record<string, unknown>[], prefix: string | RegExp, known: Set<string>) {
    items.forEach((item, index) => {
      const path = `$.${key}[${index}].id`
      const id = item.id
      const matches = typeof id === 'string' && (typeof prefix === 'string' ? id.startsWith(prefix) && id.length > prefix.length : prefix.test(id))
      if (!matches) issues.push({ path, message: 'stable id prefix is invalid' })
      else if (known.has(id)) issues.push({ path, message: 'id must be unique' })
      else known.add(id)
    })
  }

  function requiredString(value: unknown, path: string) {
    require(typeof value === 'string' && value.trim().length > 0, path, 'non-empty string is required')
  }

  function shortCopy(value: unknown, path: string, maxLength: number) {
    require(typeof value === 'string' && value.length > 0 && value.length <= maxLength, path, `copy must be 1-${maxLength} characters`)
  }

  function reference(value: unknown, ids: Set<string>, path: string, label: string) {
    require(typeof value === 'string' && ids.has(value), path, `${label} reference is missing`)
  }

  function references(value: unknown, ids: Set<string>, path: string, label: string, requireOne = false) {
    if (!Array.isArray(value)) {
      issues.push({ path, message: `${label} references must be an array` })
      return
    }
    if (requireOne && value.length === 0) issues.push({ path, message: `${label} references cannot be empty` })
    value.forEach((entry, index) => reference(entry, ids, `${path}[${index}]`, label))
  }

  function requireStringArray(value: unknown, path: string, requireOne: boolean) {
    require(Array.isArray(value) && (!requireOne || value.length > 0) && value.every((entry) => typeof entry === 'string' && entry.length > 0), path, 'string list is invalid')
  }

  function requireTuple(value: unknown, path: string) {
    require(Array.isArray(value) && value.length === 2 && value.every((entry) => typeof entry === 'number' && Number.isFinite(entry)) && value[0] <= value[1], path, 'numeric range is invalid')
  }

  function finiteRange(value: unknown, min: number, max: number, path: string) {
    require(typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max, path, 'number is outside the allowed range')
  }

  function require(condition: boolean, path: string, message: string) {
    if (!condition) issues.push({ path, message })
  }
}

function idsOf(collections: Map<string, Record<string, unknown>[]>, key: string): Set<string> {
  return new Set((collections.get(key) ?? []).flatMap((item) => typeof item.id === 'string' ? [item.id] : []))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function sameMembers(value: unknown, expected: string[]): boolean {
  return Array.isArray(value) && value.length === expected.length && expected.every((item) => value.includes(item))
}
