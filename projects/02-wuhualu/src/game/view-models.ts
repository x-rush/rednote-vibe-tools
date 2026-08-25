import type {
  Artifact,
  ArtifactCategory,
  ArtifactDetailViewModel,
  CollectionEntry,
  QuizSession,
  RoundSummaryViewModel,
  SourceRecord,
} from '../content/types.ts'
import { isCompleteArtifact } from '../content/types.ts'

export function buildArtifactDetailViewModel(
  artifact: Artifact,
  entry: CollectionEntry | undefined,
  categories: readonly ArtifactCategory[],
  verificationLabels: { verified: string; pending: string },
  context: { artifacts: readonly Artifact[]; sources: readonly SourceRecord[] },
): ArtifactDetailViewModel {
  const categoryNames = artifact.categoryIds.map(id => categories.find(category => category.id === id)?.name ?? id)
  const artifactMap = new Map(context.artifacts.map(item => [item.id, item]))
  const sourceMap = new Map(context.sources.map(source => [source.id, source]))
  const editorial = isCompleteArtifact(artifact) ? {
    hook: artifact.experienceV2.storyHook,
    evidence: artifact.experienceV2.observationSpots.map(spot => ({
      id: spot.id,
      label: spot.label,
      note: spot.note,
      category: spot.clueCategory,
    })),
    chapters: [
      { id: 'form-and-craft' as const, sections: artifact.experienceV2.story.slice(0, 2) },
      { id: 'lived-world' as const, sections: artifact.experienceV2.story.slice(2, 3) },
      { id: 'journey-to-now' as const, sections: artifact.experienceV2.story.slice(3, 5) },
    ],
    related: artifact.experienceV2.relatedArtifacts.flatMap(related => {
      const item = artifactMap.get(related.artifactId)
      return item ? [{ ...related, name: item.name }] : []
    }),
    sources: [...new Set(artifact.experienceV2.story.flatMap(section => section.sourceIds))].flatMap(id => {
      const source = sourceMap.get(id)
      return source ? [{ id: source.id, title: source.title, url: source.url, level: source.level }] : []
    }),
  } : null
  return {
    id: artifact.id,
    title: artifact.name,
    aliases: artifact.aliases,
    subtitle: `${artifact.period} · ${artifact.material}`,
    categoryNames,
    facts: [artifact.summary, artifact.highlight, artifact.culturalNote],
    dimensions: artifact.dimensions,
    excavation: artifact.excavation,
    museum: artifact.museum,
    asset: artifact.assetRefs,
    unlocked: Boolean(entry),
    bestStars: entry?.bestStars ?? 0,
    verificationLabel: artifact.factCheckStatus === 'verified-from-provided-source' ? verificationLabels.verified : verificationLabels.pending,
    sourceNote: artifact.sourceNote,
    editorial,
  }
}

function calculateBestStreak(session: QuizSession): number {
  let streak = 0
  let best = 0
  for (const answer of session.answers) {
    streak = answer.correct ? streak + 1 : 0
    best = Math.max(best, streak)
  }
  return best
}

export function buildRoundSummaryViewModel(
  session: QuizSession,
  labels: { title: string; perfect: string; high: string; mid: string; low: string },
): RoundSummaryViewModel {
  const correctCount = session.answers.filter(({ correct }) => correct).length
  const earnedStars = session.answers.reduce((total, { stars }) => total + stars, 0)
  const collectorTitle = correctCount === session.answers.length
    ? labels.perfect
    : correctCount >= 4
      ? labels.high
      : correctCount >= 2
        ? labels.mid
        : labels.low
  return {
    title: labels.title,
    score: session.score,
    correctCount,
    totalCount: session.answers.length,
    bestStreak: calculateBestStreak(session),
    earnedStars,
    unlockedArtifactIds: session.answers.map(({ artifactId }) => artifactId),
    collectorTitle,
  }
}
