import { useEffect, useMemo, useState } from 'react'
import type { NarrativeBeat, NarrativeChapter } from '../content/types.ts'
import { resolveGuideAsset } from './guide-assets.ts'

type NarrativeInterludeProps = {
  chapter: NarrativeChapter
  fictionLabel: string
  recentResponse: string | null
  replay: boolean
  continueLabel: string
  deferLabel: string
  onComplete: () => void
  onDefer: () => void
}

export function NarrativeInterlude({
  chapter,
  fictionLabel,
  recentResponse,
  replay,
  continueLabel,
  deferLabel,
  onComplete,
  onDefer,
}: NarrativeInterludeProps) {
  const [beatIndex, setBeatIndex] = useState(0)
  useEffect(() => setBeatIndex(0), [chapter.id])
  const beats = useMemo(() => {
    if (!recentResponse || chapter.id !== 'act-3') return chapter.beats
    const responseBeat: NarrativeBeat = { id: 'act-3-recent-response', speaker: '许照', body: recentResponse }
    return [...chapter.beats.slice(0, 2), responseBeat, ...chapter.beats.slice(2)]
  }, [chapter, recentResponse])
  const beat = beats[Math.min(beatIndex, beats.length - 1)]
  const isLast = beatIndex >= beats.length - 1

  return (
    <section className={`narrative-interlude${chapter.id === 'finale' ? ' narrative-interlude--finale' : ''}`} aria-labelledby="narrative-title">
      <div className="narrative-interlude__portrait">
        <img src={resolveGuideAsset(chapter.imageAssetId)} alt="" width="900" height="1200" />
      </div>
      <div className="narrative-interlude__dialogue" aria-live="polite">
        <p className="narrative-interlude__fiction">{fictionLabel}</p>
        <p className="narrative-interlude__eyebrow">{chapter.eyebrow}</p>
        <h1 id="narrative-title">{chapter.title}</h1>
        <p className="narrative-interlude__speaker">{beat.speaker}</p>
        <blockquote key={beat.id}>{beat.body}</blockquote>
        <div className="narrative-interlude__progress" aria-label={`${beatIndex + 1} / ${beats.length}`}>
          {beats.map((item, index) => <span key={item.id} className={index <= beatIndex ? 'is-read' : ''} aria-hidden="true" />)}
        </div>
        <div className="narrative-interlude__actions">
          {!replay && chapter.id !== 'finale' && <button className="text-button" type="button" onClick={onDefer}>{deferLabel}</button>}
          <button
            className="primary-button"
            type="button"
            onClick={() => isLast ? onComplete() : setBeatIndex(index => index + 1)}
          >
            {isLast ? chapter.actionLabel : continueLabel}
          </button>
        </div>
      </div>
    </section>
  )
}
