import { useState } from 'react'
import type { ContentPack } from '../content'
import type { SaveIssue, SaveSettings } from '../storage/codec'
import type { RepositoryMode } from '../storage/repository'

const booleanSettings = ['music', 'sfx', 'reducedMotion', 'reducedFlash', 'lowParticles', 'reducedShake'] as const

export function Settings({ content, settings, storageMode, storageIssues, onChange, onExport, onExportRecovery, onImport, onClear, onClose }: {
  content: ContentPack
  settings: SaveSettings
  storageMode: RepositoryMode
  storageIssues: readonly SaveIssue[]
  onChange(next: SaveSettings): void
  onExport(): Promise<string>
  onExportRecovery?: () => Promise<string>
  onImport(raw: string): Promise<{ ok: boolean; issues: readonly SaveIssue[] }>
  onClear(): Promise<void>
  onClose(): void
}) {
  const [exported, setExported] = useState('')
  const [imported, setImported] = useState('')
  const [status, setStatus] = useState('')
  const [confirmClear, setConfirmClear] = useState(false)
  return (
    <section className="lab-panel settings-panel" aria-labelledby="settings-title">
      <header><p className="hatchery-region">{content.ui.labels.lab}</p><h2 id="settings-title">{content.ui.screens.settingsTitle}</h2><p>{content.ui.screens.storageExplanation}</p></header>
      {storageMode === 'session' && <p className="settings-warning" role="status">{content.ui.screens.storageFallback}{storageIssues.length > 0 ? `（${storageIssues.length}）` : ''}</p>}
      <fieldset><legend>{content.ui.labels.comfortSettings}</legend>{booleanSettings.map((key) => <label key={key}><input type="checkbox" checked={settings[key]} onChange={(event) => onChange({ ...settings, [key]: event.target.checked })} /><span>{content.ui.labels[`setting_${key}`]}</span></label>)}</fieldset>
      <label className="settings-quality">{content.ui.labels.graphicsQuality}<select value={settings.graphics} onChange={(event) => onChange({ ...settings, graphics: event.target.value as SaveSettings['graphics'] })}><option value="high">{content.ui.labels.graphicsHigh}</option><option value="balanced">{content.ui.labels.graphicsBalanced}</option><option value="low">{content.ui.labels.graphicsLow}</option></select></label>
      <section className="settings-transfer"><h3>{content.ui.labels.structuredSave}</h3><button type="button" onClick={() => void onExport().then((value) => { setExported(value); setStatus(content.ui.screens.exportReady) })}>{content.ui.actions.exportSave}</button>{exported && <textarea readOnly value={exported} aria-label={content.ui.labels.exportedSave} />}
        {onExportRecovery && <button type="button" onClick={() => void onExportRecovery().then((value) => { setExported(value); setStatus(content.ui.screens.recoveryReady) })}>{content.ui.actions.exportRecovery}</button>}
        <label>{content.ui.labels.importedSave}<textarea value={imported} onChange={(event) => setImported(event.target.value)} /></label><button type="button" disabled={!imported.trim()} onClick={() => void onImport(imported).then((result) => setStatus(result.ok ? content.ui.screens.importSuccess : `${content.ui.screens.importFailure}（${result.issues.length}）`))}>{content.ui.actions.importSave}</button></section>
      <section className="settings-danger">{confirmClear ? <><p>{content.ui.screens.clearConfirm}</p><button type="button" onClick={() => void onClear().then(onClose)}>{content.ui.actions.confirmClear}</button><button type="button" onClick={() => setConfirmClear(false)}>{content.ui.actions.cancel}</button></> : <button type="button" onClick={() => setConfirmClear(true)}>{content.ui.actions.clearSave}</button>}</section>
      {status && <p role="status">{status}</p>}
      <small>{content.assetCredits.map((credit) => `${credit.scope}：${credit.source} · ${credit.license}`).join('；')}</small>
      <button className="game-overlay__secondary" type="button" onClick={onClose}>{content.ui.actions.backToLab}</button>
    </section>
  )
}
