import type { DimensionCode, PoleCode } from '../content/types'

export type QuizAnswer = { questionId: string; optionId: string }

export type QuizProgress = {
  seed: string
  questionIds: string[]
  currentIndex: number
  answers: QuizAnswer[]
}

export type ProgressSummary = { answered: number; total: number; percent: number }

export type DimensionResult = {
  dimension: DimensionCode
  leftPole: PoleCode
  rightPole: PoleCode
  leftScore: number
  rightScore: number
  preferredPole: PoleCode
  strength: number
  label: '游移' | '轻偏' | '明显偏好'
  isBalanced: boolean
}

export type ResultSummary = {
  code: string
  typeName: string
  creatureId: string
  creatureName: string
  coreDescription: string
  neighborCode: string
  dimensions: DimensionResult[]
}

export type QuizResult = {
  code: string
  completedAt: string
  contentVersion: string
  summary: ResultSummary
}

export type ShareCardViewModel = {
  code: string
  typeName: string
  creatureName: string
  title: string
  line: string
  disclaimer: string
  artAssetId: string
}

