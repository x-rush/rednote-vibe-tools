import { describe, expect, it } from 'vitest'
import { createInitialUiState, uiReducer } from './state'

describe('transient UI state', () => {
  it('advances and skips the first-run guide without changing durable state', () => {
    const initial = createInitialUiState(false, false)
    expect(initial.introStep).toBe(0)
    expect(uiReducer(initial, { type: 'INTRO_NEXT' }).introStep).toBe(1)
    expect(uiReducer(initial, { type: 'INTRO_SKIP' }).introStep).toBeNull()
    expect(createInitialUiState(false, true).introStep).toBeNull()
  })

  it('opens and closes sheets while preserving the matching state', () => {
    const matching = uiReducer(createInitialUiState(false, true), { type: 'START_MATCHING' })
    const help = uiReducer(matching, { type: 'OPEN_SHEET', sheet: 'help' })
    expect(help.sheet).toBe('help')
    expect(help.matching.active).toBe(true)
    expect(uiReducer(help, { type: 'CLOSE_SHEET' }).sheet).toBeNull()
  })

  it('makes matching immediately revealable when reduced motion is active', () => {
    const state = uiReducer(createInitialUiState(true, true), { type: 'START_MATCHING' })
    expect(state.matching).toEqual({ active: true, revealReady: true })
  })
})
