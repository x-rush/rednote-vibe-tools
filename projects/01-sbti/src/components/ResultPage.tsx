import type { PersonalityType } from '../content/types'
import type { QuizResult, ShareCardViewModel } from '../quiz/types'
import { BeastPortrait } from './BeastPortrait'

type Props = { result: QuizResult; profile: PersonalityType; neighborLabel?: string; share: ShareCardViewModel; onHome: () => void; onRestart: () => void }

const DIMENSION_COPY = {
  RH: { name: '与世界相遇', left: '应世', right: '隐世' },
  TV: { name: '理解线索', left: '察微', right: '观象' },
  LE: { name: '衡量选择', left: '衡理', right: '感应' },
  SM: { name: '面对变化', left: '守形', right: '化生' },
} as const

export function ResultPage({ result, profile, neighborLabel, share, onHome, onRestart }: Props) {
  return (
    <main className="page page--result">
      <header><p className="eyebrow">你的山海兽格</p><h1>{result.summary.creatureName} · {result.summary.typeName}</h1><p className="lead">{result.summary.coreDescription}</p></header>
      <BeastPortrait code={result.code} alt={`${result.summary.creatureName}兽格画像`} />
      <section aria-labelledby="dimensions-title">
        <h2 id="dimensions-title">四维足迹</h2>
        <p className="section-intro">这些是本次选择呈现的连续倾向，不是能力分数。</p>
        <div className="dimension-list">{result.summary.dimensions.map((item) => {
          const copy = DIMENSION_COPY[item.dimension]
          const prefersLeft = item.preferredPole === item.leftPole
          return <div className="dimension" key={item.dimension}>
            <div className="dimension__heading"><strong>{copy.name}</strong><span>{prefersLeft ? copy.left : copy.right} · {item.label}</span></div>
            <div className="dimension__track" role="img" aria-label={`${copy.left}到${copy.right}，本次倾向${prefersLeft ? copy.left : copy.right}，${item.label}`}>
              <span className="dimension__center" />
              <span className={`dimension__fill dimension__fill--${prefersLeft ? 'left' : 'right'}`} style={{ width: `${Math.max(3, item.strength * 50)}%` }} />
            </div>
            <div className="dimension__poles" aria-hidden="true"><span>{copy.left}</span><span>{copy.right}</span></div>
          </div>
        })}</div>
        <aside className="neighbor-card" aria-label="相邻兽格">
          <p className="eyebrow">一线之邻</p>
          <strong>{neighborLabel ?? result.summary.neighborCode}</strong>
          <p>在你最接近中线的一维上换一种选择，可能会靠近这类倾向。主结果仍以本次完整作答为准。</p>
        </aside>
      </section>
      <section><h2>优势倾向</h2><ul>{profile.strengths.map((item) => <li key={item}>{item}</li>)}</ul></section>
      <section><h2>压力状态与容易陷入的误区</h2><p>{profile.stressState}</p><ul>{profile.blindSpots.map((item) => <li key={item}>{item}</li>)}</ul></section>
      <section><h2>相处提示</h2><ul>{profile.relationshipTips.map((item) => <li key={item}>{item}</li>)}</ul><h2>自我照顾</h2><ul>{profile.selfCareTips.map((item) => <li key={item}>{item}</li>)}</ul></section>
      <section><h2>原典与创作边界</h2><h3>典籍记录</h3><p>{profile.classicalNote}</p><h3>SBTI 创意解读</h3><p>{profile.creativeNote}</p></section>
      <article className="share-card" aria-label="分享卡片预览"><p>{share.title}</p><strong>{share.line}</strong><small>{share.code} · {share.disclaimer}</small></article>
      <p className="disclaimer">{profile.disclaimer}</p>
      <nav className="button-row" aria-label="结果页操作"><button type="button" className="button button--quiet" onClick={onHome}>返回首页</button><button type="button" className="button button--primary" onClick={onRestart}>重新测评</button></nav>
    </main>
  )
}
