# Star-Borne Letter Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the phrase wheel and opening sash with a one-click scene where a top-down gust reveals a bright fixed moonlit opening, stars and individual characters blow into the room, the sentence assembles in the foreground, and curtain/star motion continues indefinitely.

**Architecture:** Keep one React-owned monotonic clock and derive finite narrative stages plus unbounded result time from it. SVG owns the fixed frame, moonlight and 64 strand curtain; Canvas owns a bounded, continuously replenished particle world; a DOM character layer owns deterministic letter-flight transforms and the accessible final sentence. Each moving subsystem consumes the same `TimelineSample`, so pause, reduced motion and replay remain synchronized.

**Tech Stack:** React 19, TypeScript 6, Vite 8, SVG, Canvas 2D, Vitest, Playwright CLI; no new dependencies.

**Spec:** `projects/10-starwind-letter/STARWIND_REDESIGN.md`

## Global Constraints

- Modify only `projects/10-starwind-letter`; do not edit the root package files, lockfile, `docs/`, `prep/`, or another project.
- Pure static frontend: no backend, runtime CDN, required external API, Service Worker, Node runtime API, or unconfirmed device API.
- Business copy remains in `src/content/content.json`; do not persist user images, Base64, audio/video, or Blob data.
- Do not add dependencies.
- Preserve one-click selection, recent-result deduplication, sound failure fallback, visibility pause/resume, replay locking and reduced-motion support.
- Every top fixed control and anchor must include `var(--safe-area-inset-top, env(safe-area-inset-top, 0px))` and be verified with a non-zero simulated safe area.
- Final verification must run from the project directory: `pnpm --ignore-workspace lint`, `pnpm --ignore-workspace test`, and `pnpm --ignore-workspace build`.
- Visual QA must cover 375×812, 390×844 and 430×932 CSS px, plus a 390×844 viewport with a 32px simulated top safe area.

---

## File Structure

### Create

- `src/ui/letterFlight.ts` — pure deterministic sampling of per-character flight and settling geometry.
- `src/ui/letterFlight.test.ts` — trajectory, stagger, final ordering and reduced-motion tests.
- `src/ui/StarbornePhrase.tsx` — DOM character flight layer and accessible final phrase.
- `src/ui/StarbornePhrase.test.tsx` — semantic and rendered-state tests.

### Modify

- `src/experience/machine.ts` / `.test.ts` — replace phrase-wheel/window states with the approved state sequence.
- `src/experience/timeline.ts` / `.test.ts` — finite narrative timing plus unbounded `resultElapsedMs`.
- `src/scene/geometry.ts` / `.test.ts` — remove sash projection and define two rail-separated moonlight polygons while preserving portal crossing geometry.
- `src/scene/WindowLayer.tsx` / `.test.tsx` — render a fixed frame, clean crescent and split moonlight; remove sash/glass/opening markup and props.
- `src/scene/curtain.ts` / `.test.ts` — sample top-to-bottom opening phases and persistent wind displacement.
- `src/scene/CurtainLayer.tsx` / `.test.tsx` — map timeline stages to the new curtain sample and prove result motion never freezes.
- `src/particles/system.ts` / `.test.ts` — prune expired particles, emit bounded result batches and reset counters.
- `src/particles/ParticleCanvases.tsx` — pass continuous-result timing to the particle system.
- `src/scene/Scene.tsx` — derive fixed-window reveal strength and compose the new character layer.
- `src/App.tsx` / `src/App.css` — remove wheel behavior, start selection directly on click, keep RAF alive in result, style the new foreground phrase.
- `DESIGN.md`, `UX_SPEC.md`, `MOTION_SPEC.md`, `VISUAL_REFERENCE.md`, `VISUAL_QA.md`, `README.md` — align old documentation with the approved spec and record fresh evidence.
- `release-assets/*.png` — replace QA screenshots with the new narrative states.

### Delete after replacements pass

- `src/ui/PhraseCarousel.tsx`
- `src/ui/PhraseCarousel.test.tsx`

Deletion is part of the approved removal of the phrase-wheel feature; its behavioral coverage is replaced by `StarbornePhrase.test.tsx`, state-machine tests and browser QA, not dropped merely to make checks pass.

---

### Task 1: Simplify the State Machine and Keep Result Time Running

**Files:**
- Modify: `src/experience/machine.test.ts`
- Modify: `src/experience/machine.ts`
- Modify: `src/experience/timeline.test.ts`
- Modify: `src/experience/timeline.ts`

**Interfaces:**
- Produces: `ExperienceState` tags `idle | wind | curtain-opening | stars-and-letters | result | resetting`.
- Produces: `transition(state, { type: 'begin'; messageId })` for the only idle click.
- Produces: `TimelineSample` fields `stage`, `stageProgress`, `totalProgress`, `elapsedMs`, `narrativeElapsedMs`, `resultElapsedMs`.
- Produces: `timelineDuration(reducedMotion)` with full duration 6500ms and reduced duration 3000ms.
- Consumed later by: `App`, `Scene`, `CurtainLayer`, `ParticleCanvases`, `StarbornePhrase`.

- [ ] **Step 1: Replace the state-machine expectations with the approved flow**

```ts
it('starts once and advances only through the wind narrative', () => {
  const idle = { tag: 'idle', run: 0 } as const
  const wind = transition(idle, { type: 'begin', messageId: 'calm-01' })
  expect(wind).toEqual({ tag: 'wind', run: 0, messageId: 'calm-01' })
  expect(transition(wind, { type: 'begin', messageId: 'hope-01' })).toBe(wind)

  const curtain = transition(wind, { type: 'advance' })
  const stars = transition(curtain, { type: 'advance' })
  const result = transition(stars, { type: 'advance' })
  expect([curtain.tag, stars.tag, result.tag]).toEqual([
    'curtain-opening', 'stars-and-letters', 'result',
  ])
})

it('returns to idle only after reset completes', () => {
  const result = { tag: 'result', run: 4, messageId: 'dream-12' } as const
  const resetting = transition(result, { type: 'replay' })
  expect(transition(resetting, { type: 'reset-complete' })).toEqual({ tag: 'idle', run: 5 })
})
```

- [ ] **Step 2: Run the focused machine test and verify RED**

Run: `pnpm --ignore-workspace exec vitest run src/experience/machine.test.ts --maxWorkers=1`

Expected: FAIL because `idle`, `begin`, `curtain-opening`, and `stars-and-letters` are not defined.

- [ ] **Step 3: Implement the minimal state union and transition table**

```ts
export type AnimatedTag = 'wind' | 'curtain-opening' | 'stars-and-letters' | 'result'

export type ExperienceState =
  | { readonly tag: 'idle'; readonly run: number }
  | { readonly tag: AnimatedTag; readonly run: number; readonly messageId: string }
  | { readonly tag: 'resetting'; readonly run: number; readonly previousMessageId: string }

export type ExperienceEvent =
  | { readonly type: 'begin'; readonly messageId: string }
  | { readonly type: 'advance' }
  | { readonly type: 'replay' }
  | { readonly type: 'reset-complete' }

const nextAnimatedTag: Partial<Record<AnimatedTag, AnimatedTag>> = {
  wind: 'curtain-opening',
  'curtain-opening': 'stars-and-letters',
  'stars-and-letters': 'result',
}
```

Implement `transition` so only `idle + begin`, the three documented advances, `result + replay`, and `resetting + reset-complete` change state.

- [ ] **Step 4: Add timeline tests for finite stages and unbounded result time**

```ts
it.each([
  [0, 'wind'],
  [299, 'wind'],
  [300, 'curtain-opening'],
  [1799, 'curtain-opening'],
  [1800, 'stars-and-letters'],
  [6499, 'stars-and-letters'],
  [6500, 'result'],
  [66_500, 'result'],
] as const)('maps %dms to %s', (elapsedMs, stage) => {
  expect(sampleTimeline(elapsedMs, false).stage).toBe(stage)
})

it('preserves unbounded result time while clamping narrative progress', () => {
  expect(sampleTimeline(66_500, false)).toMatchObject({
    stage: 'result',
    totalProgress: 1,
    narrativeElapsedMs: 6500,
    resultElapsedMs: 60_000,
    elapsedMs: 66_500,
  })
})
```

- [ ] **Step 5: Run the timeline test and verify RED**

Run: `pnpm --ignore-workspace exec vitest run src/experience/timeline.test.ts --maxWorkers=1`

Expected: FAIL because the old timeline begins at `slowing`, lasts 8800ms and clamps `elapsedMs`.

- [ ] **Step 6: Implement the new timeline sample**

```ts
export type TimelineStage =
  | 'wind'
  | 'curtain-opening'
  | 'stars-and-letters'
  | 'resetting'
  | 'result'

export interface TimelineSample {
  readonly stage: TimelineStage
  readonly stageProgress: number
  readonly totalProgress: number
  readonly elapsedMs: number
  readonly narrativeElapsedMs: number
  readonly resultElapsedMs: number
}

const fullDurations = [300, 1500, 4700] as const
const reducedDurations = [200, 900, 1900] as const
```

`sampleTimeline` must keep `elapsedMs = Math.max(0, elapsedMs)`, clamp only `narrativeElapsedMs`, and return `resultElapsedMs = Math.max(0, elapsedMs - total)`. `resetSceneSample(1)` must return a stable `wind` sample at zero; `resetSceneSample(0)` must return the finite result boundary, not an arbitrarily old result.

- [ ] **Step 7: Run machine and timeline tests GREEN**

Run: `pnpm --ignore-workspace exec vitest run src/experience/machine.test.ts src/experience/timeline.test.ts --maxWorkers=1`

Expected: both files PASS.

- [ ] **Step 8: Commit Task 1**

```bash
git add projects/10-starwind-letter/src/experience
git commit -m "refactor(starwind-letter): simplify wind narrative states"
```

---

### Task 2: Replace the Sash with a Fixed Moonlit Opening and Split Floor Light

**Files:**
- Modify: `src/scene/geometry.test.ts`
- Modify: `src/scene/geometry.ts`
- Modify: `src/scene/WindowLayer.test.tsx`
- Modify: `src/scene/WindowLayer.tsx`

**Interfaces:**
- Preserves: `WINDOW_PORTAL`, `pointInConvexQuad`, `crossesPortal`, `quadPoints` for particles.
- Removes: `projectSash`, sash slices, sash state and open/shake props.
- Produces: `splitMoonlightPolygons(revealProgress): readonly [Quad, Quad]`.
- Produces: `<WindowLayer revealProgress={number} />`.

- [ ] **Step 1: Replace sash geometry tests with split-moonlight geometry tests**

```ts
it('projects two rail-separated moonlight shapes into the room', () => {
  const [nearBeam, farBeam] = splitMoonlightPolygons(1)
  expect(nearBeam.topLeft.y).toBeGreaterThan(WINDOW_PORTAL.bottomLeft.y)
  expect(farBeam.bottomLeft.y).toBeLessThan(nearBeam.topLeft.y)
  expect(nearBeam.bottomLeft.x).toBeLessThan(WINDOW_PORTAL.bottomLeft.x)
  expect(nearBeam.topLeft.y - farBeam.bottomLeft.y).toBeGreaterThan(8)
})
```

- [ ] **Step 2: Run geometry test and verify RED**

Run: `pnpm --ignore-workspace exec vitest run src/scene/geometry.test.ts --maxWorkers=1`

Expected: FAIL because `splitMoonlightPolygons` does not exist.

- [ ] **Step 3: Implement fixed beam geometry and remove sash projection**

```ts
export function splitMoonlightPolygons(revealProgress: number): readonly [Quad, Quad] {
  const amount = smoothstep(clamp(revealProgress))
  const railGap = 12 + amount * 8
  return [
    {
      topLeft: { x: 176, y: 548 + railGap },
      topRight: { x: 348, y: 486 },
      bottomRight: { x: 374, y: 596 },
      bottomLeft: { x: 28, y: 758 },
    },
    {
      topLeft: { x: 214, y: 438 },
      topRight: { x: 348, y: 486 },
      bottomRight: { x: 312, y: 540 },
      bottomLeft: { x: 188, y: 552 - railGap },
    },
  ]
}
```

Use these exact points for the first browser build. Any later visual correction in Task 7 must keep the tested dark gap greater than 8 design units and the near beam extending left of the portal. Delete `projectSash` after the focused geometry test is green and `rg -n "projectSash" src` returns only the removal diff.

- [ ] **Step 4: Replace WindowLayer markup tests**

```tsx
it('renders a fixed frame, clear crescent, and two moonlight planes without a sash', () => {
  const html = renderToStaticMarkup(<WindowLayer revealProgress={1} />)
  expect(html).toContain('data-window-state="fixed"')
  expect(html).toContain('data-layer="fixed-window-frame"')
  expect(html).toContain('data-layer="moon-crescent"')
  expect(html.match(/data-layer="moonlight-plane"/g)).toHaveLength(2)
  expect(html).not.toContain('data-layer="window-sash"')
  expect(html).not.toContain('window-handle')
})

it('keeps the room dark before the curtain reveal', () => {
  const html = renderToStaticMarkup(<WindowLayer revealProgress={0} />)
  expect(html).toContain('data-interior-light="dark"')
})
```

- [ ] **Step 5: Run WindowLayer test and verify RED**

Run: `pnpm --ignore-workspace exec vitest run src/scene/WindowLayer.test.tsx --maxWorkers=1`

Expected: FAIL because the component still requires `openProgress`/`shakeProgress` and renders the sash.

- [ ] **Step 6: Implement the fixed frame and light reveal**

Change the public props to:

```ts
interface WindowLayerProps {
  readonly revealProgress: number
}
```

Keep the existing perspective frame polyline and central rail, but remove the sash group, glass-darkening overlay, handle, hinge dots, shadow polygon and shake transform. Render the moon with separate crisp and bloom shapes:

```tsx
<g data-layer="moon-crescent" opacity={0.22 + light * 0.78}>
  <circle cx="278" cy="235" r="28" fill="#fbfdff" mask={`url(#${ids}-crescent)`} />
  <circle cx="278" cy="235" r="34" fill="#b9ccff" opacity={0.28} filter={`url(#${ids}-bloom)`} />
</g>
```

Render `splitMoonlightPolygons(revealProgress)` as exactly two `data-layer="moonlight-plane"` polygons with soft gradients and no stroke. Keep `WINDOW_PORTAL` as the star clipping region.

- [ ] **Step 7: Run geometry and WindowLayer tests GREEN**

Run: `pnpm --ignore-workspace exec vitest run src/scene/geometry.test.ts src/scene/WindowLayer.test.tsx --maxWorkers=1`

Expected: both files PASS.

- [ ] **Step 8: Commit Task 2**

```bash
git add projects/10-starwind-letter/src/scene/geometry.ts projects/10-starwind-letter/src/scene/geometry.test.ts projects/10-starwind-letter/src/scene/WindowLayer.tsx projects/10-starwind-letter/src/scene/WindowLayer.test.tsx
git commit -m "feat(starwind-letter): reveal a fixed moonlit opening"
```

---

### Task 3: Make the Curtain Open Top-to-Bottom and Move Forever

**Files:**
- Modify: `src/scene/curtain.test.ts`
- Modify: `src/scene/curtain.ts`
- Modify: `src/scene/CurtainLayer.test.tsx`
- Modify: `src/scene/CurtainLayer.tsx`

**Interfaces:**
- Produces: `sampleCurtainPath(strand, openingProgress, timeMs, ambientStrength): CurtainPath`.
- Produces: `curtainSegmentProgress(openingProgress, verticalDelay): number` for explicit propagation tests.
- Consumes: new `TimelineSample` from Task 1.

- [ ] **Step 1: Add a failing top-down propagation test**

```ts
it('moves the top and upper curve before the curtain tail', () => {
  const strand = createCurtainStrands(64, createMulberry32(0x51a7))[32]!
  const resting = sampleCurtainPath(strand, 0, 0, 0)
  const early = sampleCurtainPath(strand, 0.28, 0, 0)
  const topShift = Math.abs(early.start.x - resting.start.x)
  const tailShift = Math.abs(early.end.x - resting.end.x)

  expect(topShift).toBeGreaterThan(12)
  expect(tailShift).toBeLessThan(topShift * 0.55)
})
```

- [ ] **Step 2: Add a failing persistent-wind test**

```ts
it('keeps a fully opened curtain moving under ambient wind', () => {
  const strand = createCurtainStrands(64, createMulberry32(0x51a7))[18]!
  const first = sampleCurtainPath(strand, 1, 7000, 0.36)
  const later = sampleCurtainPath(strand, 1, 8200, 0.36)
  expect(Math.abs(first.end.x - later.end.x)).toBeGreaterThan(1.5)
  expect(Math.abs(first.control2.y - later.control2.y)).toBeGreaterThan(0.8)
})
```

- [ ] **Step 3: Run curtain tests and verify RED**

Run: `pnpm --ignore-workspace exec vitest run src/scene/curtain.test.ts --maxWorkers=1`

Expected: FAIL because the old single gather value moves the whole cubic path together and result time is frozen.

- [ ] **Step 4: Implement per-segment propagation and ambient motion**

```ts
export function curtainSegmentProgress(openingProgress: number, verticalDelay: number) {
  return easeInOut(clamp((openingProgress - verticalDelay) / Math.max(0.01, 1 - verticalDelay)))
}

const topOpen = curtainSegmentProgress(openingProgress, 0)
const upperOpen = curtainSegmentProgress(openingProgress, 0.1)
const lowerOpen = curtainSegmentProgress(openingProgress, 0.24)
const tailOpen = curtainSegmentProgress(openingProgress, 0.42)
const ambientX = Math.sin(timeMs / 920 + strand.phase) * ambientStrength * 12
const ambientY = Math.cos(timeMs / 1280 + strand.phase * 0.7) * ambientStrength * 5
```

Use `topOpen`, `upperOpen`, `lowerOpen`, and `tailOpen` independently when mixing the resting and gathered `start`, `control1`, `control2`, and `end`. Add 100% of `ambientX/Y` to the tail, 45% to `control2`, 16% to `control1`, and 5% to the gathered top. Preserve individual strand delays and brightness.

- [ ] **Step 5: Add CurtainLayer integration assertions**

```tsx
it('changes result curtain geometry as result time advances', () => {
  const atStart = firstPathNumbers(sampleTimeline(6500, false))
  const afterGust = firstPathNumbers(sampleTimeline(8200, false))
  expect(Math.max(...atStart.map((value, index) => Math.abs(value - afterGust[index]!)))).toBeGreaterThan(1.5)
})

it('restores resting geometry at the end of reset', () => {
  const resting = firstPathNumbers(sampleTimeline(0, false))
  const reset = firstPathNumbers(resetSceneSample(0.999))
  expect(Math.max(...resting.map((value, index) => Math.abs(value - reset[index]!)))).toBeLessThan(2)
})
```

- [ ] **Step 6: Map timeline stages to opening and ambient strength**

Use these exact narrative mappings as the first implementation:

```ts
function curtainMotion(sample: TimelineSample) {
  switch (sample.stage) {
    case 'wind': return { opening: sample.stageProgress * 0.12, ambient: 0.08 }
    case 'curtain-opening': return { opening: 0.12 + sample.stageProgress * 0.88, ambient: 0.18 + sample.stageProgress * 0.28 }
    case 'stars-and-letters': return { opening: 1, ambient: 0.42 }
    case 'result': return { opening: 1, ambient: 0.32 + Math.sin(sample.resultElapsedMs / 1700) * 0.1 }
    case 'resetting': return { opening: 1 - sample.stageProgress, ambient: 0.24 * (1 - sample.stageProgress) }
  }
}
```

- [ ] **Step 7: Run both curtain test files GREEN**

Run: `pnpm --ignore-workspace exec vitest run src/scene/curtain.test.ts src/scene/CurtainLayer.test.tsx --maxWorkers=1`

Expected: both files PASS.

- [ ] **Step 8: Commit Task 3**

```bash
git add projects/10-starwind-letter/src/scene/curtain.ts projects/10-starwind-letter/src/scene/curtain.test.ts projects/10-starwind-letter/src/scene/CurtainLayer.tsx projects/10-starwind-letter/src/scene/CurtainLayer.test.tsx
git commit -m "feat(starwind-letter): propagate endless wind through curtain"
```

---

### Task 4: Replenish a Bounded Star Stream in Result

**Files:**
- Modify: `src/particles/system.test.ts`
- Modify: `src/particles/system.ts`
- Modify: `src/particles/ParticleCanvases.tsx`

**Interfaces:**
- Extends `ParticleWorld` with `nextEmissionAtMs: number` and `emissionIndex: number`.
- Replaces the sash gate with `entryProgress: number` and extends `ParticleStepInput` with `continuous: boolean`.
- Produces: exported `particleLimit(quality): number` for direct boundedness tests.
- Preserves: portal crossing, hero landing/dissipation, reduced-motion scaling and reset behavior.

- [ ] **Step 1: Add a failing 60-second continuous-emission test**

```ts
it('continues emitting stars for 60 seconds without exceeding the particle cap', () => {
  let world = createParticleWorld(42, 'full', 'hope')
  let latestSpawn = 0
  for (let elapsedMs = 0; elapsedMs <= 66_500; elapsedMs += 20) {
    world = stepParticleWorld(world, {
      elapsedMs,
      deltaMs: 20,
      entryProgress: elapsedMs >= 1800 ? 1 : 0,
      reducedMotion: false,
      continuous: elapsedMs >= 6500,
    })
    latestSpawn = Math.max(latestSpawn, ...world.particles.map(({ spawnAtMs }) => spawnAtMs))
    expect(world.particles.length).toBeLessThanOrEqual(particleLimit('full'))
  }
  expect(latestSpawn).toBeGreaterThan(60_000)
  expect(world.particles.some(({ space, opacity }) => space !== 'outside' && opacity > 0.05)).toBe(true)
})
```

- [ ] **Step 2: Add reset and reduced-density assertions**

```ts
it('clears particles and continuous emission counters on reset', () => {
  const reset = resetParticleWorld({
    ...worldWith(hero()),
    nextEmissionAtMs: 7200,
    emissionIndex: 3,
  })
  expect(reset).toEqual(emptyParticleWorld('full', 'dream'))
})

it('uses a lower result cap for reduced motion', () => {
  expect(particleLimit('fallback')).toBeLessThan(particleLimit('full'))
})
```

- [ ] **Step 3: Run particle tests and verify RED**

Run: `pnpm --ignore-workspace exec vitest run src/particles/system.test.ts --maxWorkers=1`

Expected: FAIL because `particleLimit`, counters and continuous emission do not exist and expired particles remain in the array.

- [ ] **Step 4: Add bounded world bookkeeping**

```ts
const limits = { full: 132, fallback: 68 } as const
const resultIntervals = { full: 880, fallback: 1500 } as const

export function particleLimit(quality: ParticleQuality) {
  return limits[quality]
}

export interface ParticleWorld {
  readonly particles: readonly Particle[]
  readonly quality: ParticleQuality
  readonly mood: Mood
  readonly nextId: number
  readonly nextEmissionAtMs: number
  readonly emissionIndex: number
}
```

Initialize both counters in `emptyParticleWorld` and `createParticleWorld`. Before emission, remove particles whose `ageMs > lifetimeMs` or whose dissipating opacity reached zero. Do not mutate existing arrays.

Update the test helper at the same time so it satisfies the complete world contract:

```ts
function worldWith(particle: Particle): ParticleWorld {
  return {
    particles: [particle],
    quality: 'full',
    mood: 'dream',
    nextId: 2,
    nextEmissionAtMs: 6500,
    emissionIndex: 0,
  }
}
```

Retiming is required because the approved first star entry starts at 1500ms rather than the old 4300ms. In `createParticleWorld`, use base spawn 1500ms, a 220ms offset for trails and a 360ms offset for heroes. Spread hero spawn times through 5000ms. Update existing crossing and landing test timestamps to the equivalent new ages; do not retain any 4300ms-based production constants.

- [ ] **Step 5: Implement deterministic result batches**

Extract a private helper with this concrete contract:

```ts
function createResultBatch(
  startId: number,
  emissionIndex: number,
  spawnAtMs: number,
  quality: ParticleQuality,
  mood: Mood,
): readonly Particle[]
```

Seed it with `createMulberry32(0x71a9 + startId * 17 + emissionIndex * 101)`. Emit six dust + two trail particles in full quality, three dust + one trail in fallback, and one hero every third full batch or every fourth fallback batch. Every new particle starts in `outside` within `WINDOW_PORTAL`, has a right-up to left-down velocity, and follows existing hero settle targets.

When `input.continuous` and `input.elapsedMs >= world.nextEmissionAtMs`, append due batches until caught up or until four batches have been generated in one step. Before appending, remove fully expired particles. If the batch would exceed the cap, truncate new dust first, then new trails, then defer the new hero to the next batch; never evict a visible particle.

Rename every existing particle test and production reference from `sashOpen` to `entryProgress`. Keep the crossing rule as `input.entryProgress >= 0.55`; the gate now represents how fully the curtain/light portal has been revealed, not a movable sash.

- [ ] **Step 6: Wire continuous mode from the timeline sample**

In `ParticleCanvases`, pass:

```ts
continuous: sample.stage === 'result'
```

Rename the component prop from `sashOpen` to `entryProgress` and pass it through to `stepParticleWorld`. Compute `deltaMs` from the unbounded `sample.elapsedMs`. When a tab resumes, the shared clock has been paused, so no large catch-up burst is required. Keep the existing world reset on `run`, `mood`, or reduced-motion changes.

For reduced motion, map only the finite narrative portion to full timing and leave result time at real speed:

```ts
const reducedTotal = timelineDuration(true)
const fullTotal = timelineDuration(false)
const narrativeElapsed = input.reducedMotion
  ? Math.min(input.elapsedMs, reducedTotal) * (fullTotal / reducedTotal)
    + Math.max(0, input.elapsedMs - reducedTotal)
  : input.elapsedMs
```

- [ ] **Step 7: Run particle tests GREEN**

Run: `pnpm --ignore-workspace exec vitest run src/particles/system.test.ts --maxWorkers=1`

Expected: all spatial, reduced-motion, landing, reset and continuous-emission tests PASS.

- [ ] **Step 8: Commit Task 4**

```bash
git add projects/10-starwind-letter/src/particles
git commit -m "feat(starwind-letter): stream bounded stars after result"
```

---

### Task 5: Fly Individual Characters with the Star Stream

**Files:**
- Create: `src/ui/letterFlight.test.ts`
- Create: `src/ui/letterFlight.ts`
- Create: `src/ui/StarbornePhrase.test.tsx`
- Create: `src/ui/StarbornePhrase.tsx`
- Delete after replacement tests pass: `src/ui/PhraseCarousel.test.tsx`
- Delete after replacement tests pass: `src/ui/PhraseCarousel.tsx`

**Interfaces:**
- Produces: `LetterFlightSample` and `sampleLetterFlight(text, progress, reducedMotion)`.
- Produces: `<StarbornePhrase message={selected} progress={number} complete={boolean} reducedMotion={boolean} />`.
- Consumes later: `stars-and-letters` stage progress and selected `StarMessage`.

- [ ] **Step 1: Write trajectory tests before the sampler exists**

```ts
it('starts every glyph near the portal and settles in source order', () => {
  const start = sampleLetterFlight('星风来信', 0, false)
  expect(start.every(({ source }) => pointInConvexQuad(source, WINDOW_PORTAL))).toBe(true)
  expect(start.every(({ opacity, blurPx }) => opacity <= 0.18 && blurPx >= 5)).toBe(true)

  const result = sampleLetterFlight('星风来信', 1, false)
  expect(result.map(({ character }) => character).join('')).toBe('星风来信')
  expect(result.every(({ translateX, translateY, rotationDeg, blurPx }) => (
    translateX === 0 && translateY === 0 && rotationDeg === 0 && blurPx === 0
  ))).toBe(true)
})

it('stagger-delays later glyphs without changing final order', () => {
  const middle = sampleLetterFlight('今晚有星光', 0.45, false)
  expect(middle[0]!.progress).toBeGreaterThan(middle.at(-1)!.progress)
})

it('reduces rotation and travel in reduced motion', () => {
  const full = sampleLetterFlight('星风', 0.35, false)
  const reduced = sampleLetterFlight('星风', 0.35, true)
  expect(Math.abs(reduced[0]!.rotationDeg)).toBeLessThan(Math.abs(full[0]!.rotationDeg))
  expect(Math.abs(reduced[0]!.translateY)).toBeLessThan(Math.abs(full[0]!.translateY))
})
```

- [ ] **Step 2: Run the new sampler test and verify RED**

Run: `pnpm --ignore-workspace exec vitest run src/ui/letterFlight.test.ts --maxWorkers=1`

Expected: FAIL because `letterFlight.ts` does not exist.

- [ ] **Step 3: Implement deterministic character sampling**

```ts
export interface LetterFlightSample {
  readonly character: string
  readonly index: number
  readonly source: Point
  readonly progress: number
  readonly translateX: number
  readonly translateY: number
  readonly rotationDeg: number
  readonly blurPx: number
  readonly opacity: number
}

export function sampleLetterFlight(
  text: string,
  progress: number,
  reducedMotion: boolean,
): readonly LetterFlightSample[]
```

Use `Array.from(text)` so punctuation and Unicode characters keep stable order. Give each character a deterministic portal source:

```ts
const source = {
  x: 232 + ((index * 37 + count * 11) % 102),
  y: 190 + ((index * 53 + count * 7) % 212),
}
```

Delay each character by up to 24% of the stage (`index / max(1, count - 1) * 0.24`). Use an eased per-character progress. Approximate the final inline glyph x-position to derive a source-to-final delta, then add a small sinusoidal arc that returns to zero. At progress 1 all transforms and blur must be exactly zero and opacity exactly one.

- [ ] **Step 4: Write semantic component tests**

```tsx
it('hides flying glyphs from assistive technology and announces only the complete sentence', () => {
  const flying = renderToStaticMarkup(
    <StarbornePhrase message={messages[0]!} progress={0.55} complete={false} reducedMotion={false} />,
  )
  const complete = renderToStaticMarkup(
    <StarbornePhrase message={messages[0]!} progress={1} complete reducedMotion={false} />,
  )
  expect(flying).toContain('data-letter-flight="true"')
  expect(flying).toContain('aria-hidden="true"')
  expect(flying).not.toContain('aria-live="polite"')
  expect(complete).toContain('aria-live="polite"')
  expect(complete).toContain(messages[0]!.text)
})

it('renders one ordered glyph span per Unicode character', () => {
  const message = { ...messages[0]!, text: '星，风。' }
  const html = renderToStaticMarkup(
    <StarbornePhrase message={message} progress={1} complete reducedMotion={false} />,
  )
  expect(html.match(/data-flight-char/g)).toHaveLength(Array.from(message.text).length)
})
```

- [ ] **Step 5: Run component tests and verify RED**

Run: `pnpm --ignore-workspace exec vitest run src/ui/StarbornePhrase.test.tsx --maxWorkers=1`

Expected: FAIL because `StarbornePhrase` does not exist.

- [ ] **Step 6: Implement the DOM character layer**

Render one normal-flow inline span per sampled character inside a centered paragraph. Apply sampler values as inherited CSS variables:

```tsx
<span
  className="starborne-char"
  data-flight-char
  key={`${message.id}-${sample.index}`}
  style={{
    '--flight-x': `${sample.translateX}px`,
    '--flight-y': `${sample.translateY}px`,
    '--flight-rotation': `${sample.rotationDeg}deg`,
    '--flight-blur': `${sample.blurPx}px`,
    '--flight-opacity': sample.opacity,
  } as CSSProperties}
>
  {sample.character}
</span>
```

Use a separate visually hidden live region containing `message.text` only when `complete`; keep the animated paragraph `aria-hidden="true"` at all times to prevent repeated character announcements.

- [ ] **Step 7: Replace phrase-wheel CSS and remove the old component**

Delete `.phrase-carousel`, `.phrase-reel`, `.phrase-row`, `.phrase-streak`, `.phrase-char` and their keyframes after no import remains. Add:

```css
.starborne-phrase {
  position: absolute;
  right: 5%;
  bottom: 8.5%;
  left: 5%;
  z-index: 7;
  margin: 0;
  color: rgb(244 248 255 / 94%);
  font-size: clamp(20px, 5.9vw, 25px);
  letter-spacing: 0.12em;
  line-height: 1.58;
  text-align: center;
  text-shadow: 0 0 10px rgb(173 198 255 / 38%), 0 0 28px rgb(104 143 239 / 34%);
}

.starborne-char {
  display: inline-block;
  opacity: var(--flight-opacity);
  filter: blur(var(--flight-blur));
  transform: translate3d(var(--flight-x), var(--flight-y), 0) rotate(var(--flight-rotation));
  will-change: transform, filter, opacity;
}
```

Delete `PhraseCarousel.tsx` and its test only after `StarbornePhrase` tests pass.

- [ ] **Step 8: Run all UI tests GREEN**

Run: `pnpm --ignore-workspace exec vitest run src/ui/letterFlight.test.ts src/ui/StarbornePhrase.test.tsx src/ui/controls.test.tsx --maxWorkers=1`

Expected: all UI tests PASS and no test references `PhraseCarousel`.

- [ ] **Step 9: Commit Task 5**

```bash
git add projects/10-starwind-letter/src/ui projects/10-starwind-letter/src/App.css
git commit -m "feat(starwind-letter): carry the phrase in on starlight"
```

---

### Task 6: Integrate One-Click Playback, Endless Result RAF and Replay

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.css`
- Modify: `src/scene/Scene.tsx`
- Test: `src/experience/machine.test.ts`, `src/experience/timeline.test.ts`, component tests from Tasks 2–5.

**Interfaces:**
- Consumes: all Task 1–5 interfaces.
- Produces: one interactive flow with idle trigger, automatic stages, persistent result animation and replay reset.

- [ ] **Step 1: Add an integration-facing timeline assertion for ongoing samples**

```ts
it('continues changing result samples so ambient systems keep animating', () => {
  const first = sampleTimeline(6500, false)
  const later = sampleTimeline(7600, false)
  expect(first.stage).toBe('result')
  expect(later.stage).toBe('result')
  expect(later.elapsedMs).toBeGreaterThan(first.elapsedMs)
  expect(later.resultElapsedMs).toBeGreaterThan(first.resultElapsedMs)
})
```

- [ ] **Step 2: Run the integration-facing tests before modifying App**

Run: `pnpm --ignore-workspace exec vitest run src/experience/timeline.test.ts src/scene/CurtainLayer.test.tsx src/particles/system.test.ts src/ui/StarbornePhrase.test.tsx --maxWorkers=1`

Expected: PASS for the lower-level contracts; App still does not compile against the new interfaces, which is the integration gap this task closes.

- [ ] **Step 3: Replace App phrase-wheel state with direct begin**

Initialize:

```ts
const [state, setState] = useState<ExperienceState>({ tag: 'idle', run: 0 })
const [selected, setSelected] = useState<StarMessage>()
const [sample, setSample] = useState(() => sampleTimeline(0, false))
```

Remove `spinIndex`, the spinning interval, `centeredMessages`, `visibleMessages`, `selectionOffset`, and `PhraseCarousel`. Replace `selectPhrase` with:

```ts
const beginExperience = () => {
  if (state.tag !== 'idle') return
  const next = chooseNextMessage(messages, recentIds.current, Math.random)
  recentIds.current = [...recentIds.current, next.id].slice(-8)
  setSelected(next)
  setState((current) => transition(current, { type: 'begin', messageId: next.id }))
  setSample(sampleTimeline(0, reducedMotion))
  clock.current.start()
  audio.current.activate()
  audio.current.cue('wind')
}
```

Render the full-scene button only in `idle`, with accessible label and visible hint “点击，让星风捎来一句话”.

- [ ] **Step 4: Keep RAF alive in result and preserve visibility pause**

Guard the effect and keep requesting frames whenever a message is selected and state is not `resetting`:

```ts
useEffect(() => {
  if (!selected || state.tag === 'resetting') return
  let frame = 0

const update = () => {
  const nextSample = sampleTimeline(clock.current.elapsed(), reducedMotion)
  setSample(nextSample)
  setState((current) => advanceToStage(current, nextSample.stage))
  frame = requestAnimationFrame(update)
}

  frame = requestAnimationFrame(update)
  return () => cancelAnimationFrame(frame)
}, [reducedMotion, selected, state.run, state.tag])
```

Including `state.tag` ensures entering `resetting` cancels the infinite result RAF before the reset RAF starts. The existing `visibilitychange` handler must resume whenever `selected && state.tag !== 'resetting'`, including `result`; remove the old result exclusion. Do not play looping result audio.

- [ ] **Step 5: Integrate fixed light and StarbornePhrase in Scene/App**

In `Scene`, derive reveal progress:

```ts
function lightReveal(sample: TimelineSample) {
  if (sample.stage === 'wind') return sample.stageProgress * 0.08
  if (sample.stage === 'curtain-opening') return smoothstep(sample.stageProgress)
  if (sample.stage === 'resetting') return 1 - sample.stageProgress
  return sample.stage === 'stars-and-letters' || sample.stage === 'result' ? 1 : 0
}
```

Render `<WindowLayer revealProgress={lightReveal(sample)} />` and pass the same reveal value to `<ParticleCanvases entryProgress={...} />`; no sash progress exists. In `App`, render:

```tsx
{selected && state.tag !== 'resetting' && (
  <StarbornePhrase
    message={selected}
    progress={state.tag === 'stars-and-letters' ? sample.stageProgress : state.tag === 'result' ? 1 : 0}
    complete={state.tag === 'result'}
    reducedMotion={reducedMotion}
  />
)}
```

Map `advanceToStage` to `wind`, `curtain-opening`, `stars-and-letters`, and `result` only.

- [ ] **Step 6: Preserve replay behavior with the new idle state**

During `resetting`, keep particles disabled, interpolate light and curtain backward using `resetSceneSample`, clear selected state at completion, reset the clock, and dispatch `reset-complete`. The final stable state must be `{ tag: 'idle', run: previousRun + 1 }` with no phrase DOM and no particle objects.

- [ ] **Step 7: Run the full unit suite GREEN**

Run: `pnpm --ignore-workspace test`

Expected: all tests PASS; TypeScript imports reference `StarbornePhrase`, no file references old state tags or `PhraseCarousel`.

- [ ] **Step 8: Run lint and build before the integration commit**

Run: `pnpm --ignore-workspace lint`

Expected: exit 0.

Run: `pnpm --ignore-workspace build`

Expected: exit 0 and Vite emits `dist/index.html` plus hashed CSS/JS assets.

- [ ] **Step 9: Commit Task 6**

```bash
git add projects/10-starwind-letter/src
git commit -m "feat(starwind-letter): orchestrate the endless starwind scene"
```

---

### Task 7: Align Documentation and Perform Mobile Visual QA

**Files:**
- Modify: `DESIGN.md`
- Modify: `UX_SPEC.md`
- Modify: `MOTION_SPEC.md`
- Modify: `VISUAL_REFERENCE.md`
- Modify: `VISUAL_QA.md`
- Modify: `README.md`
- Modify: `release-assets/*.png`
- Read only: `references/02-wind-opening.jpg`, `references/03-stars-entering.jpg`

**Interfaces:**
- Consumes: complete application from Tasks 1–6.
- Produces: conflict-free project documentation and release evidence.

- [ ] **Step 1: Remove obsolete requirements from active docs**

Update the active documents so they explicitly state:

```md
- 首屏不显示或轮播候选星语，点击时才随机锁定结果。
- 固定窗框和中间横栏保留；删除窗扇、把手、铰链和开窗动作。
- 帘子由顶部向下逐段被风掀开，结果态持续摆动。
- 地面两块几何形是被横栏分开的透视月光，不是书页。
- 单字随星流进入室内并在前景组成完整句子。
- 结果态持续补充有上限的星流，直到重播。
```

Search after editing:

Run: `rg -n "轮播|减速|窗扇|开窗|书页|翻页|结果态.*停止" DESIGN.md UX_SPEC.md MOTION_SPEC.md VISUAL_REFERENCE.md README.md`

Expected: no active statement contradicts `STARWIND_REDESIGN.md`; historical wording, if retained, is clearly labeled superseded.

- [ ] **Step 2: Start a local production preview without touching the workspace lockfile**

Run: `pnpm --ignore-workspace build`

Expected: exit 0.

Run in a long-lived terminal: `./node_modules/.bin/vite preview --host 127.0.0.1 --port 4180 --strictPort`

Expected: local preview at `http://127.0.0.1:4180`.

- [ ] **Step 3: Capture the narrative checkpoints at all required widths**

Use the Playwright CLI skill and a named browser session. For each viewport 375×812, 390×844 and 430×932, capture:

1. `initial` before click — dark room, no phrase.
2. `curtain-top` around 450ms — top visibly moving before the tail.
3. `moonlight` around 1800–2200ms — full crescent and two rail-separated floor beams.
4. `letters-entering` around 4200–4800ms — stars and unreadable glyph fragments share the wind path.
5. `result` after 6500ms — complete phrase, moving curtain, active stars.

At 390×844 only, additionally capture `result-60s` after 66,500ms to prove fresh incoming stars remain visible and the frame stays stable. Split the browser wait into two 30,000ms waits plus the remaining interval so no single blocking wait exceeds 60 seconds.

Save final evidence in `release-assets/` using names such as `390-curtain-top.png`, `390-moonlight.png`, and `390-letters-entering.png`. Replace the old `selected`, `window-opening` or phrase-wheel screenshots rather than leaving misleading evidence.

After the new files are inspected and linked from `VISUAL_QA.md`, remove the superseded tracked assets matching `*-selected.png`, `*-wind.png`, `*-crossing.png`, and `*-landing.png`; the files remain recoverable from git history.

- [ ] **Step 4: Inspect images, not just dimensions**

Open at least these files with the image viewer:

```text
release-assets/375-initial.png
release-assets/390-curtain-top.png
release-assets/390-moonlight.png
release-assets/390-letters-entering.png
release-assets/390-result.png
release-assets/390-result-60s.png
release-assets/430-result.png
```

Reject and adjust the implementation if any of these are true: the beam looks like paper, the moon is a white blob, the curtain moves as a rigid sheet, glyphs are readable before entering, the final phrase is covered, or the 60-second result has no fresh stars.

- [ ] **Step 5: Verify safe area, overflow, reduced motion and console**

At 390×844 set:

```js
document.documentElement.style.setProperty('--safe-area-inset-top', '32px')
```

Assert the sound button has `y >= 32`, width/height at least 44, and `document.documentElement.scrollWidth === document.documentElement.clientWidth === 390`. Capture `release-assets/390-safe-area-32.png`.

Emulate `prefers-reduced-motion: reduce`, run through result, and capture `release-assets/390-reduced-result.png`. Confirm the fixed frame, split light, character arrival and fresh result stars remain present with reduced density. Query Playwright console at error and warning levels; both counts must be zero.

- [ ] **Step 6: Update VISUAL_QA with measured evidence**

Record exact viewport sizes, safe-area button coordinates, overflow equality, console counts, result duration checked, particle cap, reduced-motion result and links to the new screenshots. Remove claims about phrase-wheel readability, sash angle or opening thresholds.

- [ ] **Step 7: Run final verification**

Run: `pnpm --ignore-workspace lint`

Expected: exit 0.

Run: `pnpm --ignore-workspace test`

Expected: all test files PASS with zero failures.

Run: `pnpm --ignore-workspace build`

Expected: exit 0.

Run: `git diff --check`

Expected: no output.

Run from the worktree root: `git status --short`

Expected: only intended `projects/10-starwind-letter` documentation and release assets are modified.

- [ ] **Step 8: Request independent code review and fix all Critical/Important findings**

Provide the reviewer the approved spec, this plan, base SHA and current HEAD. Require explicit review of: no idle phrase text, no sash markup, top-down curtain order, fixed split moonlight, unbounded-but-capped result particles, character origin/order/accessibility, replay, reduced motion and scope boundary.

- [ ] **Step 9: Commit Task 7**

```bash
git add projects/10-starwind-letter
git commit -m "docs(starwind-letter): verify the star-borne letter scene"
```

---

## Completion Gate

The implementation is complete only when all seven task commits exist, the full lint/test/build commands pass on the final tree, independent review has no unresolved Critical or Important finding, the 60-second browser result still emits new stars under the configured cap, and all changed paths remain under `projects/10-starwind-letter`.
