import { useEffect, useId, useReducer, useRef, useState, type RefObject } from 'react'
import type { ExperienceCopy } from '../content/types'
import { focusLoopTargetIndex } from '../guide/focusLoop'
import { getPhotoAlbumBridge, saveCardToPhotoAlbum } from '../share/miniToolAlbum'
import type { ShareCardModel } from '../share/shareCardModel'
import { renderShareCard } from '../share/shareCardRenderer'
import { initialShareCardState, shareCardReducer } from '../share/shareCardState'

type Props = {
  model: ShareCardModel
  copy: ExperienceCopy['shareCard']
  returnFocusRef: RefObject<HTMLButtonElement | null>
  onClose: () => void
}

export function ShareCardSheet({ model, copy, returnFocusRef, onClose }: Props) {
  const titleId = useId()
  const statusId = useId()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const [state, dispatch] = useReducer(shareCardReducer, initialShareCardState)
  const [generationAttempt, setGenerationAttempt] = useState(0)
  const bridge = getPhotoAlbumBridge()
  const hasPreview = 'dataUri' in state

  useEffect(() => {
    let active = true
    const canvas = canvasRef.current
    if (!canvas) return () => { active = false }
    void renderShareCard(canvas, model)
      .then(({ dataUri }) => { if (active) dispatch({ type: 'GENERATED', dataUri }) })
      .catch(() => { if (active) dispatch({ type: 'GENERATION_FAILED' }) })
    return () => { active = false }
  }, [generationAttempt, model])

  useEffect(() => {
    const focusFrame = window.requestAnimationFrame(() => titleRef.current?.focus())
    const returnTarget = returnFocusRef.current
    return () => {
      window.cancelAnimationFrame(focusFrame)
      if (returnTarget) window.requestAnimationFrame(() => returnTarget.focus())
    }
  }, [returnFocusRef])

  useEffect(() => {
    const overlay = overlayRef.current
    const previous: Array<{ element: HTMLElement; inert: boolean; ariaHidden: string | null }> = []
    let modalBranch: HTMLElement | null = overlay
    while (modalBranch?.parentElement) {
      const container = modalBranch.parentElement
      for (const element of Array.from(container.children)) {
        if (!(element instanceof HTMLElement) || element === modalBranch) continue
        previous.push({ element, inert: element.inert, ariaHidden: element.getAttribute('aria-hidden') })
        element.inert = true
        element.setAttribute('aria-hidden', 'true')
      }
      if (container.id === 'root') break
      modalBranch = container
    }
    return () => {
      for (const item of previous) {
        item.element.inert = item.inert
        if (item.ariaHidden === null) item.element.removeAttribute('aria-hidden')
        else item.element.setAttribute('aria-hidden', item.ariaHidden)
      }
    }
  }, [])

  const status = state.phase === 'generating' ? copy.generating
    : state.phase === 'generation-error' ? copy.failure
      : state.phase === 'saving' ? copy.savingLabel
        : state.phase === 'saved' ? copy.success
          : state.phase === 'save-error' ? copy.failure
            : bridge ? '' : copy.unsupported

  return (
    <div className="share-card-overlay" role="presentation" ref={overlayRef}>
      <section
        className="share-card-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={statusId}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            onClose()
            return
          }
          if (event.key !== 'Tab') return
          const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'))
          const targetIndex = focusLoopTargetIndex(focusable.indexOf(document.activeElement as HTMLElement), focusable.length, event.shiftKey)
          if (targetIndex === undefined) return
          event.preventDefault()
          focusable[targetIndex]?.focus()
        }}
      >
        <header className="share-card-sheet__header">
          <p>{model.eyebrow}</p>
          <h2 id={titleId} ref={titleRef} tabIndex={-1}>{copy.title}</h2>
          <button type="button" className="share-card-sheet__close" aria-label={copy.closeLabel} onClick={onClose}>×</button>
        </header>

        <div className={`share-card-preview${state.phase === 'generating' ? ' share-card-preview--writing' : ''}`}>
          {hasPreview
            ? <img src={state.dataUri} alt={copy.previewAlt} width="1080" height="1440" />
            : <div className="share-card-preview__writing" aria-hidden="true"><span className="share-card-preview__mountain" /><i>闻山</i></div>}
        </div>
        <canvas className="share-card-sheet__canvas" ref={canvasRef} aria-hidden="true" />

        <p id={statusId} className={`share-card-sheet__status share-card-sheet__status--${state.phase}`} aria-live="polite">
          {status || '\u00a0'}
        </p>

        <div className="share-card-sheet__actions">
          <button type="button" className="button button--quiet" onClick={onClose}>{copy.closeLabel}</button>
          {state.phase === 'generation-error' ? (
            <button
              type="button"
              className="button button--primary"
              onClick={() => {
                dispatch({ type: 'RETRY_GENERATION' })
                setGenerationAttempt((attempt) => attempt + 1)
              }}
            >{copy.retryLabel}</button>
          ) : (
            <button
              type="button"
              className="button button--primary"
              disabled={!hasPreview || !bridge || state.phase === 'saving' || state.phase === 'saved'}
              onClick={async () => {
                if (!hasPreview || !bridge) return
                dispatch({ type: 'SAVE_STARTED' })
                try {
                  await saveCardToPhotoAlbum(state.dataUri, bridge)
                  dispatch({ type: 'SAVE_SUCCEEDED' })
                } catch {
                  dispatch({ type: 'SAVE_FAILED' })
                }
              }}
            >{state.phase === 'saving' ? copy.savingLabel : state.phase === 'saved' ? copy.success : copy.saveLabel}</button>
          )}
        </div>
      </section>
    </div>
  )
}
