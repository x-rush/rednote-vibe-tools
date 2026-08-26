import { useEffect, useReducer, useState } from 'react'
import { selectNpcCue } from './app/npc'
import { scheduleNoticeDismiss } from './app/notice'
import { buildTopicProgress, getCardSectionArtwork, getTopicArtwork, resetViewport } from './app/presentation'
import { buildSessionBackupText } from './app/session-backup'
import { buildDisplayCard, findMissingRequiredQuestions, reconcileCardItems } from './app/view-model'
import editConflictIcon from './assets/art/edit-conflict.svg'
import localOnlyIcon from './assets/art/local-only.svg'
import sensitiveIcon from './assets/art/sensitive.svg'
import { RelationshipCard } from './components/RelationshipCard'
import { ChapterIntro } from './components/ChapterIntro'
import { ConflictNote } from './components/ConflictNote'
import { ContextSelectionScene } from './components/ContextSelectionScene'
import { LandingScene } from './components/LandingScene'
import { QuestionSheet } from './components/QuestionSheet'
import { QuestionnaireActions } from './components/QuestionnaireActions'
import { ResultHeading } from './components/ResultHeading'
import { ShareCardExportButton } from './components/ShareCardExportButton'
import { StorageWarning } from './components/StorageWarning'
import { TopicProgress } from './components/TopicProgress'
import rawContent from './content/content.json'
import { getRelationshipBank } from './content/bank'
import { validateContent } from './content/validate'
import type { QuestionnaireAnswer, RelationshipContentPackage, RelationshipContext } from './content/schema'
import { applyAnswer, toggleOption } from './domain/answers'
import { buildCardViewModel } from './domain/card'
import { buildRelationshipProfile } from './domain/profile'
import { saveShareCardPng } from './export/share-card'
import { buildStorageReferences, clearDraft, loadDraft, saveDraft } from './storage/storage'
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
    return (
      <main className="app-shell app-shell--error">
        <section className="page error-page paper-sheet" role="alert">
          <p className="eyebrow">内容错误</p>
          <h1>暂时无法打开工具</h1>
          <p>内置内容未通过安全校验，请稍后使用更新后的版本。</p>
        </section>
      </main>
    )
  }
  return <RelationshipManualApp content={validatedContent} />
}

function RelationshipManualApp({ content }: { content: RelationshipContentPackage }) {
  const ui = content.content.uiCopy
  const contentVersion = content.contentVersion
  const storageErrorCue = selectNpcCue(content, { trigger: 'storage-error' })
  const storageReferences = buildStorageReferences(content)
  const [browserStorage] = useState<Storage | null>(() => {
    try {
      return window.localStorage
    } catch {
      return null
    }
  })
  const [loadedDraft] = useState(() => browserStorage
    ? loadDraft(browserStorage, content, storageReferences)
    : { status: 'unavailable' as const })
  const [state, dispatch] = useReducer(relationshipReducer, undefined, () => {
    if (loadedDraft.status === 'corrupt') {
      return { ...createInitialState(true), page: 'error' as const, error: '本机草稿已损坏。原数据尚未覆盖，你可以清除后重新开始。' }
    }
    if (loadedDraft.status === 'unsupported-version') {
      return { ...createInitialState(true), page: 'error' as const, error: '本机草稿来自暂不支持的版本。你可以清除后重新开始。' }
    }
    if (loadedDraft.status === 'unavailable') return createInitialState()
    return createInitialState(loadedDraft.status === 'ok')
  })
  const questions = getRelationshipBank(content, state.relationshipContext).questions
  const relationshipLabel = content.content.cardRules.relationshipLabels[state.relationshipContext]
  const sessionBackupText = buildSessionBackupText(relationshipLabel, questions, state.answers, state.lastResult, state.cardItems)
  const [notice, setNotice] = useState<string | null>(null)
  const [storageWarning, setStorageWarning] = useState(loadedDraft.status === 'unavailable')
  const [interactionError, setInteractionError] = useState<string | null>(null)
  const [dismissedConflictCueId, setDismissedConflictCueId] = useState<string | null>(null)
  const [exportingShareCard, setExportingShareCard] = useState(false)

  useEffect(() => scheduleNoticeDismiss(notice, () => setNotice(null)), [notice])

  useEffect(() => {
    if (!state.hasDraft || state.page === 'landing' || state.page === 'error') return
    const saved = browserStorage
      ? saveDraft(browserStorage, stateToDraft(state, contentVersion, now()))
      : { ok: false as const }
    if (saved.ok) return
    const warningTimer = window.setTimeout(() => setStorageWarning(true), 0)
    return () => window.clearTimeout(warningTimer)
  }, [browserStorage, contentVersion, state])

  useEffect(() => {
    resetViewport((options) => window.scrollTo(options))
  }, [state.currentQuestionIndex, state.page])

  const persistNow = () => {
    const saved = browserStorage
      ? saveDraft(browserStorage, stateToDraft(state, contentVersion, now()))
      : { ok: false as const, error: 'write-failed' as const }
    setStorageWarning(!saved.ok)
    setNotice(saved.ok ? '已暂存在本设备' : '暂存失败；当前会话仍可继续')
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
      if (loadedDraft.migration) {
        setNotice(`已保留 ${loadedDraft.migration.preservedAnswerCount} 道旧答案，另有 ${loadedDraft.migration.needsAnswerQuestionIds.length} 道需要重新确认。`)
      } else if (loadedDraft.contentChanged) {
        setNotice('内容已更新，请确认答案后重新生成卡片')
      }
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
    const profile = buildRelationshipProfile(content, state.relationshipContext, state.answers, generatedAt)
    const adoptedConflictRuleIds = profile.conflictRuleIds.filter((ruleId) => state.conflictRuleDecisions[ruleId] === 'adopted')
    const card = buildCardViewModel(content, profile, state.relationshipContext, adoptedConflictRuleIds)
    const generatedItems = cardToEditableItems(card)
    const cardItems = state.cardItems.length > 0 ? reconcileCardItems(state.cardItems, generatedItems) : generatedItems
    dispatch({ type: 'GENERATE', card, cardItems, generatedAt })
  }

  const exportShareCard = async (card: ReturnType<typeof buildDisplayCard>) => {
    setExportingShareCard(true)
    try {
      await saveShareCardPng(card)
      setNotice(ui.shareExportSuccess)
    } catch {
      setNotice(ui.shareExportFailure)
    } finally {
      setExportingShareCard(false)
    }
  }

  const renderQuestionnaire = () => {
    const question = questions[state.currentQuestionIndex]
    if (!question) return <EmptyState onReset={startOver} title={ui.emptyTitle} body={ui.emptyBody} />
    const existing = findAnswer(state.answers, question.questionId)
    const selectedIds = existing?.optionIds ?? []
    const topics = buildTopicProgress(questions, state.currentQuestionIndex, state.answers)
    const activeTopic = getTopicArtwork(question.category)
    const chapterCue = selectNpcCue(content, { trigger: 'chapter-intro', category: question.category })
    const conflictProfile = buildRelationshipProfile(content, state.relationshipContext, state.answers, content.meta.updatedAt)
    const conflictCue = conflictProfile.conflictRuleIds
      .filter((conflictRuleId) => state.conflictRuleDecisions[conflictRuleId] === undefined)
      .map((conflictRuleId) => selectNpcCue(content, { trigger: 'conflict', relationshipContext: state.relationshipContext, conflictRuleId }))
      .find((cue) => cue !== null && cue.cueId !== dismissedConflictCueId) ?? null

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
        dispatch({
          type: 'SET_ANSWER_AND_NEXT',
          answer: existing,
          questionCount: questions.length,
          currentCategory: question.category,
          nextCategory: questions[state.currentQuestionIndex + 1]?.category,
        })
      }
      setInteractionError(null)
    }

    const skip = () => {
      const skipped: QuestionnaireAnswer = { questionId: question.questionId, optionIds: [], skipped: true, updatedAt: now() }
      dispatch({
        type: 'SET_ANSWER_AND_NEXT',
        answer: skipped,
        questionCount: questions.length,
        currentCategory: question.category,
        nextCategory: questions[state.currentQuestionIndex + 1]?.category,
      })
      setInteractionError(null)
    }

    return (
      <section className="page page--questionnaire" aria-labelledby="question-title">
        <TopicProgress topics={topics} />
        <QuestionSheet
          question={question}
          selectedIds={selectedIds}
          activeTopic={activeTopic}
          topicIndex={topics.findIndex((topic) => topic.category === question.category)}
          questionIndex={state.currentQuestionIndex}
          questionCount={questions.length}
          npcCue={chapterCue}
          showNpcMessage={state.currentQuestionIndex === 0 || questions[state.currentQuestionIndex - 1]?.category !== question.category}
          onSelect={setSelection}
        />
        {conflictCue && conflictCue.conflictRuleId && (
          <ConflictNote
            cue={conflictCue}
            onAdopt={() => dispatch({ type: 'SET_CONFLICT_DECISION', ruleId: conflictCue.conflictRuleId!, decision: 'adopted' })}
            onPreserve={() => dispatch({ type: 'SET_CONFLICT_DECISION', ruleId: conflictCue.conflictRuleId!, decision: 'preserved' })}
            onClose={() => {
              dispatch({ type: 'SET_CONFLICT_DECISION', ruleId: conflictCue.conflictRuleId!, decision: 'dismissed' })
              setDismissedConflictCueId(conflictCue.cueId)
            }}
          />
        )}
        {interactionError && <p className="inline-error" role="alert">{interactionError}</p>}
        {state.error && <p className="inline-error" role="alert">{state.error}</p>}
        <QuestionnaireActions
          previousDisabled={state.currentQuestionIndex === 0}
          allowSkip={question.skipRule.allowed}
          isLastQuestion={state.currentQuestionIndex === questions.length - 1}
          showReturnToReview={state.returnToReviewAfterEdit}
          onPrevious={() => dispatch({ type: 'PREVIOUS_QUESTION' })}
          onSkip={skip}
          onNext={goNext}
          onReturnToReview={() => dispatch({ type: 'OPEN_REVIEW', missingRequiredQuestionIds: findMissingRequiredQuestions(questions, state.answers) })}
        />
        <button className="save-link" type="button" onClick={persistNow}><img src={localOnlyIcon} alt="" />暂存到本设备</button>
      </section>
    )
  }

  const renderChapterIntro = () => {
    const question = questions[state.currentQuestionIndex]
    if (!question) return <EmptyState onReset={startOver} title={ui.emptyTitle} body={ui.emptyBody} />
    const chapter = content.content.chapters.find((item) => item.category === question.category)
    const cue = selectNpcCue(content, { trigger: 'chapter-intro', category: question.category })
    if (!chapter || !cue) return <EmptyState onReset={startOver} title={ui.emptyTitle} body={ui.emptyBody} />
    const continueChapter = () => dispatch({ type: 'CONTINUE_CHAPTER', category: question.category })

    return (
      <ChapterIntro
        chapter={chapter}
        cue={cue}
        contextLead={content.content.contextCopy[state.relationshipContext].chapterLeads[question.category]}
        completedQuestionCount={state.answers.length}
        onContinue={continueChapter}
        onSkip={continueChapter}
      />
    )
  }

  const renderReview = () => {
    const missing = findMissingRequiredQuestions(questions, state.answers)
    return (
      <section className="page page--review" aria-labelledby="review-title">
        <header className="page-header editorial-header">
          <p className="eyebrow">{ui.reviewEyebrow}</p>
          <h1 id="review-title">{ui.reviewTitle}</h1>
          <p className="supporting-copy">{ui.reviewBody}</p>
          <div className="completion-stamp"><strong>{state.answers.length}</strong><span>/ {questions.length}<br />张纸签已归位</span></div>
        </header>
        {missing.length > 0 && <p className="inline-error" role="alert">还有 {missing.length} 道必答题未完成。</p>}
        <ol className="review-list paper-sheet">
          {questions.map((question, index) => {
            const answer = findAnswer(state.answers, question.questionId)
            const labels = answer?.skipped ? ['暂不确定'] : question.options.filter((option) => answer?.optionIds.includes(option.optionId)).map((option) => option.text)
            const artwork = getTopicArtwork(question.category)
            return (
              <li key={question.questionId}>
                <div className="review-list__content">
                  <span className="review-list__icon"><img src={artwork.iconUrl} alt="" /></span>
                  <div><p><span>{String(index + 1).padStart(2, '0')}</span>{question.prompt}</p><strong>{labels.length > 0 ? labels.join('、') : '未回答'}</strong></div>
                </div>
                <button type="button" onClick={() => dispatch({ type: 'BACK_TO_QUESTION', questionIndex: index })}>修改</button>
              </li>
            )
          })}
        </ol>
        <div className="stacked-actions stacked-actions--wide">
          <button className="button button--primary" type="button" onClick={generate} disabled={missing.length > 0}>装订成我的关系说明书</button>
          <button className="button button--ghost" type="button" onClick={() => dispatch({ type: 'BACK_TO_QUESTION', questionIndex: Math.max(0, state.currentQuestionIndex) })}>返回答题</button>
        </div>
      </section>
    )
  }

  const renderCardPage = (saved: boolean) => {
    if (!state.lastResult) return <EmptyState onReset={startOver} title={ui.emptyTitle} body={ui.emptyBody} />
    const displayCard = buildDisplayCard(state.lastResult, state.cardItems, state.settings.compactMode, state.settings.showSensitiveInCompact)
    const shareCard = buildDisplayCard(state.lastResult, state.cardItems, true, state.settings.showSensitiveInCompact)
    return (
      <section className="page page--result" aria-labelledby="result-title">
        <ResultHeading eyebrow={saved ? ui.resultSavedEyebrow : ui.resultReadyEyebrow} title={saved ? ui.resultSavedTitle : ui.resultTitle} body={ui.resultBody} cue={bindingCue} />
        <div className="result-workspace">
          <aside className="result-tools paper-note">
            <span className="pencil-label">版本选择</span>
            <div className="preview-controls" role="group" aria-label="预览设置">
              <button type="button" aria-pressed={!state.settings.compactMode} onClick={() => dispatch({ type: 'SET_COMPACT', compactMode: false })}><strong>完整版</strong><small>全部可见章节</small></button>
              <button type="button" aria-pressed={state.settings.compactMode} onClick={() => dispatch({ type: 'SET_COMPACT', compactMode: true })}><strong>简洁版</strong><small>适合截图分享</small></button>
            </div>
            {state.settings.compactMode && (
              <label className="sensitive-control"><img src={sensitiveIcon} alt="" /><span><strong>敏感边界</strong><small>简洁版默认不包含</small></span><input type="checkbox" checked={state.settings.showSensitiveInCompact} onChange={(event) => dispatch({ type: 'SET_SENSITIVE_COMPACT', show: event.target.checked })} /></label>
            )}
            <div className="result-tools__actions">
              <button className="button button--primary" type="button" onClick={() => dispatch({ type: 'EDIT_CARD' })}>继续编辑</button>
              <ShareCardExportButton
                exporting={exportingShareCard}
                disabled={shareCard.sections.length === 0}
                label={ui.shareExportLabel}
                exportingLabel={ui.shareExportingLabel}
                description={shareCard.sections.length === 0 ? '当前没有可导出的段落，请进入编辑页重新显示内容' : ui.shareExportDescription}
                onExport={() => {
                dispatch({ type: 'SET_COMPACT', compactMode: true })
                void exportShareCard(shareCard)
                }}
              />
              {!saved && <button className="button button--secondary" type="button" onClick={() => dispatch({ type: 'SAVE_RESULT' })}>保留在本设备</button>}
              <button className="button button--ghost" type="button" onClick={() => dispatch({ type: 'OPEN_REVIEW', missingRequiredQuestionIds: [] })}>修改答案</button>
            </div>
          </aside>
          <div className="share-stage">
            <div className="share-stage__label"><span>{state.settings.compactMode ? 'COMPACT LETTER · LONG COPY' : 'FULL LETTER · LOCAL COPY'}</span><span>{displayCard.sections.length} 个可见章节</span></div>
            {displayCard.sections.length > 0 ? <RelationshipCard card={displayCard} compact={state.settings.compactMode} /> : <p className="empty-panel">当前没有可见段落。你可以进入编辑页重新显示内容。</p>}
          </div>
        </div>
        <button className="button button--text danger-text" type="button" onClick={startOver}>重新开始</button>
      </section>
    )
  }

  const renderEditor = () => {
    const ordered = [...state.cardItems].sort((a, b) => a.order - b.order)
    const editorPreview = state.lastResult
      ? buildDisplayCard(state.lastResult, ordered, false, true)
      : null
    return (
      <section className="page page--editor" aria-labelledby="edit-title">
        <header className="page-header editorial-header">
          <p className="eyebrow">{ui.editorEyebrow}</p>
          <h1 id="edit-title">{ui.editorTitle}</h1>
          <p className="supporting-copy">{ui.editorBody}</p>
        </header>
        <div className="editor-workspace">
          <div className="editor-column">
            <div className="xiaoman-note paper-note">
              <span className="xiaoman-note__seal" aria-hidden="true">满</span>
              <span><strong>{ui.guideName} · {ui.guideRole}</strong><p>{ui.guideMessage}</p></span>
              <span className="blue-pencil" aria-hidden="true">／</span>
            </div>
            <div className="editor-list">
              {ordered.map((item, index) => {
                const section = content.content.cardRules.sections.find((candidate) => candidate.sectionId === item.sectionId)
                const artwork = getCardSectionArtwork(item.sectionId)
                return (
                  <article className={`editor-item${item.visible ? '' : ' editor-item--hidden'}`} key={item.itemId}>
                    <header className="editor-item__header">
                      <span className="editor-item__icon"><img src={artwork.iconUrl} alt="" /></span>
                      <span><small>{String(index + 1).padStart(2, '0')} · {artwork.shortLabel}</small><strong>{section?.title}</strong></span>
                      <span className="editor-item__count">{Array.from(item.editedText).length}/120</span>
                    </header>
                    {item.needsReview && <p className="review-note"><img src={editConflictIcon} alt="" /><span><strong>需要确认</strong>{ui.editorReviewNote}</span></p>}
                    <div className="textarea-wrap">
                      <label htmlFor={`edit-${item.itemId}`}>我的表达</label>
                      <textarea id={`edit-${item.itemId}`} maxLength={120} rows={4} value={item.editedText} disabled={!item.visible} onChange={(event) => dispatch({ type: 'EDIT_ITEM', itemId: item.itemId, text: event.target.value })} />
                    </div>
                    <div className="editor-item__actions">
                      <button type="button" onClick={() => dispatch({ type: 'TOGGLE_ITEM', itemId: item.itemId })}>{item.visible ? '隐藏' : '重新显示'}</button>
                      <span className="editor-item__move-label">调整顺序</span>
                      <button type="button" aria-label={`上移：${section?.title ?? '段落'}`} disabled={index === 0} onClick={() => dispatch({ type: 'MOVE_ITEM', itemId: item.itemId, direction: -1 })}>↑</button>
                      <button type="button" aria-label={`下移：${section?.title ?? '段落'}`} disabled={index === ordered.length - 1} onClick={() => dispatch({ type: 'MOVE_ITEM', itemId: item.itemId, direction: 1 })}>↓</button>
                    </div>
                  </article>
                )
              })}
            </div>
            <div className="stacked-actions">
              <button className="button button--primary" type="button" onClick={() => dispatch({ type: 'SAVE_RESULT' })}>完成编辑，查看卡片</button>
              <button className="button button--ghost" type="button" onClick={persistNow}>暂存当前修改</button>
            </div>
          </div>
          {editorPreview && <aside className="editor-preview"><span className="pencil-label">实时预览 · 仅本机</span><RelationshipCard card={editorPreview} compact /></aside>}
        </div>
      </section>
    )
  }

  const landingCue = selectNpcCue(content, { trigger: 'landing' })
  const bindingCue = selectNpcCue(content, { trigger: 'binding' })
  let pageContent
  switch (state.page) {
    case 'landing': {
      const draftAnswers = loadedDraft.status === 'ok' ? loadedDraft.payload.answers.length : 0
      pageContent = (
        <section className="page page--landing" aria-labelledby="landing-title">
          <div className="landing-topbar"><span>RELATIONSHIP MANUAL · 01</span><span className="local-badge"><img src={localOnlyIcon} alt="" />仅保存在本设备</span></div>
          {landingCue && (
            <LandingScene
              cue={landingCue}
              title={content.meta.title}
              eyebrow={ui.landingEyebrow}
              lead={ui.landingLead}
              privacyTitle={ui.privacyTitle}
              privacyBody={ui.privacyBody}
              hasDraft={state.hasDraft}
              draftAnswers={draftAnswers}
              questionCount={questions.length}
              onRestore={restore}
              onStart={openIntro}
            />
          )}
        </section>
      )
      break
    }
    case 'intro':
      pageContent = (
        landingCue && <ContextSelectionScene
          cue={landingCue}
          eyebrow={ui.introEyebrow}
          title={ui.introTitle}
          body={ui.introBody}
          contextHint={ui.contextHint}
          options={(Object.entries(content.content.cardRules.relationshipLabels) as Array<[RelationshipContext, string]>).map(([id, label]) => ({ id, label }))}
          principlesTitle={ui.principlesTitle}
          principles={content.content.safetyRules.map((rule) => rule.label)}
          onSelect={(relationshipContext) => dispatch({ type: 'BEGIN', relationshipContext })}
          onBack={() => dispatch({ type: 'CLEAR_ALL' })}
        />
      )
      break
    case 'chapterIntro': pageContent = renderChapterIntro(); break
    case 'questionnaire': pageContent = renderQuestionnaire(); break
    case 'review': pageContent = renderReview(); break
    case 'result': pageContent = renderCardPage(false); break
    case 'editCard': pageContent = renderEditor(); break
    case 'savedResult': pageContent = renderCardPage(true); break
    case 'error':
      pageContent = <section className="page error-page paper-sheet" role="alert" aria-labelledby="error-title"><span className="error-page__mark" aria-hidden="true">!</span><p className="eyebrow">需要恢复</p><h1 id="error-title">暂时无法读取本机草稿</h1><p>{state.error ?? '内容暂时无法显示。'}</p><div className="recovery-note"><strong>当前不会自动做</strong><span>不会上传、覆盖或继续写入损坏的草稿。</span></div><button className="button button--primary" type="button" onClick={clearAll}>清除本工具数据并重新开始</button></section>
      break
  }

  return (
    <main className={`app-shell app-shell--${state.page}`}>
      {state.page !== 'landing' && state.page !== 'error' && <div className="workspace-bar"><span className="workspace-bar__brand">我希望被这样对待</span><span className="local-badge"><img src={localOnlyIcon} alt="" />仅保存在本设备</span></div>}
      {pageContent}
      {storageWarning && storageErrorCue && (
        <StorageWarning
          cue={storageErrorCue}
          backupText={sessionBackupText}
          onRetry={persistNow}
          onContinue={() => setStorageWarning(false)}
        />
      )}
      {notice && <p className="save-status" role="status"><img src={localOnlyIcon} alt="" />{notice}</p>}
      {state.page !== 'landing' && state.page !== 'error' && <footer className="app-footer"><span><img src={localOnlyIcon} alt="" />内容仅保存在本设备</span><button type="button" onClick={clearAll}>清除本工具数据</button></footer>}
    </main>
  )
}

function EmptyState({ onReset, title, body }: { onReset: () => void; title: string; body: string }) {
  return <section className="page empty-state paper-sheet" role="status"><span className="empty-state__mark" aria-hidden="true">○</span><h1>{title}</h1><p>{body}</p><button className="button button--primary" type="button" onClick={onReset}>重新开始</button></section>
}

export default App
