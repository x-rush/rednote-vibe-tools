import type { ExperienceCopy } from '../content/types'

const MARKERS = ['壹', '贰', '叁']

export function IntroPage({ copy, onBack, onStart }: { copy: ExperienceCopy; onBack: () => void; onStart: () => void }) {
  return (
    <main className="page page--intro">
      <div className="paper-stack" aria-hidden="true"><span /><span /></div>
      <header className="intro-header">
        <p className="eyebrow">{copy.surfaces.introEyebrow}</p>
        <h1>{copy.surfaces.introTitle}</h1>
        <p>{copy.surfaces.introLead}</p>
      </header>

      <ol className="intro-principles">
        {copy.intro.map((item, index) => (
          <li key={item}>
            <span aria-hidden="true">{MARKERS[index]}</span>
            <p>{item}</p>
          </li>
        ))}
      </ol>

      <details className="disclosure">
        <summary>完整娱乐性说明</summary>
        <p>{copy.disclaimer}</p>
      </details>

      <p className="intro-privacy">{copy.surfaces.introPrivacy}</p>

      <nav className="button-row intro-actions" aria-label="说明页操作">
        <button type="button" className="button button--quiet" onClick={onBack}>返回封面</button>
        <button type="button" className="button button--primary" onClick={onStart}>我知道了，启程</button>
      </nav>
    </main>
  )
}
