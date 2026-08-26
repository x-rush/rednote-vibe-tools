export type RelationshipCategory =
  | 'contact'
  | 'listening'
  | 'conflict'
  | 'space'
  | 'care'
  | 'boundary'
  | 'repair'

export type CardSectionId = RelationshipCategory

export type SentenceKind = 'preference' | 'boundary' | 'commitment'
export type RelationshipContext = 'close-relationship' | 'friendship' | 'family'
export type SentenceRole = 'need' | 'trigger' | 'action' | 'repair'
export type ResultVoice = 'request' | 'boundary' | 'self-commitment'
export type NpcPose = 'daily' | 'listening' | 'reminder'

export type RelationshipChapter = {
  chapterId: string
  category: RelationshipCategory
  title: string
  shortTitle: string
  folderLabel: string
}

export type RelationshipContextCopy = {
  label: string
  subjectLabel: string
  chapterLeads: Record<RelationshipCategory, string>
}

export type NpcCue = {
  cueId: string
  trigger: 'landing' | 'chapter-intro' | 'conflict' | 'binding' | 'storage-error'
  category?: RelationshipCategory
  relationshipContext?: RelationshipContext
  conflictRuleId?: string
  pose: NpcPose
  speaker: '小满'
  roleLabel: '关系卡片整理员'
  text: string
  primaryAction: string
  secondaryAction?: string
  skippable: boolean
}

export type PreferenceDimension = {
  dimensionId: string
  label: string
  description: string
  important: boolean
  fallbackTextKeys: Record<RelationshipContext, string>
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
  subtitle: string
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
  sceneLead: string
  prompt: string
  resultVoices: ResultVoice[]
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
  role: SentenceRole
  voice: ResultVoice
  intensity: 1 | 2 | 3
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
  relationshipContext: RelationshipContext
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
  paragraphRoles: SentenceRole[]
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
  role: SentenceRole
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
  schemaVersion: 2
  contentVersion: string
  updatedAt: string
  page: 'chapterIntro' | 'questionnaire' | 'review' | 'result' | 'editCard' | 'savedResult'
  relationshipContext: RelationshipContext
  currentQuestionIndex: number
  seenChapterIds: RelationshipCategory[]
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
  }>
}

export type RelationshipBank = {
  questions: RelationshipQuestion[]
  boundaryPreferences: BoundaryPreference[]
  sentenceFragments: ManualSentence[]
  conflictMergeRules: ConflictMergeRule[]
  boundaryCommitmentRules: Array<{
    boundaryId: string
    textKeys: string[]
  }>
  defaultCommitmentTextKeys: string[]
  sectionFallbacks: Record<CardSectionId, {
    needText: string
    actionText: string
  }>
}

export type AnswerMigration = {
  fromContentVersion: '2.0.0'
  byContext: Record<RelationshipContext, Record<string, {
    questionId: string
    optionIds: Record<string, string>
  }>>
}

export type RelationshipContent = {
  chapters: RelationshipChapter[]
  contextCopy: Record<RelationshipContext, RelationshipContextCopy>
  npcCues: NpcCue[]
  dimensions: PreferenceDimension[]
  relationshipBanks: Record<RelationshipContext, RelationshipBank>
  answerMigrations: AnswerMigration[]
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
    guideName: string
    guideRole: string
    guideMessage: string
    reviewEyebrow: string
    reviewTitle: string
    reviewBody: string
    resultReadyEyebrow: string
    resultSavedEyebrow: string
    resultTitle: string
    resultSavedTitle: string
    resultBody: string
    shareExportLabel: string
    shareExportingLabel: string
    shareExportDescription: string
    shareExportSuccess: string
    shareExportFailure: string
    editorEyebrow: string
    editorTitle: string
    editorBody: string
    editorReviewNote: string
    emptyTitle: string
    emptyBody: string
  }
}

export type RelationshipContentPackage = {
  schemaVersion: 3
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
