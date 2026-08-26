import type { QuestMatch } from '../content/schema'

export type UiSheet = 'complete' | 'abandon' | 'unsuitable' | 'help' | null
export type LogFilter = 'all' | 'completed' | 'abandoned' | 'swapped'
export type OfferExplanation = Pick<QuestMatch, 'score' | 'stage' | 'reasons' | 'relaxed'>

export type UiState = {
  introStep: 0 | 1 | 2 | null
  matching: { active: boolean; revealReady: boolean }
  sheet: UiSheet
  logFilter: LogFilter
  temporaryMode: boolean
  reducedMotion: boolean
}

export type UiAction =
  | { type: 'INTRO_NEXT' }
  | { type: 'INTRO_SKIP' }
  | { type: 'START_MATCHING' }
  | { type: 'REVEAL_MATCH' }
  | { type: 'END_MATCHING' }
  | { type: 'OPEN_SHEET'; sheet: Exclude<UiSheet, null> }
  | { type: 'CLOSE_SHEET' }
  | { type: 'SET_LOG_FILTER'; filter: LogFilter }
  | { type: 'ENTER_TEMPORARY_MODE' }
  | { type: 'SET_REDUCED_MOTION'; value: boolean }

export function createInitialUiState(reducedMotion: boolean, hasSeenGuide: boolean): UiState {
  return {
    introStep: hasSeenGuide ? null : 0,
    matching: { active: false, revealReady: false },
    sheet: null,
    logFilter: 'all',
    temporaryMode: false,
    reducedMotion,
  }
}

export function uiReducer(state: UiState, action: UiAction): UiState {
  switch (action.type) {
    case 'INTRO_NEXT': {
      if (state.introStep === null || state.introStep === 2) return { ...state, introStep: null }
      return { ...state, introStep: (state.introStep + 1) as 1 | 2 }
    }
    case 'INTRO_SKIP': return { ...state, introStep: null }
    case 'START_MATCHING': return { ...state, matching: { active: true, revealReady: state.reducedMotion } }
    case 'REVEAL_MATCH': return { ...state, matching: { active: true, revealReady: true } }
    case 'END_MATCHING': return { ...state, matching: { active: false, revealReady: false } }
    case 'OPEN_SHEET': return { ...state, sheet: action.sheet }
    case 'CLOSE_SHEET': return { ...state, sheet: null }
    case 'SET_LOG_FILTER': return { ...state, logFilter: action.filter }
    case 'ENTER_TEMPORARY_MODE': return { ...state, temporaryMode: true }
    case 'SET_REDUCED_MOTION': return { ...state, reducedMotion: action.value }
  }
}
