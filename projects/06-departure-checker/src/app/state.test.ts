import { describe, expect, it } from 'vitest'
import rawContent from '../content/content.json'
import type { SavedChecklist } from '../content/schema'
import { loadContent } from '../content/validate'
import { generateChecklist } from '../domain/checklist'
import { appReducer, createInitialState, type AppState } from './state'

const content = loadContent(rawContent)

describe('application reducer', () => {
  it('moves through landing, scenario selection, conditions, generating, and checklist', () => {
    let state = createInitialState([])
    state = appReducer(state, { type: 'start' })
    state = appReducer(state, { type: 'select-scenario', scenarioId: 'scenario-commute' })
    state = appReducer(state, { type: 'set-condition', key: 'rain', value: true })
    state = appReducer(state, { type: 'begin-generation' })
    const checklist = generateChecklist({ scenarioId: 'scenario-commute', conditions: state.conditions }, content)
    state = appReducer(state, { type: 'set-checklist', checklist })

    expect(state.page).toBe('checklist')
    expect(state.checklist?.entries.some((entry) => entry.itemId === 'umbrella')).toBe(true)
  })

  it('preserves checks for entries that survive condition regeneration', () => {
    const first = generateChecklist({ scenarioId: 'scenario-commute', conditions: { rain: true } }, content)
    let state: AppState = { ...createInitialState([]), page: 'checklist', checklist: first }
    state = appReducer(state, { type: 'toggle-entry', entryId: 'phone', checked: true })
    const regenerated = generateChecklist({ scenarioId: 'scenario-commute', conditions: { rain: false } }, content)
    state = appReducer(state, { type: 'set-checklist', checklist: regenerated })

    expect(state.checklist?.entries.find((entry) => entry.itemId === 'phone')?.checked).toBe(true)
    expect(state.checklist?.entries.some((entry) => entry.itemId === 'umbrella')).toBe(false)
  })

  it('resets checks and supports detail, views, summary, and condition editing', () => {
    const checklist = generateChecklist({ scenarioId: 'scenario-commute', conditions: {} }, content)
    let state: AppState = { ...createInitialState([]), page: 'checklist', checklist }
    state = appReducer(state, { type: 'toggle-entry', entryId: 'phone', checked: true })
    state = appReducer(state, { type: 'show-detail', entryId: 'phone' })
    expect(state.page).toBe('itemDetail')
    state = appReducer(state, { type: 'close-detail' })
    state = appReducer(state, { type: 'set-view', viewMode: 'location' })
    state = appReducer(state, { type: 'reset-checks' })
    expect(state.checklist?.entries.every((entry) => !entry.checked)).toBe(true)
    state = appReducer(state, { type: 'show-summary' })
    expect(state.page).toBe('summary')
    state = appReducer(state, { type: 'edit-conditions' })
    expect(state.page).toBe('conditionWizard')
  })

  it('adds and removes a bounded custom text item', () => {
    const checklist = generateChecklist({ scenarioId: 'scenario-commute', conditions: {} }, content)
    let state: AppState = { ...createInitialState([]), page: 'checklist', checklist }
    state = appReducer(state, { type: 'add-custom-entry', entryId: 'custom-1', label: `  ${'很'.repeat(35)}  ` })
    const custom = state.checklist?.entries.find((entry) => entry.entryId === 'custom-1')

    expect(custom?.label).toHaveLength(30)
    expect(custom?.custom).toBe(true)
    state = appReducer(state, { type: 'remove-custom-entry', entryId: 'custom-1' })
    expect(state.checklist?.entries.some((entry) => entry.entryId === 'custom-1')).toBe(false)
  })

  it('opens, restores, and deletes saved lists in state', () => {
    const saved: SavedChecklist = {
      id: 'save-1', name: '常用通勤', scenarioId: 'scenario-commute', conditions: {},
      items: [{ itemId: 'phone', checked: true }], createdAt: '2026-08-24T00:00:00.000Z',
      updatedAt: '2026-08-24T00:00:00.000Z', contentVersion: '1.0.0',
    }
    let state = createInitialState([saved])
    state = appReducer(state, { type: 'show-saved' })
    expect(state.page).toBe('savedLists')
    state = appReducer(state, { type: 'restore-saved', saved, checklist: generateChecklist({ scenarioId: saved.scenarioId, conditions: saved.conditions }, content) })
    expect(state.page).toBe('checklist')
    expect(state.checklist?.entries.find((entry) => entry.itemId === 'phone')?.checked).toBe(true)
    state = appReducer(state, { type: 'delete-saved', checklistId: 'save-1' })
    expect(state.savedChecklists).toEqual([])
  })

  it('enters and recovers from the error page', () => {
    let state = appReducer(createInitialState([]), { type: 'fail', message: '数据损坏' })
    expect(state).toMatchObject({ page: 'error', errorMessage: '数据损坏' })
    state = appReducer(state, { type: 'recover' })
    expect(state.page).toBe('landing')
  })
})
