import { useEffect, useRef, useState, type RefObject } from 'react'
import type { EndingPosterModel } from '../state/ending-poster'
import { getMiniToolBridge, postPosterNote, savePosterToAlbum } from '../platform/minitool-bridge'
import { POSTER_SIZE, renderEndingPoster } from './ending-poster'

type Copy = Record<string, string>

export function PosterPreview({ canvasRef, copy, bridgeAvailable, busy, status, onSave, onShare, onClose }: {
  canvasRef: RefObject<HTMLCanvasElement | null>
  copy: Copy
  bridgeAvailable: boolean
  busy: boolean
  status?: string
  onSave: () => void
  onShare: () => void
  onClose: () => void
}) {
  return <section className="poster-panel" aria-live="polite">
    <canvas ref={canvasRef} width={POSTER_SIZE.width} height={POSTER_SIZE.height} role="img" aria-label={copy.posterImageAlt} />
    {!bridgeAvailable && <p className="poster-hint">{copy.posterBridgeHint}</p>}
    {status && <p className="poster-status">{status}</p>}
    <div className="poster-actions">
      <button type="button" className="primary-action" disabled={!bridgeAvailable || busy} onClick={onSave}>{copy.posterSave}</button>
      <button type="button" className="primary-action" disabled={!bridgeAvailable || busy} onClick={onShare}>{copy.posterShare}</button>
      <button type="button" className="secondary-action" disabled={busy} onClick={onClose}>{copy.posterClose}</button>
    </div>
  </section>
}

export function EndingPosterPanel({ model, copy }: { model: EndingPosterModel; copy: Copy }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string>()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const bridgeAvailable = Boolean(getMiniToolBridge())

  useEffect(() => {
    if (!open || !canvasRef.current) return
    let cancelled = false
    setBusy(true)
    setStatus(copy.posterGenerating)
    void renderEndingPoster(canvasRef.current, model, copy).then(() => {
      if (!cancelled) { setBusy(false); setStatus(undefined) }
    }).catch(() => {
      if (!cancelled) { setBusy(false); setStatus(copy.posterGenerateFailed) }
    })
    return () => { cancelled = true }
  }, [copy, model, open])

  const imageData = () => {
    const data = canvasRef.current?.toDataURL('image/png')
    if (!data) throw new Error('INVALID_POSTER_DATA')
    return data
  }
  const save = async () => {
    setBusy(true)
    try { await savePosterToAlbum(imageData()); setStatus(copy.posterSaved) }
    catch { setStatus(copy.posterSaveFailed) }
    finally { setBusy(false) }
  }
  const share = async () => {
    setBusy(true)
    try { await postPosterNote(imageData(), model.endingTitle, model.shareText); setStatus(copy.posterShareOpened) }
    catch { setStatus(copy.posterShareFailed) }
    finally { setBusy(false) }
  }

  if (!open) return <button type="button" className="primary-action" onClick={() => setOpen(true)}>{copy.posterGenerate}</button>
  return <PosterPreview
    canvasRef={canvasRef}
    copy={copy}
    bridgeAvailable={bridgeAvailable}
    busy={busy}
    status={status}
    onSave={() => { void save() }}
    onShare={() => { void share() }}
    onClose={() => { setOpen(false); setStatus(undefined) }}
  />
}
