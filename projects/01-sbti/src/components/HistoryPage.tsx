import type { QuizResult } from '../quiz/types'

export function HistoryPage({ result, emptyText, onOpen, onBack }: { result?: QuizResult; emptyText: string; onOpen: () => void; onBack: () => void }) {
  return <main className="page"><header><p className="eyebrow">本机记录</p><h1>最近结果</h1></header>{result ? <article className="history-item"><h2>{result.summary.creatureName} · {result.summary.typeName}</h2><p>{result.summary.coreDescription}</p><button type="button" className="button" onClick={onOpen}>查看结果</button></article> : <div className="empty-state"><p>{emptyText}</p></div>}<button type="button" className="button button--quiet" onClick={onBack}>返回首页</button></main>
}

