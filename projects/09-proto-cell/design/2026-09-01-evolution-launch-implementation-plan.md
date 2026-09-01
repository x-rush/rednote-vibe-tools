# Evolution and Launch Presentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the redesign with behavior-changing builds, five visible body stages, original launch-quality art and audio, concise evolution choices, truthful results, and full mobile launch verification.

**Architecture:** Replace the organ-list mutation context with an explicit build state and trigger evaluator while preserving existing content IDs, unlocks, archives, and storage compatibility. Render morphology from body stage plus installed traits, and keep all combat abilities passive and movement-triggered.

**Tech Stack:** React 19, TypeScript 6, Canvas 2D/SVG/local PNG, Vitest, Vite, existing Web Audio; no new dependencies.

**Spec:** `projects/09-proto-cell/design/2026-09-01-ecology-roguelite-redesign.md`

## Global Constraints

- Complete the core-feel and ecology-journey plans first with passing full project gates.
- Modify only `projects/09-proto-cell`; do not modify the root lockfile, workspace files, `docs/`, `prep/`, or other projects.
- Gameplay remains movement only; every organ effect is triggered by movement, proximity, containment, damage, engulf, environment entry, or a deterministic timer.
- Every offered evolution changes behavior or morphology; no standalone damage, speed, health, or yield card is allowed.
- Use image generation only for original concept/background assets. Do not store or transform the user's reference screenshots.
- Keep generated and authored assets local under `public/assets`; no runtime CDN or external API.
- Preserve current structured save compatibility through migration rather than clearing player data.
- Every implementation task follows red-green-refactor and ends in its own commit on `main`.

## File Structure

- `src/evolution/build.ts`: body stages, three routes, trait state, synergy state, and candidate scoring.
- `src/evolution/triggers.ts`: deterministic movement/contact/environment trigger evaluation.
- `src/evolution/mutation.ts`: compatibility adapter from existing organ content to the new build model.
- `src/evolution/organs.ts`: effect application only; consumes trigger outputs.
- `src/rendering/morphology.ts`: body-stage silhouette and installed-trait visual parts.
- `src/rendering/metamorphosis.ts`: stage transition timing and reduced-motion fallback.
- `src/ui/EvolutionOverlay.tsx`: concise before/after choice cards.
- `src/ui/ResultOverlay.tsx`: immediate truthful result and restart flow.
- `src/audio/audio.ts`: layered cue patterns for movement, chain, damage, warning, and metamorphosis.
- `public/assets/environments/arcade-*.png`: original generated background textures.
- `src/storage/codec.ts`: versioned migration for build-stage archive data.

---

### Task 1: Behavior Build Model and Candidate Guarantees

**Files:**
- Create: `src/evolution/build.ts`
- Create: `src/evolution/build.test.ts`
- Modify: `src/evolution/mutation.ts`
- Modify: `src/evolution/mutation.test.ts`
- Modify: `src/content/schema.ts`
- Modify: `src/content/validate.ts`
- Modify: `src/content/validate.test.ts`
- Modify: `src/content/content.json`

**Interfaces:**
- Produces: `EvolutionRoute = 'predation' | 'survival' | 'colony'`.
- Produces: `BuildState`, `BuildTraitDefinition`, `EvolutionOffer`, `createBuildState(overrides?: Partial<BuildState>): BuildState`, `bodyStageAfterOffer(state, milestone)`, `offerEvolution(state, context): EvolutionOffer[]`, and `applyEvolution(state, offer): BuildState`.
- Consumed by: Tasks 2–5 and `App.tsx`.

- [ ] **Step 1: Write failing build-invariant tests**

```ts
const allTraitIds = getContent().organelles.map((organ) => organ.id)

it('offers continuation, environment response, and cross-route risk', () => {
  const state = createBuildState({ routeCounts: { predation: 2, survival: 0, colony: 0 } })
  const offers = offerEvolution(state, { seed: 727, environmentId: 'env-acid-vesicle', stageIndex: 2, remainingEnvironmentIds: ['env-fiber-maze', 'env-abandoned-chamber'], unlockedTraitIds: allTraitIds, recentTraitIds: [] })
  expect(offers.map((offer) => offer.lane)).toEqual(['continuation', 'adaptation', 'risk'])
  expect(new Set(offers.map((offer) => offer.traitId)).size).toBe(3)
})

it('never offers a trait whose trigger cannot occur in the remaining journey', () => {
  const offers = offerEvolution(createBuildState(), { seed: 727, environmentId: 'env-abandoned-chamber', stageIndex: 5, remainingEnvironmentIds: ['env-abandoned-chamber'], unlockedTraitIds: allTraitIds, recentTraitIds: [] })
  expect(offers.every((offer) => offer.triggerAvailable)).toBe(true)
})

it('guarantees the first offer advances microbe to hunter', () => {
  const state = createBuildState({ bodyStage: 'microbe', evolutionCount: 0 })
  const offer = offerEvolution(state, { seed: 727, environmentId: 'env-clear-drop', stageIndex: 0, remainingEnvironmentIds: ['env-algae-glow'], unlockedTraitIds: allTraitIds, recentTraitIds: [] })[0]!
  const selected = applyEvolution(state, offer)
  expect(selected.bodyStage).toBe('hunter')
})

it.each([[0, 'hunter'], [2, 'specialist'], [3, 'dominant'], [4, 'ascendant']] as const)('maps the authored metamorph milestone %s to %s', (stageIndex, expected) => {
  expect(bodyStageAfterOffer(createBuildState(), { stageIndex, evolutionCount: stageIndex === 0 ? 0 : 4 })).toBe(expected)
})
```

- [ ] **Step 2: Run focused tests and verify the old mutation lanes fail the new contract**

Run: `pnpm test -- src/evolution/build.test.ts src/evolution/mutation.test.ts src/content/validate.test.ts`

Expected: FAIL because mutation choices expose organ installation actions but no route, body-stage, trigger-availability, or behavior-change contract.

- [ ] **Step 3: Define the build types and content fields**

```ts
export type BuildState = {
  bodyStage: BodyStage
  evolutionCount: number
  traitIds: OrganelleId[]
  routeCounts: Record<EvolutionRoute, number>
  synergyIds: SynergyId[]
  stability: number
}

export type BuildTraitDefinition = {
  organId: OrganelleId
  route: EvolutionRoute
  triggerId: `trigger-${string}`
  effectId: string
  morphologyPartId: string
  costText: string
  environmentIds: EnvironmentId[]
}

export type EvolutionOffer = {
  lane: 'continuation' | 'adaptation' | 'risk'
  traitId: OrganelleId
  route: EvolutionRoute
  resultingBodyStage: BodyStage
  behaviorText: string
  costText: string
  triggerAvailable: boolean
}

export type EvolutionOfferContext = {
  seed: number
  environmentId: EnvironmentId
  stageIndex: number
  remainingEnvironmentIds: EnvironmentId[]
  unlockedTraitIds: OrganelleId[]
  recentTraitIds: OrganelleId[]
}
```

Add route, trigger, morphology part, and cost display fields to every organ in `content.json`. Validation requires a nonempty behavior trigger and rejects a trait whose effect is only a scalar multiplier.

- [ ] **Step 4: Implement deterministic candidate scoring**

Score candidates by lane, current route count, environment match, uncompleted synergy, unlock availability, and recent-offer exclusion. Break ties with a seeded RNG forked from run seed plus evolution count. Return exactly three distinct offers whenever three valid unlocked traits remain. Export `bodyStageAfterOffer(state, { stageIndex, evolutionCount })`: the first evolution at journey stage 0 reaches `hunter`, and the first offers accepted in journey stages 2, 3, and 4 reach `specialist`, `dominant`, and `ascendant`; all other offers retain the current body stage.

- [ ] **Step 5: Preserve existing mutation compatibility**

Keep `MutationChoice` as an adapter view of `EvolutionOffer` until `App.tsx` switches in Task 3. Existing archive organ IDs and gene unlock IDs must remain unchanged.

- [ ] **Step 6: Run evolution and content tests**

Run: `pnpm test -- src/evolution/build.test.ts src/evolution/mutation.test.ts src/content/validate.test.ts src/content/content-completeness.test.ts`

Expected: PASS; all 24 existing organs map to one of three routes and a concrete behavior trigger.

- [ ] **Step 7: Commit the build model**

```bash
git add projects/09-proto-cell/src/evolution/build.ts projects/09-proto-cell/src/evolution/build.test.ts projects/09-proto-cell/src/evolution/mutation.ts projects/09-proto-cell/src/evolution/mutation.test.ts projects/09-proto-cell/src/content/schema.ts projects/09-proto-cell/src/content/validate.ts projects/09-proto-cell/src/content/validate.test.ts projects/09-proto-cell/src/content/content.json
git commit -m "feat(proto-cell): model behavior changing builds"
```

### Task 2: Movement-Driven Trigger Runtime

**Files:**
- Create: `src/evolution/triggers.ts`
- Create: `src/evolution/triggers.test.ts`
- Modify: `src/evolution/organs.ts`
- Modify: `src/evolution/organs.test.ts`
- Modify: `src/game/engine.ts`
- Modify: `src/game/engine.test.ts`
- Modify: `src/game/interactions.ts`
- Modify: `src/game/interactions.test.ts`
- Modify: `src/rendering/numbers.ts`
- Modify: `src/rendering/numbers.test.ts`
- Modify: `src/ui/GameCanvas.tsx`
- Modify: `src/ui/GameCanvas.test.ts`

**Interfaces:**
- Consumes: `BuildState`, fixed-step movement history, proximity samples, containment, damage, engulf, and environment events.
- Produces: `TriggerSignal[]` and `evaluateTriggers(build, frame): TriggerOutcome[]`.
- Produces: `ProtoCellEngine.applyEvolution(build: BuildState): void`, replacing the old mutation-result-only engine boundary after compatibility tests pass.
- `TriggerOutcome` is applied through existing organ effects and emits `trait-triggered` events for rendering/audio.
- Extends player-authored `engulfed` events with the authoritative `chain` count used by triggers, numbers, audio, and archives.

- [ ] **Step 1: Write failing tests for representative movement-only abilities**

```ts
const triggerBuild = (organId: OrganelleId) => createBuildState({ traitIds: [organId] })
const triggerFrame = (overrides: Partial<TriggerFrame>): TriggerFrame => ({
  atMs: 5000, elapsedMs: 1000 / 60,
  movement: { speed: 0, directionHeldMs: 0, pursuitMs: 0, closingSpeed: 0 },
  environmentId: 'env-clear-drop',
  ...overrides,
})

it('triggers pursuit burst after two seconds of closing distance', () => {
  const outcome = evaluateTriggers(triggerBuild('organelle-flagellum'), triggerFrame({ movement: { speed: 64, directionHeldMs: 2000, pursuitMs: 2000, closingSpeed: 32 } }))
  expect(outcome).toContainEqual(expect.objectContaining({ effectId: 'pursuit-burst', durationMs: 900 }))
})

it('triggers near-miss camouflage without a button press', () => {
  const outcome = evaluateTriggers(triggerBuild('organelle-transparent-membrane'), triggerFrame({ nearMiss: { threatId: 'hunter', clearance: 4 } }))
  expect(outcome).toContainEqual(expect.objectContaining({ effectId: 'near-miss-camouflage' }))
})

it('opens a vortex after three engulfs inside the chain window', () => {
  const outcome = evaluateTriggers(triggerBuild('organelle-wide-mouth'), triggerFrame({ engulf: { preyId: 'prey', chain: 3, approach: 'front' } }))
  expect(outcome).toContainEqual(expect.objectContaining({ effectId: 'engulf-vortex' }))
})
```

- [ ] **Step 2: Run focused tests and verify trigger runtime is absent**

Run: `pnpm test -- src/evolution/triggers.test.ts src/evolution/organs.test.ts src/game/interactions.test.ts`

Expected: FAIL because passive organ evaluation does not receive pursuit, near-miss, chain, or directional containment signals.

- [ ] **Step 3: Define authoritative trigger frames**

```ts
export type TriggerFrame = {
  atMs: number
  elapsedMs: number
  movement: { speed: number; directionHeldMs: number; pursuitMs: number; closingSpeed: number }
  proximity?: { nearestThreatId?: string; nearestEdibleId?: string }
  nearMiss?: { threatId: string; clearance: number }
  engulf?: { preyId: string; chain: number; approach: 'front' | 'side' | 'rear' }
  damage?: { source: DamageSource; remainingMembraneRatio: number }
  environmentId: EnvironmentId
}
```

Maintain only rolling counters needed by installed traits. Reset counters on pause, migration, death, and mutation application.

- [ ] **Step 4: Implement cooldown-safe trigger evaluation**

Key trigger/effect pairs must include pursuit burst, near-miss camouflage, three-engulf vortex, rear containment bonus, collision acid trail, low-membrane molt, damage split, school proximity heal, and current-assisted acceleration. Use per-trait cooldown maps owned by the engine; emit at most one `trait-triggered` event per trait per fixed step. Track the player engulf chain in the engine with the accepted 1400ms window and attach the count to each player-authored `engulfed` event.

- [ ] **Step 5: Integrate outcomes without adding input methods**

Apply speed and containment modifiers before movement/interaction, and spawn trails, shields, offspring, or camouflage states after the matching event. Pass `event.chain` through `GameCanvas` to `NumberFeed` so display and audio use the engine's authoritative count rather than recomputing separate windows. Do not add click, tap, double-click, keyboard action, or HUD ability handlers.

- [ ] **Step 6: Run trigger, organ, interaction, and engine tests**

Run: `pnpm test -- src/evolution/triggers.test.ts src/evolution/organs.test.ts src/game/interactions.test.ts src/game/engine.test.ts src/rendering/numbers.test.ts src/ui/GameCanvas.test.ts`

Expected: PASS with deterministic cooldowns and no effect firing during pause.

- [ ] **Step 7: Commit movement-triggered builds**

```bash
git add projects/09-proto-cell/src/evolution/triggers.ts projects/09-proto-cell/src/evolution/triggers.test.ts projects/09-proto-cell/src/evolution/organs.ts projects/09-proto-cell/src/evolution/organs.test.ts projects/09-proto-cell/src/game/engine.ts projects/09-proto-cell/src/game/engine.test.ts projects/09-proto-cell/src/game/interactions.ts projects/09-proto-cell/src/game/interactions.test.ts projects/09-proto-cell/src/rendering/numbers.ts projects/09-proto-cell/src/rendering/numbers.test.ts projects/09-proto-cell/src/ui/GameCanvas.tsx projects/09-proto-cell/src/ui/GameCanvas.test.ts
git commit -m "feat(proto-cell): trigger builds through movement"
```

### Task 3: Visual Evolution Choice and Metamorphosis

**Files:**
- Create: `src/rendering/morphology.ts`
- Create: `src/rendering/morphology.test.ts`
- Create: `src/rendering/metamorphosis.ts`
- Create: `src/rendering/metamorphosis.test.ts`
- Modify: `src/rendering/cell.ts`
- Modify: `src/rendering/cell.test.ts`
- Modify: `src/rendering/renderer.ts`
- Modify: `src/ui/EvolutionOverlay.tsx`
- Modify: `src/ui/EvolutionOverlay.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.css`

**Interfaces:**
- Consumes: `BuildState` and `EvolutionOffer` from Task 1 plus `trait-triggered` events from Task 2.
- Produces: `morphologyFor(build: BuildState): MorphologyProfile` and `metamorphosisPresentation(ageMs, reducedMotion): MetamorphosisPresentation | undefined`.
- Produces: `EvolutionOverlay` cards with before/after morphology, behavior sentence, and cost sentence.

- [ ] **Step 1: Write failing morphology and overlay tests**

```ts
it('changes silhouette and visible parts across body stages and routes', () => {
  const microbe = morphologyFor(createBuildState({ bodyStage: 'microbe' }))
  const predator = morphologyFor(createBuildState({ bodyStage: 'specialist', traitIds: ['organelle-wide-mouth'], routeCounts: { predation: 3, survival: 0, colony: 0 } }))
  expect(predator.silhouette).not.toBe(microbe.silhouette)
  expect(predator.parts).toContain('wide-maw')
})

it('shows one behavior change and one cost per choice', () => {
  const choices: EvolutionOffer[] = [{
    lane: 'continuation', traitId: 'organelle-flagellum', route: 'predation', resultingBodyStage: 'hunter',
    behaviorText: '追逐两秒后爆发加速', costText: '代价：转向略慢', triggerAvailable: true,
  }]
  const html = renderToString(<EvolutionOverlay choices={choices} onConfirm={() => undefined} />)
  expect(html).toContain('追逐两秒后爆发加速')
  expect(html).toContain('代价：转向略慢')
  expect(html).not.toContain('trigger-pursuit-2000')
})
```

- [ ] **Step 2: Run focused tests and verify the abstract organ display fails**

Run: `pnpm test -- src/rendering/morphology.test.ts src/rendering/metamorphosis.test.ts src/ui/EvolutionOverlay.test.tsx src/rendering/cell.test.ts`

Expected: FAIL because the current renderer draws generic ellipses for installed organs and the overlay exposes action/stability details rather than a behavioral before/after.

- [ ] **Step 3: Implement morphology composition**

Map each body stage to a base silhouette and each morphology part ID to an authored Canvas/SVG drawing function. Resolve conflicting parts by anchor priority and cap small-screen visible parts at six, while all installed traits remain mechanically active.

- [ ] **Step 4: Implement metamorphosis timing**

Use a 900ms sequence: 0–220ms membrane contraction, 220–560ms silhouette interpolation and part growth, 560–900ms color bloom and title. Reduced motion uses a 180ms cross-fade with no scale pulse. Expose presentation values as pure functions tested at boundary timestamps.

- [ ] **Step 5: Replace the overlay card hierarchy**

Each button renders route badge, organ name, before/after cell preview, `behaviorText`, and `costText`. Keep radio semantics, focus trap, disabled confirm until selection, and 44px controls. Remove internal stability math from the default card; expose it only through an optional details disclosure in pause/lab views.

- [ ] **Step 6: Wire authoritative build state through `App.tsx`**

Replace `MutationContext` ownership with `BuildState`; adapt repository unlock filtering before calling `offerEvolution`. After confirmation, call `engine.applyEvolution(nextBuild)`, emit existing `mutation-selected` for archive compatibility, and resume only after metamorphosis completes.

- [ ] **Step 7: Run evolution UI and rendering tests**

Run: `pnpm test -- src/evolution/build.test.ts src/rendering/morphology.test.ts src/rendering/metamorphosis.test.ts src/ui/EvolutionOverlay.test.tsx src/rendering/cell.test.ts src/app/view-model.test.ts`

Expected: PASS, including reduced-motion presentation and focus restoration.

- [ ] **Step 8: Commit visible evolution**

```bash
git add projects/09-proto-cell/src/rendering/morphology.ts projects/09-proto-cell/src/rendering/morphology.test.ts projects/09-proto-cell/src/rendering/metamorphosis.ts projects/09-proto-cell/src/rendering/metamorphosis.test.ts projects/09-proto-cell/src/rendering/cell.ts projects/09-proto-cell/src/rendering/cell.test.ts projects/09-proto-cell/src/rendering/renderer.ts projects/09-proto-cell/src/ui/EvolutionOverlay.tsx projects/09-proto-cell/src/ui/EvolutionOverlay.test.tsx projects/09-proto-cell/src/App.tsx projects/09-proto-cell/src/App.css
git commit -m "feat(proto-cell): make evolution visibly transformative"
```

### Task 4: Original Art Pack and Layered Audio

**Files:**
- Create: `public/assets/environments/arcade-clear-drop.png`
- Create: `public/assets/environments/arcade-algae-glow.png`
- Create: `public/assets/environments/arcade-acid-vesicle.png`
- Create: `public/assets/environments/arcade-fiber-maze.png`
- Create: `public/assets/environments/arcade-antibody-storm.png`
- Create: `public/assets/environments/arcade-abandoned-chamber.png`
- Modify: `src/content/assets.ts`
- Modify: `src/content/assets.test.ts`
- Modify: `src/rendering/renderer.ts`
- Modify: `src/rendering/effects.ts`
- Modify: `src/rendering/effects.test.ts`
- Modify: `src/audio/audio.ts`
- Modify: `src/audio/audio.test.ts`
- Modify: `src/content/content.json`

**Interfaces:**
- Produces: six original local background textures and complete content asset mappings.
- Produces: `cuePattern(input: AudioCueInput): AudioCuePattern` for movement, engulf, chain, damage, collapse warning, and metamorphosis.
- Consumed by: renderer and `AudioDirector.handle`.

- [ ] **Step 1: Write failing asset and audio-pattern tests**

```ts
it('maps every environment to a local arcade background', () => {
  for (const environment of content.environments) {
    expect(assetPath(`${environment.id}:arcade`)).toMatch(/^\/assets\/environments\/arcade-.+\.png$/)
  }
})

it('raises pitch and layer count across an engulf chain without exceeding the gain cap', () => {
  expect(cuePattern({ kind: 'engulf', chain: 1 }).frequencies).toHaveLength(1)
  expect(cuePattern({ kind: 'engulf', chain: 5 }).frequencies.length).toBeGreaterThan(1)
  expect(cuePattern({ kind: 'engulf', chain: 5 }).gain).toBeLessThanOrEqual(0.06)
})
```

- [ ] **Step 2: Run asset and audio tests and verify new resources are absent**

Run: `pnpm test -- src/content/assets.test.ts src/audio/audio.test.ts src/rendering/effects.test.ts`

Expected: FAIL because arcade environment mappings and layered cue patterns do not exist.

- [ ] **Step 3: Generate the six original background textures**

Invoke the `imagegen` skill before generating assets. Use the approved high-saturation fluorescent arcade-cell direction, but exclude copied UI, characters, logos, text, and compositions from reference screenshots. Generate seamless 1536×1536 textures with large low-contrast structures, clear central play space, and one distinct palette per environment. Inspect every result, keep only final PNG files, and do not save prompts or user reference images as assets.

- [ ] **Step 4: Integrate backgrounds with three-depth parallax**

Map each `env-*:arcade` ID in `assets.ts`. Draw generated texture at far depth, authored environment SVG at middle depth, and Canvas particles/fibers at near depth. Apply low mode by omitting the near decorative layer only; hazard and route cues remain.

- [ ] **Step 5: Implement bounded layered sound patterns**

Replace single-tone `cueFor` with a pure `cuePattern(input: AudioCueInput)` returning oscillator layers and an envelope. Define `AudioCueInput` as a discriminated union for movement onset, engulf with chain, membrane damage, collapse warning, metamorphosis, boss arrival, death, and ending. `AudioDirector.handle(GameEvent)` maps structured events into that union. Cap simultaneous one-shot oscillators at eight and total requested gain at `0.06`.

- [ ] **Step 6: Run art mapping, audio, and renderer tests**

Run: `pnpm test -- src/content/assets.test.ts src/audio/audio.test.ts src/rendering/effects.test.ts src/rendering/cell.test.ts`

Expected: PASS; all six files exist, mappings are local, reduced settings retain authoritative cues, and audio fallback remains non-throwing.

- [ ] **Step 7: Commit the original presentation pack**

```bash
git add projects/09-proto-cell/public/assets/environments/arcade-*.png projects/09-proto-cell/src/content/assets.ts projects/09-proto-cell/src/content/assets.test.ts projects/09-proto-cell/src/rendering/renderer.ts projects/09-proto-cell/src/rendering/effects.ts projects/09-proto-cell/src/rendering/effects.test.ts projects/09-proto-cell/src/audio/audio.ts projects/09-proto-cell/src/audio/audio.test.ts projects/09-proto-cell/src/content/content.json
git commit -m "feat(proto-cell): add original arcade ecology art"
```

### Task 5: Truthful Result, Fast Restart, and Save Migration

**Files:**
- Create: `src/ui/ResultOverlay.tsx`
- Create: `src/ui/ResultOverlay.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.css`
- Modify: `src/app/view-model.ts`
- Modify: `src/app/view-model.test.ts`
- Modify: `src/progression/archive.ts`
- Modify: `src/progression/archive.test.ts`
- Modify: `src/storage/codec.ts`
- Modify: `src/storage/codec.test.ts`
- Modify: `src/content/content.json`

**Interfaces:**
- Consumes: final `BuildState`, journey history, structured game events, dish seed, and existing archive data.
- Produces: `createResultViewModel(input: ResultInput, content: ContentPack): ResultViewModel` with real cause, final stage, key traits, route, score, and restart seeds. `ResultInput` contains `events`, `finalBuild`, `journeyStageIndex`, `environmentIds`, `engulfScore`, `survivalMs`, and `seed`.
- Produces: backward-compatible structured save migration.

- [ ] **Step 1: Write failing result and migration tests**

```ts
it('derives result facts from events instead of generic copy', () => {
  const result = createResultViewModel({
    events: [{ type: 'player-died', cause: 'predator-engulf', atMs: 360_000 }],
    finalBuild: createBuildState({ bodyStage: 'dominant', traitIds: ['organelle-flagellum'] }),
    journeyStageIndex: 4, environmentIds: ['env-clear-drop', 'env-algae-glow'],
    engulfScore: 6528, survivalMs: 360_000, seed: 727,
  }, getContent())
  expect(result.cause).toContain('吞噬')
  expect(result.stageLabel).toBe('统治体')
  expect(result.keyTraitIds).toContain('organelle-flagellum')
})

it('migrates a v1 archive without inventing a completed body stage', () => {
  const migrated = decodeSave(saveFixture())
  expect(migrated.value.lifeArchives[0].finalBodyStage).toBe('microbe')
  expect(migrated.issues).toEqual([])
})
```

- [ ] **Step 2: Run result and storage tests and verify missing fields fail**

Run: `pnpm test -- src/ui/ResultOverlay.test.tsx src/app/view-model.test.ts src/progression/archive.test.ts src/storage/codec.test.ts`

Expected: FAIL because the current result path has no final body stage/build summary and save v1 lacks these optional fields.

- [ ] **Step 3: Extend archive data with conservative defaults**

Add `finalBodyStage`, `buildRouteCounts`, and `journeyStageIndex` to new archive summaries. Decode older saves with `microbe`, zero route counts, and a stage derived only from recorded environment history; never infer an unrecorded success.

- [ ] **Step 4: Implement the result overlay**

Show final morphology, true death/ending sentence, survival time, journey stage, engulf score, and three key traits. Provide primary `立即重生` and secondary `返回培养皿`; the primary action starts a new seed in one click. Keep same-seed replay in a small accessible disclosure.

- [ ] **Step 5: Preserve progression semantics**

Continue awarding genes for first discoveries, routes, boss paths, endings, and modifiers. New body-stage and build-route data are archival facts, not permanent scalar power.

- [ ] **Step 6: Run result, archive, repository, and controller tests**

Run: `pnpm test -- src/ui/ResultOverlay.test.tsx src/app/view-model.test.ts src/progression/archive.test.ts src/storage/codec.test.ts src/storage/repository.test.ts src/app/controller.test.ts`

Expected: PASS for v1 decode, new save round-trip, immediate restart, lab return, and corrupt-save session fallback.

- [ ] **Step 7: Commit the launch loop**

```bash
git add projects/09-proto-cell/src/ui/ResultOverlay.tsx projects/09-proto-cell/src/ui/ResultOverlay.test.tsx projects/09-proto-cell/src/App.tsx projects/09-proto-cell/src/App.css projects/09-proto-cell/src/app/view-model.ts projects/09-proto-cell/src/app/view-model.test.ts projects/09-proto-cell/src/progression/archive.ts projects/09-proto-cell/src/progression/archive.test.ts projects/09-proto-cell/src/storage/codec.ts projects/09-proto-cell/src/storage/codec.test.ts projects/09-proto-cell/src/content/content.json
git commit -m "feat(proto-cell): finish truthful restart loop"
```

### Task 6: Full Launch Audit

**Files:**
- Modify: `src/tests/playthrough.ts`
- Modify: `src/tests/playthrough.test.ts`
- Modify: `src/tests/performance-budget.test.ts`
- Modify: `src/tests/content-coverage.test.ts`
- Modify: `src/content/content-completeness.test.ts`

**Interfaces:**
- Consumes: the complete core feel, ecology journey, build, presentation, storage, and accessibility behavior.
- Produces: deterministic launch audit reports with `deathId`, `stageSignature`, and final morphology; adds no production-only interfaces.

- [ ] **Step 1: Write failing launch-experience audits**

```ts
const launchRouteAuditSet = [
  ['journey-route-algae-feast', 'journey-route-fiber-cover', 'journey-route-acid-pressure', 'journey-route-fiber-ambush', 'journey-route-chamber-wreckage'],
  ['journey-route-acid-mutation', 'journey-route-antibody-current', 'journey-route-algae-blackout', 'journey-route-antibody-hunt', 'journey-route-chamber-gauntlet'],
  ['journey-route-algae-feast', 'journey-route-antibody-current', 'journey-route-acid-pressure', 'journey-route-antibody-hunt', 'journey-route-chamber-wreckage'],
  ['journey-route-acid-mutation', 'journey-route-fiber-cover', 'journey-route-algae-blackout', 'journey-route-fiber-ambush', 'journey-route-chamber-gauntlet'],
] as const

it('produces at least six distinct final morphology signatures across ten seeds', () => {
  const signatures = new Set(Array.from({ length: 10 }, (_, seed) => runHeadless({ seed, durationMs: 520_000 }).morphologySignature))
  expect(signatures.size).toBeGreaterThanOrEqual(6)
})

it('covers every route offer across complete eight-minute outcomes', () => {
  for (const [seed, route] of launchRouteAuditSet.entries()) {
    const report = runHeadless({ seed: seed + 727, durationMs: 540_000, route })
    expect(report.invalidNumbers).toEqual([])
    expect(report.endingId ?? report.deathId).toBeDefined()
    expect(report.stageSignature.split('>')).toHaveLength(6)
  }
})
```

- [ ] **Step 2: Run launch audits and record every failing acceptance condition**

Run: `pnpm test -- src/tests/playthrough.test.ts src/tests/performance-budget.test.ts src/tests/content-coverage.test.ts src/content/content-completeness.test.ts`

Expected before final tuning: FAIL on any route, morphology, content, or performance requirement that remains incomplete. Fix production behavior or content; do not weaken or delete the tests.

- [ ] **Step 3: Complete content and deterministic tuning until audits pass**

Tune only values in `content.json` for stage timings, ecology budgets, route risks, candidate weights, and director intervals. Change code only when an audit exposes a rule defect rather than a balance value. Keep the accepted 5-second first engulf, 45-second first evolution, 60–90-second environment change, and 8-minute target.

- [ ] **Step 4: Run the full automated gate**

Run: `pnpm lint && pnpm test && pnpm build && git diff --check`

Expected: all commands exit 0; no test deletions; production bundle uses only local assets.

- [ ] **Step 5: Verify mobile play and safe areas in a real browser**

At 375×812, 390×844, and 430×932 with a 44px simulated safe area, play from lab through at least one migration, one ordinary evolution, one body metamorphosis, pause/resume, death/result, and immediate restart. Verify:

- no horizontal document overflow or unreachable scroll content;
- HUD and overlays remain below the safe area;
- input cancellation works on pause, resize, pointer loss, evolution, migration, and page visibility change;
- first engulf occurs within 5 seconds in the curated first-run seed;
- visible world change occurs within 60–90 seconds;
- no collision or boundary can trap the player;
- edible, dangerous, and opportunity targets remain distinguishable without color;
- reduced motion/flash/particles and mute preserve all gameplay information;
- console errors are zero and pressure scenes remain at least 30 FPS.

- [ ] **Step 6: Request independent code review and fix all Critical/Important findings**

Review the complete commit range from the first core-feel task through the launch audit. The review is read-only and must cover spec alignment, deterministic simulation, mobile input, content validation, save migration, accessibility, performance, and resource provenance. Re-run the full automated and browser gates after any fix.

- [ ] **Step 7: Commit final audited tuning**

```bash
git add projects/09-proto-cell
git commit -m "release(proto-cell): complete ecology roguelite redesign"
```

Before this command, verify `git diff --cached --name-only` lists only `projects/09-proto-cell/**` and does not include unrelated working-tree changes.

## Phase Completion Gate

The redesign is complete only when all three plans pass their phase gates, ten seeded runs demonstrate six distinct final morphologies, the real browser flow passes all three mobile widths with a nonzero safe area, and independent review has no unresolved Critical or Important findings.
