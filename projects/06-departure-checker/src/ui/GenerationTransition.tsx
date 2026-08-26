export function GenerationTransition() {
  return (
    <main className="app-shell generating-screen">
      <section aria-live="polite">
        <div className="generation-mark" aria-hidden="true">理</div>
        <p className="eyebrow">完全在本机完成</p>
        <h1>正在排好检查顺序</h1>
        <p className="lede">不联网，也不会读取定位。</p>
        <ol className="generation-steps">
          <li>基础项已找到</li>
          <li>条件项已加入</li>
          <li>正在合并重复提醒</li>
        </ol>
      </section>
    </main>
  )
}
