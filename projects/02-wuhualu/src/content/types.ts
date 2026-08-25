export type ArtifactCategory = {
  id: string
  name: string
}

export type ArtifactClue = {
  id: string
  level: 1 | 2 | 3
  text: string
}

export type AssetReference = {
  fullAssetId: string
  detailAssetIds: string[]
  fallbackAssetId: string
  thumbnailAssetId: string
}

export type FactCheckStatus = 'verified-from-provided-source' | 'pending-review'
export type ArtifactDifficulty = 'easy' | 'normal' | 'hard'
export type PeriodGroup = 'prehistoric' | 'shang-zhou' | 'spring-autumn-warring' | 'han' | 'tang'
export type DistractorTag = 'shape' | 'use' | 'period' | 'material' | 'pattern' | 'category'
export type ArtifactSetId = 'first-fire' | 'ritual-bronze' | 'chu-sound' | 'han-light' | 'tang-world'
export type StorySectionId = 'first-look' | 'making' | 'lived-world' | 'journey' | 'why-now'

export type ArtifactSetDefinition = {
  id: ArtifactSetId
  name: string
  description: string
  sealLabel: string
  guideCompleteLines: string[]
}

export type StorySection = {
  id: StorySectionId
  title: string
  body: string
  sourceIds: string[]
  narrativeMode: 'verified-fact' | 'bounded-context' | 'open-question'
}

export type ObservationSpot = {
  id: string
  x: number
  y: number
  radius: number
  label: string
  note: string
  clueCategory: 'shape' | 'material' | 'craft' | 'trace'
  assetRole: 'observation'
}

export type ClueCard = {
  id: string
  category: 'shape' | 'material' | 'provenance'
  label: '看形' | '辨材' | '问来历'
  text: string
  npcHint: string
  starCost: 0 | 1
}

export type MemoryChallenge = {
  prompt: string
  options: { id: string; label: string }[]
  answerId: string
  explanation: string
  sourceIds: string[]
}

export type GuideLines = {
  beforeObservation: string[]
  clueOpened: string[]
  correct: string[]
  incorrect: string[]
  archived: string[]
}

export type ArtifactExperienceV2 = {
  storyHook: string
  story: StorySection[]
  observationSpots: ObservationSpot[]
  clueCards: ClueCard[]
  memoryChallenge: MemoryChallenge
  relatedArtifacts: { artifactId: string; reason: string }[]
  guideLines: GuideLines
  storyFactCheckStatus: 'verified' | 'mixed-with-bounded-context' | 'pending'
  storyContentVersion: string
}

export type Artifact = {
  id: string
  name: string
  aliases: string[]
  period: string
  periodGroup: PeriodGroup
  categoryIds: string[]
  material: string
  use: string
  dimensions: string | null
  excavation: string | null
  museum: string | null
  summary: string
  highlight: string
  culturalNote: string
  clues: ArtifactClue[]
  difficulty: ArtifactDifficulty
  distractorTags: DistractorTag[]
  unlockCopy: string
  wrongAnswerExplanation: string
  factCheckStatus: FactCheckStatus
  sourceNote: string
  sourceIds: string[]
  assetRefs: AssetReference
  contentVersion: string
  setId: ArtifactSetId
  timelineOrder: number
  experienceV2?: ArtifactExperienceV2
}

export type CompleteArtifact = Omit<Artifact, 'experienceV2'> & { experienceV2: ArtifactExperienceV2 }

export function isCompleteArtifact(artifact: Artifact): artifact is CompleteArtifact {
  return artifact.experienceV2 !== undefined
}

export type DistractorCandidate = {
  id: string
  label: string
  tags: DistractorTag[]
  forArtifactIds: string[]
  eligible?: boolean
  note?: string
}

export type SourceRecord = {
  id: string
  title: string
  url: string
  level: 'A' | 'B'
  note: string
}

export type AssetManifest = {
  idPattern: string
  pathPattern: string
  status: 'planned'
  imageNature: 'diagram-or-reviewed-reconstruction'
  global: {
    placeholderAssetId: string
    shareCoverAssetId: string
  }
}

export type ContentCopy = {
  brand: string
  subtitle: string
  landingTitle: string
  landingBody: string
  startAction: string
  continueAction: string
  introTitle: string
  introBody: string
  introAction: string
  introObserveTitle: string
  introObserveBody: string
  introClueTitle: string
  introClueBody: string
  introArchiveTitle: string
  introArchiveBody: string
  modeTitle: string
  dailyMode: string
  practiceMode: string
  clueAction: string
  submitAction: string
  nextAction: string
  collectionTitle: string
  emptyCollection: string
  summaryTitle: string
  errorTitle: string
  resetAction: string
  backAction: string
  exitAction: string
  collectionAction: string
  retryAction: string
  replayAction: string
  closeAction: string
  factsTitle: string
  cluesTitle: string
  optionsTitle: string
  placeholderText: string
  lockedText: string
  scoreLabel: string
  bestScoreLabel: string
  progressLabel: string
  sourceStatusTitle: string
  storageCorruptMessage: string
  storageVersionMessage: string
  storageInvalidMessage: string
  contentMissingMessage: string
  verifiedLabel: string
  pendingLabel: string
  collectorPerfect: string
  collectorHigh: string
  collectorMid: string
  collectorLow: string
  guideHomeLine: string
  guideLandingImageAlt: string
  guideIntroImageAlt: string
  guideTaskLine: string
  guideIntroLine: string
  guideHelpBody: string
  guideName: string
  guideRole: string
  guideAskAction: string
  guideReturnAction: string
  taskBoardLabel: string
  observationEyebrow: string
  observationTitle: string
  wrongReviewEyebrow: string
  wrongReviewTitle: string
  wrongReviewAction: string
  revealStoryAction: string
  readingGate: string
  setCompleteEyebrow: string
  setCompleteAction: string
  lockedDetailEyebrow: string
  lockedDetailBody: string
  memoryEyebrow: string
  memoryTitle: string
  memorySubmitAction: string
  memoryCorrect: string
  memoryIncorrect: string
  memoryArchiveAction: string
  archiveNextAction: string
  archiveRelatedTitle: string
  observationInstruction: string
  observationGuideLabel: string
  observationGuideFirst: string
  observationGuideContinue: string
  observationGuideComplete: string
  observationMarkerLabel: string
  observationProgressLabel: string
  clueBoxLabel: string
  clueBoxTitle: string
  clueFirstFree: string
  clueOpenPrefix: string
  clueStarBand: string
  archivePrompt: string
  guideEliminated: string
  archiveStampAction: string
  archiveSealCharacter: string
  storyEyebrow: string
  storyNavLabel: string
  storySectionPrefix: string
  storySourcesLabel: string
  storySourceLevelSuffix: string
  storyReadAction: string
  storyReadDone: string
}

export type WuhualuContentPackage = {
  schemaVersion: 1
  contentVersion: string
  projectId: 'wuhualu'
  meta: {
    title: string
    locale: 'zh-CN'
    updatedAt: string
  }
  sources: SourceRecord[]
  content: {
    artifacts: Artifact[]
    sets: ArtifactSetDefinition[]
    categories: ArtifactCategory[]
    distractorCandidates: DistractorCandidate[]
    rounds: { id: string; artifactCount: 5; optionCount: 4; maxSameMaterial: 2; maxSamePeriodGroup: 2 }[]
    collectionRules: { unlockOnReveal: true; keepBestStars: true }
    assetManifest: AssetManifest
    copy: ContentCopy
  }
}

export type QuizOption = {
  id: string
  label: string
  isCorrect: boolean
  artifactId?: string
}

export type QuizQuestion = {
  id: string
  artifactId: string
  correctOptionId: string
  options: QuizOption[]
  clues: ArtifactClue[]
  successFeedback: string
  wrongFeedback: string
}

export type QuizSessionAnswer = {
  artifactId: string
  optionId: string
  correct: boolean
  additionalCluesUsed: number
  stars: 1 | 2 | 3
  points: number
}

export type CasePhase =
  | 'observation'
  | 'clueSelect'
  | 'answering'
  | 'wrongReview'
  | 'reveal'
  | 'story'
  | 'memory'
  | 'archive'
  | 'setComplete'

export type CaseProgress = {
  phase: CasePhase
  openedClueIds: string[]
  observedSpotIds: string[]
  storyReadSections: StorySectionId[]
  selectedOptionId: string | null
  eliminatedOptionId: string | null
  memoryAnswerId: string | null
  completedSetId: ArtifactSetId | null
}

export type QuizSession = {
  seed: string
  artifactIds: string[]
  index: number
  answers: QuizSessionAnswer[]
  revealedClueIds: string[]
  score: number
  streak: number
  caseProgress?: CaseProgress
}

export type GuessResult = {
  artifactId: string
  selectedOptionId: string
  correct: boolean
  stars: 1 | 2 | 3
  points: number
  nextStreak: number
  feedback: string
}

export type CollectionEntry = {
  artifactId: string
  unlockedAt: string
  bestStars: 1 | 2 | 3
}

export type ArtifactDetailViewModel = {
  id: string
  title: string
  aliases: string[]
  subtitle: string
  categoryNames: string[]
  facts: string[]
  dimensions: string | null
  excavation: string | null
  museum: string | null
  asset: AssetReference
  unlocked: boolean
  bestStars: 0 | 1 | 2 | 3
  verificationLabel: string
  sourceNote: string
}

export type RoundSummaryViewModel = {
  title: string
  score: number
  correctCount: number
  totalCount: number
  bestStreak: number
  earnedStars: number
  unlockedArtifactIds: string[]
  collectorTitle: string
}

export type RecentAttempt = {
  artifactId: string
  correct: boolean
  stars: 1 | 2 | 3
  answeredAt: string
}

export type ArtifactLearningProgress = {
  artifactId: string
  observedSpotIds: string[]
  storyReadSections: StorySectionId[]
  memoryCompleted: boolean
}

export type StoragePayload = {
  schemaVersion: 1
  contentVersion: string
  updatedAt: string
  collection: CollectionEntry[]
  bestScore: number
  recentAttempts: RecentAttempt[]
  currentSession: QuizSession | null
  recentArtifactIds: string[]
  artifactProgress: ArtifactLearningProgress[]
  setSealIds: ArtifactSetId[]
  settings: { muted: boolean; reducedMotion: boolean }
}
