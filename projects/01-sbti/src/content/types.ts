export type DimensionCode = 'RH' | 'TV' | 'LE' | 'SM'
export type PoleCode = 'R' | 'H' | 'T' | 'V' | 'L' | 'E' | 'S' | 'M'
export type ChapterCode = 'entry' | 'trace' | 'change' | 'return'

export type DimensionScore = {
  dimension: DimensionCode
  pole: PoleCode
  weight: 1 | 2
}

export type AnswerOption = {
  id: string
  text: string
  score: DimensionScore
}

export type Question = {
  id: string
  displayOrder: number
  chapterId: ChapterCode
  category: string
  primaryDimension: DimensionCode
  prompt: string
  options: [AnswerOption, AnswerOption, AnswerOption, AnswerOption]
  tags: string[]
  reverseKeyed: boolean
  contentVersion: string
}

export type DimensionDefinition = {
  code: DimensionCode
  displayName: string
  name: string
  poles: [{ code: PoleCode; name: string; definition: string; nonMeaning: string }, { code: PoleCode; name: string; definition: string; nonMeaning: string }]
}

export type ChapterDefinition = {
  id: ChapterCode
  order: number
  name: string
  description: string
}

export type BeastProfile = {
  id: string
  name: string
  classicalNote: string
  sourceIds: string[]
  contentVersion: string
}

export type RecognitionCardCopy = {
  kicker: string
  hook: string
  blessing: string
  seal: string
  alt: string
}

export type PersonalityType = {
  code: string
  chineseName: string
  creatureId: string
  recognitionCard: RecognitionCardCopy
  coreDescription: string
  longPortrait: [string, string]
  innerDrive: string
  misreadAs: string
  journeyScenes: {
    arrival: string
    disagreement: string
    change: string
  }
  relationshipNeed: string
  growthPractice: string
  wenshanNote: string
  shareQuotes: [string, string, string]
  strengths: string[]
  stressState: string
  blindSpots: string[]
  relationshipTips: string[]
  selfCareTips: string[]
  shareTitle: string
  shareLine: string
  classicalNote: string
  creativeNote: string
  disclaimer: string
  artAssetId: string
  neighborCodes: string[]
  contentVersion: string
}

export type SourceRecord = {
  id: string
  title: string
  url?: string
  license: string
}

export type BrandIdentityCopy = {
  formalName: 'SHBTI｜山海兽格测试'
  englishExpansion: 'Shan Hai Beast Temperament Indicator'
  chineseMeaning: '山海异兽性格倾向指标'
  boundary: '娱乐性自我探索工具，不是专业心理测评。'
}

export type GuideTopicCopy = {
  id: string
  label: string
  answer: string
}

export type QuizCompanionCopy = {
  title: string
  phase: Record<ChapterCode, { opening: string; middle: string; closing: string }>
  selected: string
  revisiting: string
  topics: [GuideTopicCopy, GuideTopicCopy, GuideTopicCopy]
}

export type GuideCopy = {
  name: string
  role: string
  intro: [string, string, string]
  landing: {
    fresh: string
    resume: string
    recent: string
  }
  chapterStart: Record<ChapterCode, string>
  chapterEnd: Partial<Record<ChapterCode, string>>
  reveal: {
    collecting: string
    reading: string
    complete: string
  }
  quizCompanion: QuizCompanionCopy
  resultHelp: {
    prompt: string
    title: string
    topics: [GuideTopicCopy, GuideTopicCopy, GuideTopicCopy]
  }
  recovery: {
    content: string
    storageCleared: string
    storageUnavailable: string
    storageWriteFailed: string
  }
  recoveryActions: {
    content: string
    storageCleared: string
    storageUnavailable: string
    storageWriteFailed: string
  }
}

export type ExperienceCopy = {
  title: string
  subtitle: string
  duration: string
  intro: string[]
  identity: BrandIdentityCopy
  guide: GuideCopy
  surfaces: {
    brandCode: string
    brandName: string
    brandSeal: string
    landingEyebrow: string
    landingQuestion: string
    landingFreshKicker: string
    landingContinueKicker: string
    landingMeta: string
    landingFootnote: string
    introEyebrow: string
    introTitle: string
    introLead: string
    introPrivacy: string
  }
  shareCard: {
    triggerLabel: string
    launchDescription: string
    title: string
    cardEyebrow: string
    guideLabel: string
    guideSeal: string
    generating: string
    previewAlt: string
    saveLabel: string
    savingLabel: string
    success: string
    unsupported: string
    failure: string
    retryLabel: string
    closeLabel: string
    artworkStyleLegend: string
    chibiStyleLabel: string
    chibiStyleDescription: string
    originalStyleLabel: string
    originalStyleDescription: string
  }
  disclaimer: string
  calculating: string
  emptyHistory: string
}

export type ShbtiContentPackage = {
  schemaVersion: 1
  contentVersion: string
  projectId: 'shbti'
  meta: { title: string; locale: 'zh-CN'; updatedAt: string }
  sources: SourceRecord[]
  content: {
    experience: ExperienceCopy
    dimensions: DimensionDefinition[]
    chapters: ChapterDefinition[]
    questions: Question[]
    creatures: BeastProfile[]
    resultTypes: PersonalityType[]
    tieBreakers: Array<{ dimension: DimensionCode; questionId: string }>
  }
}
