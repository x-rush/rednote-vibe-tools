import type { ChapterDefinition, GuideCopy } from '../content/types'
import { GuideSheet } from './guide/GuideSheet'

export type ChapterInterludeProps = {
  mode: 'start' | 'end'
  chapter: ChapterDefinition
  copy: GuideCopy
  onComplete: () => void
}

export function ChapterInterlude({ mode, chapter, copy, onComplete }: ChapterInterludeProps) {
  const line = mode === 'start' ? copy.chapterStart[chapter.id] : copy.chapterEnd[chapter.id]
  if (!line) return null
  return (
    <div className="chapter-interlude" data-state={mode}>
      <GuideSheet
        title={`卷${chapter.order} · ${chapter.name}`}
        name={copy.name}
        role={copy.role}
        lines={[line]}
        portrait
        portraitVariant="pass-scroll"
        primaryLabel={mode === 'start' ? '展开此卷' : '收好此卷'}
        secondaryLabel="跳过过场"
        onPrimary={onComplete}
        onSecondary={onComplete}
        onClose={onComplete}
      />
    </div>
  )
}
