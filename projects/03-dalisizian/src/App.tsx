import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { resolveCharacterAsset, resolveSceneAsset } from './app/assets'
import { createCollectionStoryModel, createShareCardModel, getCollectionEntries } from './app/collection'
import { getWrappedFocusIndex } from './app/focus'
import { getCaseListItems, getDeductionEvidenceItems, getDeductionReviewModel, getInvestigationRouteItems, getLandingHeroModel, getNewEvidenceItems, getNodeDisplayText, getVerdictLabel, isClueBookOverlay, type DeductionReviewModel, type LandingHeroModel, type ReturnContext } from './app/viewModel'
import { contentIndex, contentPackage } from './content'
import type { CaseRuntimeState, ScreenState } from './content/types'
import { validateContentPackage } from './content/validate'
import { EvidenceArtifact } from './evidence/EvidenceArtifact'
import { EvidenceThumbnail } from './evidence/EvidenceThumbnail'
import { getEvidenceResourceNature } from './evidence/model'
import { calculateVerdict, chooseOption, createInitialCaseState, enterNode, markEvidenceObserved, markRouteReviewed, submitDeductionAnswer, type EngineResult } from './game/engine'
import { createIndexedDbCaseRecordStore } from './storage/indexedDb'
import { STORAGE_KEY, createDefaultSave, createResilientCaseRecordStore, loadSave, recordCaseCompletion, restoreCaseProgress, saveLauncher } from './storage/storage'
import type { CaseRecordStore, CaseVerdictRecord, ProjectSaveData } from './storage/types'
import './App.css'

const firstCase = [...contentIndex.cases.values()].sort((a, b) => a.order - b.order)[0]

const screenNames: Partial<Record<ScreenState, string>> = {
  landing: '整理案卷',
  briefing: '接案', dialogue: '问话', verdict: '初判封存', investigation: '调查', scene: '转场',
  clueBook: '证物归档', deduction: '证据推理', ending: '结案',
}

const clueCategoryLabels: Record<string, string> = {
  'direct-form': '字形实证',
  'historical-gloss': '字书旧说',
  'later-interpretation': '流传辨析',
  'modern-folk': '今人传言',
}

function unavailableRecordStore(): CaseRecordStore {
  const blocked = async () => { throw new Error('IndexedDB unavailable') }
  return { get: blocked, put: blocked, delete: blocked, clear: blocked }
}

function AssetImage({ src, alt, className, fallback }: { src?: string; alt: string; className: string; fallback: ReactNode }) {
  const [failed, setFailed] = useState(!src)
  if (failed || !src) return <>{fallback}</>
  return <img className={className} src={src} alt={alt} decoding="async" onError={() => setFailed(true)} />
}

export type LandingScreenProps = {
  model: LandingHeroModel
  title: string
  subtitle: string
  disclaimer: string
  portraitSrc?: string
  onPrimary: () => void
  onOpenCaseList: () => void
  onOpenCollection: () => void
  onOpenGuide: () => void
  onClearData: () => void
}

export function LandingScreen({ model, title, subtitle, disclaimer, portraitSrc, onPrimary, onOpenCaseList, onOpenCollection, onOpenGuide, onClearData }: LandingScreenProps) {
  return <section className="landing-screen" aria-labelledby="landing-title">
    <div className="landing-atmosphere" aria-hidden="true"><i /><i /><i /></div>
    <header className="landing-brand"><span className="brand-mark">字</span><span>大理寺 · 案牍八卷</span><small>{model.completedCount}/{model.totalCases} 已结</small></header>
    <div className="landing-title-block"><p className="eyebrow">纯选项式汉字证据推理</p><h1 id="landing-title">{title}</h1><p>{subtitle}</p></div>
    <button type="button" className="landing-companion" aria-label="听沈砚说明查案方法" onClick={onOpenGuide}>
      <span className="landing-companion-glow" aria-hidden="true" />
      <AssetImage src={portraitSrc} alt="沈砚全身立绘" className="landing-companion-portrait" fallback={<span className="landing-companion-fallback">沈砚</span>} />
      <span className="landing-companion-plaque"><small>案卷搭档</small><strong>{model.companion.name}</strong><em>{model.companion.title}</em><i>{model.companion.role}</i></span>
    </button>
    <div className="landing-desk">
      <div className="landing-current"><span>{model.primaryStatus}</span><b>{model.primaryTitle}</b></div>
      <button type="button" className="primary landing-primary" onClick={onPrimary}><span>{model.primaryLabel}</span><i aria-hidden="true">→</i></button>
      <div className="landing-secondary-actions"><button type="button" onClick={onOpenCaseList}>案卷柜</button><button type="button" onClick={onOpenCollection}>断案图鉴 <small>{model.completedCount}/{model.totalCases}</small></button></div>
      <button type="button" className="quiet landing-clear" onClick={onClearData}>清理本地案卷</button>
      <p className="landing-note">{disclaimer}</p>
    </div>
  </section>
}

function App() {
  const validation = useMemo(() => validateContentPackage(contentPackage), [])
  const loaded = useMemo(() => loadSave(window.localStorage, contentIndex, contentPackage.contentVersion), [])
  const [save, setSave] = useState<ProjectSaveData>(loaded.data)
  const [screen, setScreen] = useState<ScreenState>(validation.valid ? 'landing' : 'error')
  const [caseState, setCaseState] = useState<CaseRuntimeState>()
  const [returnContext, setReturnContext] = useState<ReturnContext>()
  const [evidenceReturnContext, setEvidenceReturnContext] = useState<ReturnContext>()
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string>()
  const [newEvidenceIds, setNewEvidenceIds] = useState<string[]>([])
  const [notice, setNotice] = useState<string | undefined>(loaded.issue)
  const [busyChoiceId, setBusyChoiceId] = useState<string>()
  const [guideOpen, setGuideOpen] = useState(false)
  const [sealActive, setSealActive] = useState(false)
  const [collectionOpen, setCollectionOpen] = useState(false)
  const [storyCaseId, setStoryCaseId] = useState<string>()
  const [verdictRecords, setVerdictRecords] = useState<Record<string, CaseVerdictRecord>>({})
  const [shareCaseId, setShareCaseId] = useState<string>()
  const [shareCaptureMode, setShareCaptureMode] = useState(false)
  const [reviewReturnNodeId, setReviewReturnNodeId] = useState<string>()
  const choiceLockRef = useRef(false)
  const returnFocusEvidenceIdRef = useRef<string | undefined>(undefined)
  const choiceTimerRef = useRef<number | undefined>(undefined)
  const sealLockRef = useRef(false)
  const sealTimerRef = useRef<number | undefined>(undefined)
  const recordStore = useMemo(() => createResilientCaseRecordStore(
    typeof window.indexedDB === 'undefined' ? unavailableRecordStore() : createIndexedDbCaseRecordStore(window.indexedDB),
    window.localStorage,
  ), [])
  const caseItems = useMemo(() => getCaseListItems(contentIndex, save), [save])
  const collectionEntries = useMemo(() => getCollectionEntries(contentIndex, save, verdictRecords), [save, verdictRecords])
  const shareCard = useMemo(() => createShareCardModel(collectionEntries.find((item) => item.caseId === shareCaseId) ?? collectionEntries[0]), [collectionEntries, shareCaseId])
  const collectionStory = useMemo(() => {
    const entry = collectionEntries.find((item) => item.caseId === storyCaseId)
    return entry ? createCollectionStoryModel(entry) : undefined
  }, [collectionEntries, storyCaseId])

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

  useEffect(() => {
    if (!guideOpen) return
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : undefined
    const sheet = document.querySelector<HTMLElement>('.guide-sheet')
    const controls = sheet ? [...sheet.querySelectorAll<HTMLElement>('button, [href], [tabindex]:not([tabindex="-1"])')] : []
    controls[0]?.focus()
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setGuideOpen(false)
        return
      }
      if (event.key !== 'Tab' || controls.length === 0) return
      event.preventDefault()
      const current = Math.max(0, controls.indexOf(document.activeElement as HTMLElement))
      controls[getWrappedFocusIndex(current, controls.length, event.shiftKey)]?.focus()
    }
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('keydown', handleKey)
      trigger?.focus()
    }
  }, [guideOpen])

  useEffect(() => {
    if (!shareCaseId) return
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : undefined
    const overlay = document.querySelector<HTMLElement>('.share-overlay')
    const controls = overlay ? [...overlay.querySelectorAll<HTMLElement>('button, [href], [tabindex]:not([tabindex="-1"])')].filter((control) => !control.hasAttribute('disabled') && control.getClientRects().length > 0) : []
    controls[0]?.focus()
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        if (shareCaptureMode) setShareCaptureMode(false)
        else setShareCaseId(undefined)
        return
      }
      if (event.key !== 'Tab' || controls.length === 0) return
      event.preventDefault()
      const current = Math.max(0, controls.indexOf(document.activeElement as HTMLElement))
      controls[getWrappedFocusIndex(current, controls.length, event.shiftKey)]?.focus()
    }
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('keydown', handleKey)
      trigger?.focus()
    }
  }, [shareCaseId, shareCaptureMode])

  useEffect(() => () => {
    if (choiceTimerRef.current !== undefined) window.clearTimeout(choiceTimerRef.current)
    if (sealTimerRef.current !== undefined) window.clearTimeout(sealTimerRef.current)
  }, [])

  useEffect(() => {
    if (screen !== 'evidenceDetail') return
    const frame = window.requestAnimationFrame(() => document.querySelector<HTMLElement>('.evidence-artifact button')?.focus())
    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setScreen(evidenceReturnContext?.screen ?? 'clueBook')
      setEvidenceReturnContext(undefined)
      const evidenceId = returnFocusEvidenceIdRef.current
      returnFocusEvidenceIdRef.current = undefined
      window.requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-evidence-trigger="${evidenceId}"]`)?.focus())
    }
    document.addEventListener('keydown', handleKey)
    return () => {
      window.cancelAnimationFrame(frame)
      document.removeEventListener('keydown', handleKey)
    }
  }, [screen, selectedEvidenceId, evidenceReturnContext])

  function applyResult(result: EngineResult): void {
    const newlyAcquired = caseState ? getNewEvidenceItems(caseState, result.state, contentIndex) : []
    setNewEvidenceIds(newlyAcquired.map((item) => item.id))
    setCaseState(result.state)
    setScreen(result.state.screen)
    if (!result.ok) setNotice(result.message)
  }

  function commitWithInk(choiceId: string, action: () => EngineResult): void {
    if (choiceLockRef.current) return
    choiceLockRef.current = true
    setBusyChoiceId(choiceId)
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    choiceTimerRef.current = window.setTimeout(() => {
      applyResult(action())
      choiceLockRef.current = false
      choiceTimerRef.current = undefined
      setBusyChoiceId(undefined)
    }, reduced ? 1 : 220)
  }

  function cancelPendingChoice(): void {
    if (choiceTimerRef.current !== undefined) window.clearTimeout(choiceTimerRef.current)
    choiceTimerRef.current = undefined
    choiceLockRef.current = false
    setBusyChoiceId(undefined)
  }

  async function openCase(caseId: string, restart: boolean): Promise<void> {
    cancelPendingChoice()
    setReviewReturnNodeId(undefined)
    setStoryCaseId(undefined)
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
    setGuideOpen(false)
    applyResult(enterNode(state, state.currentNodeId, contentIndex, save.completedCaseIds))
  }

  function choose(choiceId: string): void {
    if (!caseState) return
    commitWithInk(choiceId, () => {
      const result = chooseOption(caseState, choiceId, contentIndex, save.completedCaseIds)
      if (!result.ok || !reviewReturnNodeId) return result
      const destination = contentIndex.nodes.get(result.state.currentNodeId)
      if (destination?.kind !== 'investigation-hub') return result
      const deductionNodeId = reviewReturnNodeId
      setReviewReturnNodeId(undefined)
      return enterNode(result.state, deductionNodeId, contentIndex, save.completedCaseIds)
    })
  }

  function answer(optionId: string): void {
    if (caseState) commitWithInk(optionId, () => submitDeductionAnswer(caseState, optionId, contentIndex, save.completedCaseIds))
  }

  function reviewDeduction(model: DeductionReviewModel): void {
    if (!caseState) return
    cancelPendingChoice()
    const reviewed = model.routeId ? markRouteReviewed(caseState, model.routeId) : caseState
    setReviewReturnNodeId(caseState.currentNodeId)
    applyResult(enterNode(reviewed, model.reviewNodeId, contentIndex, save.completedCaseIds))
  }

  function openClueBook(): void {
    if (!caseState) return
    cancelPendingChoice()
    setReturnContext({ screen, nodeId: caseState.currentNodeId })
    setScreen('clueBook')
  }

  function openEvidence(evidenceId: string, context: ReturnContext): void {
    cancelPendingChoice()
    returnFocusEvidenceIdRef.current = evidenceId
    setSelectedEvidenceId(evidenceId)
    setEvidenceReturnContext(context)
    setScreen('evidenceDetail')
  }

  function closeEvidence(): void {
    if (!caseState) return
    setScreen(evidenceReturnContext?.screen ?? 'clueBook')
    setEvidenceReturnContext(undefined)
    const evidenceId = returnFocusEvidenceIdRef.current
    returnFocusEvidenceIdRef.current = undefined
    window.requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-evidence-trigger="${evidenceId}"]`)?.focus())
  }

  function closeClueBook(): void {
    if (!caseState) return
    setScreen(returnContext?.screen ?? caseState.screen)
    setReturnContext(undefined)
  }

  async function loadVerdictRecord(caseId: string): Promise<CaseVerdictRecord | undefined> {
    const stored = await recordStore.get<CaseVerdictRecord>('caseVerdicts', caseId)
    if (stored.value) setVerdictRecords((current) => ({ ...current, [caseId]: stored.value as CaseVerdictRecord }))
    if (stored.degraded && stored.issue) setNotice(stored.issue)
    return stored.value
  }

  async function openCollection(): Promise<void> {
    setStoryCaseId(undefined)
    setCollectionOpen(true)
    await Promise.all(save.completedCaseIds.map((caseId) => loadVerdictRecord(caseId)))
  }

  async function openShareCard(caseId: string): Promise<void> {
    const loadedRecord = !verdictRecords[caseId] && save.completedCaseIds.includes(caseId) ? await loadVerdictRecord(caseId) : verdictRecords[caseId]
    if (!save.bestRatings[caseId] && !loadedRecord) {
      setNotice('这宗案的详细结案记录暂不可用，可重审后重新收入图鉴。')
      return
    }
    setShareCaptureMode(false)
    setShareCaseId(caseId)
  }

  function archiveEnding(): void {
    if (!caseState || sealLockRef.current) return
    sealLockRef.current = true
    setSealActive(true)
    const verdict = calculateVerdict(caseState, contentIndex, save.completedCaseIds)
    const completedAt = new Date().toISOString()
    const finish = () => {
      const record: CaseVerdictRecord = {
        caseId: caseState.caseId, initialVerdict: caseState.initialVerdict, finalVerdict: caseState.finalVerdict,
        officialVerdict: verdict.ending.officialVerdict, score: verdict.score, rating: verdict.rating, completedAt,
        clueCount: caseState.clueIds.length, evidenceCount: caseState.evidenceIds.length,
      }
      setSave((current) => ({
        ...recordCaseCompletion(current, caseState.caseId, verdict.rating, verdict.score, verdict.unlockedCaseId, completedAt, contentIndex), currentCaseId: undefined,
      }))
      setVerdictRecords((current) => ({ ...current, [caseState.caseId]: record }))
      void recordStore.put('caseVerdicts', caseState.caseId, record)
      sealLockRef.current = false
      sealTimerRef.current = undefined
      setSealActive(false)
      setCollectionOpen(true)
      setShareCaseId(caseState.caseId)
      setScreen('caseList')
    }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    sealTimerRef.current = window.setTimeout(finish, reduced ? 120 : 720)
  }

  async function clearData(): Promise<void> {
    if (!window.confirm('确定清空《大理寺字案录》的全部本地进度吗？此操作不可撤销。')) return
    window.localStorage.removeItem(STORAGE_KEY)
    await recordStore.clear()
    setSave(createDefaultSave(firstCase.caseId))
    setCaseState(undefined)
    setNewEvidenceIds([])
    setSelectedEvidenceId(undefined)
    setEvidenceReturnContext(undefined)
    setReviewReturnNodeId(undefined)
    setVerdictRecords({})
    setCollectionOpen(false)
    setStoryCaseId(undefined)
    setShareCaseId(undefined)
    setNotice('本工具的本地进度已清空。')
    setScreen('landing')
  }

  function renderLanding() {
    const model = getLandingHeroModel(contentIndex, save, contentPackage.meta.landingUi)
    const portrait = resolveCharacterAsset(model.companion.assetId)?.master
    return <LandingScreen model={model} title={contentPackage.meta.title} subtitle={contentPackage.meta.subtitle} disclaimer={contentPackage.meta.disclaimer} portraitSrc={portrait}
      onPrimary={() => model.primaryAction === 'collection' ? void openCollection() : model.primaryCase && void openCase(model.primaryCase.caseId, false)} onOpenCaseList={() => setScreen('caseList')} onOpenCollection={() => void openCollection()} onOpenGuide={() => setGuideOpen(true)} onClearData={() => void clearData()} />
  }

  function renderCaseList() {
    const completedCount = caseItems.filter((item) => item.completed).length
    return <section className="shelf-screen" aria-labelledby="case-list-title">
      <header className="shelf-header"><button type="button" className="icon-button" aria-label="返回入口" onClick={() => setScreen('landing')}>←</button><div><p className="eyebrow">CASE ARCHIVE</p><h1 id="case-list-title">案卷柜</h1></div><span className="shelf-count">{completedCount}<small>/ 8 已结</small></span></header>
      <div className="shelf-intro"><span className="red-thread" aria-hidden="true" /><p>先记直觉，再以字形、字书与流传语境核验。错判可以回卷，证据不会消失。</p><button type="button" onClick={() => void openCollection()}>断案图鉴 <b>{completedCount}/8</b></button></div>
      <ol className="case-list">{caseItems.map((item) => <li key={item.caseId} className={`case-card ${item.unlocked ? 'is-unlocked' : 'is-locked'} ${item.completed ? 'is-complete' : ''}`}>
        <div className="case-spine"><span>{String(item.order).padStart(2, '0')}</span><i /></div><div className="case-glyph" aria-hidden="true">{item.coreCharacter}</div>
        <div className="case-copy"><div className="case-status">{item.completed ? '已归档' : item.unlocked ? '待审' : '未启封'}</div><h2>{item.title}</h2><p>{item.subtitle}</p><span className="meta-line">{item.difficulty} · 约 3–5 分钟</span></div>
        {item.completed && <span className="mini-verdict" aria-label="已结案">结</span>}
        <button type="button" disabled={!item.unlocked} onClick={() => void openCase(item.caseId, item.completed)}>{item.completed ? '重审此案' : item.unlocked ? '展开案卷' : '前案结清后启封'}<span aria-hidden="true">→</span></button>
      </li>)}</ol>
    </section>
  }

  function renderCollection() {
    if (collectionStory) return renderCollectionStory()
    const completedCount = collectionEntries.filter((item) => item.completed).length
    return <section className="collection-screen" aria-labelledby="collection-title">
      <header className="page-header collection-header"><button type="button" className="icon-button" aria-label="返回案卷柜" onClick={() => setCollectionOpen(false)}>←</button><div><p className="eyebrow">CASE COMPENDIUM</p><h1 id="collection-title">断案图鉴</h1></div><span className="collection-count">{completedCount}<small>/ 8</small></span></header>
      <div className="collection-hero"><span aria-hidden="true">鉴</span><div><b>每一宗结案，都是一次从传言回到证据。</b><p>点击已收录案卷阅读汉字故事，再生成专属战绩卡；未结案件不提前泄露判词。</p></div></div>
      <ol className="collection-grid">{collectionEntries.map((entry) => <li key={entry.caseId} className={entry.completed ? 'is-collected' : 'is-sealed'}>
        <button type="button" disabled={!entry.completed} aria-label={entry.completed ? `阅读${entry.title}汉字故事` : `第${entry.order}案尚未收录`} onClick={() => setStoryCaseId(entry.caseId)}>
          {entry.completed && <AssetImage src={entry.sceneAssetId ? resolveSceneAsset(entry.sceneAssetId) : undefined} alt="" className="collection-thumb" fallback={<span className="collection-thumb fallback" />} />}<span className="collection-shade" aria-hidden="true" />
          <span className="collection-no">卷 {String(entry.order).padStart(2, '0')}</span><span className="collection-glyph" aria-hidden="true">{entry.completed ? entry.coreCharacter : '封'}</span>
          <span className="collection-copy"><b>{entry.completed ? entry.title : '案卷未收录'}</b><small>{entry.completed ? entry.rating && entry.score !== undefined ? `${entry.rating} · ${entry.score}/100` : '结案记录待恢复' : entry.unlocked ? '待你断案' : '前案结清后启封'}</small></span>
          {entry.completed && <i aria-hidden="true">结</i>}
        </button>
      </li>)}</ol>
      <p className="collection-footnote">图鉴只读取结构化本地结案记录，不保存截图、图片或媒体数据。</p>
    </section>
  }

  function renderCollectionStory() {
    if (!collectionStory) return null
    const sceneAsset = collectionStory.sceneAssetId ? resolveSceneAsset(collectionStory.sceneAssetId) : undefined
    return <section className="collection-screen story-screen" aria-labelledby="story-title">
      <header className="page-header story-header"><button type="button" className="icon-button" aria-label="返回断案图鉴" onClick={() => setStoryCaseId(undefined)}>←</button><div><p className="eyebrow">HANZI STORY · {collectionStory.caseNumber}</p><h1 id="story-title">汉字故事卷</h1></div><span className="story-header-glyph" aria-hidden="true">{collectionStory.coreCharacter}</span></header>
      <article className="story-cover">
        <AssetImage src={sceneAsset} alt="" className="story-cover-image" fallback={<span className="story-cover-image fallback" />} /><span className="story-cover-shade" aria-hidden="true" />
        <div className="story-cover-copy"><span>结案收录 · {collectionStory.difficulty}</span><h2>{collectionStory.title}</h2><p>{collectionStory.subtitle}</p></div><i aria-hidden="true">卷宗<br />{collectionStory.caseNumber}</i>
      </article>
      <section className="story-rumor"><span className="story-section-no">起</span><div><p className="eyebrow">坊间传言</p><blockquote>{collectionStory.rumor}</blockquote><p>{collectionStory.summary}</p></div></section>
      <section className="story-findings" aria-labelledby="story-findings-title"><header><span className="story-section-no">查</span><div><p className="eyebrow">三路查证</p><h2 id="story-findings-title">证据如何改变故事</h2></div></header><ol>{collectionStory.chapters.map((chapter, index) => <li key={chapter.id}><span>{String(index + 1).padStart(2, '0')}</span><div><small>{clueCategoryLabels[chapter.category] ?? '案卷证据'}</small><h3>{chapter.title}</h3><p>{chapter.summary}</p></div></li>)}</ol></section>
      <section className="story-judgment"><div className="story-verdict-seal" aria-hidden="true">定</div><p className="eyebrow">最终判词</p><h2>{collectionStory.finalVerdictLabel}</h2><p className="story-truth">{collectionStory.verdictReason}</p><p className="story-boundary"><b>仍须留白</b>{collectionStory.uncertainty}</p><footer>{collectionStory.closingText}</footer></section>
      <section className="story-personal"><div><span>我的初判</span><b>{collectionStory.initialVerdictLabel}</b></div><i aria-hidden="true">→</i><div><span>结案评价</span><b>{collectionStory.rating ?? '记录待恢复'}{collectionStory.score !== undefined ? ` · ${collectionStory.score}/100` : ''}</b></div></section>
      {collectionStory.detailRecovered && <p className="story-recovery">本地详细初判记录已缺失；汉字故事依据正式内容与最高分安全恢复。</p>}
      <div className="story-actions"><button type="button" onClick={() => { setCollectionOpen(false); void openCase(collectionStory.caseId, true) }}>重审此案</button><button type="button" className="primary" onClick={() => void openShareCard(collectionStory.caseId)}>生成战绩卡</button></div>
    </section>
  }

  function renderShareCard() {
    if (!shareCaseId || !shareCard) return null
    const sceneAsset = shareCard.sceneAssetId ? resolveSceneAsset(shareCard.sceneAssetId) : undefined
    return <div className={`share-overlay ${shareCaptureMode ? 'is-capture' : ''}`} role="presentation" onClick={() => { if (shareCaptureMode) setShareCaptureMode(false); else setShareCaseId(undefined) }}>
      <section className="share-dialog" role="dialog" aria-modal="true" aria-labelledby="share-card-heading" onClick={(event) => event.stopPropagation()}>
        <header className="share-toolbar"><div><p className="eyebrow">CASE RESULT CARD</p><b>结案战绩卡</b></div><button type="button" className="icon-button" aria-label="关闭分享卡" onClick={() => setShareCaseId(undefined)}>×</button></header>
        <article className="share-card">
          <AssetImage key={sceneAsset ?? shareCaseId} src={sceneAsset} alt="" className="share-card-scene" fallback={<div className="share-card-scene fallback" />} /><div className="share-card-shade" />
          <header><span className="share-brand">大理寺字案录</span><span>断案图鉴 · {shareCard.caseNumber}</span></header>
          <div className="share-main"><span className="share-case-label">CASE CLOSED</span><div className="share-glyph">{shareCard.coreCharacter}</div><h2 id="share-card-heading">{shareCard.title}</h2><p>{shareCard.subtitle}</p></div>
          <div className="share-truth"><span>本案真相</span><p>{shareCard.truthHook}</p></div>
          <div className="share-signets" aria-label="关键线索">{shareCard.clueSignets.map((title, index) => <span key={title}><i aria-hidden="true">{index + 1}</i>{title}</span>)}</div>
          <div className="share-verdict"><span>初判 <b>{shareCard.initialVerdictLabel}</b></span><i aria-hidden="true">→</i><span>终判 <b>{shareCard.finalVerdictLabel}</b></span></div>
          <div className="share-rating"><div><small>断案评价</small><strong>{shareCard.rating}</strong></div><b>{shareCard.score}<small>/100</small></b></div>
          {(shareCard.clueCount !== undefined || shareCard.evidenceCount !== undefined) && <p className="share-evidence">核验线索 {shareCard.clueCount ?? '—'} · 收录证物 {shareCard.evidenceCount ?? '—'}</p>}
          <blockquote>{shareCard.shareLine}</blockquote>
          <footer><span>{shareCard.dateLabel}</span><span>DLSZ · CASE {shareCard.caseNumber}</span></footer><div className="share-stamp" aria-hidden="true">结案</div>
        </article>
        {shareCard.detailRecovered && <p className="share-recovery">详细初判记录不可用，卡片已依据最高分与正式结论安全恢复。</p>}
        <div className="share-actions"><button type="button" onClick={() => setShareCaptureMode(true)}>打开纯净大图</button><button type="button" className="primary" onClick={() => setShareCaseId(undefined)}>收下战绩卡</button></div>
        {shareCaptureMode && <p className="capture-hint">卡片已进入纯净模式 · 点击卡片外或按 Esc 返回</p>}
      </section>
    </div>
  }

  function renderClueBook() {
    if (!caseState) return null
    const caseData = contentIndex.cases.get(caseState.caseId)
    if (!caseData) return null
    const clues = caseData.clues.filter((item) => caseState.clueIds.includes(item.id))
    const items = caseState.evidenceIds.map((id) => contentIndex.evidence.get(id)).filter((item) => item !== undefined)
    return <section className="ledger-screen" aria-labelledby="clue-book-title">
      <header className="page-header"><button type="button" className="icon-button" aria-label="返回查案" onClick={closeClueBook}>←</button><div><p className="eyebrow">EVIDENCE LEDGER</p><h1 id="clue-book-title">证据簿</h1></div><span className="ledger-total">{clues.length + items.length}</span></header>
      <nav className="ledger-tabs" aria-label="证据分类"><span className="is-active">全部</span><span>事实 {clues.length}</span><span>证物 {items.length}</span></nav>
      {!clues.length && !items.length && <div className="empty-state"><span className="empty-glyph">卷</span><h2>尚无线索</h2><p>继续调查字形、字书和流传语境，所得材料会在这里归档。</p></div>}
      <div className="record-grid">{clues.map((clue, index) => <article key={clue.id} className="record-card"><span className="evidence-index">证 {String(index + 1).padStart(2, '0')}</span><p className="record-type">{clue.category}</p><h2>{clue.title}</h2><p>{clue.summary}</p><details><summary>查看可证范围</summary><p>{clue.explanation.form}</p><p>{clue.explanation.meaning}</p><p>{clue.explanation.semantics}</p><p className="uncertainty">证据边界：{clue.explanation.certainty}</p></details></article>)}</div>
      {items.length > 0 && <><h2 className="section-title">证物案签</h2><div className="evidence-list">{items.map((item) => <button key={item.id} type="button" className="evidence-ledger-card" data-evidence-trigger={item.id} onClick={() => openEvidence(item.id, { screen: 'clueBook', nodeId: caseState.currentNodeId })}><EvidenceThumbnail evidence={item} observedIds={caseState.evidenceObservationIdsByEvidenceId[item.id] ?? []} /><span className="evidence-ledger-action">打开核验 <i aria-hidden="true">→</i></span></button>)}</div></>}
    </section>
  }

  function renderEvidenceDetail() {
    const item = selectedEvidenceId ? contentIndex.evidence.get(selectedEvidenceId) : undefined
    if (!item) return <section className="empty-state standalone"><h1>证物未找到</h1><button type="button" onClick={closeEvidence}>返回上一页</button></section>
    const sources = item.sourceIds.map((id) => contentPackage.sources.find((source) => source.id === id)).filter((source) => source !== undefined)
    const observedIds = caseState?.evidenceObservationIdsByEvidenceId[item.id] ?? []
    return <article className="evidence-screen" aria-labelledby="evidence-title"><header className="page-header"><button type="button" className="icon-button" aria-label="返回上一页" onClick={closeEvidence}>←</button><div><p className="eyebrow">EVIDENCE REVIEW</p><h1 id="evidence-title">证物核验</h1></div><span className="seal-mini">{item.type}</span></header>
      <EvidenceArtifact evidence={item} sources={contentPackage.sources} observedIds={observedIds} reducedMotion={save.settings.reducedMotion} uiCopy={contentPackage.meta.evidenceUi} onObserve={(observationId) => setCaseState((current) => current ? markEvidenceObserved(current, item.id, observationId, contentIndex) : current)} />
      <div className="detail-sheet"><p className="record-type">{item.type}证据</p><h2>{item.title}</h2><p>{item.body}</p><div className="resource-disclosure"><b>{getEvidenceResourceNature(item.visualSpec, contentPackage.meta.evidenceUi)}</b><p>{contentPackage.meta.evidenceUi.reconstructionDisclosure}</p></div><div className="boundary-card"><b>证据边界</b><p>{item.visualSpec.fallbackSummary}</p></div><details><summary>来源与资源性质</summary><ul>{sources.map((source) => <li key={source.id}><span>{source.title}</span><p>{source.note}</p></li>)}</ul></details></div>
    </article>
  }

  function renderGuide() {
    if (!guideOpen) return null
    const landing = getLandingHeroModel(contentIndex, save, contentPackage.meta.landingUi)
    const activeCaseId = caseState?.caseId ?? landing.currentCase?.caseId ?? landing.primaryCase?.caseId ?? firstCase.caseId
    const caseData = contentIndex.cases.get(activeCaseId)
    const guide = contentIndex.characters.get('character-temple-official')
    const portrait = guide ? resolveCharacterAsset(guide.assetId)?.master : undefined
    return <div className="sheet-backdrop" role="presentation" onClick={() => setGuideOpen(false)}><section className="guide-sheet" role="dialog" aria-modal="true" aria-labelledby="guide-title" onClick={(event) => event.stopPropagation()}><div className="sheet-handle" /><header className="guide-hero"><div className="guide-portrait-stage"><AssetImage src={portrait} alt="沈砚半身立绘" className="guide-portrait" fallback={<span className="guide-portrait fallback">沈砚</span>} /><i aria-hidden="true">砚</i></div><div className="guide-hero-copy"><p className="eyebrow">CASE PARTNER · 案卷搭档</p><h2 id="guide-title">沈砚的案头提示</h2><span>{guide?.title ?? '大理寺录事'}</span><small>案卷在手，证据说话</small></div><button type="button" className="icon-button" aria-label="关闭帮助" onClick={() => setGuideOpen(false)}>×</button></header><div className="guide-content"><div className="guide-grid"><div><span>当前目标</span><b>{screenNames[screen] ?? '继续核验'}</b></div><div><span>关键线索</span><b>{caseState?.clueIds.length ?? 0} / {caseData?.requiredClueIds.length ?? 0}</b></div><div><span>已收证物</span><b>{caseState?.evidenceIds.length ?? 0}</b></div></div><p>先分清“材料写了什么”和“我们能推出什么”。我负责看程序，你负责下判断。</p><button type="button" className="primary" onClick={() => setGuideOpen(false)}>{caseState ? '回到当前案卷' : '回到案头'}</button></div></section></div>
  }

  function renderCase() {
    if (!caseState) return <section className="empty-state standalone"><h1>尚未选择案卷</h1><button type="button" onClick={() => setScreen('caseList')}>返回案卷柜</button></section>
    const caseData = contentIndex.cases.get(caseState.caseId), node = contentIndex.nodes.get(caseState.currentNodeId)
    if (!caseData || !node) return <section className="error-state standalone"><h1>案卷节点缺失</h1><p>已取得的证据不会被覆盖。请返回案卷柜，从最近完整节点恢复。</p><button type="button" onClick={() => setScreen('caseList')}>返回安全页</button></section>
    const speaker = node.speakerId ? contentIndex.characters.get(node.speakerId) : undefined
    const scene = caseState.currentSceneId ? contentIndex.scenes.get(caseState.currentSceneId) : undefined
    const sceneAsset = scene ? resolveSceneAsset(scene.assetId) : undefined
    const characterAsset = speaker ? resolveCharacterAsset(speaker.assetId) : undefined
    const deduction = node.deductionId ? caseData.deductions.find((item) => item.id === node.deductionId) : undefined
    const verdict = node.kind === 'ending' ? calculateVerdict(caseState, contentIndex, save.completedCaseIds) : undefined
    const progress = Math.min(100, Math.round((caseState.visitedNodeIds.length / caseData.nodeIds.length) * 100))
    const currentRoute = caseData.investigationRoutes?.find((item) => item.id === node.routeId)
    const acquiredClueIds = node.acquireClueIds ?? (node.kind === 'clue' ? currentRoute?.requiredClueIds : undefined) ?? []
    const acquiredClues = acquiredClueIds.filter((id) => caseState.clueIds.includes(id)).map((id) => contentIndex.clues.get(id)).filter((item) => item !== undefined)
    const routeItems = node.kind === 'investigation-hub' ? getInvestigationRouteItems(caseData, caseState, contentIndex) : []
    const routeEntryIds = new Set(routeItems.map((item) => item.entryNodeId))
    const deductionChoice = node.kind === 'investigation-hub' ? node.choices?.find((item) => !routeEntryIds.has(item.nextNodeId)) : undefined
    const routeChoices = node.kind === 'investigation-hub' ? new Map((node.choices ?? []).filter((item) => routeEntryIds.has(item.nextNodeId)).map((item) => [item.nextNodeId, item])) : new Map()
    const routesComplete = routeItems.length > 0 && routeItems.every((item) => item.completed)
    const reviewModel = deduction ? getDeductionReviewModel(deduction, caseState, contentIndex) : undefined
    const focusEvidence = deduction ? getDeductionEvidenceItems(deduction, caseState, contentIndex) : []
    const newEvidence = newEvidenceIds.flatMap((id) => {
      const item = contentIndex.evidence.get(id)
      return item?.caseId === caseState.caseId ? [item] : []
    })
    const options = node.kind === 'investigation-hub' ? [] : deduction?.options ?? node.choices ?? []
    return <section className={`case-shell screen-${screen}`} aria-labelledby="case-title">
      <header className="case-header"><button type="button" className="icon-button dark" aria-label="返回案卷柜" disabled={sealActive} onClick={() => { cancelPendingChoice(); setReviewReturnNodeId(undefined); setScreen('caseList') }}>←</button><div className="case-heading"><p>第 {String(caseData.order).padStart(2, '0')} 案 · {screenNames[screen] ?? caseData.difficulty}</p><h1 id="case-title">{caseData.title}</h1></div><button type="button" className="ledger-button" disabled={sealActive} onClick={openClueBook}><span>{caseState.clueIds.length}</span>证据簿</button></header>
      <div className="progress-track" aria-label={`案卷进度 ${progress}%`}><i style={{ width: `${progress}%` }} /></div>
      <div className="case-visual"><AssetImage key={sceneAsset ?? scene?.id} src={sceneAsset} alt={scene?.title ?? '案卷场景'} className="scene-image" fallback={<div className="scene-fallback"><span>{scene?.title ?? '大理寺案房'}</span><small>场景资源暂缺，案卷可继续</small></div>} /><div className="scene-shade" />
        {speaker && <AssetImage key={characterAsset?.master ?? speaker.id} src={characterAsset?.master} alt={`${speaker.name}立绘`} className={`character-image ${speaker.id === 'character-home-witness' ? 'align-right' : 'align-left'}`} fallback={<div className="character-fallback"><span>{speaker.name}</span><small>{speaker.title}</small></div>} />}
        <div className="scene-caption"><span>{scene?.title ?? '案卷流转中'}</span><small>{scene?.description ?? '正在整理下一页材料'}</small></div></div>
      <article className="dialogue-panel"><div className="paper-pin" aria-hidden="true" />
        {speaker ? <header className="nameplate"><div><strong>{speaker.name}</strong><span>{speaker.title}</span></div><small>{speaker.role}</small></header> : <p className="eyebrow node-type">{screenNames[screen] ?? '案卷记录'}</p>}
        <p className="dialogue-text">{getNodeDisplayText(node, deduction)}</p>
        {screen === 'verdict' && <div className="notice-box"><b>初判将被封存</b><span>它只用于结案比较，不会锁住证据或调查路径。</span></div>}
        {node.kind === 'investigation-hub' && <section className="investigation-board" aria-label="调查路线">
          <header><div><span>调查板</span><b>{routeItems.filter((item) => item.completed).length} / {routeItems.length} 路完成</b></div><i aria-hidden="true" /></header>
          <div className="route-grid">{routeItems.map((route, index) => { const routeChoice = routeChoices.get(route.entryNodeId); return <button key={route.id} type="button" className={`route-card accent-${route.accent} ${route.completed ? 'is-complete' : ''}`} disabled={!routeChoice || Boolean(busyChoiceId)} onClick={() => routeChoice && choose(routeChoice.id)}><span className="route-number">线 {String(index + 1).padStart(2, '0')}</span><strong>{route.title}</strong><small>{route.summary}</small><em>{route.completed ? route.clueTitles.join(' · ') || '已归档' : '待核验'}</em></button> })}</div>
          <button type="button" className={`deduction-gate ${routesComplete ? 'is-ready' : ''}`} disabled={!routesComplete || !deductionChoice || Boolean(busyChoiceId)} onClick={() => deductionChoice && choose(deductionChoice.id)}><span>{routesComplete ? '证据链已齐备' : `尚缺 ${routeItems.filter((item) => !item.completed).length} 路线索`}</span><b>{deductionChoice?.text ?? '整理证据，申请终判'}</b></button>
        </section>}
        {node.kind === 'clue' && acquiredClues.map((clue) => <div className="acquired-card" key={clue.id}><span>已归档</span><div><b>{clue.title}</b><small>{clue.summary}</small></div></div>)}
        {newEvidence.length > 0 && <section className="evidence-acquired" aria-live="polite"><header><div><span>NEW EVIDENCE</span><b>新证物入卷</b></div><button type="button" onClick={() => setNewEvidenceIds([])}>稍后再看</button></header><div>{newEvidence.map((item) => <button key={item.id} type="button" data-evidence-trigger={item.id} onClick={() => openEvidence(item.id, { screen, nodeId: caseState.currentNodeId })}><EvidenceThumbnail evidence={item} observedIds={caseState.evidenceObservationIdsByEvidenceId[item.id] ?? []} /></button>)}</div><p>点击案签检查图像，并核验两处观察点；进度会自动记入证据簿。</p></section>}
        {caseState.deductionFeedback && <div className={`feedback ${reviewModel ? 'is-broken-chain' : ''}`} role="status"><span>{reviewModel ? '证据链在这里断开' : '复核意见'}</span><p>{caseState.deductionFeedback}</p>{reviewModel && <button type="button" onClick={() => reviewDeduction(reviewModel)}>回查{reviewModel.routeTitle ? `「${reviewModel.routeTitle}」` : '相关证据'}</button>}</div>}
        {focusEvidence.length > 0 && <section className="focus-evidence" aria-label="本问关联证物"><header><span>本问证物</span><small>可随时打开复核，不会丢失当前推理</small></header><div>{focusEvidence.map(({ evidence, acquired }) => <button key={evidence.id} type="button" disabled={!acquired} data-evidence-trigger={evidence.id} onClick={() => openEvidence(evidence.id, { screen, nodeId: caseState.currentNodeId })}><EvidenceThumbnail evidence={evidence} observedIds={caseState.evidenceObservationIdsByEvidenceId[evidence.id] ?? []} /><span>{acquired ? '打开复核' : '尚未取得'}</span></button>)}</div></section>}
        {deduction && <div className="deduction-head"><span>选择成立的证据关系</span><small>错误不会清除已有证据</small></div>}
        {options.length > 0 && <div className="option-list" aria-label={deduction ? '推理选项' : '对话选项'}>{options.map((option, index) => <button key={option.id} type="button" disabled={Boolean(busyChoiceId)} className={busyChoiceId === option.id ? 'is-committing' : ''} onClick={() => deduction ? answer(option.id) : choose(option.id)}><span className="choice-index">{String(index + 1).padStart(2, '0')}</span><span>{option.text}</span><i aria-hidden="true" /></button>)}</div>}
        {verdict && <div className="ending-result"><div className={`verdict-seal ${sealActive ? 'is-active' : ''}`} aria-hidden="true">定</div><p className="seal-label">大理寺参考判词</p><h2>{verdict.ending.title}</h2><p>{verdict.ending.verdictReason}</p><div className="verdict-compare"><div><span>初判</span><b>{getVerdictLabel(caseState.initialVerdict)}</b></div><i aria-hidden="true">→</i><div><span>终判</span><b>{getVerdictLabel(caseState.finalVerdict ?? verdict.ending.officialVerdict)}</b></div></div><p className="uncertainty">争议说明：{verdict.ending.scholarlyUncertainty}</p><dl><div><dt>评价</dt><dd>{verdict.rating}</dd></div><div><dt>证据质量</dt><dd>{verdict.score} / 100</dd></div></dl><div className="score-breakdown"><b>本次成立的断案依据</b><ul>{caseData.scoringRules.filter((rule) => verdict.matchedRuleIds.includes(rule.id)).map((rule) => <li key={rule.id}><span>{rule.label}</span><em>+{rule.points}</em></li>)}</ul></div><details><summary>来源与叙事说明</summary><ul>{verdict.ending.sourceIds.map((id) => { const source = contentPackage.sources.find((item) => item.id === id); return source ? <li key={id}><span>{source.title}</span><p>{source.note}</p></li> : null })}</ul></details><p className="archive-reward">落印后收入断案图鉴，并生成专属 3:4 战绩卡。</p><button type="button" className="primary seal-button" disabled={sealActive} onClick={archiveEnding}>{sealActive ? '正在落印…' : '落印 · 收入图鉴'}</button></div>}
      </article>
      <button type="button" className="guide-button" onClick={() => setGuideOpen(true)} aria-label="召回沈砚帮助"><AssetImage src={resolveCharacterAsset('asset-character-temple-official')?.avatar} alt="" className="guide-button-avatar" fallback={<span>沈</span>} /><i aria-hidden="true">?</i></button>
    </section>
  }

  if (screen === 'error' || !validation.valid) return <main className="app-shell"><section className="error-state standalone"><p className="eyebrow">内容错误</p><h1>案卷未能读取</h1><p>内容包校验发现 {validation.issues.length} 项问题。本地进度不会被自动覆盖。</p><button type="button" onClick={() => window.location.reload()}>重新打开</button></section></main>
  return <main className="app-shell">{notice && <aside className="notice" role="status"><span>{notice}</span><button type="button" className="text-button" onClick={() => setNotice(undefined)}>知道了</button></aside>}
    {collectionOpen ? renderCollection() : <>{screen === 'landing' && renderLanding()}{screen === 'caseList' && renderCaseList()}{isClueBookOverlay(screen, returnContext) && renderClueBook()}{screen === 'evidenceDetail' && renderEvidenceDetail()}
    {(!['landing', 'caseList', 'evidenceDetail', 'error'].includes(screen) && !isClueBookOverlay(screen, returnContext)) && renderCase()}</>}{renderGuide()}{renderShareCard()}
  </main>
}

export default App
