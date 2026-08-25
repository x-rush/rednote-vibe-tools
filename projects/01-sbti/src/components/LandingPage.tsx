import { useRef, useState, type MouseEvent } from 'react'
import type { ExperienceCopy } from '../content/types'
import { isGuideUnseen, markGuideDismissed } from '../guide/guideState'
import { GuideAvatarButton } from './guide/GuideAvatarButton'
import { GuideIntro } from './guide/GuideIntro'

export type ContinuationInfo = {
  chapterLabel: string
  current: number
  total: number
  updatedAt?: string
}

type Props = {
  copy: ExperienceCopy
  continuation?: ContinuationInfo
  hasRecent: boolean
  muted: boolean
  reducedMotion: boolean
  onIntro: () => void
  onRestart: () => void
  onContinue: () => void
  onHistory: () => void
  onMuted: (value: boolean) => void
  onReducedMotion: (value: boolean) => void
  onClear: () => void
}

function formatSavedAt(value?: string) {
  if (!value) return '本次进度已在本机收卷'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '本次进度已在本机收卷'
  return `上次收卷 ${new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date)}`
}

export function LandingPage(props: Props) {
  const [guideOpen, setGuideOpen] = useState(false)
  const [guideUnseen, setGuideUnseen] = useState(() => isGuideUnseen(window.localStorage))
  const guideReturnRef = useRef<HTMLButtonElement | null>(null)
  const hasProgress = Boolean(props.continuation)

  function dismissGuide() {
    try { markGuideDismissed(window.localStorage) } catch { /* The guide remains optional when storage is blocked. */ }
    setGuideUnseen(false)
    setGuideOpen(false)
    window.requestAnimationFrame(() => guideReturnRef.current?.focus())
  }

  function begin(event: MouseEvent<HTMLButtonElement>) {
    if (guideUnseen) {
      guideReturnRef.current = event.currentTarget
      setGuideOpen(true)
    }
    else props.onIntro()
  }

  function openGuide(trigger: HTMLButtonElement) {
    guideReturnRef.current = trigger
    setGuideOpen(true)
  }

  function completeGuide() {
    try { markGuideDismissed(window.localStorage) } catch { /* Continue without persistence. */ }
    setGuideUnseen(false)
    setGuideOpen(false)
    props.onIntro()
  }

  return (
    <main className="page page--landing">
      <div className="landing-masthead" aria-label="山海司夜读卷封面">
        <div className="brand-lockup">
          <span className="brand-seal" aria-hidden="true">{props.copy.surfaces.brandSeal}</span>
          <p className="eyebrow eyebrow--night">{props.copy.surfaces.landingEyebrow}</p>
        </div>
        <h1><span>{props.copy.surfaces.brandCode}</span>{props.copy.surfaces.brandName}</h1>
        <p className="lead">{props.copy.subtitle}</p>
      </div>

      <div className="cover-visual" aria-hidden="true">
        <span className="cover-visual__moon" />
        <span className="cover-visual__ridge cover-visual__ridge--far" />
        <span className="cover-visual__gate"><i /></span>
        <span className="cover-visual__ridge cover-visual__ridge--near" />
        <span className="cover-visual__mist" />
      </div>

      <section className={`entry-panel${hasProgress ? ' entry-panel--continue' : ''}`} aria-labelledby="entry-title">
        {props.continuation ? (
          <>
            <p className="entry-panel__kicker">{props.copy.surfaces.landingContinueKicker}</p>
            <h2 id="entry-title">继续{props.continuation.chapterLabel}</h2>
            <p className="entry-panel__progress">第 {props.continuation.current} / {props.continuation.total} 题</p>
            <p className="entry-panel__saved">
              <time dateTime={props.continuation.updatedAt}>{formatSavedAt(props.continuation.updatedAt)}</time>
            </p>
            <button type="button" className="button button--primary button--wide" onClick={props.onContinue}>继续上次入山</button>
            <div className="entry-panel__secondary">
              <button type="button" className="text-button text-button--night" onClick={props.onRestart}>重新开始</button>
              {props.hasRecent && <button type="button" className="text-button text-button--night" onClick={props.onHistory}>最近结果</button>}
            </div>
          </>
        ) : (
          <>
            <p className="entry-panel__kicker">{props.copy.surfaces.landingFreshKicker}</p>
            <h2 id="entry-title">{props.copy.surfaces.landingQuestion}</h2>
            <p className="entry-panel__meta">{props.copy.surfaces.landingMeta}</p>
            <button type="button" className="button button--primary button--wide" onClick={begin}>入山寻兽格</button>
            <div className="entry-panel__secondary">
              <button type="button" className="text-button text-button--night" onClick={props.onIntro}>测评说明</button>
              {props.hasRecent && <button type="button" className="text-button text-button--night" onClick={props.onHistory}>最近结果</button>}
            </div>
          </>
        )}
      </section>

      <GuideAvatarButton copy={props.copy.guide} onOpen={openGuide} />

      <details className="settings-sheet">
        <summary><span>卷尾设置</span><small>声音、动态与本机数据</small></summary>
        <div className="settings-sheet__body">
          <label className="setting-row">
            <span><strong>声音</strong><small>{props.muted ? '已静音' : '声音开启'}</small></span>
            <input type="checkbox" checked={props.muted} onChange={(event) => props.onMuted(event.target.checked)} aria-label="静音" />
          </label>
          <label className="setting-row">
            <span><strong>动态效果</strong><small>{props.reducedMotion ? '已减少动态' : '标准动态'}</small></span>
            <input type="checkbox" checked={props.reducedMotion} onChange={(event) => props.onReducedMotion(event.target.checked)} aria-label="减少动态效果" />
          </label>
          <div className="settings-sheet__note">
            <strong>关于这卷</strong>
            <p>{props.copy.disclaimer}</p>
          </div>
          <button type="button" className="text-button text-button--danger" onClick={props.onClear}>清空本工具数据</button>
        </div>
      </details>

      <p className="landing-footnote">{props.copy.surfaces.landingFootnote}</p>

      {guideOpen && <GuideIntro copy={props.copy.guide} onDismiss={dismissGuide} onComplete={completeGuide} />}
    </main>
  )
}
