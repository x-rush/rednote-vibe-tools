import { describe, expect, it } from 'vitest'
import rawContent from '../content/content.json'
import { isCompleteArtifact } from '../content/types.ts'
import { parseContent } from '../content/validate.ts'
import { filterPlayableArtifacts } from './artifact-assets.ts'
import { buildStoryViewModel } from './story-view-model.ts'

const content = parseContent(rawContent)
const artifact = content.content.artifacts.find(({ id }) => id === 'artifact-zenghouyi-bells')
if (!artifact || !isCompleteArtifact(artifact)) throw new Error('missing golden artifact')

describe('story view model', () => {
  it('keeps all five sourced sections and related artifacts in reading order', () => {
    const model = buildStoryViewModel(artifact, content.content.artifacts, content.sources)
    expect(model).not.toHaveProperty('kind')
    expect(model.sections.map(({ id }) => id)).toEqual(['first-look', 'making', 'lived-world', 'journey', 'why-now'])
    expect(model.sections.every(({ sources }) => sources.length > 0)).toBe(true)
    expect(model.related.map(({ artifactId }) => artifactId)).toEqual(['artifact-zenghouyi-zunpan', 'artifact-jiahu-flute'])
  })

  it('builds five sourced sections for every playable artifact', () => {
    for (const item of filterPlayableArtifacts(content.content.artifacts)) {
      const model = buildStoryViewModel(item, content.content.artifacts, content.sources)
      expect(model.sections, item.id).toHaveLength(5)
      expect(model.sections.every(({ sources }) => sources.length > 0), item.id).toBe(true)
      expect(model).not.toHaveProperty('kind')
    }
  })
})
