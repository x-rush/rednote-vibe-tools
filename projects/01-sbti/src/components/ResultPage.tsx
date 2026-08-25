import type { PersonalityType } from '../content/types'
import type { QuizResult, ShareCardViewModel } from '../quiz/types'
import { BeastPortrait } from './BeastPortrait'

type Props = { result: QuizResult; profile: PersonalityType; share: ShareCardViewModel; onHome: () => void; onRestart: () => void }

export function ResultPage({ result, profile, share, onHome, onRestart }: Props) {
  return (
    <main className="page page--result">
      <header><p className="eyebrow">你的山海兽格</p><h1>{result.summary.creatureName} · {result.summary.typeName}</h1><p className="lead">{result.summary.coreDescription}</p></header>
      <BeastPortrait code={result.code} alt={`${result.summary.creatureName}兽格画像`} />
      <section aria-labelledby="dimensions-title"><h2 id="dimensions-title">四维足迹</h2><div className="dimension-list">{result.summary.dimensions.map((item) => <div className="dimension" key={item.dimension}><div><strong>{item.dimension}</strong><span>{item.preferredPole} · {item.label}</span></div><meter min="0" max="1" value={item.strength}>{Math.round(item.strength * 100)}%</meter></div>)}</div><p>相邻兽格：{result.summary.neighborCode}</p></section>
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
