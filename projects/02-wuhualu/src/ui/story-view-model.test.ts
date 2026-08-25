import { describe, expect, it } from 'vitest'
import rawContent from '../content/content.json'
import { hasArtifactExperienceV2 } from '../content/types.ts'
import { parseContent } from '../content/validate.ts'
import { buildStoryViewModel } from './story-view-model.ts'

const content = parseContent(rawContent)
const artifact = content.content.artifacts.find(({ id }) => id === 'artifact-zenghouyi-bells')
if (!artifact || !hasArtifactExperienceV2(artifact)) throw new Error('missing golden artifact')

describe('story view model', () => {
  it('keeps all five sourced sections and related artifacts in reading order', () => {
    const model = buildStoryViewModel(artifact, content.content.artifacts, content.sources)
    expect(model.kind).toBe('enhanced')
    if (model.kind !== 'enhanced') throw new Error('expected enhanced story')
    expect(model.sections.map(({ id }) => id)).toEqual(['first-look', 'making', 'lived-world', 'journey', 'why-now'])
    expect(model.sections.every(({ sources }) => sources.length > 0)).toBe(true)
    expect(model.related.map(({ artifactId }) => artifactId)).toEqual(['artifact-zenghouyi-zunpan', 'artifact-jiahu-flute'])
  })

  it('returns only existing facts for a legacy artifact', () => {
    const legacy = content.content.artifacts.find(({ id }) => id === 'artifact-zenghouyi-zunpan')
    if (!legacy) throw new Error('missing legacy artifact')
    const model = buildStoryViewModel(legacy, content.content.artifacts, content.sources)
    expect(model).toMatchObject({ kind: 'legacy', title: legacy.name })
    if (model.kind !== 'legacy') throw new Error('expected legacy story')
    expect(model.facts).toEqual([legacy.summary, legacy.highlight, legacy.culturalNote])
  })
})
