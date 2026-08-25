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
  options: [AnswerOption, AnswerOption]
  tags: string[]
  reverseKeyed: boolean
  contentVersion: string
}

export type DimensionDefinition = {
  code: DimensionCode
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

export type PersonalityType = {
  code: string
  chineseName: string
  creatureId: string
  coreDescription: string
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

export type ExperienceCopy = {
  title: string
  subtitle: string
  duration: string
  intro: string[]
  guide: {
    name: string
    role: string
    steps: string[]
  }
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
  disclaimer: string
  calculating: string
  emptyHistory: string
}

export type SbtiContentPackage = {
  schemaVersion: 1
  contentVersion: string
  projectId: 'sbti'
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
