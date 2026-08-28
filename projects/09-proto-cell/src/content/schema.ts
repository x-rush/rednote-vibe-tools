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

export type AnchorSlot = 'core' | 'membrane' | 'front' | 'rear' | 'left' | 'right' | 'internal' | 'symbiont'
export type OrganelleCategory = 'sense' | 'move' | 'feed' | 'defend' | 'attack' | 'metabolism' | 'reproduce' | 'symbiosis'
export type BossResolutionPath = 'combat' | 'environment' | 'stealth' | 'parasite'

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

export type M0EnvironmentContent = {
  id: EnvironmentId
  width: number
  height: number
  playerDefinition: EntityDefinitionContent & { stability: number; evolutionThreshold: number; evolutionThresholdGrowth: number }
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
  environmentIds: EnvironmentId[]
  unlockId?: string
}

export type SynergyDefinition = {
  id: SynergyId
  name: string
  requires: OrganelleId[]
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
  organelleTags: string[]
  environmentIds: EnvironmentId[]
  warningCueId?: string
  responseTags: string[]
  dropTableId: string
  visualRecipeId: string
}

export type EventDefinition = {
  id: EventId
  name: string
  behaviorId: string
  environmentIds: EnvironmentId[]
  durationSec: [number, number]
  telegraphIds: string[]
  variantIds: string[]
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

export type EndingDefinition = { id: EndingId; name: string; conditionId: string }

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

export type ContentPack = {
  schemaVersion: 1
  contentVersion: string
  projectId: 'proto-cell'
  meta: { title: string; locale: 'zh-CN'; tagline: string; fictionDisclaimer: string }
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
  m0: { environments: M0EnvironmentContent[] }
}
