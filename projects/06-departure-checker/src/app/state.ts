import type {
  ChecklistEntry,
  ConditionValue,
  GeneratedChecklist,
  SavedChecklist,
} from '../content/schema'
import { resetChecklist, restoreChecklist, setEntryChecked } from '../domain/checklist'

export type AppPage =
  | 'landing'
  | 'scenarioSelect'
  | 'conditionWizard'
  | 'generating'
  | 'checklist'
  | 'itemDetail'
  | 'savedLists'
  | 'summary'
  | 'error'

export type ChecklistViewMode = 'priority' | 'category' | 'location'

export type AppState = {
  page: AppPage
  selectedScenarioId?: string
  conditions: Record<string, ConditionValue | ConditionValue[]>
  checklist?: GeneratedChecklist
  selectedEntryId?: string
  viewMode: ChecklistViewMode
  savedChecklists: SavedChecklist[]
  errorMessage?: string
  notice?: string
}

export type AppAction =
  | { type: 'start' }
  | { type: 'go-home' }
  | { type: 'select-scenario'; scenarioId: string }
  | { type: 'set-condition'; key: string; value: ConditionValue | ConditionValue[] }
  | { type: 'begin-generation' }
  | { type: 'set-checklist'; checklist: GeneratedChecklist }
  | { type: 'edit-conditions' }
  | { type: 'toggle-entry'; entryId: string; checked: boolean }
  | { type: 'reset-checks' }
  | { type: 'show-detail'; entryId: string }
  | { type: 'close-detail' }
  | { type: 'set-view'; viewMode: ChecklistViewMode }
  | { type: 'add-custom-entry'; entryId: string; label: string }
  | { type: 'remove-custom-entry'; entryId: string }
  | { type: 'show-saved' }
  | { type: 'sync-saved'; savedChecklists: SavedChecklist[]; notice?: string }
  | { type: 'restore-saved'; saved: SavedChecklist; checklist: GeneratedChecklist }
  | { type: 'delete-saved'; checklistId: string }
  | { type: 'show-summary' }
  | { type: 'return-to-checklist' }
  | { type: 'fail'; message: string }
  | { type: 'recover' }

const sectionsFor = (entries: ChecklistEntry[]): GeneratedChecklist['sections'] => ({
  must: entries.filter((entry) => entry.entryType === 'carry' && entry.priority === 'must'),
  should: entries.filter((entry) => entry.entryType === 'carry' && entry.priority === 'should'),
  optional: entries.filter((entry) => entry.entryType === 'carry' && entry.priority === 'optional'),
  confirmations: entries.filter((entry) => entry.entryType === 'confirmation'),
})

const preserveChecks = (previous: GeneratedChecklist | undefined, next: GeneratedChecklist): GeneratedChecklist => {
  if (!previous) return next
  const checked = new Map(previous.entries.map((entry) => [entry.itemId ?? entry.entryId, entry.checked]))
  const entries = next.entries.map((entry) => ({
    ...entry,
    checked: checked.get(entry.itemId ?? entry.entryId) ?? false,
  }))
  return { ...next, entries, sections: sectionsFor(entries) }
}

export const createInitialState = (savedChecklists: SavedChecklist[]): AppState => ({
  page: 'landing',
  conditions: {},
  viewMode: 'priority',
  savedChecklists,
})

export const appReducer = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    case 'start': return { ...state, page: 'scenarioSelect', notice: undefined }
    case 'go-home': return { ...state, page: 'landing', selectedEntryId: undefined, notice: undefined }
    case 'select-scenario': return {
      ...state,
      page: 'conditionWizard',
      selectedScenarioId: action.scenarioId,
      conditions: {},
      checklist: undefined,
      selectedEntryId: undefined,
    }
    case 'set-condition': return {
      ...state,
      conditions: { ...state.conditions, [action.key]: action.value },
    }
    case 'begin-generation': return { ...state, page: 'generating' }
    case 'set-checklist': return {
      ...state,
      page: 'checklist',
      selectedScenarioId: action.checklist.scenarioId,
      conditions: action.checklist.conditions,
      checklist: preserveChecks(state.checklist, action.checklist),
      selectedEntryId: undefined,
    }
    case 'edit-conditions': return { ...state, page: 'conditionWizard', selectedEntryId: undefined }
    case 'toggle-entry': return state.checklist ? {
      ...state,
      checklist: setEntryChecked(state.checklist, action.entryId, action.checked),
    } : state
    case 'reset-checks': return state.checklist ? { ...state, checklist: resetChecklist(state.checklist) } : state
    case 'show-detail': return { ...state, page: 'itemDetail', selectedEntryId: action.entryId }
    case 'close-detail': return { ...state, page: 'checklist', selectedEntryId: undefined }
    case 'set-view': return { ...state, viewMode: action.viewMode }
    case 'add-custom-entry': {
      if (!state.checklist) return state
      const label = action.label.trim().slice(0, 30)
      if (!label) return state
      const entry: ChecklistEntry = {
        entryId: action.entryId,
        label,
        categoryId: 'category-custom',
        locationId: 'location-entryway',
        entryType: 'carry',
        priority: 'optional',
        reasons: ['你添加的自定义项目'],
        hint: '只在本机保存不超过 30 字的文本',
        safetyTags: [],
        iconAssetId: 'icon-item-custom',
        officialNoticeRequired: false,
        checked: false,
        sourceRuleIds: [],
        sortOrder: 10000 + state.checklist.entries.length,
        custom: true,
      }
      const entries = [...state.checklist.entries, entry]
      return { ...state, checklist: { ...state.checklist, entries, sections: sectionsFor(entries) } }
    }
    case 'remove-custom-entry': {
      if (!state.checklist) return state
      const entries = state.checklist.entries.filter((entry) => entry.entryId !== action.entryId || !entry.custom)
      return { ...state, checklist: { ...state.checklist, entries, sections: sectionsFor(entries) } }
    }
    case 'show-saved': return { ...state, page: 'savedLists' }
    case 'sync-saved': return { ...state, savedChecklists: action.savedChecklists, notice: action.notice }
    case 'restore-saved': return {
      ...state,
      page: 'checklist',
      selectedScenarioId: action.saved.scenarioId,
      conditions: action.saved.conditions,
      checklist: restoreChecklist(action.saved, action.checklist),
      selectedEntryId: undefined,
    }
    case 'delete-saved': return {
      ...state,
      savedChecklists: state.savedChecklists.filter((checklist) => checklist.id !== action.checklistId),
    }
    case 'show-summary': return { ...state, page: 'summary' }
    case 'return-to-checklist': return { ...state, page: state.checklist ? 'checklist' : 'landing' }
    case 'fail': return { ...state, page: 'error', errorMessage: action.message }
    case 'recover': return { ...createInitialState([]), page: 'landing' }
  }
}
