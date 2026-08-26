import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { getTopicArtwork } from '../app/presentation'
import { getRelationshipBank } from '../content/bank'
import rawContent from '../content/content.json'
import type { NpcCue, RelationshipContentPackage } from '../content/schema'
import { QuestionSheet } from './QuestionSheet'

const content = rawContent as unknown as RelationshipContentPackage
const question = getRelationshipBank(content, 'close-relationship').questions[0]
const cue = content.content.npcCues.find((item) => item.trigger === 'chapter-intro' && item.category === question.category) as NpcCue
const commonProps = {
  question,
  selectedIds: [],
  activeTopic: getTopicArtwork(question.category),
  topicIndex: 0,
  questionIndex: 0,
  questionCount: 21,
  onSelect: () => undefined,
}

describe('QuestionSheet NPC rail', () => {
  it('describes every valid expression without claiming there are two options', () => {
    const html = renderToStaticMarkup(<QuestionSheet {...commonProps} />)

    expect(html).toContain('每种表达都值得尊重')
    expect(html).not.toContain('两种表达')
  })

  it('shows the chapter reminder inside the first question header', () => {
    const html = renderToStaticMarkup(<QuestionSheet {...commonProps} npcCue={cue} showNpcMessage />)

    expect(html).toContain('question-sheet__npc-message')
    expect(html).toContain(cue.text)
    expect(html.indexOf(cue.text)).toBeLessThan(html.indexOf(question.sceneLead))
  })

  it('keeps only the quiet avatar on later questions', () => {
    const html = renderToStaticMarkup(<QuestionSheet {...commonProps} questionIndex={1} npcCue={cue} showNpcMessage={false} />)

    expect(html).toContain('question-sheet__npc--quiet')
    expect(html).toContain('小满，关系卡片整理员')
    expect(html).not.toContain(cue.text)
  })
})
