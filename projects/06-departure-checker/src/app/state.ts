import type {
  ChecklistEntry,
  ChecklistPriority,
  ConditionValue,
  GeneratedChecklist,
  SavedChecklist,
} from '../content/schema'
import { resetChecklist, restoreChecklist, setEntryChecked } from '../domain/checklist'
import { diffChecklists, type ChecklistDiff, type ChecklistViewMode } from '../ui/checklistView'

export type { ChecklistViewMode } from '../ui/checklistView'

export type AppPage =
  | 'landing'
  | 'scenarioSelect'
  | 'conditionWizard'
  | 'generating'
  | 'checklist'
  | 'itemDetail'
  | 'savedLists'
  | 'summary'
  | 'partialContent'
  | 'emptyMatch'
  | 'error'

export type AppOverlay = 'guide' | 'itemDetail' | 'conditionDiff' | 'customEditor' | 'help' | 'overwrite'

export type CustomItemDraft = {
  label: string
  priority: ChecklistPriority
  categoryId: string
  locationId: string
}

export type AppState = {
  page: AppPage
  selectedScenarioId?: string
  conditions: Record<string, ConditionValue | ConditionValue[]>
  checklist?: GeneratedChecklist
  selectedEntryId?: string
  editingCustomEntryId?: string
  viewMode: ChecklistViewMode
  savedChecklists: SavedChecklist[]
  errorMessage?: string
  notice?: string
  overlay?: AppOverlay
  checklistDiff?: ChecklistDiff
  questionIndex: number
  lastMinute: boolean
  guideDismissed: boolean
  overwriteCandidateId?: string
  overwriteSelectedId?: string
  activeSavedChecklistId?: string
}

export type AppAction =
  | { type: 'start' }
  | { type: 'go-home' }
  | { type: 'select-scenario'; scenarioId: string }
  | { type: 'set-condition'; key: string; value: ConditionValue | ConditionValue[] }
  | { type: 'clear-condition'; key: string }
  | { type: 'next-question'; questionCount: number }
  | { type: 'previous-question' }
  | { type: 'begin-generation' }
  | { type: 'set-checklist'; checklist: GeneratedChecklist }
  | { type: 'set-empty-match'; checklist: GeneratedChecklist }
  | { type: 'preview-regeneration'; checklist: GeneratedChecklist }
  | { type: 'confirm-regeneration' }
  | { type: 'cancel-regeneration' }
  | { type: 'edit-conditions' }
  | { type: 'toggle-entry'; entryId: string; checked: boolean }
  | { type: 'reset-checks' }
  | { type: 'show-detail'; entryId: string }
  | { type: 'close-detail' }
  | { type: 'set-view'; viewMode: ChecklistViewMode }
  | { type: 'dismiss-guide' }
  | { type: 'show-help' }
  | { type: 'close-overlay' }
  | { type: 'edit-custom-entry'; entryId?: string }
  | { type: 'save-custom-entry'; entryId: string; draft: CustomItemDraft }
  | { type: 'add-custom-entry'; entryId: string; label: string }
  | { type: 'remove-custom-entry'; entryId: string }
  | { type: 'show-saved' }
  | { type: 'sync-saved'; savedChecklists: SavedChecklist[]; notice?: string; activeSavedChecklistId?: string }
  | { type: 'notify'; notice: string }
  | { type: 'restore-saved'; saved: SavedChecklist; checklist: GeneratedChecklist }
  | { type: 'copy-saved'; saved: SavedChecklist; checklist: GeneratedChecklist }
  | { type: 'delete-saved'; checklistId: string }
  | { type: 'enter-last-minute' }
  | { type: 'exit-last-minute' }
  | { type: 'request-overwrite'; candidateId: string }
  | { type: 'select-overwrite'; checklistId: string }
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

export const createInitialState = (
  savedChecklists: SavedChecklist[],
  guideDismissed = false,
): AppState => ({
  page: 'landing',
  conditions: {},
  viewMode: 'priority',
  savedChecklists,
  questionIndex: 0,
  lastMinute: false,
  guideDismissed,
})

export const appReducer = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    case 'start': return { ...state, page: 'scenarioSelect', notice: undefined }
    case 'go-home': return {
      ...state,
      page: 'landing',
      selectedEntryId: undefined,
      overlay: undefined,
      lastMinute: false,
      notice: undefined,
      activeSavedChecklistId: undefined,
    }
    case 'select-scenario': return {
      ...state,
      page: 'conditionWizard',
      selectedScenarioId: action.scenarioId,
      conditions: {},
      checklist: undefined,
      selectedEntryId: undefined,
      questionIndex: 0,
      overlay: state.guideDismissed ? undefined : 'guide',
      activeSavedChecklistId: undefined,
    }
    case 'set-condition': return {
      ...state,
      conditions: { ...state.conditions, [action.key]: action.value },
    }
    case 'clear-condition': {
      const conditions = { ...state.conditions }
      delete conditions[action.key]
      return { ...state, conditions }
    }
    case 'next-question': return {
      ...state,
      questionIndex: Math.min(state.questionIndex + 1, Math.max(0, action.questionCount - 1)),
    }
    case 'previous-question': return { ...state, questionIndex: Math.max(0, state.questionIndex - 1) }
    case 'begin-generation': return { ...state, page: 'generating' }
    case 'set-checklist': return {
      ...state,
      page: 'checklist',
      selectedScenarioId: action.checklist.scenarioId,
      conditions: action.checklist.conditions,
      checklist: preserveChecks(state.checklist, action.checklist),
      selectedEntryId: undefined,
      questionIndex: 0,
      lastMinute: false,
    }
    case 'set-empty-match': return {
      ...state,
      page: 'emptyMatch',
      selectedScenarioId: action.checklist.scenarioId,
      conditions: action.checklist.conditions,
      checklist: preserveChecks(state.checklist, action.checklist),
      overlay: undefined,
      questionIndex: 0,
      lastMinute: false,
    }
    case 'preview-regeneration': {
      if (!state.checklist) return { ...state, checklist: action.checklist, page: 'checklist' }
      return {
        ...state,
        page: 'checklist',
        overlay: 'conditionDiff',
        checklistDiff: diffChecklists(state.checklist, action.checklist),
      }
    }
    case 'confirm-regeneration': return state.checklistDiff ? {
      ...state,
      page: 'checklist',
      checklist: state.checklistDiff.next,
      conditions: state.checklistDiff.next.conditions,
      checklistDiff: undefined,
      overlay: undefined,
      questionIndex: 0,
    } : state
    case 'cancel-regeneration': return {
      ...state,
      conditions: state.checklist?.conditions ?? state.conditions,
      checklistDiff: undefined,
      overlay: undefined,
      page: state.checklist ? 'checklist' : state.page,
    }
    case 'edit-conditions': return {
      ...state,
      page: 'conditionWizard',
      selectedEntryId: undefined,
      overlay: undefined,
      questionIndex: 0,
    }
    case 'toggle-entry': return state.checklist ? {
      ...state,
      checklist: setEntryChecked(state.checklist, action.entryId, action.checked),
    } : state
    case 'reset-checks': return state.checklist ? { ...state, checklist: resetChecklist(state.checklist) } : state
    case 'show-detail': return {
      ...state,
      page: 'itemDetail',
      selectedEntryId: action.entryId,
      overlay: 'itemDetail',
    }
    case 'close-detail': return {
      ...state,
      page: 'checklist',
      selectedEntryId: undefined,
      overlay: undefined,
    }
    case 'set-view': return { ...state, viewMode: action.viewMode }
    case 'dismiss-guide': return { ...state, guideDismissed: true, overlay: undefined }
    case 'show-help': return { ...state, overlay: 'help' }
    case 'close-overlay': return {
      ...state,
      overlay: undefined,
      checklistDiff: undefined,
      editingCustomEntryId: undefined,
      overwriteCandidateId: undefined,
      overwriteSelectedId: undefined,
    }
    case 'edit-custom-entry': return {
      ...state,
      overlay: 'customEditor',
      editingCustomEntryId: action.entryId,
    }
    case 'save-custom-entry': {
      if (!state.checklist) return state
      const label = action.draft.label.trim().slice(0, 30)
      if (!label) return state
      const existing = state.checklist.entries.find((entry) =>
        entry.entryId === action.entryId && entry.custom,
      )
      const entry: ChecklistEntry = existing ? {
        ...existing,
        label,
        priority: action.draft.priority,
        categoryId: action.draft.categoryId,
        locationId: action.draft.locationId,
      } : {
        entryId: action.entryId,
        label,
        categoryId: action.draft.categoryId,
        locationId: action.draft.locationId,
        entryType: 'carry',
        priority: action.draft.priority,
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
      const entries = existing
        ? state.checklist.entries.map((candidate) => candidate.entryId === action.entryId ? entry : candidate)
        : [...state.checklist.entries, entry]
      return {
        ...state,
        checklist: { ...state.checklist, entries, sections: sectionsFor(entries) },
        overlay: undefined,
        editingCustomEntryId: undefined,
      }
    }
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
    case 'show-saved': return { ...state, page: 'savedLists', overlay: undefined, lastMinute: false }
    case 'sync-saved': return {
      ...state,
      savedChecklists: action.savedChecklists,
      notice: action.notice,
      activeSavedChecklistId: action.activeSavedChecklistId,
    }
    case 'notify': return { ...state, notice: action.notice }
    case 'restore-saved': return {
      ...state,
      page: 'checklist',
      selectedScenarioId: action.saved.scenarioId,
      conditions: action.saved.conditions,
      checklist: restoreChecklist(action.saved, action.checklist),
      selectedEntryId: undefined,
      lastMinute: false,
      overlay: undefined,
      activeSavedChecklistId: action.saved.id,
    }
    case 'copy-saved': return {
      ...state,
      page: 'conditionWizard',
      selectedScenarioId: action.saved.scenarioId,
      conditions: action.saved.conditions,
      checklist: restoreChecklist(action.saved, action.checklist),
      selectedEntryId: undefined,
      questionIndex: 0,
      lastMinute: false,
      overlay: undefined,
      activeSavedChecklistId: undefined,
    }
    case 'delete-saved': return {
      ...state,
      savedChecklists: state.savedChecklists.filter((checklist) => checklist.id !== action.checklistId),
      activeSavedChecklistId: state.activeSavedChecklistId === action.checklistId
        ? undefined
        : state.activeSavedChecklistId,
    }
    case 'enter-last-minute': return { ...state, lastMinute: true, overlay: undefined }
    case 'exit-last-minute': return { ...state, lastMinute: false }
    case 'request-overwrite': return {
      ...state,
      overlay: 'overwrite',
      overwriteCandidateId: action.candidateId,
      overwriteSelectedId: action.candidateId,
    }
    case 'select-overwrite': return { ...state, overwriteSelectedId: action.checklistId }
    case 'show-summary': return { ...state, page: 'summary' }
    case 'return-to-checklist': return { ...state, page: state.checklist ? 'checklist' : 'landing' }
    case 'fail': return { ...state, page: 'error', errorMessage: action.message }
    case 'recover': return { ...createInitialState([], state.guideDismissed), page: 'landing' }
  }
}
