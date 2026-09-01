import type { ContentPack } from './schema'

export type ContentIssue = { path: string; message: string }
export type ContentValidationResult = { issues: ContentIssue[]; value?: ContentPack }

const LEGAL_ANCHOR_SLOTS = new Set(['core', 'membrane', 'front', 'rear', 'left', 'right', 'internal', 'symbiont'])
const LEGAL_ORGAN_CATEGORIES = new Set(['sense', 'move', 'feed', 'defend', 'attack', 'metabolism', 'reproduce', 'symbiosis'])
const LEGAL_RARITIES = new Set(['common', 'uncommon', 'rare'])
const LEGAL_EVOLUTION_ROUTES = new Set(['predation', 'survival', 'colony'])
const LEGAL_CREATURE_ROLES = new Set(['resource', 'prey', 'scavenger', 'hunter', 'parasite', 'swarm', 'elite'])
const LEGAL_BOSS_PATHS = new Set(['combat', 'environment', 'stealth', 'parasite'])
const LEGAL_VISUAL_KINDS = new Set(['cell', 'organelle', 'synergy', 'environment', 'event', 'boss', 'ui'])
const LEGAL_BODY_STAGES = new Set(['microbe', 'hunter', 'specialist', 'dominant', 'ascendant'])
const LEGAL_SCALE_TIER_IDS = new Set(['tier-single-cell', 'tier-colony', 'tier-ciliate'])
const LEGAL_FORM_IDS = new Set(['form-primal-cell', 'form-colony-body', 'form-ciliate-composite'])
const LEGAL_BEHAVIOR_FAMILIES = new Set(['resource', 'skittish', 'school', 'competitor', 'ambusher', 'hunter', 'scavenger', 'apex'])
const LEGAL_ECOLOGY_ROLES = new Set(['resource', 'prey', 'competitor', 'scavenger', 'hunter', 'apex'])
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
  'synergy-radar-grid': ['organelle-echo-sac', 'organelle-electric-sac'],
  'synergy-invisible-lure': ['organelle-transparent-membrane', 'organelle-lure-symbiont'],
  'synergy-ram-jet': ['organelle-jet-vacuole', 'organelle-shell-plate'],
  'synergy-acid-feeder': ['organelle-acid-gland', 'organelle-wide-mouth'],
  'synergy-parasite-anchor': ['organelle-needle-mouth', 'organelle-mucus-coat'],
  'synergy-solar-filter': ['organelle-photosome', 'organelle-filter-gill'],
  'synergy-spore-cloud': ['organelle-bud-sac', 'organelle-toxin-spine'],
  'synergy-echo-swarm': ['organelle-division-ring', 'organelle-echo-sac'],
  'synergy-repair-shell': ['organelle-repair-vacuole', 'organelle-shell-plate'],
  'synergy-clean-acid': ['organelle-cleaner-symbiont', 'organelle-acid-gland'],
  'synergy-ghost-cilia': ['organelle-transparent-membrane', 'organelle-cilia-ring'],
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
  behaviorProfiles: 'behavior-',
}

export function validateContent(input: unknown): ContentValidationResult {
  const issues: ContentIssue[] = []
  if (!isRecord(input)) return { issues: [{ path: '$', message: 'content must be an object' }] }

  require(input.schemaVersion === 1, '$.schemaVersion', 'schemaVersion must be 1')
  require(input.projectId === 'proto-cell', '$.projectId', 'projectId must identify proto-cell')
  require(typeof input.contentVersion === 'string' && /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(input.contentVersion), '$.contentVersion', 'contentVersion must be semantic')
  validateMeta(input.meta)
  require(Array.isArray(input.assetCredits) && input.assetCredits.length > 0 && input.assetCredits.every((credit) => isRecord(credit) && ['scope', 'source', 'license'].every((key) => typeof credit[key] === 'string' && credit[key].length > 0)), '$.assetCredits', 'asset source and license metadata is required')
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
  const behaviorProfileIds = idsOf(collections, 'behaviorProfiles')
  const creatureEnvironmentIdsById = new Map((collections.get('creatures') ?? []).flatMap((item) => (
    typeof item.id === 'string' && Array.isArray(item.environmentIds)
      ? [[item.id, new Set(item.environmentIds.filter((id): id is string => typeof id === 'string'))] as const]
      : []
  )))
  const eventIds = idsOf(collections, 'events')
  const bossIds = idsOf(collections, 'bosses')
  const modifierIds = idsOf(collections, 'modifiers')
  const originIds = idsOf(collections, 'origins')
  const spawnTableIds = idsOf(collections, 'spawnTables')
  const spawnTableEnvironmentById = new Map((collections.get('spawnTables') ?? []).flatMap((item) => (
    typeof item.id === 'string' && typeof item.environmentId === 'string' ? [[item.id, item.environmentId] as const] : []
  )))
  const geneIds = idsOf(collections, 'geneNodes')
  const unlockableIds = new Set([...environmentIds, ...organelleIds, ...synergyIds, ...originIds, ...modifierIds])

  const visualsByKind = validateVisualRecipes(collections.get('visualRecipes') ?? [])
  validateNutrients(collections.get('nutrients') ?? [], visualsByKind.cell)
  validateOrganelles(collections.get('organelles') ?? [], organelleIds, environmentIds, visualsByKind.organelle)
  validateSynergies(collections.get('synergies') ?? [], organelleIds, visualsByKind.synergy)
  const synergyOrganelleIds = new Set((collections.get('synergies') ?? []).flatMap((item) => [
    ...(Array.isArray(item.requires) ? item.requires.filter((id): id is string => typeof id === 'string') : []),
    ...(Array.isArray(item.augments) ? item.augments.flatMap((augment) => isRecord(augment) && typeof augment.organId === 'string' ? [augment.organId] : []) : []),
  ]))
  ;(collections.get('organelles') ?? []).forEach((item, index) => require(typeof item.id === 'string' && synergyOrganelleIds.has(item.id), `$.organelles[${index}]`, 'organelle must participate in a synergy'))
  validateCreatures(collections.get('creatures') ?? [], environmentIds, visualsByKind.cell, behaviorProfileIds)
  validateEvents(collections.get('events') ?? [], environmentIds)
  validateBosses(collections.get('bosses') ?? [], environmentIds, visualsByKind.boss, globalIds)
  validateOrigins(collections.get('origins') ?? [], organelleIds, visualsByKind.cell)
  validateModifiers(collections.get('modifiers') ?? [], modifierIds)
  validateDeathTemplates(collections.get('deathTemplates') ?? [])
  validateSpawnTables(collections.get('spawnTables') ?? [], environmentIds, creatureIds, creatureEnvironmentIdsById)
  validateEndings(collections.get('endings') ?? [])
  validateGeneNodes(collections.get('geneNodes') ?? [], geneIds, unlockableIds)
  const m0Entities = validateM0(input.m0, environmentIds, visualsByKind.cell)
  validateOriginsEntityReferences(collections.get('origins') ?? [], m0Entities.playerIds)
  validateEnvironments(collections.get('environments') ?? [], spawnTableIds, spawnTableEnvironmentById, eventIds, bossIds)
  validateJourney(input.journey, environmentIds)
  validateScaleTiers(input.scaleTiers, environmentIds)
  validateFirstRunAssist(input.firstRunAssist)
  validateEcologyBudgets(input.ecologyBudgets, environmentIds)
  validateBehaviorProfiles(collections.get('behaviorProfiles') ?? [])
  validateEcologySpawnCoverage(
    input.ecologyBudgets,
    collections.get('environments') ?? [],
    collections.get('spawnTables') ?? [],
    collections.get('creatures') ?? [],
    collections.get('behaviorProfiles') ?? [],
  )
  validateM1(input.m1, eventIds, environmentIds)

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
      actions: ['start', 'pause', 'resume', 'restart', 'restartAfterLife'],
      labels: ['prototypeCell', 'openingRegion', 'gameCanvas', 'mutationSynergyAugment', 'formPrimalCell', 'formColonyBody', 'formCiliateComposite', 'encounterPrimalShadow', 'encounterFiberGiant', 'encounterFinalHost', 'archiveDishCode', 'archiveEnvironment', 'archivePeakBiomass', 'archiveKeyOrgans', 'archiveSynergies', 'archiveSpeciesSeed', 'archiveNoOrgans', 'archiveCell'],
      hud: ['membrane', 'energy', 'stability', 'biomass', 'evolution'],
      screens: ['pauseTitle', 'pauseDescription', 'resultTitle', 'resultDescription', 'survival', 'contentErrorTitle', 'contentErrorDescription', 'archiveTitle'],
    }
    for (const [group, keys] of Object.entries(requiredCopy)) {
      const copyGroup = isRecord(value[group]) ? value[group] : {}
      for (const key of keys) requiredString(copyGroup[key], `$.ui.${group}.${key}`)
    }
  }

  function validateEnvironments(items: Record<string, unknown>[], spawnIds: Set<string>, spawnEnvironments: Map<string, string>, events: Set<string>, bosses: Set<string>) {
    items.forEach((item, index) => {
      const base = `$.environments[${index}]`
      requiredString(item.name, `${base}.name`)
      require(Number.isInteger(item.order) && Number(item.order) >= 0, `${base}.order`, 'environment order must be a non-negative integer')
      requireTuple(item.durationTargetSec, `${base}.durationTargetSec`)
      finiteRange(item.visibility, 0, 1, `${base}.visibility`)
      finiteRange(item.viscosity, 0, 1, `${base}.viscosity`)
      requireStringArray(item.hazardTags, `${base}.hazardTags`, false)
      reference(item.spawnTableId, spawnIds, `${base}.spawnTableId`, 'spawn table')
      require(typeof item.id === 'string' && typeof item.spawnTableId === 'string' && spawnEnvironments.get(item.spawnTableId) === item.id, `${base}.spawnTableId`, 'spawn table must belong to this environment')
      references(item.eventIds, events, `${base}.eventIds`, 'event')
      if (item.bossId !== undefined) reference(item.bossId, bosses, `${base}.bossId`, 'boss')
      requireStringArray(item.visualPalette, `${base}.visualPalette`, true)
      requiredString(item.ambientAudioId, `${base}.ambientAudioId`)
    })
  }

  function validateScaleTiers(value: unknown, environments: Set<string>) {
    if (!Array.isArray(value)) {
      issues.push({ path: '$.scaleTiers', message: 'three scale tiers are required' })
      return
    }
    require(value.length === 3, '$.scaleTiers', 'scale journey must contain exactly three tiers')
    const tierIds = new Set<string>()
    const formIds = new Set<string>()
    let previous: Record<string, unknown> | undefined
    value.forEach((tier, index) => {
      const base = `$.scaleTiers[${index}]`
      if (!isRecord(tier)) {
        issues.push({ path: base, message: 'scale tier must be an object' })
        return
      }
      const expectedTierId = ['tier-single-cell', 'tier-colony', 'tier-ciliate'][index]
      const expectedFormId = ['form-primal-cell', 'form-colony-body', 'form-ciliate-composite'][index]
      require(typeof tier.id === 'string' && LEGAL_SCALE_TIER_IDS.has(tier.id) && tier.id === expectedTierId && !tierIds.has(tier.id), `${base}.id`, 'scale tier id must be unique and ordered')
      if (typeof tier.id === 'string') tierIds.add(tier.id)
      require(typeof tier.formId === 'string' && LEGAL_FORM_IDS.has(tier.formId) && tier.formId === expectedFormId && !formIds.has(tier.formId), `${base}.formId`, 'form id must be unique and ordered')
      if (typeof tier.formId === 'string') formIds.add(tier.formId)
      requiredString(tier.name, `${base}.name`)
      reference(tier.environmentId, environments, `${base}.environmentId`, 'environment')
      positiveFinite(tier.targetDurationMs, `${base}.targetDurationMs`, 'tier duration must be positive')
      validateIncreasingRange(tier.radiusRange, `${base}.radiusRange`, 0, Number.POSITIVE_INFINITY)
      validateIncreasingRange(tier.screenDiameterRange, `${base}.screenDiameterRange`, 0, 0.3)
      require(typeof tier.worldBodyWidths === 'number' && Number.isFinite(tier.worldBodyWidths) && tier.worldBodyWidths >= 14, `${base}.worldBodyWidths`, 'world must retain at least fourteen body widths')
      require(typeof tier.minimumCollapsedBodyWidths === 'number' && Number.isFinite(tier.minimumCollapsedBodyWidths) && tier.minimumCollapsedBodyWidths >= 6, `${base}.minimumCollapsedBodyWidths`, 'collapsed world must retain at least six body widths')
      positiveFinite(tier.evolutionPressureTarget, `${base}.evolutionPressureTarget`, 'evolution pressure target must be positive')
      require(typeof tier.ecologyBudgetId === 'string' && /^ecology-tier-[a-z0-9-]+$/.test(tier.ecologyBudgetId), `${base}.ecologyBudgetId`, 'tier ecology budget id is invalid')
      require(typeof tier.encounterId === 'string' && /^encounter-[a-z0-9-]+$/.test(tier.encounterId), `${base}.encounterId`, 'tier encounter id is invalid')
      positiveFinite(tier.movementBodyLengthsPerSecond, `${base}.movementBodyLengthsPerSecond`, 'movement speed must be positive')
      positiveFinite(tier.turnResponseMs, `${base}.turnResponseMs`, 'turn response must be positive')
      if (previous) {
        require(tier.environmentId !== previous.environmentId, `${base}.environmentId`, 'adjacent scale tiers must use different environments')
        if (isFinitePair(tier.radiusRange) && isFinitePair(previous.radiusRange)) {
          require(tier.radiusRange[0] > previous.radiusRange[0] && tier.radiusRange[1] > previous.radiusRange[1], `${base}.radiusRange`, 'scale tier radius ranges must ascend')
        }
      }
      previous = tier
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
      require(typeof item.evolutionRoute === 'string' && LEGAL_EVOLUTION_ROUTES.has(item.evolutionRoute), `${base}.evolutionRoute`, 'evolution route is invalid')
      require(typeof item.evolutionTriggerId === 'string' && /^trigger-[a-z0-9-]+$/.test(item.evolutionTriggerId), `${base}.evolutionTriggerId`, 'behavior trigger is required')
      requiredString(item.morphologyPartId, `${base}.morphologyPartId`)
      shortCopy(item.costText, `${base}.costText`, 48)
    })
  }

  function validateSynergies(items: Record<string, unknown>[], organs: Set<string>, visuals: Set<string>) {
    items.forEach((item, index) => {
      const base = `$.synergies[${index}]`
      requiredString(item.name, `${base}.name`)
      references(item.requires, organs, `${base}.requires`, 'organelle', true)
      require(Array.isArray(item.requires) && item.requires.length >= 2, `${base}.requires`, 'synergy requires two organs')
      if (item.augments !== undefined) {
        require(Array.isArray(item.augments) && item.augments.length > 0, `${base}.augments`, 'synergy augments must be a non-empty array')
        const augmentIds = new Set<string>()
        if (Array.isArray(item.augments)) item.augments.forEach((augment, augmentIndex) => {
          const path = `${base}.augments[${augmentIndex}]`
          if (!isRecord(augment)) issues.push({ path, message: 'synergy augment must be an object' })
          else {
            reference(augment.organId, organs, `${path}.organId`, 'organelle')
            shortCopy(augment.effect, `${path}.effect`, 64)
            require(typeof augment.organId === 'string' && !augmentIds.has(augment.organId), `${path}.organId`, 'synergy augment organ must be unique')
            if (typeof augment.organId === 'string') augmentIds.add(augment.organId)
          }
        })
      }
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

  function validateCreatures(items: Record<string, unknown>[], environments: Set<string>, visuals: Set<string>, behaviorProfiles: Set<string>) {
    items.forEach((item, index) => {
      const base = `$.creatures[${index}]`
      requiredString(item.name, `${base}.name`)
      require(typeof item.role === 'string' && LEGAL_CREATURE_ROLES.has(item.role), `${base}.role`, 'creature role is invalid')
      requireTuple(item.sizeRange, `${base}.sizeRange`)
      requiredString(item.behaviorId, `${base}.behaviorId`)
      reference(item.behaviorProfileId, behaviorProfiles, `${base}.behaviorProfileId`, 'behavior profile')
      requireStringArray(item.organelleTags, `${base}.organelleTags`, false)
      references(item.environmentIds, environments, `${base}.environmentIds`, 'environment', true)
      requiredString(item.warningCueId, `${base}.warningCueId`)
      require(typeof item.warningCueId === 'string' && !/^cue-(?:color|red|green|blue|white|orange)(?:-|$)/i.test(item.warningCueId), `${base}.warningCueId`, 'warning cue cannot identify danger by color alone')
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
        for (const field of ['telegraphLeadMs', 'outerMembrane', 'coreIntegrity', 'hazardHoldMs', 'parasiteHoldMs', 'ramOuterDamage', 'ramCoreDamage', 'ramCooldownMs']) {
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

  function validateJourney(value: unknown, environments: Set<string>) {
    if (!isRecord(value) || !Array.isArray(value.stages)) {
      issues.push({ path: '$.journey.stages', message: 'six journey stages are required' })
      return
    }
    require(value.stages.length === 6, '$.journey.stages', 'journey must contain exactly six stages')
    const stageIds = new Set<string>()
    const routeIds = new Set<string>()
    value.stages.forEach((stage, index) => {
      const base = `$.journey.stages[${index}]`
      if (!isRecord(stage)) {
        issues.push({ path: base, message: 'journey stage must be an object' })
        return
      }
      require(stage.index === index + 1, `${base}.index`, 'journey stages must be ordered from one to six')
      require(typeof stage.id === 'string' && stage.id.startsWith('journey-') && !stageIds.has(stage.id), `${base}.id`, 'journey stage id must be unique')
      if (typeof stage.id === 'string') stageIds.add(stage.id)
      for (const field of ['durationMs', 'warningLeadMs', 'collapseDurationMs']) {
        require(typeof stage[field] === 'number' && Number.isFinite(stage[field]) && Number(stage[field]) > 0, `${base}.${field}`, 'journey timing must be positive')
      }
      require(Number(stage.warningLeadMs) < Number(stage.durationMs), `${base}.warningLeadMs`, 'warning lead must be shorter than the stage')
      require(typeof stage.bodyStage === 'string' && LEGAL_BODY_STAGES.has(stage.bodyStage), `${base}.bodyStage`, 'body stage is invalid')
      const expectedRoutes = index < 5 ? 2 : 0
      require(Array.isArray(stage.routeOffers) && stage.routeOffers.length === expectedRoutes, `${base}.routeOffers`, index < 5 ? 'two route offers are required before the finale' : 'the finale cannot offer another route')
      if (!Array.isArray(stage.routeOffers)) return
      stage.routeOffers.forEach((offer, offerIndex) => {
        const path = `${base}.routeOffers[${offerIndex}]`
        if (!isRecord(offer)) {
          issues.push({ path, message: 'route offer must be an object' })
          return
        }
        require(typeof offer.id === 'string' && offer.id.startsWith('journey-route-') && !routeIds.has(offer.id), `${path}.id`, 'journey route id must be unique')
        if (typeof offer.id === 'string') routeIds.add(offer.id)
        reference(offer.destinationEnvironmentId, environments, `${path}.destinationEnvironmentId`, 'route destination environment')
        for (const field of ['rewardId', 'riskId', 'entryModifierId']) requiredString(offer[field], `${path}.${field}`)
      })
    })
  }

  function validateFirstRunAssist(value: unknown) {
    if (!isRecord(value)) {
      issues.push({ path: '$.firstRunAssist', message: 'first-run assistance is required' })
      return
    }
    require(Number.isInteger(value.throughRunOrdinal) && Number(value.throughRunOrdinal) >= 0, '$.firstRunAssist.throughRunOrdinal', 'run ordinal must be non-negative')
    require(typeof value.firstFoodDeadlineMs === 'number' && value.firstFoodDeadlineMs > 0, '$.firstRunAssist.firstFoodDeadlineMs', 'first food deadline must be positive')
    require(typeof value.warningLeadMultiplier === 'number' && value.warningLeadMultiplier >= 1, '$.firstRunAssist.warningLeadMultiplier', 'warning lead multiplier must be at least one')
    requireStringArray(value.blockedOpportunityIds, '$.firstRunAssist.blockedOpportunityIds', true)
  }

  function validateEcologyBudgets(value: unknown, environments: Set<string>) {
    const budgets = recordsAt(value, '$.ecologyBudgets')
    require(budgets.length === environments.size, '$.ecologyBudgets', 'one ecology budget is required per environment')
    const seen = new Set<string>()
    budgets.forEach((budget, index) => {
      const base = `$.ecologyBudgets[${index}]`
      reference(budget.environmentId, environments, `${base}.environmentId`, 'environment')
      require(typeof budget.environmentId === 'string' && !seen.has(budget.environmentId), `${base}.environmentId`, 'ecology budget environment must be unique')
      if (typeof budget.environmentId === 'string') seen.add(budget.environmentId)
      for (const field of ['resource', 'prey', 'competitor', 'scavenger', 'hunter', 'apex', 'opportunityIntervalMs']) {
        requireTuple(budget[field], `${base}.${field}`)
        require(Array.isArray(budget[field]) && budget[field].every((entry) => Number.isInteger(entry) && entry >= 0), `${base}.${field}`, 'ecology ranges must use non-negative integers')
      }
      require(Array.isArray(budget.opportunityIntervalMs) && Number(budget.opportunityIntervalMs[0]) >= 1000, `${base}.opportunityIntervalMs`, 'opportunity intervals must be at least one second')
    })
  }

  function validateBehaviorProfiles(items: Record<string, unknown>[]) {
    require(items.length === LEGAL_BEHAVIOR_FAMILIES.size, '$.behaviorProfiles', 'one profile is required for every behavior family')
    const families = new Set<string>()
    items.forEach((profile, index) => {
      const base = `$.behaviorProfiles[${index}]`
      require(typeof profile.family === 'string' && LEGAL_BEHAVIOR_FAMILIES.has(profile.family) && !families.has(profile.family), `${base}.family`, 'behavior family must be valid and unique')
      if (typeof profile.family === 'string') families.add(profile.family)
      requiredString(profile.movementPattern, `${base}.movementPattern`)
      requiredString(profile.weaknessId, `${base}.weaknessId`)
      require(typeof profile.perceptionRadius === 'number' && Number.isFinite(profile.perceptionRadius) && profile.perceptionRadius > 0, `${base}.perceptionRadius`, 'perception radius must be positive')
      require(typeof profile.abandonAfterMs === 'number' && Number.isFinite(profile.abandonAfterMs) && profile.abandonAfterMs >= 0, `${base}.abandonAfterMs`, 'abandon timer must be non-negative')
      if (profile.family === 'hunter') {
        require(typeof profile.pursuitBurstMs === 'number' && Number.isFinite(profile.pursuitBurstMs) && profile.pursuitBurstMs >= 600, `${base}.pursuitBurstMs`, 'hunter pursuit bursts must stay readable')
        require(typeof profile.recoveryMs === 'number' && Number.isFinite(profile.recoveryMs) && profile.recoveryMs >= 400, `${base}.recoveryMs`, 'hunter recovery must leave an escape window')
        require(typeof profile.turnResponseMs === 'number' && Number.isFinite(profile.turnResponseMs) && profile.turnResponseMs >= 250, `${base}.turnResponseMs`, 'hunter turning must remain readable')
      }
    })
  }

  function validateEcologySpawnCoverage(
    value: unknown,
    environments: Record<string, unknown>[],
    spawnTables: Record<string, unknown>[],
    creatures: Record<string, unknown>[],
    profiles: Record<string, unknown>[],
  ) {
    if (!Array.isArray(value)) return
    const spawnTableIdByEnvironment = new Map(environments.flatMap((environment) => (
      typeof environment.id === 'string' && typeof environment.spawnTableId === 'string'
        ? [[environment.id, environment.spawnTableId] as const]
        : []
    )))
    const creatureIdsByTable = new Map(spawnTables.flatMap((table) => (
      typeof table.id === 'string' && Array.isArray(table.entries)
        ? [[table.id, new Set(table.entries.flatMap((entry) => isRecord(entry) && typeof entry.creatureId === 'string' ? [entry.creatureId] : []))] as const]
        : []
    )))
    const familyByProfile = new Map(profiles.flatMap((profile) => (
      typeof profile.id === 'string' && typeof profile.family === 'string' ? [[profile.id, profile.family] as const] : []
    )))
    const familyByCreature = new Map(creatures.flatMap((creature) => (
      typeof creature.id === 'string' && typeof creature.behaviorProfileId === 'string'
        ? [[creature.id, familyByProfile.get(creature.behaviorProfileId)] as const]
        : []
    )))
    const familiesByRole: Record<string, Set<string>> = {
      resource: new Set(['resource']),
      prey: new Set(['skittish']),
      competitor: new Set(['school', 'competitor']),
      scavenger: new Set(['scavenger']),
      hunter: new Set(['hunter', 'ambusher']),
      apex: new Set(['apex']),
    }

    value.forEach((budget, index) => {
      if (!isRecord(budget) || typeof budget.environmentId !== 'string') return
      const tableId = spawnTableIdByEnvironment.get(budget.environmentId)
      const creatureIds = creatureIdsByTable.get(tableId ?? '') ?? new Set<string>()
      for (const role of LEGAL_ECOLOGY_ROLES) {
        const range = budget[role]
        if (!Array.isArray(range) || Number(range[1]) <= 0) continue
        const supported = [...creatureIds].some((creatureId) => familiesByRole[role]?.has(familyByCreature.get(creatureId) ?? ''))
        require(supported, `$.ecologyBudgets[${index}].${role}`, `nonzero ${role} budget requires a matching spawn-table creature`)
      }
    })
  }

  function validateM1(value: unknown, events: Set<string>, environments: Set<string>) {
    if (!isRecord(value)) {
      issues.push({ path: '$.m1', message: 'M1 pacing configuration is required' })
      return
    }
    require(typeof value.firstEvolutionAtMs === 'number' && Number.isFinite(value.firstEvolutionAtMs) && value.firstEvolutionAtMs > 0 && value.firstEvolutionAtMs <= 45_000, '$.m1.firstEvolutionAtMs', 'first evolution must occur by 45 seconds')
    requireTuple(value.sliceTargetMs, '$.m1.sliceTargetMs')
    require(Array.isArray(value.sliceTargetMs) && Number(value.sliceTargetMs[0]) >= 300_000 && Number(value.sliceTargetMs[1]) <= 480_000, '$.m1.sliceTargetMs', 'M1 slice must target five to eight minutes')
    require(typeof value.bossSpawnAtMs === 'number' && Number.isFinite(value.bossSpawnAtMs) && value.bossSpawnAtMs > 0, '$.m1.bossSpawnAtMs', 'M1 boss spawn time is required')
    if (!isRecord(value.ecologyReplenishment)) issues.push({ path: '$.m1.ecologyReplenishment', message: 'ecology replenishment configuration is required' })
    else {
      const ecology = value.ecologyReplenishment
      for (const field of ['intervalMs', 'targetFoodCount', 'batchSize', 'localFoodTarget', 'localRadius', 'minPlayerDistance', 'minHostileDistance']) {
        require(typeof ecology[field] === 'number' && Number.isFinite(ecology[field]) && Number(ecology[field]) > 0, `$.m1.ecologyReplenishment.${field}`, `${field} must be positive`)
      }
      require(Number(ecology.batchSize) <= Number(ecology.targetFoodCount), '$.m1.ecologyReplenishment.batchSize', 'food batch must not exceed its target')
    }
    if (!isRecord(value.spawnPresentation)) {
      issues.push({ path: '$.m1.spawnPresentation', message: 'spawn presentation configuration is required' })
    } else {
      const presentation = value.spawnPresentation
      require(typeof presentation.foodMaterializeMs === 'number' && Number.isFinite(presentation.foodMaterializeMs) && presentation.foodMaterializeMs >= 400, '$.m1.spawnPresentation.foodMaterializeMs', 'food needs a readable materialization window')
      require(typeof presentation.neutralMaterializeMs === 'number' && Number.isFinite(presentation.neutralMaterializeMs) && presentation.neutralMaterializeMs >= 400, '$.m1.spawnPresentation.neutralMaterializeMs', 'neutral creatures need a readable materialization window')
      require(typeof presentation.threatApproachSpeedRatio === 'number' && Number.isFinite(presentation.threatApproachSpeedRatio) && presentation.threatApproachSpeedRatio > 0 && presentation.threatApproachSpeedRatio <= 0.4, '$.m1.spawnPresentation.threatApproachSpeedRatio', 'unaware threats must approach below forty percent speed')
      require(typeof presentation.threatSpawnDistance === 'number' && Number.isFinite(presentation.threatSpawnDistance) && presentation.threatSpawnDistance >= 180, '$.m1.spawnPresentation.threatSpawnDistance', 'threats must spawn outside the mobile view')
      require(typeof presentation.threatDiscoveryDistance === 'number' && Number.isFinite(presentation.threatDiscoveryDistance) && presentation.threatDiscoveryDistance >= 70 && presentation.threatDiscoveryDistance <= Number(presentation.threatSpawnDistance) - 40, '$.m1.spawnPresentation.threatDiscoveryDistance', 'threat discovery must happen after a readable approach')
      require(typeof presentation.threatAlertMs === 'number' && Number.isFinite(presentation.threatAlertMs) && presentation.threatAlertMs >= 500, '$.m1.spawnPresentation.threatAlertMs', 'discovered threats need a readable alert beat')
    }
    if (!Array.isArray(value.stageEntryEcology) || value.stageEntryEcology.length !== 6) {
      issues.push({ path: '$.m1.stageEntryEcology', message: 'one entry ecology profile is required for each journey stage' })
    } else value.stageEntryEcology.forEach((entry, index) => {
      const path = `$.m1.stageEntryEcology[${index}]`
      if (!isRecord(entry)) {
        issues.push({ path, message: 'stage entry ecology must be an object' })
        return
      }
      require(entry.stageIndex === index + 1, `${path}.stageIndex`, 'stage entry ecology must be ordered from one to six')
      require(Array.isArray(entry.groups) && entry.groups.length > 0, `${path}.groups`, 'stage entry ecology groups are required')
      if (Array.isArray(entry.groups)) entry.groups.forEach((group, groupIndex) => {
        const groupPath = `${path}.groups[${groupIndex}]`
        if (!isRecord(group)) {
          issues.push({ path: groupPath, message: 'entry ecology group must be an object' })
          return
        }
        require(typeof group.role === 'string' && LEGAL_ECOLOGY_ROLES.has(group.role), `${groupPath}.role`, 'entry ecology role is invalid')
        require(typeof group.count === 'number' && Number.isInteger(group.count) && group.count > 0, `${groupPath}.count`, 'entry ecology count must be a positive integer')
        require(typeof group.distance === 'number' && Number.isFinite(group.distance) && group.distance >= 60 && group.distance <= 360, `${groupPath}.distance`, 'entry ecology distance must stay readable')
      })
    })
    if (!Array.isArray(value.stageThreatProfiles) || value.stageThreatProfiles.length !== 6) {
      issues.push({ path: '$.m1.stageThreatProfiles', message: 'one threat profile is required for each journey stage' })
    } else value.stageThreatProfiles.forEach((profile, index) => {
      const path = `$.m1.stageThreatProfiles[${index}]`
      if (!isRecord(profile)) {
        issues.push({ path, message: 'stage threat profile must be an object' })
        return
      }
      require(profile.stageIndex === index + 1, `${path}.stageIndex`, 'stage threat profiles must be ordered from one to six')
      for (const field of ['hostileCruiseSpeedRatio', 'pursuitSpeedMultiplier', 'minimumHunterRadiusRatio', 'contactDamageMultiplier', 'spawnClearance']) {
        require(typeof profile[field] === 'number' && Number.isFinite(profile[field]) && Number(profile[field]) > 0, `${path}.${field}`, `${field} must be positive`)
      }
      require(Number(profile.minimumHunterRadiusRatio) >= 1, `${path}.minimumHunterRadiusRatio`, 'hunters must not be smaller than their target')
      require(Number(profile.contactDamageMultiplier) >= 1, `${path}.contactDamageMultiplier`, 'contact damage must not be reduced below authored damage')
      require(Number(profile.spawnClearance) >= 48, `${path}.spawnClearance`, 'hostile spawns must leave a readable reaction gap')
      if (index > 0) {
        require(Number(profile.hostileCruiseSpeedRatio) * Number(profile.pursuitSpeedMultiplier) >= 1.1, `${path}.pursuitSpeedMultiplier`, 'post-intro hunters must reach at least 110% of player speed while pursuing')
      }
    })
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
      reference(rift.destinationEnvironmentId, environments, `${path}.destinationEnvironmentId`, 'route destination environment')
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
      if (item.conditionId === 'boss-resolved-and-stable') {
        require(typeof item.minimumStability === 'number' && Number.isFinite(item.minimumStability) && item.minimumStability >= 0 && item.minimumStability <= 100, `$.endings[${index}].minimumStability`, 'stable ending threshold must be between zero and one hundred')
      }
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

  function validateSpawnTables(items: Record<string, unknown>[], environments: Set<string>, creatures: Set<string>, creatureEnvironments: Map<string, Set<string>>) {
    items.forEach((item, index) => {
      const base = `$.spawnTables[${index}]`
      reference(item.environmentId, environments, `${base}.environmentId`, 'environment')
      if (!Array.isArray(item.entries) || item.entries.length === 0) issues.push({ path: `${base}.entries`, message: 'spawn entries are required' })
      else item.entries.forEach((entry, entryIndex) => {
        const path = `${base}.entries[${entryIndex}]`
        if (!isRecord(entry)) issues.push({ path, message: 'spawn entry must be an object' })
        else {
          reference(entry.creatureId, creatures, `${path}.creatureId`, 'creature')
          require(typeof item.environmentId === 'string' && typeof entry.creatureId === 'string' && creatureEnvironments.get(entry.creatureId)?.has(item.environmentId) === true, `${path}.creatureId`, 'spawned creature must support this environment')
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
    if (!Array.isArray(value.playerDefinitions)) issues.push({ path: '$.m0.playerDefinitions', message: 'origin player definitions are required' })
    else value.playerDefinitions.forEach((definition, index) => {
      const path = `$.m0.playerDefinitions[${index}]`
      if (!isRecord(definition)) {
        issues.push({ path, message: 'player definition must be an object' })
        return
      }
      validatePlayerDefinition(definition, path, visuals, playerIds)
    })
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
        validatePlayerDefinition(environment.playerDefinition, `${base}.playerDefinition`, visuals, playerIds)
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

  function validatePlayerDefinition(definition: Record<string, unknown>, path: string, visuals: Set<string>, playerIds: Set<string>) {
    validateEntityDefinition(definition, path, visuals)
    require(definition.role === 'player', `${path}.role`, 'player role must be player')
    require(definition.faction === 'player', `${path}.faction`, 'player faction must be player')
    require(typeof definition.stability === 'number' && Number.isFinite(definition.stability), `${path}.stability`, 'player stability is required')
    require(typeof definition.evolutionThreshold === 'number' && Number.isFinite(definition.evolutionThreshold) && definition.evolutionThreshold > 0, `${path}.evolutionThreshold`, 'evolution threshold must be positive')
    require(typeof definition.evolutionThresholdGrowth === 'number' && Number.isFinite(definition.evolutionThresholdGrowth) && definition.evolutionThresholdGrowth > 1, `${path}.evolutionThresholdGrowth`, 'evolution threshold growth must be greater than one')
    if (typeof definition.id === 'string') playerIds.add(definition.id)
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

  function validateIncreasingRange(value: unknown, path: string, minimumExclusive: number, maximumInclusive: number) {
    require(isFinitePair(value) && value[0] > minimumExclusive && value[1] > value[0] && value[1] <= maximumInclusive, path, 'numeric range is outside the allowed interval')
  }

  function isFinitePair(value: unknown): value is [number, number] {
    return Array.isArray(value) && value.length === 2 && value.every((entry) => typeof entry === 'number' && Number.isFinite(entry))
  }

  function positiveFinite(value: unknown, path: string, message: string) {
    require(typeof value === 'number' && Number.isFinite(value) && value > 0, path, message)
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
