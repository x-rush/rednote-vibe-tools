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

export type QuizSession = {
  seed: string
  artifactIds: string[]
  index: number
  answers: QuizSessionAnswer[]
  revealedClueIds: string[]
  score: number
  streak: number
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

export type StoragePayload = {
  schemaVersion: 1
  contentVersion: string
  updatedAt: string
  collection: CollectionEntry[]
  bestScore: number
  recentAttempts: RecentAttempt[]
  currentSession: QuizSession | null
  recentArtifactIds: string[]
  settings: { muted: boolean; reducedMotion: boolean }
}
