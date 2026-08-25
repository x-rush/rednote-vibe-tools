import type { Artifact, CompleteArtifact, SourceRecord, StorySectionId } from '../content/types.ts'

type ResolvedSource = Pick<SourceRecord, 'id' | 'title' | 'url' | 'level'>

export type StoryViewModel = {
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

export function buildStoryViewModel(
  artifact: CompleteArtifact,
  artifacts: readonly Artifact[],
  sources: readonly SourceRecord[],
): StoryViewModel {
  const sourceMap = new Map(sources.map(source => [source.id, source]))
  const artifactMap = new Map(artifacts.map(item => [item.id, item]))
  return {
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
