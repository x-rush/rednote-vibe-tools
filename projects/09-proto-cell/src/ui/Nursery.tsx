import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import type { ContentPack, OrganelleId } from '../content'
import { createBuildState } from '../evolution/build'
import { lineageBuild, type HatchOptions, type NurseryState } from '../progression/lineage'
import { SpecimenCanvas } from './SpecimenCanvas'

type Props = {
  content: ContentPack
  nursery: NurseryState
  reducedMotion: boolean
  storageMode?: 'persistent' | 'session'
  onHatch(options: HatchOptions): void
  onSelect(id: string): void
  onRetire(id: string): void
  onClose(): void
}

export function Nursery({ content, nursery, reducedMotion, storageMode = 'persistent', onHatch, onSelect, onRetire, onClose }: Props) {
  const [tab, setTab] = useState<'seeds' | 'library'>('seeds')
  const available = nursery.seeds.filter((seed) => !nursery.hatchedSeedIds.includes(seed.id))
  const [seedId, setSeedId] = useState(available.at(-1)?.id ?? '')
  const source = available.find((seed) => seed.id === seedId) ?? available.at(-1)
  const [archetypeId, setArchetypeId] = useState(content.lineage.archetypes[0]!.id)
  const archetype = content.lineage.archetypes.find((item) => item.id === archetypeId)!
  const eligible = source?.organelleIds.filter((id) => archetype.inheritancePool.includes(id)) ?? []
  const [inheritedId, setInheritedId] = useState<OrganelleId | ''>('')
  const selectedOrgan = inheritedId && eligible.includes(inheritedId) ? inheritedId : undefined
  const [name, setName] = useState('')
  const [hatching, setHatching] = useState<HatchOptions>()
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [retiring, setRetiring] = useState<string>()
  const committed = useRef(false)
  const hatchDialog = useRef<HTMLElement>(null)
  const labels = content.ui.labels
  const actions = content.ui.actions
  const screens = content.ui.screens
  const build = createBuildState({ traitIds: selectedOrgan ? [selectedOrgan] : [] })
  const full = nursery.lineages.length >= content.lineage.maxLineages

  useEffect(() => {
    if (!hatching) return
    committed.current = false
    const started = performance.now()
    const duration = reducedMotion ? 180 : content.lineage.hatchDurationMs
    const timer = window.setInterval(() => setProgress((current) => Math.max(current, Math.min(1, (performance.now() - started) / duration))), 50)
    const focus = window.requestAnimationFrame(() => hatchDialog.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus())
    return () => { window.clearInterval(timer); window.cancelAnimationFrame(focus) }
  }, [hatching, reducedMotion, content.lineage.hatchDurationMs])

  const finish = () => {
    if (!hatching || committed.current || progress < 1) return
    committed.current = true
    try {
      onHatch(hatching)
      setHatching(undefined)
      setTab('library')
      setSuccess(true)
      setName('')
      setError('')
    } catch {
      committed.current = false
      setHatching(undefined)
      setError(full ? screens.nurseryFull : screens.nurseryError)
    }
  }

  return <main className="nursery-shell">
    <div inert={!!hatching} aria-hidden={!!hatching || undefined}>
    <header className="nursery-header">
      <button className="nursery-back" type="button" onClick={onClose}>{actions.backToLab}</button>
      <p className="hatchery-region">{labels.nursery}</p>
      <h1>{screens.nurseryTitle}</h1><p>{screens.nurseryIntro}</p>
      <small role={storageMode === 'session' ? 'status' : undefined}>{storageMode === 'session' ? screens.storageFallback : labels.lineageLocal}</small>
    </header>
    <nav className="nursery-tabs" aria-label={labels.nursery}>
      <button type="button" aria-pressed={tab === 'seeds'} onClick={() => { setTab('seeds'); setSuccess(false) }}>{labels.seedBank} <b>{available.length}</b></button>
      <button type="button" aria-pressed={tab === 'library'} onClick={() => setTab('library')}>{labels.cellLibrary} <b>{nursery.lineages.length}/{content.lineage.maxLineages}</b></button>
    </nav>
    {error && <p className="nursery-status" role="alert">{error}</p>}
    {success && <p className="nursery-status nursery-status--success" role="status">{storageMode === 'session' ? screens.lineageSessionSaved : screens.lineageSaved}</p>}
    {tab === 'seeds' && <section className="nursery-breeding">
      <p className="nursery-help">{labels.seedRetention.replace('{count}', String(content.lineage.maxSeeds))}</p>
      {available.length === 0 ? <div className="nursery-empty"><SpecimenCanvas build={createBuildState()} formId="form-primal-cell" size={140} /><p>{nursery.seeds.length ? labels.lineageNoSeed : screens.nurseryEmpty}</p></div> : <>
        <label className="nursery-field">{labels.lineageChooseSeed}<select value={source?.id} onChange={(event) => { setSeedId(event.target.value); setInheritedId(''); setError('') }}>{available.slice().reverse().map((seed) => <option key={seed.id} value={seed.id}>{labels.lineageGenerationPrefix}{seed.generation}{labels.lineageGeneration} · #{seed.earnedAtRun} · {content.scaleTiers.find((tier) => tier.formId === seed.sourceFormId)?.name}</option>)}</select></label>
        <fieldset className="nursery-archetypes"><legend>{labels.lineageArchetype}</legend>
          {content.lineage.archetypes.map((item) => <label className="nursery-archetype" key={item.id} data-selected={archetype.id === item.id} data-locked={source && source.generation < item.minGeneration}>
            <input type="radio" name="archetype" value={item.id} checked={archetype.id === item.id} disabled={!!source && source.generation < item.minGeneration} onChange={() => { setArchetypeId(item.id); setInheritedId(''); setError('') }} />
            <SpecimenCanvas build={createBuildState()} formId="form-primal-cell" visualRecipeId={item.visualRecipeId} size={88} />
            <strong>{item.name}</strong><span>{source && source.generation < item.minGeneration ? `${labels.lineageGenerationPrefix}${item.minGeneration}${labels.lineageLocked}` : item.description}</span>
          </label>)}
        </fieldset>
        <div className="nursery-workbench">
          <div className="nursery-preview" role="img" aria-label={`${archetype.name} · ${selectedOrgan ? content.organelles.find((organ) => organ.id === selectedOrgan)?.name : labels.lineageNothing}`}>
            <div className="nursery-dish"><SpecimenCanvas build={build} formId="form-primal-cell" visualRecipeId={archetype.visualRecipeId} size={220} /></div>
            <strong>{name.trim() || `${archetype.name}·${source?.generation}`}</strong><small>{screens.lineagePreviewNote}</small>
          </div>
          <div className="nursery-controls">
            <p className="nursery-strength">{archetype.strength}</p><p className="nursery-weakness">{archetype.weakness}</p>
            <label className="nursery-field">{labels.lineageAbilities}<select value={selectedOrgan ?? ''} onChange={(event) => setInheritedId(event.target.value as OrganelleId | '')}><option value="">{labels.noInheritance}</option>{eligible.map((id) => <option key={id} value={id}>{content.organelles.find((organ) => organ.id === id)?.name}</option>)}</select></label>
            <p className="nursery-help">{eligible.length ? screens.seedPoolNote : screens.seedNoOrgan}</p>
            <label className="nursery-field">{labels.lineageName}<input value={name} maxLength={32} onChange={(event) => setName(Array.from(event.target.value).slice(0, 16).join(''))} placeholder={labels.lineageNamingPlaceholder} /></label>
            <p className="nursery-balance">{screens.hatchBalance}</p>
            {full && <p role="status">{screens.nurseryFull}</p>}
            <button className="hatchery-start" type="button" disabled={full || !source || source.generation < archetype.minGeneration} onClick={() => { if (!source) return; setProgress(0); setError(''); setHatching({ seedId: source.id, archetypeId: archetype.id, ...(selectedOrgan ? { inheritedOrganelleId: selectedOrgan } : {}), name: name.trim() || `${archetype.name}·${source.generation}` }) }}>{actions.hatchCell}</button>
          </div>
        </div>
      </>}
    </section>}
    {tab === 'library' && <section className="nursery-library" aria-label={labels.cellLibrary}>
      {nursery.lineages.length === 0 && <p className="nursery-empty">{screens.lineageEmpty}</p>}
      {nursery.lineages.slice().reverse().map((lineage) => {
        const family = content.lineage.archetypes.find((item) => item.id === lineage.archetypeId)!
        const selected = nursery.selectedLineageId === lineage.id
        const parent = nursery.lineages.find((item) => item.id === lineage.parentLineageId)
        return <article className="lineage-card" key={lineage.id} data-selected={selected}>
          <SpecimenCanvas build={lineageBuild(lineage)} formId="form-primal-cell" visualRecipeId={family.visualRecipeId} size={150} />
          <div><p className="hatchery-region">{family.name} · {labels.lineageGenerationPrefix}{lineage.generation}{labels.lineageGeneration}</p><h2>{lineage.name}</h2><p>{labels.lineageInherited}：{content.organelles.find((organ) => organ.id === lineage.inheritedOrganelleId)?.name ?? labels.lineageNothing}</p>{parent && <small>{labels.lineageParent}：{parent.name}</small>}</div>
          <button type="button" className="lineage-select" disabled={selected} onClick={() => { onSelect(lineage.id); setSuccess(false) }}>{selected ? labels.lineageSelected : actions.selectLineage}</button>
          {retiring === lineage.id ? <div className="lineage-retire"><p>{labels.lineageRetireWarning}</p><button type="button" onClick={() => { onRetire(lineage.id); setRetiring(undefined); setSuccess(false) }}>{actions.confirmRetire}</button><button type="button" onClick={() => setRetiring(undefined)}>{actions.cancelRetire}</button></div> : <button className="lineage-release" type="button" onClick={() => setRetiring(lineage.id)}>{actions.retireLineage}</button>}
        </article>
      })}
    </section>}
    </div>
    {hatching && <section ref={hatchDialog} className="nursery-incubation" role="dialog" aria-modal="true" aria-labelledby="hatch-title" data-phase={Math.min(2, Math.floor(progress * 3))} data-reduced-motion={reducedMotion} onKeyDown={trapHatchFocus}>
      <p className="hatchery-region">{labels.nursery}</p><h2 id="hatch-title">{progress >= 1 ? labels.lineageBorn : labels[`hatchPhase${Math.min(2, Math.floor(progress * 3))}`]}</h2>
      <div className="hatch-vessel" style={{ '--hatch-progress': progress } as CSSProperties}><i /><i /><i /><SpecimenCanvas build={progress > 0.34 ? build : createBuildState()} formId="form-primal-cell" visualRecipeId={archetype.visualRecipeId} elapsedMs={progress * 1200} size={260} /></div>
      <strong>{hatching.name}</strong><progress max={1} value={progress} aria-label={actions.hatchCell} /><p>{screens.hatchBalance}</p>
      <button className="hatchery-start" type="button" disabled={progress < 1} onClick={finish}>{actions.finishHatch}</button>
      {progress < 1 && <button type="button" onClick={() => setProgress(1)}>{actions.skipHatch}</button>}
      <button type="button" className="game-overlay__secondary" onClick={() => { setHatching(undefined); setProgress(0) }}>{labels.hatchReturn}</button>
    </section>}
  </main>
}

function trapHatchFocus(event: KeyboardEvent<HTMLElement>) {
  if (event.key !== 'Tab') return
  const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')]
  if (!buttons.length) return
  const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
  const next = (index + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length
  event.preventDefault()
  buttons[next]?.focus()
}
