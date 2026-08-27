import type { EventTiming, OperatingMode } from '../domain/types'

export interface UiFlowState {
  tutorialStep: number
  businessStage: number
  selectedChoiceId?: string
  isSubmitting: boolean
  ledgerExpanded: boolean
  eventStage: 'situation' | 'selection' | 'result'
  eventTiming?: EventTiming
  eventNextRoute?: 'business' | 'settlement'
}

export type UiFlowAction =
  | { type: 'tutorial-next' }
  | { type: 'tutorial-restart' }
  | { type: 'tutorial-skip' }
  | { type: 'business-next' }
  | { type: 'business-skip' }
  | { type: 'event-open'; timing: EventTiming }
  | { type: 'event-show-choices' }
  | { type: 'select-choice'; choiceId: string }
  | { type: 'submit-start' }
  | { type: 'submit-end' }
  | { type: 'crisis-submit-start' }
  | { type: 'crisis-submit-end' }
  | { type: 'event-resolved' }
  | { type: 'event-acknowledge' }
  | { type: 'toggle-ledger' }
  | { type: 'reset-day' }

export function createUiFlow(): UiFlowState {
  return {
    tutorialStep: 0,
    businessStage: 0,
    selectedChoiceId: undefined,
    isSubmitting: false,
    ledgerExpanded: false,
    eventStage: 'situation',
    eventTiming: undefined,
    eventNextRoute: undefined,
  }
}

export function nextDisplayAfterEvent(timing: EventTiming): 'business' | 'settlement' {
  return timing === 'closing' ? 'settlement' : 'business'
}

export function nextDisplayAfterOpening(operatingMode: OperatingMode, eventTiming?: EventTiming): 'event' | 'business' | 'settlement' {
  if (operatingMode === 'rest') return eventTiming ? 'event' : 'settlement'
  return eventTiming === 'opening' ? 'event' : 'business'
}

export function businessCompletionAction(
  hasResolvedResult: boolean,
  selectionKind: 'none' | 'event' | 'chain',
): 'event' | 'resolve' | 'settlement' {
  if (hasResolvedResult) return 'settlement'
  return selectionKind === 'none' ? 'resolve' : 'event'
}

export function reduceUiFlow(state: UiFlowState, action: UiFlowAction): UiFlowState {
  switch (action.type) {
    case 'tutorial-next': return { ...state, tutorialStep: Math.min(2, state.tutorialStep + 1) }
    case 'tutorial-restart': return { ...state, tutorialStep: 0 }
    case 'tutorial-skip': return { ...state, tutorialStep: 2 }
    case 'business-next': return { ...state, businessStage: Math.min(3, state.businessStage + 1) }
    case 'business-skip': return { ...state, businessStage: 3 }
    case 'event-open': return {
      ...state,
      eventStage: 'situation',
      eventTiming: action.timing,
      eventNextRoute: undefined,
      selectedChoiceId: undefined,
      isSubmitting: false,
    }
    case 'event-show-choices': return { ...state, eventStage: 'selection' }
    case 'select-choice': return state.isSubmitting ? state : { ...state, eventStage: 'selection', selectedChoiceId: action.choiceId }
    case 'submit-start': return state.isSubmitting ? state : { ...state, isSubmitting: true }
    case 'submit-end': return { ...state, isSubmitting: false }
    case 'crisis-submit-start': return state.isSubmitting ? state : { ...state, isSubmitting: true }
    case 'crisis-submit-end': return { ...state, isSubmitting: false }
    case 'event-resolved': return { ...state, eventStage: 'result', isSubmitting: false }
    case 'event-acknowledge': return {
      ...state,
      eventNextRoute: nextDisplayAfterEvent(state.eventTiming ?? 'closing'),
    }
    case 'toggle-ledger': return { ...state, ledgerExpanded: !state.ledgerExpanded }
    case 'reset-day': return {
      tutorialStep: state.tutorialStep,
      businessStage: 0,
      selectedChoiceId: undefined,
      isSubmitting: false,
      ledgerExpanded: false,
      eventStage: 'situation',
      eventTiming: undefined,
      eventNextRoute: undefined,
    }
  }
}
