import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import rawContent from '../content/content.json'
import { validateContent } from '../content/validate'
import { ChapterInterlude } from './ChapterInterlude'

const content = validateContent(rawContent)

it('renders the chapter-start copy with equivalent complete and skip actions', () => {
  const chapter = content.content.chapters.find((item) => item.id === 'trace')!
  const html = renderToStaticMarkup(
    <ChapterInterlude mode="start" chapter={chapter} copy={content.content.experience.guide} onComplete={vi.fn()} />,
  )

  expect(html).toContain(content.content.experience.guide.chapterStart.trace)
  expect(html).toContain('展开此卷')
  expect(html).toContain('跳过过场')
  expect(html).toContain('data-state="start"')
})
