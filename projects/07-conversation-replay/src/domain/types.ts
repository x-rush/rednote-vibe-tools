export type RelationshipType = 'friend' | 'partner' | 'family' | 'coworker' | 'general'
export type CommunicationGoal = 'clarify' | 'repair' | 'coordinate' | 'set-boundary' | 'prepare-next-time'
export type EmotionOption = {
  id: string
  label: string
  category: 'supported' | 'sad' | 'uncertain' | 'blocked'
}
export type ConflictLevel = 'low' | 'medium' | 'high' | 'safety'
export type ToneVariant = 'gentle' | 'direct' | 'firm'
export type NpcPose = 'welcome' | 'attend' | 'observe' | 'sort' | 'pause' | 'compose' | 'complete' | 'safety'
export type NpcMomentKey =
  | 'landing' | 'privacy' | 'guide' | 'relationship' | 'goal' | 'scenario'
  | 'fact' | 'feeling' | 'inference' | 'need' | 'request' | 'draft'
  | 'practice' | 'comparison' | 'result' | 'saved' | 'exit' | 'safety' | 'recovery'
export type NpcMoment = {
  pose: NpcPose
  invitation: string
  reassurance?: string
  autonomy: string
}
export type NpcContent = {
  id: 'chiyan'
  name: string
  role: string
  boundaries: string[]
  moments: Record<NpcMomentKey, NpcMoment>
}
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

export type FactOption = {
  id: string
  label: string
  explanation: string
}

export type RequestOption = {
  id: string
  label: string
  structure: {
    when: string
    behavior: string
    boundary: string
  }
}

export type PracticeReply = {
  id: string
  label: string
  action: NextStep['action']
}

export type PracticeOption = {
  id: string
  responseId: ResponseOption
  label: string
  replyOptions: PracticeReply[]
}

export type ScenarioReplayContent = {
  factOptions: FactOption[]
  inferenceExpressionIds: string[]
  requestOptions: RequestOption[]
  practiceOptions: PracticeOption[]
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
  replay: ScenarioReplayContent
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

export type IntroContent = {
  landing: {
    eyebrow: string
    lead: string
    primaryLabel: string
    secondaryLabel: string
    beforeText: string
    afterText: string
    privacyNoteTitle: string
    privacyNoteBody: string
  }
  privacy: {
    eyebrow: string
    title: string
    lead: string
    primaryLabel: string
    secondaryLabel: string
    ephemeralDescription: string
    localDescription: string
    sections: Array<{
      id: 'no-upload' | 'no-judgment' | 'local-only'
      title: string
      body: string
    }>
  }
  replayCard: {
    saveLabel: string
    savingLabel: string
    savedMessage: string
    unavailableMessage: string
    generationFailedMessage: string
    writeFailedMessage: string
    permissionFailedMessage: string
    brandLabel: string
    attributionLabel: string
    factLabel: string
    feelingLabel: string
    inferenceLabel: string
    inferenceHint: string
    needLabel: string
    requestLabel: string
    statementLabel: string
    responsibilityNotice: string
    footerNote: string
    emptyFact: string
    emptyFeeling: string
    emptyInference: string
    emptyNeed: string
    emptyRequest: string
  }
  result: {
    gentleLabel: string
    directLabel: string
    firmLabel: string
    incompleteMessage: string
    cardIncompleteMessage: string
    editorLabel: string
    toneNoteTitle: string
    toneNoteBody: string
    practiceActionLabel: string
    compareActionLabel: string
    practicePromptLabel: string
    practiceReplyLabel: string
    practiceNote: string
    beforeLabel: string
    beforeFallback: string
    beforeExplanation: string
    afterLabel: string
    viewCardLabel: string
    cardEyebrow: string
  }
  system: {
    localSaveSuccess: string
    localSaveFailure: string
    unnamedScenario: string
    requestNoteTitle: string
    requestNoteBody: string
    exitItems: string[]
    recoveryMemoryTitle: string
    recoveryMemoryBody: string
  }
}

export type ConversationContentPackage = {
  schemaVersion: 1
  contentVersion: string
  projectId: 'conversation-replay'
  meta: { title: string; locale: 'zh-CN'; updatedAt: string }
  sources: Array<{ id: string; title: string; license: string }>
  content: {
    intro: IntroContent
    npc: NpcContent
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
