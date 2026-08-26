import type { ReactNode, SyntheticEvent } from 'react'
import { assetUrl, GUIDE_ASSETS } from '../assets/manifest'
import { AssetIcon } from './AssetIcon'

function useAvatarFallback(event: SyntheticEvent<HTMLImageElement>) {
  event.currentTarget.onerror = null
  event.currentTarget.src = assetUrl(GUIDE_ASSETS.placeholder)
  event.currentTarget.classList.add('is-fallback')
}

export function QuietShell({
  children,
  canGoBack,
  saveMode,
  onBack,
  onSaved,
  onHelp,
}: {
  children: ReactNode
  canGoBack: boolean
  saveMode: 'ephemeral' | 'local'
  onBack(): void
  onSaved(): void
  onHelp(): void
}) {
  return (
    <main className="quiet-shell">
      <header className="top-rail">
        <button className="rail-button" type="button" onClick={onBack} disabled={!canGoBack}>← <span>上一步</span></button>
        <span className="privacy-stamp"><AssetIcon name={saveMode === 'ephemeral' ? 'ephemeral' : 'local'} size={18} />{saveMode === 'ephemeral' ? '无痕' : '本机'}</span>
        <span className="rail-actions">
          <button className="guide-entry" type="button" onClick={onHelp} aria-label="问迟言">
            <span className="guide-entry-avatar" aria-hidden="true">
              <img src={assetUrl(GUIDE_ASSETS.master)} alt="" width="900" height="1200" onError={useAvatarFallback} />
            </span>
            <span className="guide-entry-label">问迟言</span>
          </button>
          <button className="rail-button" type="button" onClick={onSaved}>已保存</button>
        </span>
      </header>
      {children}
      <footer className="site-foot">内容只在本机运行 · 不上传聊天记录 · 说得更清楚不代表责任都在你</footer>
    </main>
  )
}
