export type RelationshipCategory =
  | 'contact'
  | 'listening'
  | 'conflict'
  | 'space'
  | 'care'
  | 'boundary'
  | 'repair'

export type CardSectionId =
  | 'companion'
  | 'sadness'
  | 'disagreement'
  | 'avoid'
  | 'care'
  | 'commitment'

export type SentenceKind = 'preference' | 'boundary' | 'commitment'
export type RelationshipContext = 'close-relationship' | 'friendship'

export type PreferenceDimension = {
  dimensionId: string
  label: string
  description: string
  important: boolean
  fallbackTextKey: string
}

export type PreferenceScore = {
  dimensionId: string
  score: number
  maxPossible: number
  normalized: number
  rank: number
  tied: boolean
}

export type BoundaryPreference = {
  boundaryId: string
  label: string
  textKey: string
  severity: 1 | 2 | 3
  scenarioTags: string[]
}

export type DimensionEffect = {
  dimensionId: string
  score: number
}

export type RelationshipOption = {
  optionId: string
  text: string
  dimensionEffects: DimensionEffect[]
  intensity: 1 | 2 | 3
  tags: string[]
  scenarios: string[]
  hasConflict: boolean
  conflictsWith: string[]
  boundaryIds: string[]
  resultTextKeys: string[]
  neutral?: boolean
  exclusive?: boolean
}

export type RelationshipQuestion = {
  questionId: string
  category: RelationshipCategory
  prompt: string
  multiple: boolean
  selectionLimit: { min: number; max: number }
  options: RelationshipOption[]
  skipRule: { allowed: boolean; reason: string }
  version: number
}

export type QuestionnaireAnswer = {
  questionId: string
  optionIds: string[]
  skipped: boolean
  updatedAt: string
}

export type ManualSentence = {
  textKey: string
  sourceSectionId: string
  cardSectionId: CardSectionId
  kind: SentenceKind
  text: string
  sensitive: boolean
  compactDefault: boolean
}

export type ConflictMergeRule = {
  ruleId: string
  optionIds: [string, string]
  cardSectionId: CardSectionId
  text: string
  replacesTextKeys: string[]
}

export type RelationshipProfile = {
  answers: QuestionnaireAnswer[]
  scores: PreferenceScore[]
  priorityDimensionIds: string[]
  selectedTextKeys: string[]
  selectedFragments: Array<{
    provenanceId: string
    textKey: string
    questionId?: string
    optionId?: string
  }>
  selectedBoundaryIds: string[]
  conflictRuleIds: string[]
  generatedAt: string
}

export type CardSection = {
  sectionId: CardSectionId
  title: string
  paragraphs: string[]
  paragraphIds: string[]
  paragraphSourceTextKeys: Array<string | null>
  paragraphProvenanceIds: string[][]
  sensitive: boolean
  visible: boolean
  order: number
}

export type RelationshipCardViewModel = {
  title: string
  relationshipLabel: string
  sections: CardSection[]
  shareSummary: string
  disclaimer: string
  contentVersion: string
}

export type EditableCardItem = {
  itemId: string
  sectionId: CardSectionId
  sourceTextKey?: string
  provenanceIds: string[]
  suggestedText: string
  editedText: string
  visible: boolean
  sensitive: boolean
  order: number
  needsReview: boolean
}

export type DraftPayload = {
  schemaVersion: 1
  contentVersion: string
  updatedAt: string
  page: 'questionnaire' | 'review' | 'result' | 'editCard' | 'savedResult'
  relationshipContext: RelationshipContext
  currentQuestionIndex: number
  answers: QuestionnaireAnswer[]
  cardItems: EditableCardItem[]
  lastResult: RelationshipCardViewModel | null
  settings: {
    compactMode: boolean
    showSensitiveInCompact: boolean
  }
}

export type CardRules = {
  title: string
  disclaimer: string
  safetyFallback: string
  neutralSummary: string
  summaryPrefix: string
  maxParagraphChars: number
  maxSummaryChars: number
  requiredFields: Array<keyof RelationshipCardViewModel>
  relationshipLabels: Record<RelationshipContext, string>
  sections: Array<{
    sectionId: CardSectionId
    title: string
    maxItems: number
    fallbackText: string
  }>
  conflictMergeRules: ConflictMergeRule[]
  boundaryCommitmentRules: Array<{
    boundaryId: string
    textKeys: string[]
  }>
  defaultCommitmentTextKeys: string[]
}

export type RelationshipContent = {
  dimensions: PreferenceDimension[]
  questions: RelationshipQuestion[]
  boundaryPreferences: BoundaryPreference[]
  sentenceFragments: ManualSentence[]
  cardRules: CardRules
  safetyRules: Array<{
    ruleId: string
    label: string
    action: 'reject' | 'fallback'
  }>
  uiCopy: {
    landingEyebrow: string
    landingLead: string
    privacyTitle: string
    privacyBody: string
    introEyebrow: string
    introTitle: string
    introBody: string
    contextHint: string
    principlesTitle: string
    reviewEyebrow: string
    reviewTitle: string
    reviewBody: string
    resultReadyEyebrow: string
    resultSavedEyebrow: string
    resultTitle: string
    resultSavedTitle: string
    resultBody: string
    editorEyebrow: string
    editorTitle: string
    editorBody: string
    editorReviewNote: string
    emptyTitle: string
    emptyBody: string
  }
}

export type RelationshipContentPackage = {
  schemaVersion: 1
  contentVersion: string
  projectId: 'relationship-manual'
  meta: {
    title: string
    locale: 'zh-CN'
    updatedAt: string
  }
  sources: Array<{
    id: string
    title: string
    kind: 'frozen-document' | 'editorial-policy'
  }>
  content: RelationshipContent
}

export type ContentValidationResult = {
  valid: boolean
  errors: string[]
}
