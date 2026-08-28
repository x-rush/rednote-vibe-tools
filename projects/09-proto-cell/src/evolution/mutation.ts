import { getContent, type AnchorSlot, type EnvironmentId, type OrganelleDefinition, type OrganelleId, type SynergyId } from '../content'
import type { InstalledOrganelle } from './organs'

export type MutationLane = 'continuation' | 'adaptation' | 'risk'
export type MutationAction = 'install' | 'mature' | 'replace' | 'recombine' | 'expand'

export type MutationChoice = {
  organId: OrganelleId
  lane: MutationLane
  action: MutationAction
  replacedOrganId?: OrganelleId
  currentStability: number
  resultingStability: number
  previewAnchor: AnchorSlot
  revealedSynergyIds: SynergyId[]
  visualMutationId: string
}

export type MutationContext = {
  environmentId: EnvironmentId
  organIds: OrganelleId[]
  matureOrganIds: OrganelleId[]
  installed: InstalledOrganelle[]
  stability: number
  capacity: number
}

export type MutationInstallResult = {
  installed: InstalledOrganelle
  organelles: InstalledOrganelle[]
  stability: number
  capacity: number
  synergyIds: SynergyId[]
}

export function createMutationContext(environmentId: EnvironmentId): MutationContext {
  return {
    environmentId,
    organIds: [],
    matureOrganIds: [],
    installed: [],
    stability: 100,
    capacity: 6,
  }
}

export function continueMutationContext(
  context: MutationContext,
  result: MutationInstallResult,
): MutationContext {
  return {
    ...context,
    organIds: result.organelles.map((organ) => organ.id),
    matureOrganIds: result.organelles.filter((organ) => organ.stage === 'mature').map((organ) => organ.id),
    installed: result.organelles,
    stability: result.stability,
    capacity: result.capacity,
  }
}

export function offerMutations(context: MutationContext): MutationChoice[] {
  const content = getContent()
  const definitions = content.organelles
  const byId = new Map(definitions.map((definition) => [definition.id, definition]))
  const mature = new Set(context.matureOrganIds)
  const installed = new Set(context.organIds)
  const used = new Set<OrganelleId>()

  const immatureInstalled = context.organIds.map((id) => byId.get(id)).find((definition) => definition && !mature.has(definition.id))
  const synergyCompleters = content.synergies
    .filter((synergy) => synergy.requires.some((id) => installed.has(id)))
    .flatMap((synergy) => synergy.requires)
    .map((id) => byId.get(id))
    .filter((definition): definition is OrganelleDefinition => Boolean(definition) && !installed.has(definition!.id))

  const continuation = immatureInstalled
    ?? synergyCompleters[0]
    ?? definitions.find((definition) => definition.rarity === 'common' && !installed.has(definition.id))
  if (continuation) used.add(continuation.id)

  const adaptation = [...synergyCompleters, ...definitions]
    .find((definition) => !used.has(definition.id) && !installed.has(definition.id) && definition.environmentIds.includes(context.environmentId))
  if (adaptation) used.add(adaptation.id)

  const risk = definitions.find((definition) => definition.rarity === 'rare' && !used.has(definition.id) && !installed.has(definition.id))
    ?? definitions.find((definition) => !used.has(definition.id) && !installed.has(definition.id))

  const candidates: Array<[MutationLane, OrganelleDefinition | undefined]> = [
    ['continuation', continuation],
    ['adaptation', adaptation],
    ['risk', risk],
  ]

  return candidates.flatMap(([lane, definition]) => definition ? [toChoice(definition, lane, context)] : [])
}

export function installMutation(context: MutationContext, choice: MutationChoice): MutationInstallResult {
  const definition = getContent().organelles.find((item) => item.id === choice.organId)
  if (!definition) throw new RangeError(`Unknown organ id: ${choice.organId}`)

  const existing = context.installed.find((organ) => organ.id === choice.organId)
  const retained = choice.action === 'replace'
    ? context.installed.filter((organ) => organ.id !== choice.replacedOrganId)
    : context.installed
  const installed: InstalledOrganelle = existing
    ? { ...existing, stage: 'mature', charges: definition.behaviorId === 'fatal-hit-guard' ? 2 : existing.charges }
    : {
        id: definition.id,
        stage: 'installed',
        anchor: chooseAnchor(definition.slots, retained),
        charges: definition.behaviorId === 'fatal-hit-guard' ? 1 : undefined,
      }
  const organelles = existing
    ? retained.map((organ) => organ.id === existing.id ? installed : organ)
    : [...retained, installed]

  return {
    installed,
    organelles,
    stability: choice.resultingStability,
    capacity: context.capacity + (choice.action === 'expand' ? 1 : 0),
    synergyIds: activeSynergies(organelles.map((organ) => organ.id)),
  }
}

function toChoice(definition: OrganelleDefinition, lane: MutationLane, context: MutationContext): MutationChoice {
  const alreadyInstalled = context.organIds.includes(definition.id)
  const usesSymbiontSlot = definition.slots.every((slot) => slot === 'symbiont')
  const occupiedAnchors = new Set(context.installed.map((organ) => organ.anchor))
  const hasFreeCompatibleAnchor = definition.slots.some((slot) => !occupiedAnchors.has(slot))
  const capacityReached = usesSymbiontSlot
    ? context.installed.some((organ) => organ.anchor === 'symbiont')
    : context.installed.filter((organ) => organ.anchor !== 'symbiont').length >= context.capacity
  const atCapacity = capacityReached || !hasFreeCompatibleAnchor
  const action: MutationAction = alreadyInstalled
    ? 'mature'
    : atCapacity
      ? lane === 'risk' && !usesSymbiontSlot ? 'expand' : 'replace'
      : 'install'
  const replacedOrganId = action === 'replace'
    ? context.installed.find((organ) => definition.slots.includes(organ.anchor))?.id
      ?? context.installed.find((organ) => usesSymbiontSlot ? organ.anchor === 'symbiont' : organ.anchor !== 'symbiont')?.id
    : undefined
  const resultingIds = alreadyInstalled
    ? context.organIds
    : [...context.organIds.filter((id) => id !== replacedOrganId), definition.id]
  return {
    organId: definition.id,
    lane,
    action,
    replacedOrganId,
    currentStability: context.stability,
    resultingStability: Math.max(0, context.stability - (definition.cost.stability ?? 0)),
    previewAnchor: alreadyInstalled
      ? context.installed.find((organ) => organ.id === definition.id)?.anchor ?? definition.slots[0]
      : chooseAnchor(definition.slots, context.installed.filter((organ) => organ.id !== replacedOrganId)),
    revealedSynergyIds: activeSynergies(resultingIds),
    visualMutationId: definition.visualMutationId,
  }
}

function chooseAnchor(slots: AnchorSlot[], installed: InstalledOrganelle[]): AnchorSlot {
  const occupied = new Set(installed.map((organ) => organ.anchor))
  return slots.find((slot) => !occupied.has(slot)) ?? slots[0]
}

function activeSynergies(organIds: OrganelleId[]): SynergyId[] {
  const installed = new Set(organIds)
  return getContent().synergies
    .filter((synergy) => synergy.requires.every((id) => installed.has(id)))
    .map((synergy) => synergy.id)
}
