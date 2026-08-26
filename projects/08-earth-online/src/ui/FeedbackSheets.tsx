import { useEffect, useRef, useState } from 'react'
import type { UiContent, UnsuitableReason } from '../content/schema'
import { assets } from './asset-paths'

type SheetFrameProps = { title: string; onClose: () => void; ui: UiContent; children: React.ReactNode }
function SheetFrame({ title, onClose, ui, children }: SheetFrameProps) {
  const closeButton = useRef<HTMLButtonElement>(null)
  useEffect(() => { closeButton.current?.focus() }, [])
  return <div className="sheet-backdrop"><section className="bottom-sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title"><header><img src={assets.mira.avatar} alt="" /><div><p className="eyebrow">{ui.intro.name}</p><h2 id="sheet-title">{title}</h2></div><button ref={closeButton} className="text-button" type="button" onClick={onClose}>{ui.actions.close}</button></header>{children}</section></div>
}

export function CompletionConfirm({ questTitle, ui, onConfirm, onClose }: { questTitle: string; ui: UiContent; onConfirm: () => void; onClose: () => void }) {
  return <SheetFrame title={ui.sheets.completeTitle} ui={ui} onClose={onClose}><strong className="sheet-quest-title">{questTitle}</strong><p>{ui.sheets.completeBody}</p><p className="sheet-note"><img src={assets.status('completed')} alt="" />{ui.notices.noProof}</p><button className="button button--primary button--large" type="button" onClick={onConfirm}>{ui.actions.confirmComplete}</button></SheetFrame>
}

export function AbandonSheet({ questTitle, ui, onConfirm, onClose }: { questTitle: string; ui: UiContent; onConfirm: (reason?: UnsuitableReason) => void; onClose: () => void }) {
  const [reason, setReason] = useState<UnsuitableReason | ''>('')
  return <SheetFrame title={ui.sheets.abandonTitle} ui={ui} onClose={onClose}><strong className="sheet-quest-title">{questTitle}</strong><p>{ui.sheets.abandonBody}</p><ReasonSelect value={reason} ui={ui} includeUnsafe={false} onChange={setReason} /><button className="button button--primary button--large" type="button" onClick={() => onConfirm(reason || undefined)}>{ui.actions.confirmAbandon}</button></SheetFrame>
}

export function UnsuitableSheet({ questTitle, ui, isAvoided, onConfirm, onUndo, onClose }: { questTitle: string; ui: UiContent; isAvoided: boolean; onConfirm: (reason: UnsuitableReason) => void; onUndo: () => void; onClose: () => void }) {
  const [reason, setReason] = useState<UnsuitableReason>('changed-mind')
  return <SheetFrame title={ui.sheets.unsuitableTitle} ui={ui} onClose={onClose}><strong className="sheet-quest-title">{questTitle}</strong><p>{ui.sheets.unsuitableBody}</p>{isAvoided ? <button className="button button--ghost button--large" type="button" onClick={onUndo}>{ui.actions.undo}</button> : <><ReasonSelect value={reason} ui={ui} includeUnsafe onChange={(value) => value && setReason(value)} />{reason === 'unsafe-now' && <p className="unsafe-advice" role="alert">{ui.sheets.unsafeAdvice}</p>}<button className="button button--primary button--large" type="button" onClick={() => onConfirm(reason)}>{ui.actions.saveFeedback}</button></>}</SheetFrame>
}

function ReasonSelect({ value, ui, includeUnsafe, onChange }: { value: UnsuitableReason | ''; ui: UiContent; includeUnsafe: boolean; onChange: (value: UnsuitableReason | '') => void }) {
  const reasons = (Object.keys(ui.reasons) as UnsuitableReason[]).filter((reason) => includeUnsafe || reason !== 'unsafe-now')
  return <label className="reason-select"><span>{ui.sheets.reasonLegend}</span><select value={value} onChange={(event) => onChange(event.target.value as UnsuitableReason | '')}>{value === '' && <option value="">{ui.sheets.optionalReason}</option>}{reasons.map((reason) => <option key={reason} value={reason}>{ui.reasons[reason]}</option>)}</select></label>
}

export function MiraHelpSheet({ ui, onClose }: { ui: UiContent; onClose: () => void }) {
  const [selectedId, setSelectedId] = useState(ui.help[0].id)
  const firstTopic = useRef<HTMLButtonElement>(null)
  const selected = ui.help.find(({ id }) => id === selectedId) ?? ui.help[0]

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKeyDown)
    firstTopic.current?.focus()
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  return <div className="mira-audience">
    <section className="mira-audience__scene" role="dialog" aria-modal="true" aria-labelledby="mira-audience-title" aria-describedby="mira-audience-response">
      <div className="mira-audience__stage" aria-hidden="true">
        <div className="mira-audience__sigil"><i /><i /><i /><i /></div>
        <img src={assets.mira.master} width="1086" height="1448" alt="" />
      </div>
      <div className="mira-audience__dialogue">
        <header className="mira-audience__speaker">
          <img src={assets.mira.avatar} width="48" height="48" alt="" />
          <div><strong id="mira-audience-title">{ui.intro.name}</strong><span>{ui.intro.role}</span></div>
        </header>
        <p className="mira-audience__prompt">{ui.helpDialogue.prompt}</p>
        <div className="mira-audience__topics" role="group" aria-label={ui.helpDialogue.prompt}>
          {ui.help.map((item, index) => <button ref={index === 0 ? firstTopic : undefined} className="mira-audience__topic" type="button" aria-pressed={selected.id === item.id} onClick={() => setSelectedId(item.id)} key={item.id}>{item.title}</button>)}
        </div>
        <div className="mira-audience__response" aria-live="polite" key={selected.id}>
          <p className="eyebrow">{ui.helpDialogue.answerEyebrow}</p>
          <p id="mira-audience-response">{selected.body}</p>
        </div>
        <button className="button button--primary button--large" type="button" onClick={onClose}>{ui.helpDialogue.closeLabel}</button>
      </div>
    </section>
  </div>
}
