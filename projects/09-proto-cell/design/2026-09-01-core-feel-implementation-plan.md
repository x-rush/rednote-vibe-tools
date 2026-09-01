# Core Feel Vertical Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current target-relative movement, continuous radius zoom, low-contrast cells, and four-column HUD with a mobile-first movement-and-feedback slice that already feels responsive in the existing ecology.

**Architecture:** Keep the fixed-step engine and Canvas 2D renderer, but move input curves, entity motion, and camera projection into small pure modules. Feed renderer and HUD through explicit snapshot fields so later ecology and evolution plans can extend the slice without rewriting its seams.

**Tech Stack:** React 19, TypeScript 6, Canvas 2D, Vitest, Vite, existing Web Audio; no new dependencies.

**Spec:** `projects/09-proto-cell/design/2026-09-01-ecology-roguelite-redesign.md`

## Global Constraints

- Modify only `projects/09-proto-cell`; do not modify the root lockfile, workspace files, `docs/`, `prep/`, or other projects.
- Keep a pure static frontend with no backend, runtime CDN, required external API, Service Worker, Node runtime API, or unconfirmed device API.
- Keep all business content and UI copy in `src/content/content.json`.
- Do not add active skill buttons; gameplay input remains movement only.
- Preserve the current containment rule: the predator must be larger and cover about 65% of the prey.
- Preserve reduced-motion, reduced-flash, low-particle, mute, and structured-save behavior.
- Every implementation task follows red-green-refactor and ends in its own commit on `main`.
- Before the plan is complete, run `pnpm lint && pnpm test && pnpm build` in `projects/09-proto-cell` and verify 375, 390, and 430 CSS px with a 44px simulated safe area.

## File Structure

- `src/game/input.ts`: floating joystick state and normalized movement intent.
- `src/game/motion.ts`: acceleration, release drift, reversal, and entity motion response.
- `src/game/bounds.ts`: soft world-edge steering plus hard finite fallback.
- `src/rendering/camera.ts`: player anchor, forward look, stage zoom, and projection.
- `src/rendering/feedback.ts`: prey/danger relationship cues and short combat presentation values.
- `src/rendering/cell.ts`: thick-outline arcade cell silhouettes and player organ display.
- `src/rendering/renderer.ts`: orchestration only; consumes camera and feedback helpers.
- `src/rendering/numbers.ts`: named engulf rewards and chain multiplier presentation.
- `src/ui/Hud.tsx`: two-tier combat HUD.
- `src/ui/GameCanvas.tsx`: pointer capture wired to the floating joystick.
- `src/App.css`: mobile HUD layout and safe-area behavior.

---

### Task 1: Floating Joystick Input

**Files:**
- Modify: `src/game/input.ts`
- Modify: `src/game/input.test.ts`
- Modify: `src/ui/GameCanvas.tsx`
- Modify: `src/ui/GameCanvas.test.ts`
- Modify: `src/game/engine.test.ts`
- Modify: `src/tests/playthrough.ts`
- Modify: `src/tests/performance-budget.test.ts`

**Interfaces:**
- Produces: `PointerInput.start(pointer: Vec2)`, `move(pointer: Vec2)`, `end()`, `cancel()`, and `snapshot(): MovementIntent`.
- Produces: `MovementIntent` with normalized `direction` and `strength` in `[0, 1]`.
- Consumed by: Task 2 motion integration and existing `ProtoCellEngine.input`.

- [ ] **Step 1: Write the failing origin-relative input tests**

```ts
it('uses the pointer-down location as the joystick origin', () => {
  const input = createPointerInput({ deadZone: 12, fullStrengthDistance: 96 })
  input.start({ x: 300, y: 600 })
  input.move({ x: 348, y: 600 })

  expect(input.snapshot()).toEqual({ direction: { x: 1, y: 0 }, strength: 0.5 })
})

it('clears movement after release and cancellation', () => {
  const input = createPointerInput({ deadZone: 12, fullStrengthDistance: 96 })
  input.start({ x: 40, y: 50 })
  input.move({ x: 40, y: 146 })
  input.end()
  expect(input.snapshot().strength).toBe(0)
  input.start({ x: 40, y: 50 })
  input.move({ x: 136, y: 50 })
  input.cancel()
  expect(input.snapshot().strength).toBe(0)
})
```

- [ ] **Step 2: Run the focused tests and verify the interface mismatch fails**

Run: `pnpm test -- src/game/input.test.ts src/ui/GameCanvas.test.ts`

Expected: FAIL because `start` and `move` still require `playerScreenPosition`, and displacement is measured from the rendered player rather than the pointer-down origin.

- [ ] **Step 3: Implement the floating joystick state**

```ts
export function createPointerInput(options: { deadZone?: number; fullStrengthDistance?: number } = {}): PointerInput {
  const deadZone = options.deadZone ?? 12
  const fullStrengthDistance = options.fullStrengthDistance ?? 96
  let origin: Vec2 | undefined
  let intent = ZERO_INTENT

  const update = (pointer: Vec2) => {
    if (!origin) return
    const displacement = { x: pointer.x - origin.x, y: pointer.y - origin.y }
    const distance = length(displacement)
    intent = distance <= deadZone ? ZERO_INTENT : {
      direction: normalize(displacement),
      strength: Math.min(1, distance / fullStrengthDistance),
    }
  }

  return {
    start(pointer) { origin = { ...pointer }; intent = ZERO_INTENT },
    move: update,
    end() { origin = undefined; intent = ZERO_INTENT },
    cancel() { origin = undefined; intent = ZERO_INTENT },
    snapshot: () => ({ direction: { ...intent.direction }, strength: intent.strength }),
  }
}
```

Update `GameCanvas` so pointer down calls `engine.input.start({ x: event.clientX, y: event.clientY })` and pointer move calls `engine.input.move(...)`. Remove `playerScreenPosition()` from the input path; keep the renderer method only if another caller still needs it. Update engine tests, the headless policy, and the performance harness to call `start({ x: 0, y: 0 })` once before their first programmatic `move(...)` and to pass only the absolute pointer vector thereafter.

- [ ] **Step 4: Run focused tests and the existing input/canvas suite**

Run: `pnpm test -- src/game/input.test.ts src/ui/GameCanvas.test.ts src/game/engine.test.ts src/tests/playthrough.test.ts src/tests/performance-budget.test.ts`

Expected: PASS; pointer cancellation, capture loss, and resize still clear movement.

- [ ] **Step 5: Commit the floating joystick**

```bash
git add projects/09-proto-cell/src/game/input.ts projects/09-proto-cell/src/game/input.test.ts projects/09-proto-cell/src/ui/GameCanvas.tsx projects/09-proto-cell/src/ui/GameCanvas.test.ts projects/09-proto-cell/src/game/engine.test.ts projects/09-proto-cell/src/tests/playthrough.ts projects/09-proto-cell/src/tests/performance-budget.test.ts
git commit -m "feat(proto-cell): add floating movement joystick"
```

### Task 2: Responsive Motion and Soft Boundaries

**Files:**
- Create: `src/game/motion.ts`
- Create: `src/game/motion.test.ts`
- Modify: `src/game/bounds.ts`
- Modify: `src/game/bounds.test.ts`
- Modify: `src/game/engine.ts`
- Modify: `src/game/engine.test.ts`

**Interfaces:**
- Consumes: `MovementIntent` from Task 1.
- Produces: `advanceVelocity(current, intent, maxSpeed, elapsedMs): Vec2`.
- Produces: `applySoftBoundary(position, velocity, world, radius): { position: Vec2; velocity: Vec2; steering: Vec2 }`.
- Consumed by: `createGameEngine().moveEntities()`.

- [ ] **Step 1: Write failing deterministic motion tests**

```ts
it('reaches at least 60% speed within 180ms', () => {
  const velocity = advanceVelocity({ x: 0, y: 0 }, { direction: { x: 1, y: 0 }, strength: 1 }, 100, 180)
  expect(velocity.x).toBeGreaterThanOrEqual(60)
  expect(velocity.y).toBe(0)
})

it('reverses without retaining a forward lock', () => {
  const velocity = advanceVelocity({ x: 80, y: 0 }, { direction: { x: -1, y: 0 }, strength: 1 }, 100, 260)
  expect(velocity.x).toBeLessThan(0)
})

it('steers inward before the hard world edge', () => {
  const result = applySoftBoundary({ x: 28, y: 400 }, { x: -80, y: 0 }, { width: 640, height: 1100, softZone: 72 }, 18)
  expect(result.steering.x).toBeGreaterThan(0)
  expect(result.position.x).toBeGreaterThanOrEqual(18)
})
```

- [ ] **Step 2: Run focused tests and verify missing modules fail**

Run: `pnpm test -- src/game/motion.test.ts src/game/bounds.test.ts`

Expected: FAIL because `advanceVelocity` and `applySoftBoundary` do not exist.

- [ ] **Step 3: Implement the response curve and soft edge force**

```ts
export function advanceVelocity(current: Vec2, intent: MovementIntent, maxSpeed: number, elapsedMs: number): Vec2 {
  const target = { x: intent.direction.x * intent.strength * maxSpeed, y: intent.direction.y * intent.strength * maxSpeed }
  const opposing = current.x * target.x + current.y * target.y < 0
  const responseMs = intent.strength === 0 ? 320 : opposing ? 120 : 180
  const blend = 1 - Math.exp(-Math.max(0, elapsedMs) / responseMs)
  return { x: current.x + (target.x - current.x) * blend, y: current.y + (target.y - current.y) * blend }
}
```

Implement `applySoftBoundary` with a 72px default influence band. Add inward steering before the edge, preserve tangential velocity, and retain `constrainWorldMotion` as a final finite-world safety clamp.

- [ ] **Step 4: Integrate motion into the engine**

Replace the inline acceleration blend in `moveEntities()` with `advanceVelocity`. Add `fieldSample.flow` after the response curve, then pass desired motion through `applySoftBoundary` and `resolveEnvironmentMovement`. Do not modify AI intent semantics in this task.

- [ ] **Step 5: Run motion, bounds, and engine tests**

Run: `pnpm test -- src/game/motion.test.ts src/game/bounds.test.ts src/game/engine.test.ts`

Expected: PASS, including an engine test that advances a player into every corner for 300 fixed steps and asserts finite position plus nonzero tangential escape velocity.

- [ ] **Step 6: Commit responsive motion**

```bash
git add projects/09-proto-cell/src/game/motion.ts projects/09-proto-cell/src/game/motion.test.ts projects/09-proto-cell/src/game/bounds.ts projects/09-proto-cell/src/game/bounds.test.ts projects/09-proto-cell/src/game/engine.ts projects/09-proto-cell/src/game/engine.test.ts
git commit -m "feat(proto-cell): tune responsive liquid movement"
```

### Task 3: Forward-Looking Stage Camera

**Files:**
- Create: `src/rendering/camera.ts`
- Modify: `src/rendering/camera.test.ts`
- Modify: `src/rendering/renderer.ts`
- Modify: `src/game/engine.ts`

**Interfaces:**
- Produces: `BodyStage = 'microbe' | 'hunter' | 'specialist' | 'dominant' | 'ascendant'` in `game/engine.ts` until the evolution plan moves it to `evolution/build.ts`.
- Produces: `createCameraTracker().update(player: Pick<EntityState, 'position' | 'velocity'> & { radius: number }, viewport, stage, elapsedMs): CameraFrame`.
- Produces: `CameraFrame = { center: Vec2; zoom: number; anchor: Vec2 }`.
- Consumed by: `createCanvasRenderer`.

- [ ] **Step 1: Replace radius-zoom tests with stage-camera tests**

```ts
it('uses a lower player anchor and looks ahead along velocity', () => {
  const tracker = createCameraTracker()
  tracker.update({ position: { x: 100, y: 300 }, velocity: { x: 0, y: 0 }, radius: 18 }, { width: 390, height: 844 }, 'microbe', 0)
  const frame = tracker.update({ position: { x: 110, y: 300 }, velocity: { x: 100, y: 0 }, radius: 18 }, { width: 390, height: 844 }, 'microbe', 16)
  expect(frame.center.x).toBeGreaterThan(100)
  expect(frame.anchor).toEqual({ x: 195, y: 489.52 })
})

it('changes zoom only when body stage changes', () => {
  const tracker = createCameraTracker()
  const viewport = { width: 390, height: 844 }
  const small = tracker.update({ position: { x: 100, y: 300 }, velocity: { x: 0, y: 0 }, radius: 18 }, viewport, 'microbe', 0)
  const largerRadius = tracker.update({ position: { x: 100, y: 300 }, velocity: { x: 0, y: 0 }, radius: 34 }, viewport, 'microbe', 16)
  const evolved = tracker.update({ position: { x: 100, y: 300 }, velocity: { x: 0, y: 0 }, radius: 34 }, viewport, 'hunter', 32)
  expect(largerRadius.zoom).toBe(small.zoom)
  expect(evolved.zoom).toBeLessThan(small.zoom)
})
```

- [ ] **Step 2: Run the camera test and verify continuous zoom fails**

Run: `pnpm test -- src/rendering/camera.test.ts`

Expected: FAIL because the current renderer targets `42 / radius` and always projects around the exact viewport center.

- [ ] **Step 3: Extract and implement the camera module**

Use exact zoom targets `{ microbe: 2.6, hunter: 2.3, specialist: 2.05, dominant: 1.82, ascendant: 1.65 }`. Use viewport anchor `{ x: width * 0.5, y: height * 0.58 }`; cap forward look to 64 world units and smoothly follow over 125ms. Snap after teleports over 240 world units.

- [ ] **Step 4: Feed a provisional body stage through `WorldRenderSnapshot`**

Derive the provisional stage from route index, not radius: stage indices `0, 1, 2, 3, >=4` map in order to the five values. The evolution plan will replace this derivation with authoritative player morphology while keeping the same snapshot field.

- [ ] **Step 5: Run camera and renderer tests**

Run: `pnpm test -- src/rendering/camera.test.ts src/rendering/cell.test.ts src/rendering/effects.test.ts`

Expected: PASS; world textures remain anchored to camera movement, teleports snap, and radius changes within a stage do not alter zoom.

- [ ] **Step 6: Commit the camera seam**

```bash
git add projects/09-proto-cell/src/rendering/camera.ts projects/09-proto-cell/src/rendering/camera.test.ts projects/09-proto-cell/src/rendering/renderer.ts projects/09-proto-cell/src/game/engine.ts
git commit -m "feat(proto-cell): add stage based forward camera"
```

### Task 4: Arcade Cell Readability and Combat Feedback

**Files:**
- Create: `src/rendering/feedback.ts`
- Create: `src/rendering/feedback.test.ts`
- Modify: `src/rendering/cell.ts`
- Modify: `src/rendering/cell.test.ts`
- Modify: `src/rendering/renderer.ts`
- Modify: `src/rendering/numbers.ts`
- Modify: `src/rendering/numbers.test.ts`
- Modify: `src/ui/GameCanvas.tsx`

**Interfaces:**
- Produces: `relationshipCue(player, target): 'edible' | 'danger' | 'neutral'`.
- Produces: `EngulfFeedback = { preyName: string; biomass: number; chain: number; atMs: number }` through `NumberFeed`.
- Consumes: existing containment ratio and content definition names.

- [ ] **Step 1: Write failing relationship and chain tests**

```ts
it('marks a clearly smaller target edible and a larger target dangerous', () => {
  expect(relationshipCue(entity('large', 20), entity('prey', 10))).toBe('edible')
  expect(relationshipCue(entity('large', 10), entity('prey', 20))).toBe('danger')
})

it('continues an engulf chain inside 1400ms and resets after the window', () => {
  const feed = createNumberFeed({ aggregateMs: 180, maxVisible: 8, chainWindowMs: 1400 })
  feed.push({ kind: 'biomass', amount: 12, entityId: 'player', label: '藻光粒', atMs: 100 })
  feed.push({ kind: 'biomass', amount: 8, entityId: 'player', label: '藻光粒', atMs: 900 })
  expect(feed.visible().at(-1)).toMatchObject({ chain: 2, label: '藻光粒' })
  feed.push({ kind: 'biomass', amount: 5, entityId: 'player', label: '蛋白颗粒', atMs: 2500 })
  expect(feed.visible().at(-1)).toMatchObject({ chain: 1, label: '蛋白颗粒' })
})
```

- [ ] **Step 2: Run focused tests and verify missing presentation behavior fails**

Run: `pnpm test -- src/rendering/feedback.test.ts src/rendering/numbers.test.ts src/rendering/cell.test.ts`

Expected: FAIL because there is no relationship cue, label, or independent chain window.

- [ ] **Step 3: Implement relationship cues and named chain data**

Use a mass ratio of `1.18` for an unambiguous pre-contact cue. Render edible targets with a cyan-white solid halo and dangerous targets with a coral segmented halo plus outward ticks. Neutral targets receive no halo.

Extend `NumberEffectInput` with `label?: string` and `createNumberFeed` with `chainWindowMs`. Aggregate raw numbers only inside `aggregateMs`; compute engulf chain across separate effects inside `chainWindowMs`.

- [ ] **Step 4: Restyle cell drawing without changing entity rules**

Increase the outer membrane stroke to `max(2.5, radius * 0.11)`, use three discrete tone bands rather than low-opacity cytoplasm, add a dark offset shadow, and preserve distinct silhouettes for prey, competitor, scavenger, predator, elite, and boss. Keep generated geometry original and retain reduced-motion semantics.

- [ ] **Step 5: Attach content names to engulf events in `GameCanvas`**

Resolve `event.preyDefinitionId` through `content.json`, pass the localized name into `numbers.push`, and render `吞下{name} +{amount}` with `×{chain}` when chain is greater than one.

- [ ] **Step 6: Run rendering tests**

Run: `pnpm test -- src/rendering/feedback.test.ts src/rendering/numbers.test.ts src/rendering/cell.test.ts src/ui/GameCanvas.test.ts`

Expected: PASS, including reduced-flash cue assertions and chain reset behavior.

- [ ] **Step 7: Commit combat readability**

```bash
git add projects/09-proto-cell/src/rendering/feedback.ts projects/09-proto-cell/src/rendering/feedback.test.ts projects/09-proto-cell/src/rendering/cell.ts projects/09-proto-cell/src/rendering/cell.test.ts projects/09-proto-cell/src/rendering/renderer.ts projects/09-proto-cell/src/rendering/numbers.ts projects/09-proto-cell/src/rendering/numbers.test.ts projects/09-proto-cell/src/ui/GameCanvas.tsx
git commit -m "feat(proto-cell): amplify combat readability"
```

### Task 5: Two-Tier HUD and Mobile Feel Gate

**Files:**
- Modify: `src/game/engine.ts`
- Modify: `src/app/view-model.ts`
- Modify: `src/app/view-model.test.ts`
- Modify: `src/ui/Hud.tsx`
- Modify: `src/ui/Hud.test.tsx`
- Modify: `src/App.css`
- Modify: `src/content/content.json`
- Modify: `src/content/content.test.ts`

**Interfaces:**
- Produces: `HudSnapshot.engulfScore`, `journeyIndex`, `journeyTotal`, `bodyStage`, `bodyStageProgress`, and `membraneRatio`.
- Consumed by: `Hud` and later run/evolution plans.

- [ ] **Step 1: Write the failing HUD contract test**

```tsx
it('renders score, journey, body stage, progress, membrane, and pause only', () => {
  const html = renderToString(<Hud snapshot={{
    membrane: 82, energy: 100, stability: 100, biomass: 144, peakBiomass: 144,
    evolutionThreshold: 240, elapsedMs: 0, environmentId: 'env-clear-drop', paused: false,
    engulfScore: 6528, journeyIndex: 1, journeyTotal: 6, bodyStage: 'microbe',
    bodyStageProgress: 0.32, membraneRatio: 0.82,
  }} onPause={() => undefined} />)
  expect(html).toContain('6528')
  expect(html).toContain('01/06')
  expect(html).toContain('微生体')
  expect(html).toContain('82%')
  expect(html).not.toContain('能量')
  expect(html).not.toContain('稳定度')
})
```

- [ ] **Step 2: Run the HUD tests and verify the old four-metric layout fails**

Run: `pnpm test -- src/ui/Hud.test.tsx src/app/view-model.test.ts`

Expected: FAIL because the current HUD renders membrane, energy, stability, and biomass as equal metrics and lacks journey/body-stage fields.

- [ ] **Step 3: Add transitional HUD snapshot values**

Track `engulfScore` by summing player engulf biomass. Until the run director exists, map the current route index to `journeyIndex`, use `journeyTotal: 6`, use the provisional body stage from Task 3, and derive `bodyStageProgress` from current biomass divided by the next evolution threshold.

- [ ] **Step 4: Implement the two-tier DOM and safe-area CSS**

Use semantic `dl` values for score and journey, a second row for body stage/progress and membrane ratio, and retain the 44px pause target. Position with `top: calc(var(--safe-area-inset-top, env(safe-area-inset-top, 0px)) + 10px)`. Keep all interactive HUD controls reachable at 375px width without horizontal scrolling.

- [ ] **Step 5: Run unit and full project checks**

Run: `pnpm test -- src/ui/Hud.test.tsx src/app/view-model.test.ts src/content/content.test.ts`

Expected: PASS.

Run: `pnpm lint && pnpm test && pnpm build`

Expected: lint exits 0, all Vitest files pass, and Vite production build exits 0.

- [ ] **Step 6: Run the real-browser feel gate**

Start: `pnpm preview --host 127.0.0.1 --port 4199`

Using the Playwright CLI, verify at `375x812`, `390x844`, and `430x932` with `--safe-area-inset-top: 44px`:

- pointer down at `(195, 620)` and drag to `(291, 620)` produces full rightward movement;
- release stops input and leaves only brief engine drift;
- the player remains near 58% viewport height while the world and at least two parallax layers move;
- all top HUD bounds start below 44px and `document.documentElement.scrollWidth === innerWidth`;
- repeated movement into all four edges leaves the player movable;
- an edible and dangerous target use different non-color-only outlines;
- console error count is zero.

- [ ] **Step 7: Commit the playable core-feel slice**

```bash
git add projects/09-proto-cell/src/game/engine.ts projects/09-proto-cell/src/app/view-model.ts projects/09-proto-cell/src/app/view-model.test.ts projects/09-proto-cell/src/ui/Hud.tsx projects/09-proto-cell/src/ui/Hud.test.tsx projects/09-proto-cell/src/App.css projects/09-proto-cell/src/content/content.json projects/09-proto-cell/src/content/content.test.ts
git commit -m "feat(proto-cell): ship core feel vertical slice"
```

## Phase Completion Gate

The phase is complete only when the original game remains fully playable, movement is origin-relative and responsive, no corner can trap the player, camera motion is visibly world-relative, combat relationships are readable, and the two-tier HUD passes all three mobile viewport checks. Do not begin the ecology plan with a failing full project gate.
