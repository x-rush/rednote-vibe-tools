import type {
  NpcCue,
  NpcPose,
  RelationshipCategory,
  RelationshipContentPackage,
  RelationshipContext,
} from '../content/schema'

export type NpcCueRequest = {
  trigger: NpcCue['trigger']
  category?: RelationshipCategory
  relationshipContext?: RelationshipContext
  conflictRuleId?: string
}

const NPC_ASSETS: Record<NpcPose, string> = {
  daily: './assets/guide/xiaoman-daily-v2.webp',
  listening: './assets/guide/xiaoman-listening-v2.webp',
  reminder: './assets/guide/xiaoman-reminder-v2.webp',
}

export function selectNpcCue(
  content: RelationshipContentPackage,
  request: NpcCueRequest,
): NpcCue | null {
  return content.content.npcCues.find((cue) => (
    cue.trigger === request.trigger
    && (request.category === undefined || cue.category === request.category)
    && (request.relationshipContext === undefined || cue.relationshipContext === request.relationshipContext)
    && (request.conflictRuleId === undefined || cue.conflictRuleId === request.conflictRuleId)
  )) ?? null
}

export function getNpcAsset(pose: NpcPose): string {
  return NPC_ASSETS[pose]
}
