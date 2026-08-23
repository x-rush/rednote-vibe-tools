import type {
  CardSection,
  CardSectionId,
  RelationshipCardViewModel,
  RelationshipContentPackage,
  RelationshipContext,
  RelationshipProfile,
} from '../content/schema'

export function limitText(text: string, maxCharacters: number): string {
  const normalized = text.trim().replace(/\s+/gu, ' ')
  const characters = Array.from(normalized)
  if (characters.length <= maxCharacters) return normalized
  return `${characters.slice(0, Math.max(1, maxCharacters - 1)).join('')}…`
}

export function buildShareSummary(
  content: RelationshipContentPackage,
  profile: RelationshipProfile,
): string {
  const rules = content.content.cardRules
  if (profile.selectedTextKeys.length === 0) return rules.neutralSummary
  const mergedConflict = rules.conflictMergeRules.find((rule) => profile.conflictRuleIds.includes(rule.ruleId))
  if (mergedConflict) return limitText(mergedConflict.text, rules.maxSummaryChars)
  const sentenceByKey = new Map(content.content.sentenceFragments.map((sentence) => [sentence.textKey, sentence]))
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
): RelationshipCardViewModel {
  const rules = content.content.cardRules
  const sentenceByKey = new Map(content.content.sentenceFragments.map((sentence) => [sentence.textKey, sentence]))
  const activeConflictRules = rules.conflictMergeRules.filter((rule) => profile.conflictRuleIds.includes(rule.ruleId))
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
    const conflictItems = activeConflictRules
      .filter((conflictRule) => conflictRule.cardSectionId === rule.sectionId)
      .map((conflictRule) => ({
        id: `conflict:${conflictRule.ruleId}`,
        text: conflictRule.text,
        sourceTextKey: null,
        provenanceIds: [...conflictRule.optionIds],
        sensitive: false,
      }))
    const sentenceItems = selectedSentences
      .filter(({ sentence }) => sentence.cardSectionId === rule.sectionId)
      .map(({ sentence, provenanceIds }) => ({
        id: `text:${sentence.textKey}`,
        text: sentence.text,
        sourceTextKey: sentence.textKey,
        provenanceIds,
        sensitive: sentence.sensitive,
      }))
    const fallbackItem = {
      id: `fallback:${rule.sectionId}`,
      text: rule.fallbackText,
      sourceTextKey: null,
      provenanceIds: [] as string[],
      sensitive: false,
    }
    const matchedItems = [...conflictItems, ...sentenceItems].slice(0, rule.maxItems)
    const items = matchedItems.length > 0 ? matchedItems : [fallbackItem]
    return {
      sectionId: rule.sectionId as CardSectionId,
      title: rule.title,
      paragraphs: items.map((item) => limitText(item.text, rules.maxParagraphChars)),
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
    shareSummary: buildShareSummary(content, profile),
    disclaimer: rules.disclaimer,
    contentVersion: content.contentVersion,
  }
}
