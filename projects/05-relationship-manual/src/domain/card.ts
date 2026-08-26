import type {
  CardSection,
  CardSectionId,
  RelationshipCardViewModel,
  RelationshipContentPackage,
  RelationshipContext,
  RelationshipProfile,
} from '../content/schema'
import { getRelationshipBank } from '../content/bank'

export function limitText(text: string, maxCharacters: number): string {
  const normalized = text.trim().replace(/\s+/gu, ' ')
  const characters = Array.from(normalized)
  if (characters.length <= maxCharacters) return normalized
  return `${characters.slice(0, Math.max(1, maxCharacters - 1)).join('')}…`
}

export function buildShareSummary(
  content: RelationshipContentPackage,
  profile: RelationshipProfile,
  relationshipContext: RelationshipContext,
  adoptedConflictRuleIds: string[] = [],
): string {
  const rules = content.content.cardRules
  const bank = getRelationshipBank(content, relationshipContext)
  if (profile.selectedTextKeys.length === 0) return rules.neutralSummary
  const mergedConflict = bank.conflictMergeRules
    .find((rule) => profile.conflictRuleIds.includes(rule.ruleId) && adoptedConflictRuleIds.includes(rule.ruleId))
  if (mergedConflict) return limitText(mergedConflict.text, rules.maxSummaryChars)
  const sentenceByKey = new Map(bank.sentenceFragments
    .map((sentence) => [sentence.textKey, sentence]))
  const candidate = profile.selectedTextKeys
    .map((key) => sentenceByKey.get(key))
    .find((sentence) => sentence && !sentence.sensitive)
  if (!candidate) return rules.neutralSummary
  return limitText(`${rules.summaryPrefix}${candidate.text}`, rules.maxSummaryChars)
}

export function buildCardViewModel(
  content: RelationshipContentPackage,
  profile: RelationshipProfile,
  relationshipContext: RelationshipContext,
  adoptedConflictRuleIds: string[] = [],
): RelationshipCardViewModel {
  const rules = content.content.cardRules
  const bank = getRelationshipBank(content, relationshipContext)
  const sentenceByKey = new Map(bank.sentenceFragments
    .map((sentence) => [sentence.textKey, sentence]))
  const activeConflictRules = bank.conflictMergeRules
    .filter((rule) => profile.conflictRuleIds.includes(rule.ruleId) && adoptedConflictRuleIds.includes(rule.ruleId))
  const remainingFragments = profile.selectedFragments.filter((fragment) => !activeConflictRules.some((rule) => (
    fragment.optionId !== undefined
    && rule.optionIds.includes(fragment.optionId)
    && rule.replacesTextKeys.includes(fragment.textKey)
  )))
  const fragmentsByTextKey = new Map<string, typeof remainingFragments>()
  for (const fragment of remainingFragments) {
    fragmentsByTextKey.set(fragment.textKey, [...(fragmentsByTextKey.get(fragment.textKey) ?? []), fragment])
  }
  const selectedSentences = [...fragmentsByTextKey.entries()].flatMap(([textKey, fragments]) => {
    const sentence = sentenceByKey.get(textKey)
    return sentence ? [{ sentence, provenanceIds: fragments.map((fragment) => fragment.provenanceId) }] : []
  })

  const sections: CardSection[] = rules.sections.map((rule, order) => {
    const bankFallback = bank.sectionFallbacks[rule.sectionId]
    const conflictItems = activeConflictRules
      .filter((conflictRule) => conflictRule.cardSectionId === rule.sectionId)
      .map((conflictRule) => ({
        id: `conflict:${conflictRule.ruleId}`,
        text: conflictRule.text,
        sourceTextKey: null,
        provenanceIds: [...conflictRule.optionIds],
        sensitive: false,
        role: 'action' as const,
      }))
    const sentenceItems = selectedSentences
      .filter(({ sentence }) => sentence.cardSectionId === rule.sectionId)
      .map(({ sentence, provenanceIds }) => ({
        id: `text:${sentence.textKey}`,
        text: sentence.text,
        sourceTextKey: sentence.textKey,
        provenanceIds,
        sensitive: sentence.sensitive,
        role: sentence.role,
      }))
    const fallbackNeedItem = {
      id: `fallback-need:${rule.sectionId}`,
      text: bankFallback.needText,
      sourceTextKey: null,
      provenanceIds: [] as string[],
      sensitive: false,
      role: 'need' as const,
    }
    const fallbackActionItem = {
      id: `fallback-action:${rule.sectionId}`,
      text: bankFallback.actionText,
      sourceTextKey: null,
      provenanceIds: [] as string[],
      sensitive: false,
      role: 'action' as const,
    }
    const matchedItems = [...conflictItems, ...sentenceItems]
    const needItem = matchedItems.find((item) => item.role === 'need') ?? fallbackNeedItem
    const actionItem = matchedItems.find((item) => item.role === 'action') ?? fallbackActionItem
    const supportingItems = matchedItems
      .filter((item) => item.id !== needItem.id && item.id !== actionItem.id)
      .slice(0, Math.max(0, rule.maxItems - 2))
    const items = [needItem, ...supportingItems, actionItem]
    return {
      sectionId: rule.sectionId as CardSectionId,
      title: rule.title,
      paragraphs: items.map((item) => limitText(item.text, rules.maxParagraphChars)),
      paragraphRoles: items.map((item) => item.role),
      paragraphIds: items.map((item) => item.id),
      paragraphSourceTextKeys: items.map((item) => item.sourceTextKey),
      paragraphProvenanceIds: items.map((item) => item.provenanceIds),
      sensitive: items.some((item) => item.sensitive),
      visible: true,
      order,
    }
  })

  return {
    title: rules.title,
    relationshipLabel: rules.relationshipLabels[relationshipContext],
    sections,
    shareSummary: buildShareSummary(content, profile, relationshipContext, adoptedConflictRuleIds),
    disclaimer: rules.disclaimer,
    contentVersion: content.contentVersion,
  }
}
