import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from 'react'
import { focusLoopTargetIndex } from '../../guide/focusLoop'
import { nextPortraitStage, type PortraitStage } from '../../guide/mediaFallback'
import { getGuidePortrait, type GuidePortraitVariant } from '../../ui/guideAssets'

export type GuideSheetProps = {
  title: string
  name: string
  role: string
  lines: string[]
  portrait?: boolean
  portraitVariant?: GuidePortraitVariant
  step?: number
  primaryLabel?: string
  secondaryLabel?: string
  returnFocusRef?: RefObject<HTMLButtonElement | null>
  onPrimary?: () => void
  onSecondary?: () => void
  onClose: () => void
  children?: ReactNode
}

export function GuideSheet(props: GuideSheetProps) {
  const titleId = useId()
  const descriptionId = useId()
  const titleRef = useRef<HTMLHeadingElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const [portraitStage, setPortraitStage] = useState<PortraitStage>('master')
  const visibleLines = props.step === undefined ? props.lines : [props.lines[props.step] ?? props.lines[0] ?? '']

  useEffect(() => {
    const focusFrame = window.requestAnimationFrame(() => titleRef.current?.focus())
    const returnTarget = props.returnFocusRef?.current
    return () => {
      window.cancelAnimationFrame(focusFrame)
      if (returnTarget) window.requestAnimationFrame(() => returnTarget.focus())
    }
  }, [props.returnFocusRef, props.title])

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

  return (
    <div className="guide-overlay" role="presentation" ref={overlayRef}>
      <section
        className="guide-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            props.onClose()
            return
          }
          if (event.key !== 'Tab') return
          const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'))
          const targetIndex = focusLoopTargetIndex(focusable.indexOf(document.activeElement as HTMLElement), focusable.length, event.shiftKey)
          if (targetIndex === undefined) return
          event.preventDefault()
          focusable[targetIndex]?.focus()
        }}
      >
        {props.portrait && (
          <div
            className={`guide-sheet__portrait${portraitStage === 'css' ? ' guide-sheet__portrait--fallback' : ''}`}
            aria-hidden="true"
          >
            {portraitStage !== 'css' && (
              <img
                src={portraitStage === 'master' ? getGuidePortrait(props.portraitVariant ?? 'default') : './assets/sbti/guide/guide-placeholder-v1.webp'}
                alt=""
                width="900"
                height="1200"
                decoding="async"
                onError={() => setPortraitStage((stage) => nextPortraitStage(stage))}
              />
            )}
            {portraitStage === 'css' && <span className="guide-ink-figure" />}
          </div>
        )}
        <div className="guide-sheet__copy">
          <div className="guide-sheet__identity">
            <p>{props.role} · {props.name}</p>
            {props.step !== undefined && <span aria-label={`第 ${props.step + 1} 句，共 ${props.lines.length} 句`}>{props.step + 1} / {props.lines.length}</span>}
          </div>
          <h2 id={titleId} ref={titleRef} tabIndex={-1}>{props.title}</h2>
          {props.children}
          <div id={descriptionId} className="guide-lines">
            {visibleLines.map((line) => <p className="guide-line" key={line}>{line}</p>)}
          </div>
          <div className="guide-sheet__actions">
            {(props.secondaryLabel || props.onSecondary) && (
              <button type="button" className="button button--quiet" onClick={props.onSecondary ?? props.onClose}>
                {props.secondaryLabel ?? '返回'}
              </button>
            )}
            {props.onPrimary && (
              <button type="button" className="button button--primary" onClick={props.onPrimary}>
                {props.primaryLabel ?? '继续'}
              </button>
            )}
            {!props.onPrimary && (
              <button type="button" className="button button--primary" onClick={props.onClose}>关闭</button>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
