import { useRef, useState } from 'react'
import type { BrandIdentityCopy, DimensionDefinition, GuideCopy, PersonalityType } from '../content/types'
import { deriveGuideMoment } from '../guide/guideMoment'
import type { QuizResult, ShareCardViewModel } from '../quiz/types'
import { formatResultIdentity, toDimensionDisplay } from '../quiz/presentation'
import { BeastPortrait } from './BeastPortrait'
import { GuidePresence } from './guide/GuidePresence'
import { GuideTopicSheet } from './guide/GuideTopicSheet'

type Props = { result: QuizResult; profile: PersonalityType; neighborLabel: string; share: ShareCardViewModel; guide: GuideCopy; identity: BrandIdentityCopy; dimensionDefinitions: DimensionDefinition[]; onHome: () => void; onRestart: () => void }

export function ResultPage({ result, profile, neighborLabel, share, guide, identity, dimensionDefinitions, onHome, onRestart }: Props) {
  const [helpOpen, setHelpOpen] = useState(false)
  const guideReturnRef = useRef<HTMLButtonElement | null>(null)
  const guideMoment = deriveGuideMoment({ screen: 'result', requestedHelp: helpOpen ? 'result' : undefined })
  return (
    <main className="page page--result" data-state="revealed">
      <header className="result-hero"><p className="eyebrow">你的山海兽格</p><h1>{formatResultIdentity(result.summary.creatureName, result.summary.typeName)}</h1><p className="lead">{result.summary.coreDescription}</p></header>
      <BeastPortrait code={result.code} alt={`${result.summary.creatureName}兽格画像`} />
      <blockquote className="wenshan-note"><span>闻山批注</span><p>{profile.wenshanNote}</p></blockquote>
      <GuidePresence
        name={guide.name}
        role={guide.role}
        line={guide.resultHelp.prompt}
        compact
        onOpen={(trigger) => {
          guideReturnRef.current = trigger
          setHelpOpen(true)
        }}
      />

      <section className="result-volume" aria-labelledby="portrait-title">
        <div className="volume-heading" aria-label="卷一 · 本相"><span>卷一</span><div><p>本相</p><h2 id="portrait-title">你如何成为现在的你</h2></div></div>
        <div className="long-portrait">{profile.longPortrait.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div>
        <div className="insight-grid">
          <article><span>内在驱力</span><p>{profile.innerDrive}</p></article>
          <article><span>容易被误读为</span><p>{profile.misreadAs}</p></article>
        </div>
      </section>

      <section className="result-volume" aria-labelledby="dimensions-title">
        <div className="volume-heading" aria-label="卷二 · 四衡"><span>卷二</span><div><p>四衡</p><h2 id="dimensions-title">四维足迹</h2></div></div>
        <p className="section-intro">这些是本次选择呈现的连续倾向，不是能力分数。</p>
        <div className="dimension-list">{result.summary.dimensions.map((item) => {
          const definition = dimensionDefinitions.find((candidate) => candidate.code === item.dimension)!
          const copy = toDimensionDisplay(item, definition)
          const prefersLeft = item.preferredPole === item.leftPole
          const preferredPole = definition.poles.find((pole) => pole.code === item.preferredPole)!
          return <article className="dimension" key={item.dimension}>
            <div className="dimension__heading"><strong>{copy.title}</strong><span>{copy.preferred} · {copy.strengthLabel}</span></div>
            <div className="dimension__track" role="img" aria-label={`${copy.left}到${copy.right}，本次倾向${copy.preferred}，${copy.strengthLabel}`}>
              <span className="dimension__center" />
              <span className={`dimension__fill dimension__fill--${prefersLeft ? 'left' : 'right'}`} style={{ width: `${Math.max(3, item.strength * 50)}%` }} />
            </div>
            <div className="dimension__poles" aria-hidden="true"><span>{copy.left}</span><span>{copy.right}</span></div>
            <p className="dimension__reading">{preferredPole.definition}</p>
            <p className="dimension__boundary"><strong>这不意味着：</strong>{preferredPole.nonMeaning}</p>
          </article>
        })}</div>
      </section>

      <section className="result-volume" aria-labelledby="journey-title">
        <div className="volume-heading" aria-label="卷三 · 天赋与行旅"><span>卷三</span><div><p>天赋与行旅</p><h2 id="journey-title">你把什么带进山海</h2></div></div>
        <ul className="strength-seals" aria-label="优势倾向">{profile.strengths.map((item, index) => <li key={item}><span>{index + 1}</span>{item}</li>)}</ul>
        <div className="scene-list">
          <article><span>初入陌生山境</span><p>{profile.journeyScenes.arrival}</p></article>
          <article><span>与同伴意见相左</span><p>{profile.journeyScenes.disagreement}</p></article>
          <article><span>计划突然改变</span><p>{profile.journeyScenes.change}</p></article>
        </div>
      </section>

      <section className="result-volume" aria-labelledby="relationship-title">
        <div className="volume-heading" aria-label="卷四 · 同行之道"><span>卷四</span><div><p>同行之道</p><h2 id="relationship-title">关系里的给予与需要</h2></div></div>
        <ul className="result-advice-list">{profile.relationshipTips.map((item) => <li key={item}>{item}</li>)}</ul>
        <article className="need-card"><span>你也需要</span><p>{profile.relationshipNeed}</p></article>
      </section>

      <section className="result-volume result-volume--storm" aria-labelledby="growth-title">
        <div className="volume-heading" aria-label="卷五 · 风浪与回山"><span>卷五</span><div><p>风浪与回山</p><h2 id="growth-title">压力来临时的辨认</h2></div></div>
        <p className="stress-copy">{profile.stressState}</p>
        <ul className="blind-spot-list">{profile.blindSpots.map((item) => <li key={item}>{item}</li>)}</ul>
        <article className="growth-card"><span>回山练习</span><p>{profile.growthPractice}</p></article>
        <div className="self-care"><strong>自我照顾</strong><ul>{profile.selfCareTips.map((item) => <li key={item}>{item}</li>)}</ul></div>
      </section>

      <section className="result-volume" aria-labelledby="source-title">
        <div className="volume-heading" aria-label="卷六 · 原典与创作"><span>卷六</span><div><p>原典与创作</p><h2 id="source-title">异兽为何与你同行</h2></div></div>
        <article className="source-layer"><span>典籍记录</span><p>{profile.classicalNote}</p></article>
        <article className="source-layer source-layer--creative"><span>山海兽格创意解读</span><p>{profile.creativeNote}</p></article>
        <aside className="neighbor-card" aria-label="相邻兽格">
          <p className="eyebrow">卷尾 · 一线之邻</p>
          <strong>{neighborLabel}</strong>
          <p>在你最接近中线的一维上换一种选择，可能会靠近这类倾向。主结果仍以本次完整作答为准。</p>
        </aside>
      </section>

      <article className="share-card share-talisman" aria-label="可分享兽志签">
        <div className="share-talisman__heading"><span>可分享兽志签</span><p>{share.title}</p></div>
        <strong>{share.line}</strong>
        <ul>{profile.shareQuotes.map((quote) => <li key={quote}>{quote}</li>)}</ul>
        <div className="share-talisman__poles">{result.summary.dimensions.map((item) => {
          const definition = dimensionDefinitions.find((candidate) => candidate.code === item.dimension)!
          const preferred = definition.poles.find((pole) => pole.code === item.preferredPole)!
          return <span key={item.dimension}>{preferred.name}</span>
        })}</div>
        <small>{share.disclaimer}</small>
      </article>
      <p className="disclaimer">{profile.disclaimer}</p>
      <aside className="result-identity" aria-label="关于山海兽格测试"><strong>{identity.chineseMeaning}</strong><p>{identity.boundary}</p></aside>
      <nav className="button-row" aria-label="结果页操作"><button type="button" className="button button--quiet" onClick={onHome}>返回首页</button><button type="button" className="button button--primary" onClick={onRestart}>重新测评</button></nav>
      {guideMoment?.kind === 'result-help' && (
        <GuideTopicSheet
          title={guide.resultHelp.title}
          name={guide.name}
          role={guide.role}
          topics={guide.resultHelp.topics}
          returnFocusRef={guideReturnRef}
          onClose={() => setHelpOpen(false)}
        />
      )}
    </main>
  )
}
