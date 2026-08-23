import type {
  DraftPayload,
  EditableCardItem,
  QuestionnaireAnswer,
  RelationshipCardViewModel,
  RelationshipContext,
} from '../content/schema'
import { limitText } from '../domain/card'

export type AppPage = 'landing' | 'intro' | 'questionnaire' | 'review' | 'result' | 'editCard' | 'savedResult' | 'error'

export type RelationshipState = {
  page: AppPage
  relationshipContext: RelationshipContext
  currentQuestionIndex: number
  answers: QuestionnaireAnswer[]
  cardItems: EditableCardItem[]
  lastResult: RelationshipCardViewModel | null
  settings: DraftPayload['settings']
  hasDraft: boolean
  error: string | null
}

export type RelationshipAction =
  | { type: 'OPEN_INTRO' }
  | { type: 'BEGIN'; relationshipContext: RelationshipContext }
  | { type: 'SET_ANSWER'; answer: QuestionnaireAnswer }
  | { type: 'SET_ANSWER_AND_NEXT'; answer: QuestionnaireAnswer; questionCount: number }
  | { type: 'PREVIOUS_QUESTION' }
  | { type: 'NEXT_QUESTION'; questionCount: number }
  | { type: 'OPEN_REVIEW'; missingRequiredQuestionIds: string[] }
  | { type: 'BACK_TO_QUESTION'; questionIndex: number }
  | { type: 'GENERATE'; card: RelationshipCardViewModel; generatedAt: string; cardItems?: EditableCardItem[] }
  | { type: 'EDIT_CARD' }
  | { type: 'EDIT_ITEM'; itemId: string; text: string }
  | { type: 'TOGGLE_ITEM'; itemId: string }
  | { type: 'MOVE_ITEM'; itemId: string; direction: -1 | 1 }
  | { type: 'SET_COMPACT'; compactMode: boolean }
  | { type: 'SET_SENSITIVE_COMPACT'; show: boolean }
  | { type: 'SAVE_RESULT' }
  | { type: 'OPEN_SAVED' }
  | { type: 'RESTORE'; draft: DraftPayload }
  | { type: 'ERROR'; message: string }
  | { type: 'CLEAR_ALL' }

export function createInitialState(hasDraft = false): RelationshipState {
  return {
    page: 'landing',
    relationshipContext: 'close-relationship',
    currentQuestionIndex: 0,
    answers: [],
    cardItems: [],
    lastResult: null,
    settings: { compactMode: false, showSensitiveInCompact: false },
    hasDraft,
    error: null,
  }
}

function setAnswer(answers: QuestionnaireAnswer[], answer: QuestionnaireAnswer): QuestionnaireAnswer[] {
  const index = answers.findIndex((item) => item.questionId === answer.questionId)
  if (index < 0) return [...answers, answer]
  return answers.map((item, itemIndex) => itemIndex === index ? answer : item)
}

export function cardToEditableItems(card: RelationshipCardViewModel): EditableCardItem[] {
  return card.sections.flatMap((section) => section.paragraphs.map((paragraph, paragraphIndex) => ({
    itemId: section.paragraphIds?.[paragraphIndex] ?? `${section.sectionId}-${paragraphIndex}`,
    sectionId: section.sectionId,
    sourceTextKey: section.paragraphSourceTextKeys?.[paragraphIndex] ?? undefined,
    provenanceIds: section.paragraphProvenanceIds?.[paragraphIndex] ?? [],
    suggestedText: paragraph,
    editedText: paragraph,
    visible: section.visible,
    sensitive: section.sensitive,
    order: section.order * 10 + paragraphIndex,
    needsReview: false,
  })))
}

function updateItem(state: RelationshipState, itemId: string, update: (item: EditableCardItem) => EditableCardItem): RelationshipState {
  return {
    ...state,
    cardItems: state.cardItems.map((item) => item.itemId === itemId ? update(item) : item),
    hasDraft: true,
  }
}

export function relationshipReducer(state: RelationshipState, action: RelationshipAction): RelationshipState {
  switch (action.type) {
    case 'OPEN_INTRO':
      return { ...state, page: 'intro', error: null }
    case 'BEGIN':
      if (state.hasDraft && state.page === 'landing') {
        return { ...state, error: '请先确认是否清除已有草稿。' }
      }
      return { ...state, page: 'questionnaire', relationshipContext: action.relationshipContext, currentQuestionIndex: 0, error: null, hasDraft: true }
    case 'SET_ANSWER':
      return {
        ...state,
        answers: setAnswer(state.answers, action.answer),
        cardItems: state.cardItems.map((item) => ({ ...item, needsReview: true })),
        error: null,
        hasDraft: true,
      }
    case 'SET_ANSWER_AND_NEXT': {
      const nextIndex = Math.min(state.currentQuestionIndex + 1, Math.max(0, action.questionCount - 1))
      return {
        ...state,
        page: state.currentQuestionIndex >= action.questionCount - 1 ? 'review' : 'questionnaire',
        currentQuestionIndex: nextIndex,
        answers: setAnswer(state.answers, action.answer),
        error: null,
        hasDraft: true,
      }
    }
    case 'PREVIOUS_QUESTION':
      return { ...state, page: 'questionnaire', currentQuestionIndex: Math.max(0, state.currentQuestionIndex - 1), error: null }
    case 'NEXT_QUESTION':
      return { ...state, currentQuestionIndex: Math.min(action.questionCount - 1, state.currentQuestionIndex + 1), error: null }
    case 'OPEN_REVIEW':
      return action.missingRequiredQuestionIds.length > 0
        ? { ...state, page: 'questionnaire', error: '还有必答题未完成。' }
        : { ...state, page: 'review', error: null }
    case 'BACK_TO_QUESTION':
      return { ...state, page: 'questionnaire', currentQuestionIndex: Math.max(0, action.questionIndex), error: null }
    case 'GENERATE':
      return { ...state, page: 'result', lastResult: action.card, cardItems: action.cardItems ?? cardToEditableItems(action.card), error: null, hasDraft: true }
    case 'EDIT_CARD':
      return { ...state, page: 'editCard', error: null }
    case 'EDIT_ITEM':
      return updateItem(state, action.itemId, (item) => ({ ...item, editedText: limitText(action.text, 120), needsReview: false }))
    case 'TOGGLE_ITEM':
      return updateItem(state, action.itemId, (item) => ({ ...item, visible: !item.visible }))
    case 'MOVE_ITEM': {
      const ordered = [...state.cardItems].sort((a, b) => a.order - b.order)
      const fromIndex = ordered.findIndex((item) => item.itemId === action.itemId)
      const toIndex = Math.max(0, Math.min(ordered.length - 1, fromIndex + action.direction))
      if (fromIndex < 0 || fromIndex === toIndex) return state
      const [moved] = ordered.splice(fromIndex, 1)
      if (!moved) return state
      ordered.splice(toIndex, 0, moved)
      return { ...state, cardItems: ordered.map((item, order) => ({ ...item, order })), hasDraft: true }
    }
    case 'SET_COMPACT':
      return { ...state, settings: { ...state.settings, compactMode: action.compactMode }, hasDraft: true }
    case 'SET_SENSITIVE_COMPACT':
      return { ...state, settings: { ...state.settings, showSensitiveInCompact: action.show }, hasDraft: true }
    case 'SAVE_RESULT':
      return { ...state, page: 'savedResult', error: null, hasDraft: true }
    case 'OPEN_SAVED':
      return state.lastResult ? { ...state, page: 'savedResult', error: null } : { ...state, page: 'error', error: '没有可查看的最近结果。' }
    case 'RESTORE':
      return {
        page: action.draft.page,
        relationshipContext: action.draft.relationshipContext,
        currentQuestionIndex: action.draft.currentQuestionIndex,
        answers: action.draft.answers,
        cardItems: action.draft.cardItems,
        lastResult: action.draft.lastResult,
        settings: action.draft.settings,
        hasDraft: true,
        error: null,
      }
    case 'ERROR':
      return { ...state, page: 'error', error: action.message }
    case 'CLEAR_ALL':
      return createInitialState()
  }
}

export function stateToDraft(state: RelationshipState, contentVersion: string, updatedAt: string): DraftPayload {
  const draftPage = state.page === 'landing' || state.page === 'intro' || state.page === 'error' ? 'questionnaire' : state.page
  return {
    schemaVersion: 1,
    contentVersion,
    updatedAt,
    page: draftPage,
    relationshipContext: state.relationshipContext,
    currentQuestionIndex: state.currentQuestionIndex,
    answers: state.answers,
    cardItems: state.cardItems,
    lastResult: state.lastResult,
    settings: state.settings,
  }
}
