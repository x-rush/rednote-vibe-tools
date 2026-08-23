import type { ExperienceCopy } from '../content/types'

type Props = {
  copy: ExperienceCopy
  canContinue: boolean
  hasRecent: boolean
  muted: boolean
  reducedMotion: boolean
  onIntro: () => void
  onContinue: () => void
  onHistory: () => void
  onMuted: (value: boolean) => void
  onReducedMotion: (value: boolean) => void
  onClear: () => void
}

export function LandingPage(props: Props) {
  return (
    <main className="page page--landing">
      <header className="hero">
        <p className="eyebrow">娱乐性山海人格内容</p>
        <h1>{props.copy.title}</h1>
        <p className="lead">{props.copy.subtitle}</p>
        <p className="meta">{props.copy.duration}</p>
      </header>
      <nav className="action-stack" aria-label="测评入口">
        {props.canContinue && <button type="button" className="button button--primary" onClick={props.onContinue}>继续上次</button>}
        <button type="button" className={props.canContinue ? 'button' : 'button button--primary'} onClick={props.onIntro}>开始入境</button>
        <button type="button" className="button button--quiet" onClick={props.onHistory}>{props.hasRecent ? '查看最近结果' : '结果记录'}</button>
      </nav>
      <details className="settings">
        <summary>设置与本机数据</summary>
        <label><input type="checkbox" checked={props.muted} onChange={(event) => props.onMuted(event.target.checked)} /> 静音</label>
        <label><input type="checkbox" checked={props.reducedMotion} onChange={(event) => props.onReducedMotion(event.target.checked)} /> 减少动态效果</label>
        <button type="button" className="text-button" onClick={props.onClear}>清空本工具数据</button>
      </details>
      <p className="disclaimer">{props.copy.disclaimer}</p>
    </main>
  )
}

