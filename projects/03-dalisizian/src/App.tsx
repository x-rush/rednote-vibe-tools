import { useEffect, useMemo, useState } from 'react'
import { getCaseListItems, isClueBookOverlay, type ReturnContext } from './app/viewModel'
import { contentIndex, contentPackage } from './content'
import type { CaseRuntimeState, ScreenState } from './content/types'
import { validateContentPackage } from './content/validate'
import { calculateVerdict, chooseOption, createInitialCaseState, enterNode, submitDeductionAnswer, type EngineResult } from './game/engine'
import { createIndexedDbCaseRecordStore } from './storage/indexedDb'
import { STORAGE_KEY, createDefaultSave, createResilientCaseRecordStore, loadSave, recordCaseCompletion, restoreCaseProgress, saveLauncher } from './storage/storage'
import type { CaseRecordStore, ProjectSaveData } from './storage/types'
import './App.css'

const firstCase = [...contentIndex.cases.values()].sort((a, b) => a.order - b.order)[0]

function unavailableRecordStore(): CaseRecordStore {
  const blocked = async () => { throw new Error('IndexedDB unavailable') }
  return { get: blocked, put: blocked, delete: blocked, clear: blocked }
}

function App() {
  const validation = useMemo(() => validateContentPackage(contentPackage), [])
  const loaded = useMemo(() => loadSave(window.localStorage, contentIndex, contentPackage.contentVersion), [])
  const [save, setSave] = useState<ProjectSaveData>(loaded.data)
  const [screen, setScreen] = useState<ScreenState>(validation.valid ? 'landing' : 'error')
  const [caseState, setCaseState] = useState<CaseRuntimeState>()
  const [returnContext, setReturnContext] = useState<ReturnContext>()
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string>()
  const [notice, setNotice] = useState<string | undefined>(loaded.issue)
  const recordStore = useMemo(() => createResilientCaseRecordStore(
    typeof window.indexedDB === 'undefined' ? unavailableRecordStore() : createIndexedDbCaseRecordStore(window.indexedDB),
    window.localStorage,
  ), [])
  const caseItems = useMemo(() => getCaseListItems(contentIndex, save), [save])

  useEffect(() => {
    const result = saveLauncher(window.localStorage, save, contentPackage.contentVersion)
    if (!result.ok) queueMicrotask(() => setNotice(result.issue))
  }, [save])

  useEffect(() => {
    if (!caseState) return
    void recordStore.put('caseProgress', caseState.caseId, caseState).then((result) => {
      if (result.degraded) setNotice(result.issue)
    }).catch(() => setNotice('案件进度未能写入本地存储。'))
  }, [caseState, recordStore])

  function applyResult(result: EngineResult): void {
    setCaseState(result.state)
    setScreen(result.state.screen)
    if (!result.ok) setNotice(result.message)
  }

  async function openCase(caseId: string, restart: boolean): Promise<void> {
    const caseData = contentIndex.cases.get(caseId)
    if (!caseData || !save.unlockedCaseIds.includes(caseId)) return
    let state = createInitialCaseState(caseData)
    if (!restart) {
      const stored = await recordStore.get<CaseRuntimeState>('caseProgress', caseId)
      if (stored.value) {
        const restored = restoreCaseProgress(stored.value, caseData, contentIndex)
        state = restored.data
        if (restored.issue) setNotice(restored.issue)
      }
      if (stored.degraded) setNotice(stored.issue)
    }
    setSave((current) => ({ ...current, currentCaseId: caseId }))
    applyResult(enterNode(state, state.currentNodeId, contentIndex, save.completedCaseIds))
  }

  function choose(choiceId: string): void {
    if (caseState) applyResult(chooseOption(caseState, choiceId, contentIndex, save.completedCaseIds))
  }

  function answer(optionId: string): void {
    if (caseState) applyResult(submitDeductionAnswer(caseState, optionId, contentIndex, save.completedCaseIds))
  }

  function openClueBook(): void {
    if (!caseState) return
    setReturnContext({ screen, nodeId: caseState.currentNodeId })
    setScreen('clueBook')
  }

  function closeClueBook(): void {
    if (!caseState) return
    setScreen(returnContext?.screen ?? caseState.screen)
    setReturnContext(undefined)
  }

  function archiveEnding(): void {
    if (!caseState) return
    const verdict = calculateVerdict(caseState, contentIndex, save.completedCaseIds)
    const completedAt = new Date().toISOString()
    setSave((current) => ({
      ...recordCaseCompletion(current, caseState.caseId, verdict.rating, verdict.score, verdict.unlockedCaseId, completedAt, contentIndex),
      currentCaseId: undefined,
    }))
    void recordStore.put('caseVerdicts', caseState.caseId, {
      caseId: caseState.caseId, initialVerdict: caseState.initialVerdict, finalVerdict: caseState.finalVerdict,
      officialVerdict: verdict.ending.officialVerdict, score: verdict.score, rating: verdict.rating, completedAt,
    })
    setScreen('caseList')
  }

  async function clearData(): Promise<void> {
    if (!window.confirm('确定清空《大理寺字案录》的全部本地进度吗？此操作不可撤销。')) return
    window.localStorage.removeItem(STORAGE_KEY)
    await recordStore.clear()
    setSave(createDefaultSave(firstCase.caseId))
    setCaseState(undefined)
    setNotice('本工具的本地进度已清空。')
    setScreen('landing')
  }

  function renderLanding() {
    return <section className="landing-panel" aria-labelledby="landing-title">
      <p className="eyebrow">纯选项式汉字查案</p><h1 id="landing-title">{contentPackage.meta.title}</h1>
      <p className="subtitle">{contentPackage.meta.subtitle}</p><p>{contentPackage.meta.disclaimer}</p>
      <div className="action-stack">
        {save.currentCaseId && <button type="button" className="primary" onClick={() => void openCase(save.currentCaseId as string, false)}>继续上次案卷</button>}
        <button type="button" onClick={() => setScreen('caseList')}>进入案卷柜</button>
        <button type="button" className="quiet" onClick={() => void clearData()}>清空本地进度</button>
      </div>
    </section>
  }

  function renderCaseList() {
    return <section aria-labelledby="case-list-title">
      <header className="page-header"><button type="button" className="text-button" onClick={() => setScreen('landing')}>返回入口</button><h1 id="case-list-title">案卷柜</h1></header>
      <ol className="case-list">{caseItems.map((item) => <li key={item.caseId} className="case-card">
        <div className="case-number" aria-hidden="true">{item.order}</div><div><p className="case-character">{item.coreCharacter}</p><h2>{item.title}</h2><p>{item.subtitle}</p>
        <p className="meta-line">{item.difficulty} · {item.completed ? `已结案${item.bestRating ? ` · ${item.bestRating}` : ''}` : item.unlocked ? '待查' : '未解锁'}</p></div>
        <button type="button" disabled={!item.unlocked} onClick={() => void openCase(item.caseId, item.completed)}>{item.completed ? '重审此案' : item.unlocked ? '展开案卷' : '前案结清后解锁'}</button>
      </li>)}</ol>
    </section>
  }

  function renderClueBook() {
    if (!caseState) return null
    const caseData = contentIndex.cases.get(caseState.caseId)
    if (!caseData) return null
    const clues = caseData.clues.filter((item) => caseState.clueIds.includes(item.id))
    const items = caseState.evidenceIds.map((id) => contentIndex.evidence.get(id)).filter((item) => item !== undefined)
    return <section aria-labelledby="clue-book-title">
      <header className="page-header"><button type="button" className="text-button" onClick={closeClueBook}>返回查案</button><h1 id="clue-book-title">线索簿</h1></header>
      {!clues.length && <div className="empty-state"><h2>尚无线索</h2><p>继续调查字形、字书和流传语境，所得线索会在此归档。</p></div>}
      <div className="record-grid">{clues.map((clue) => <article key={clue.id} className="record-card"><p className="record-type">{clue.category}</p><h2>{clue.title}</h2><p>{clue.summary}</p><details><summary>字形、字义与语义说明</summary><p>{clue.explanation.form}</p><p>{clue.explanation.meaning}</p><p>{clue.explanation.semantics}</p><p className="uncertainty">证据边界：{clue.explanation.certainty}</p></details></article>)}</div>
      <h2>证物</h2><div className="evidence-list">{items.map((item) => <button key={item.id} type="button" onClick={() => { setSelectedEvidenceId(item.id); setScreen('evidenceDetail') }}><span>{item.type}</span>{item.title}</button>)}</div>
    </section>
  }

  function renderEvidenceDetail() {
    const item = selectedEvidenceId ? contentIndex.evidence.get(selectedEvidenceId) : undefined
    if (!item) return <section className="empty-state"><h1>证物未找到</h1><button type="button" onClick={() => setScreen('clueBook')}>返回线索簿</button></section>
    return <article className="detail-sheet"><button type="button" className="text-button" onClick={() => setScreen('clueBook')}>返回线索簿</button><p className="record-type">{item.type}</p><h1>{item.title}</h1><p>{item.body}</p><dl><div><dt>未来资源 ID</dt><dd>{item.assetId}</dd></div><div><dt>内容版本</dt><dd>{item.contentVersion}</dd></div></dl></article>
  }

  function renderCase() {
    if (!caseState) return <section className="empty-state"><h1>尚未选择案卷</h1><button type="button" onClick={() => setScreen('caseList')}>返回案卷柜</button></section>
    const caseData = contentIndex.cases.get(caseState.caseId), node = contentIndex.nodes.get(caseState.currentNodeId)
    if (!caseData || !node) return <section className="error-state"><h1>案卷节点缺失</h1><p>当前进度无法继续，可返回案卷柜重审本案。</p><button type="button" onClick={() => setScreen('caseList')}>返回案卷柜</button></section>
    const speaker = node.speakerId ? contentIndex.characters.get(node.speakerId) : undefined
    const deduction = node.deductionId ? caseData.deductions.find((item) => item.id === node.deductionId) : undefined
    const verdict = node.kind === 'ending' ? calculateVerdict(caseState, contentIndex, save.completedCaseIds) : undefined
    return <section className="case-shell" aria-labelledby="case-title">
      <header className="case-header"><button type="button" className="text-button" onClick={() => setScreen('caseList')}>案卷柜</button><div><p>第 {caseData.order} 案 · {caseData.difficulty}</p><h1 id="case-title">{caseData.title}</h1></div><button type="button" className="text-button" onClick={openClueBook}>线索 {caseState.clueIds.length}/{caseData.clues.length}</button></header>
      {caseState.currentSceneId && <p className="scene-label">{contentIndex.scenes.get(caseState.currentSceneId)?.title}</p>}
      <article className="dialogue-panel">{speaker && <header className="nameplate"><strong>{speaker.name}</strong><span>{speaker.title}</span></header>}<p className="dialogue-text">{node.text}</p>
        {caseState.deductionFeedback && <p className="feedback" role="status">{caseState.deductionFeedback}</p>}
        {deduction ? <div className="option-list" aria-label="推理选项">{deduction.options.map((option) => <button key={option.id} type="button" onClick={() => answer(option.id)}>{option.text}</button>)}</div> : node.choices && <div className="option-list" aria-label="对话选项">{node.choices.map((choice) => <button key={choice.id} type="button" onClick={() => choose(choice.id)}>{choice.text}</button>)}</div>}
        {verdict && <div className="ending-result"><p className="seal-label">大理寺参考判词</p><h2>{verdict.ending.title}</h2><p>{verdict.ending.verdictReason}</p><p className="uncertainty">争议说明：{verdict.ending.scholarlyUncertainty}</p><dl><div><dt>评价</dt><dd>{verdict.rating}</dd></div><div><dt>得分</dt><dd>{verdict.score} / 100</dd></div></dl><details><summary>来源与叙事说明</summary><ul>{verdict.ending.sourceIds.map((id) => { const source = contentPackage.sources.find((item) => item.id === id); return source ? <li key={id}>{source.url ? <a href={source.url} target="_blank" rel="noreferrer">{source.title}</a> : source.title}<p>{source.note}</p></li> : null })}</ul></details><button type="button" className="primary" onClick={archiveEnding}>归档结案</button></div>}
      </article>
    </section>
  }

  if (screen === 'error' || !validation.valid) return <main className="app-shell"><section className="error-state"><p className="eyebrow">内容错误</p><h1>案卷未能读取</h1><p>内容包校验发现 {validation.issues.length} 项问题。请重新打开；本地进度不会被自动覆盖。</p><button type="button" onClick={() => window.location.reload()}>重新打开</button></section></main>
  return <main className="app-shell">
    {notice && <aside className="notice" role="status"><span>{notice}</span><button type="button" className="text-button" onClick={() => setNotice(undefined)}>知道了</button></aside>}
    {screen === 'landing' && renderLanding()}{screen === 'caseList' && renderCaseList()}{isClueBookOverlay(screen, returnContext) && renderClueBook()}{screen === 'evidenceDetail' && renderEvidenceDetail()}
    {(!['landing', 'caseList', 'evidenceDetail', 'error'].includes(screen) && !isClueBookOverlay(screen, returnContext)) && renderCase()}
  </main>
}

export default App
