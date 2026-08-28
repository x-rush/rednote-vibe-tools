# Proto Cell Full Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete mobile-first, movement-only, geometric-engulfment cell evolution Roguelite defined in the approved design.

**Architecture:** React and TypeScript own screens, overlays, persistence, and accessible controls; a deterministic fixed-step engine owns gameplay; Canvas 2D owns all high-frequency rendering, effects, and floating numbers. Business content is validated from one `src/content/content.json`, while stable `behaviorId` implementations remain small code modules.

**Tech Stack:** React 19.2.8, React DOM 19.2.8, TypeScript 6.0.2, Vite 8.2.0, Vitest 4.1.11, Oxlint 1.75.0, Canvas 2D, localStorage, IndexedDB.

**Spec:** `projects/09-proto-cell/DESIGN.md`

## Global Constraints

- Work only inside `projects/09-proto-cell`; never modify another project, root `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `docs/`, or `prep/`.
- Reuse exactly the dependency versions listed above. Before running package commands, report the new package manifest to the workspace controller and wait for the controller to add the `projects/09-proto-cell` lockfile importer. Do not run an install that changes the root lockfile.
- Pure frontend static build; no backend, runtime CDN, required external API, Service Worker, Node runtime API, or unconfirmed device API.
- Put all business content and user-facing copy in `src/content/content.json`; code may contain only generic engine behavior and stable IDs.
- Persist structured state only. Never store screenshots, Canvas data, user images, Base64, Blob, audio, video, or high-frequency trajectories.
- The only continuous gameplay input is pointer movement. Do not add active skill buttons, double-tap abilities, self-tap modes, manual organ placement, or child selection.
- Engulfment requires complete geometric containment. Ordinary partial overlap causes no damage and never kills.
- A complete run targets 8–12 minutes and must not exceed approximately 15 minutes for extreme builds.
- Keep damage, gain, block, and chain-engulf numbers with capped, aggregated Canvas effects.
- All top `sticky`/`fixed` controls and anchor offsets must add `var(--safe-area-inset-top, env(safe-area-inset-top, 0px))` and be verified with a non-zero simulated safe area.
- Verify 375, 390, and 430 CSS px. Touch targets are at least 44 CSS px.
- Finish every milestone with `pnpm lint && pnpm test && pnpm build`; never delete or weaken tests.

## Locked File Map

```text
projects/09-proto-cell/
  package.json                    scripts and existing workspace dependencies
  index.html                      mobile viewport and static entry
  tsconfig.json
  tsconfig.app.json
  tsconfig.node.json
  vite.config.ts
  DESIGN.md                       approved product design
  IMPLEMENTATION_PLAN.md          this plan
  public/assets/                  local SVG/WebP/audio resources only
  src/main.tsx                    React bootstrap
  src/App.tsx                     top-level screen switch and error boundary
  src/App.css                     app shell and responsive layout
  src/index.css                   reset, tokens, safe-area variables
  src/content/content.json        all business data and copy
  src/content/schema.ts           ContentPack and stable content types
  src/content/validate.ts         runtime content integrity validation
  src/content/index.ts            validated content export
  src/domain/types.ts             shared simulation value types
  src/domain/rng.ts               deterministic forkable PRNG
  src/domain/math.ts              vectors, interpolation, bounds
  src/game/clock.ts               fixed-step accumulator
  src/game/input.ts               pointer-to-movement intent
  src/game/spatial-grid.ts        nearby-entity index
  src/game/containment.ts         complete-containment geometry
  src/game/interactions.ts        engulf, damage, rupture, mass transfer
  src/game/engine.ts              authoritative simulation orchestration
  src/entities/factory.ts         content-driven entity construction
  src/entities/ai.ts              prey, competitor, scavenger, predator AI
  src/evolution/organs.ts         passive behavior registry
  src/evolution/mutation.ts       constrained three-choice selection
  src/evolution/split.ts          automatic split, swarm motion, fusion
  src/world/generator.ts          seeded regions and spawn schedules
  src/world/environments.ts       six environment rule handlers
  src/world/events.ts             four ecosystem event handlers
  src/world/bosses.ts             three boss state machines
  src/rendering/renderer.ts       Canvas render pipeline and quality levels
  src/rendering/cell.ts           procedural cell layers and morphology
  src/rendering/numbers.ts        aggregated arcade number effects
  src/rendering/effects.ts        particles, ripples, flashes, telegraphs
  src/audio/audio.ts              gesture-unlocked local/procedural audio
  src/progression/archive.ts      event-log-derived life archive
  src/progression/codex.ts        discovery state transitions
  src/progression/genes.ts        breadth-first unlock graph
  src/progression/challenges.ts   daily seeds, codes, and modifiers
  src/storage/codec.ts            schema whitelist and migrations
  src/storage/repository.ts       localStorage/IndexedDB fallback contract
  src/app/controller.ts           run/lab/evolution/result state machine
  src/app/view-model.ts           low-frequency HUD and screen snapshots
  src/ui/GameCanvas.tsx           Canvas lifecycle and pointer binding
  src/ui/Hud.tsx                  numeric HUD and safe-area pause control
  src/ui/EvolutionOverlay.tsx     paused tap-to-select mutation UI
  src/ui/Lab.tsx                  first entry and post-run hub
  src/ui/Archive.tsx              life archive list/detail
  src/ui/Codex.tsx                three-state discovery UI
  src/ui/GeneGraph.tsx            unlock graph UI
  src/ui/Settings.tsx             comfort, audio, graphics, storage controls
  src/ui/ErrorPanel.tsx           content/storage/canvas recovery UI
  src/tests/fixtures.ts           deterministic content and state builders
  src/tests/playthrough.ts        headless seeded run driver
```

## Cross-Task Interface Contract

Keep these names and shapes stable across tasks; extend discriminated unions without renaming existing members:

```ts
export type Vec2 = { x: number; y: number }
export type BodyShape = { center: Vec2; radius: number; contour: readonly Vec2[] }
export type MovementIntent = { direction: Vec2; strength: number }

export type Rng = {
  next(): number
  int(min: number, maxExclusive: number): number
  fork(label: string): Rng
}

export type FixedClock = {
  advance(elapsedMs: number, step: (stepMs: number) => void): { steps: number; alpha: number }
  reset(): void
}

export type PointerInput = {
  start(pointer: Vec2, playerScreenPosition: Vec2): void
  move(pointer: Vec2, playerScreenPosition: Vec2): void
  end(): void
  cancel(): void
  snapshot(): MovementIntent
}

export type GameEvent =
  | { type: 'engulfed'; predatorId: string; preyId: string; biomass: number; atMs: number }
  | { type: 'damaged'; targetId: string; amount: number; source: 'acid' | 'electric' | 'spine' | 'ram'; atMs: number }
  | { type: 'blocked'; targetId: string; amount: number; atMs: number }
  | { type: 'ruptured'; targetId: string; fragmentMasses: readonly number[]; atMs: number }
  | { type: 'organ-triggered'; entityId: string; organId: string; atMs: number }
  | { type: 'mutation-ready'; entityId: string; atMs: number }
  | { type: 'route-selected'; environmentId: string; atMs: number }
  | { type: 'boss-resolved'; bossId: string; path: 'combat' | 'environment' | 'stealth' | 'parasite'; atMs: number }
  | { type: 'player-died'; cause: string; atMs: number }
  | { type: 'ending-reached'; endingId: string; atMs: number }

export type HudSnapshot = {
  membrane: number
  energy: number
  stability: number
  biomass: number
  evolutionThreshold: number
  elapsedMs: number
  environmentId: string
  paused: boolean
}

export type GameEngine = {
  start(): void
  advance(elapsedMs: number): void
  pause(reason: 'user' | 'visibility' | 'evolution'): void
  resume(reason: 'user' | 'visibility' | 'evolution'): void
  snapshot(): HudSnapshot
  drainEvents(): GameEvent[]
  destroy(): void
}

export type MutationChoice = {
  organId: string
  lane: 'continuation' | 'adaptation' | 'risk'
  action: 'install' | 'mature' | 'replace' | 'recombine' | 'expand'
  replacedOrganId?: string
  resultingStability: number
  revealedSynergyIds: readonly string[]
}

export type LifeArchiveSummary = {
  id: string
  speciesSeed: number
  survivalMs: number
  farthestEnvironmentId: string
  maxBiomass: number
  keyOrganelleIds: readonly string[]
  synergyIds: readonly string[]
  deathTemplateId?: string
  endingId?: string
  dishCode: string
}

export type SaveDataV1 = {
  schemaVersion: 1
  contentVersion: string
  settings: {
    music: boolean
    sfx: boolean
    reducedMotion: boolean
    reducedFlash: boolean
    lowParticles: boolean
    reducedShake: boolean
    graphics: 'high' | 'balanced' | 'low'
  }
  progression: {
    genePoints: number
    unlockedIds: string[]
    discoveredSynergyIds: string[]
    completedModifierIds: string[]
  }
  codex: Record<string, 'seen' | 'defeated-by' | 'complete'>
  records: {
    bestSurvivalMs: number
    bestEnvironmentOrder: number
    maxBiomass: number
    dailySeeds: Record<string, number>
  }
  lifeArchives: LifeArchiveSummary[]
}

export type RepositoryLoadResult =
  | { mode: 'persistent'; value: SaveDataV1 }
  | { mode: 'session'; value: SaveDataV1; issues: readonly string[] }

export type GameRepository = {
  load(): Promise<RepositoryLoadResult>
  save(value: SaveDataV1): Promise<void>
  clear(): Promise<void>
  exportJson(): Promise<string>
  importJson(raw: string): Promise<{ ok: true; value: SaveDataV1 } | { ok: false; issues: readonly string[] }>
  recoveryPayload(): unknown
}

export type HeadlessRunOptions = {
  seed: number
  durationMs?: number
  route?: readonly string[]
  policy?: 'balanced' | 'speed' | 'armor' | 'stealth' | 'parasite' | 'swarm'
}

export type HeadlessRunReport = {
  keyEvents: readonly GameEvent[]
  maxEntities: number
  invalidNumbers: readonly string[]
  morphologySignature: string
  endingId?: string
}

export function runHeadless(options: HeadlessRunOptions): HeadlessRunReport
```

---

## M0 — Hand-Feel Prototype

### Task 1: Project Shell and Content Envelope

**Files:**
- Create: `projects/09-proto-cell/package.json`
- Create: `projects/09-proto-cell/index.html`
- Create: `projects/09-proto-cell/tsconfig.json`
- Create: `projects/09-proto-cell/tsconfig.app.json`
- Create: `projects/09-proto-cell/tsconfig.node.json`
- Create: `projects/09-proto-cell/vite.config.ts`
- Create: `projects/09-proto-cell/src/main.tsx`
- Create: `projects/09-proto-cell/src/App.tsx`
- Create: `projects/09-proto-cell/src/index.css`
- Create: `projects/09-proto-cell/src/App.css`
- Create: `projects/09-proto-cell/src/content/content.json`
- Test: `projects/09-proto-cell/src/content/content.test.ts`

**Interfaces:**
- Consumes: workspace React/Vite/Vitest/Oxlint versions from Global Constraints.
- Produces: a buildable package named `09-proto-cell` and JSON envelope `{ schemaVersion, contentVersion, projectId, meta, ui }`.

- [ ] **Step 1: Create the package and compiler configuration**

Create this exact manifest, then mirror the TypeScript and Vite settings from `projects/08-earth-online` with project-local paths:

```json
{
  "name": "09-proto-cell",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "oxlint",
    "test": "vitest run",
    "check": "pnpm lint && pnpm test && pnpm build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19.2.8",
    "react-dom": "^19.2.8"
  },
  "devDependencies": {
    "@types/node": "^24.13.3",
    "@types/react": "^19.2.17",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^6.0.4",
    "oxlint": "^1.75.0",
    "typescript": "~6.0.2",
    "vite": "^8.2.0",
    "vitest": "^4.1.11"
  }
}
```

Set the HTML viewport to `width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover` and language to `zh-CN`.

- [ ] **Step 2: Request the lockfile importer from the workspace controller**

Send the exact new `package.json` to the controller. Verify `pnpm-lock.yaml` contains a `projects/09-proto-cell` importer before continuing. Do not edit the lockfile in this task.

- [ ] **Step 3: Write the failing content-envelope test**

```ts
import { describe, expect, it } from 'vitest'
import content from './content.json'

describe('content envelope', () => {
  it('identifies the proto-cell zh-CN content pack', () => {
    expect(content.projectId).toBe('proto-cell')
    expect(content.meta.locale).toBe('zh-CN')
    expect(content.ui.actions.start).toBe('开始孵化')
  })
})
```

- [ ] **Step 4: Run the test and confirm the missing content fails**

Run: `pnpm test -- src/content/content.test.ts`  
Expected: FAIL because `content.json` or required properties do not exist.

- [ ] **Step 5: Create the minimal content envelope and app shell**

Create content with `schemaVersion: 1`, `contentVersion: "0.1.0-m0"`, `projectId: "proto-cell"`, title `原生：一滴水的战争`, locale `zh-CN`, fiction disclaimer, and UI action labels. Render the title, a programmatic non-anthropomorphic cell placeholder, and the content-provided start button.

- [ ] **Step 6: Add safe-area and full-canvas CSS foundations**

```css
:root {
  --safe-area-inset-top: env(safe-area-inset-top, 0px);
  color-scheme: dark;
  font-family: Inter, "PingFang SC", "Microsoft YaHei", sans-serif;
}
html, body, #root { width: 100%; min-height: 100%; margin: 0; }
button { min-width: 44px; min-height: 44px; }
.top-control { top: calc(var(--safe-area-inset-top, env(safe-area-inset-top, 0px)) + 8px); }
```

- [ ] **Step 7: Verify and commit**

Run: `pnpm lint && pnpm test && pnpm build`  
Expected: all commands PASS and `dist/index.html` exists.

```bash
git add projects/09-proto-cell
git commit -m "feat(proto-cell): scaffold static game shell"
```

### Task 2: Deterministic Domain Primitives

**Files:**
- Create: `projects/09-proto-cell/src/domain/types.ts`
- Create: `projects/09-proto-cell/src/domain/rng.ts`
- Create: `projects/09-proto-cell/src/domain/rng.test.ts`
- Create: `projects/09-proto-cell/src/domain/math.ts`
- Create: `projects/09-proto-cell/src/domain/math.test.ts`
- Create: `projects/09-proto-cell/src/tests/fixtures.ts`

**Interfaces:**
- Produces: `Vec2`, `BodyShape`, `EntityState`, `Rng`, `createRng(seed)`, `add`, `scale`, `length`, `normalize`, `lerp`.

- [ ] **Step 1: Write deterministic RNG and vector tests**

```ts
it('repeats and forks without sharing state', () => {
  const a = createRng(727)
  const b = createRng(727)
  expect([a.next(), a.next()]).toEqual([b.next(), b.next()])
  expect(a.fork('organs').next()).toBe(createRng(727).fork('organs').next())
})

it('normalizes a zero vector safely', () => {
  expect(normalize({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 })
})
```

- [ ] **Step 2: Run the tests and confirm missing exports fail**

Run: `pnpm test -- src/domain/rng.test.ts src/domain/math.test.ts`  
Expected: FAIL with missing module or export errors.

- [ ] **Step 3: Implement the exact RNG contract**

```ts
export type Rng = {
  next(): number
  int(min: number, maxExclusive: number): number
  fork(label: string): Rng
}
export function createRng(seed: number): Rng
```

Use a 32-bit integer algorithm with label hashing; `next()` must return `[0, 1)` and `fork()` must depend only on the root seed plus label, not the parent's current cursor.

- [ ] **Step 4: Implement focused domain types and vector helpers**

Define `BodyShape` as `{ center: Vec2; radius: number; contour: readonly Vec2[] }`. Define entity identity, position, velocity, mass, membrane, energy, faction, role, and status without UI copy.

Create `src/tests/fixtures.ts` with `vec(x, y): Vec2`; later tasks extend this same file with factories only after their product types exist.

- [ ] **Step 5: Verify and commit**

Run: `pnpm test -- src/domain/rng.test.ts src/domain/math.test.ts && pnpm lint`

```bash
git add projects/09-proto-cell/src/domain
git commit -m "feat(proto-cell): add deterministic domain primitives"
```

### Task 3: Fixed-Step Clock and Movement-Only Input

**Files:**
- Create: `projects/09-proto-cell/src/game/clock.ts`
- Create: `projects/09-proto-cell/src/game/clock.test.ts`
- Create: `projects/09-proto-cell/src/game/input.ts`
- Create: `projects/09-proto-cell/src/game/input.test.ts`

**Interfaces:**
- Consumes: `Vec2` and math helpers from Task 2.
- Produces: `FixedClock.advance(elapsedMs, step)`, `MovementIntent`, `PointerInput`.

- [ ] **Step 1: Write clock and pointer-cancel tests**

```ts
it('caps catch-up work after a long pause', () => {
  const clock = createFixedClock({ stepMs: 1000 / 60, maxSteps: 5 })
  let steps = 0
  clock.advance(5000, () => { steps += 1 })
  expect(steps).toBe(5)
})

it('clears movement on pointer cancellation', () => {
  const input = createPointerInput()
  input.move({ x: 200, y: 300 }, { x: 100, y: 200 })
  input.cancel()
  expect(input.snapshot()).toEqual({ direction: { x: 0, y: 0 }, strength: 0 })
})
```

- [ ] **Step 2: Run and confirm failure**

Run: `pnpm test -- src/game/clock.test.ts src/game/input.test.ts`  
Expected: FAIL because clock and input modules do not exist.

- [ ] **Step 3: Implement capped fixed-step accumulation**

Clamp negative elapsed time to zero, execute no more than five simulation steps per frame, and discard excess accumulated time after the cap so returning from a hidden tab cannot cause a burst.

- [ ] **Step 4: Implement pointer-to-intent conversion**

Map pointer displacement from the player screen position into normalized direction and strength `clamp(distance / 120, 0, 1)`. Expose only `start`, `move`, `end`, `cancel`, and `snapshot`; do not add gesture or ability fields.

- [ ] **Step 5: Verify and commit**

Run: `pnpm test -- src/game/clock.test.ts src/game/input.test.ts && pnpm lint`

```bash
git add projects/09-proto-cell/src/game/clock* projects/09-proto-cell/src/game/input*
git commit -m "feat(proto-cell): add fixed clock and movement input"
```

### Task 4: Complete-Containment Interaction Model

**Files:**
- Create: `projects/09-proto-cell/src/game/containment.ts`
- Create: `projects/09-proto-cell/src/game/containment.test.ts`
- Create: `projects/09-proto-cell/src/game/interactions.ts`
- Create: `projects/09-proto-cell/src/game/interactions.test.ts`
- Modify: `projects/09-proto-cell/src/tests/fixtures.ts`

**Interfaces:**
- Consumes: `BodyShape`, `EntityState`.
- Produces: `fullyContains(container, target, tolerance)`, `resolveInteraction(a, b, context)` and typed `GameEvent` values.

- [ ] **Step 1: Write the critical engulfment regression tests**

```ts
it('does not engulf on partial overlap', () => {
  const predator = circleBody({ x: 0, y: 0 }, 20)
  const prey = circleBody({ x: 18, y: 0 }, 5)
  expect(fullyContains(predator, prey, 0.5)).toBe(false)
})

it('engulfs once when every prey contour point is inside', () => {
  const result = resolveInteraction(entity('large', 20), entity('small', 5), testInteractionContext())
  expect(result.events.filter((event) => event.type === 'engulfed')).toHaveLength(1)
  expect(result.massAfter).toBe(result.massBefore)
})
```

- [ ] **Step 2: Run and confirm the tests fail**

Run: `pnpm test -- src/game/containment.test.ts src/game/interactions.test.ts`  
Expected: FAIL with missing containment and interaction exports.

- [ ] **Step 3: Implement broad-phase and contour containment**

Reject when center distance plus target bounding radius exceeds container radius plus tolerance. Otherwise require every target contour point to pass the point-in-polygon test. Store an `engulfLocks` pair key so the same pair cannot settle twice.

Extend `fixtures.ts` with `circleBody(center, radius)`, `entity(size, radius)`, and `testInteractionContext()`; use `testInteractionContext()` consistently in the interaction test.

- [ ] **Step 4: Implement damage, rupture, and mass conservation**

```ts
export type GameEvent =
  | { type: 'engulfed'; predatorId: string; preyId: string; biomass: number; atMs: number }
  | { type: 'damaged'; targetId: string; amount: number; source: 'acid' | 'electric' | 'spine' | 'ram'; atMs: number }
  | { type: 'blocked'; targetId: string; amount: number; atMs: number }
  | { type: 'ruptured'; targetId: string; fragmentMasses: readonly number[]; atMs: number }
```

Ordinary overlap emits no damage. Membrane reaching zero emits fragments whose total mass equals the ruptured entity mass after the explicit configured conversion loss.

- [ ] **Step 5: Verify and commit**

Run: `pnpm test -- src/game/containment.test.ts src/game/interactions.test.ts && pnpm lint`

```bash
git add projects/09-proto-cell/src/game/containment* projects/09-proto-cell/src/game/interactions*
git commit -m "feat(proto-cell): implement geometric engulfment"
```

### Task 5: Spatial Grid, Entity Factory, and Baseline Ecology

**Files:**
- Create: `projects/09-proto-cell/src/game/spatial-grid.ts`
- Create: `projects/09-proto-cell/src/game/spatial-grid.test.ts`
- Create: `projects/09-proto-cell/src/entities/factory.ts`
- Create: `projects/09-proto-cell/src/entities/ai.ts`
- Create: `projects/09-proto-cell/src/entities/ai.test.ts`
- Create: `projects/09-proto-cell/src/world/generator.ts`
- Create: `projects/09-proto-cell/src/world/generator.test.ts`
- Modify: `projects/09-proto-cell/src/tests/fixtures.ts`

**Interfaces:**
- Consumes: content IDs, `Rng`, entity domain types.
- Produces: `SpatialGrid`, `createEntity(definition, spawn)`, `decideIntent(entity, perception)`, `generateRegion(seed, environmentId)`.

- [ ] **Step 1: Write nearby-query and seeded-world tests**

```ts
it('returns only entities in intersecting cells', () => {
  const grid = new SpatialGrid(64)
  grid.insert(entityAt('near', 10, 10))
  grid.insert(entityAt('far', 500, 500))
  expect(grid.query({ x: 0, y: 0, width: 80, height: 80 }).map((e) => e.id)).toEqual(['near'])
})

it('repeats the initial-drop spawn schedule', () => {
  expect(generateRegion(727, 'env-clear-drop')).toEqual(generateRegion(727, 'env-clear-drop'))
})
```

- [ ] **Step 2: Run and confirm failure**

Run: `pnpm test -- src/game/spatial-grid.test.ts src/entities/ai.test.ts src/world/generator.test.ts`

- [ ] **Step 3: Implement grid and content-driven entity creation**

Use stable entity IDs derived from region seed plus spawn index. Entity creation accepts numeric definitions and visual recipe IDs; it does not contain names or UI copy.

Extend `fixtures.ts` with `entityAt(id: string, x: number, y: number): EntityState` for grid and AI tests.

- [ ] **Step 4: Implement M0 AI roles**

Implement wander, seek nutrient, flee larger threat, chase smaller prey, and opportunity targeting. AI reads only nearby entities and environment fields. Predators must choose profitable non-player targets when closer than the player.

- [ ] **Step 5: Verify and commit**

Run: `pnpm test -- src/game/spatial-grid.test.ts src/entities/ai.test.ts src/world/generator.test.ts && pnpm lint`

```bash
git add projects/09-proto-cell/src/game/spatial-grid* projects/09-proto-cell/src/entities projects/09-proto-cell/src/world/generator*
git commit -m "feat(proto-cell): add seeded baseline ecology"
```

### Task 6: Engine, Canvas Renderer, HUD, and Arcade Numbers

**Files:**
- Create: `projects/09-proto-cell/src/game/engine.ts`
- Create: `projects/09-proto-cell/src/game/engine.test.ts`
- Create: `projects/09-proto-cell/src/rendering/renderer.ts`
- Create: `projects/09-proto-cell/src/rendering/cell.ts`
- Create: `projects/09-proto-cell/src/rendering/numbers.ts`
- Create: `projects/09-proto-cell/src/rendering/numbers.test.ts`
- Create: `projects/09-proto-cell/src/rendering/effects.ts`
- Create: `projects/09-proto-cell/src/ui/GameCanvas.tsx`
- Create: `projects/09-proto-cell/src/ui/Hud.tsx`
- Modify: `projects/09-proto-cell/src/tests/fixtures.ts`

**Interfaces:**
- Consumes: Tasks 2–5 and validated content.
- Produces: `GameEngine.start/pause/resume/destroy/snapshot`, `CanvasRenderer.render`, `NumberFeed.push/update/draw`.

- [ ] **Step 1: Write engine lifecycle and number aggregation tests**

```ts
it('aggregates same-kind gains inside 180ms', () => {
  const feed = createNumberFeed({ aggregateMs: 180, maxVisible: 8 })
  feed.push({ kind: 'biomass', amount: 8, entityId: 'player', atMs: 100 })
  feed.push({ kind: 'biomass', amount: 5, entityId: 'player', atMs: 240 })
  expect(feed.visible()).toMatchObject([{ kind: 'biomass', amount: 13, chain: 2 }])
})

it('does not advance while paused', () => {
  const engine = createTestEngine()
  engine.pause('visibility')
  engine.advance(1000)
  expect(engine.snapshot().elapsedMs).toBe(0)
})
```

- [ ] **Step 2: Run and confirm failure**

Run: `pnpm test -- src/game/engine.test.ts src/rendering/numbers.test.ts`

- [ ] **Step 3: Implement authoritative engine orchestration**

The engine owns mutable simulation state, runs fixed steps, rebuilds the spatial grid, resolves interactions once, and emits discrete events. `snapshot()` returns only player membrane, energy, stability, biomass, evolution threshold, elapsed time, environment ID, and pause state.

Extend `fixtures.ts` with `createTestEngine()` after `GameEngine` exists; it uses seed `727`, the `env-clear-drop` region displayed as `初生水滴`, and an empty decorative-effect sink.

- [ ] **Step 4: Implement the seven-layer cell and effect pipeline**

Draw liquid shadow, membrane, cytoplasm, core, installed organs, appendages, then status/effects. Never draw eyes, mouths, facial marks, or emotive expressions. Smooth displayed radius toward mass-derived target radius. Draw telegraphs before decorative particles so low-quality mode can remove decoration without hiding danger. The renderer receives a visual-only RNG fork and must never advance a gameplay RNG.

- [ ] **Step 5: Bind pointer input and safe-area HUD**

`GameCanvas` owns one Canvas and forwards pointer start/move/end/cancel. `Hud` renders numeric membrane, energy, stability, biomass, threshold, and a 44px pause button below the safe area. Do not add bottom controls.

- [ ] **Step 6: Verify and commit**

Run: `pnpm lint && pnpm test && pnpm build`

```bash
git add projects/09-proto-cell/src/game/engine* projects/09-proto-cell/src/rendering projects/09-proto-cell/src/ui/GameCanvas.tsx projects/09-proto-cell/src/ui/Hud.tsx
git commit -m "feat(proto-cell): deliver playable engulfment loop"
```

### Task 7: M0 Integration and Performance Gate

**Files:**
- Modify: `projects/09-proto-cell/src/App.tsx`
- Modify: `projects/09-proto-cell/src/App.css`
- Create: `projects/09-proto-cell/src/app/controller.ts`
- Create: `projects/09-proto-cell/src/app/controller.test.ts`
- Modify: `projects/09-proto-cell/src/tests/fixtures.ts`
- Create: `projects/09-proto-cell/src/tests/playthrough.ts`
- Create: `projects/09-proto-cell/src/tests/playthrough.test.ts`

**Interfaces:**
- Consumes: `GameEngine` and HUD snapshot.
- Produces: start → playing → paused → dead → restart M0 flow and headless simulation driver.

- [ ] **Step 1: Write flow and five-minute simulation tests**

```ts
it('starts, dies, and restarts with a fresh run seed', () => {
  const controller = createController(testDependencies())
  controller.startRun({ seed: 727, originId: 'origin-primal-cell' })
  controller.handle({ type: 'player-died', cause: 'engulfed', atMs: 1000 })
  expect(controller.snapshot().screen).toBe('result')
  controller.restart()
  expect(controller.snapshot().screen).toBe('playing')
})

it('keeps the five-minute entity population bounded', () => {
  const report = runHeadless({ seed: 727, durationMs: 300_000 })
  expect(report.maxEntities).toBeLessThanOrEqual(180)
  expect(report.invalidNumbers).toEqual([])
})
```

- [ ] **Step 2: Run and confirm failure**

Run: `pnpm test -- src/app/controller.test.ts src/tests/playthrough.test.ts`

- [ ] **Step 3: Implement the M0 screen controller and restart flow**

Use a discriminated union screen state. On `visibilitychange`, pause without advancing elapsed time. On restart, dispose the old engine and create a fresh one from the selected seed.

Extend `fixtures.ts` with `testDependencies()` returning a deterministic engine factory, in-memory archive sink, and validated M0 content.

- [ ] **Step 4: Perform M0 browser checks**

Run `pnpm dev -- --host 127.0.0.1`. Verify at 375, 390, and 430 CSS px with `--safe-area-inset-top: 44px`: pointer movement, partial overlap survival, full containment, number aggregation, pause/resume, and restart. Record results in the task commit message body, not a root or docs file.

- [ ] **Step 5: Run the M0 gate and commit**

Run: `pnpm lint && pnpm test && pnpm build`  
Expected: PASS; automated run stays within entity cap; normal browser play targets 60 FPS and the M0 pressure spawn does not remain below 30 FPS.

```bash
git add projects/09-proto-cell
git commit -m "feat(proto-cell): complete M0 hand-feel prototype"
```

---

## M1 — Vertical Slice

### Task 8: Typed Content Contract and Integrity Validator

**Files:**
- Create: `projects/09-proto-cell/src/content/schema.ts`
- Create: `projects/09-proto-cell/src/content/validate.ts`
- Create: `projects/09-proto-cell/src/content/validate.test.ts`
- Create: `projects/09-proto-cell/src/content/index.ts`
- Modify: `projects/09-proto-cell/src/content/content.json`
- Modify: `projects/09-proto-cell/src/tests/fixtures.ts`

**Interfaces:**
- Produces: `ContentPack`, all stable definition types, `validateContent(input)`, `getContent()`.

- [ ] **Step 1: Write validation tests for IDs, references, and short copy**

```ts
it('rejects a missing organ visual recipe and dangling synergy reference', () => {
  const pack = contentFixture()
  pack.organelles[0].visualMutationId = ''
  pack.synergies[0].requires = ['organelle-missing']
  expect(validateContent(pack).issues.map((issue) => issue.path)).toEqual(expect.arrayContaining([
    '$.organelles[0].visualMutationId',
    '$.synergies[0].requires[0]',
  ]))
})
```

- [ ] **Step 2: Run and confirm failure**

Run: `pnpm test -- src/content/validate.test.ts`

- [ ] **Step 3: Define exact content types from the 43 contract**

Include environments, nutrients, organelles, synergies, creatures, events, bosses, origins, modifiers, endings, death templates, UI copy, visual recipes, spawn tables, and gene nodes. Stable IDs use their required prefixes and are never inferred from display names.

Extend `fixtures.ts` with `contentFixture(): ContentPack`, returning a deep-cloned valid M1 pack so mutation in one validator test cannot leak to another.

- [ ] **Step 4: Implement validation and the M1 content slice**

Populate `env-clear-drop` with display name `初生水滴`, six organs spanning distinct categories, two achievable synergies, five ecosystem roles, one elite, one validation Boss, one ending, and required death templates. Validate references, unique IDs, legal slots, copy length, telegraphs, resolution paths, and content version.

- [ ] **Step 5: Make application startup fail closed on invalid content**

`getContent()` returns the validated typed pack or throws `ContentValidationError` containing structured issues. `App` catches it and routes to `ErrorPanel` in Task 16; until then render a content-provided recovery message.

- [ ] **Step 6: Verify and commit**

Run: `pnpm lint && pnpm test && pnpm build`

```bash
git add projects/09-proto-cell/src/content projects/09-proto-cell/src/App.tsx
git commit -m "feat(proto-cell): validate M1 content contract"
```

### Task 9: Passive Organs, Mutation Choice, and Automatic Split/Fusion

**Files:**
- Create: `projects/09-proto-cell/src/evolution/organs.ts`
- Create: `projects/09-proto-cell/src/evolution/organs.test.ts`
- Create: `projects/09-proto-cell/src/evolution/mutation.ts`
- Create: `projects/09-proto-cell/src/evolution/mutation.test.ts`
- Create: `projects/09-proto-cell/src/evolution/split.ts`
- Create: `projects/09-proto-cell/src/evolution/split.test.ts`
- Create: `projects/09-proto-cell/src/ui/EvolutionOverlay.tsx`
- Modify: `projects/09-proto-cell/src/tests/fixtures.ts`

**Interfaces:**
- Produces: `evaluatePassiveOrgans`, `offerMutations`, `installMutation`, `splitBody`, `stepSwarm`, `tryFuse`.

- [ ] **Step 1: Write passive trigger and constrained-offer tests**

```ts
it('offers continuation, adaptation, and risk lanes', () => {
  const offer = offerMutations(mutationContext({ environmentId: 'env-acid-vesicle', organIds: ['organelle-shell-plate'] }))
  expect(offer.map((choice) => choice.lane).sort()).toEqual(['adaptation', 'continuation', 'risk'])
})

it('fires jet vacuole only on imminent containment', () => {
  const events = evaluatePassiveOrgans(playerWith('organelle-jet-vacuole'), perception({ containmentRatio: 0.82 }))
  expect(events).toContainEqual(expect.objectContaining({ type: 'organ-triggered', organId: 'organelle-jet-vacuole' }))
})
```

- [ ] **Step 2: Run and confirm failure**

Run: `pnpm test -- src/evolution/organs.test.ts src/evolution/mutation.test.ts src/evolution/split.test.ts`

- [ ] **Step 3: Implement behavior registry and two-stage organs**

Register stable `behaviorId` functions for the M1 organs. Each function receives simulation context and returns typed effects; it may not read DOM state or content copy. First acquisition installs, second acquisition matures, and mature organs are excluded from duplicate offers.

Extend `fixtures.ts` with `mutationContext(overrides)`, `playerWith(organId)`, and `perception(overrides)` using the typed M1 content and entity state.

- [ ] **Step 4: Implement automatic placement, replacement, and stability costs**

Select a legal anchor deterministically by compatibility and free capacity. When full, offers may mature, replace, recombine, or risk-expand. Return a preview value model containing resulting stability, removed ID, synergy IDs, and visual recipe IDs.

- [ ] **Step 5: Implement split/fusion conservation and shared movement**

Split mass across child bodies using configured loss, preserve total organ ownership, move children around a shared centroid, and fuse only after proximity plus stability duration. Add a fatal-containment trigger for the division ring without exposing a button.

- [ ] **Step 6: Implement paused click-to-select UI and commit**

Render three content-driven choices, preview the body and numeric stability change, require one confirmation tap, then emit `mutation-selected`. Verify no drag handlers exist.

Run: `pnpm lint && pnpm test && pnpm build`

```bash
git add projects/09-proto-cell/src/evolution projects/09-proto-cell/src/ui/EvolutionOverlay.tsx
git commit -m "feat(proto-cell): add passive evolution builds"
```

### Task 10: Clear-Drop Event, Route Rift, and M1 Boss

**Files:**
- Create: `projects/09-proto-cell/src/world/events.ts`
- Create: `projects/09-proto-cell/src/world/events.test.ts`
- Create: `projects/09-proto-cell/src/world/bosses.ts`
- Create: `projects/09-proto-cell/src/world/bosses.test.ts`
- Modify: `projects/09-proto-cell/src/world/generator.ts`
- Modify: `projects/09-proto-cell/src/game/engine.ts`
- Modify: `projects/09-proto-cell/src/tests/fixtures.ts`

**Interfaces:**
- Produces: `startEvent`, `stepEvent`, `createBoss`, `stepBoss`, `resolveBossPath`, seeded route-rift entities.

- [ ] **Step 1: Write scene-changing event and multi-path Boss tests**

```ts
it('nutrient bloom attracts non-player predators', () => {
  const world = startEvent('event-nutrient-bloom', eventContext())
  expect(world.spawnRequests.some((spawn) => spawn.role === 'resource')).toBe(true)
  expect(world.aiSignals).toContainEqual(expect.objectContaining({ type: 'attraction-field' }))
})

it.each(['combat', 'environment', 'stealth'])('completes the M1 boss by %s', (path) => {
  expect(resolveBossPath(m1BossState(path))).toMatchObject({ complete: true, path })
})
```

- [ ] **Step 2: Run and confirm failure**

Run: `pnpm test -- src/world/events.test.ts src/world/bosses.test.ts`

- [ ] **Step 3: Implement the nutrient-bloom world mutation**

Spawn resources, add attraction fields used by all AI, schedule predator arrivals with visible shadow/flow telegraphs, and expire without modal UI.

Extend `fixtures.ts` with `eventContext()` and `m1BossState(path)`; each fixture uses seed `727` and only content-defined IDs.

- [ ] **Step 4: Implement the validation Boss state machine**

Use `dormant → feeding → exposed → enraged → resolved` states. Combat ruptures outer membrane; environment completion requires the Boss to intersect an acid-like validation hazard; stealth completion requires crossing its territory without reaching lock threshold.

- [ ] **Step 5: Implement route rifts and five-to-eight-minute slice pacing**

Generate two seeded exits with hazard, resource, and affinity icon IDs. Swimming into one records the route choice. Keep this M1 `初生水滴` slice longer than the final release tutorial region; Task 13 rebalances it to two minutes.

- [ ] **Step 6: Verify and commit**

Run: `pnpm lint && pnpm test && pnpm build`

```bash
git add projects/09-proto-cell/src/world projects/09-proto-cell/src/game/engine.ts
git commit -m "feat(proto-cell): complete M1 ecosystem slice"
```

### Task 11: M1 Result, Archive Derivation, and Immediate Restart

**Files:**
- Create: `projects/09-proto-cell/src/progression/archive.ts`
- Create: `projects/09-proto-cell/src/progression/archive.test.ts`
- Create: `projects/09-proto-cell/src/app/view-model.ts`
- Create: `projects/09-proto-cell/src/app/view-model.test.ts`
- Create: `projects/09-proto-cell/src/ui/Archive.tsx`
- Modify: `projects/09-proto-cell/src/app/controller.ts`
- Modify: `projects/09-proto-cell/src/App.tsx`
- Modify: `projects/09-proto-cell/src/tests/fixtures.ts`

**Interfaces:**
- Produces: `deriveLifeArchive(eventLog, content)`, `createViewModel(snapshot, content)`, result → restart flow.

- [ ] **Step 1: Write truthful death and archive tests**

```ts
it('prefers the actual final fatal event over flavor text', () => {
  const archive = deriveLifeArchive(eventLog([
    { type: 'damaged', targetId: 'player', source: 'acid', amount: 8, atMs: 9000 },
    { type: 'player-died', cause: 'acid', atMs: 9010 },
  ]), testContent())
  expect(archive.deathTemplateId).toBe('death-acid-corrosion')
})
```

- [ ] **Step 2: Run and confirm failure**

Run: `pnpm test -- src/progression/archive.test.ts src/app/view-model.test.ts`

- [ ] **Step 3: Implement structured archive derivation**

Return species name seed, survival time, farthest environment, max biomass, key organs, synergy IDs, death or ending ID, and dish code. Store no rendered media or trajectory.

Extend `fixtures.ts` with `eventLog(events)` that assigns stable sequence numbers and `testContent()` that returns the validated M1 content pack.

- [ ] **Step 4: Render result with the final live cell and largest restart action**

The archive panel uses the farthest environment palette, shows numeric count-up effects, and keeps `再次孵化` as the first focusable primary button. Restart disposes the previous engine before starting.

- [ ] **Step 5: Run M1 gate and commit**

Run: `pnpm lint && pnpm test && pnpm build`  
Expected: all PASS; seeded slice supports three builds, one event, one Boss, archive, and restart.

```bash
git add projects/09-proto-cell/src/progression projects/09-proto-cell/src/app projects/09-proto-cell/src/ui/Archive.tsx projects/09-proto-cell/src/App.tsx
git commit -m "feat(proto-cell): finish M1 run and result loop"
```

---

## M2 — Complete Launch Content and Systems

### Task 12: Versioned Structured Storage

**Files:**
- Create: `projects/09-proto-cell/src/storage/codec.ts`
- Create: `projects/09-proto-cell/src/storage/codec.test.ts`
- Create: `projects/09-proto-cell/src/storage/repository.ts`
- Create: `projects/09-proto-cell/src/storage/repository.test.ts`
- Modify: `projects/09-proto-cell/src/tests/fixtures.ts`

**Interfaces:**
- Produces: `SaveDataV1`, `decodeSave`, `encodeSave`, `GameRepository.load/save/clear/exportJson/importJson`.

- [ ] **Step 1: Write whitelist, archive-cap, and unavailable-storage tests**

```ts
it('drops unknown fields and caps archives at thirty', () => {
  const decoded = decodeSave(saveFixture({ extra: 'blocked', archiveCount: 35 }))
  expect('extra' in decoded.value).toBe(false)
  expect(decoded.value.lifeArchives).toHaveLength(30)
})

it('falls back to session mode without destroying the rejected payload', async () => {
  const repo = createRepository(failingIndexedDb())
  expect((await repo.load()).mode).toBe('session')
  expect(repo.recoveryPayload()).toBeDefined()
})
```

- [ ] **Step 2: Run and confirm failure**

Run: `pnpm test -- src/storage/codec.test.ts src/storage/repository.test.ts`

- [ ] **Step 3: Implement strict codec and migration boundary**

Accept at most 1 MiB JSON, require schema/content versions, whitelist settings/progression/codex/records/archive summary fields, reject media-shaped strings and unknown IDs, and return structured issues rather than throwing raw parse errors.

Extend `fixtures.ts` with `saveFixture(overrides)` and `failingIndexedDb()`; the latter rejects open/read/write calls with a deterministic `UnavailableError`.

- [ ] **Step 4: Implement localStorage settings plus IndexedDB repository**

Use localStorage only for settings. Use one IndexedDB database with versioned `save` and `recovery` object stores. Preserve a rejected raw structured payload until the user explicitly clears it.

- [ ] **Step 5: Verify and commit**

Run: `pnpm lint && pnpm test && pnpm build`

```bash
git add projects/09-proto-cell/src/storage
git commit -m "feat(proto-cell): add versioned structured saves"
```

### Task 13: Freeze the Complete Content Pack

**Files:**
- Modify: `projects/09-proto-cell/src/content/content.json`
- Modify: `projects/09-proto-cell/src/content/validate.ts`
- Modify: `projects/09-proto-cell/src/content/validate.test.ts`
- Create: `projects/09-proto-cell/src/content/content-completeness.test.ts`

**Interfaces:**
- Consumes: 43 content contract and the schema from Task 8.
- Produces: complete `contentVersion: "1.0.0"` pack.

- [ ] **Step 1: Write exact count and coverage tests**

```ts
it('freezes the launch content counts', () => {
  const pack = getContent()
  expect(pack.environments).toHaveLength(6)
  expect(pack.nutrients).toHaveLength(6)
  expect(pack.organelles).toHaveLength(24)
  expect(pack.synergies).toHaveLength(12)
  expect(pack.creatures.filter((item) => item.id.startsWith('predator-'))).toHaveLength(8)
  expect(pack.events).toHaveLength(4)
  expect(pack.bosses).toHaveLength(3)
  expect(pack.origins).toHaveLength(3)
  expect(pack.modifiers).toHaveLength(8)
  expect(pack.endings).toHaveLength(3)
  expect(pack.deathTemplates.length).toBeGreaterThanOrEqual(12)
})
```

- [ ] **Step 2: Run and confirm failure against the M1 slice**

Run: `pnpm test -- src/content/content-completeness.test.ts`  
Expected: FAIL on exact launch counts.

- [ ] **Step 3: Populate every stable launch definition**

Add all IDs and fields from the 43 contract, including exactly three organs per category, all twelve named synergies, six environments, six nutrients, eighteen non-predator creatures, five predators, three elites, three bosses, three origins, eight modifiers, three endings, and at least twelve event-derived deaths.

- [ ] **Step 4: Validate behavioral and visual coverage**

Require every organ to have legal slots, cost, tags, conflict list, short effect, behavior ID, visual mutation ID, at least one environment use, and at least one synergy reference. Require every hostile creature to have a non-color telegraph and two response tags. Require every Boss to expose at least three resolution paths including one non-combat path.

- [ ] **Step 5: Rebalance final route durations**

Set `初生水滴` to approximately two minutes, each selected mid-region to two-to-three minutes, and final chamber to two-to-four minutes. The route generator visits `env-clear-drop`, one of algae/acid, one of fiber/antibody, then abandoned chamber.

- [ ] **Step 6: Verify and commit**

Run: `pnpm lint && pnpm test && pnpm build`

```bash
git add projects/09-proto-cell/src/content
git commit -m "feat(proto-cell): freeze complete launch content"
```

### Task 14: Six Environments, Four Events, and Three Bosses

**Files:**
- Create: `projects/09-proto-cell/src/world/environments.ts`
- Create: `projects/09-proto-cell/src/world/environments.test.ts`
- Modify: `projects/09-proto-cell/src/world/events.ts`
- Modify: `projects/09-proto-cell/src/world/events.test.ts`
- Modify: `projects/09-proto-cell/src/world/bosses.ts`
- Modify: `projects/09-proto-cell/src/world/bosses.test.ts`
- Modify: `projects/09-proto-cell/src/world/generator.ts`
- Modify: `projects/09-proto-cell/src/tests/fixtures.ts`

**Interfaces:**
- Produces: all six environment handlers, four parameterized events, and three complete boss state machines.

- [ ] **Step 1: Write environment invariants and every Boss-path test**

```ts
it.each(['env-clear-drop', 'env-algae-glow', 'env-acid-vesicle', 'env-fiber-maze', 'env-antibody-storm', 'env-abandoned-chamber'])('%s has a reachable exit', (environmentId) => {
  expect(analyzeGeneratedRegion(727, environmentId).reachableExitCount).toBeGreaterThan(0)
})

it.each([
  ['boss-membrane-queen', 'environment'],
  ['boss-antibody-crown', 'stealth'],
  ['boss-abandoned-host', 'parasite'],
])('%s resolves through %s', (bossId, path) => {
  expect(resolveBossPath(bossFixture(bossId, path))).toMatchObject({ complete: true, path })
})
```

- [ ] **Step 2: Run and confirm failure**

Run: `pnpm test -- src/world/environments.test.ts src/world/events.test.ts src/world/bosses.test.ts`

- [ ] **Step 3: Implement environment fields without modal choices**

Implement light pulses, moving acid fields, fiber collision/adhesion, antibody sweeps, and chamber mechanisms as deterministic field updates. Each emits visual telegraph events before hazard activation.

Extend `fixtures.ts` with `bossFixture(bossId, path)`. `analyzeGeneratedRegion` is a production export from `world/generator.ts`, not a test-only duplicate.

- [ ] **Step 4: Complete all four events**

Implement nutrient bloom, acid leak, antibody sweep, and giant passage with at least three content-parameter variants each. Events alter spawn attraction, safe geometry, liquid flow, or visibility; they never pause for a text choice.

- [ ] **Step 5: Complete all Boss resolution paths**

Keep phase transitions state-based rather than hidden HP scaling. Validate combat, environment, stealth, and parasite routes where listed by content. Emit structured completion events for archive and gene rewards.

- [ ] **Step 6: Verify and commit**

Run: `pnpm lint && pnpm test && pnpm build`

```bash
git add projects/09-proto-cell/src/world
git commit -m "feat(proto-cell): complete environments events and bosses"
```

### Task 15: Gene Graph, Codex, Daily Seeds, Codes, and Modifiers

**Files:**
- Create: `projects/09-proto-cell/src/progression/genes.ts`
- Create: `projects/09-proto-cell/src/progression/genes.test.ts`
- Create: `projects/09-proto-cell/src/progression/codex.ts`
- Create: `projects/09-proto-cell/src/progression/codex.test.ts`
- Create: `projects/09-proto-cell/src/progression/challenges.ts`
- Create: `projects/09-proto-cell/src/progression/challenges.test.ts`
- Create: `projects/09-proto-cell/src/ui/Lab.tsx`
- Create: `projects/09-proto-cell/src/ui/Codex.tsx`
- Create: `projects/09-proto-cell/src/ui/GeneGraph.tsx`
- Modify: `projects/09-proto-cell/src/tests/fixtures.ts`

**Interfaces:**
- Produces: `awardGenes`, `unlockNode`, `advanceCodex`, `dailySeed`, `encodeDishCode`, `decodeDishCode`, `applyModifiers`.

- [ ] **Step 1: Write breadth-unlock, codex, and dish-code tests**

```ts
it('unlocks possibilities without permanent mass growth', () => {
  const next = unlockNode(geneFixture(), 'gene-origin-ciliate')
  expect(next.unlockedIds).toContain('origin-ciliate-seed')
  expect('permanentMassMultiplier' in next).toBe(false)
})

it('round-trips a dish code', () => {
  const value = { seed: 727, contentVersion: '1.0.0', route: ['env-algae-glow', 'env-fiber-maze'] }
  expect(decodeDishCode(encodeDishCode(value))).toEqual(value)
})
```

- [ ] **Step 2: Run and confirm failure**

Run: `pnpm test -- src/progression/genes.test.ts src/progression/codex.test.ts src/progression/challenges.test.ts`

- [ ] **Step 3: Implement rewards and three-state codex transitions**

Award genes for first synergy, environment, Boss path, complete codex entry, modifier completion, and ending. Apply a non-zero but diminishing repeat reward. Codex transitions only forward: unseen → seen → defeated-by or complete, with complete as terminal.

Extend `fixtures.ts` with `geneFixture(): GeneProgress` using zero permanent numeric modifiers and the default primal origin.

- [ ] **Step 4: Implement local daily seed and stable dish codes**

Derive daily seed from local `YYYY-MM-DD` plus content version; UI copy must say it is local, not globally synchronized. Dish codes include checksum and reject unknown content versions with a structured issue.

- [ ] **Step 5: Implement all eight modifier contracts**

Apply difficulty weight, reward multiplier, exclusions, and accessibility impact from content. Assert no modifier shortens telegraph lead time below the base minimum.

- [ ] **Step 6: Build post-first-run lab screens and commit**

First visit still shows only title and start. After a recorded archive, show primary restart plus Gene Graph, Codex, Archive, Daily Dish, Dish Code, and Modifiers. All copy comes from content.

Run: `pnpm lint && pnpm test && pnpm build`

```bash
git add projects/09-proto-cell/src/progression projects/09-proto-cell/src/ui/Lab.tsx projects/09-proto-cell/src/ui/Codex.tsx projects/09-proto-cell/src/ui/GeneGraph.tsx
git commit -m "feat(proto-cell): complete metaprogression and challenges"
```

### Task 16: Art Assets, Audio, Comfort Settings, and Error Recovery

**Files:**
- Create: exact local SVG paths enumerated in Step 3
- Create: `projects/09-proto-cell/src/content/assets.ts`
- Create: `projects/09-proto-cell/src/content/assets.test.ts`
- Create: `projects/09-proto-cell/src/audio/audio.ts`
- Create: `projects/09-proto-cell/src/audio/audio.test.ts`
- Create: `projects/09-proto-cell/src/ui/Settings.tsx`
- Create: `projects/09-proto-cell/src/ui/ErrorPanel.tsx`
- Modify: `projects/09-proto-cell/src/rendering/renderer.ts`
- Modify: `projects/09-proto-cell/src/rendering/cell.ts`
- Modify: `projects/09-proto-cell/src/rendering/effects.ts`
- Modify: `projects/09-proto-cell/src/App.css`
- Modify: `projects/09-proto-cell/src/tests/fixtures.ts`

**Interfaces:**
- Produces: complete local visual asset registry, `AudioDirector`, settings UI, content/storage/canvas recovery paths.

- [ ] **Step 1: Write asset, quiet-mode, and recovery tests**

```ts
it('maps every content asset id to a local path', () => {
  const missing = collectAssetIds(getContent()).filter((id) => !assetRegistry[id]?.startsWith('/assets/'))
  expect(missing).toEqual([])
})

it('never starts audio before a user gesture', () => {
  const audio = createAudioDirector(fakeAudioContext())
  audio.handle({ type: 'engulfed', predatorId: 'player', preyId: 'prey-1', biomass: 8, atMs: 100 })
  expect(audio.state()).toBe('locked')
})
```

- [ ] **Step 2: Run and confirm failure**

Run: `pnpm test -- src/content/assets.test.ts src/audio/audio.test.ts`

- [ ] **Step 3: Produce and register the exact local asset set**

Create the following local SVGs and export their stable paths from `src/content/assets.ts`:

```text
public/assets/icons/organelle-{eye-spot,echo-sac,vibration-cilia,flagellum,cilia-ring,jet-vacuole,wide-mouth,needle-mouth,filter-gill,shell-plate,transparent-membrane,mucus-coat,electric-sac,toxin-spine,shock-pulse,photosome,acid-gland,repair-vacuole,division-ring,bud-sac,recombination-core,cleaner-symbiont,lure-symbiont,guard-symbiont}.svg
public/assets/icons/synergy-{radar-grid,invisible-lure,ram-jet,acid-feeder,parasite-anchor,solar-filter,spore-cloud,echo-swarm,repair-shell,clean-acid,ghost-cilia,guardian-division}.svg
public/assets/icons/event-{nutrient-bloom,acid-leak,antibody-sweep,giant-passage}.svg
public/assets/icons/origin-{primal-cell,ciliate-seed,armored-spore}.svg
public/assets/icons/modifier-{permanent-turbidity,low-energy,alert-predators,rising-acid,three-organs,no-merge,fragile-membrane,elite-ecosystem}.svg
public/assets/environments/env-{clear-drop,algae-glow,acid-vesicle,fiber-maze,antibody-storm,abandoned-chamber}.svg
public/assets/bosses/boss-{membrane-queen,antibody-crown,abandoned-host}-{body,mask}.svg
public/assets/ui/{lab-frame,archive-frame,gene-node,codex-frame}.svg
```

Record source/license metadata in `content.json`. Use Web Audio synthesis for launch audio, so this task adds no audio file formats or licenses. Do not introduce runtime fetches outside the built app.

- [ ] **Step 4: Finish programmatic morphology and quality levels**

Implement membrane, cytoplasm, core, organ, appendage, and status layers. `high`, `balanced`, and `low` quality may reduce decorative particles, blur, shadows, far-detail, and appendage nodes only; containment shapes and telegraphs remain identical.

Extend `fixtures.ts` with `fakeAudioContext()` whose resume and oscillator calls are recorded without accessing a browser audio device.

- [ ] **Step 5: Implement gesture-unlocked audio and silent equivalence**

Use Web Audio synthesis or approved local files after the first start tap. Provide separate music/SFX settings. Every audio telegraph has an existing outline, motion, or numeric visual equivalent.

- [ ] **Step 6: Implement settings and recovery screens**

Expose reduced motion, reduced flash, low particles, reduced shake, music, SFX, graphics quality, storage explanation, export, import, and confirmed clear. Initialize reduced motion from `prefers-reduced-motion` without removing danger telegraphs. Handle content validation, storage fallback, Canvas failure, and incompatible dish codes with content-driven messages.

- [ ] **Step 7: Verify and commit**

Run: `pnpm lint && pnpm test && pnpm build`

```bash
git add projects/09-proto-cell/public projects/09-proto-cell/src/audio projects/09-proto-cell/src/ui/Settings.tsx projects/09-proto-cell/src/ui/ErrorPanel.tsx projects/09-proto-cell/src/rendering projects/09-proto-cell/src/App.css projects/09-proto-cell/src/content/content.json
git commit -m "feat(proto-cell): finish launch presentation and recovery"
```

---

## M3 — Release Verification

### Task 17: Deterministic Full-Run and Performance Audits

**Files:**
- Modify: `projects/09-proto-cell/src/tests/playthrough.ts`
- Modify: `projects/09-proto-cell/src/tests/playthrough.test.ts`
- Create: `projects/09-proto-cell/src/tests/content-coverage.test.ts`
- Create: `projects/09-proto-cell/src/tests/performance-budget.test.ts`
- Modify: `projects/09-proto-cell/src/tests/fixtures.ts`

**Interfaces:**
- Produces: reproducibility report, path/ending/death coverage report, performance-budget report.

- [ ] **Step 1: Write full-run reproducibility and coverage tests**

```ts
it('repeats the same key sequence for seed and route', () => {
  const input = { seed: 727, route: ['env-algae-glow', 'env-fiber-maze'], policy: 'balanced' as const }
  expect(runHeadless(input).keyEvents).toEqual(runHeadless(input).keyEvents)
})

it('can trigger every ending and required death family', () => {
  const report = auditOutcomes(getContent(), outcomeFixtures())
  expect(report.missingEndingIds).toEqual([])
  expect(report.missingDeathIds).toEqual([])
})
```

- [ ] **Step 2: Run and fix every deterministic failure at its owning module**

Run: `pnpm test -- src/tests/playthrough.test.ts src/tests/content-coverage.test.ts`  
Expected after fixes: PASS with no missing IDs, unreachable exits, stuck Boss phases, or non-finite numbers.

Extend `fixtures.ts` with `outcomeFixtures()` containing one minimal structured event sequence for every ending and required death family.

- [ ] **Step 3: Add simulation-time budgets**

Measure 18,000 fixed steps with the launch pressure fixture. Assert no entity count above the content hard cap, no spatial query returning duplicate IDs, and average update cost below the agreed CI baseline captured on the first clean run. Store the numeric baseline in the test fixture, not in user-facing content.

- [ ] **Step 4: Run ten seeded build-diversity audits**

Use ten fixed seeds and the deterministic choice policies `speed`, `armor`, `stealth`, `parasite`, and `swarm`. Assert at least six distinct morphology signatures and at least four successful terminal routes.

- [ ] **Step 5: Verify and commit**

Run: `pnpm lint && pnpm test && pnpm build`

```bash
git add projects/09-proto-cell/src/tests
git commit -m "test(proto-cell): audit full runs and performance"
```

### Task 18: Mobile, Safe-Area, Accessibility, and Final Gate

**Files:**
- Modify: only failing files inside `projects/09-proto-cell`
- Create: `projects/09-proto-cell/VISUAL_QA.md`

**Interfaces:**
- Consumes: complete static build.
- Produces: recorded 375/390/430 and non-zero-safe-area verification, final passing release gate.

- [ ] **Step 1: Build and serve the exact release output**

Run: `pnpm build && pnpm preview -- --host 127.0.0.1`  
Expected: Vite serves the static `dist` without network errors or runtime external requests.

- [ ] **Step 2: Verify three mobile widths with a 44px simulated top inset**

At 375, 390, and 430 CSS px, set `--safe-area-inset-top: 44px` and verify title, HUD, pause, mutation overlay, route rifts, Boss bar, result card, archive, codex, graph, settings, import error, and storage fallback. Confirm top controls and anchor targets are not covered.

- [ ] **Step 3: Verify touch and lifecycle failure paths**

Check pointer down/move/end/cancel, browser address-bar resize, orientation change, hidden-tab pause, resume without catch-up, muted start, locked audio, low graphics, reduced motion, reduced flash, corrupted import, unavailable IndexedDB, and immediate restart.

- [ ] **Step 4: Verify accessibility and readable danger**

Keyboard-focus pause, overlays, settings, and result actions. Confirm all touch targets are at least 44 CSS px, focus is trapped/restored for modal overlays, danger remains readable in grayscale, and reduced-motion mode retains telegraph timing.

- [ ] **Step 5: Record factual visual QA evidence**

In `VISUAL_QA.md`, record viewport, simulated inset, route/seed, observed FPS band, passed checks, and screenshot filenames stored under `projects/09-proto-cell/release-assets/`. Record that normal mode targets 60 FPS and sustained pressure remains at or above 30 FPS on the test device. Do not store screenshots in IndexedDB or application state.

- [ ] **Step 6: Run the final gate and commit**

Run: `pnpm lint && pnpm test && pnpm build`  
Expected: all PASS with no deleted tests, lint suppressions, external runtime dependencies, or files changed outside `projects/09-proto-cell`.

```bash
git add projects/09-proto-cell
git commit -m "release(proto-cell): pass complete launch gate"
```

## Execution Order and Review Checkpoints

1. Tasks 1–7 produce M0. Stop for hand-feel review; do not begin content expansion if movement and containment are not fun.
2. Tasks 8–11 produce M1. Stop for a 5–8 minute vertical-slice playtest and immediate-restart review.
3. Tasks 12–16 produce M2 complete launch scope. Freeze numeric content only after M1 evidence.
4. Tasks 17–18 produce M3 release evidence.

Each task receives a fresh implementation review. A milestone proceeds only when its task tests pass and its experiential gate is explicitly accepted.
