export function CalculatingPage({ message }: { message: string }) {
  return <main className="page page--center page--night" aria-live="polite"><p className="eyebrow eyebrow--night">异兽显形</p><h1>正在计算兽格</h1><p>{message}</p></main>
}
