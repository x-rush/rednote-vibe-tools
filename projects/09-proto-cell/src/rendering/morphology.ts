import { getContent, type BodyStage, type FormId } from '../content'
import type { BuildState, EvolutionRoute } from '../evolution/build'

export type MorphologySilhouette = 'amoeba' | 'swimmer' | 'spark' | 'vesicle' | 'hunter' | 'boss' | 'colony' | 'ciliate'
export type MorphologyProfile = {
  bodyStage: BodyStage
  dominantRoute: EvolutionRoute
  silhouette: MorphologySilhouette
  parts: string[]
  installedTraitCount: number
  membraneScale: number
  coreCount: number
  skeleton: 'primal' | 'colony' | 'ciliate' | MorphologySilhouette
}

const ROUTES: readonly EvolutionRoute[] = ['predation', 'survival', 'colony']

export function morphologyFor(build: BuildState): MorphologyProfile
export function morphologyFor(formId: FormId, build: BuildState): MorphologyProfile
export function morphologyFor(formOrBuild: FormId | BuildState, providedBuild?: BuildState): MorphologyProfile {
  const explicitForm = typeof formOrBuild === 'string' ? formOrBuild : undefined
  const build = providedBuild ?? formOrBuild as BuildState
  const dominantRoute = ROUTES.reduce((best, route) => build.routeCounts[route] > build.routeCounts[best] ? route : best, ROUTES[0])
  const content = getContent()
  const definitions = new Map(content.organelles.map((organ) => [organ.id, organ]))
  const visibleTraitCapacity = 6 + content.lineage.maxInheritedOrgans
  const parts = build.traitIds.flatMap((traitId) => definitions.get(traitId)?.morphologyPartId ?? []).slice(-visibleTraitCapacity)
  // The oral groove belongs to the body skeleton, so it never displaces an organ.
  const formParts = explicitForm === 'form-ciliate-composite' && !parts.includes('oral-groove') ? ['oral-groove', ...parts] : parts
  const skeleton = explicitForm === 'form-primal-cell' ? 'primal'
    : explicitForm === 'form-colony-body' ? 'colony'
      : explicitForm === 'form-ciliate-composite' ? 'ciliate'
        : silhouetteFor(build.bodyStage, dominantRoute)
  return {
    bodyStage: build.bodyStage,
    dominantRoute,
    silhouette: skeleton === 'primal' ? 'amoeba' : skeleton,
    parts: formParts,
    installedTraitCount: build.traitIds.length,
    membraneScale: 1,
    coreCount: explicitForm === 'form-colony-body' ? 3 : (dominantRoute === 'colony' && build.bodyStage !== 'microbe') ? 2 : 1,
    skeleton,
  }
}

function silhouetteFor(stage: BodyStage, route: EvolutionRoute): MorphologySilhouette {
  if (stage === 'microbe') return 'amoeba'
  if (stage === 'hunter') return route === 'survival' ? 'vesicle' : route === 'colony' ? 'spark' : 'swimmer'
  if (stage === 'specialist') return route === 'predation' ? 'hunter' : route === 'survival' ? 'vesicle' : 'spark'
  if (stage === 'dominant') return route === 'colony' ? 'spark' : 'hunter'
  return 'boss'
}
