import { describe, expect, it } from 'vitest'
import { initialShareCardState, shareCardReducer } from './shareCardState'

describe('share card interaction state', () => {
  it('keeps the generated preview available when an album save fails', () => {
    const ready = shareCardReducer(initialShareCardState, { type: 'GENERATED', dataUri: 'data:image/png;base64,card' })
    const saving = shareCardReducer(ready, { type: 'SAVE_STARTED' })
    const failed = shareCardReducer(saving, { type: 'SAVE_FAILED' })

    expect(ready).toEqual({ phase: 'ready', dataUri: 'data:image/png;base64,card' })
    expect(saving).toEqual({ phase: 'saving', dataUri: 'data:image/png;base64,card' })
    expect(failed).toEqual({ phase: 'save-error', dataUri: 'data:image/png;base64,card' })
  })

  it('clears a failed render before trying to generate again', () => {
    const failed = shareCardReducer(initialShareCardState, { type: 'GENERATION_FAILED' })
    expect(shareCardReducer(failed, { type: 'RETRY_GENERATION' })).toEqual(initialShareCardState)
  })
})
