import type { ContentPack } from './schema'

const organelleNames = [
  'eye-spot', 'echo-sac', 'vibration-cilia', 'flagellum', 'cilia-ring', 'jet-vacuole', 'wide-mouth', 'needle-mouth',
  'filter-gill', 'shell-plate', 'transparent-membrane', 'mucus-coat', 'electric-sac', 'toxin-spine', 'shock-pulse',
  'photosome', 'acid-gland', 'repair-vacuole', 'division-ring', 'bud-sac', 'recombination-core', 'cleaner-symbiont',
  'lure-symbiont', 'guard-symbiont',
] as const
const synergyNames = ['radar-grid', 'invisible-lure', 'ram-jet', 'acid-feeder', 'parasite-anchor', 'solar-filter', 'spore-cloud', 'echo-swarm', 'repair-shell', 'clean-acid', 'ghost-cilia', 'guardian-division'] as const
const eventNames = ['nutrient-bloom', 'acid-leak', 'antibody-sweep', 'giant-passage'] as const
const originNames = ['primal-cell', 'ciliate-seed', 'armored-spore'] as const
const modifierNames = ['permanent-turbidity', 'low-energy', 'alert-predators', 'rising-acid', 'three-organs', 'no-merge', 'fragile-membrane', 'elite-ecosystem'] as const
const environmentNames = ['clear-drop', 'algae-glow', 'acid-vesicle', 'fiber-maze', 'antibody-storm', 'abandoned-chamber'] as const
const bossNames = ['membrane-queen', 'antibody-crown', 'abandoned-host'] as const

export const assetRegistry: Readonly<Record<string, string>> = Object.freeze({
  ...Object.fromEntries(organelleNames.map((name) => [`organelle-${name}`, `/assets/icons/organelle-${name}.svg`])),
  ...Object.fromEntries(synergyNames.map((name) => [`synergy-${name}`, `/assets/icons/synergy-${name}.svg`])),
  ...Object.fromEntries(eventNames.map((name) => [`event-${name}`, `/assets/icons/event-${name}.svg`])),
  ...Object.fromEntries(originNames.map((name) => [`origin-${name}`, `/assets/icons/origin-${name}.svg`])),
  ...Object.fromEntries(modifierNames.map((name) => [`modifier-${name}`, `/assets/icons/modifier-${name}.svg`])),
  ...Object.fromEntries(environmentNames.map((name) => [`env-${name}`, `/assets/environments/env-${name}.svg`])),
  ...Object.fromEntries(bossNames.flatMap((name) => ([
    [`boss-${name}:body`, `/assets/bosses/boss-${name}-body.svg`],
    [`boss-${name}:mask`, `/assets/bosses/boss-${name}-mask.svg`],
  ]))),
  'ui-lab-frame': '/assets/ui/lab-frame.svg',
  'ui-archive-frame': '/assets/ui/archive-frame.svg',
  'ui-gene-node': '/assets/ui/gene-node.svg',
  'ui-codex-frame': '/assets/ui/codex-frame.svg',
})

export function collectAssetIds(content: ContentPack): string[] {
  return [
    ...content.organelles.map((item) => item.id),
    ...content.synergies.map((item) => item.id),
    ...content.events.map((item) => item.id),
    ...content.origins.map((item) => item.id),
    ...content.modifiers.map((item) => item.id),
    ...content.environments.map((item) => item.id),
    ...content.bosses.flatMap((item) => [`${item.id}:body`, `${item.id}:mask`]),
    'ui-lab-frame', 'ui-archive-frame', 'ui-gene-node', 'ui-codex-frame',
  ]
}

export function assetPath(id: string): string | undefined {
  return assetRegistry[id]
}
