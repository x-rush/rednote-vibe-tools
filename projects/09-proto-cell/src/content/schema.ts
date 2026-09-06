import type { EntityFaction, EntityRole } from '../domain/types'

export type EnvironmentId = `env-${string}`
export type NutrientId = `nutrient-${string}`
export type OrganelleId = `organelle-${string}`
export type SynergyId = `synergy-${string}`
export type CreatureId = `${'creature' | 'predator'}-${string}`
export type EventId = `event-${string}`
export type BossId = `boss-${string}`
export type OriginId = `origin-${string}`
export type ModifierId = `modifier-${string}`
export type EndingId = `ending-${string}`
export type DeathTemplateId = `death-${string}`
export type FormId = 'form-primal-cell' | 'form-colony-body' | 'form-ciliate-composite'
export type ScaleTierId = 'tier-single-cell' | 'tier-colony' | 'tier-ciliate'

export type AnchorSlot = 'core' | 'membrane' | 'front' | 'rear' | 'left' | 'right' | 'internal' | 'symbiont'
export type OrganelleCategory = 'sense' | 'move' | 'feed' | 'defend' | 'attack' | 'metabolism' | 'reproduce' | 'symbiosis'
export type BossResolutionPath = 'combat' | 'environment' | 'stealth' | 'parasite'
export type BodyStage = 'microbe' | 'hunter' | 'specialist' | 'dominant' | 'ascendant'
export type BehaviorProfileId = `behavior-${string}`

export type ScaleTierDefinition = {
  id: ScaleTierId
  formId: FormId
  name: string
  environmentId: EnvironmentId
  targetDurationMs: number
  radiusRange: [number, number]
  screenDiameterRange: [number, number]
  worldBodyWidths: number
  minimumCollapsedBodyWidths: number
  evolutionPressureTarget: number
  ecologyBudgetId: `ecology-tier-${string}`
  encounterId: `encounter-${string}`
  movementBodyLengthsPerSecond: number
  turnResponseMs: number
}

export type ContactDamageContent = {
  source: 'acid' | 'electric' | 'spine' | 'ram'
  amount: number
  periodMs: number
  activeMs: number
  phaseOffsetMs: number
}

export type EntityDefinitionContent = {
  id: string
  role: EntityRole
  faction: EntityFaction
  radius: number
  mass: number
  membrane: number
  energy: number
  maxSpeed: number
  visualRecipeId: string
  contactDamage?: ContactDamageContent
}

export type PlayerDefinitionContent = EntityDefinitionContent & {
  stability: number
  evolutionThreshold: number
  evolutionThresholdGrowth: number
}

export type M0EnvironmentContent = {
  id: EnvironmentId
  width: number
  height: number
  playerDefinition: PlayerDefinitionContent
  entityDefinitions: EntityDefinitionContent[]
  spawnSchedule: Array<{ atMs: number; definitionId: string; count: number }>
}

export type EnvironmentDefinition = {
  id: EnvironmentId
  name: string
  order: number
  durationTargetSec: [number, number]
  visibility: number
  viscosity: number
  hazardTags: string[]
  spawnTableId: string
  eventIds: EventId[]
  bossId?: BossId
  visualPalette: string[]
  ambientAudioId: string
}

export type NutrientDefinition = {
  id: NutrientId
  name: string
  behaviorId: string
  riskTags: string[]
  visualRecipeId: string
  scaleTierIds?: ScaleTierId[]
}

export type OrganelleDefinition = {
  id: OrganelleId
  name: string
  category: OrganelleCategory
  slots: AnchorSlot[]
  rarity: 'common' | 'uncommon' | 'rare'
  cost: { biomass?: number; energy?: number; stability?: number }
  tags: string[]
  conflicts: OrganelleId[]
  shortEffect: string
  triggerDescription: string
  behaviorId: string
  visualMutationId: string
  evolutionRoute: 'predation' | 'survival' | 'colony'
  evolutionTriggerId: `trigger-${string}`
  morphologyPartId: string
  costText: string
  environmentIds: EnvironmentId[]
  unlockId?: string
}

export type SynergyDefinition = {
  id: SynergyId
  name: string
  requires: OrganelleId[]
  augments?: Array<{ organId: OrganelleId; effect: string }>
  excludes?: OrganelleId[]
  behaviorId: string
  revealRule: 'on-trigger' | 'on-install'
  shortEffect: string
  visualMutationId: string
}

export type CreatureDefinition = {
  id: CreatureId
  name: string
  role: 'resource' | 'prey' | 'scavenger' | 'hunter' | 'parasite' | 'swarm' | 'elite'
  sizeRange: [number, number]
  behaviorId: string
  behaviorProfileId: BehaviorProfileId
  organelleTags: string[]
  environmentIds: EnvironmentId[]
  warningCueId?: string
  responseTags: string[]
  dropTableId: string
  visualRecipeId: string
  scaleTierIds?: ScaleTierId[]
}

export type EventDefinition = {
  id: EventId
  name: string
  behaviorId: string
  environmentIds: EnvironmentId[]
  durationSec: [number, number]
  telegraphIds: string[]
  variantIds: string[]
  telegraphLeadMs: number
  variants: Array<{ id: string; radius: number; resourceCount: number; attractionStrength: number; flow: number }>
}

export type BossPhase = { id: string; behaviorId: string }

export type BossDefinition = {
  id: BossId
  name: string
  environmentId: EnvironmentId
  phases: BossPhase[]
  telegraphIds: string[]
  resolutionPaths: BossResolutionPath[]
  rewardIds: string[]
  visualRecipeId: string
  rules: {
    telegraphLeadMs: number
    outerMembrane: number
    coreIntegrity: number
    hazardHoldMs: number
    parasiteHoldMs: number
    stealthLockMax: number
    environmentHazardIds: string[]
    ramOuterDamage: number
    ramCoreDamage: number
    ramCooldownMs: number
  }
  entity: EntityDefinitionContent
}

export type OriginDefinition = {
  id: OriginId
  name: string
  entityDefinitionId: string
  initialOrganelleIds: OrganelleId[]
  visualRecipeId: string
  unlockId?: string
}

export type ModifierDefinition = {
  id: ModifierId
  name: string
  shortEffect: string
  behaviorId: string
  difficultyWeight: number
  rewardMultiplier: number
  excludes: ModifierId[]
  accessibilityImpact: string
}

export type EndingDefinition = { id: EndingId; name: string; conditionId: string; minimumStability?: number }

export type DeathTemplateDefinition = {
  id: DeathTemplateId
  eventType: string
  requiredTags?: string[]
  excludedTags?: string[]
  priority: number
  text: string
}

export type VisualRecipeDefinition = {
  id: string
  kind: 'cell' | 'organelle' | 'synergy' | 'environment' | 'event' | 'boss' | 'ui'
  palette: string[]
}

export type SpawnTableDefinition = {
  id: `spawn-${string}`
  environmentId: EnvironmentId
  entries: Array<{ creatureId: CreatureId; weight: number; minAtMs: number }>
}

export type GeneNodeDefinition = {
  id: `gene-${string}`
  name: string
  requires: string[]
  unlockIds: string[]
  cost: number
}

export type JourneyStageDefinition = {
  index: number
  id: `journey-${string}`
  durationMs: number
  warningLeadMs: number
  collapseDurationMs: number
  routeOffers: Array<{
    id: `journey-route-${string}`
    destinationEnvironmentId: EnvironmentId
    rewardId: string
    riskId: string
    entryModifierId: string
  }>
  bodyStage: BodyStage
}

export type JourneyDefinition = { stages: JourneyStageDefinition[] }

export type FirstRunAssistDefinition = {
  throughRunOrdinal: number
  firstFoodDeadlineMs: number
  warningLeadMultiplier: number
  blockedOpportunityIds: string[]
}

export type EcologyBudgetDefinition = {
  environmentId: EnvironmentId
  resource: [number, number]
  prey: [number, number]
  competitor: [number, number]
  scavenger: [number, number]
  hunter: [number, number]
  apex: [number, number]
  opportunityIntervalMs: [number, number]
}

export type StageEntryEcologyDefinition = {
  stageIndex: number
  groups: Array<{
    role: 'resource' | 'prey' | 'competitor' | 'scavenger' | 'hunter' | 'apex'
    count: number
    distance: number
  }>
}

export type StageThreatProfileDefinition = {
  stageIndex: number
  hostileCruiseSpeedRatio: number
  pursuitSpeedMultiplier: number
  minimumHunterRadiusRatio: number
  contactDamageMultiplier: number
  spawnClearance: number
}

export type BehaviorProfileDefinition = {
  id: BehaviorProfileId
  family: 'resource' | 'skittish' | 'school' | 'competitor' | 'ambusher' | 'hunter' | 'scavenger' | 'apex'
  movementPattern: string
  weaknessId: string
  perceptionRadius: number
  abandonAfterMs: number
  pursuitBurstMs?: number
  recoveryMs?: number
  turnResponseMs?: number
}

export type ContentPack = {
  schemaVersion: 1
  contentVersion: string
  projectId: 'proto-cell'
  meta: { title: string; locale: 'zh-CN'; tagline: string; fictionDisclaimer: string }
  assetCredits: Array<{ scope: string; source: string; license: string }>
  ui: {
    actions: Record<string, string>
    labels: Record<string, string>
    hud: Record<string, string>
    screens: Record<string, string>
  }
  environments: EnvironmentDefinition[]
  nutrients: NutrientDefinition[]
  organelles: OrganelleDefinition[]
  synergies: SynergyDefinition[]
  creatures: CreatureDefinition[]
  events: EventDefinition[]
  bosses: BossDefinition[]
  origins: OriginDefinition[]
  modifiers: ModifierDefinition[]
  endings: EndingDefinition[]
  deathTemplates: DeathTemplateDefinition[]
  visualRecipes: VisualRecipeDefinition[]
  spawnTables: SpawnTableDefinition[]
  geneNodes: GeneNodeDefinition[]
  journey: JourneyDefinition
  firstRunAssist: FirstRunAssistDefinition
  ecologyBudgets: EcologyBudgetDefinition[]
  behaviorProfiles: BehaviorProfileDefinition[]
  scaleTiers: ScaleTierDefinition[]
  m0: { playerDefinitions: PlayerDefinitionContent[]; environments: M0EnvironmentContent[] }
  m1: {
    sliceTargetMs: [number, number]
    firstEvolutionAtMs: number
    eventSchedule: Array<{ eventId: EventId; atMs: number }>
    bossSpawnAtMs: number
    ecologyReplenishment: {
      intervalMs: number
      targetFoodCount: number
      batchSize: number
      localFoodTarget: number
      localRadius: number
      minPlayerDistance: number
      minHostileDistance: number
    }
    spawnPresentation: {
      foodMaterializeMs: number
      neutralMaterializeMs: number
      threatApproachSpeedRatio: number
      threatSpawnDistance: number
      threatDiscoveryDistance: number
      threatAlertMs: number
    }
    stageEntryEcology: StageEntryEcologyDefinition[]
    stageThreatProfiles: StageThreatProfileDefinition[]
    routeRifts: Array<{
      id: `route-rift-${string}`
      destinationEnvironmentId: EnvironmentId
      opensAtMs: number
      hazardId: string
      resourceId: string
      affinityIconId: string
    }>
  }
}
