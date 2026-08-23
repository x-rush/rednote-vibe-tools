import type {
  Artifact,
  ArtifactCategory,
  ArtifactDetailViewModel,
  CollectionEntry,
  QuizSession,
  RoundSummaryViewModel,
} from '../content/types.ts'

export function buildArtifactDetailViewModel(
  artifact: Artifact,
  entry: CollectionEntry | undefined,
  categories: readonly ArtifactCategory[],
  verificationLabels: { verified: string; pending: string },
): ArtifactDetailViewModel {
  const categoryNames = artifact.categoryIds.map(id => categories.find(category => category.id === id)?.name ?? id)
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
