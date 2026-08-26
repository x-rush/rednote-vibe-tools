import { useEffect, useReducer, useRef, useState, type ReactNode } from 'react'
import rawContent from './content/content.json'
import type { ConditionValue, GeneratedChecklist, SavedChecklist } from './content/schema'
import { loadContentRecoverably } from './content/validate'
import { generateChecklist } from './domain/checklist'
import { appReducer, createInitialState, type AppState, type ChecklistViewMode, type CustomItemDraft } from './app/state'
import { getOverlayEscapeAction } from './app/overlay'
import { createChecklistStorage } from './storage/checklistStorage'
import { ChecklistWorkspace } from './ui/ChecklistWorkspace'
import { CompletionScreen } from './ui/CompletionScreen'
import { ConditionDiffSheet } from './ui/ConditionDiffSheet'
import { ConditionWizard } from './ui/ConditionWizard'
import { resolveConditionAnswer } from './ui/conditionFlow'
import { CustomItemSheet } from './ui/CustomItemSheet'
import { GenerationTransition } from './ui/GenerationTransition'
import { GuideSheet } from './ui/GuideSheet'
import { HomeScreen } from './ui/HomeScreen'
import { ItemDetailSheet } from './ui/ItemDetailSheet'
import { LastMinuteMode } from './ui/LastMinuteMode'
import { OverwriteDialog } from './ui/OverwriteDialog'
import { RecoveryScreen } from './ui/RecoveryScreen'
import { SavedListsScreen } from './ui/SavedListsScreen'
import { getScenarioQuestions } from './ui/checklistView'
import './App.css'

const contentLoad = loadContentRecoverably(rawContent)
const content = contentLoad.status === 'error' ? undefined : contentLoad.content
const browserStorage = (() => {
  try {
    return window.localStorage
  } catch {
    return undefined
  }
})()
const checklistStorage = content && browserStorage ? createChecklistStorage(browserStorage, content) : undefined

const initializeApp = (): AppState => {
  if (!content) {
    return {
      ...createInitialState([], false),
      page: 'error',
      errorMessage: '内置内容无法通过安全校验，请重新载入页面。',
    }
  }
  if (!checklistStorage) {
    return {
      ...createInitialState([], false),
      notice: '当前浏览器无法访问本机存储；本次仍可使用清单，但不能保存。',
      ...(contentLoad.status === 'recovered' ? { page: 'partialContent' as const } : {}),
    }
  }
  const loaded = checklistStorage.load()
  if (loaded.status === 'corrupt' || loaded.status === 'unsupported-version') {
    return {
      ...createInitialState([], false),
      page: 'error',
      errorMessage: loaded.status === 'unsupported-version'
        ? '本机数据来自更新的版本，当前版本无法安全读取。原数据尚未覆盖。'
        : '本机清单数据已损坏。原数据尚未覆盖，你可以先返回空白首页。',
    }
  }
  if (loaded.status === 'unavailable') {
    return {
      ...createInitialState([], false),
      notice: '当前浏览器无法读取本机存储；本次仍可使用清单，但不能保存。',
      ...(contentLoad.status === 'recovered' ? { page: 'partialContent' as const } : {}),
    }
  }
  const notices = [
    loaded.status === 'recovered' ? '已忽略内容更新后失效的非关键项目。' : undefined,
    contentLoad.status === 'recovered' ? '已排除一条失效建议，基础内容仍可使用。' : undefined,
  ].filter(Boolean)
  return {
    ...createInitialState(loaded.payload.savedChecklists, loaded.payload.guideDismissed ?? false),
    ...(contentLoad.status === 'recovered' ? { page: 'partialContent' as const } : {}),
    ...(notices.length > 0 ? { notice: notices.join('') } : {}),
  }
}

const savedFromChecklist = (
  checklist: GeneratedChecklist,
  scenarioName: string,
  existing?: SavedChecklist,
): SavedChecklist => {
  const now = new Date().toISOString()
  return {
    id: existing?.id ?? `save-${Date.now()}`,
    name: existing?.name ?? `${scenarioName}清单`,
    scenarioId: checklist.scenarioId,
    conditions: checklist.conditions,
    items: checklist.entries.map((entry) => entry.custom
      ? {
        checked: entry.checked,
        customLabel: entry.label,
        customPriority: entry.priority,
        customCategoryId: entry.categoryId,
        customLocationId: entry.locationId,
      }
      : { itemId: entry.itemId, checked: entry.checked }),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    contentVersion: checklist.contentVersion,
  }
}

function App() {
  const [state, dispatch] = useReducer(appReducer, undefined, initializeApp)
  const [pendingSaved, setPendingSaved] = useState<SavedChecklist>()
  const generationTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (!state.overlay) return

    const overlay = state.overlay
    const previousBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : undefined
    const dialogSelector = '[role="dialog"], [role="alertdialog"]'
    const focusableSelector = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    const focusDialog = window.requestAnimationFrame(() => {
      const dialog = document.querySelector<HTMLElement>(dialogSelector)
      dialog?.querySelector<HTMLElement>(focusableSelector)?.focus()
    })

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        if (overlay === 'guide') checklistStorage?.setGuideDismissed(true)
        if (overlay === 'overwrite') setPendingSaved(undefined)
        dispatch(getOverlayEscapeAction(overlay))
        return
      }
      if (event.key !== 'Tab') return
      const dialog = document.querySelector<HTMLElement>(dialogSelector)
      const focusable = dialog
        ? [...dialog.querySelectorAll<HTMLElement>(focusableSelector)]
        : []
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      window.cancelAnimationFrame(focusDialog)
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousBodyOverflow
      previouslyFocused?.focus()
    }
  }, [state.overlay])

  useEffect(() => () => {
    if (generationTimer.current) window.clearTimeout(generationTimer.current)
  }, [])

  if (!content) {
    return <RecoveryScreen kind="content" message="内置清单内容没有通过完整性校验。" onPrimary={() => window.location.reload()} />
  }

  const scenario = content.content.scenarios.find((item) => item.scenarioId === state.selectedScenarioId)
  const resolvedQuestions = scenario ? getScenarioQuestions(scenario, content.content) : []

  const generate = (conditionOverride?: Record<string, ConditionValue | ConditionValue[]>) => {
    if (!scenario) return dispatch({ type: 'fail', message: '请先选择一个出门场景。' })
    const scenarioId = scenario.scenarioId
    const conditions = conditionOverride ?? state.conditions
    const regenerating = state.checklist !== undefined
    dispatch({ type: 'begin-generation' })
    if (generationTimer.current) window.clearTimeout(generationTimer.current)
    generationTimer.current = window.setTimeout(() => {
      try {
        const checklist = generateChecklist({ scenarioId, conditions }, content)
        if (!regenerating && Object.keys(conditions).length > 0 && checklist.matchedRuleIds.length === 0) {
          dispatch({ type: 'set-empty-match', checklist })
        } else {
          dispatch(regenerating
            ? { type: 'preview-regeneration', checklist }
            : { type: 'set-checklist', checklist })
        }
      } catch {
        dispatch({ type: 'fail', message: '清单生成失败，请返回后重新选择。' })
      }
    }, 420)
  }

  const restoreSaved = (saved: SavedChecklist) => {
    try {
      const checklist = generateChecklist({ scenarioId: saved.scenarioId, conditions: saved.conditions }, content)
      dispatch({ type: 'restore-saved', saved, checklist })
    } catch {
      dispatch({ type: 'fail', message: '这份清单引用的场景已经失效，请删除后重新生成。' })
    }
  }

  const copySaved = (saved: SavedChecklist) => {
    try {
      const checklist = generateChecklist({ scenarioId: saved.scenarioId, conditions: saved.conditions }, content)
      dispatch({ type: 'copy-saved', saved, checklist })
    } catch {
      dispatch({ type: 'fail', message: '这份清单无法复制，请重新选择场景。' })
    }
  }

  const syncSaved = (notice: string, activeSavedChecklistId?: string) => {
    if (!checklistStorage) return dispatch({ type: 'notify', notice })
    const loaded = checklistStorage.load()
    if (loaded.status === 'unavailable') {
      dispatch({ type: 'notify', notice: '本机存储暂时不可用，清单状态未保存。' })
      return
    }
    dispatch({ type: 'sync-saved', savedChecklists: loaded.payload.savedChecklists, notice, activeSavedChecklistId })
  }

  const saveCurrent = () => {
    if (!state.checklist || !scenario) return
    if (!checklistStorage) {
      dispatch({ type: 'notify', notice: '本机存储不可用，当前勾选仍保留在本页。' })
      return
    }
    const existing = state.savedChecklists.find((item) => item.id === state.activeSavedChecklistId)
    const saved = savedFromChecklist(state.checklist, scenario.name, existing)
    const result = checklistStorage.save(saved)
    if (result.ok) {
      setPendingSaved(undefined)
      syncSaved(existing ? '已更新这份本机清单。' : '已保存到本机。', saved.id)
      return
    }
    if (result.error === 'overwrite-required') {
      setPendingSaved(saved)
      dispatch({ type: 'request-overwrite', candidateId: result.candidateId })
      return
    }
    dispatch(result.error === 'write-failed'
      ? { type: 'notify', notice: '本机存储空间不足或暂时不可用，当前清单未保存。' }
      : { type: 'fail', message: '本机数据需要先恢复后才能保存。' })
  }

  const confirmOverwrite = () => {
    if (!pendingSaved || !state.overwriteSelectedId || !checklistStorage) return
    const result = checklistStorage.save(pendingSaved, state.overwriteSelectedId)
    if (!result.ok) {
      dispatch({ type: 'close-overlay' })
      dispatch({ type: 'notify', notice: '未能覆盖所选清单；旧记录没有变化。' })
      return
    }
    setPendingSaved(undefined)
    dispatch({ type: 'close-overlay' })
    syncSaved('已覆盖所选旧清单并保存。', pendingSaved.id)
  }

  const deleteSaved = (saved: SavedChecklist) => {
    if (!checklistStorage || !window.confirm(`确定删除“${saved.name}”吗？`)) return
    const result = checklistStorage.remove(saved.id)
    if (!result.ok) return dispatch({ type: 'notify', notice: '未能删除这份本机清单；原记录没有变化。' })
    dispatch({ type: 'delete-saved', checklistId: saved.id })
  }

  const dismissGuide = () => {
    checklistStorage?.setGuideDismissed(true)
    dispatch({ type: 'dismiss-guide' })
  }

  const conditionLabels = Object.entries(state.conditions).flatMap(([key, value]) => {
    const definition = content.content.conditionDefinitions.find((item) => item.key === key)
    if (!definition || value === false || value === '' || (Array.isArray(value) && value.length === 0)) return []
    if (value === true) return [definition.label]
    if (typeof value === 'number') return [`${value} 分钟`]
    if (Array.isArray(value)) {
      return value.map((selected) => definition.options?.find((option) => option.value === selected)?.label ?? String(selected))
    }
    return [definition.options?.find((option) => option.value === value)?.label ?? String(value)]
  })

  const renderChecklist = () => {
    if (!state.checklist || !scenario) return null
    if (state.lastMinute) {
      return <LastMinuteMode checklist={state.checklist} onChecked={(entryId, checked) => dispatch({ type: 'toggle-entry', entryId, checked })} onExit={() => dispatch({ type: 'exit-last-minute' })} onComplete={() => dispatch({ type: 'show-summary' })} />
    }
    return <ChecklistWorkspace
      scenarioName={scenario.name}
      conditionLabels={conditionLabels}
      checklist={state.checklist}
      viewMode={state.viewMode}
      categories={content.content.categories}
      locations={content.content.locations}
      notice={state.notice}
      onSetView={(viewMode: ChecklistViewMode) => dispatch({ type: 'set-view', viewMode })}
      onChecked={(entryId, checked) => dispatch({ type: 'toggle-entry', entryId, checked })}
      onDetail={(entryId) => dispatch({ type: 'show-detail', entryId })}
      onEditCustom={(entryId) => dispatch({ type: 'edit-custom-entry', entryId })}
      onEditConditions={() => dispatch({ type: 'edit-conditions' })}
      onReset={() => { if (window.confirm('确定清除全部勾选状态吗？')) dispatch({ type: 'reset-checks' }) }}
      onHelp={() => dispatch({ type: 'show-help' })}
      onLastMinute={() => dispatch({ type: 'enter-last-minute' })}
      onSave={saveCurrent}
      onShowSaved={() => dispatch({ type: 'show-saved' })}
    />
  }

  let screen: ReactNode
  if (state.page === 'error') {
    screen = <RecoveryScreen
      kind="storage"
      message={state.errorMessage}
      onPrimary={() => dispatch({ type: 'recover' })}
      onSecondary={() => {
        if (!window.confirm('确定清空出门检查官的本机数据吗？')) return
        const result = checklistStorage?.clear()
        if (result && !result.ok) {
          dispatch({ type: 'fail', message: '浏览器未允许清空本机数据，原数据仍然保留。' })
          return
        }
        dispatch({ type: 'recover' })
      }}
    />
  } else if (state.page === 'partialContent') {
    screen = <RecoveryScreen
      kind="partial"
      diagnosticCode={contentLoad.status === 'recovered' ? contentLoad.diagnosticCode : undefined}
      message={`已排除失效的非关键规则，其余 ${content.content.rules.length} 条规则和基础清单仍可使用。`}
      onPrimary={() => dispatch({ type: 'go-home' })}
    />
  } else if (state.page === 'emptyMatch' && state.checklist) {
    screen = <RecoveryScreen
      kind="empty-match"
      message={`没有找到更多条件建议，已保留 ${state.checklist.entries.length} 项场景基础内容。`}
      onPrimary={() => dispatch({ type: 'return-to-checklist' })}
      onSecondary={() => dispatch({ type: 'edit-conditions' })}
      secondaryLabel="调整条件"
    />
  } else if (state.page === 'landing' || state.page === 'scenarioSelect') {
    screen = <HomeScreen
      scenarios={content.content.scenarios}
      recent={state.savedChecklists[0]}
      notice={state.notice}
      onSelectScenario={(scenarioId) => dispatch({ type: 'select-scenario', scenarioId })}
      onContinueRecent={restoreSaved}
      onShowSaved={() => dispatch({ type: 'show-saved' })}
    />
  } else if (state.page === 'conditionWizard' && scenario) {
    screen = <ConditionWizard
      scenario={scenario}
      resolvedQuestions={resolvedQuestions}
      questionIndex={state.questionIndex}
      conditions={state.conditions}
      onBackHome={() => dispatch({ type: 'go-home' })}
      onPrevious={() => dispatch({ type: 'previous-question' })}
      onAnswer={(key, value) => {
        const resolution = resolveConditionAnswer(
          state.conditions,
          key,
          value,
          state.questionIndex === resolvedQuestions.length - 1,
        )
        dispatch({ type: 'set-condition', key, value })
        if (resolution.next === 'generate') generate(resolution.conditions)
        else dispatch({ type: 'next-question', questionCount: resolvedQuestions.length })
      }}
      onSkip={(key) => {
        const conditions = { ...state.conditions }
        delete conditions[key]
        dispatch({ type: 'clear-condition', key })
        if (state.questionIndex === resolvedQuestions.length - 1) generate(conditions)
        else dispatch({ type: 'next-question', questionCount: resolvedQuestions.length })
      }}
      onClearCondition={(key) => dispatch({ type: 'clear-condition', key })}
      onSetCondition={(key: string, value: ConditionValue | ConditionValue[]) => dispatch({ type: 'set-condition', key, value })}
    />
  } else if (state.page === 'generating') {
    screen = <GenerationTransition />
  } else if ((state.page === 'checklist' || state.page === 'itemDetail') && state.checklist) {
    screen = renderChecklist()
  } else if (state.page === 'savedLists') {
    screen = <SavedListsScreen
      savedLists={state.savedChecklists}
      scenarios={content.content.scenarios}
      onHome={() => dispatch({ type: 'go-home' })}
      onContinue={restoreSaved}
      onCopy={copySaved}
      onDelete={deleteSaved}
      onCreate={() => dispatch({ type: 'go-home' })}
    />
  } else if (state.page === 'summary' && state.checklist && scenario) {
    screen = <CompletionScreen checklist={state.checklist} scenarioName={scenario.name} onChecklist={() => dispatch({ type: 'return-to-checklist' })} onHome={() => dispatch({ type: 'go-home' })} />
  } else {
    screen = <RecoveryScreen kind="content" message="当前页面缺少必要数据。" onPrimary={() => dispatch({ type: 'go-home' })} />
  }

  const selectedEntry = state.checklist?.entries.find((entry) => entry.entryId === state.selectedEntryId)
  const editingEntry = state.checklist?.entries.find((entry) => entry.entryId === state.editingCustomEntryId)
  const category = selectedEntry && content.content.categories.find((item) => item.categoryId === selectedEntry.categoryId)
  const location = selectedEntry && content.content.locations.find((item) => item.locationId === selectedEntry.locationId)

  return <>
    <div className="screen-layer" aria-hidden={state.overlay ? true : undefined} inert={state.overlay ? true : undefined}>
      {screen}
    </div>
    {state.overlay && <div className="overlay-backdrop" aria-hidden="true" />}
    {state.overlay === 'guide' && <GuideSheet onClose={dismissGuide} onContinue={dismissGuide} />}
    {state.overlay === 'help' && <GuideSheet mode="help" onClose={() => dispatch({ type: 'close-overlay' })} />}
    {state.overlay === 'itemDetail' && <ItemDetailSheet entry={selectedEntry} categoryLabel={category?.label ?? (selectedEntry?.custom ? '未分类自定义' : '其他')} categoryAssetId={category?.iconAssetId ?? (selectedEntry?.custom ? 'icon-category-custom' : undefined)} locationLabel={location?.label ?? (selectedEntry?.custom ? '待归位' : '其他')} onClose={() => dispatch({ type: 'close-detail' })} />}
    {state.overlay === 'conditionDiff' && state.checklistDiff && <ConditionDiffSheet diff={state.checklistDiff} onCancel={() => dispatch({ type: 'cancel-regeneration' })} onConfirm={() => dispatch({ type: 'confirm-regeneration' })} />}
    {state.overlay === 'customEditor' && state.checklist && <CustomItemSheet
      entry={editingEntry}
      categories={content.content.categories}
      locations={content.content.locations}
      onCancel={() => dispatch({ type: 'close-overlay' })}
      onSave={(draft: CustomItemDraft) => dispatch({ type: 'save-custom-entry', entryId: editingEntry?.entryId ?? `custom-${Date.now()}`, draft })}
      onDelete={editingEntry ? () => {
        if (!window.confirm(`确定删除“${editingEntry.label}”吗？`)) return
        dispatch({ type: 'remove-custom-entry', entryId: editingEntry.entryId })
        dispatch({ type: 'close-overlay' })
      } : undefined}
    />}
    {state.overlay === 'overwrite' && <OverwriteDialog savedLists={state.savedChecklists} selectedId={state.overwriteSelectedId} onSelect={(checklistId) => dispatch({ type: 'select-overwrite', checklistId })} onCancel={() => { setPendingSaved(undefined); dispatch({ type: 'close-overlay' }) }} onConfirm={confirmOverwrite} />}
  </>
}

export default App
