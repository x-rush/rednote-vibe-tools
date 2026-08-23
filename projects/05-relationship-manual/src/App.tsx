import { useEffect, useReducer, useState } from 'react'
import { buildDisplayCard, findMissingRequiredQuestions, reconcileCardItems } from './app/view-model'
import { RelationshipCard } from './components/RelationshipCard'
import rawContent from './content/content.json'
import { validateContent } from './content/validate'
import type { QuestionnaireAnswer, RelationshipContentPackage, RelationshipContext } from './content/schema'
import { applyAnswer, toggleOption } from './domain/answers'
import { buildCardViewModel } from './domain/card'
import { buildRelationshipProfile } from './domain/profile'
import { clearDraft, loadDraft, saveDraft } from './storage/storage'
import { cardToEditableItems, createInitialState, relationshipReducer, stateToDraft } from './state/state'
import './App.css'

const contentValidation = validateContent(rawContent)
const validatedContent = contentValidation.valid
  ? rawContent as unknown as RelationshipContentPackage
  : null

function now() {
  return new Date().toISOString()
}

function findAnswer(answers: QuestionnaireAnswer[], questionId: string) {
  return answers.find((answer) => answer.questionId === questionId)
}

function App() {
  if (!validatedContent) {
    return <main className="app-shell"><section className="page error-page" role="alert"><p className="eyebrow">内容错误</p><h1>暂时无法打开工具</h1><p>内置内容未通过安全校验，请稍后使用更新后的版本。</p></section></main>
  }
  return <RelationshipManualApp content={validatedContent} />
}

function RelationshipManualApp({ content }: { content: RelationshipContentPackage }) {
  const questions = content.content.questions
  const ui = content.content.uiCopy
  const contentVersion = content.contentVersion
  const questionsById = new Map(questions.map((question) => [question.questionId, question]))
  const [browserStorage] = useState<Storage | null>(() => {
    try {
      return window.localStorage
    } catch {
      return null
    }
  })
  const [loadedDraft] = useState(() => browserStorage
    ? loadDraft(browserStorage, contentVersion, { questionsById })
    : { status: 'unavailable' as const })
  const [state, dispatch] = useReducer(relationshipReducer, undefined, () => {
    if (loadedDraft.status === 'corrupt') {
      return { ...createInitialState(true), page: 'error' as const, error: '本机草稿已损坏。原数据尚未覆盖，你可以清除后重新开始。' }
    }
    if (loadedDraft.status === 'unsupported-version') {
      return { ...createInitialState(true), page: 'error' as const, error: '本机草稿来自暂不支持的版本。你可以清除后重新开始。' }
    }
    if (loadedDraft.status === 'unavailable') {
      return { ...createInitialState(), page: 'error' as const, error: '浏览器暂时不允许读取本机存储。请检查隐私或存储设置后重试。' }
    }
    return createInitialState(loadedDraft.status === 'ok')
  })
  const [notice, setNotice] = useState<string | null>(null)
  const [interactionError, setInteractionError] = useState<string | null>(null)

  useEffect(() => {
    if (!state.hasDraft || state.page === 'landing' || state.page === 'error') return
    if (browserStorage) saveDraft(browserStorage, stateToDraft(state, contentVersion, now()))
  }, [browserStorage, contentVersion, state])

  const persistNow = () => {
    const saved = browserStorage ? saveDraft(browserStorage, stateToDraft(state, contentVersion, now())) : { ok: false as const, error: 'write-failed' as const }
    setNotice(saved.ok ? '已暂存在本设备' : '暂存失败，请检查浏览器存储设置')
  }

  const clearAll = () => {
    if (!window.confirm('确定清除本工具的草稿和最近结果吗？清除后无法恢复。')) return
    if (!browserStorage || !clearDraft(browserStorage)) {
      setNotice('清除失败，请检查浏览器存储设置')
      return
    }
    dispatch({ type: 'CLEAR_ALL' })
    setNotice('本工具的本地数据已清除')
  }

  const restore = () => {
    if (loadedDraft.status === 'ok') {
      dispatch({ type: 'RESTORE', draft: loadedDraft.payload })
      if (loadedDraft.contentChanged) setNotice('内容已更新，请确认答案后重新生成卡片')
    }
  }

  const openIntro = () => {
    if (state.hasDraft) {
      if (!window.confirm('开始新的整理会清除已有草稿，确定继续吗？')) return
      if (!browserStorage || !clearDraft(browserStorage)) {
        setNotice('无法清除已有草稿，请检查浏览器存储设置')
        return
      }
      dispatch({ type: 'CLEAR_ALL' })
    }
    dispatch({ type: 'OPEN_INTRO' })
  }

  const startOver = () => {
    if (!window.confirm('确定重新开始吗？当前草稿会被清除。')) return
    if (!browserStorage || !clearDraft(browserStorage)) {
      setNotice('无法清除当前草稿，请检查浏览器存储设置')
      return
    }
    dispatch({ type: 'CLEAR_ALL' })
    dispatch({ type: 'OPEN_INTRO' })
  }

  const generate = () => {
    const missing = findMissingRequiredQuestions(questions, state.answers)
    if (missing.length > 0) {
      dispatch({ type: 'OPEN_REVIEW', missingRequiredQuestionIds: missing })
      return
    }
    const generatedAt = now()
    const profile = buildRelationshipProfile(content, state.answers, generatedAt)
    const card = buildCardViewModel(content, profile, state.relationshipContext)
    const generatedItems = cardToEditableItems(card)
    const cardItems = state.cardItems.length > 0 ? reconcileCardItems(state.cardItems, generatedItems) : generatedItems
    dispatch({ type: 'GENERATE', card, cardItems, generatedAt })
  }

  const renderQuestionnaire = () => {
    const question = questions[state.currentQuestionIndex]
    if (!question) return <EmptyState onReset={startOver} title={ui.emptyTitle} body={ui.emptyBody} />
    const existing = findAnswer(state.answers, question.questionId)
    const selectedIds = existing?.optionIds ?? []

    const setSelection = (optionId: string) => {
      const nextIds = toggleOption(question, selectedIds, optionId)
      if (nextIds.length < question.selectionLimit.min) return
      const nextAnswers = applyAnswer(state.answers, question, nextIds, now())
      const nextAnswer = findAnswer(nextAnswers, question.questionId)
      if (nextAnswer) dispatch({ type: 'SET_ANSWER', answer: nextAnswer })
      setInteractionError(null)
    }

    const goNext = () => {
      if (!existing || existing.skipped || existing.optionIds.length === 0) {
        setInteractionError('请先选择一个符合当下情况的选项。')
        return
      }
      if (state.currentQuestionIndex === questions.length - 1) {
        dispatch({ type: 'OPEN_REVIEW', missingRequiredQuestionIds: findMissingRequiredQuestions(questions, state.answers) })
      } else {
        dispatch({ type: 'NEXT_QUESTION', questionCount: questions.length })
      }
      setInteractionError(null)
    }

    const skip = () => {
      const skipped: QuestionnaireAnswer = { questionId: question.questionId, optionIds: [], skipped: true, updatedAt: now() }
      dispatch({ type: 'SET_ANSWER_AND_NEXT', answer: skipped, questionCount: questions.length })
      setInteractionError(null)
    }

    return (
      <section className="page page--questionnaire" aria-labelledby="question-title">
        <header className="page-header">
          <p className="eyebrow">偏好整理 · {state.currentQuestionIndex + 1} / {questions.length}</p>
          <progress max={questions.length} value={state.currentQuestionIndex + 1} aria-label="问卷进度" />
          <h1 id="question-title">{question.prompt}</h1>
          <p className="supporting-copy">{question.multiple ? `可选 ${question.selectionLimit.min}–${question.selectionLimit.max} 项` : '请选择最接近当下感受的一项，没有正确答案。'}</p>
        </header>
        <fieldset className="option-list">
          <legend className="sr-only">{question.prompt}</legend>
          {question.options.map((option) => {
            const checked = selectedIds.includes(option.optionId)
            return (
              <label className={`option-card${checked ? ' option-card--selected' : ''}`} key={option.optionId}>
                <input type={question.multiple ? 'checkbox' : 'radio'} name={question.questionId} checked={checked} onChange={() => setSelection(option.optionId)} />
                <span>{option.text}</span>
              </label>
            )
          })}
        </fieldset>
        {interactionError && <p className="inline-error" role="alert">{interactionError}</p>}
        {state.error && <p className="inline-error" role="alert">{state.error}</p>}
        <nav className="action-bar" aria-label="答题操作">
          <button className="button button--ghost" type="button" onClick={() => dispatch({ type: 'PREVIOUS_QUESTION' })} disabled={state.currentQuestionIndex === 0}>上一题</button>
          {question.skipRule.allowed && <button className="button button--text" type="button" onClick={skip}>暂时跳过</button>}
          <button className="button button--primary" type="button" onClick={goNext}>{state.currentQuestionIndex === questions.length - 1 ? '查看回顾' : '下一题'}</button>
        </nav>
        <button className="save-link" type="button" onClick={persistNow}>暂存到本设备</button>
      </section>
    )
  }

  const renderReview = () => {
    const missing = findMissingRequiredQuestions(questions, state.answers)
    return (
      <section className="page" aria-labelledby="review-title">
        <header className="page-header">
          <p className="eyebrow">{ui.reviewEyebrow}</p>
          <h1 id="review-title">{ui.reviewTitle}</h1>
          <p className="supporting-copy">{ui.reviewBody}</p>
        </header>
        {missing.length > 0 && <p className="inline-error" role="alert">还有 {missing.length} 道必答题未完成。</p>}
        <ol className="review-list">
          {questions.map((question, index) => {
            const answer = findAnswer(state.answers, question.questionId)
            const labels = answer?.skipped ? ['已跳过'] : question.options.filter((option) => answer?.optionIds.includes(option.optionId)).map((option) => option.text)
            return (
              <li key={question.questionId}>
                <div><span className="review-list__number">{index + 1}</span><div><p>{question.prompt}</p><strong>{labels.length > 0 ? labels.join('、') : '未回答'}</strong></div></div>
                <button type="button" onClick={() => dispatch({ type: 'BACK_TO_QUESTION', questionIndex: index })}>修改</button>
              </li>
            )
          })}
        </ol>
        <div className="stacked-actions">
          <button className="button button--primary" type="button" onClick={generate} disabled={missing.length > 0}>生成我的关系说明书</button>
          <button className="button button--ghost" type="button" onClick={() => dispatch({ type: 'BACK_TO_QUESTION', questionIndex: Math.max(0, state.currentQuestionIndex) })}>返回答题</button>
        </div>
      </section>
    )
  }

  const renderCardPage = (saved: boolean) => {
    if (!state.lastResult) return <EmptyState onReset={startOver} title={ui.emptyTitle} body={ui.emptyBody} />
    const displayCard = buildDisplayCard(state.lastResult, state.cardItems, state.settings.compactMode, state.settings.showSensitiveInCompact)
    return (
      <section className="page page--result" aria-labelledby="result-title">
        <header className="page-header">
          <p className="eyebrow">{saved ? ui.resultSavedEyebrow : ui.resultReadyEyebrow}</p>
          <h1 id="result-title">{saved ? ui.resultSavedTitle : ui.resultTitle}</h1>
          <p className="supporting-copy">{ui.resultBody}</p>
        </header>
        <div className="preview-controls" role="group" aria-label="预览设置">
          <button type="button" aria-pressed={!state.settings.compactMode} onClick={() => dispatch({ type: 'SET_COMPACT', compactMode: false })}>完整版</button>
          <button type="button" aria-pressed={state.settings.compactMode} onClick={() => dispatch({ type: 'SET_COMPACT', compactMode: true })}>简版</button>
          {state.settings.compactMode && <label><input type="checkbox" checked={state.settings.showSensitiveInCompact} onChange={(event) => dispatch({ type: 'SET_SENSITIVE_COMPACT', show: event.target.checked })} />简版中包含敏感边界</label>}
        </div>
        {displayCard.sections.length > 0 ? <RelationshipCard card={displayCard} compact={state.settings.compactMode} /> : <p className="empty-panel">当前没有可见段落。你可以进入编辑页重新显示内容。</p>}
        <div className="stacked-actions">
          <button className="button button--primary" type="button" onClick={() => dispatch({ type: 'EDIT_CARD' })}>编辑卡片内容</button>
          {!saved && <button className="button button--secondary" type="button" onClick={() => dispatch({ type: 'SAVE_RESULT' })}>确认并保留在本设备</button>}
          <button className="button button--ghost" type="button" onClick={() => dispatch({ type: 'OPEN_REVIEW', missingRequiredQuestionIds: [] })}>修改答案并重新生成</button>
          <button className="button button--text danger-text" type="button" onClick={startOver}>重新开始</button>
        </div>
      </section>
    )
  }

  const renderEditor = () => {
    const ordered = [...state.cardItems].sort((a, b) => a.order - b.order)
    return (
      <section className="page" aria-labelledby="edit-title">
        <header className="page-header">
          <p className="eyebrow">{ui.editorEyebrow}</p>
          <h1 id="edit-title">{ui.editorTitle}</h1>
          <p className="supporting-copy">{ui.editorBody}</p>
        </header>
        <div className="editor-list">
          {ordered.map((item, index) => (
            <article className={`editor-item${item.visible ? '' : ' editor-item--hidden'}`} key={item.itemId}>
              <div className="editor-item__meta"><span>{content.content.cardRules.sections.find((section) => section.sectionId === item.sectionId)?.title}</span><span>{Array.from(item.editedText).length}/120</span></div>
              {item.needsReview && <p className="review-note">{ui.editorReviewNote}</p>}
              <textarea maxLength={120} rows={4} value={item.editedText} disabled={!item.visible} onChange={(event) => dispatch({ type: 'EDIT_ITEM', itemId: item.itemId, text: event.target.value })} aria-label={`编辑：${item.suggestedText}`} />
              <div className="editor-item__actions">
                <button type="button" onClick={() => dispatch({ type: 'TOGGLE_ITEM', itemId: item.itemId })}>{item.visible ? '隐藏' : '显示'}</button>
                <button type="button" disabled={index === 0} onClick={() => dispatch({ type: 'MOVE_ITEM', itemId: item.itemId, direction: -1 })}>上移</button>
                <button type="button" disabled={index === ordered.length - 1} onClick={() => dispatch({ type: 'MOVE_ITEM', itemId: item.itemId, direction: 1 })}>下移</button>
              </div>
            </article>
          ))}
        </div>
        <div className="stacked-actions">
          <button className="button button--primary" type="button" onClick={() => dispatch({ type: 'SAVE_RESULT' })}>完成编辑并查看卡片</button>
          <button className="button button--ghost" type="button" onClick={persistNow}>暂存当前修改</button>
        </div>
      </section>
    )
  }

  let pageContent
  switch (state.page) {
    case 'landing':
      pageContent = <section className="page page--landing" aria-labelledby="landing-title"><header className="hero"><p className="eyebrow">{ui.landingEyebrow}</p><h1 id="landing-title">{content.meta.title}</h1><p className="hero__lead">{ui.landingLead}</p></header><div className="privacy-note"><strong>{ui.privacyTitle}</strong><p>{ui.privacyBody}</p></div><div className="stacked-actions">{state.hasDraft && <button className="button button--secondary" type="button" onClick={restore}>继续上次整理</button>}<button className="button button--primary" type="button" onClick={openIntro}>开始整理</button></div></section>
      break
    case 'intro':
      pageContent = <section className="page" aria-labelledby="intro-title"><header className="page-header"><p className="eyebrow">{ui.introEyebrow}</p><h1 id="intro-title">{ui.introTitle}</h1><p className="supporting-copy">{ui.introBody}</p></header><div className="relationship-options">{(Object.entries(content.content.cardRules.relationshipLabels) as Array<[RelationshipContext, string]>).map(([id, label]) => <button type="button" key={id} onClick={() => dispatch({ type: 'BEGIN', relationshipContext: id })}><strong>{label}</strong><span>{ui.contextHint}</span></button>)}</div><details className="principles"><summary>{ui.principlesTitle}</summary><ul>{content.content.safetyRules.map((rule) => <li key={rule.ruleId}>{rule.label}</li>)}</ul></details><button className="button button--ghost" type="button" onClick={() => dispatch({ type: 'CLEAR_ALL' })}>返回首页</button></section>
      break
    case 'questionnaire': pageContent = renderQuestionnaire(); break
    case 'review': pageContent = renderReview(); break
    case 'result': pageContent = renderCardPage(false); break
    case 'editCard': pageContent = renderEditor(); break
    case 'savedResult': pageContent = renderCardPage(true); break
    case 'error': pageContent = <section className="page error-page" role="alert" aria-labelledby="error-title"><p className="eyebrow">需要恢复</p><h1 id="error-title">暂时无法读取本机草稿</h1><p>{state.error ?? '内容暂时无法显示。'}</p><button className="button button--primary" type="button" onClick={clearAll}>清除本工具数据并重新开始</button></section>; break
  }

  return <main className="app-shell">{pageContent}{notice && <p className="save-status" role="status">{notice}</p>}{state.page !== 'landing' && state.page !== 'error' && <footer className="app-footer"><span>内容仅保存在本设备</span><button type="button" onClick={clearAll}>清除本工具数据</button></footer>}</main>
}

function EmptyState({ onReset, title, body }: { onReset: () => void; title: string; body: string }) {
  return <section className="page empty-state" role="status"><h1>{title}</h1><p>{body}</p><button className="button button--primary" type="button" onClick={onReset}>重新开始</button></section>
}

export default App
