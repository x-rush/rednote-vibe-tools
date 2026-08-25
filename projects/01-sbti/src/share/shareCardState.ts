export type ShareCardState =
  | { phase: 'generating' }
  | { phase: 'generation-error' }
  | { phase: 'ready' | 'saving' | 'saved' | 'save-error'; dataUri: string }

export type ShareCardAction =
  | { type: 'GENERATED'; dataUri: string }
  | { type: 'GENERATION_FAILED' }
  | { type: 'RETRY_GENERATION' }
  | { type: 'SAVE_STARTED' }
  | { type: 'SAVE_SUCCEEDED' }
  | { type: 'SAVE_FAILED' }

export const initialShareCardState: ShareCardState = { phase: 'generating' }

export function shareCardReducer(state: ShareCardState, action: ShareCardAction): ShareCardState {
  switch (action.type) {
    case 'GENERATED': return { phase: 'ready', dataUri: action.dataUri }
    case 'GENERATION_FAILED': return { phase: 'generation-error' }
    case 'RETRY_GENERATION': return initialShareCardState
    case 'SAVE_STARTED': return 'dataUri' in state ? { phase: 'saving', dataUri: state.dataUri } : state
    case 'SAVE_SUCCEEDED': return 'dataUri' in state ? { phase: 'saved', dataUri: state.dataUri } : state
    case 'SAVE_FAILED': return 'dataUri' in state ? { phase: 'save-error', dataUri: state.dataUri } : state
  }
}
