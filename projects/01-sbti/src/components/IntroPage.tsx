import type { ExperienceCopy } from '../content/types'

export function IntroPage({ copy, onBack, onStart }: { copy: ExperienceCopy; onBack: () => void; onStart: () => void }) {
  return (
    <main className="page">
      <header><p className="eyebrow">入境说明</p><h1>在选择之前</h1></header>
      <ul className="intro-list">{copy.intro.map((item) => <li key={item}>{item}</li>)}</ul>
      <aside className="notice" aria-label="娱乐性说明">{copy.disclaimer}</aside>
      <nav className="button-row" aria-label="说明页操作">
        <button type="button" className="button button--quiet" onClick={onBack}>返回首页</button>
        <button type="button" className="button button--primary" onClick={onStart}>生成本轮题目</button>
      </nav>
    </main>
  )
}

