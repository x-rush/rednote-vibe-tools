# Scale Evolution Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task on `main`. Steps use checkbox (`- [ ]`) syntax for tracking; do not dispatch subagents unless the user explicitly changes that constraint.

**Goal:** Replace unlimited same-cell growth with a complete three-form roguelite run in which the player evolves from a primal cell to a connected colony and finally a ciliate composite, with a distinct playable ecosystem at each scale.

**Architecture:** Introduce a content-driven lifecycle model that owns bounded physical radius, tier progress, form identity, and transition readiness. The engine consumes that model, camera and ecology derive from the same real viewport scale, and each form transition rebuilds the world with a tier-specific ecology while preserving the passive organ build.

**Tech Stack:** React 19, TypeScript 6, Canvas 2D, Vitest 4, Vite 8, existing Web Audio and local assets; no new dependencies.

**Spec:** `projects/09-proto-cell/design/2026-09-02-scale-evolution-redesign.md`

## Global Constraints

- Modify only `projects/09-proto-cell`; do not modify root workspace files, lockfiles, `docs/`, `prep/`, or other projects.
- Work directly on `main`; do not create a branch, worktree, or `rednote-vibe-tools-worktrees` directory.
- Keep the game pure frontend and statically buildable, with no backend, runtime CDN, required external API, Service Worker, Node runtime API, or unapproved device API.
- Keep all business configuration and display copy in `src/content/content.json`; logic files may interpret stable IDs but must not introduce user-facing strings.
- Gameplay remains movement-only. Every organ action is automatic and triggered by movement, proximity, containment, damage, engulf, environment, or deterministic cooldown.
- Preserve damage numbers, biomass gains, chain feedback, particles, audio cues, reduced-motion behavior, reduced-flash behavior, and reduced-particle behavior.
- Preserve structured progression, settings, codex, archives, and challenges through migration; never clear user storage as an upgrade strategy.
- Never store user images, Base64, audio, video, or Blob data.
- Do not delete tests to pass a gate. Each task follows red-green-refactor and ends with a focused test run and a commit.
- Before every commit, confirm the staged paths are only under `projects/09-proto-cell/**`.
- Final verification is `pnpm lint && pnpm test && pnpm build`, followed by real-browser checks at 375×812, 390×844, and 430×932 with `--safe-area-inset-top: 44px`.
- Current execution must use inline `executing-plans`; do not dispatch subagents unless the user explicitly asks for delegation in a later turn.

---

## File Structure

### New files

- `src/evolution/lifecycle.ts`: pure form-tier growth, radius, transition, and invariants.
- `src/evolution/lifecycle.test.ts`: bounded-growth and transition contract tests.
- `src/world/scale-world.ts`: world dimensions, corridor limits, safe spawn geometry, and viewport conversion.
- `src/world/scale-world.test.ts`: dimension and safe-space tests.
- `src/ui/EcologyRadar.tsx`: passive boundary, encounter, exit, and warned-threat radar.
- `src/ui/EcologyRadar.test.tsx`: radar projection and accessibility tests.

### Major modified files

- `src/content/schema.ts`: `FormId`, `ScaleTierDefinition`, and tier-aware content fields.
- `src/content/validate.ts`: scale, ecosystem replacement, corridor, and stable-ID validation.
- `src/content/content.json`: three tiers, three active ecosystems, form copy, encounter data, tier creature membership, and revised timings.
- `src/game/engine.ts`: lifecycle ownership, bounded radius application, viewport state, transition events, and removal of gameplay-critical swarm control.
- `src/game/interactions.ts`: authoritative biomass event flow without forcing physical radius growth.
- `src/rendering/camera.ts`: radius-aware zoom and visible-world calculations.
- `src/world/generator.ts`: tier-derived world dimensions, safe layouts, and tier ecology.
- `src/world/ecology-director.ts`: real viewport radius, tier budgets, and non-teleporting arrival bands.
- `src/world/run-director.ts`: three linear ecosystems driven by pressure plus encounter resolution.
- `src/rendering/morphology.ts`: primal, colony, and ciliate skeletons.
- `src/rendering/cell.ts`: form-specific Canvas anatomy.
- `src/rendering/metamorphosis.ts`: 1.2-second form transition presentation.
- `src/rendering/renderer.ts`: dynamic camera inputs, new anatomy, ecology reveal, and radar snapshot data.
- `src/evolution/build.ts`: six-offer run guarantees and cross-form inheritance.
- `src/evolution/organs.ts`: replace player-control split with automatic colony decoys.
- `src/ui/Hud.tsx`: form name, evolution pressure, and radar placement.
- `src/App.tsx`: transition pause/resume orchestration and three-tier progression.
- `src/storage/codec.ts`: conservative legacy stage/form migration.
- `src/progression/archive.ts`: final form and ecosystem facts.
- `src/tests/playthrough.ts`: deterministic three-ecosystem full-run audit.

---

### Task 1: Content Contract and Bounded Lifecycle

**Files:**
- Create: `src/evolution/lifecycle.ts`
- Create: `src/evolution/lifecycle.test.ts`
- Modify: `src/content/schema.ts`
- Modify: `src/content/validate.ts`
- Modify: `src/content/validate.test.ts`
- Modify: `src/content/content.json`
- Modify: `src/content/content-completeness.test.ts`

**Interfaces:**
- Produces: `FormId = 'form-primal-cell' | 'form-colony-body' | 'form-ciliate-composite'`.
- Produces: `ScaleTierDefinition`, `LifecycleState`, `createLifecycle`, `applyLifecycleBiomass`, `markLifecycleEncounterResolved`, `canAdvanceLifecycle`, `advanceLifecycle`, and `radiusForTierProgress`.
- Consumed by: Tasks 2–8.

- [ ] **Step 1: Write failing lifecycle tests**

```ts
import { describe, expect, it } from 'vitest'
import { advanceLifecycle, applyLifecycleBiomass, canAdvanceLifecycle, createLifecycle, radiusForTierProgress } from './lifecycle'

const tiers = [{
  id: 'tier-single-cell', formId: 'form-primal-cell', name: '原始单细胞',
  environmentId: 'env-clear-drop', targetDurationMs: 150_000,
  radiusRange: [12, 22], screenDiameterRange: [0.16, 0.21],
  worldBodyWidths: 30, minimumCollapsedBodyWidths: 6,
  evolutionPressureTarget: 100, ecologyBudgetId: 'ecology-tier-single-cell',
  encounterId: 'encounter-primal-shadow', movementBodyLengthsPerSecond: 2.4,
  turnResponseMs: 120,
}, {
  id: 'tier-colony', formId: 'form-colony-body', name: '聚合多细胞体',
  environmentId: 'env-fiber-maze', targetDurationMs: 210_000,
  radiusRange: [18, 32], screenDiameterRange: [0.19, 0.25],
  worldBodyWidths: 24, minimumCollapsedBodyWidths: 6,
  evolutionPressureTarget: 200, ecologyBudgetId: 'ecology-tier-colony',
  encounterId: 'encounter-fiber-giant', movementBodyLengthsPerSecond: 2,
  turnResponseMs: 170,
}, {
  id: 'tier-ciliate', formId: 'form-ciliate-composite', name: '草履虫型复合体',
  environmentId: 'env-abandoned-chamber', targetDurationMs: 270_000,
  radiusRange: [24, 40], screenDiameterRange: [0.22, 0.28],
  worldBodyWidths: 22, minimumCollapsedBodyWidths: 6,
  evolutionPressureTarget: 300, ecologyBudgetId: 'ecology-tier-ciliate',
  encounterId: 'encounter-final-host', movementBodyLengthsPerSecond: 1.95,
  turnResponseMs: 145,
}] as const

it('caps physical radius while preserving excess biomass and pressure', () => {
  const state = applyLifecycleBiomass(createLifecycle(tiers, 144), 150, tiers)
  expect(state.totalBiomass).toBe(294)
  expect(state.evolutionPressure).toBe(1)
  expect(state.bodyRadius).toBe(22)
})

it('requires both full pressure and the ecology encounter before advancing', () => {
  const full = applyLifecycleBiomass(createLifecycle(tiers, 144), 100, tiers)
  expect(canAdvanceLifecycle(full, tiers)).toBe(false)
  expect(canAdvanceLifecycle({ ...full, encounterResolved: true }, tiers)).toBe(true)
  expect(advanceLifecycle({ ...full, encounterResolved: true }, tiers)).toMatchObject({
    tierIndex: 1, formId: 'form-colony-body', tierBiomass: 0, bodyRadius: 18,
  })
})

it('never advertises a fourth form after the final tier', () => {
  const final = { ...createLifecycle(tiers, 144), tierIndex: 2, formId: 'form-ciliate-composite' as const, evolutionPressure: 1, encounterResolved: true }
  expect(canAdvanceLifecycle(final, tiers)).toBe(false)
  expect(() => advanceLifecycle(final, tiers)).toThrow(RangeError)
})

it('uses a finite eased radius inside the configured interval', () => {
  expect(radiusForTierProgress(tiers[0], 0.5)).toBe(19.5)
  expect(radiusForTierProgress(tiers[0], Number.NaN)).toBe(12)
})
```

- [ ] **Step 2: Run the focused tests and verify red**

Run: `pnpm exec vitest run src/evolution/lifecycle.test.ts src/content/validate.test.ts src/content/content-completeness.test.ts --maxWorkers=1`

Expected: FAIL because lifecycle exports and scale-tier content do not exist.

- [ ] **Step 3: Add exact schema and lifecycle types**

```ts
export type FormId = 'form-primal-cell' | 'form-colony-body' | 'form-ciliate-composite'

export type ScaleTierDefinition = {
  id: 'tier-single-cell' | 'tier-colony' | 'tier-ciliate'
  formId: FormId
  name: string
  environmentId: EnvironmentId
  targetDurationMs: number
  radiusRange: [number, number]
  screenDiameterRange: [number, number]
  worldBodyWidths: number
  minimumCollapsedBodyWidths: number
  evolutionPressureTarget: number
  ecologyBudgetId: string
  encounterId: string
  movementBodyLengthsPerSecond: number
  turnResponseMs: number
}

export type LifecycleState = {
  tierIndex: number
  formId: FormId
  totalBiomass: number
  tierBiomass: number
  evolutionPressure: number
  bodyRadius: number
  encounterResolved: boolean
}
```

Implement the radius curve as `min + (max - min) * (1 - (1 - clampedProgress) ** 2)`. Clamp non-finite biomass gain to zero and non-finite progress to zero. `canAdvanceLifecycle(state, tiers)` must also return false at the final tier. `advanceLifecycle` must throw a `RangeError` when called before readiness or beyond the final tier.

- [ ] **Step 4: Add exactly three tier definitions to content**

Use these active environment mappings and initial calibration values:

```json
[
  { "id": "tier-single-cell", "formId": "form-primal-cell", "environmentId": "env-clear-drop", "targetDurationMs": 150000, "radiusRange": [12, 22], "screenDiameterRange": [0.16, 0.21], "worldBodyWidths": 30, "minimumCollapsedBodyWidths": 6, "evolutionPressureTarget": 260, "ecologyBudgetId": "ecology-tier-single-cell", "encounterId": "encounter-primal-shadow", "movementBodyLengthsPerSecond": 2.4, "turnResponseMs": 120 },
  { "id": "tier-colony", "formId": "form-colony-body", "environmentId": "env-fiber-maze", "targetDurationMs": 210000, "radiusRange": [18, 32], "screenDiameterRange": [0.19, 0.25], "worldBodyWidths": 24, "minimumCollapsedBodyWidths": 6, "evolutionPressureTarget": 540, "ecologyBudgetId": "ecology-tier-colony", "encounterId": "encounter-fiber-giant", "movementBodyLengthsPerSecond": 2.0, "turnResponseMs": 170 },
  { "id": "tier-ciliate", "formId": "form-ciliate-composite", "environmentId": "env-abandoned-chamber", "targetDurationMs": 270000, "radiusRange": [24, 40], "screenDiameterRange": [0.22, 0.28], "worldBodyWidths": 22, "minimumCollapsedBodyWidths": 6, "evolutionPressureTarget": 900, "ecologyBudgetId": "ecology-tier-ciliate", "encounterId": "encounter-final-host", "movementBodyLengthsPerSecond": 1.95, "turnResponseMs": 145 }
]
```

Add UI labels for all three forms and encounters to `content.json`. Preserve all six legacy environment IDs; mark only the three listed above as active through scale-tier references.

- [ ] **Step 5: Validate the complete contract**

Require three unique tier IDs and form IDs, ascending radius ranges, screen ratios within `(0, 0.3]`, `worldBodyWidths >= 14`, `minimumCollapsedBodyWidths >= 6`, positive duration/pressure/movement, and finite numbers. Require every tier reference to resolve and every active environment to differ from the previous tier.

- [ ] **Step 6: Run focused tests and verify green**

Run: `pnpm exec vitest run src/evolution/lifecycle.test.ts src/content/validate.test.ts src/content/content-completeness.test.ts --maxWorkers=1`

Expected: PASS with three validated tiers and bounded radius for finite and malformed inputs.

- [ ] **Step 7: Commit the lifecycle contract**

```bash
git add projects/09-proto-cell/src/evolution/lifecycle.ts projects/09-proto-cell/src/evolution/lifecycle.test.ts projects/09-proto-cell/src/content/schema.ts projects/09-proto-cell/src/content/validate.ts projects/09-proto-cell/src/content/validate.test.ts projects/09-proto-cell/src/content/content.json projects/09-proto-cell/src/content/content-completeness.test.ts
git commit -m "feat(proto-cell): define bounded evolution lifecycle"
```

---

### Task 2: Engine-Owned Biomass and Finite Player Body

**Files:**
- Modify: `src/game/engine.ts`
- Modify: `src/game/engine.test.ts`
- Modify: `src/game/interactions.ts`
- Modify: `src/game/interactions.test.ts`
- Modify: `src/domain/types.ts`
- Modify: `src/tests/fixtures.ts`

**Interfaces:**
- Consumes: `LifecycleState` and lifecycle functions from Task 1.
- Produces: `HudSnapshot.formId`, `tierIndex`, `tierProgress`; `WorldRenderSnapshot.lifecycle`; `GameEvent` variants `form-transition-ready` and `form-transitioned`; `ProtoCellEngine.advanceForm()`.
- Test seam: `createTestEngine({ lifecycle })` passes an `initialLifecycle` option into the engine factory for deterministic headless setup; production startup omits it and always calls `createLifecycle`.
- Consumed by: Tasks 3–8.

- [ ] **Step 1: Write failing engine growth tests**

Add tests that place edible entities over the player and assert literal outcomes:

```ts
it('turns player engulf biomass into lifecycle pressure without exceeding tier radius', () => {
  const engine = createTestEngine({ seed: 727 })
  const player = entityAt(engine, 'player')
  player.mass = 10_000
  player.body = circleBody(player.position, 22)
  engine.start()
  engine.advance(17)
  expect(engine.renderSnapshot().entities.find((item) => item.id === 'player')?.body.radius).toBeLessThanOrEqual(22)
  expect(engine.snapshot().biomass).toBeGreaterThan(144)
})

it('emits one transition-ready event only after pressure and encounter are complete', () => {
  const engine = createTestEngine({ seed: 727, lifecycle: { tierBiomass: 260, evolutionPressure: 1, encounterResolved: true } })
  engine.start()
  engine.advance(17)
  expect(engine.drainEvents().filter((event) => event.type === 'form-transition-ready')).toHaveLength(1)
  engine.advance(17)
  expect(engine.drainEvents().filter((event) => event.type === 'form-transition-ready')).toHaveLength(0)
})
```

- [ ] **Step 2: Run the engine tests and verify red**

Run: `pnpm exec vitest run src/game/interactions.test.ts src/game/engine.test.ts --maxWorkers=1`

Expected: FAIL because the player still uses unbounded `sqrt(mass)` resizing and snapshots lack lifecycle fields.

- [ ] **Step 3: Make engulf events authoritative for lifecycle gain**

Keep `EntityState.mass` for compatibility and AI biomass comparisons, but never derive the player's body radius directly from it. After each player-authored `engulfed` event, call `applyLifecycleBiomass(lifecycle, event.biomass, tiers)` and rebuild the player's body with `lifecycle.bodyRadius`. Non-player predators continue using their existing bounded local mass behavior.

Add a focused body helper:

```ts
function resizeBodyToRadius(entity: EntityState, radius: number): EntityState
```

It must reject non-finite/non-positive radius with `RangeError`, preserve position and velocity, and rebuild the contour from the accepted radius.

- [ ] **Step 4: Expose transition state without automatic world mutation**

When `canAdvanceLifecycle(lifecycle, tiers)` first becomes true, set `formTransitionPending = true` and emit:

```ts
{ type: 'form-transition-ready', fromFormId, toFormId, atMs }
```

Implement `engine.advanceForm()` to require the pending flag, call `advanceLifecycle`, clear the flag, and emit `form-transitioned`. Do not change the environment in this task; Task 5 will connect the event to the run director.

- [ ] **Step 5: Remove direct player calls to `resizeForMass`**

Retain `resizeForMass` only for non-player ecology entities. Route every player resize after engulf, migration, fusion compatibility, and test setup through `resizeBodyToRadius` and the lifecycle state. Add an invariant pass before `renderSnapshot` that throws a named lifecycle error if player mass, radius, position, or velocity is non-finite.

- [ ] **Step 6: Run engine and interaction tests and verify green**

Run: `pnpm exec vitest run src/evolution/lifecycle.test.ts src/game/interactions.test.ts src/game/engine.test.ts --maxWorkers=1`

Expected: PASS; large biomass no longer creates a player radius above the tier cap, and transition events are emitted once.

- [ ] **Step 7: Commit bounded engine growth**

```bash
git add projects/09-proto-cell/src/game/engine.ts projects/09-proto-cell/src/game/engine.test.ts projects/09-proto-cell/src/game/interactions.ts projects/09-proto-cell/src/game/interactions.test.ts projects/09-proto-cell/src/domain/types.ts projects/09-proto-cell/src/tests/fixtures.ts
git commit -m "fix(proto-cell): bound player growth by life form"
```

---

### Task 3: Radius-Aware Camera, Movement, and World Safety

**Files:**
- Create: `src/world/scale-world.ts`
- Create: `src/world/scale-world.test.ts`
- Modify: `src/rendering/camera.ts`
- Modify: `src/rendering/camera.test.ts`
- Modify: `src/game/motion.ts`
- Modify: `src/game/motion.test.ts`
- Modify: `src/game/bounds.ts`
- Modify: `src/game/bounds.test.ts`
- Modify: `src/game/engine.ts`
- Modify: `src/ui/GameCanvas.tsx`
- Modify: `src/ui/GameCanvas.test.ts`

**Interfaces:**
- Consumes: tier radius, screen ratio, world width, and movement body-length rate.
- Produces: `targetScreenDiameterRatio`, `cameraZoomFor`, `visibleWorldRadius`, `worldDimensionsForTier`, `minimumPlayableWidth`, `worldSpeedForForm`; `ProtoCellEngine.setViewport(viewport)`.
- Consumed by: Tasks 4–8.

- [ ] **Step 1: Replace the fixed-stage camera test with failing radius-aware tests**

```ts
it('keeps a growing player inside the tier screen-diameter band', () => {
  expect(cameraZoomFor({ viewport: { width: 390, height: 844 }, radius: 12, screenDiameterRatio: 0.16 })).toBeCloseTo(2.6)
  expect(cameraZoomFor({ viewport: { width: 390, height: 844 }, radius: 40, screenDiameterRatio: 0.28 })).toBeCloseTo(1.365)
})

it('reports the actual visible world radius used by ecology', () => {
  expect(visibleWorldRadius({ width: 390, height: 844 }, 2)).toBeCloseTo(232.5, 1)
})

it('interpolates the target screen ratio with finite tier progress', () => {
  expect(targetScreenDiameterRatio([0.16, 0.21], 0.5)).toBeCloseTo(0.185)
  expect(targetScreenDiameterRatio([0.16, 0.21], Number.NaN)).toBe(0.16)
})
```

The second expected value is half the viewport diagonal divided by zoom.

- [ ] **Step 2: Add failing world-space invariants**

```ts
it('never produces a collapsed arena narrower than six player diameters', () => {
  expect(minimumPlayableWidth(40, 6)).toBe(480)
  expect(collapseInsetLimit({ width: 1760, height: 2992 }, 40, 6)).toBeLessThanOrEqual(640)
})

it('expresses movement in body lengths instead of fixed world units', () => {
  expect(worldSpeedForForm(24, 2.4)).toBeCloseTo(115.2)
})
```

- [ ] **Step 3: Run camera, motion, and bounds tests and verify red**

Run: `pnpm exec vitest run src/rendering/camera.test.ts src/world/scale-world.test.ts src/game/motion.test.ts src/game/bounds.test.ts --maxWorkers=1`

Expected: FAIL because zoom is fixed by body-stage labels and world safety helpers do not exist.

- [ ] **Step 4: Implement shared scale math**

`targetScreenDiameterRatio` linearly interpolates the configured range from clamped tier progress and falls back to its minimum for non-finite progress. `cameraZoomFor` uses `shortSide * screenDiameterRatio / (radius * 2)` and clamps only to finite positive limits derived from the world. `worldDimensionsForTier` uses the tier maximum diameter times `worldBodyWidths`, with portrait height equal to width times `1.7`. `visibleWorldRadius` is the sole viewport radius passed to ecology.

Use a 600ms exponential camera zoom response during ordinary growth. Form transitions may temporarily override it through the presentation state in Task 6.

- [ ] **Step 5: Make movement body-relative**

Compute player `maxSpeed` as `body.radius * 2 * tier.movementBodyLengthsPerSecond`, then use the tier's `turnResponseMs`. Preserve organ speed multipliers after this base calculation. Verify that screen-space speed remains between 0.35 and 0.55 viewport short sides per second across all tiers at their target zoom.

- [ ] **Step 6: Bound collapse and boundary steering**

Clamp environment collapse inset so the remaining width and height each accommodate `minimumCollapsedBodyWidths * playerDiameter`. When an existing configured collapse would violate the invariant, stop shrinking and increase hazard pressure instead. Keep soft steering and sliding; do not introduce hard corners.

- [ ] **Step 7: Feed real viewport dimensions into the engine**

Add:

```ts
setViewport(viewport: { width: number; height: number }): void
```

`GameCanvas` calls it after every successful canvas resize, using CSS pixel dimensions. Headless tests default to 390×844. Cancel pointer input on viewport changes, then allow normal input on the next frame.

- [ ] **Step 8: Run focused tests and verify green**

Run: `pnpm exec vitest run src/rendering/camera.test.ts src/world/scale-world.test.ts src/game/motion.test.ts src/game/bounds.test.ts src/game/engine.test.ts src/ui/GameCanvas.test.ts --maxWorkers=1`

Expected: PASS at 375, 390, and 430 widths; no legal tier can occupy more than 30% of the screen short side or collapse below six body diameters.

- [ ] **Step 9: Commit the scale-safe camera and movement**

```bash
git add projects/09-proto-cell/src/world/scale-world.ts projects/09-proto-cell/src/world/scale-world.test.ts projects/09-proto-cell/src/rendering/camera.ts projects/09-proto-cell/src/rendering/camera.test.ts projects/09-proto-cell/src/game/motion.ts projects/09-proto-cell/src/game/motion.test.ts projects/09-proto-cell/src/game/bounds.ts projects/09-proto-cell/src/game/bounds.test.ts projects/09-proto-cell/src/game/engine.ts projects/09-proto-cell/src/ui/GameCanvas.tsx projects/09-proto-cell/src/ui/GameCanvas.test.ts
git commit -m "feat(proto-cell): scale camera and movement with form"
```

---

### Task 4: Three Distinct Tier Ecosystems

**Files:**
- Modify: `src/content/content.json`
- Modify: `src/content/schema.ts`
- Modify: `src/content/validate.ts`
- Modify: `src/content/validate.test.ts`
- Modify: `src/world/generator.ts`
- Modify: `src/world/generator.test.ts`
- Modify: `src/world/environments.ts`
- Modify: `src/world/environments.test.ts`
- Modify: `src/world/ecology-director.ts`
- Modify: `src/world/ecology-director.test.ts`
- Modify: `src/entities/ai.ts`
- Modify: `src/entities/ai.test.ts`
- Modify: `src/game/engine.test.ts`

**Interfaces:**
- Consumes: `ScaleTierDefinition`, `worldDimensionsForTier`, and real viewport radius.
- Produces: tier-tagged creature pools, `generateTierRegion`, safe tier obstacles, and tier-aware ecology commands.
- Consumed by: Tasks 5–8.

- [ ] **Step 1: Write failing ecosystem replacement and geometry tests**

```ts
it('replaces at least sixty percent of ordinary species between adjacent tiers', () => {
  expect(adjacentTierReplacementRatio(content.scaleTiers[0], content.scaleTiers[1], content.creatures)).toBeGreaterThanOrEqual(0.6)
  expect(adjacentTierReplacementRatio(content.scaleTiers[1], content.scaleTiers[2], content.creatures)).toBeGreaterThanOrEqual(0.6)
})

it('keeps every generated corridor wider than the largest tier body', () => {
  for (let seed = 0; seed < 20; seed += 1) {
    const region = generateTierRegion(seed, content.scaleTiers[1])
    expect(region.minimumCorridorWidth).toBeGreaterThanOrEqual(content.scaleTiers[1].radiusRange[1] * 2.4)
  }
})

it('spawns groups relative to the real visible radius', () => {
  const command = ecologyOpportunityScene('school-migration', 120)
  expect(command.distance).toBeCloseTo(141.6)
})
```

- [ ] **Step 2: Run ecosystem tests and verify red**

Run: `pnpm exec vitest run src/content/validate.test.ts src/world/generator.test.ts src/world/environments.test.ts src/world/ecology-director.test.ts src/entities/ai.test.ts --maxWorkers=1`

Expected: FAIL because creatures lack scale-tier membership, generator dimensions are fixed, and ecology still assumes viewport radius 320.

- [ ] **Step 3: Tag content into three non-overlapping primary food chains**

Add `scaleTierIds` to creature and nutrient definitions. Configure:

- `tier-single-cell`: nutrients, bacteria-like resources, drifters, competitors, azure-ring hunters.
- `tier-colony`: single-cell schools, spores, colony scavengers, parasites, acid grazers, fiber giant encounter.
- `tier-ciliate`: energy sacs, multicellular prey, hostile colonies, antibody hunters, chamber maw, final host.

At least one former tier predator must reappear in the next tier as a prey or scavenger definition with a distinct stable ID and inherited visual family. Do not change an existing stable ID to a different semantic type.

- [ ] **Step 4: Generate tier-sized worlds and safe layouts**

Replace fixed 640×1100 fallback dimensions with `worldDimensionsForTier`. Build at least three deterministic obstacle layout candidates per tier and choose the first candidate that passes corridor, spawn, exit, and encounter reachability checks. Use the same seed and candidate index to keep generation reproducible.

The active runtime environments are `env-clear-drop`, `env-fiber-maze`, and `env-abandoned-chamber`. Preserve legacy definitions for archive lookup, but exclude them from the new run director.

- [ ] **Step 5: Replace single-line obstacles with tier geometry**

The colony ecosystem must contain multiple fiber capsules and acid zones with at least two traversable routes. The ciliate ecosystem must contain open pursuit lanes, a moving sweep band, and a final encounter arena. Collision queries continue using analytic segments/circles; do not add a pathfinding dependency.

- [ ] **Step 6: Drive ecology with actual visibility**

Remove the engine's hardcoded `viewportRadius: 320`. Pass `visibleWorldRadius(viewport, cameraZoom)` into `stepEcologyDirector`. Spawn ordinary groups at 1.1–1.6 viewport radii, threats outside 1.2 viewport radii, and support food within 0.25–0.55 viewport radii. Materialized threats use the existing approach/alert states and normal movement speed; they never fly rapidly from a spawn point. Extend the existing engine arrival test to assert the spawn distance against the current `visibleWorldRadius` and approach velocity against the entity's configured `maxSpeed`, then preserve the harmless alert window assertion.

- [ ] **Step 7: Run ecosystem and AI tests and verify green**

Run: `pnpm exec vitest run src/content/validate.test.ts src/world/generator.test.ts src/world/environments.test.ts src/world/ecology-director.test.ts src/entities/ai.test.ts src/game/engine.test.ts --maxWorkers=1`

Expected: PASS across 20 seeds with legal corridors, 60% adjacent replacement, real viewport distances, and readable arrivals.

- [ ] **Step 8: Commit the tier ecosystems**

```bash
git add projects/09-proto-cell/src/content/content.json projects/09-proto-cell/src/content/schema.ts projects/09-proto-cell/src/content/validate.ts projects/09-proto-cell/src/content/validate.test.ts projects/09-proto-cell/src/world/generator.ts projects/09-proto-cell/src/world/generator.test.ts projects/09-proto-cell/src/world/environments.ts projects/09-proto-cell/src/world/environments.test.ts projects/09-proto-cell/src/world/ecology-director.ts projects/09-proto-cell/src/world/ecology-director.test.ts projects/09-proto-cell/src/entities/ai.ts projects/09-proto-cell/src/entities/ai.test.ts projects/09-proto-cell/src/game/engine.test.ts
git commit -m "feat(proto-cell): build three scale ecosystems"
```

---

### Task 5: Linear Run Director and Ecology Encounters

**Files:**
- Modify: `src/world/run-director.ts`
- Modify: `src/world/run-director.test.ts`
- Modify: `src/world/bosses.ts`
- Modify: `src/world/bosses.test.ts`
- Modify: `src/game/engine.ts`
- Modify: `src/game/engine.test.ts`
- Modify: `src/ui/MigrationOverlay.tsx`
- Modify: `src/ui/MigrationOverlay.test.tsx`
- Modify: `src/content/content.json`

**Interfaces:**
- Consumes: lifecycle transition readiness and tier encounter IDs.
- Produces: three-stage `RunDirectorState`, `resolveTierEncounter`, deterministic pressure escalation, and automatic form/environment transition orchestration. The director changes phase and reports encounter resolution; the engine remains the sole owner and emitter of `form-transition-ready` and `form-transitioned`.
- Consumed by: Tasks 6–8.

- [ ] **Step 1: Write failing three-stage progression tests**

```ts
it('advances only after both lifecycle pressure and the tier encounter resolve', () => {
  const state = createRunDirector(content.scaleTiers, 727, 0, content.firstRunAssist)
  expect(stepRunDirector(state, { atMs: 150_000, pressureReady: true, encounterResolved: false }).state.tierIndex).toBe(0)
  const ready = stepRunDirector(state, { atMs: 150_000, pressureReady: true, encounterResolved: true })
  expect(ready.state).toMatchObject({ tierIndex: 0, phase: 'transition' })
  expect(ready.events).toContainEqual(expect.objectContaining({ type: 'tier-encounter-resolved', tierIndex: 0 }))
})

it('finishes after the ciliate encounter instead of entering a fourth stage', () => {
  const final = runDirectorFixture({ tierIndex: 2, phase: 'encounter', pressureReady: true })
  expect(stepRunDirector(final, { atMs: 600_000, pressureReady: true, encounterResolved: true }).state.phase).toBe('complete')
})
```

- [ ] **Step 2: Run director, engine, and boss tests and verify red**

Run: `pnpm exec vitest run src/world/run-director.test.ts src/world/bosses.test.ts src/game/engine.test.ts src/ui/MigrationOverlay.test.tsx --maxWorkers=1`

Expected: FAIL because the director owns six timed stages and route choices rather than three lifecycle gates.

- [ ] **Step 3: Replace route-choice progression with three lifecycle phases**

Use phases:

```ts
type RunPhase = 'feeding' | 'warning' | 'encounter' | 'transition' | 'finale' | 'complete'
```

Pressure readiness moves `feeding` to `warning`; the tier target duration can also start warning but never completes the tier alone. Warning activates the configured encounter. Encounter resolution plus full pressure moves the director to `transition` and reports `tier-encounter-resolved` to the engine. The engine marks lifecycle encounter resolution and emits exactly one `form-transition-ready` event. The final tier moves through `finale` to an ending or structured death instead of asking lifecycle to advance beyond its last tier.

- [ ] **Step 4: Convert the migration overlay into a non-choice evolution bridge**

Remove two-route selection from the active run. The overlay displays current form, next form, the new ecosystem silhouette, and one concise food-chain reversal. It has no gameplay selection and disappears when the transition presentation completes. Keep old route IDs readable in archives only.

- [ ] **Step 5: Implement non-crushing overdue pressure**

After `targetDurationMs`, increase encounter presence and hazard frequency in three bounded steps. Do not shrink the arena below `minimumCollapsedBodyWidths`. Every pressure step must preserve threat telegraphs and a navigable route to the encounter.

- [ ] **Step 6: Connect `advanceForm()` to environment rebuild**

On transition commit: advance lifecycle, select the next tier environment, generate a new tier region, place the player in a validated safe spawn, preserve installed organs and total biomass, reset tier biomass/encounter state, and clear non-player entities from the previous ecosystem. Apply a 1000ms interaction guard after resume.

- [ ] **Step 7: Run progression tests and verify green**

Run: `pnpm exec vitest run src/world/run-director.test.ts src/world/bosses.test.ts src/game/engine.test.ts src/ui/MigrationOverlay.test.tsx src/tests/playthrough.test.ts --maxWorkers=1`

Expected: PASS for a deterministic single-cell → colony → ciliate chain and a complete final encounter, with no hidden fourth/sixth stage.

- [ ] **Step 8: Commit the linear life journey**

```bash
git add projects/09-proto-cell/src/world/run-director.ts projects/09-proto-cell/src/world/run-director.test.ts projects/09-proto-cell/src/world/bosses.ts projects/09-proto-cell/src/world/bosses.test.ts projects/09-proto-cell/src/game/engine.ts projects/09-proto-cell/src/game/engine.test.ts projects/09-proto-cell/src/ui/MigrationOverlay.tsx projects/09-proto-cell/src/ui/MigrationOverlay.test.tsx projects/09-proto-cell/src/content/content.json
git commit -m "feat(proto-cell): evolve through three life forms"
```

---

### Task 6: Form Skeletons and Metamorphosis Presentation

**Files:**
- Modify: `src/rendering/morphology.ts`
- Modify: `src/rendering/morphology.test.ts`
- Modify: `src/rendering/cell.ts`
- Modify: `src/rendering/cell.test.ts`
- Modify: `src/rendering/metamorphosis.ts`
- Modify: `src/rendering/metamorphosis.test.ts`
- Modify: `src/rendering/renderer.ts`
- Modify: `src/rendering/effects.ts`
- Modify: `src/rendering/effects.test.ts`
- Modify: `src/audio/audio.ts`
- Modify: `src/audio/audio.test.ts`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `FormId`, build traits, lifecycle transition events, and camera override values.
- Produces: `morphologyFor(formId, build)`, form-specific body paths, `metamorphosisPresentation(ageMs, fromFormId, toFormId, reducedMotion)`, and transition audio cues.
- Consumed by: Tasks 7–8.

- [ ] **Step 1: Write failing form-distinction tests**

```ts
it('gives all three forms distinct skeletons and anatomy', () => {
  const primal = morphologyFor('form-primal-cell', createBuildState())
  const colony = morphologyFor('form-colony-body', createBuildState())
  const ciliate = morphologyFor('form-ciliate-composite', createBuildState())
  expect(new Set([primal.skeleton, colony.skeleton, ciliate.skeleton]).size).toBe(3)
  expect(colony.coreCount).toBeGreaterThan(1)
  expect(ciliate.parts).toContain('oral-groove')
})

it('uses a 1.2 second transition and a short reduced-motion crossfade', () => {
  expect(metamorphosisPresentation(1199, 'form-primal-cell', 'form-colony-body', false)).toBeDefined()
  expect(metamorphosisPresentation(1200, 'form-primal-cell', 'form-colony-body', false)).toBeUndefined()
  expect(metamorphosisPresentation(240, 'form-primal-cell', 'form-colony-body', true)).toBeUndefined()
})
```

- [ ] **Step 2: Run rendering and audio tests and verify red**

Run: `pnpm exec vitest run src/rendering/morphology.test.ts src/rendering/cell.test.ts src/rendering/metamorphosis.test.ts src/rendering/effects.test.ts src/audio/audio.test.ts --maxWorkers=1`

Expected: FAIL because morphology is derived from abstract body stages and metamorphosis ends at 900ms without form anatomy.

- [ ] **Step 3: Implement three Canvas skeletons**

Add `primal`, `colony`, and `ciliate` skeletons. Primal uses one asymmetric membrane and one core. Colony uses connected lobes, shared outer membrane, multiple cores, and delayed node motion while keeping one collision body. Ciliate uses an elongated axis, directional oral groove, dense cilia, and multiple internal structures. Trait parts attach to form-specific anchors and remain capped at six high-detail parts on small screens.

- [ ] **Step 4: Implement the transition presentation state**

Use phases `contract` (0–240ms), `rebuild` (240–680ms), `pull-back` (680–940ms), and `reveal` (940–1200ms). Freeze simulation and cancel input before phase one. During reveal, render the next tier's boundary, common prey silhouettes, and warned threat silhouette before resuming. Reduced motion uses a 240ms crossfade with the new form label.

- [ ] **Step 5: Preserve readable combat effects**

Damage, chain, engulf, materialization, arrival, and relationship cues must use the new form path rather than assuming a circle. Keep authoritative collision radius visible: no skeleton point may fall below 90% or exceed 106% of the form's collision envelope except non-colliding cilia and organ appendages.

- [ ] **Step 6: Add layered transition audio without new assets**

Extend existing Web Audio cue patterns with bounded `contract`, `rebuild`, and `reveal` layers. Cap total requested gain at the existing audio limit and preserve silent-mode behavior. Do not add runtime-loaded audio.

- [ ] **Step 7: Run focused rendering tests and verify green**

Run: `pnpm exec vitest run src/rendering/morphology.test.ts src/rendering/cell.test.ts src/rendering/metamorphosis.test.ts src/rendering/effects.test.ts src/audio/audio.test.ts src/ui/GameCanvas.test.ts --maxWorkers=1`

Expected: PASS; screenshots of the three forms remain distinguishable without color, and reduced-motion transitions preserve labels and ecology reveal.

- [ ] **Step 8: Commit the visible life forms**

```bash
git add projects/09-proto-cell/src/rendering/morphology.ts projects/09-proto-cell/src/rendering/morphology.test.ts projects/09-proto-cell/src/rendering/cell.ts projects/09-proto-cell/src/rendering/cell.test.ts projects/09-proto-cell/src/rendering/metamorphosis.ts projects/09-proto-cell/src/rendering/metamorphosis.test.ts projects/09-proto-cell/src/rendering/renderer.ts projects/09-proto-cell/src/rendering/effects.ts projects/09-proto-cell/src/rendering/effects.test.ts projects/09-proto-cell/src/audio/audio.ts projects/09-proto-cell/src/audio/audio.test.ts projects/09-proto-cell/src/App.tsx
git commit -m "feat(proto-cell): render complete form metamorphosis"
```

---

### Task 7: Six-Choice Build, Colony Decoys, HUD, and Radar

**Files:**
- Create: `src/ui/EcologyRadar.tsx`
- Create: `src/ui/EcologyRadar.test.tsx`
- Modify: `src/evolution/build.ts`
- Modify: `src/evolution/build.test.ts`
- Modify: `src/evolution/organs.ts`
- Modify: `src/evolution/organs.test.ts`
- Modify: `src/evolution/triggers.ts`
- Modify: `src/evolution/triggers.test.ts`
- Modify: `src/game/engine.ts`
- Modify: `src/game/engine.test.ts`
- Modify: `src/ui/EvolutionOverlay.tsx`
- Modify: `src/ui/EvolutionOverlay.test.tsx`
- Modify: `src/ui/Hud.tsx`
- Modify: `src/ui/Hud.test.tsx`
- Modify: `src/App.css`
- Modify: `src/content/content.json`

**Interfaces:**
- Consumes: lifecycle tier/form, active encounter, warned threats, world dimensions, and current build.
- Produces: exactly two mutation milestones per tier, automatic colony decoy behavior, `radarMarkers`, and form/pressure HUD.
- Consumed by: Task 8.

- [ ] **Step 1: Write failing build cadence and inheritance tests**

```ts
it('offers exactly two mutations in each of the three tiers', () => {
  expect(mutationMilestones(content.scaleTiers)).toEqual([
    { tierIndex: 0, pressure: 0.35 }, { tierIndex: 0, pressure: 0.72 },
    { tierIndex: 1, pressure: 0.35 }, { tierIndex: 1, pressure: 0.72 },
    { tierIndex: 2, pressure: 0.35 }, { tierIndex: 2, pressure: 0.72 },
  ])
})

it('preserves installed traits across both form transitions', () => {
  const build = createBuildState({ traitIds: ['organelle-flagellum', 'organelle-shell-plate'] })
  expect(advanceBuildForm(advanceBuildForm(build, 'form-colony-body'), 'form-ciliate-composite').traitIds).toEqual(build.traitIds)
})
```

- [ ] **Step 2: Write failing no-surprise-split and radar tests**

```ts
it('spawns a temporary automatic decoy without replacing the controlled player', () => {
  const result = applyOrganEffects([{ entityId: 'player', organId: 'organelle-division-ring', effect: 'colony-decoy', amount: 1 }], context)
  expect(result.controlledEntityId).toBe('player')
  expect(result.spawnedDecoys).toHaveLength(1)
})

it('projects only boundary, encounter, exit, and warned threats', () => {
  expect(radarMarkers(radarFixture()).map((marker) => marker.kind)).toEqual(['boundary', 'encounter', 'warned-threat'])
})
```

- [ ] **Step 3: Run build, organ, HUD, and radar tests and verify red**

Run: `pnpm exec vitest run src/evolution/build.test.ts src/evolution/organs.test.ts src/evolution/triggers.test.ts src/game/engine.test.ts src/ui/EvolutionOverlay.test.tsx src/ui/Hud.test.tsx src/ui/EcologyRadar.test.tsx --maxWorkers=1`

Expected: FAIL because mutation cadence follows the old thresholds, division creates a player swarm, and radar does not exist.

- [ ] **Step 4: Implement six deterministic mutation milestones**

Trigger ordinary mutation at tier pressure 0.35 and 0.72 exactly once. Candidate lanes remain continuation, adaptation, and risk. Filter candidates by current or later tier availability, preserve route counts and synergies across forms, and never offer three standalone scalar upgrades.

- [ ] **Step 5: Replace player swarm control with automatic colony decoys**

Retain the pure split/fusion utilities for archive tests, but remove `activeSwarm` from the active player-control path. `organelle-division-ring` creates one short-lived decoy entity that inherits movement direction, attracts eligible hunters, cannot trigger mutations, and dissolves after its configured lifetime. The player's ID, camera target, input, biomass, and installed organs never switch.

- [ ] **Step 6: Implement the passive ecology radar**

`radarMarkers` accepts world dimensions, player position, encounter/exit positions, and already-warned threats. It returns normalized markers clamped to a circular radar. It must not reveal ordinary food, hidden threats, or untelegraphed enemies. Render a non-interactive 68–76px radar below the safe-area HUD with `aria-label` from content.

- [ ] **Step 7: Simplify HUD and evolution cards**

HUD displays score, form name, pressure bar, membrane, radar, and pause. Evolution cards show route, organ name, visible before/after anatomy, one behavior sentence, and one cost sentence. Keep 44px controls, focus trapping, pause semantics, and no active ability affordance.

- [ ] **Step 8: Run focused UI and build tests and verify green**

Run: `pnpm exec vitest run src/evolution/build.test.ts src/evolution/organs.test.ts src/evolution/triggers.test.ts src/game/engine.test.ts src/ui/EvolutionOverlay.test.tsx src/ui/Hud.test.tsx src/ui/EcologyRadar.test.tsx src/ui/responsive-layout.test.ts --maxWorkers=1`

Expected: PASS with six inherited choices, one stable controlled player, no surprise split/fusion flash, and no hidden information leaked by radar.

- [ ] **Step 9: Commit the complete passive roguelite HUD**

```bash
git add projects/09-proto-cell/src/ui/EcologyRadar.tsx projects/09-proto-cell/src/ui/EcologyRadar.test.tsx projects/09-proto-cell/src/evolution/build.ts projects/09-proto-cell/src/evolution/build.test.ts projects/09-proto-cell/src/evolution/organs.ts projects/09-proto-cell/src/evolution/organs.test.ts projects/09-proto-cell/src/evolution/triggers.ts projects/09-proto-cell/src/evolution/triggers.test.ts projects/09-proto-cell/src/game/engine.ts projects/09-proto-cell/src/game/engine.test.ts projects/09-proto-cell/src/ui/EvolutionOverlay.tsx projects/09-proto-cell/src/ui/EvolutionOverlay.test.tsx projects/09-proto-cell/src/ui/Hud.tsx projects/09-proto-cell/src/ui/Hud.test.tsx projects/09-proto-cell/src/App.css projects/09-proto-cell/src/content/content.json
git commit -m "feat(proto-cell): complete passive evolution build"
```

---

### Task 8: Save Migration, Full-Run Audit, and Mobile Release Gate

**Files:**
- Modify: `src/storage/codec.ts`
- Modify: `src/storage/codec.test.ts`
- Modify: `src/progression/archive.ts`
- Modify: `src/progression/archive.test.ts`
- Modify: `src/app/view-model.ts`
- Modify: `src/app/view-model.test.ts`
- Modify: `src/ui/ResultOverlay.tsx`
- Modify: `src/ui/ResultOverlay.test.tsx`
- Modify: `src/tests/playthrough.ts`
- Modify: `src/tests/playthrough.test.ts`
- Modify: `src/tests/performance-budget.test.ts`
- Modify: `src/tests/content-coverage.test.ts`
- Modify: `src/content/content-completeness.test.ts`
- Modify: `src/content/content.json`

**Interfaces:**
- Consumes: complete lifecycle, three ecosystems, build, encounter, and final-form state.
- Produces: backward-compatible form migration, final archive facts, ten-seed audit, and release verification evidence.

- [ ] **Step 1: Write failing legacy migration tests**

```ts
it.each([
  ['microbe', 'form-primal-cell'],
  ['hunter', 'form-primal-cell'],
  ['specialist', 'form-colony-body'],
  ['dominant', 'form-colony-body'],
  ['ascendant', 'form-ciliate-composite'],
] as const)('maps legacy stage %s conservatively to %s', (stage, formId) => {
  expect(decodeSave(legacyArchiveFixture(stage)).value.lifeArchives[0].finalFormId).toBe(formId)
})
```

- [ ] **Step 2: Write failing full-run and screen-occupancy audits**

```ts
it('completes the three-form chain across ten deterministic seeds', () => {
  for (let seed = 727; seed < 737; seed += 1) {
    const report = runHeadless({ seed, durationMs: 720_000 })
    expect(report.formSignature).toBe('form-primal-cell>form-colony-body>form-ciliate-composite')
    expect(report.invalidNumbers).toEqual([])
    expect(report.endingId ?? report.deathId).toBeDefined()
  }
})

it.each([375, 390, 430])('keeps every legal form below thirty percent at %ipx', (width) => {
  expect(maximumScreenOccupancy(content.scaleTiers, { width, height: 844 })).toBeLessThanOrEqual(0.3)
})
```

- [ ] **Step 3: Run storage and launch audits and verify red**

Run: `pnpm exec vitest run src/storage/codec.test.ts src/progression/archive.test.ts src/ui/ResultOverlay.test.tsx src/tests/playthrough.test.ts src/tests/performance-budget.test.ts src/tests/content-coverage.test.ts --maxWorkers=1`

Expected: FAIL because archives lack final form/ecosystem facts and full-run tests still expect six abstract stages.

- [ ] **Step 4: Implement conservative save and archive migration**

Add `finalFormId`, `finalTierIndex`, `ecosystemIds`, and six selected trait IDs to new archive summaries. Decode legacy body stages with the exact mapping from the spec. Keep legacy environment and route IDs readable. Do not award an ending, encounter resolution, or final form that the old archive did not record.

- [ ] **Step 5: Make results describe the actual life chain**

Result view model shows final form, ecosystems reached, six key mutations, score, survival time, encounter path, and true death/ending. Keep one-click restart and same-seed replay. Copy comes only from `content.json`.

- [ ] **Step 6: Tune only through explicit acceptance failures**

Run the ten seeds and record failures for first engulf timing, eight-second activity windows, transition completion, final encounter reachability, screen occupancy, corridor width, non-finite values, entity budget, and frame budget. Change content values for balance failures; change code only when the failure exposes a rule defect. Do not weaken assertions to make the audit pass.

- [ ] **Step 7: Run the full automated gate**

Run: `pnpm lint && pnpm test && pnpm build && git diff --check`

Expected: exit 0; 0 failed tests; no deleted tests; production bundle references only local runtime assets.

- [ ] **Step 8: Run the real-browser mobile gate**

At 375×812, 390×844, and 430×932, set `--safe-area-inset-top: 44px` and verify:

- no horizontal overflow;
- top controls and overlay headings begin below 44px;
- player occupancy stays at or below 30%;
- first engulf occurs within 20 seconds and target seed reaches it in 5–10 seconds;
- both form transitions visibly change skeleton and ecosystem;
- one complete run reaches a structured ending or death;
- radar reveals only permitted markers;
- pause, resize, visibility loss, pointer loss, mutation, and transition cancel input;
- reduced motion, reduced flash, low particles, and mute preserve danger information;
- console errors are zero;
- normal scenes approach 60 FPS and pressure scenes remain at least 30 FPS.

Capture browser evidence under `output/playwright/` only; do not commit transient traces or screenshots unless explicitly selected as release evidence.

- [ ] **Step 9: Inspect the complete diff and staged scope**

Run:

```bash
git diff --check
git status --short
git diff --stat 3988334..HEAD
git diff --cached --name-only
```

Expected: all implementation changes belong to `projects/09-proto-cell/**`; unrelated root, project 08, and project 10 changes remain unstaged and untouched.

- [ ] **Step 10: Commit the audited release**

```bash
git add projects/09-proto-cell/src projects/09-proto-cell/public
git diff --cached --name-only
git commit -m "release(proto-cell): complete scale evolution journey"
```

## Phase Completion Gate

The implementation is complete only when all eight tasks pass, ten deterministic runs traverse the three-form chain, every legal form stays within 30% screen occupancy, every collapsed arena retains six body diameters, adjacent ecosystems replace at least 60% of ordinary species, the active player never switches to an independently controlled split body, and the complete mobile browser gate passes at all three required widths with a 44px safe area.
