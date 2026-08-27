import type { PageState } from '../domain/types'

export interface MachineState { page: PageState; error?: string; lastResolutionId?: string }
export type MachineAction =
  | { type: 'navigate'; to: PageState }
  | { type: 'resolve-event'; resolutionId: string }

const allowed: Record<PageState, PageState[]> = {
  landing: ['newGame','continueGame','error'],
  newGame: ['tutorial','landing'],
  tutorial: ['morning','landing'],
  morning: ['preparation','error'],
  preparation: ['morning','opening','error'],
  opening: ['event','settlement','error'],
  event: ['settlement','error'],
  settlement: ['morning','milestone','financialCrisis','bankruptcy','finalEnding','error'],
  financialCrisis: ['morning','bankruptcy','error'],
  milestone: ['morning','error'],
  bankruptcy: ['newGame','landing'],
  finalEnding: ['newGame','landing'],
  continueGame: ['morning','preparation','event','settlement','financialCrisis','milestone','bankruptcy','finalEnding','error'],
  error: ['landing','continueGame'],
}

export function transitionGame(state: MachineState, action: MachineAction): MachineState {
  if (action.type === 'resolve-event') {
    if (state.lastResolutionId === action.resolutionId) return state
    if (state.page !== 'event') return { page: 'error', error: `不允许从 ${state.page} 结算事件` }
    return { page: 'settlement', lastResolutionId: action.resolutionId }
  }
  if (!allowed[state.page].includes(action.to)) return { page: 'error', error: `不允许从 ${state.page} 进入 ${action.to}` }
  return { ...state, page: action.to, error: undefined }
}
