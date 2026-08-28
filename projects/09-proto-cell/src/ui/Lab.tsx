import { useState } from 'react'
import type { ContentPack, ModifierId, OriginId } from '../content'
import { decodeDishCode } from '../progression/challenges'
import type { SaveDataV1 } from '../storage/codec'
import { assetPath } from '../content/assets'

export type LabPanelId = 'gene' | 'codex' | 'archive' | 'settings' | 'daily' | 'code' | 'modifiers'

export function Lab({ content, save, hasArchive, selectedOriginId, activeModifierIds, dailyRunSeed, storageWarning = false, onSelectOrigin, onToggleModifier, onOpen, onStart }: {
  content: ContentPack
  save: SaveDataV1
  hasArchive: boolean
  selectedOriginId: OriginId
  activeModifierIds: ModifierId[]
  dailyRunSeed: number
  storageWarning?: boolean
  onSelectOrigin(id: OriginId): void
  onToggleModifier(id: ModifierId): void
  onOpen(panel: LabPanelId): void
  onStart(seed?: number, route?: readonly `env-${string}`[]): void
}) {
  const [code, setCode] = useState('')
  const [codeIssue, setCodeIssue] = useState('')
  const availableOrigins = content.origins.filter((origin) => save.progression.unlockedIds.includes(origin.id))
  return (
    <main className="hatchery-shell lab-shell">
      <div className="hatchery-ambient" aria-hidden="true" />
      <section className="hatchery-card lab-home" aria-labelledby="game-title">
        <p className="hatchery-region">{hasArchive ? content.ui.labels.lab : content.ui.labels.openingRegion}</p>
        <div className="prototype-cell" role="img" aria-label={content.ui.labels.prototypeCell}><img className="prototype-cell__asset" src={assetPath(selectedOriginId)} alt="" /><span className="prototype-cell__membrane" /><span className="prototype-cell__core" /></div>
        <div className="hatchery-copy"><h1 id="game-title">{content.meta.title}</h1><p>{content.meta.tagline}</p></div>
        {hasArchive && <label className="lab-field">{content.ui.labels.birthForm}<select value={selectedOriginId} onChange={(event) => onSelectOrigin(event.target.value as OriginId)}>{availableOrigins.map((origin) => <option key={origin.id} value={origin.id}>{origin.name}</option>)}</select></label>}
        <button className="hatchery-start" type="button" onClick={() => onStart()}>{hasArchive ? content.ui.actions.restartAfterLife : content.ui.actions.start}</button>
        {storageWarning && <button className="settings-warning" type="button" onClick={() => onOpen('settings')}>{content.ui.screens.storageFallback} · {content.ui.actions.open_settings}</button>}
        {hasArchive && <>
          <nav className="lab-nav" aria-label={content.ui.labels.labTools}>{(['gene', 'codex', 'archive', 'settings'] as const).map((panel) => <button key={panel} type="button" onClick={() => onOpen(panel)}>{content.ui.actions[`open_${panel}`]}</button>)}</nav>
          <section className="lab-tools">
            <button type="button" onClick={() => onStart(dailyRunSeed)}><strong>{content.ui.actions.open_daily}</strong><span>{content.ui.labels.localDaily}</span></button>
            <label className="lab-code">{content.ui.labels.dishCode}<input value={code} onChange={(event) => setCode(event.target.value)} placeholder={content.ui.labels.dishCodePlaceholder} /><button type="button" onClick={() => { const result = decodeDishCode(code); if (result.value) { setCodeIssue(''); onStart(result.value.seed, result.value.route) } else setCodeIssue(content.ui.screens[`dishCode_${result.issues[0]?.code ?? 'invalid-payload'}`]) }}>{content.ui.actions.useCode}</button>{codeIssue && <small role="alert">{codeIssue}</small>}</label>
          </section>
          <section className="modifier-list"><h2>{content.ui.screens.modifierTitle}</h2>{content.modifiers.map((modifier) => <label key={modifier.id}><input type="checkbox" checked={activeModifierIds.includes(modifier.id)} onChange={() => onToggleModifier(modifier.id)} /><img src={assetPath(modifier.id)} alt="" /><strong>{modifier.name}</strong><span>{modifier.shortEffect}</span></label>)}</section>
        </>}
        <small>{content.meta.fictionDisclaimer}</small>
      </section>
    </main>
  )
}
