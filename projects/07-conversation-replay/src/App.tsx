import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { buildSavedReplayViewModels, buildScreenViewModel, type ScreenOption } from './app/view'
import rawContent from './content/content.json'
import { parseContent } from './content/validate'
import { buildReplayResult } from './domain/result'
import type { ReplayAnswers, StoredReplay } from './domain/types'
import { initialReplayState, replayReducer, type ReplayState, type WizardStep } from './state/replayState'
import {
  clearLocalState,
  createIndexedDbSavedReplayRepository,
  createStoragePayload,
  loadLocalState,
  saveLocalState,
  type SavedReplayRepository,
  type StorageReferenceIndex,
} from './storage/storage'
import './App.css'

const contentLoad = (() => {
  try {
    return { content: parseContent(rawContent), error: undefined }
  } catch (error) {
    return { content: undefined, error: error instanceof Error ? error.message : '内容包未能读取' }
  }
})()

function contentReferences(): StorageReferenceIndex {
  const content = contentLoad.content
  if (!content) return { scenarioIds: new Set(), emotionIds: new Set(), originalExpressionIds: new Set(), responseIds: new Set() }
  return {
    scenarioIds: new Set(content.content.scenarios.map(({ scenarioId }) => scenarioId)),
    emotionIds: new Set(content.content.feelings.map(({ id }) => id)),
    originalExpressionIds: new Set(content.content.choices.filter(({ kind }) => kind === 'original-expression').map(({ id }) => id)),
    responseIds: new Set(content.content.choices.flatMap((choice) => choice.kind === 'response' ? [choice.value] : [])),
  }
}

function initialBootstrap(): { state: ReplayState; saveMode: 'ephemeral' | 'local' } {
  if (!contentLoad.content || typeof window === 'undefined') return { state: initialReplayState, saveMode: 'ephemeral' }
  try {
    const restored = loadLocalState(window.localStorage, contentReferences(), contentLoad.content.contentVersion)
    if (restored.status === 'corrupt' || restored.status === 'future-version') {
      return { state: { ...initialReplayState, page: 'error', error: restored.message }, saveMode: 'ephemeral' }
    }
    const draft = restored.payload.data.draft
    const stepByAnswer: Array<[keyof ReplayAnswers, WizardStep]> = [
      ['relationshipType', 'relationship'], ['communicationGoal', 'goal'], ['conflictLevel', 'conflict'],
      ['emotionId', 'emotion'], ['originalExpressionId', 'expression'], ['responseId', 'response'], ['intention', 'intention'],
    ]
    const wizardStep = stepByAnswer.find(([key]) => !draft?.[key])?.[1] ?? 'intention'
    const state: ReplayState = draft
      ? { ...initialReplayState, page: 'replayWizard', wizardStep, answers: draft }
      : initialReplayState
    return { state, saveMode: restored.payload.data.saveMode }
  } catch {
    return { state: { ...initialReplayState, page: 'error', error: '本地存储暂时不可读取，可以清空后重新开始。' }, saveMode: 'ephemeral' }
  }
}

function completeAnswers(answers: Partial<ReplayAnswers>): answers is ReplayAnswers {
  return Boolean(
    answers.relationshipType
    && answers.communicationGoal
    && answers.conflictLevel
    && answers.emotionId
    && answers.originalExpressionId
    && answers.responseId
    && answers.intention,
  )
}

function BodyList({ body }: { body: string | string[] }) {
  return Array.isArray(body)
    ? <ul>{body.map((item) => <li key={item}>{item}</li>)}</ul>
    : <p>{body}</p>
}

function App() {
  const [bootstrap] = useState(initialBootstrap)
  const [state, dispatch] = useReducer(replayReducer, bootstrap.state)
  const [saveMode, setSaveMode] = useState<'ephemeral' | 'local'>(bootstrap.saveMode)
  const [savedResults, setSavedResults] = useState<StoredReplay[]>([])
  const [storageMessage, setStorageMessage] = useState('')
  const repository = useRef<SavedReplayRepository | undefined>(undefined)
  const content = contentLoad.content

  useEffect(() => {
    if (!content || typeof window === 'undefined' || !window.indexedDB) return
    createIndexedDbSavedReplayRepository(window.indexedDB, contentReferences())
      .then(async (nextRepository) => {
        repository.current = nextRepository
        setSavedResults(await nextRepository.list())
      })
      .catch(() => setStorageMessage('本机历史暂时不可用；无痕复盘仍可继续。'))
  }, [content])

  const screen = useMemo(
    () => content ? buildScreenViewModel(state, content) : undefined,
    [content, state],
  )
  const savedViewModels = useMemo(
    () => content ? buildSavedReplayViewModels(savedResults, content) : [],
    [content, savedResults],
  )

  if (!content || !screen) {
    return (
      <main className="app-shell">
        <section className="paper-panel" aria-labelledby="content-error-title">
          <p className="eyebrow">内容错误</p>
          <h1 id="content-error-title">内容包未能读取</h1>
          <p>请重新打开页面。已保存的数据不会在这里被静默覆盖。</p>
          <details><summary>查看错误路径</summary><pre>{contentLoad.error}</pre></details>
        </section>
      </main>
    )
  }

  const persistDraft = (answers: Partial<ReplayAnswers>) => {
    if (saveMode !== 'local') return
    try {
      saveLocalState(window.localStorage, createStoragePayload({
        contentVersion: content.contentVersion,
        saveMode: 'local',
        draft: answers,
      }))
    } catch {
      setStorageMessage('草稿无法写入本机；本次仍会在当前页面中保留。')
    }
  }

  const chooseSaveMode = (mode: 'ephemeral' | 'local') => {
    setSaveMode(mode)
    try {
      if (mode === 'local') {
        saveLocalState(window.localStorage, createStoragePayload({
          contentVersion: content.contentVersion,
          saveMode: 'local',
          draft: Object.keys(state.answers).length > 0 ? state.answers : undefined,
        }))
      } else {
        clearLocalState(window.localStorage)
      }
    } catch {
      setStorageMessage('保存模式暂时无法写入本机；本次仍可继续。')
    }
    dispatch({ type: 'ACCEPT_INTRO' })
  }

  const restartReplay = () => {
    if (saveMode === 'local') {
      try {
        saveLocalState(window.localStorage, createStoragePayload({ contentVersion: content.contentVersion, saveMode: 'local' }))
      } catch {
        setStorageMessage('草稿未能清除，请稍后重试。')
      }
    }
    dispatch({ type: 'RESTART' })
  }

  const chooseScenario = (option: ScreenOption) => {
    const scenarioId = option.id === 'scenario-unsure' ? undefined : option.id
    dispatch({ type: 'CHOOSE_SCENARIO', scenarioId })
    persistDraft(scenarioId ? { ...state.answers, scenarioId } : state.answers)
  }

  const chooseWizardOption = (option: ScreenOption) => {
    const keyByStep = {
      relationship: 'relationshipType',
      goal: 'communicationGoal',
      conflict: 'conflictLevel',
      emotion: 'emotionId',
      expression: 'originalExpressionId',
      response: 'responseId',
      intention: 'intention',
    } as const
    const key = keyByStep[state.wizardStep]
    const value = option.value ?? option.id
    const answers = { ...state.answers, [key]: value }
    dispatch({ type: 'SET_ANSWER', key, value })
    persistDraft(answers)
    if (state.wizardStep === 'intention' && completeAnswers(answers)) {
      try {
        dispatch({ type: 'SET_RESULT', result: buildReplayResult(answers, content) })
      } catch (error) {
        dispatch({ type: 'FAIL', message: error instanceof Error ? error.message : '无法生成复盘结果' })
      }
    } else {
      dispatch({ type: 'NEXT_WIZARD' })
    }
  }

  const saveCurrentResult = async () => {
    if (!state.result || !completeAnswers(state.answers)) return
    const entry: StoredReplay = {
      id: `save-${Date.now()}-local`,
      savedAt: new Date().toISOString(),
      answers: state.answers,
      scenarioId: state.result.scenarioId,
    }
    try {
      if (!repository.current) throw new Error('本机历史数据库暂时不可用')
      if (savedResults.length >= 3) {
        const oldest = savedViewModels.at(-1)
        const label = oldest ? `“${oldest.scenarioTitle}”（${new Date(oldest.savedAt).toLocaleString('zh-CN')}）` : '最早的一份复盘'
        if (!window.confirm(`本机已保存三份。继续会替换最早的${label}，是否继续？`)) return
      }
      setSavedResults(await repository.current.save(entry))
      setStorageMessage('已保存到本机，最多保留三份。')
      if (saveMode === 'local') {
        saveLocalState(window.localStorage, createStoragePayload({
          contentVersion: content.contentVersion,
          saveMode: 'local',
          recentResult: entry,
        }))
      }
    } catch (error) {
      setStorageMessage(error instanceof Error ? error.message : '保存失败，请稍后再试。')
    }
  }

  const removeSavedResult = async (entry: StoredReplay) => {
    if (!window.confirm('删除这份本机复盘？此操作无法撤销。')) return
    try {
      await repository.current?.remove(entry.id)
      setSavedResults((current) => current.filter(({ id }) => id !== entry.id))
      setStorageMessage('这份本机复盘已删除。')
    } catch {
      setStorageMessage('暂时无法删除这份复盘。')
    }
  }

  const clearProjectData = async () => {
    if (!window.confirm('清空本工具的草稿和已保存复盘？此操作无法撤销。')) return
    clearLocalState(window.localStorage)
    await repository.current?.clear()
    setSavedResults([])
    setSaveMode('ephemeral')
    setStorageMessage('本工具的本地数据已清空。')
    dispatch({ type: 'RESTART' })
  }

  const restoreResult = (entry: StoredReplay) => {
    try {
      dispatch({ type: 'RESTORE_RESULT', result: buildReplayResult(entry.answers, content) })
    } catch {
      setStorageMessage('该记录引用的内容已更新，请重新复盘。')
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="text-button" type="button" onClick={() => dispatch({ type: 'BACK' })} disabled={state.page === 'landing'}>上一步</button>
        <span aria-label="当前保存模式">{saveMode === 'ephemeral' ? '无痕模式' : '本地模式'}</span>
        <button className="text-button" type="button" onClick={() => dispatch({ type: 'SHOW_SAVED_RESULTS' })}>已保存</button>
      </header>

      <article className="paper-panel" aria-labelledby="screen-title">
        <p className="eyebrow">{screen.eyebrow}</p>
        <h1 id="screen-title">{screen.title}</h1>
        <p className="lead">{screen.lead}</p>

        {screen.sections.map((section) => (
          <section className="content-section" key={section.id} aria-labelledby={`${section.id}-title`}>
            <h2 id={`${section.id}-title`}>{section.title}</h2>
            <BodyList body={section.body} />
          </section>
        ))}

        {state.page === 'intro' && (
          <div className="button-stack" aria-label="选择保存方式">
            <button type="button" onClick={() => chooseSaveMode('ephemeral')}>无痕开始</button>
            <button className="secondary" type="button" onClick={() => chooseSaveMode('local')}>使用本地模式</button>
          </div>
        )}

        {state.page === 'landing' && (
          <div className="button-stack">
            <button type="button" onClick={() => dispatch({ type: 'START' })}>{screen.primaryLabel}</button>
            <button className="secondary" type="button" onClick={() => dispatch({ type: 'SHOW_SAVED_RESULTS' })}>查看本机复盘</button>
          </div>
        )}

        {(state.page === 'scenarioSelect' || state.page === 'replayWizard') && (
          <div className={`option-grid ${state.wizardStep === 'emotion' ? 'emotion-grid' : ''}`}>
            {screen.options.map((option) => (
              <button className="option-card" type="button" key={option.id} onClick={() => state.page === 'scenarioSelect' ? chooseScenario(option) : chooseWizardOption(option)}>
                <strong>{option.label}</strong>
                {option.description && state.page === 'scenarioSelect' ? <span>{option.description}</span> : null}
              </button>
            ))}
          </div>
        )}

        {state.page === 'comparison' && <button type="button" onClick={() => dispatch({ type: 'SHOW_RESULT' })}>{screen.primaryLabel}</button>}

        {state.page === 'safetyNotice' && (
          <div className="button-stack">
            <button type="button" onClick={() => dispatch({ type: 'SHOW_RESULT' })}>{screen.primaryLabel}</button>
            <button className="secondary" type="button" onClick={restartReplay}>先退出这次复盘</button>
          </div>
        )}

        {screen.toneCards.length > 0 && (
          <section className="tone-list" aria-labelledby="tone-title">
            <h2 id="tone-title">三种语气表达</h2>
            {screen.toneCards.map(({ tone, label, text }) => (
              <article className={`tone-card tone-${tone}`} key={tone}><h3>{label}</h3><p>{text}</p></article>
            ))}
          </section>
        )}

        {state.page === 'result' && state.result && (
          <>
            <section className="content-section" aria-labelledby="next-step-title">
              <h2 id="next-step-title">下一步建议</h2>
              {screen.actions.map((step) => <p key={step.id}><strong>{step.label}：</strong>{step.description}</p>)}
            </section>
            <aside className="replay-card" aria-label="复盘卡片摘要"><span>复盘卡片</span><p>{screen.shareSummary}</p></aside>
            <div className="button-stack">
              <button type="button" onClick={saveCurrentResult}>保存这份结构化复盘</button>
              <button className="secondary" type="button" onClick={restartReplay}>重新复盘</button>
            </div>
          </>
        )}

        {state.page === 'savedResults' && (
          <section className="saved-list" aria-live="polite">
            {savedViewModels.length === 0 ? <p className="empty-state">还没有主动保存的复盘。</p> : savedViewModels.map((entry) => (
              <article key={entry.id}>
                <div><strong>{entry.scenarioTitle}</strong><time>{new Date(entry.savedAt).toLocaleString('zh-CN')}</time></div>
                <div className="saved-actions">
                  <button className="secondary" type="button" onClick={() => restoreResult(entry)}>恢复结果</button>
                  <button className="danger-button" type="button" onClick={() => removeSavedResult(entry)}>删除</button>
                </div>
              </article>
            ))}
            <button className="danger-button" type="button" onClick={clearProjectData}>清空本工具数据</button>
          </section>
        )}

        {state.page === 'error' && <button type="button" onClick={restartReplay}>{screen.primaryLabel}</button>}
        {storageMessage && <p className="status-message" role="status">{storageMessage}</p>}
      </article>

      <footer>内容只在本机运行 · 不上传聊天记录 · 表达调整不等于责任都在你</footer>
    </main>
  )
}

export default App
