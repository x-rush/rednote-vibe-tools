import type { Artifact } from '../content/types.ts'

export type ArtifactAssetNature = '创意重构' | '创意重构（限定视角）' | '创意重构（非数字复原）'

export type RuntimeArtifactAssets = {
  reveal: string
  silhouette: string
  thumbnail: string
  clues: readonly string[]
  width: number
  height: number
  nature: ArtifactAssetNature
}

const asset = (path: string) => `${import.meta.env.BASE_URL}assets/${path}`

const runtimeAssets: Readonly<Record<string, RuntimeArtifactAssets>> = {
  'artifact-eagle-tripod': entry('artifact-eagle-tripod', 'reveal-creative-reconstruction-v1.webp', ['clue-crop-support.webp', 'clue-crop-opening.webp']),
  'artifact-face-fish-basin': entry('artifact-face-fish-basin', 'reveal-creative-reconstruction-v1.webp', ['clue-crop-face-fish.webp']),
  'artifact-jiahu-flute': entry('artifact-jiahu-flute', 'reveal-creative-reconstruction-v2.webp', ['clue-crop-holes.webp', 'clue-crop-bone-surface.webp']),
  'artifact-jade-dragon': entry('artifact-jade-dragon', 'reveal-creative-reconstruction-v2.webp', ['clue-crop-mane.webp', 'clue-crop-suspension.webp']),
  'artifact-houmuwu-ding': entry('artifact-houmuwu-ding', 'reveal-creative-reconstruction-v2.webp', ['clue-crop-handles-rim.webp', 'clue-crop-four-legs-flanges.webp']),
  'artifact-four-ram-zun': entry('artifact-four-ram-zun', 'reveal-creative-reconstruction-v1.webp', ['clue-crop-ram-body-fusion.webp', 'clue-crop-square-rim-flanges.webp'], '创意重构（限定视角）'),
  'artifact-lotus-crane-hu': entry('artifact-lotus-crane-hu', 'reveal-creative-reconstruction-v2.webp', ['clue-crop-two-legged-crane-lotus.webp', 'clue-crop-two-supporting-beasts.webp']),
  'artifact-cloud-bronze-jin': entry('artifact-cloud-bronze-jin', 'reveal-creative-reconstruction-v3.webp', ['clue-crop-attached-beasts.webp', 'clue-crop-openwork-supports.webp']),
  'artifact-zenghouyi-bells': entry('artifact-zenghouyi-bells', 'reveal-creative-reconstruction-v1.webp', ['clue-crop-l-frame-three-tiers.webp', 'clue-crop-small-to-large-bells.webp'], '创意重构（非数字复原）'),
  'artifact-zenghouyi-zunpan': entry('artifact-zenghouyi-zunpan', 'reveal-creative-reconstruction-v2.webp', ['clue-crop-openwork-climbing-beasts.webp', 'clue-crop-zun-in-wide-pan.webp'], '创意重构（非数字复原）'),
}

function entry(
  id: string,
  reveal: string,
  clues: readonly string[],
  nature: ArtifactAssetNature = '创意重构',
): RuntimeArtifactAssets {
  const root = `artifacts/${id}`
  return {
    reveal: asset(`${root}/${reveal}`),
    silhouette: asset(`${root}/silhouette-verified.svg`),
    thumbnail: asset(`${root}/thumb.webp`),
    clues: clues.map(path => asset(`${root}/${path}`)),
    width: 900,
    height: 1125,
    nature,
  }
}

export const playableArtifactIds = Object.freeze(Object.keys(runtimeAssets))
const playableArtifactIdSet = new Set(playableArtifactIds)

export function isPlayableArtifactId(id: string): boolean {
  return playableArtifactIdSet.has(id)
}

export function filterPlayableArtifacts(artifacts: readonly Artifact[]): Artifact[] {
  return artifacts.filter(({ id }) => isPlayableArtifactId(id))
}

export function getRuntimeArtifactAssets(id: string): RuntimeArtifactAssets | undefined {
  return runtimeAssets[id]
}

export function selectClueAsset(id: string, revealedClueCount: number): string | undefined {
  const assets = getRuntimeArtifactAssets(id)
  if (!assets || assets.clues.length === 0) return undefined
  const index = Math.min(Math.max(revealedClueCount - 1, 0), assets.clues.length - 1)
  return assets.clues[index]
}
