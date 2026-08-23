export type RelationshipType = 'friend' | 'partner' | 'family' | 'coworker' | 'general'
export type CommunicationGoal = 'clarify' | 'repair' | 'coordinate' | 'set-boundary' | 'prepare-next-time'
export type EmotionOption = {
  id: string
  label: string
  category: 'supported' | 'sad' | 'uncertain' | 'blocked'
}
export type ConflictLevel = 'low' | 'medium' | 'high' | 'safety'
export type ToneVariant = 'gentle' | 'direct' | 'firm'
export type ResponseOption =
  | 'response-explained'
  | 'response-defended'
  | 'response-apologized'
  | 'response-withdrew'
  | 'response-refused'
  | 'response-discussed'

export type ExpressionRisk = {
  id: string
  label: string
  explanation: string
}

export type OriginalExpression = {
  id: string
  kind: 'original-expression'
  label: string
  risks: ExpressionRisk[]
}

export type ChoiceDefinition = OriginalExpression | {
  id: string
  kind: 'relationship' | 'goal' | 'conflict' | 'response' | 'intention'
  label: string
  value: string
}

export type NextStep = {
  id: string
  label: string
  description: string
  action: 'clarify' | 'repair' | 'coordinate' | 'pause' | 'document' | 'seek-support'
}

export type AlternativeExpression = {
  id: string
  scenarioId: string
  structure: string[]
  misunderstanding: string
  tones: Record<ToneVariant, string>
  repairLine: string
  nextTimeLine: string
  discouragedExpressions: string[]
  nextSteps: NextStep[]
  summary: string
  shareSummary: string
}

export type SafetyRule = {
  id: string
  tags: string[]
  title: string
  message: string
  actions: string[]
  fallback: {
    scenarioTitle: string
    structure: string[]
    misunderstanding: string
    tones: Record<ToneVariant, string>
    repairLine: string
    nextTimeLine: string
    nextSteps: NextStep[]
    summary: string
    shareSummary: string
  }
}

export type ConversationScenario = {
  scenarioId: string
  title: string
  relationshipType: RelationshipType
  category: string
  conflictLevel: ConflictLevel
  description: string
  communicationGoalIds: CommunicationGoal[]
  emotionIds: string[]
  needIds: string[]
  originalExpressionIds: string[]
  responseIds: ResponseOption[]
  riskPoints: string[]
  likelyResponses: string[]
  rewriteId: string
  safetyLevel: 'standard' | 'elevated' | 'safety'
  safetyTags: string[]
  safetyRuleId?: string
  contentVersion: string
}

export type VocabularyItem = {
  id: string
  label: string
  category: string
}

export type ConversationContentPackage = {
  schemaVersion: 1
  contentVersion: string
  projectId: 'conversation-replay'
  meta: { title: string; locale: 'zh-CN'; updatedAt: string }
  sources: Array<{ id: string; title: string; license: string }>
  content: {
    feelings: EmotionOption[]
    needs: VocabularyItem[]
    scenarios: ConversationScenario[]
    choices: ChoiceDefinition[]
    rewrites: AlternativeExpression[]
    safetyRules: SafetyRule[]
  }
}

export type ReplayAnswers = {
  relationshipType: RelationshipType
  communicationGoal: CommunicationGoal
  conflictLevel: ConflictLevel
  emotionId: string
  originalExpressionId: string
  responseId: ResponseOption
  intention: 'repair-now' | 'prepare-next-time'
  scenarioId?: string
}

export type MatchLevel = 'exact' | 'response-relaxed' | 'emotion-relaxed' | 'conflict-relaxed' | 'relationship-goal' | 'goal-only' | 'general'

export type ReplayResult = {
  scenarioId: string
  scenarioTitle: string
  matchLevel: MatchLevel
  matchReason: string
  originalRisk: string[]
  expressionStructure: string[]
  alternatives: Record<ToneVariant, string>
  repairLine: string
  nextTimeLine: string
  nextSteps: NextStep[]
  summary: string
  shareSummary: string
  safetyNotice?: SafetyRule
  contentVersion: string
}

export type ReplayCardViewModel = {
  eyebrow: string
  title: string
  sections: Array<{ id: string; title: string; body: string | string[] }>
  toneCards: Array<{ tone: ToneVariant; label: string; text: string }>
  actions: NextStep[]
  safetyNotice?: { title: string; message: string; actions: string[] }
  shareSummary: string
}

export type StoredReplay = {
  id: string
  savedAt: string
  answers: ReplayAnswers
  scenarioId: string
}

export type StoragePayload = {
  schemaVersion: 1
  contentVersion: string
  updatedAt: string
  data: {
    saveMode: 'ephemeral' | 'local'
    draft?: Partial<ReplayAnswers>
    recentResult?: StoredReplay
    savedResults: StoredReplay[]
  }
}
