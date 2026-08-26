import type { CommunicationGoal, RelationshipType, ToneVariant } from '../domain/types'
import type { ReplayDraftV2 } from '../domain/replay'

export type ReplayPageV2 =
  | 'landing'
  | 'privacy'
  | 'guide'
  | 'relationship'
  | 'goal'
  | 'scenario'
  | 'fact'
  | 'feeling'
  | 'inference'
  | 'need'
  | 'request'
  | 'draft'
  | 'practice'
  | 'comparison'
  | 'result'
  | 'saved'
  | 'exit'
  | 'safety'
  | 'recovery'

export type ReplayStateV2 = {
  page: ReplayPageV2
  saveMode: 'ephemeral' | 'local'
  guideStep: 0 | 1 | 2
  draft: ReplayDraftV2
  resultReady: boolean
  helpOpen: boolean
  message?: string
}

export type ReplayActionV2 =
  | { type: 'START' }
  | { type: 'CHOOSE_MODE'; mode: 'ephemeral' | 'local' }
  | { type: 'SET_SAVE_MODE'; mode: 'ephemeral' | 'local' }
  | { type: 'NEXT_GUIDE' }
  | { type: 'SKIP_GUIDE' }
  | { type: 'SET_RELATIONSHIP'; value: RelationshipType }
  | { type: 'SET_GOAL'; value: CommunicationGoal }
  | { type: 'SET_SCENARIO'; scenarioId: string; safety: boolean }
  | { type: 'SET_FACTS'; ids: string[] }
  | { type: 'SET_FEELINGS'; ids: string[]; intensity: 'light' | 'clear' | 'strong' }
  | { type: 'SET_INFERENCES'; ids: string[] }
  | { type: 'SET_NEEDS'; ids: string[] }
  | { type: 'SET_REQUEST'; id: string }
  | { type: 'SET_TONE'; tone: ToneVariant }
  | { type: 'SET_EDIT'; tone: ToneVariant; text: string }
  | { type: 'START_PRACTICE' }
  | { type: 'SET_PRACTICE'; optionId: string; replyId: string }
  | { type: 'SHOW_COMPARISON' }
  | { type: 'SHOW_RESULT' }
  | { type: 'SHOW_SAVED' }
  | { type: 'SHOW_EXIT' }
  | { type: 'SHOW_RECOVERY'; message: string }
  | { type: 'RESTORE_DRAFT'; draft: ReplayDraftV2 }
  | { type: 'OPEN_HELP' }
  | { type: 'CLOSE_HELP' }
  | { type: 'BACK' }
  | { type: 'RESTART' }

function emptyDraft(): ReplayDraftV2 {
  return {
    factOptionIds: [],
    feelingIds: [],
    inferenceExpressionIds: [],
    needIds: [],
    limitedEdits: {},
  }
}

export function createInitialReplayStateV2(): ReplayStateV2 {
  return {
    page: 'landing',
    saveMode: 'ephemeral',
    guideStep: 0,
    draft: emptyDraft(),
    resultReady: false,
    helpOpen: false,
  }
}

const previousPage: Partial<Record<ReplayPageV2, ReplayPageV2>> = {
  privacy: 'landing',
  guide: 'privacy',
  relationship: 'guide',
  goal: 'relationship',
  scenario: 'goal',
  fact: 'scenario',
  feeling: 'fact',
  inference: 'feeling',
  need: 'inference',
  request: 'need',
  draft: 'request',
  practice: 'draft',
  comparison: 'practice',
  result: 'comparison',
  saved: 'landing',
  exit: 'result',
  safety: 'scenario',
  recovery: 'result',
}

export function replayReducerV2(state: ReplayStateV2, action: ReplayActionV2): ReplayStateV2 {
  switch (action.type) {
    case 'START': return { ...state, page: 'privacy', message: undefined }
    case 'CHOOSE_MODE': return { ...state, page: 'guide', saveMode: action.mode }
    case 'SET_SAVE_MODE': return { ...state, saveMode: action.mode }
    case 'NEXT_GUIDE': return state.guideStep < 2
      ? { ...state, guideStep: (state.guideStep + 1) as 1 | 2 }
      : { ...state, page: 'relationship' }
    case 'SKIP_GUIDE': return { ...state, page: 'relationship' }
    case 'SET_RELATIONSHIP': return {
      ...state,
      page: 'goal',
      resultReady: false,
      draft: { ...emptyDraft(), relationshipType: action.value },
    }
    case 'SET_GOAL': return {
      ...state,
      page: 'scenario',
      resultReady: false,
      draft: { ...state.draft, communicationGoal: action.value, scenarioId: undefined },
    }
    case 'SET_SCENARIO': return {
      ...state,
      page: action.safety ? 'safety' : 'fact',
      resultReady: false,
      draft: {
        ...state.draft,
        scenarioId: action.scenarioId,
        conflictLevel: action.safety ? 'safety' : undefined,
        factOptionIds: [],
        feelingIds: [],
        feelingIntensity: undefined,
        inferenceExpressionIds: [],
        needIds: [],
        requestOptionId: undefined,
        selectedTone: undefined,
        practiceOptionId: undefined,
        practiceReplyId: undefined,
        limitedEdits: {},
      },
    }
    case 'SET_FACTS': return { ...state, page: 'feeling', draft: { ...state.draft, factOptionIds: action.ids } }
    case 'SET_FEELINGS': return { ...state, page: 'inference', draft: { ...state.draft, feelingIds: action.ids, feelingIntensity: action.intensity } }
    case 'SET_INFERENCES': return { ...state, page: 'need', draft: { ...state.draft, inferenceExpressionIds: action.ids } }
    case 'SET_NEEDS': return { ...state, page: 'request', draft: { ...state.draft, needIds: action.ids } }
    case 'SET_REQUEST': return {
      ...state,
      page: 'draft',
      resultReady: false,
      draft: { ...state.draft, requestOptionId: action.id, practiceOptionId: undefined, practiceReplyId: undefined },
    }
    case 'SET_TONE': return { ...state, draft: { ...state.draft, selectedTone: action.tone } }
    case 'SET_EDIT': return { ...state, draft: { ...state.draft, limitedEdits: { ...state.draft.limitedEdits, [action.tone]: action.text.slice(0, 280) } } }
    case 'START_PRACTICE': return { ...state, page: 'practice' }
    case 'SET_PRACTICE': return { ...state, page: 'comparison', draft: { ...state.draft, practiceOptionId: action.optionId, practiceReplyId: action.replyId } }
    case 'SHOW_COMPARISON': return { ...state, page: 'comparison' }
    case 'SHOW_RESULT': return { ...state, page: 'result', resultReady: true }
    case 'SHOW_SAVED': return { ...state, page: 'saved' }
    case 'SHOW_EXIT': return { ...state, page: 'exit' }
    case 'SHOW_RECOVERY': return { ...state, page: 'recovery', message: action.message }
    case 'RESTORE_DRAFT': return { ...state, page: 'result', draft: action.draft, resultReady: true, message: undefined }
    case 'OPEN_HELP': return { ...state, helpOpen: true }
    case 'CLOSE_HELP': return { ...state, helpOpen: false }
    case 'BACK': return { ...state, page: previousPage[state.page] ?? state.page, helpOpen: false }
    case 'RESTART': return { ...createInitialReplayStateV2(), saveMode: state.saveMode }
  }
}
