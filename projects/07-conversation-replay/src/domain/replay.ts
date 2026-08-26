import type {
  CommunicationGoal,
  ConflictLevel,
  ConversationContentPackage,
  ConversationScenario,
  EmotionOption,
  FactOption,
  OriginalExpression,
  RelationshipType,
  RequestOption,
  SafetyRule,
  ToneVariant,
  VocabularyItem,
} from './types'

export type ReplayDraftV2 = {
  scenarioId?: string
  relationshipType?: RelationshipType
  communicationGoal?: CommunicationGoal
  conflictLevel?: ConflictLevel
  factOptionIds: string[]
  feelingIds: string[]
  feelingIntensity?: 'light' | 'clear' | 'strong'
  inferenceExpressionIds: string[]
  needIds: string[]
  requestOptionId?: string
  selectedTone?: ToneVariant
  practiceOptionId?: string
  practiceReplyId?: string
  limitedEdits: Partial<Record<ToneVariant, string>>
}

export type ReplayLayers = {
  facts: FactOption[]
  feelings: EmotionOption[]
  inferences: OriginalExpression[]
  needs: VocabularyItem[]
  request?: RequestOption
}

export type ReplayResultV2 = {
  scenarioId: string
  scenarioTitle: string
  layers: {
    facts: string[]
    feelings: string[]
    inferences: string[]
    needs: string[]
    request?: string
  }
  tones: Record<ToneVariant, string>
  selectedTone: ToneVariant
  selectedText: string
  practice?: { prompt: string; reply: string }
  summary: string
  shareSummary: string
  nextSteps: Array<{ id: string; label: string; description: string; action: string }>
  safetyNotice?: SafetyRule
}

export function filterScenarioCatalog(
  scenarios: ConversationScenario[],
  filters: { relationshipType?: RelationshipType; communicationGoal?: CommunicationGoal },
) {
  return scenarios
    .filter((scenario) => !filters.relationshipType || scenario.relationshipType === filters.relationshipType)
    .filter((scenario) => !filters.communicationGoal || scenario.communicationGoalIds.includes(filters.communicationGoal))
    .sort((left, right) => left.scenarioId.localeCompare(right.scenarioId))
}

export function resolveScenario(draft: ReplayDraftV2, content: ConversationContentPackage) {
  const scenarios = content.content.scenarios
  if (draft.conflictLevel === 'safety') {
    const safety = [...scenarios]
      .filter(({ safetyLevel }) => safetyLevel === 'safety')
      .sort((left, right) => left.scenarioId.localeCompare(right.scenarioId))[0]
    if (safety) return safety
  }
  if (draft.scenarioId) {
    const selected = scenarios.find(({ scenarioId }) => scenarioId === draft.scenarioId)
    if (selected) return selected
  }
  const filtered = filterScenarioCatalog(scenarios, draft)
  const fallback = filtered[0]
    ?? [...scenarios].filter(({ relationshipType }) => relationshipType === 'general').sort((left, right) => left.scenarioId.localeCompare(right.scenarioId))[0]
    ?? scenarios[0]
  if (!fallback) throw new Error('没有可用情境')
  return fallback
}

export function buildReplayLayers(draft: ReplayDraftV2, content: ConversationContentPackage): ReplayLayers {
  const scenario = resolveScenario(draft, content)
  const factIds = new Set(draft.factOptionIds)
  const feelingIds = new Set(draft.feelingIds)
  const inferenceIds = new Set(draft.inferenceExpressionIds)
  const needIds = new Set(draft.needIds)
  return {
    facts: scenario.replay.factOptions.filter(({ id }) => factIds.has(id)),
    feelings: content.content.feelings.filter(({ id }) => feelingIds.has(id)),
    inferences: content.content.choices.filter(
      (choice): choice is OriginalExpression => choice.kind === 'original-expression' && inferenceIds.has(choice.id),
    ),
    needs: content.content.needs.filter(({ id }) => needIds.has(id)),
    request: scenario.replay.requestOptions.find(({ id }) => id === draft.requestOptionId),
  }
}

export function buildReplayResultV2(draft: ReplayDraftV2, content: ConversationContentPackage): ReplayResultV2 {
  const scenario = resolveScenario(draft, content)
  const layers = buildReplayLayers(draft, content)
  const safetyNotice = scenario.safetyRuleId
    ? content.content.safetyRules.find(({ id }) => id === scenario.safetyRuleId)
    : draft.conflictLevel === 'safety' ? content.content.safetyRules[0] : undefined
  const rewrite = content.content.rewrites.find(({ id }) => id === scenario.rewriteId)
  if (!rewrite && !safetyNotice) throw new Error(`情境 ${scenario.scenarioId} 缺少表达方案`)
  const copy = safetyNotice?.fallback ?? rewrite!
  const selectedTone = draft.selectedTone ?? 'direct'
  const selectedText = draft.limitedEdits[selectedTone]?.trim() || copy.tones[selectedTone]
  const practiceOption = scenario.replay.practiceOptions.find(({ id }) => id === draft.practiceOptionId)
  const practiceReply = practiceOption?.replyOptions.find(({ id }) => id === draft.practiceReplyId)

  return {
    scenarioId: scenario.scenarioId,
    scenarioTitle: safetyNotice?.fallback.scenarioTitle ?? scenario.title,
    layers: {
      facts: layers.facts.map(({ label }) => label),
      feelings: layers.feelings.map(({ label }) => label),
      inferences: layers.inferences.length > 0 && rewrite?.discouragedExpressions.length
        ? [...rewrite.discouragedExpressions]
        : layers.inferences.map(({ label }) => label),
      needs: layers.needs.map(({ label }) => label),
      request: layers.request?.label,
    },
    tones: copy.tones,
    selectedTone,
    selectedText,
    practice: safetyNotice || !practiceOption || !practiceReply
      ? undefined
      : { prompt: practiceOption.label, reply: practiceReply.label },
    summary: copy.summary,
    shareSummary: copy.shareSummary,
    nextSteps: copy.nextSteps,
    safetyNotice,
  }
}
