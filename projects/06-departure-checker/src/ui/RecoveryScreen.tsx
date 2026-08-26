import { AssetIcon } from './AssetIcon'
import { GUIDE_ASSETS } from './assets'

type RecoveryScreenProps = {
  kind: 'storage' | 'content' | 'partial' | 'empty-match'
  message?: string
  diagnosticCode?: string
  onPrimary: () => void
  onSecondary?: () => void
  secondaryLabel?: string
}

const copy = {
  storage: { mark: '存', eyebrow: '可恢复错误', title: '本机清单暂时读不了', primary: '先回到空白首页' },
  content: { mark: '缺', eyebrow: '内容错误', title: '基础内容暂时无法使用', primary: '重新尝试' },
  partial: { mark: '半', eyebrow: '部分可用', title: '有一部分建议暂时没跟上', primary: '先使用可用内容' },
  'empty-match': { mark: '基', eyebrow: '仍可继续', title: '先为你保留基础清单', primary: '使用基础清单' },
} as const

export function RecoveryScreen({ kind, message, diagnosticCode, onPrimary, onSecondary, secondaryLabel }: RecoveryScreenProps) {
  const details = copy[kind]
  return (
    <main className="app-shell recovery-screen">
      <section role={kind === 'content' || kind === 'storage' ? 'alert' : 'status'}>
        {kind === 'partial' || kind === 'empty-match'
          ? <div className="compact-guide-heading recovery-guide"><img src={GUIDE_ASSETS.avatar} alt="" /><div><strong>路岚</strong><small>还能继续，我陪你处理</small></div></div>
          : <div className="recovery-mark">{details.mark}</div>}
        <p className="eyebrow">{details.eyebrow}</p><h1>{details.title}</h1><p>{message}</p>
        {kind === 'partial' && <span className="partial-icon"><AssetIcon assetId="icon-partial-available" /></span>}
        {diagnosticCode && <p className="diagnostic-code">诊断编号：{diagnosticCode}</p>}
        <button className="primary-button" type="button" onClick={onPrimary}>{details.primary}</button>
        {onSecondary && <button className={kind === 'storage' ? 'danger-button full' : 'secondary-button full'} type="button" onClick={onSecondary}>{secondaryLabel ?? '清空本工具数据'}</button>}
      </section>
    </main>
  )
}
