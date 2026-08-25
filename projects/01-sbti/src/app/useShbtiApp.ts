import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import type { ShbtiContentPackage } from '../content/types'
import { generateQuizResult, recordAnswer } from '../quiz/scoring'
import { selectQuestionIds } from '../quiz/selection'
import { clearGuideState } from '../guide/guideState'
import {
  clearStorage,
  hydrateStoredResult,
  loadStorage,
  saveStorage,
  toStoredResult,
  type StoragePayload,
} from '../storage/storage'
import { appReducer, createInitialState, type AppState } from './state'
import type { AppScreen } from './state'

const DEFAULT_SETTINGS = { muted: false, reducedMotion: false }

export function shouldPersistScreen(screen: AppScreen, persistenceEnabled = true) {
  return persistenceEnabled && screen !== 'error'
}

function initialStateFromStorage(content: ShbtiContentPackage, loaded: ReturnType<typeof loadStorage>): AppState {
  if (loaded.status === 'ready') {
    const recent = loaded.payload.data.recentResult ? hydrateStoredResult(loaded.payload.data.recentResult, content) : undefined
    return createInitialState(recent, loaded.payload.data.activeProgress)
  }
  if (loaded.status === 'recovered') return { screen: 'error', errorReason: 'storage', recoveryKind: 'cleared', message: `${loaded.reason}。旧数据已安全清除。` }
  if (loaded.status === 'unavailable') return { screen: 'error', errorReason: 'storage', recoveryKind: 'unavailable', message: `${loaded.reason}。` }
  return createInitialState()
}

export function useShbtiApp(content: ShbtiContentPackage) {
  const loaded = useMemo(() => loadStorage(window.localStorage, content), [content])
  const [state, dispatch] = useReducer(appReducer, initialStateFromStorage(content, loaded))
  const [settings, setSettings] = useState(loaded.status === 'ready' ? loaded.payload.data.settings : DEFAULT_SETTINGS)
  const persistenceEnabled = useRef(loaded.status !== 'unavailable')

  useEffect(() => {
    document.documentElement.dataset.reducedMotion = String(settings.reducedMotion)
    return () => { delete document.documentElement.dataset.reducedMotion }
  }, [settings.reducedMotion])

  useEffect(() => {
    if (!shouldPersistScreen(state.screen, persistenceEnabled.current)) return
    const updatedAt = new Date().toISOString()
    const payload: StoragePayload = {
      schemaVersion: 1,
      quizVersion: content.contentVersion,
      updatedAt,
      data: {
        activeProgress: state.progress,
        recentResult: state.recentResult ? toStoredResult(state.recentResult) : undefined,
        settings,
      },
    }
    try {
      saveStorage(window.localStorage, payload, content)
    } catch {
      persistenceEnabled.current = false
      dispatch({ type: 'FAIL', reason: 'storage', recoveryKind: 'write-failed', message: '本机进度保存失败。' })
    }
  }, [content, loaded.status, settings, state.progress, state.recentResult, state.screen])

  const currentQuestionId = state.progress?.questionIds[state.progress.currentIndex]
  const currentQuestion = content.content.questions.find((question) => question.id === currentQuestionId)
  const selectedOptionId = state.progress?.answers.find((answer) => answer.questionId === currentQuestionId)?.optionId

  function start(seed = `run-${Date.now().toString(36)}`) {
    dispatch({ type: 'START', seed, questionIds: selectQuestionIds(content, seed) })
  }

  function choose(optionId: string) {
    if (!state.progress || !currentQuestion) return
    const answers = recordAnswer(state.progress.answers, currentQuestion.id, optionId, content)
    const answer = answers.find((item) => item.questionId === currentQuestion.id)!
    dispatch({ type: 'ANSWER', answer })
  }

  function completeReveal() {
    if (state.screen !== 'calculating' || !state.progress) return
    const result = generateQuizResult(state.progress.questionIds, state.progress.answers, content, new Date().toISOString())
    dispatch({ type: 'CALCULATED', result })
  }

  function clearAll() {
    if (!window.confirm('清空本工具的答题进度和最近结果？此操作无法撤销。')) return
    clearStorage(window.localStorage)
    clearGuideState(window.localStorage)
    dispatch({ type: 'CLEAR_ALL' })
    setSettings(DEFAULT_SETTINGS)
  }

  function restart() {
    if (!window.confirm('重新测评会清除当前答题进度，确定继续吗？')) return
    start()
  }

  return {
    state,
    settings,
    lastSavedAt: loaded.status === 'ready' ? loaded.payload.updatedAt : undefined,
    currentQuestion,
    selectedOptionId,
    dispatch,
    start,
    choose,
    completeReveal,
    clearAll,
    restart,
    setMuted: (muted: boolean) => setSettings((value) => ({ ...value, muted })),
    setReducedMotion: (reducedMotion: boolean) => setSettings((value) => ({ ...value, reducedMotion })),
  }
}
