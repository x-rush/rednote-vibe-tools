import { describe, expect, it } from 'vitest'
import { getContent } from './index'
import { validateContent } from './validate'

describe('launch content completeness', () => {
  it('freezes the launch content counts and version', () => {
    const pack = getContent()

    expect(pack.contentVersion).toBe('1.0.0')
    expect(pack.environments).toHaveLength(6)
    expect(pack.nutrients).toHaveLength(6)
    expect(pack.organelles).toHaveLength(24)
    expect(pack.synergies).toHaveLength(12)
    expect(pack.creatures.filter((item) => item.id.startsWith('predator-'))).toHaveLength(8)
    expect(pack.creatures.filter((item) => item.id.startsWith('predator-') && item.role === 'elite')).toHaveLength(3)
    expect(pack.creatures.filter((item) => item.id.startsWith('predator-') && item.role !== 'elite')).toHaveLength(5)
    expect(pack.creatures.filter((item) => !item.id.startsWith('predator-'))).toHaveLength(18)
    expect(pack.events).toHaveLength(4)
    expect(pack.bosses).toHaveLength(3)
    expect(pack.origins).toHaveLength(3)
    expect(pack.modifiers).toHaveLength(8)
    expect(pack.endings).toHaveLength(3)
    expect(pack.deathTemplates.length).toBeGreaterThanOrEqual(12)
  })

  it('freezes every launch stable id', () => {
    const pack = getContent()
    const ids = (items: ReadonlyArray<{ id: string }>) => items.map((item) => item.id).sort()

    expect(ids(pack.environments)).toEqual(['env-abandoned-chamber', 'env-acid-vesicle', 'env-algae-glow', 'env-antibody-storm', 'env-clear-drop', 'env-fiber-maze'])
    expect(ids(pack.nutrients)).toEqual(['nutrient-gene-fragment', 'nutrient-lipid', 'nutrient-lumen', 'nutrient-mineral', 'nutrient-protein', 'nutrient-sugar'])
    expect(ids(pack.organelles)).toEqual([
      'organelle-acid-gland', 'organelle-bud-sac', 'organelle-cilia-ring', 'organelle-cleaner-symbiont', 'organelle-division-ring', 'organelle-echo-sac',
      'organelle-electric-sac', 'organelle-eye-spot', 'organelle-filter-gill', 'organelle-flagellum', 'organelle-guard-symbiont', 'organelle-jet-vacuole',
      'organelle-lure-symbiont', 'organelle-mucus-coat', 'organelle-needle-mouth', 'organelle-photosome', 'organelle-recombination-core', 'organelle-repair-vacuole',
      'organelle-shell-plate', 'organelle-shock-pulse', 'organelle-toxin-spine', 'organelle-transparent-membrane', 'organelle-vibration-cilia', 'organelle-wide-mouth',
    ])
    expect(ids(pack.synergies)).toEqual([
      'synergy-acid-feeder', 'synergy-clean-acid', 'synergy-echo-swarm', 'synergy-ghost-cilia', 'synergy-guardian-division', 'synergy-invisible-lure',
      'synergy-parasite-anchor', 'synergy-radar-grid', 'synergy-ram-jet', 'synergy-repair-shell', 'synergy-solar-filter', 'synergy-spore-cloud',
    ])
    expect(Object.fromEntries(pack.synergies.map((item) => [item.id, item.name]))).toEqual({
      'synergy-radar-grid': '雷达电网',
      'synergy-invisible-lure': '幽光陷阱',
      'synergy-ram-jet': '喷射冲角',
      'synergy-acid-feeder': '溶壳捕食',
      'synergy-parasite-anchor': '锚定寄生',
      'synergy-solar-filter': '藻光牧场',
      'synergy-spore-cloud': '芽生毒群',
      'synergy-echo-swarm': '群体回声',
      'synergy-repair-shell': '再生甲',
      'synergy-clean-acid': '酸域共生',
      'synergy-ghost-cilia': '幽灵纤毛',
      'synergy-guardian-division': '留种',
    })
    expect(ids(pack.events)).toEqual(['event-acid-leak', 'event-antibody-sweep', 'event-giant-passage', 'event-nutrient-bloom'])
    expect(ids(pack.bosses)).toEqual(['boss-abandoned-host', 'boss-antibody-crown', 'boss-membrane-queen'])
    expect(ids(pack.origins)).toEqual(['origin-armored-spore', 'origin-ciliate-seed', 'origin-primal-cell'])
    expect(ids(pack.modifiers)).toEqual([
      'modifier-alert-predators', 'modifier-elite-ecosystem', 'modifier-fragile-membrane', 'modifier-low-energy',
      'modifier-no-merge', 'modifier-permanent-turbidity', 'modifier-rising-acid', 'modifier-three-organs',
    ])
    expect(ids(pack.endings)).toEqual(['ending-host-takeover', 'ending-stable-species', 'ending-swarm-mind'])
    expect(ids(pack.creatures)).toEqual([
      'creature-acid-bubble', 'creature-algae-speck', 'creature-antibody-fragment', 'creature-cavity-scavenger', 'creature-drifter', 'creature-fiber-float',
      'creature-fiber-scavenger', 'creature-host-droplet', 'creature-lumen-drifter', 'creature-mimic-drifter', 'creature-mineral-scavenger', 'creature-pollen-float',
      'creature-ring-swarm', 'creature-spark-swarm', 'creature-spore-drifter', 'creature-thread-grazer', 'creature-vesicle-flee', 'creature-vesicle-scavenger',
      'predator-acid-needle', 'predator-antibody-leech', 'predator-azure-ring', 'predator-chamber-maw', 'predator-crown-sentinel', 'predator-fiber-stalker',
      'predator-glow-siphon', 'predator-membrane-warden',
    ])
  })

  it('gives every organ launch coverage and every hostile a readable response', () => {
    const pack = getContent()
    const synergyOrganIds = new Set(pack.synergies.flatMap((item) => [...item.requires, ...(item.augments ?? []).map((augment) => augment.organId)]))

    expect(validateContent(pack).issues).toEqual([])
    const categoryCounts = new Map<string, number>()
    for (const organ of pack.organelles) categoryCounts.set(organ.category, (categoryCounts.get(organ.category) ?? 0) + 1)
    expect([...categoryCounts.values()]).toEqual([3, 3, 3, 3, 3, 3, 3, 3])
    for (const organ of pack.organelles) {
      expect(organ.environmentIds.length, organ.id).toBeGreaterThan(0)
      expect(synergyOrganIds.has(organ.id), organ.id).toBe(true)
    }
    for (const creature of pack.creatures.filter((item) => item.role === 'hunter' || item.role === 'parasite' || item.role === 'elite')) {
      expect(creature.warningCueId, creature.id).toBeTruthy()
      expect(creature.responseTags.length, creature.id).toBeGreaterThanOrEqual(2)
    }
    for (const boss of pack.bosses) {
      expect(boss.resolutionPaths.length, boss.id).toBeGreaterThanOrEqual(3)
      expect(boss.resolutionPaths.some((path) => path !== 'combat'), boss.id).toBe(true)
    }
  })

  it('covers the three ecology groups and every environment spawn role', () => {
    const pack = getContent()
    const ordinary = pack.creatures.filter((item) => !item.id.startsWith('predator-'))
    const byCreatureId = new Map(pack.creatures.map((item) => [item.id, item]))
    const bySpawnId = new Map<string, (typeof pack.spawnTables)[number]>(pack.spawnTables.map((item) => [item.id, item]))

    expect(ordinary.filter((item) => item.role === 'resource')).toHaveLength(6)
    expect(ordinary.filter((item) => item.role === 'prey')).toHaveLength(6)
    expect(ordinary.filter((item) => item.role === 'scavenger' || item.role === 'swarm' || item.role === 'parasite')).toHaveLength(6)
    for (const environment of pack.environments) {
      const spawned = (bySpawnId.get(environment.spawnTableId)?.entries ?? []).flatMap((entry) => byCreatureId.get(entry.creatureId) ?? [])
      expect(spawned.some((item) => item.role === 'resource'), `${environment.id}:resource`).toBe(true)
      expect(spawned.some((item) => item.role === 'prey'), `${environment.id}:prey`).toBe(true)
      expect(spawned.some((item) => item.role === 'hunter' || item.role === 'parasite' || item.role === 'elite'), `${environment.id}:hostile`).toBe(true)
    }
    for (const behavior of ['wander', 'forage', 'flee', 'flock', 'compete', 'ambush', 'track', 'attach', 'scavenge', 'guard', 'injured', 'opportunistic']) {
      expect(pack.creatures.some((item) => item.behaviorId.includes(behavior)), behavior).toBe(true)
    }
  })

  it('maps every visual content id and covers every frozen death cause', () => {
    const pack = getContent()
    const visualIds = new Set(pack.visualRecipes.map((item) => item.id))
    for (const organ of pack.organelles) expect(organ.visualMutationId).toBe(`visual-${organ.id}`)
    for (const synergy of pack.synergies) expect(synergy.visualMutationId).toBe(`visual-${synergy.id}`)
    for (const origin of pack.origins) expect(origin.visualRecipeId).toBe(`visual-${origin.id}`)
    for (const boss of pack.bosses) expect(boss.visualRecipeId).toBe(`visual-${boss.id}`)
    for (const item of [...pack.environments, ...pack.events, ...pack.modifiers]) expect(visualIds.has(`visual-${item.id}`), item.id).toBe(true)

    const causeTags = [
      ['engulfed'], ['ruptured'], ['acid'], ['energy', 'exhausted'], ['antibody', 'locked'], ['parasite'],
      ['split', 'uncontrolled'], ['organelle', 'instability'], ['chamber', 'crush'], ['boss', 'attack'], ['lure', 'ambush'], ['risk', 'failed'],
    ]
    for (const tags of causeTags) expect(pack.deathTemplates.some((item) => tags.every((tag) => item.requiredTags?.includes(tag))), tags.join('+')).toBe(true)
  })

  it('uses the four-region launch route pacing', () => {
    const pack = getContent()
    const byId = new Map(pack.environments.map((item) => [item.id, item]))

    expect(byId.get('env-clear-drop')?.durationTargetSec).toEqual([110, 130])
    expect(byId.get('env-abandoned-chamber')?.durationTargetSec).toEqual([120, 240])
    for (const id of ['env-algae-glow', 'env-acid-vesicle', 'env-fiber-maze', 'env-antibody-storm'] as const) {
      expect(byId.get(id)?.durationTargetSec, id).toEqual([120, 180])
    }
  })
})
