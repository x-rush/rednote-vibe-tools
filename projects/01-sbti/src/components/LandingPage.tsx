import { useRef, useState, type MouseEvent } from 'react'
import type { ChapterCode, ExperienceCopy } from '../content/types'
import { deriveGuideMoment } from '../guide/guideMoment'
import { nextPortraitStage, type PortraitStage } from '../guide/mediaFallback'
import { isGuideUnseen, markGuideDismissed } from '../guide/guideState'
import { GuidePresence } from './guide/GuidePresence'
import { GuideSheet } from './guide/GuideSheet'

export type ContinuationInfo = {
  chapterLabel: string
  chapterId: ChapterCode
  chapterName: string
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
  const [guideStep, setGuideStep] = useState(0)
  const [guideUnseen, setGuideUnseen] = useState(() => isGuideUnseen(window.localStorage))
  const [portraitStage, setPortraitStage] = useState<PortraitStage>('master')
  const guideReturnRef = useRef<HTMLButtonElement | null>(null)
  const hasProgress = Boolean(props.continuation)
  const guideMoment = deriveGuideMoment({
    screen: 'landing',
    guideUnseen,
    introStep: guideStep,
    hasProgress,
    hasRecentResult: props.hasRecent,
    chapter: props.continuation?.chapterId,
    current: props.continuation?.current,
  })
  const guideLine = (() => {
    if (guideMoment?.kind === 'intro') return props.copy.guide.intro[guideMoment.step] ?? props.copy.guide.intro[0]
    if (guideMoment?.kind === 'landing-resume' && props.continuation) {
      return props.copy.guide.landing.resume
        .replace('{chapter}', `${props.continuation.chapterName}卷`)
        .replace('{current}', String(guideMoment.current))
    }
    if (guideMoment?.kind === 'landing-recent') return props.copy.guide.landing.recent
    return props.copy.guide.landing.fresh
  })()
  const [brandCode, brandName] = props.copy.identity.formalName.split('｜')

  function dismissGuide() {
    try { markGuideDismissed(window.localStorage) } catch { /* The guide remains optional when storage is blocked. */ }
    setGuideUnseen(false)
    setGuideOpen(false)
    window.requestAnimationFrame(() => guideReturnRef.current?.focus())
  }

  function begin(event: MouseEvent<HTMLButtonElement>) {
    if (guideUnseen) {
      guideReturnRef.current = event.currentTarget
      setGuideStep(0)
      setGuideOpen(true)
    }
    else props.onIntro()
  }

  function openGuide(trigger: HTMLButtonElement) {
    guideReturnRef.current = trigger
    setGuideStep(0)
    setGuideOpen(true)
  }

  function completeGuide() {
    if (guideStep < props.copy.guide.intro.length - 1) {
      setGuideStep((value) => value + 1)
      return
    }
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
        <h1 aria-label={props.copy.identity.formalName}><span>{brandCode}</span><i aria-hidden="true">｜</i>{brandName}</h1>
        <p className="brand-definition">{props.copy.identity.chineseMeaning}</p>
        <p className="lead">{props.copy.subtitle}</p>
      </div>

      <section className="landing-scene" aria-label={`${props.copy.guide.role}${props.copy.guide.name}`}>
        <div className="cover-visual" aria-hidden="true">
          <span className="cover-visual__moon" />
          <span className="cover-visual__stars" />
          <span className="cover-visual__ridge cover-visual__ridge--far" />
          <span className="cover-visual__ridge cover-visual__ridge--near" />
          <span className="cover-visual__mist" />
        </div>
        <div className={`landing-guide${portraitStage === 'css' ? ' landing-guide--fallback' : ''}`}>
          <div className="landing-guide__portrait" aria-hidden="true">
            {portraitStage !== 'css' && <img src={portraitStage === 'master' ? '/assets/sbti/guide/guide-master-v1.webp' : '/assets/sbti/guide/guide-placeholder-v1.webp'} alt="" width="900" height="1200" decoding="async" onError={() => setPortraitStage((stage) => nextPortraitStage(stage))} />}
            {portraitStage === 'css' && <span className="guide-ink-figure" />}
          </div>
          <GuidePresence name={props.copy.guide.name} role={props.copy.guide.role} line={guideLine} showAvatar={false} onOpen={openGuide} />
        </div>
      </section>

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

      {guideOpen && (
        <GuideSheet
          title={props.copy.guide.name}
          name={props.copy.guide.name}
          role={props.copy.guide.role}
          lines={props.copy.guide.intro}
          portrait
          step={guideStep}
          primaryLabel={guideStep === props.copy.guide.intro.length - 1 ? '收下试卷' : '下一句'}
          secondaryLabel="跳过引导"
          returnFocusRef={guideReturnRef}
          onPrimary={completeGuide}
          onSecondary={dismissGuide}
          onClose={dismissGuide}
        />
      )}
    </main>
  )
}
