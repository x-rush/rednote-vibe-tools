import { useState } from 'react'
import type { ContentPack, ModifierId, OriginId } from '../content'
import { decodeDishCode } from '../progression/challenges'
import type { SaveDataV1 } from '../storage/codec'
import { assetPath } from '../content/assets'
import { createBuildState } from '../evolution/build'
import { SpecimenCanvas } from './SpecimenCanvas'
import { createArchiveViewModelFromSummary } from '../app/view-model'
import { lineageBuild } from '../progression/lineage'

export type LabPanelId = 'gene' | 'codex' | 'archive' | 'settings' | 'daily' | 'code' | 'modifiers' | 'nursery'

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
  const recent = save.lifeArchives.at(-1)
  const specimen = recent ? createArchiveViewModelFromSummary(recent, content) : undefined
  const lineage = save.nursery?.lineages.find((item) => item.id === save.nursery?.selectedLineageId)
  const family = content.lineage.archetypes.find((item) => item.id === lineage?.archetypeId)
  const origin = content.origins.find((item) => item.id === selectedOriginId) ?? content.origins[0]!
  const previewBuild = lineage ? lineageBuild(lineage) : createBuildState({ traitIds: origin.initialOrganelleIds })
  const availableSeedCount = save.nursery?.seeds.filter((seed) => !save.nursery?.hatchedSeedIds.includes(seed.id)).length ?? 0
  return (
    <main className="hatchery-shell lab-shell">
      <div className="hatchery-ambient" aria-hidden="true" />
      <section className="hatchery-card lab-home" aria-labelledby="game-title">
        <p className="hatchery-region">{hasArchive ? content.ui.labels.lab : content.ui.labels.openingRegion}</p>
        <div className="lab-specimen" role="img" data-lineage-id={lineage?.id} data-origin-id={lineage ? family?.originId : origin.id} aria-label={lineage?.name ?? origin.name}><SpecimenCanvas build={previewBuild} formId="form-primal-cell" visualRecipeId={family?.visualRecipeId ?? origin.visualRecipeId} size={200} /></div>
        <div className="hatchery-copy"><h1 id="game-title">{content.meta.title}</h1><p>{content.meta.tagline}</p></div>
        {!hasArchive && <p className="lab-opening-hint">{content.ui.labels.firstHuntHint}</p>}
        {lineage && <div className="lab-lineage"><strong>{lineage.name}</strong><span>{family?.name} · {content.ui.labels.lineageGenerationPrefix}{lineage.generation}{content.ui.labels.lineageGeneration} · {content.organelles.find((organ) => organ.id === lineage.inheritedOrganelleId)?.name ?? content.ui.labels.lineageNothing}</span></div>}
        {hasArchive && <label className="lab-field">{content.ui.labels.birthForm}<select value={lineage ? '' : selectedOriginId} onChange={(event) => onSelectOrigin(event.target.value as OriginId)}>{lineage && <option value="" disabled>{lineage.name}</option>}{availableOrigins.map((origin) => <option key={origin.id} value={origin.id}>{origin.name}</option>)}</select></label>}
        <button className="hatchery-start" type="button" onClick={() => onStart()}>{hasArchive ? content.ui.actions.restartAfterLife : content.ui.actions.start}</button>
        <button className="lab-settings" type="button" onClick={() => onOpen('settings')}>{content.ui.actions.open_settings}</button>
        <button className="lab-nursery" type="button" onClick={() => onOpen('nursery')}><strong>{content.ui.actions.open_nursery}</strong><span>{availableSeedCount} {content.ui.labels.lineageSeedCount}</span></button>
        {specimen && <button className="lab-recent" type="button" onClick={() => onOpen('archive')}><span>{content.ui.labels.recentLife}</span><strong>{specimen.endingName ?? specimen.environmentName}</strong><span>{specimen.keyOrgans.join(' · ') || content.ui.labels.archiveNoOrgans}</span></button>}
        {storageWarning && <button className="settings-warning" type="button" onClick={() => onOpen('settings')}>{content.ui.screens.storageFallback} · {content.ui.actions.open_settings}</button>}
        {hasArchive && <>
          <nav className="lab-nav" aria-label={content.ui.labels.labTools}>{(['gene', 'codex'] as const).map((panel) => <button key={panel} type="button" onClick={() => onOpen(panel)}>{content.ui.actions[`open_${panel}`]}</button>)}</nav>
          <details className="lab-challenges"><summary>{content.ui.labels.challengeOptions}</summary>
          <section className="lab-tools">
            <button type="button" onClick={() => onStart(dailyRunSeed)}><strong>{content.ui.actions.open_daily}</strong><span>{content.ui.labels.localDaily}</span></button>
            <label className="lab-code">{content.ui.labels.dishCode}<input value={code} onChange={(event) => setCode(event.target.value)} placeholder={content.ui.labels.dishCodePlaceholder} /><button type="button" onClick={() => { const result = decodeDishCode(code); if (result.value) { setCodeIssue(''); onStart(result.value.seed, result.value.route) } else setCodeIssue(content.ui.screens[`dishCode_${result.issues[0]?.code ?? 'invalid-payload'}`]) }}>{content.ui.actions.useCode}</button>{codeIssue && <small role="alert">{codeIssue}</small>}</label>
          </section>
          <section className="modifier-list"><h2>{content.ui.screens.modifierTitle}</h2>{content.modifiers.map((modifier) => <label key={modifier.id}><input type="checkbox" checked={activeModifierIds.includes(modifier.id)} onChange={() => onToggleModifier(modifier.id)} /><img src={assetPath(modifier.id)} alt="" /><strong>{modifier.name}</strong><span>{modifier.shortEffect}</span></label>)}</section>
          </details>
        </>}
        <small>{content.meta.fictionDisclaimer}</small>
      </section>
    </main>
  )
}
