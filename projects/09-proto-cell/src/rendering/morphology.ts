import { getContent, type BodyStage } from '../content'
import type { BuildState, EvolutionRoute } from '../evolution/build'

export type MorphologySilhouette = 'amoeba' | 'swimmer' | 'spark' | 'vesicle' | 'hunter' | 'boss'
export type MorphologyProfile = {
  bodyStage: BodyStage
  dominantRoute: EvolutionRoute
  silhouette: MorphologySilhouette
  parts: string[]
  installedTraitCount: number
  membraneScale: number
  coreCount: number
}

const ROUTES: readonly EvolutionRoute[] = ['predation', 'survival', 'colony']

export function morphologyFor(build: BuildState): MorphologyProfile {
  const dominantRoute = ROUTES.reduce((best, route) => build.routeCounts[route] > build.routeCounts[best] ? route : best, ROUTES[0])
  const definitions = new Map(getContent().organelles.map((organ) => [organ.id, organ]))
  const parts = build.traitIds.flatMap((traitId) => definitions.get(traitId)?.morphologyPartId ?? []).slice(-6)
  return {
    bodyStage: build.bodyStage,
    dominantRoute,
    silhouette: silhouetteFor(build.bodyStage, dominantRoute),
    parts,
    installedTraitCount: build.traitIds.length,
    membraneScale: build.bodyStage === 'ascendant' ? 1.1 : build.bodyStage === 'dominant' ? 1.06 : 1,
    coreCount: dominantRoute === 'colony' && build.bodyStage !== 'microbe' ? 2 : 1,
  }
}

function silhouetteFor(stage: BodyStage, route: EvolutionRoute): MorphologySilhouette {
  if (stage === 'microbe') return 'amoeba'
  if (stage === 'hunter') return route === 'survival' ? 'vesicle' : route === 'colony' ? 'spark' : 'swimmer'
  if (stage === 'specialist') return route === 'predation' ? 'hunter' : route === 'survival' ? 'vesicle' : 'spark'
  if (stage === 'dominant') return route === 'colony' ? 'spark' : 'hunter'
  return 'boss'
}
