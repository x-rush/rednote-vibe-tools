import { describe, expect, it } from 'vitest'
import { circleBody, createTestEngine, entityAt, m1BossState, mutationContext } from '../tests/fixtures'
import { createEntity } from '../entities/factory'
import { bossTerminalEvent, contactDamageAt, contactDamageForPair, createGameEngine, endingForBossRewards, ensureSwarmPrimary, neutralizeResolvedBoss, runStableEntityPass, terminatePlayerEntities } from './engine'
import { installMutation, offerMutations } from '../evolution/mutation'
import { getContent } from '../content'
import { coveredRatio } from './containment'

describe('game engine lifecycle', () => {
  it('applies launch challenge rules to the live simulation', () => {
    const constrained = createGameEngine({
      seed: 727,
      environmentId: 'env-acid-vesicle',
      modifierIds: ['modifier-rising-acid', 'modifier-three-organs', 'modifier-elite-ecosystem'],
      route: ['env-algae-glow', 'env-fiber-maze'],
    })
    constrained.start()
    constrained.advance(1000 / 60)

    expect(constrained.evolutionSnapshot().capacity).toBe(3)
    expect(constrained.worldSnapshot().environmentField.safeRadius).toBeLessThan(92)

    for (const environmentId of ['env-algae-glow', 'env-acid-vesicle', 'env-fiber-maze', 'env-antibody-storm'] as const) {
      const eliteEcosystem = createGameEngine({ seed: 727, environmentId, modifierIds: ['modifier-elite-ecosystem'] })
      const elite = eliteEcosystem.renderSnapshot().entities.find((entity) => entity.id.startsWith('modifier-elite-'))
      expect(elite?.role, environmentId).toBe('elite')
      const definitionId = elite && 'definitionId' in elite ? String(elite.definitionId) : ''
      expect(getContent().creatures.find((creature) => creature.id === definitionId)?.environmentIds, environmentId).toContain(environmentId)
    }

    const routed = createGameEngine({ seed: 727, route: ['env-acid-vesicle', 'env-antibody-storm'] })
    expect(routed.renderSnapshot().routeRifts.map((rift) => rift.destinationEnvironmentId)).toEqual(['env-acid-vesicle'])
    const turbid = createGameEngine({ seed: 727, environmentId: 'env-algae-glow', modifierIds: ['modifier-permanent-turbidity'] })
    turbid.start()
    turbid.advance(1000 / 60)
    expect(turbid.worldSnapshot().environmentField.visibility).toBeLessThan(0.7)
  })
  it('loads the chosen destination inside the same run', () => {
    const engine = createGameEngine({ seed: 727, environmentId: 'env-acid-vesicle', initialElapsedMs: 130_000 })
    engine.start()
    expect(engine.renderSnapshot().bodyStage).toBe('microbe')
    const rift = engine.renderSnapshot().routeRifts[0]!
    const player = engine.renderSnapshot().entities.find((entity) => entity.id === 'player')!
    const organsBefore = engine.evolutionSnapshot().organelles
    player.position = { ...rift.position }
    player.body = circleBody(player.position, player.body.radius)

    engine.advance(1000 / 60)

    expect(engine.snapshot().environmentId).toBe(rift.destinationEnvironmentId)
    expect(engine.renderSnapshot().environmentId).toBe(rift.destinationEnvironmentId)
    expect(engine.renderSnapshot().bodyStage).toBe('hunter')
    expect(engine.evolutionSnapshot().organelles).toEqual(organsBefore)
    expect(engine.drainEvents()).toContainEqual(expect.objectContaining({
      type: 'route-selected',
      environmentId: rift.destinationEnvironmentId,
    }))
  })

  it('applies active environment damage through the normal event feed', () => {
    const engine = createGameEngine({ seed: 727, environmentId: 'env-acid-vesicle', initialElapsedMs: 3000 })
    engine.start()
    const hazard = Object.values(engine.worldSnapshot().environmentField.hazardCenters)[0]!
    const player = engine.renderSnapshot().entities.find((entity) => entity.id === 'player')!
    player.position = { ...hazard }
    player.body = circleBody(player.position, player.body.radius)
    const membrane = player.membrane

    engine.advance(1000 / 60)

    expect(engine.renderSnapshot().entities.find((entity) => entity.id === 'player')?.membrane).toBeLessThan(membrane)
    expect(engine.drainEvents()).toContainEqual(expect.objectContaining({ type: 'damaged', source: 'acid' }))
  })

  it('never lets split bodies fuse back after fatal environment damage', () => {
    const engine = createGameEngine({ seed: 727, environmentId: 'env-acid-vesicle', initialElapsedMs: 3000 })
    engine.start()
    const context = mutationContext({ organIds: ['organelle-division-ring'] })
    engine.applyMutation({
      installed: context.installed[0]!,
      organelles: context.installed,
      stability: context.stability,
      capacity: context.capacity,
      synergyIds: [],
    })
    const player = engine.renderSnapshot().entities.find((entity) => entity.id === 'player')!
    player.mass = 320
    player.membrane = 100
    engine.advance(1000 / 60)
    expect(engine.renderSnapshot().entities.filter((entity) => entity.faction === 'player')).toHaveLength(2)

    for (let index = 0; index < 70 && engine.renderSnapshot().entities.some((entity) => entity.faction === 'player' && entity.status === 'active'); index += 1) {
      const hazard = Object.values(engine.worldSnapshot().environmentField.hazardCenters)[0]!
      engine.renderSnapshot().entities.filter((entity) => entity.faction === 'player').forEach((body) => {
        body.membrane = 1
        body.position = { ...hazard }
        body.body = circleBody(body.position, body.body.radius)
      })
      engine.advance(1000 / 60)
    }

    expect(engine.renderSnapshot().entities.filter((entity) => entity.faction === 'player')).toEqual([])
    expect(engine.drainEvents()).toContainEqual(expect.objectContaining({ type: 'player-died', cause: 'environmental-rupture' }))
    engine.advance(1000)
    expect(engine.renderSnapshot().entities.filter((entity) => entity.faction === 'player')).toEqual([])
  })

  it('starts authored secondary events when they are the valid environment event', () => {
    const engine = createGameEngine({ seed: 727, environmentId: 'env-algae-glow', initialElapsedMs: 64_500 })
    engine.start()
    engine.advance(1000 / 60)

    expect(engine.worldSnapshot().activeEvent?.id).toBe('event-giant-passage')
    expect(engine.worldSnapshot().environmentField.visibility).toBeLessThan(0.7)
  })

  it('counts boss environment progress only while the boss overlaps the hazard', () => {
    const engine = createGameEngine({ seed: 727, environmentId: 'env-antibody-storm', initialElapsedMs: 99_000 })
    engine.start()
    engine.advance(1000 / 60)
    const bossState = engine.worldSnapshot().boss!
    const boss = engine.renderSnapshot().entities.find((entity) => entity.id === bossState.id)!
    Object.assign(bossState, { phase: 'feeding', hazardOverlapMs: 0 })
    boss.position = { x: 40, y: 1000 }
    boss.body = circleBody(boss.position, boss.body.radius)

    engine.advance(1000 / 60)
    expect(engine.worldSnapshot().boss?.hazardOverlapMs).toBe(0)

    const hazard = Object.values(engine.worldSnapshot().environmentField.hazardCenters)[0]!
    const movedBoss = engine.renderSnapshot().entities.find((entity) => entity.id === bossState.id)!
    movedBoss.position = { ...hazard }
    movedBoss.body = circleBody(movedBoss.position, movedBoss.body.radius)
    engine.advance(1000 / 60)
    expect(engine.worldSnapshot().boss?.hazardOverlapMs).toBeGreaterThan(0)
  })

  it('uses the selected launch origin definition and its initial passive organ', () => {
    const ciliate = createGameEngine({ seed: 727, environmentId: 'env-clear-drop', originId: 'origin-ciliate-seed' })
    const armored = createGameEngine({ seed: 727, environmentId: 'env-clear-drop', originId: 'origin-armored-spore' })

    expect(ciliate.snapshot().biomass).toBe(132)
    expect(ciliate.evolutionSnapshot().organelles).toContainEqual(expect.objectContaining({ id: 'organelle-cilia-ring' }))
    expect(armored.snapshot().biomass).toBe(156)
    expect(armored.evolutionSnapshot().organelles).toContainEqual(expect.objectContaining({ id: 'organelle-shell-plate' }))
  })

  it('does not advance while paused', () => {
    const engine = createTestEngine()
    engine.pause('visibility')
    engine.advance(1000)

    expect(engine.snapshot().elapsedMs).toBe(0)
  })

  it('advances in fixed steps only after start and resume', () => {
    const engine = createTestEngine()
    engine.advance(1000 / 30)
    const elapsed = engine.snapshot().elapsedMs
    engine.pause('user')
    engine.advance(100)
    engine.resume('user')
    engine.advance(1000 / 60)

    expect(elapsed).toBeCloseTo(1000 / 30)
    expect(engine.snapshot().elapsedMs).toBeCloseTo(50)
  })

  it('keeps momentum after release and turns through acceleration', () => {
    const engine = createTestEngine()
    engine.input.start({ x: 0, y: 0 })
    engine.input.move({ x: 120, y: 0 })
    engine.advance(100)
    const movingVelocity = engine.renderSnapshot().entities.find((entity) => entity.id === 'player')?.velocity.x ?? 0

    engine.input.end()
    engine.advance(1000 / 60)
    const releasedVelocity = engine.renderSnapshot().entities.find((entity) => entity.id === 'player')?.velocity.x ?? 0

    engine.input.start({ x: 0, y: 0 })
    engine.input.move({ x: -120, y: 0 })
    engine.advance(1000 / 60)
    const turningVelocity = engine.renderSnapshot().entities.find((entity) => entity.id === 'player')?.velocity.x ?? 0

    expect(movingVelocity).toBeGreaterThan(0)
    expect(releasedVelocity).toBeGreaterThan(0)
    expect(releasedVelocity).toBeLessThan(movingVelocity)
    expect(turningVelocity).toBeGreaterThan(-96)
  })

  it('pushes edible cells out of corners far enough for the larger player to engulf', () => {
    const engine = createTestEngine()
    const entities = engine.renderSnapshot().entities
    const player = entities.find((entity) => entity.id === 'player')!
    const food = entities.find((entity) => entity.id !== 'player' && entity.body.radius < 10)!
    player.mass = 400
    player.body = circleBody(player.position, 20)
    food.position = { x: food.body.radius, y: food.body.radius }
    food.body = circleBody(food.position, food.body.radius)

    engine.advance(1000 / 60)

    const movedFood = engine.renderSnapshot().entities.find((entity) => entity.id === food.id)!
    expect(movedFood.position.x).toBeGreaterThanOrEqual(20)
    expect(movedFood.position.y).toBeGreaterThanOrEqual(20)
  })

  it('keeps every corner finite and gives the player an escape velocity', () => {
    const directions = [
      { x: -1, y: -1 },
      { x: 1, y: -1 },
      { x: -1, y: 1 },
      { x: 1, y: 1 },
    ]

    for (const direction of directions) {
      const engine = createTestEngine()
      const snapshot = engine.renderSnapshot()
      const player = snapshot.entities.find((entity) => entity.id === 'player')!
      player.position = {
        x: direction.x < 0 ? player.body.radius : snapshot.width - player.body.radius,
        y: direction.y < 0 ? player.body.radius : snapshot.height - player.body.radius,
      }
      player.body = circleBody(player.position, player.body.radius)
      player.velocity = { x: direction.x * 80, y: direction.y * 80 }
      engine.input.start({ x: 0, y: 0 })
      engine.input.move({ x: direction.x * 120, y: direction.y * 120 })

      for (let step = 0; step < 300; step += 1) engine.advance(1000 / 60)

      const movedPlayer = engine.renderSnapshot().entities.find((entity) => entity.id === 'player')!
      expect(Number.isFinite(movedPlayer.position.x)).toBe(true)
      expect(Number.isFinite(movedPlayer.position.y)).toBe(true)
      expect(Math.abs(movedPlayer.velocity.x)).toBeGreaterThan(0)
      expect(Math.abs(movedPlayer.velocity.y)).toBeGreaterThan(0)
    }
  })

  it('replenishes a bounded food wave after the edible population is depleted', () => {
    const engine = createTestEngine()
    for (const entity of engine.renderSnapshot().entities) {
      if (entity.role === 'nutrient' || entity.role === 'prey') entity.status = 'engulfed'
    }

    for (let index = 0; index < 160; index += 1) engine.advance(1000 / 60)

    const replenished = engine.renderSnapshot().entities.filter((entity) => entity.id.startsWith('eco-food-'))
    const player = engine.renderSnapshot().entities.find((entity) => entity.id === 'player')!
    expect(replenished).toHaveLength(6)
    expect(replenished.every((entity) => entity.role === 'nutrient' || entity.role === 'prey')).toBe(true)
    expect(replenished.every((entity) => Math.hypot(entity.position.x - player.position.x, entity.position.y - player.position.y) >= 25)).toBe(true)
    expect(replenished.every((entity) => Math.hypot(
      entity.position.x - replenished[0]!.position.x,
      entity.position.y - replenished[0]!.position.y,
    ) <= 120)).toBe(true)
  })

  it('draws distant food into a local bloom when the player area becomes empty', () => {
    const engine = createTestEngine()
    const world = engine.renderSnapshot()
    const player = world.entities.find((entity) => entity.id === 'player')!
    for (const entity of world.entities) {
      if (entity.role !== 'nutrient' && entity.role !== 'prey') continue
      entity.position = { x: 40, y: 40 }
      entity.body = circleBody(entity.position, entity.body.radius)
    }

    for (let index = 0; index < 160; index += 1) engine.advance(1000 / 60)

    const nearbyFood = engine.renderSnapshot().entities.filter((entity) => (
      (entity.role === 'nutrient' || entity.role === 'prey')
      && Math.hypot(entity.position.x - player.position.x, entity.position.y - player.position.y) <= 75
    ))
    expect(nearbyFood.length).toBeGreaterThanOrEqual(6)
  })

  it('exposes configured contact damage only inside its pulse window', () => {
    const predator = createEntity({
      id: 'predator-test',
      role: 'predator',
      faction: 'hostile',
      radius: 20,
      mass: 400,
      membrane: 50,
      energy: 50,
      maxSpeed: 40,
      visualRecipeId: 'visual-predator-test',
      contactDamage: { source: 'spine', amount: 8, periodMs: 1600, activeMs: 240, phaseOffsetMs: 0 },
    }, { id: 'predator', position: { x: 0, y: 0 } })

    expect(contactDamageAt(predator, 100)).toEqual({ source: 'spine', amount: 8, periodIndex: 0 })
    expect(contactDamageAt(predator, 500)).toBeUndefined()
    expect(contactDamageAt(predator, 1700)).toEqual({ source: 'spine', amount: 8, periodIndex: 1 })
  })

  it('does not recursively damage edible rupture fragments', () => {
    const predator = createEntity({
      id: 'predator-test',
      role: 'predator',
      faction: 'hostile',
      radius: 20,
      mass: 400,
      membrane: 50,
      energy: 50,
      maxSpeed: 40,
      visualRecipeId: 'visual-predator-test',
      contactDamage: { source: 'spine', amount: 8, periodMs: 1600, activeMs: 240, phaseOffsetMs: 0 },
    }, { id: 'predator', position: { x: 0, y: 0 } })
    const fragment = createEntity({
      id: 'fragment-test',
      role: 'fragment',
      faction: 'neutral',
      radius: 2,
      mass: 4,
      membrane: 1,
      energy: 0,
      maxSpeed: 0,
      visualRecipeId: 'visual-fragment-test',
    }, { id: 'fragment', position: { x: 20, y: 0 } })

    expect(contactDamageForPair(predator, fragment, 100, new Map())).toBeUndefined()
  })

  it('arms newly spawned contact damage only after its telegraph lead', () => {
    const predator = createEntity({
      id: 'predator-test',
      role: 'predator',
      faction: 'hostile',
      radius: 20,
      mass: 400,
      membrane: 50,
      energy: 50,
      maxSpeed: 40,
      visualRecipeId: 'visual-predator-test',
      contactDamage: { source: 'spine', amount: 8, periodMs: 1600, activeMs: 240, phaseOffsetMs: 0 },
    }, { id: 'predator', position: { x: 0, y: 0 }, spawnedAtMs: 45_000 })
    const prey = createEntity({
      id: 'prey-test',
      role: 'prey',
      faction: 'neutral',
      radius: 10,
      mass: 100,
      membrane: 20,
      energy: 20,
      maxSpeed: 30,
      visualRecipeId: 'visual-prey-test',
    }, { id: 'prey', position: { x: 20, y: 0 }, spawnedAtMs: 0 })

    expect(contactDamageForPair(predator, prey, 45_000, new Map())).toBeUndefined()
    expect(contactDamageForPair(predator, prey, 45_419, new Map())).toBeUndefined()
    expect(contactDamageForPair(predator, prey, 45_420, new Map())).toMatchObject({
      damage: { source: 'spine', amount: 8, targetId: 'prey' },
    })
  })

  it('defers entities created during an interaction pass until the pass ends', () => {
    const entities = new Map([['a', { id: 'a' }]])
    const visited: string[] = []

    runStableEntityPass(entities, (entity, enqueue) => {
      visited.push(entity.id)
      enqueue({ id: 'b' })
    })

    expect(visited).toEqual(['a'])
    expect([...entities.keys()]).toEqual(['a', 'b'])
  })

  it('removes a resolved boss from movement and hostile interactions', () => {
    const boss = { ...entityAt('boss-membrane-queen', 10, 20), role: 'boss' as const, faction: 'hostile' as const, velocity: { x: 12, y: -3 } }
    const resolved = { ...m1BossState('combat'), phase: 'resolved' as const }

    expect(neutralizeResolvedBoss(boss, resolved)).toMatchObject({
      status: 'engulfed',
      velocity: { x: 0, y: 0 },
    })
  })

  it('keeps a ram-resolved mid-run boss inactive while the run continues', () => {
    const engine = createGameEngine({ seed: 727, environmentId: 'env-fiber-maze', initialElapsedMs: 244_300 })
    engine.start()
    const player = engine.renderSnapshot().entities.find((entity) => entity.id === 'player')!
    player.mass = 2500
    player.membrane = 1_000_000
    player.body = circleBody(player.position, 50)
    engine.advance(1000 / 60)

    const build = mutationContext({ organIds: ['organelle-jet-vacuole', 'organelle-shell-plate'] })
    engine.applyMutation({
      installed: build.installed[0]!,
      organelles: build.installed,
      stability: build.stability,
      capacity: build.capacity,
      synergyIds: [],
    })
    const state = engine.worldSnapshot().boss!
    Object.assign(state, { phase: 'enraged', outerMembrane: 0, coreIntegrity: 1, resolutionCandidate: undefined })
    const currentPlayer = engine.renderSnapshot().entities.find((entity) => entity.id === 'player')!
    const boss = engine.renderSnapshot().entities.find((entity) => entity.id === state.id)!
    const nextBossPosition = {
      x: currentPlayer.position.x + currentPlayer.body.radius + boss.body.radius - 0.5,
      y: currentPlayer.position.y,
    }
    const offset = { x: nextBossPosition.x - boss.position.x, y: nextBossPosition.y - boss.position.y }
    boss.position = nextBossPosition
    boss.velocity = { x: 0, y: 0 }
    boss.body = {
      ...boss.body,
      center: nextBossPosition,
      contour: boss.body.contour.map((point) => ({ x: point.x + offset.x, y: point.y + offset.y })),
    }

    engine.advance(1000 / 60)

    expect(engine.worldSnapshot().boss).toMatchObject({ phase: 'resolved', resolutionCandidate: 'combat' })
    expect(engine.renderSnapshot().entities.some((entity) => entity.id === state.id)).toBe(false)
    const resolutionEvents = engine.drainEvents()
    expect(resolutionEvents).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'boss-resolved', path: 'combat' })]))
    expect(resolutionEvents.some((event) => event.type === 'ending-reached' || event.type === 'player-died')).toBe(false)
    const resolvedElapsed = engine.snapshot().elapsedMs
    engine.advance(500)
    expect(engine.snapshot().elapsedMs).toBeGreaterThan(resolvedElapsed)
    expect(engine.renderSnapshot().entities.some((entity) => entity.id === state.id)).toBe(false)
  })

  it('reaches the host-takeover ending through a live final-boss parasite route', () => {
    const engine = createGameEngine({ seed: 727, environmentId: 'env-abandoned-chamber', initialElapsedMs: 99_000 })
    engine.start()
    engine.advance(1000 / 60)
    const context = mutationContext({ organIds: ['organelle-needle-mouth'] })
    engine.applyMutation({
      installed: context.installed[0]!,
      organelles: context.installed,
      stability: context.stability,
      capacity: context.capacity,
      synergyIds: [],
    })
    Object.assign(engine.worldSnapshot().boss!, { phase: 'exposed', outerMembrane: 0, parasiteAttachedMs: 0 })
    const durablePlayer = engine.renderSnapshot().entities.find((entity) => entity.id === 'player')!
    durablePlayer.membrane = 1_000_000
    durablePlayer.mass = 2500
    durablePlayer.body = circleBody(durablePlayer.position, 50)

    for (let index = 0; index < 190 && engine.worldSnapshot().boss?.phase !== 'resolved'; index += 1) {
      const bossState = engine.worldSnapshot().boss!
      const boss = engine.renderSnapshot().entities.find((entity) => entity.id === bossState.id)!
      const player = engine.renderSnapshot().entities.find((entity) => entity.id === 'player')!
      boss.position = { x: 220, y: 820 }
      boss.body = circleBody(boss.position, boss.body.radius)
      player.position = { x: boss.position.x + boss.body.radius + player.body.radius - 1, y: boss.position.y }
      player.body = circleBody(player.position, player.body.radius)
      engine.advance(1000 / 60)
    }

    expect(engine.worldSnapshot().boss).toMatchObject({ phase: 'resolved', resolutionCandidate: 'parasite' })
    expect(engine.drainEvents()).toContainEqual(expect.objectContaining({ type: 'ending-reached', endingId: 'ending-host-takeover' }))
  })

  it('does not award the stable-species ending below its content threshold', () => {
    expect(bossTerminalEvent(['gene-origin-primal'], 100, 5000)).toBeUndefined()
    expect(endingForBossRewards(['ending-stable-species'], 69)).toBeUndefined()
    expect(endingForBossRewards(['ending-stable-species'], 70)).toBe('ending-stable-species')
    const finalRewards = ['ending-stable-species', 'ending-swarm-mind', 'ending-host-takeover']
    expect(endingForBossRewards(finalRewards, 100, { path: 'parasite', bodyCount: 1 })).toBe('ending-host-takeover')
    expect(endingForBossRewards(finalRewards, 100, { path: 'combat', bodyCount: 2 })).toBe('ending-swarm-mind')
    expect(bossTerminalEvent(['ending-stable-species'], 69, 5000)).toEqual({
      type: 'player-died',
      cause: 'organelle-instability',
      atMs: 5000,
    })
  })

  it('makes an instability terminal event authoritative for every live player body', () => {
    const primary = { ...entityAt('player', 0, 0), faction: 'player' as const }
    const child = { ...entityAt('player-child-1', 10, 0), faction: 'player' as const }
    const neutral = entityAt('nutrient', 20, 0)
    const entities = new Map([[primary.id, primary], [child.id, child], [neutral.id, neutral]])

    terminatePlayerEntities(entities)

    expect([...entities.values()].filter((entity) => entity.faction === 'player')).toEqual([
      expect.objectContaining({ id: 'player', status: 'ruptured', mass: 0, membrane: 0 }),
      expect.objectContaining({ id: 'player-child-1', status: 'ruptured', mass: 0, membrane: 0 }),
    ])
    expect(entities.get('nutrient')?.status).toBe('active')
  })

  it('promotes a surviving split body when the original player body is lost', () => {
    const lostPrimary = { ...entityAt('player', 0, 0), faction: 'player' as const, status: 'engulfed' as const }
    const firstSurvivor = { ...entityAt('player-child-1', 10, 0), faction: 'player' as const }
    const secondSurvivor = { ...entityAt('player-child-2', 20, 0), faction: 'player' as const }
    const entities = new Map([
      [lostPrimary.id, lostPrimary],
      [firstSurvivor.id, firstSurvivor],
      [secondSurvivor.id, secondSurvivor],
    ])
    const survivors = [firstSurvivor, secondSurvivor].map((entity) => ({
      id: entity.id,
      mass: entity.mass,
      position: entity.position,
      velocity: entity.velocity,
      membrane: entity.membrane,
      energy: entity.energy,
      stability: 90,
      status: entity.status,
      organelles: [],
    }))

    const promoted = ensureSwarmPrimary(survivors, entities)

    expect(promoted.map((body) => body.id)).toEqual(['player', 'player-child-2'])
    expect(entities.get('player')).toMatchObject({ status: 'active', position: { x: 10, y: 0 } })
    expect(entities.has('player-child-1')).toBe(false)
  })

  it('applies a confirmed evolution build to authoritative HUD state', () => {
    const engine = createTestEngine()
    const context = mutationContext()
    const choice = offerMutations(context).find((item) => item.organId === 'organelle-jet-vacuole')!

    engine.applyMutation(installMutation(context, choice))

    expect(engine.snapshot().stability).toBe(97)
    expect(engine.evolutionSnapshot().organelles).toContainEqual(expect.objectContaining({
      id: 'organelle-jet-vacuole',
    }))
    expect(engine.morphologySnapshot().organelles).toContainEqual(expect.objectContaining({
      id: 'organelle-jet-vacuole',
      anchor: 'rear',
    }))
  })

  it('rearms a higher evolution threshold after a confirmed mutation', () => {
    const engine = createTestEngine()
    const context = mutationContext()
    const firstThreshold = engine.snapshot().evolutionThreshold
    const player = engine.renderSnapshot().entities.find((entity) => entity.id === 'player')!
    player.mass = firstThreshold
    engine.advance(1000 / 60)
    expect(engine.drainEvents().some((event) => event.type === 'mutation-ready')).toBe(true)

    const choice = offerMutations(context)[0]!
    engine.applyMutation(installMutation(context, choice))
    const secondThreshold = engine.snapshot().evolutionThreshold
    expect(secondThreshold).toBeGreaterThan(firstThreshold)

    const evolvedPlayer = engine.renderSnapshot().entities.find((entity) => entity.id === 'player')!
    evolvedPlayer.mass = secondThreshold
    engine.advance(1000 / 30)
    expect(engine.drainEvents().some((event) => event.type === 'mutation-ready')).toBe(true)
  })

  it('applies installed passive repair inside the authoritative simulation', () => {
    const engine = createTestEngine()
    const context = mutationContext({ organIds: ['organelle-repair-vacuole'] })
    engine.applyMutation({
      installed: context.installed[0]!,
      organelles: context.installed,
      stability: 100,
      capacity: 6,
      synergyIds: [],
    })
    const player = engine.renderSnapshot().entities.find((entity) => entity.id === 'player')!
    player.membrane = 60
    player.energy = 20

    engine.advance(1000 / 30)

    expect(engine.snapshot()).toMatchObject({ membrane: 70, energy: 12 })
    expect(engine.drainEvents()).toContainEqual(expect.objectContaining({
      type: 'organ-triggered',
      organId: 'organelle-repair-vacuole',
    }))
  })

  it('keeps automatic split visible while moving and fuses only after stopping', () => {
    const engine = createTestEngine()
    const context = mutationContext({ organIds: ['organelle-division-ring'] })
    engine.applyMutation({
      installed: context.installed[0]!,
      organelles: context.installed,
      stability: 92,
      capacity: 6,
      synergyIds: [],
    })
    const player = engine.renderSnapshot().entities.find((entity) => entity.id === 'player')!
    player.mass = 320
    engine.input.start({ x: 0, y: 0 })
    engine.input.move({ x: 100, y: 0 })

    engine.advance(1000 / 30)
    const splitBodies = engine.renderSnapshot().entities.filter((entity) => entity.faction === 'player')
    expect(splitBodies).toHaveLength(2)
    expect(splitBodies.every((entity) => entity.velocity.x > 0)).toBe(true)
    const organellesByBody = engine.renderSnapshot().playerOrganelleIdsByEntity
    expect(Object.values(organellesByBody).flat()).toEqual(['organelle-division-ring'])
    expect(Object.values(organellesByBody).some((ids) => ids.length === 0)).toBe(true)

    for (let index = 0; index < 360; index += 1) engine.advance(1000 / 60)
    expect(engine.renderSnapshot().entities.filter((entity) => entity.faction === 'player')).toHaveLength(2)
    expect(engine.snapshot().swarm).toMatchObject({ bodyCount: 2, fusionProgress: 0 })

    engine.input.end()
    for (let index = 0; index < 65; index += 1) engine.advance(1000 / 60)
    expect(engine.renderSnapshot().entities.filter((entity) => entity.faction === 'player')).toHaveLength(2)
    expect(engine.snapshot().swarm?.fusionProgress).toBeGreaterThan(0.8)

    for (let index = 0; index < 10; index += 1) engine.advance(1000 / 60)
    expect(engine.renderSnapshot().entities.filter((entity) => entity.faction === 'player')).toHaveLength(1)

    for (let index = 0; index < 360; index += 1) engine.advance(1000 / 60)
    expect(engine.renderSnapshot().entities.filter((entity) => entity.faction === 'player')).toHaveLength(1)

    engine.renderSnapshot().entities.find((entity) => entity.id === 'player')!.mass = 340
    engine.advance(1000 / 30)
    expect(engine.renderSnapshot().entities.filter((entity) => entity.faction === 'player')).toHaveLength(2)
  })

  it('splits while approaching the 70% lethal coverage boundary', () => {
    const engine = createTestEngine()
    const context = mutationContext({ organIds: ['organelle-division-ring'] })
    engine.applyMutation({
      installed: context.installed[0]!,
      organelles: context.installed,
      stability: 92,
      capacity: 6,
      synergyIds: [],
    })
    const entities = engine.renderSnapshot().entities
    const player = entities.find((entity) => entity.id === 'player')!
    const threat = entities.find((entity) => entity.id !== 'player')!
    threat.faction = 'hostile'
    threat.position = { x: player.position.x + player.body.radius * 3.7, y: player.position.y }
    threat.body = {
      center: { ...threat.position },
      radius: player.body.radius * 4,
      contour: player.body.contour.map((point) => ({
        x: threat.position.x + (point.x - player.position.x) * 4,
        y: threat.position.y + (point.y - player.position.y) * 4,
      })),
    }
    expect(coveredRatio(threat.body, player.body)).toBeGreaterThan(0.62)
    expect(coveredRatio(threat.body, player.body)).toBeLessThan(0.7)

    engine.advance(1000 / 30)

    expect(engine.drainEvents()).toContainEqual(expect.objectContaining({
      type: 'organ-triggered',
      organId: 'organelle-division-ring',
    }))
    expect(engine.renderSnapshot().entities.filter((entity) => entity.faction === 'player')).toHaveLength(2)
    expect(engine.renderSnapshot().swarmTransition?.kind).toBe('split')
  })

  it('continues as the surviving child when the primary split body is lost', () => {
    const engine = createTestEngine()
    const context = mutationContext({ organIds: ['organelle-division-ring'] })
    engine.applyMutation({ installed: context.installed[0]!, organelles: context.installed, stability: 92, capacity: 6, synergyIds: [] })
    engine.renderSnapshot().entities.find((entity) => entity.id === 'player')!.mass = 320
    engine.advance(1000 / 30)
    engine.drainEvents()
    const primary = engine.renderSnapshot().entities.find((entity) => entity.id === 'player')!
    primary.status = 'engulfed'
    primary.mass = 0
    primary.membrane = 0
    primary.energy = 0

    engine.advance(1000 / 30)

    expect(engine.renderSnapshot().entities.filter((entity) => entity.faction === 'player')).toMatchObject([{ id: 'player', status: 'active' }])
    expect(engine.renderSnapshot().swarmTransition?.kind).not.toBe('fusion')
    expect(engine.drainEvents().some((event) => event.type === 'player-died')).toBe(false)
    expect(engine.evolutionSnapshot().organelles).toEqual([])
  })

  it('ends only after every split body is lost and never fuses them back', () => {
    const engine = createTestEngine()
    const context = mutationContext({ organIds: ['organelle-division-ring'] })
    engine.applyMutation({ installed: context.installed[0]!, organelles: context.installed, stability: 92, capacity: 6, synergyIds: [] })
    engine.renderSnapshot().entities.find((entity) => entity.id === 'player')!.mass = 320
    engine.advance(1000 / 30)
    engine.drainEvents()
    engine.renderSnapshot().entities.filter((entity) => entity.faction === 'player').forEach((body) => {
      body.status = 'engulfed'
      body.mass = 0
      body.membrane = 0
      body.energy = 0
    })

    engine.advance(1000 / 30)
    const lossEvents = engine.drainEvents()
    for (let index = 0; index < 60; index += 1) engine.advance(1000 / 60)

    expect(lossEvents).toContainEqual(expect.objectContaining({ type: 'player-died', cause: 'all-split-bodies-lost' }))
    expect(engine.renderSnapshot().entities.filter((entity) => entity.faction === 'player')).toEqual([])
  })

  it('consumes a guard charge on a fatal hit and restores it after engulfing nutrition', () => {
    const engine = createTestEngine()
    const context = mutationContext({ organIds: ['organelle-guard-symbiont'] })
    engine.applyMutation({ installed: context.installed[0]!, organelles: context.installed, stability: 96, capacity: 6, synergyIds: [] })
    const entities = engine.renderSnapshot().entities
    const player = entities.find((entity) => entity.id === 'player')!
    const threat = entities.find((entity) => entity.id !== 'player' && entity.role !== 'nutrient')!
    const nutrient = entities.find((entity) => entity.role === 'nutrient')!
    const threatPosition = { x: player.position.x + player.body.radius + threat.body.radius - 3, y: player.position.y }
    const threatOffset = { x: threatPosition.x - threat.position.x, y: threatPosition.y - threat.position.y }
    threat.position = threatPosition
    threat.body = {
      ...threat.body,
      center: threatPosition,
      contour: threat.body.contour.map((point) => ({ x: point.x + threatOffset.x, y: point.y + threatOffset.y })),
    }
    Object.assign(threat, {
      faction: 'hostile',
      spawnedAtMs: -500,
      contactDamage: { source: 'spine', amount: 120, periodMs: 1000, activeMs: 900, phaseOffsetMs: 0 },
    })

    engine.advance(20)
    const firstEvents = engine.drainEvents()
    expect(engine.snapshot().energy).toBe(86)
    expect(engine.evolutionSnapshot().organelles[0]?.charges).toBe(0)
    expect(firstEvents).toContainEqual(expect.objectContaining({ type: 'blocked', amount: 120 }))

    const currentEntities = engine.renderSnapshot().entities
    const currentThreat = currentEntities.find((entity) => entity.id === threat.id)!
    const currentPlayer = currentEntities.find((entity) => entity.id === 'player')!
    const currentNutrient = currentEntities.find((entity) => entity.id === nutrient.id)!
    Object.assign(currentThreat, { faction: 'neutral', contactDamage: undefined })
    const nutrientOffset = { x: currentPlayer.position.x - currentNutrient.position.x, y: currentPlayer.position.y - currentNutrient.position.y }
    currentNutrient.position = { ...currentPlayer.position }
    currentNutrient.body = {
      ...currentNutrient.body,
      center: { ...currentPlayer.position },
      contour: currentNutrient.body.contour.map((point) => ({ x: point.x + nutrientOffset.x, y: point.y + nutrientOffset.y })),
    }
    engine.advance(20)

    expect(engine.evolutionSnapshot().organelles[0]?.charges).toBe(1)
  })
})
