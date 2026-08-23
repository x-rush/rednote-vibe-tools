export function ErrorPage({ message, onRecover }: { message: string; onRecover: () => void }) {
  return <main className="page page--center" role="alert"><p className="eyebrow">数据恢复</p><h1>暂时无法继续</h1><p>{message}</p><button type="button" className="button button--primary" onClick={onRecover}>返回安全首页</button></main>
}

