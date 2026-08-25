import { describe, expect, it } from 'vitest'
import rawContent from '../content/content.json'
import { parseContent } from '../content/validate.ts'
import { buildSetCollectionViewModel } from './catalog.ts'

const content = parseContent(rawContent)

describe('set collection catalog', () => {
  it('groups all twenty artifacts into five four-item archive sets', () => {
    const model = buildSetCollectionViewModel(content.content.artifacts, [], content.content.sets)
    expect(model).toHaveLength(5)
    expect(model.every(({ artifacts }) => artifacts.length === 4)).toBe(true)
    expect(model.flatMap(({ artifacts }) => artifacts)).toHaveLength(20)
    expect(model.every(({ archivedCount, complete }) => archivedCount === 0 && !complete)).toBe(true)
  })

  it('orders each set by the global timeline and counts unlocked entries', () => {
    const first = content.content.artifacts[0]
    const collection = [{ artifactId: first.id, bestStars: 3 as const, unlockedAt: '2026-08-25T00:00:00.000Z' }]
    const model = buildSetCollectionViewModel(content.content.artifacts, collection, content.content.sets)
    expect(model[0].archivedCount).toBe(1)
    expect(model[0].artifacts[0]).toMatchObject({ id: first.id, unlocked: true, bestStars: 3 })
    expect(model[0].artifacts.map(({ timelineOrder }) => timelineOrder)).toEqual([...model[0].artifacts.map(({ timelineOrder }) => timelineOrder)].sort((a, b) => a - b))
  })
})
