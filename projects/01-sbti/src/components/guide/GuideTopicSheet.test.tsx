import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import rawContent from '../../content/content.json'
import { validateContent } from '../../content/validate'
import { GuideTopicSheet } from './GuideTopicSheet'

const guide = validateContent(rawContent).content.experience.guide

describe('GuideTopicSheet', () => {
  it('renders three preset questions and the first answer without free input', () => {
    const topics = guide.quizCompanion.topics
    const html = renderToStaticMarkup(
      <GuideTopicSheet title={guide.quizCompanion.title} name={guide.name} role={guide.role} topics={topics} onClose={vi.fn()} />,
    )

    for (const topic of topics) expect(html).toContain(topic.label)
    expect(html).toContain(topics[0].answer)
    expect(html).not.toContain(topics[1].answer)
    expect(html).not.toContain('<textarea')
    expect(html).toContain('aria-pressed="true"')
    expect(html).not.toContain('role="tablist"')
    expect(html).toContain(`${guide.role} · ${guide.name}`)
  })

  it('renders the three result-reading questions as selectable topics', () => {
    const topics = guide.resultHelp.topics
    const html = renderToStaticMarkup(
      <GuideTopicSheet title={guide.resultHelp.title} name={guide.name} role={guide.role} topics={topics} onClose={vi.fn()} />,
    )
    for (const topic of topics) expect(html).toContain(topic.label)
    expect(html).toContain(topics[0].answer)
    expect(html).not.toContain(topics[1].answer)
  })
})
