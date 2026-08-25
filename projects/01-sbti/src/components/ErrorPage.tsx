import type { GuideCopy } from '../content/types'
import type { StorageRecoveryKind } from '../app/state'
import { deriveGuideMoment } from '../guide/guideMoment'
import { GuidePresence } from './guide/GuidePresence'

type ErrorPageProps = {
  message: string
  reason: 'content' | 'storage'
  recoveryKind?: StorageRecoveryKind
  guide?: GuideCopy
  onRecover: () => void
}

export function ErrorPage({ message, reason, recoveryKind, guide, onRecover }: ErrorPageProps) {
  const safeMessage = reason === 'content' ? '内容包未能安全读取，请重新加载。' : message
  const moment = deriveGuideMoment({ screen: 'error', recoveryReason: reason })
  const recoveryReason = moment?.kind === 'recovery' ? moment.reason : reason
  const storageKey = recoveryKind === 'cleared'
    ? 'storageCleared'
    : recoveryKind === 'write-failed'
      ? 'storageWriteFailed'
      : 'storageUnavailable'
  const copyKey = recoveryReason === 'content' ? 'content' : storageKey
  const line = guide?.recovery[copyKey] ?? safeMessage
  const action = guide?.recoveryActions[copyKey] ?? (reason === 'content' ? '重新加载' : '继续')
  return (
    <main className="page page--center" role="alert">
      <p className="eyebrow">数据恢复</p>
      <h1>{reason === 'content' ? '内容卷未能展开' : '本机收卷暂时失败'}</h1>
      <GuidePresence name={guide?.name ?? '闻山'} role={guide?.role ?? '山海司守卷人'} line={line} />
      <p>{safeMessage}</p>
      <button type="button" className="button button--primary" onClick={onRecover}>
        {action}
      </button>
    </main>
  )
}
