import type { Artifact, SourceRecord, StorySectionId } from '../content/types.ts'
import { hasArtifactExperienceV2 } from '../content/types.ts'

type ResolvedSource = Pick<SourceRecord, 'id' | 'title' | 'url' | 'level'>

export type EnhancedStoryViewModel = {
  kind: 'enhanced'
  title: string
  hook: string
  sections: {
    id: StorySectionId
    title: string
    body: string
    narrativeMode: 'verified-fact' | 'bounded-context' | 'open-question'
    sources: ResolvedSource[]
  }[]
  related: { artifactId: string; name: string; reason: string }[]
  factCheckStatus: 'verified' | 'mixed-with-bounded-context' | 'pending'
}

export type LegacyStoryViewModel = {
  kind: 'legacy'
  title: string
  facts: string[]
  sourceNote: string
}

export type StoryViewModel = EnhancedStoryViewModel | LegacyStoryViewModel

export function buildStoryViewModel(
  artifact: Artifact,
  artifacts: readonly Artifact[],
  sources: readonly SourceRecord[],
): StoryViewModel {
  if (!hasArtifactExperienceV2(artifact)) {
    return {
      kind: 'legacy',
      title: artifact.name,
      facts: [artifact.summary, artifact.highlight, artifact.culturalNote],
      sourceNote: artifact.sourceNote,
    }
  }
  const sourceMap = new Map(sources.map(source => [source.id, source]))
  const artifactMap = new Map(artifacts.map(item => [item.id, item]))
  return {
    kind: 'enhanced',
    title: artifact.name,
    hook: artifact.experienceV2.storyHook,
    sections: artifact.experienceV2.story.map(section => ({
      ...section,
      sources: section.sourceIds.flatMap(id => {
        const source = sourceMap.get(id)
        return source ? [{ id: source.id, title: source.title, url: source.url, level: source.level }] : []
      }),
    })),
    related: artifact.experienceV2.relatedArtifacts.flatMap(related => {
      const item = artifactMap.get(related.artifactId)
      return item ? [{ ...related, name: item.name }] : []
    }),
    factCheckStatus: artifact.experienceV2.storyFactCheckStatus,
  }
}
