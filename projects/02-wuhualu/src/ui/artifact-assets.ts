import { isCompleteArtifact, type Artifact, type CompleteArtifact } from '../content/types.ts'

export type ArtifactAssetNature = '创意重构' | '创意重构（限定视角）' | '创意重构（非数字复原）'

export type RuntimeArtifactAssets = {
  observation: string
  observationWidth: number
  observationHeight: number
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
  'artifact-zenghouyi-bells': entry('artifact-zenghouyi-bells', 'reveal-creative-reconstruction-v1.webp', ['clue-crop-l-frame-three-tiers.webp', 'clue-crop-small-to-large-bells.webp'], '创意重构（非数字复原）', { file: 'reveal-wide-creative-reconstruction-v1.webp', width: 1200, height: 800 }),
  'artifact-zenghouyi-zunpan': entry('artifact-zenghouyi-zunpan', 'reveal-creative-reconstruction-v2.webp', ['clue-crop-openwork-climbing-beasts.webp', 'clue-crop-zun-in-wide-pan.webp'], '创意重构（非数字复原）'),
  'artifact-goujian-sword': entry('artifact-goujian-sword', 'reveal-creative-reconstruction.webp', ['clue-crop-diamond-pattern.webp', 'clue-crop-guard-pommel.webp'], '创意重构（限定视角）', { file: 'reveal-creative-reconstruction.webp', width: 1080, height: 1350 }),
  'artifact-bronze-rhino-zun': entry('artifact-bronze-rhino-zun', 'reveal-creative-reconstruction-v1.webp', ['clue-crop-horns-spout.webp', 'clue-crop-lid-inlay.webp']),
  'artifact-changxin-lamp': entry('artifact-changxin-lamp', 'reveal-creative-reconstruction.webp', ['clue-crop-sleeve-lamp.webp', 'clue-crop-kneeling-body.webp']),
  'artifact-liusheng-jade-suit': entry('artifact-liusheng-jade-suit', 'reveal-creative-reconstruction-v1.webp', ['clue-crop-head-torso.webp', 'clue-crop-wire-gloves.webp'], '创意重构（非数字复原）'),
  'artifact-boshan-incense-burner': entry('artifact-boshan-incense-burner', 'reveal-creative-reconstruction-v1.webp', ['clue-crop-mountain-vents.webp', 'clue-crop-dragon-base.webp'], '创意重构（限定视角）'),
}

function entry(
  id: string,
  reveal: string,
  clues: readonly string[],
  nature: ArtifactAssetNature = '创意重构',
  observation?: { file: string; width: number; height: number },
): RuntimeArtifactAssets {
  const root = `artifacts/${id}`
  const observationAsset = observation ?? { file: reveal, width: 900, height: 1125 }
  return {
    observation: asset(`${root}/${observationAsset.file}`),
    observationWidth: observationAsset.width,
    observationHeight: observationAsset.height,
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

export function findIncompletePlayableArtifactIds(artifacts: readonly Artifact[]): string[] {
  return artifacts
    .filter(artifact => isPlayableArtifactId(artifact.id) && !isCompleteArtifact(artifact))
    .map(({ id }) => id)
}

export function filterPlayableArtifacts(artifacts: readonly Artifact[]): CompleteArtifact[] {
  return artifacts.filter((artifact): artifact is CompleteArtifact => isPlayableArtifactId(artifact.id) && isCompleteArtifact(artifact))
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
