import type {
  ManualSentence,
  RelationshipBank,
  RelationshipContentPackage,
  RelationshipContext,
  RelationshipQuestion,
} from './schema'

export const RELATIONSHIP_CONTEXTS: RelationshipContext[] = [
  'close-relationship',
  'friendship',
  'family',
]

export function getRelationshipBank(
  content: RelationshipContentPackage,
  context: RelationshipContext,
): RelationshipBank {
  return content.content.relationshipBanks[context]
}

export function getAllQuestions(content: RelationshipContentPackage): RelationshipQuestion[] {
  return RELATIONSHIP_CONTEXTS.flatMap((context) => getRelationshipBank(content, context).questions)
}

export function getAllSentences(content: RelationshipContentPackage): ManualSentence[] {
  return RELATIONSHIP_CONTEXTS.flatMap((context) => getRelationshipBank(content, context).sentenceFragments)
}
