import { useMemo, useReducer, useState } from 'react'
import rawContent from './content/content.json'
import type { ChecklistEntry, GeneratedChecklist, SavedChecklist } from './content/schema'
import { loadContent } from './content/validate'
import { generateChecklist } from './domain/checklist'
import { appReducer, createInitialState, type AppState, type ChecklistViewMode } from './app/state'
import { createChecklistStorage } from './storage/checklistStorage'
import './App.css'

const content = loadContent(rawContent)
const checklistStorage = createChecklistStorage(window.localStorage, content)
const priorityLabels = { must: '必带', should: '建议携带', optional: '视情况携带' }
const viewLabels: Record<ChecklistViewMode, string> = { priority: '重要程度', category: '物品类别', location: '空间巡视' }

const initializeApp = (): AppState => {
  const loaded = checklistStorage.load()
  if (loaded.status === 'corrupt' || loaded.status === 'unsupported-version') {
    return {
      ...createInitialState([]), page: 'error',
      errorMessage: loaded.status === 'unsupported-version'
        ? '本机数据来自更新的版本，当前版本无法安全读取。'
        : '本机清单数据已损坏。原数据尚未被覆盖，你可以清空后重新开始。',
    }
  }
  return { ...createInitialState(loaded.payload.savedChecklists), ...(loaded.status === 'recovered' ? { notice: '已忽略内容更新后失效的非关键项目。' } : {}) }
}

type EntryGroup = { id: string; label: string; entries: ChecklistEntry[] }

const groupEntries = (checklist: GeneratedChecklist, viewMode: ChecklistViewMode): EntryGroup[] => {
  if (viewMode === 'priority') {
    return [
      { id: 'must', label: priorityLabels.must, entries: checklist.sections.must },
      { id: 'should', label: priorityLabels.should, entries: checklist.sections.should },
      { id: 'optional', label: priorityLabels.optional, entries: checklist.sections.optional },
      { id: 'confirmations', label: '出门前确认', entries: checklist.sections.confirmations },
    ].filter((group) => group.entries.length > 0)
  }
  if (viewMode === 'category') {
    return content.content.categories.map((category) => ({
      id: category.categoryId,
      label: category.label,
      entries: checklist.entries.filter((entry) => entry.categoryId === category.categoryId),
    })).filter((group) => group.entries.length > 0)
  }
  return content.content.locations.map((location) => ({
    id: location.locationId,
    label: location.label,
    entries: checklist.entries.filter((entry) => entry.locationId === location.locationId),
  })).filter((group) => group.entries.length > 0)
}

function App() {
  const [state, dispatch] = useReducer(appReducer, undefined, initializeApp)
  const [customLabel, setCustomLabel] = useState('')
  const [saveName, setSaveName] = useState('')
  const scenario = content.content.scenarios.find((item) => item.scenarioId === state.selectedScenarioId)
  const groups = useMemo(() => state.checklist ? groupEntries(state.checklist, state.viewMode) : [], [state.checklist, state.viewMode])

  const generate = () => {
    if (!state.selectedScenarioId) return dispatch({ type: 'fail', message: '请先选择一个出门场景。' })
    const scenarioId = state.selectedScenarioId
    dispatch({ type: 'begin-generation' })
    window.setTimeout(() => {
      try {
        dispatch({ type: 'set-checklist', checklist: generateChecklist({ scenarioId, conditions: state.conditions }, content) })
      } catch {
        dispatch({ type: 'fail', message: '清单生成失败，请返回后重新选择。' })
      }
    }, 80)
  }

  const saveCurrent = () => {
    if (!state.checklist || !scenario) return
    const now = new Date().toISOString()
    const saved: SavedChecklist = {
      id: `save-${Date.now()}`,
      name: saveName.trim().slice(0, 40) || `${scenario.name}清单`,
      scenarioId: state.checklist.scenarioId,
      conditions: state.checklist.conditions,
      items: state.checklist.entries.map((entry) => entry.custom
        ? { checked: entry.checked, customLabel: entry.label, customPriority: entry.priority, customCategoryId: entry.categoryId, customLocationId: entry.locationId }
        : { itemId: entry.itemId, checked: entry.checked }),
      createdAt: now, updatedAt: now, contentVersion: content.contentVersion,
    }
    const result = checklistStorage.save(saved)
    if (!result.ok) return dispatch({ type: 'fail', message: result.error === 'write-failed' ? '本机存储空间不足，未能保存清单。' : '本机数据需要先恢复后才能保存。' })
    dispatch({ type: 'sync-saved', savedChecklists: checklistStorage.load().payload.savedChecklists, notice: '已保存到本机，最多保留最近 3 份。' })
    setSaveName('')
  }

  const restoreSaved = (saved: SavedChecklist) => {
    try {
      dispatch({ type: 'restore-saved', saved, checklist: generateChecklist({ scenarioId: saved.scenarioId, conditions: saved.conditions }, content) })
    } catch {
      dispatch({ type: 'fail', message: '这份清单引用的场景已经失效，请删除后重新生成。' })
    }
  }

  const deleteSaved = (checklistId: string) => {
    const result = checklistStorage.remove(checklistId)
    if (!result.ok) return dispatch({ type: 'fail', message: '未能删除这份本机清单。' })
    dispatch({ type: 'delete-saved', checklistId })
  }

  const renderEntry = (entry: ChecklistEntry) => <li className={`check-entry ${entry.checked ? 'is-checked' : ''}`} key={entry.entryId}>
    <label className="check-control"><input type="checkbox" checked={entry.checked} onChange={(event) => dispatch({ type: 'toggle-entry', entryId: entry.entryId, checked: event.target.checked })} />
      <span className="asset-placeholder" aria-hidden="true">{entry.iconAssetId}</span><span className="entry-copy"><strong>{entry.label}</strong><small>{entry.reasons[0]}</small></span></label>
    <div className="entry-actions"><button className="text-button" type="button" onClick={() => dispatch({ type: 'show-detail', entryId: entry.entryId })}>为什么</button>{entry.custom && <button className="text-button danger" type="button" onClick={() => dispatch({ type: 'remove-custom-entry', entryId: entry.entryId })}>删除</button>}</div>
  </li>

  if (state.page === 'error') return <main className="app-shell"><section className="panel error-panel" aria-labelledby="error-title"><p className="eyebrow">可恢复错误</p><h1 id="error-title">没有覆盖你的原数据</h1><p>{state.errorMessage}</p><button className="primary-button" type="button" onClick={() => { checklistStorage.clear(); dispatch({ type: 'recover' }) }}>清空本工具数据并重新开始</button></section></main>

  if (state.page === 'landing') return <main className="app-shell"><section className="hero" aria-labelledby="app-title"><p className="eyebrow">纯前端 · 本地规则 · 不读取定位</p><div className="inspector-mark" aria-hidden="true">CHECK</div><h1 id="app-title">出门检查官</h1><p className="lede">选一个场景，回答几项条件，把容易忘的事按损失和家中路线排好。</p>{state.notice && <p className="notice" role="status">{state.notice}</p>}<button className="primary-button" type="button" onClick={() => dispatch({ type: 'start' })}>开始检查</button><button className="secondary-button" type="button" onClick={() => dispatch({ type: 'show-saved' })}>最近清单（{state.savedChecklists.length}/3）</button><p className="privacy-note">天气、时长和同行情况均由你主动选择；不会调用天气、定位或在线 AI。</p></section></main>

  if (state.page === 'scenarioSelect') return <main className="app-shell"><header className="page-header"><button className="back-button" type="button" onClick={() => dispatch({ type: 'go-home' })}>返回</button><p>第 1 步 / 2</p></header><section aria-labelledby="scenario-title"><p className="eyebrow">去哪里，做什么</p><h1 id="scenario-title">选择这次出门场景</h1><div className="scenario-grid">{content.content.scenarios.map((item) => <button className="scenario-card" type="button" key={item.scenarioId} onClick={() => dispatch({ type: 'select-scenario', scenarioId: item.scenarioId })}><span className="asset-placeholder" aria-hidden="true">{item.iconAssetId}</span><strong>{item.name}</strong><small>{item.description}</small></button>)}</div></section></main>

  if (state.page === 'conditionWizard' && scenario) {
    const questions = scenario.questionIds.map((id) => content.content.scenarioQuestions.find((item) => item.questionId === id)).filter((item) => item !== undefined)
    return <main className="app-shell"><header className="page-header"><button className="back-button" type="button" onClick={() => dispatch({ type: 'start' })}>换场景</button><p>第 2 步 / 2</p></header><section aria-labelledby="condition-title"><p className="eyebrow">{scenario.name}</p><h1 id="condition-title">补充这次的条件</h1><p className="lede">不确定的项目可以跳过，基础清单仍会生成。</p><div className="question-list">{questions.map((question) => {
      const definition = content.content.conditionDefinitions.find((item) => item.key === question.conditionKey)
      if (!definition) return null
      const current = state.conditions[definition.key]
      return <label className="question-card" key={question.questionId}><span>{question.prompt}</span>{definition.inputType === 'boolean'
        ? <input type="checkbox" checked={current === true} onChange={(event) => dispatch({ type: 'set-condition', key: definition.key, value: event.target.checked })} />
        : definition.inputType === 'number'
          ? <input type="number" min={definition.min} max={definition.max} value={typeof current === 'number' ? current : ''} placeholder="输入分钟" onChange={(event) => dispatch({ type: 'set-condition', key: definition.key, value: Number(event.target.value) || 0 })} />
          : <select value={typeof current === 'string' ? current : ''} onChange={(event) => dispatch({ type: 'set-condition', key: definition.key, value: event.target.value })}><option value="">暂不选择</option>{definition.options?.map((option) => <option key={String(option.value)} value={String(option.value)}>{option.label}</option>)}</select>}</label>
    })}</div><button className="primary-button sticky-action" type="button" onClick={generate}>生成检查清单</button></section></main>
  }

  if (state.page === 'generating') return <main className="app-shell"><section className="panel generating" aria-live="polite"><div className="pulse" aria-hidden="true"/><h1>正在排好检查顺序</h1><p>先找关键项，再合并重复提醒。</p></section></main>

  if (state.page === 'itemDetail' && state.checklist) {
    const entry = state.checklist.entries.find((item) => item.entryId === state.selectedEntryId)
    return <main className="app-shell"><header className="page-header"><button className="back-button" type="button" onClick={() => dispatch({ type: 'close-detail' })}>返回清单</button></header><section className="panel" aria-labelledby="detail-title">{entry ? <><span className="asset-placeholder large" aria-hidden="true">{entry.iconAssetId}</span><p className="eyebrow">{priorityLabels[entry.priority]}</p><h1 id="detail-title">{entry.label}</h1><p>{entry.hint}</p><h2>为什么提醒</h2><ul className="reason-list">{entry.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>{entry.officialNoticeRequired && <p className="official-note">相关要求请以运营方、机构或场地方正式通知为准。</p>}</> : <p>该项目已不在当前清单中。</p>}</section></main>
  }

  if (state.page === 'savedLists') return <main className="app-shell"><header className="page-header"><button className="back-button" type="button" onClick={() => dispatch({ type: 'go-home' })}>返回首页</button></header><section aria-labelledby="saved-title"><p className="eyebrow">只保存在这台设备</p><h1 id="saved-title">最近清单</h1>{state.savedChecklists.length === 0 ? <div className="empty-state"><h2>还没有保存清单</h2><p>生成后可保存结构化条件和勾选状态。</p><button className="primary-button" type="button" onClick={() => dispatch({ type: 'start' })}>去生成第一份</button></div> : <ul className="saved-list">{state.savedChecklists.map((saved) => <li className="saved-card" key={saved.id}><div><strong>{saved.name}</strong><small>{saved.updatedAt.slice(0, 10)} · {saved.items.length} 项</small></div><div><button className="secondary-button compact" type="button" onClick={() => restoreSaved(saved)}>恢复</button><button className="text-button danger" type="button" onClick={() => deleteSaved(saved.id)}>删除</button></div></li>)}</ul>}</section></main>

  if (state.page === 'summary' && state.checklist) {
    const completed = state.checklist.entries.filter((entry) => entry.checked).length
    return <main className="app-shell"><section className="panel summary" aria-labelledby="summary-title"><div className="complete-stamp" aria-hidden="true">CHECKED</div><p className="eyebrow">最后确认</p><h1 id="summary-title">已检查 {completed} / {state.checklist.entries.length} 项</h1><p>{completed === state.checklist.entries.length ? '这份清单已经全部确认。路上顺利。' : '还有项目未勾选，可以返回继续检查。'}</p><button className="primary-button" type="button" onClick={() => dispatch({ type: 'return-to-checklist' })}>返回清单</button><button className="secondary-button" type="button" onClick={() => dispatch({ type: 'go-home' })}>回到首页</button></section></main>
  }

  if (state.page === 'checklist' && state.checklist && scenario) {
    const checkedCount = state.checklist.entries.filter((entry) => entry.checked).length
    return <main className="app-shell checklist-page"><header className="checklist-header"><div><p className="eyebrow">{scenario.name}</p><h1>检查清单</h1><p>{checkedCount} / {state.checklist.entries.length} 已确认</p></div><div className="progress-ring" aria-label={`已完成 ${checkedCount} 项`}>{checkedCount}</div></header>{state.notice && <p className="notice" role="status">{state.notice}</p>}<nav className="view-tabs" aria-label="清单查看方式">{(Object.keys(viewLabels) as ChecklistViewMode[]).map((mode) => <button type="button" className={state.viewMode === mode ? 'active' : ''} aria-pressed={state.viewMode === mode} key={mode} onClick={() => dispatch({ type: 'set-view', viewMode: mode })}>{viewLabels[mode]}</button>)}</nav><div className="checklist-tools"><button className="text-button" type="button" onClick={() => dispatch({ type: 'edit-conditions' })}>返回修改条件</button><button className="text-button" type="button" onClick={() => { if (window.confirm('确定清除全部勾选状态吗？')) dispatch({ type: 'reset-checks' }) }}>全部重置</button></div><div>{groups.map((group) => <section className="check-section" key={group.id} aria-labelledby={`group-${group.id}`}><div className="section-title"><h2 id={`group-${group.id}`}>{group.label}</h2><span>{group.entries.filter((entry) => entry.checked).length}/{group.entries.length}</span></div><ul className="entry-list">{group.entries.map(renderEntry)}</ul></section>)}</div><section className="panel custom-panel" aria-labelledby="custom-title"><h2 id="custom-title">补一项自己的提醒</h2><div className="inline-form"><input value={customLabel} maxLength={30} placeholder="最多 30 字，不支持图片" onChange={(event) => setCustomLabel(event.target.value)} /><button className="secondary-button compact" type="button" onClick={() => { dispatch({ type: 'add-custom-entry', entryId: `custom-${Date.now()}`, label: customLabel }); setCustomLabel('') }}>添加</button></div></section><section className="panel save-panel" aria-labelledby="save-title"><h2 id="save-title">保存常用清单</h2><div className="inline-form"><input value={saveName} maxLength={40} placeholder={`${scenario.name}清单`} onChange={(event) => setSaveName(event.target.value)} /><button className="secondary-button compact" type="button" onClick={saveCurrent}>保存</button></div><small>只保存稳定 ID、结构化条件和勾选状态；最多最近 3 份。</small></section><button className="primary-button sticky-action" type="button" onClick={() => dispatch({ type: 'show-summary' })}>进入最后确认</button></main>
  }

  return <main className="app-shell"><section className="empty-state"><h1>当前页面无法显示</h1><button className="primary-button" type="button" onClick={() => dispatch({ type: 'go-home' })}>返回首页</button></section></main>
}

export default App
