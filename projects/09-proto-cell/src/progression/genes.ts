import { getContent } from '../content'

export type GeneProgress = {
  genePoints: number
  unlockedIds: string[]
  discoveredSynergyIds: string[]
  completedModifierIds: string[]
  rewardCounts: Record<string, number>
}

export type GeneReward = {
  kind: 'synergy' | 'environment' | 'boss-path' | 'codex-complete' | 'modifier' | 'ending'
  id: string
  first: boolean
  repeats?: number
}

const FIRST_REWARDS: Record<GeneReward['kind'], number> = {
  synergy: 4,
  environment: 3,
  'boss-path': 6,
  'codex-complete': 3,
  modifier: 7,
  ending: 10,
}

export function awardGenes(progress: GeneProgress, rewards: readonly GeneReward[], options: { multiplier?: number } = {}): GeneProgress & { awarded: number } {
  const rawAward = rewards.reduce((sum, reward) => {
    const base = FIRST_REWARDS[reward.kind]
    return sum + (reward.first ? base : Math.max(1, Math.ceil(base / (2 + Math.max(0, reward.repeats ?? 0)))))
  }, 0)
  const awarded = rawAward === 0 ? 0 : Math.max(1, Math.round(rawAward * Math.max(0, options.multiplier ?? 1)))
  return {
    ...cloneProgress(progress),
    genePoints: progress.genePoints + awarded,
    rewardCounts: rewards.reduce((counts, reward) => {
      const key = `${reward.kind}:${reward.id}`
      counts[key] = (counts[key] ?? 0) + 1
      return counts
    }, { ...progress.rewardCounts }),
    awarded,
  }
}

export function unlockNode(progress: GeneProgress, nodeId: string): GeneProgress {
  const content = getContent()
  const node = content.geneNodes.find((item) => item.id === nodeId)
  if (!node) throw new RangeError(`Unknown gene node: ${nodeId}`)
  const unlockedNodes = new Set<string>(content.geneNodes.filter((candidate) => (
    candidate.unlockIds.every((id) => progress.unlockedIds.includes(id))
  )).map((candidate) => candidate.id))
  if (!node.requires.every((required) => unlockedNodes.has(required))) throw new RangeError(`Gene prerequisite is locked: ${nodeId}`)
  if (progress.genePoints < node.cost) throw new RangeError(`Insufficient gene points for: ${nodeId}`)
  if (node.unlockIds.every((id) => progress.unlockedIds.includes(id))) return cloneProgress(progress)
  return {
    ...cloneProgress(progress),
    genePoints: progress.genePoints - node.cost,
    unlockedIds: [...new Set([...progress.unlockedIds, ...node.unlockIds])],
  }
}

function cloneProgress(progress: GeneProgress): GeneProgress {
  return {
    genePoints: progress.genePoints,
    unlockedIds: [...progress.unlockedIds],
    discoveredSynergyIds: [...progress.discoveredSynergyIds],
    completedModifierIds: [...progress.completedModifierIds],
    rewardCounts: { ...progress.rewardCounts },
  }
}
