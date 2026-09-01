# Ecology Journey Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the fixed cultivation dish into a deterministic six-stage journey with forced collapse migration, autonomous food-chain activity, and role-specific enemy behavior.

**Architecture:** Add pure run-director, ecology-director, and behavior-state modules beside the existing fixed-step engine. The engine owns authoritative entities and consumes deterministic commands from the directors; React only presents route choices and never owns simulation state.

**Tech Stack:** React 19, TypeScript 6, Canvas 2D, Vitest, Vite; no new dependencies.

**Spec:** `projects/09-proto-cell/design/2026-09-01-ecology-roguelite-redesign.md`

## Global Constraints

- Complete `2026-09-01-core-feel-implementation-plan.md` first with a passing full project gate.
- Modify only `projects/09-proto-cell`; do not modify the root lockfile, workspace files, `docs/`, `prep/`, or other projects.
- Keep all journey, ecology, behavior, route, environment, and UI content in `src/content/content.json`.
- Simulation decisions must use the injected seeded RNG; render-only randomness cannot affect play.
- Gameplay remains movement only; route choice uses accessible DOM buttons while the deterministic collapse clock continues.
- A player who never finds a rift must still leave the initial environment after collapse begins.
- Nearby entities receive full simulation; distant ecology is represented by aggregate populations, not active Canvas entities.
- Every implementation task follows red-green-refactor and ends in its own commit on `main`.

## File Structure

- `src/world/run-director.ts`: six journey stages, collapse phases, route offers, and forced transition deadlines.
- `src/world/ecology-director.ts`: population budgets, distant populations, scene opportunities, and spawn/despawn commands.
- `src/entities/behaviors/types.ts`: behavior context, memory, state, and command contracts.
- `src/entities/behaviors/*.ts`: one focused state machine per behavior family.
- `src/entities/ai.ts`: behavior registry and dispatch only.
- `src/world/generator.ts`: deterministic local region materialization from director commands.
- `src/world/environments.ts`: movement fields, collapse geometry, and environment-specific hazards.
- `src/game/engine.ts`: orchestration and authoritative application of director/behavior commands.
- `src/ui/MigrationOverlay.tsx`: two-route risk/reward choice.
- `src/rendering/renderer.ts`: collapse, migration, and offscreen threat presentation.
- `src/tests/playthrough.ts`: deterministic journey audit harness.

---

### Task 1: Journey and Ecology Content Contract

**Files:**
- Modify: `src/content/schema.ts`
- Modify: `src/content/index.ts`
- Modify: `src/content/validate.ts`
- Modify: `src/content/validate.test.ts`
- Modify: `src/content/content.json`
- Modify: `src/content/content-completeness.test.ts`

**Interfaces:**
- Produces: `JourneyDefinition`, `JourneyStageDefinition`, `EcologyBudgetDefinition`, and `BehaviorProfileDefinition`.
- Produces: `getBehaviorProfile(id: \`behavior-${string}\`): BehaviorProfileDefinition` that throws `RangeError` for unknown validated content IDs.
- Consumed by: all later tasks in this plan.

- [ ] **Step 1: Write failing validation tests for the new content contract**

```ts
it('requires six ordered journey stages with collapse and two route offers before the finale', () => {
  const pack = contentFixture()
  pack.journey.stages = pack.journey.stages.slice(0, 5)
  expect(validateContent(pack)).toContainEqual(expect.objectContaining({ path: '$.journey.stages' }))

  pack.journey.stages = contentFixture().journey.stages
  pack.journey.stages[1].routeOffers = []
  expect(validateContent(pack)).toContainEqual(expect.objectContaining({ path: '$.journey.stages[1].routeOffers' }))
})

it('rejects behavior profiles without a state, movement pattern, and exploitable weakness', () => {
  const pack = contentFixture()
  pack.behaviorProfiles[0].weaknessId = ''
  expect(validateContent(pack)).toContainEqual(expect.objectContaining({ path: '$.behaviorProfiles[0].weaknessId' }))
})
```

- [ ] **Step 2: Run content tests and verify missing fields fail**

Run: `pnpm test -- src/content/validate.test.ts src/content/content-completeness.test.ts`

Expected: FAIL because the schema has no journey, ecology budget, or behavior profile collections.

- [ ] **Step 3: Add exact content types**

```ts
export type JourneyStageDefinition = {
  index: number
  id: `journey-${string}`
  durationMs: number
  warningLeadMs: number
  collapseDurationMs: number
  routeOffers: Array<{
    id: `journey-route-${string}`
    destinationEnvironmentId: EnvironmentId
    rewardId: string
    riskId: string
    entryModifierId: string
  }>
  bodyStage: BodyStage
}

export type JourneyDefinition = { stages: JourneyStageDefinition[] }

export type FirstRunAssistDefinition = {
  throughRunOrdinal: number
  firstFoodDeadlineMs: number
  warningLeadMultiplier: number
  blockedOpportunityIds: string[]
}

export type EcologyBudgetDefinition = {
  environmentId: EnvironmentId
  resource: [number, number]
  prey: [number, number]
  competitor: [number, number]
  scavenger: [number, number]
  hunter: [number, number]
  apex: [number, number]
  opportunityIntervalMs: [number, number]
}

export type BehaviorProfileDefinition = {
  id: `behavior-${string}`
  family: 'resource' | 'skittish' | 'school' | 'competitor' | 'ambusher' | 'hunter' | 'scavenger' | 'apex'
  movementPattern: string
  weaknessId: string
  perceptionRadius: number
  abandonAfterMs: number
}
```

Move `BodyStage` from the transitional engine declaration into `content/schema.ts` so content, run director, evolution, HUD, and renderer share one type.

- [ ] **Step 4: Populate the six-stage journey and profiles**

Use stage durations `[60_000, 75_000, 90_000, 95_000, 70_000, 90_000]`, warning lead `15_000`, and collapse duration `12_000`. Define these exact stage offers:

- stage 1: `journey-route-algae-feast` → algae glow, `journey-route-acid-mutation` → acid vesicle;
- stage 2: `journey-route-fiber-cover` → fiber maze, `journey-route-antibody-current` → antibody storm;
- stage 3: `journey-route-acid-pressure` → acid vesicle, `journey-route-algae-blackout` → algae glow;
- stage 4: `journey-route-fiber-ambush` → fiber maze, `journey-route-antibody-hunt` → antibody storm;
- stage 5: `journey-route-chamber-wreckage` and `journey-route-chamber-gauntlet` → abandoned chamber with different rewards, risks, and entry modifiers;
- stage 6: no route offers; resolve the finale in abandoned chamber.

Add one behavior profile for each of the eight families and one ecology budget per environment.

Add `firstRunAssist` with `throughRunOrdinal: 2`, `firstFoodDeadlineMs: 5000`, `warningLeadMultiplier: 1.25`, and the two most punishing apex/hazard opportunity IDs blocked during the first three runs.

- [ ] **Step 5: Run all content tests**

Run: `pnpm test -- src/content/content.test.ts src/content/validate.test.ts src/content/content-completeness.test.ts src/tests/content-coverage.test.ts`

Expected: PASS with exactly six ordered journey stages and no dangling environment or behavior references.

- [ ] **Step 6: Commit the ecology content contract**

```bash
git add projects/09-proto-cell/src/content/schema.ts projects/09-proto-cell/src/content/index.ts projects/09-proto-cell/src/content/validate.ts projects/09-proto-cell/src/content/validate.test.ts projects/09-proto-cell/src/content/content.json projects/09-proto-cell/src/content/content-completeness.test.ts
git commit -m "feat(proto-cell): define ecology journey content"
```

### Task 2: Deterministic Run Director

**Files:**
- Create: `src/world/run-director.ts`
- Create: `src/world/run-director.test.ts`
- Modify: `src/game/interactions.ts`
- Modify: `src/game/interactions.test.ts`

**Interfaces:**
- Consumes: `JourneyDefinition`, seed, run ordinal, selected route, and simulation time.
- Produces: `RunDirectorState` and `stepRunDirector(state, input): { state; events }`.
- Produces events: `collapse-warning`, `migration-ready`, `migration-forced`, and existing `route-selected`.
- Consumed by: Task 3 engine integration and Task 4 ecology director.

- [ ] **Step 1: Write the failing state-machine tests**

```ts
function forceFirstMigration(seed: number) {
  let state = createRunDirector(getContent().journey, seed, 3, getContent().firstRunAssist)
  state = stepRunDirector(state, { atMs: 45_000 }).state
  state = stepRunDirector(state, { atMs: 60_000 }).state
  const result = stepRunDirector(state, { atMs: 72_000 })
  return result.events.find((event): event is Extract<GameEvent, { type: 'migration-forced' }> => event.type === 'migration-forced')!
}

it('warns, offers migration, and forces a route by the collapse deadline', () => {
  let state = createRunDirector(getContent().journey, 727, 3, getContent().firstRunAssist)
  state = stepRunDirector(state, { atMs: 45_000 }).state
  expect(state.phase).toBe('warning')
  const offered = stepRunDirector(state, { atMs: 60_000 })
  expect(offered.events).toContainEqual(expect.objectContaining({ type: 'migration-ready', stageIndex: 1 }))
  const forced = stepRunDirector(offered.state, { atMs: 72_000 })
  expect(forced.events).toContainEqual(expect.objectContaining({ type: 'migration-forced' }))
})

it('chooses the same fallback route for the same seed', () => {
  const first = forceFirstMigration(727)
  const second = forceFirstMigration(727)
  expect(first.destinationEnvironmentId).toBe(second.destinationEnvironmentId)
})

it('starts the collapse warning earlier during the first three runs', () => {
  const state = createRunDirector(getContent().journey, 727, 0, getContent().firstRunAssist)
  expect(stepRunDirector(state, { atMs: 42_000 }).state.phase).toBe('warning')
})
```

- [ ] **Step 2: Run the run-director test and verify it fails**

Run: `pnpm test -- src/world/run-director.test.ts src/game/interactions.test.ts`

Expected: FAIL because the director and migration events do not exist.

- [ ] **Step 3: Implement the pure director**

```ts
export type RunPhase = 'active' | 'warning' | 'choosing' | 'collapsing' | 'finale' | 'complete'
export type RunDirectorState = {
  seed: number
  runOrdinal: number
  stageIndex: number
  environmentId: EnvironmentId
  phase: RunPhase
  stageStartedAtMs: number
  offeredRoutes: JourneyStageDefinition['routeOffers']
}

export type RunDirectorStep = { state: RunDirectorState; events: GameEvent[] }

export function stepRunDirector(state: RunDirectorState, input: { atMs: number; selectedRouteId?: string }): RunDirectorStep {
  const stage = getContent().journey.stages[state.stageIndex]!
  const ageMs = input.atMs - state.stageStartedAtMs
  const assist = getContent().firstRunAssist
  const warningLeadMs = state.runOrdinal <= assist.throughRunOrdinal ? stage.warningLeadMs * assist.warningLeadMultiplier : stage.warningLeadMs
  const selectedRoute = state.offeredRoutes.find((route) => route.id === input.selectedRouteId)
  if (selectedRoute) {
    return enterJourneyStage(state, selectedRoute, input.atMs, false)
  }
  if (state.phase === 'active' && ageMs >= stage.durationMs - warningLeadMs) {
    return { state: { ...state, phase: 'warning' }, events: [{ type: 'collapse-warning', stageIndex: state.stageIndex + 1, atMs: input.atMs }] }
  }
  if (state.phase === 'warning' && ageMs >= stage.durationMs) {
    return { state: { ...state, phase: 'choosing' }, events: [{ type: 'migration-ready', stageIndex: state.stageIndex + 1, routes: state.offeredRoutes.map((route) => ({ ...route })), atMs: input.atMs }] }
  }
  if (state.phase === 'choosing' && ageMs < stage.durationMs + stage.collapseDurationMs) {
    return { state: { ...state, phase: 'collapsing' }, events: [] }
  }
  if ((state.phase === 'choosing' || state.phase === 'collapsing') && ageMs >= stage.durationMs + stage.collapseDurationMs) {
    const index = (Math.imul(state.seed ^ state.stageIndex, 2654435761) >>> 0) % state.offeredRoutes.length
    return enterJourneyStage(state, state.offeredRoutes[index]!, input.atMs, true)
  }
  return { state, events: [] }
}
```

Implement `enterJourneyStage` in the same module. It accepts the selected route object, increments `stageIndex`, assigns `environmentId` from `destinationEnvironmentId`, resets `stageStartedAtMs`, loads the next stage's route offers, and emits `migration-forced` when its fourth argument is true followed by `route-selected` carrying both route ID and environment ID. If the new stage is the finale, set `phase: 'finale'`; otherwise set `phase: 'active'`. During run ordinals 0–2, multiply warning lead by the authored `1.25` without changing the stage or collapse deadline. Repeated fixed steps cannot duplicate events because every branch stores its new phase.

- [ ] **Step 4: Extend the structured event union**

Add exact payloads for the four director events. Update archive/view-model exhaustiveness tests so new non-terminal events do not alter death derivation.

- [ ] **Step 5: Run director and event tests**

Run: `pnpm test -- src/world/run-director.test.ts src/game/interactions.test.ts src/app/view-model.test.ts`

Expected: PASS with no duplicate event across repeated timestamps.

- [ ] **Step 6: Commit the run director**

```bash
git add projects/09-proto-cell/src/world/run-director.ts projects/09-proto-cell/src/world/run-director.test.ts projects/09-proto-cell/src/game/interactions.ts projects/09-proto-cell/src/game/interactions.test.ts projects/09-proto-cell/src/app/view-model.test.ts
git commit -m "feat(proto-cell): add forced migration director"
```

### Task 3: Engine Migration and Accessible Route Choice

**Files:**
- Modify: `src/game/engine.ts`
- Modify: `src/game/engine.test.ts`
- Modify: `src/app/controller.ts`
- Modify: `src/app/controller.test.ts`
- Create: `src/ui/MigrationOverlay.tsx`
- Create: `src/ui/MigrationOverlay.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.css`
- Modify: `src/rendering/renderer.ts`
- Modify: `src/rendering/effects.ts`
- Modify: `src/rendering/effects.test.ts`

**Interfaces:**
- Consumes: `RunDirectorState` and migration events from Task 2.
- Produces: `ProtoCellEngine.selectMigration(routeId: string): void` and `runSnapshot(): RunDirectorState`.
- Produces: `MigrationOverlay` with two route buttons and risk/reward copy from content.
- Consumed by: HUD, ecology director, archive, and playthrough harness.
- Extends controller run-start input and `createGameEngine` options with `runOrdinal`; `App.tsx` passes `save.lifeArchives.length`.

- [ ] **Step 1: Write failing engine and overlay tests**

```ts
it('advances out of clear drop when the player never enters a rift', () => {
  const engine = createGameEngine({ seed: 727 })
  engine.start()
  advanceFor(engine, 73_000)
  expect(engine.snapshot().environmentId).not.toBe('env-clear-drop')
  expect(engine.drainEvents()).toContainEqual(expect.objectContaining({ type: 'migration-forced' }))
})

it('renders two route choices and reports the selected environment', () => {
  const selected: string[] = []
  const routes = content.journey.stages[0].routeOffers
  const html = renderToString(<MigrationOverlay routes={routes} onSelect={(id) => selected.push(id)} />)
  expect(html).toContain('营养丰富')
  expect(html.match(/<button/g)).toHaveLength(2)
})
```

- [ ] **Step 2: Run focused tests and verify old rift-only progression fails**

Run: `pnpm test -- src/game/engine.test.ts src/ui/MigrationOverlay.test.tsx src/app/controller.test.ts`

Expected: FAIL because the engine only transitions on physical rift entry and there is no migration overlay.

- [ ] **Step 3: Integrate the director into the fixed step**

Step the run director before environment features. On `migration-ready`, expose both offers without pausing the fixed-step clock; on explicit selection, transition immediately; at the collapse deadline, transition using the deterministic fallback. Keep physical rifts as visible route entrances during the choice window, but do not require collision for eventual progression.

- [ ] **Step 4: Implement collapse presentation**

Extend `WorldRenderSnapshot` with `{ collapsePhase: RunPhase; collapseProgress: number; migrationDirection?: Vec2 }`. Render background color compression, inward fog, and a non-flashing directional route cue. Do not apply damage until `collapseProgress >= 0.75`; after that, shrink the safe region rather than subtracting global health.

- [ ] **Step 5: Implement the DOM route choice**

Render environment name, one reward label, and one risk label from `content.json`. Use a non-modal `section` with a labelled button group so the Canvas remains playable and the collapse deadline remains deterministic. Use 44px minimum buttons and place the group below the simulated safe area. Selecting a route calls `engine.selectMigration(route.id)` and clears the overlay.

- [ ] **Step 6: Run integration tests**

Run: `pnpm test -- src/world/run-director.test.ts src/game/engine.test.ts src/ui/MigrationOverlay.test.tsx src/app/controller.test.ts src/rendering/effects.test.ts`

Expected: PASS for explicit and forced routes, no duplicate transitions, and a collapse clock that continues while route buttons are visible.

- [ ] **Step 7: Commit forced migration integration**

```bash
git add projects/09-proto-cell/src/game/engine.ts projects/09-proto-cell/src/game/engine.test.ts projects/09-proto-cell/src/app/controller.ts projects/09-proto-cell/src/app/controller.test.ts projects/09-proto-cell/src/ui/MigrationOverlay.tsx projects/09-proto-cell/src/ui/MigrationOverlay.test.tsx projects/09-proto-cell/src/App.tsx projects/09-proto-cell/src/App.css projects/09-proto-cell/src/rendering/renderer.ts projects/09-proto-cell/src/rendering/effects.ts projects/09-proto-cell/src/rendering/effects.test.ts
git commit -m "feat(proto-cell): force visible ecology migration"
```

### Task 4: Role-Specific Behavior State Machines

**Files:**
- Create: `src/entities/behaviors/types.ts`
- Create: `src/entities/behaviors/skittish.ts`
- Create: `src/entities/behaviors/school.ts`
- Create: `src/entities/behaviors/competitor.ts`
- Create: `src/entities/behaviors/ambusher.ts`
- Create: `src/entities/behaviors/hunter.ts`
- Create: `src/entities/behaviors/scavenger.ts`
- Create: `src/entities/behaviors/apex.ts`
- Create: `src/entities/behaviors/behaviors.test.ts`
- Modify: `src/entities/ai.ts`
- Modify: `src/entities/ai.test.ts`
- Modify: `src/domain/types.ts`

**Interfaces:**
- Produces: `BehaviorState`, `BehaviorMemory`, `BehaviorContext`, and `BehaviorDecision`.
- Produces: `decideBehavior(entity, memory, context): { memory; decision }`.
- `BehaviorDecision` contains movement intent plus optional `targetId`, `presentationState`, and `action`.
- Consumed by: Task 5 ecology integration and `moveEntities()`.

- [ ] **Step 1: Write one failing behavior test per player-visible distinction**

```ts
function behaviorFixture(family: BehaviorProfileDefinition['family']) {
  const self = { ...entity(`self-${family}`, 12), behaviorProfileId: `behavior-${family}` as `behavior-${string}` }
  const food = { ...entity('food', 4), role: 'nutrient' as const }
  const peer = { ...entity('peer', 12), behaviorProfileId: `behavior-${family}` as `behavior-${string}` }
  const threat = { ...entity('threat', 24), role: 'predator' as const, faction: 'hostile' as const }
  const fragment = { ...entity('fragment', 5), role: 'fragment' as const }
  const prey = { ...entity('prey', 7), role: 'prey' as const }
  const nearbyByFamily = {
    skittish: [threat], school: [peer], competitor: [food], ambusher: [],
    hunter: [prey], scavenger: [fragment], apex: [], resource: [],
  }
  return { entity: self, memory: { state: 'idle' as const, stateStartedAtMs: 0 }, context: { atMs: 0, nearby: nearbyByFamily[family], profile: getBehaviorProfile(`behavior-${family}`) } }
}

it.each([
  ['skittish', 'flee'],
  ['school', 'regroup'],
  ['competitor', 'steal'],
  ['ambusher', 'hide'],
  ['hunter', 'pursue'],
  ['scavenger', 'harvest'],
  ['apex', 'patrol'],
] as const)('%s exposes its defining presentation state', (family, expected) => {
  const fixture = behaviorFixture(family)
  const result = decideBehavior(fixture.entity, fixture.memory, fixture.context)
  expect(result.decision.presentationState).toBe(expected)
})

it('hunter abandons a lost target instead of chasing forever', () => {
  const fixture = behaviorFixture('hunter')
  const result = decideBehavior(fixture.entity, { state: 'pursue', targetId: 'prey', stateStartedAtMs: 0 }, { ...fixture.context, atMs: 2400, nearby: [] })
  expect(result.memory.state).toBe('search')
  expect(result.decision.targetId).toBeUndefined()
})
```

- [ ] **Step 2: Run behavior tests and verify generic AI fails**

Run: `pnpm test -- src/entities/behaviors/behaviors.test.ts src/entities/ai.test.ts`

Expected: FAIL because current AI has no memory, presentation state, abandon timer, flank, school, hide, or steal behavior.

- [ ] **Step 3: Define behavior contracts and memory storage**

```ts
export type BehaviorState = 'idle' | 'forage' | 'flee' | 'regroup' | 'steal' | 'escape' | 'hide' | 'ambush' | 'pursue' | 'search' | 'harvest' | 'patrol' | 'charge'
export type BehaviorMemory = { state: BehaviorState; stateStartedAtMs: number; targetId?: string; anchor?: Vec2 }
export type BehaviorDecision = { movement: MovementIntent; targetId?: string; presentationState: BehaviorState; action?: 'consume' | 'split-school' | 'charge' }
```

Store behavior memory in a `Map<string, BehaviorMemory>` owned by the engine. Prune memory when entities leave the active world.

- [ ] **Step 4: Implement each family as a focused pure state machine**

Use content profile perception and abandon timers. Required distinctive rules: skittish burst-turn; school centroid regroup; competitor resource theft then escape; ambusher stationary hide then short lunge; hunter predicted intercept then timed search; scavenger fragment priority; apex patrol, telegraphed charge, and slow recovery.

- [ ] **Step 5: Make `ai.ts` a registry dispatcher**

Resolve `behaviorProfileId` from the entity definition and call the matching family function. Retain a deterministic low-strength wander fallback for unknown production content, while validation prevents unknown IDs in tested content.

- [ ] **Step 6: Run AI and engine movement tests**

Run: `pnpm test -- src/entities/behaviors/behaviors.test.ts src/entities/ai.test.ts src/game/engine.test.ts`

Expected: PASS; behavior memory is deterministic for a seed and no entity produces non-finite movement.

- [ ] **Step 7: Commit behavior state machines**

```bash
git add projects/09-proto-cell/src/entities/behaviors projects/09-proto-cell/src/entities/ai.ts projects/09-proto-cell/src/entities/ai.test.ts projects/09-proto-cell/src/domain/types.ts projects/09-proto-cell/src/game/engine.ts projects/09-proto-cell/src/game/engine.test.ts
git commit -m "feat(proto-cell): diversify ecology behaviors"
```

### Task 5: Population Ecology and Opportunity Director

**Files:**
- Create: `src/world/ecology-director.ts`
- Create: `src/world/ecology-director.test.ts`
- Modify: `src/world/generator.ts`
- Modify: `src/world/generator.test.ts`
- Modify: `src/game/engine.ts`
- Modify: `src/game/engine.test.ts`
- Modify: `src/game/interactions.ts`
- Modify: `src/game/interactions.test.ts`
- Modify: `src/app/controller.ts`
- Modify: `src/app/controller.test.ts`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: current environment budget, seed, time, player morphology, visible entity summary, and recent opportunity history.
- Produces: `EcologyCommand[]` with `materialize-group`, `dematerialize-group`, `start-opportunity`, and `adjust-population` variants.
- Produces: `EcologySummary` for debug tests and HUD-independent telemetry.
- Consumes: `runOrdinal` so the accepted first-three-run assistance can alter timing and opportunity filtering without permanent stat bonuses.

- [ ] **Step 1: Write failing population and opportunity tests**

```ts
it('maintains a food-chain pyramid without spawning every entity near the player', () => {
  const result = simulateEcology({ seed: 727, durationMs: 180_000, playerPosition: { x: 320, y: 550 } })
  expect(result.minimumPopulation.resource).toBeGreaterThan(result.maximumPopulation.hunter)
  expect(result.materializedDistances.some((distance) => distance > 320)).toBe(true)
})

it('does not repeat an opportunity inside the last three scenes', () => {
  const scenes = collectOpportunities(727, 90_000)
  for (let index = 3; index < scenes.length; index += 1) {
    expect(scenes.slice(index - 3, index)).not.toContain(scenes[index])
  }
})

it('guarantees nearby edible food by five seconds in the first three runs', () => {
  for (const runOrdinal of [0, 1, 2]) {
    const result = simulateEcology({ seed: 727, durationMs: 5000, runOrdinal, playerPosition: { x: 320, y: 550 } })
    expect(result.firstNearbyEdibleAtMs).toBeLessThanOrEqual(5000)
  }
})
```

- [ ] **Step 2: Run ecology tests and verify replenishment-only behavior fails**

Run: `pnpm test -- src/world/ecology-director.test.ts src/world/generator.test.ts src/game/interactions.test.ts`

Expected: FAIL because current replenishment only counts local edible entities and relocates or spawns food near the player.

- [ ] **Step 3: Implement aggregate populations and deterministic commands**

Represent each role population as `{ role, count, biomass, trend }`. Step aggregate predation at 1000ms intervals, while the fixed-step engine continues visible movement. Materialize groups when their scene intersects a 1.25-viewport active radius; dematerialize non-player, non-boss groups beyond 1.75 viewports by returning their biomass to the aggregate state.

- [ ] **Step 4: Implement the opportunity scheduler**

Schedule a scene every seeded interval inside the environment budget range, targeting roughly 15 seconds. Provide exact scene IDs: `food-bloom`, `school-migration`, `predator-conflict`, `carcass-rush`, `giant-passage`, and `hazard-surge`. Filter scenes by environment and recent history, then emit materialization commands and existing structured event cues.

- [ ] **Step 5: Replace `replenishFood()` with ecology commands**

Remove direct local relocation. Apply commands after environment stepping and before grid rebuild. Visible creatures continue to use real interactions, including AI-versus-AI engulf and damage; emit `engulfed` events for non-player predation so population outcomes and codex observation remain truthful. For run ordinals 0–2, apply only the authored first-food deadline and opportunity filters from content.

- [ ] **Step 6: Run ecology and engine tests**

Run: `pnpm test -- src/world/ecology-director.test.ts src/world/generator.test.ts src/game/interactions.test.ts src/game/engine.test.ts`

Expected: PASS; a three-minute simulation maintains bounded entities, includes near and far materialization, and records at least three distinct opportunities.

- [ ] **Step 7: Commit autonomous ecology**

```bash
git add projects/09-proto-cell/src/world/ecology-director.ts projects/09-proto-cell/src/world/ecology-director.test.ts projects/09-proto-cell/src/world/generator.ts projects/09-proto-cell/src/world/generator.test.ts projects/09-proto-cell/src/game/engine.ts projects/09-proto-cell/src/game/engine.test.ts projects/09-proto-cell/src/game/interactions.ts projects/09-proto-cell/src/game/interactions.test.ts projects/09-proto-cell/src/app/controller.ts projects/09-proto-cell/src/app/controller.test.ts projects/09-proto-cell/src/App.tsx
git commit -m "feat(proto-cell): simulate autonomous food chains"
```

### Task 6: Journey Integration and Playability Gate

**Files:**
- Modify: `src/tests/playthrough.ts`
- Modify: `src/tests/playthrough.test.ts`
- Modify: `src/tests/performance-budget.test.ts`
- Modify: `src/app/view-model.ts`
- Modify: `src/app/view-model.test.ts`
- Modify: `src/progression/archive.ts`
- Modify: `src/progression/archive.test.ts`
- Modify: `src/ui/Hud.tsx`
- Modify: `src/ui/Hud.test.tsx`

**Interfaces:**
- Consumes: authoritative run and ecology snapshots from Tasks 2–5.
- Produces: `HeadlessRunReport.stageSignature`, `opportunitySignature`, and `behaviorStateCounts`.
- Produces: `HeadlessRunReport.maxActionableGapMs`, sampled from intervals where at least one edible, dangerous, or ecology-opportunity cue is available to the player.
- Changes `HeadlessRunOptions.route` to an optional ordered list of journey route-offer IDs; omitted routes use deterministic director fallbacks.
- Produces: truthful archive farthest-stage and migration history.

- [ ] **Step 1: Write failing full-journey audit tests**

```ts
it('finishes a deterministic six-stage journey without route-driving cheats', () => {
  const report = runHeadless({ seed: 727, durationMs: 520_000, policy: 'balanced' })
  expect(report.stageSignature).toBe('1>2>3>4>5>6')
  expect(report.routeSignature.split('>').length).toBe(5)
  expect(new Set(report.opportunitySignature.split('>')).size).toBeGreaterThanOrEqual(4)
  expect(report.maxActionableGapMs).toBeLessThanOrEqual(8000)
})

it('shows all eight visible behavior families during a ten-seed audit', () => {
  const counts = mergeBehaviorCounts(Array.from({ length: 10 }, (_, seed) => runHeadless({ seed, durationMs: 520_000 }).behaviorStateCounts))
  expect(Object.keys(counts).sort()).toEqual(['ambusher', 'apex', 'competitor', 'hunter', 'resource', 'scavenger', 'school', 'skittish'])
})
```

- [ ] **Step 2: Run playthrough tests and verify the old route-driving harness fails**

Run: `pnpm test -- src/tests/playthrough.test.ts src/tests/performance-budget.test.ts`

Expected: FAIL because the current harness reaches routes only through `driveRoute()` and exposes no stage, opportunity, or behavior audit.

- [ ] **Step 3: Remove route-driving and forced-mass cheats from the primary journey audit**

Keep specialized boss-resolution fixtures where necessary, but make the main playable run use ordinary director progression. Record every stage entry, opportunity event, and visible behavior family in `HeadlessRunReport`.

- [ ] **Step 4: Update HUD and archive to authoritative journey data**

Replace transitional route-index HUD fields with `runSnapshot.stageIndex` and `content.journey.stages.length`. Record the farthest actual environment and stage; forced migration must appear in the event history like an explicit route.

- [ ] **Step 5: Run full automated gates**

Run: `pnpm lint && pnpm test && pnpm build`

Expected: exit 0; ten deterministic runs stay within existing entity and performance budgets, and every run leaves the initial environment.

- [ ] **Step 6: Run browser ecology verification**

At 375, 390, and 430 CSS px with 44px simulated safe area, verify:

- collapse warning becomes visible by 45 seconds and does not hide the HUD;
- ignoring both entrances still transitions by 72 seconds;
- selecting either route changes background palette, field rule, visible creature mix, and journey counter;
- within a 90-second capture, at least three distinct behavior presentations and two AI-versus-AI interactions appear;
- no 8-second interval lacks all three of edible, dangerous, and opportunity cues;
- console errors remain zero and the pressure scene remains at least 30 FPS.

- [ ] **Step 7: Commit the ecology journey**

```bash
git add projects/09-proto-cell/src/tests/playthrough.ts projects/09-proto-cell/src/tests/playthrough.test.ts projects/09-proto-cell/src/tests/performance-budget.test.ts projects/09-proto-cell/src/app/view-model.ts projects/09-proto-cell/src/app/view-model.test.ts projects/09-proto-cell/src/progression/archive.ts projects/09-proto-cell/src/progression/archive.test.ts projects/09-proto-cell/src/ui/Hud.tsx projects/09-proto-cell/src/ui/Hud.test.tsx
git commit -m "feat(proto-cell): complete ecology journey slice"
```

## Phase Completion Gate

The phase is complete only when an unattended deterministic run advances through all six stages, nearby enemies display distinct stateful behavior, distant populations remain bounded, and a real mobile browser shows repeated changes in environment and food-chain relationships without requiring rift discovery.
