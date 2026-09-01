# Starwind Letter High-Fidelity Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile-first interactive animation in which one click selects an internal star phrase, then wind automatically blows open a perspective window and luminous strand curtain so stars visibly travel from outside into the room and settle around the phrase.

**Architecture:** React owns the finite-state experience and semantic controls. A single `requestAnimationFrame` clock drives SVG window/curtain geometry and two Canvas particle layers in a shared 390×844 design coordinate system, so pause, resume, reset, and reduced-motion behavior stay synchronized.

**Tech Stack:** React 19, React DOM 19, TypeScript 6, Vite 8, Vitest 4, SVG, Canvas 2D, Web Audio API, CSS

**Spec:** `projects/10-starwind-letter/DESIGN.md`

## Global Constraints

- Only modify `projects/10-starwind-letter`; root files, every other `projects/*`, `docs/`, and `prep/` are read-only.
- Do not add dependencies. Use the exact dependency family and scripts already present in sibling React/Vite projects.
- `pnpm-lock.yaml` currently has no `projects/10-starwind-letter` importer. Do not edit it; report the required importer to the workspace controller before dependency installation.
- The product is a pure static frontend with no backend, runtime CDN, required external API, Service Worker, or unconfirmed device API.
- All business phrases live in `src/content/content.json`; do not persist images, Base64, audio, video, or Blob data.
- Users do not type, drag the curtain, control the window, or catch stars. One click selects a phrase; the remaining main animation is automatic.
- Every hero star starts outside, waits for the window threshold, crosses the window polygon, and only then appears in the room layer.
- The phrase uses the approved container-free “light-dust lettering” treatment and never becomes a card, modal, thick letter sheet, or book.
- Top fixed controls include `var(--safe-area-inset-top, env(safe-area-inset-top, 0px))` and a 44×44 CSS px target.
- Final verification is `pnpm lint && pnpm test && pnpm build`, plus visual QA at 375, 390, and 430 CSS px with a non-zero simulated top safe area.

## Planned File Structure

```text
projects/10-starwind-letter/
├── index.html                         # Static entry document and deep-blue loading background
├── package.json                       # Existing workspace toolchain only
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── vite.config.ts
├── src/
│   ├── main.tsx                       # React entry point
│   ├── App.tsx                        # Experience composition and allowed user actions
│   ├── App.css                        # Responsive stage, safe area, phrase, and control styling
│   ├── content/
│   │   ├── content.json               # All 60 approved star phrases
│   │   ├── messages.ts                # Parse and expose immutable phrase data
│   │   └── messages.test.ts           # Content schema and wording boundaries
│   ├── domain/
│   │   ├── types.ts                   # Shared state, geometry, mood, and particle types
│   │   ├── random.ts                  # Seeded RNG, shuffle bag, recent-eight selection
│   │   └── random.test.ts
│   ├── experience/
│   │   ├── machine.ts                 # Pure finite-state reducer
│   │   ├── machine.test.ts
│   │   ├── timeline.ts                # Stage ranges, shared clock, pause/resume math
│   │   └── timeline.test.ts
│   ├── scene/
│   │   ├── geometry.ts                # Window quad, sash projection, portal crossing
│   │   ├── geometry.test.ts
│   │   ├── curtain.ts                 # Deterministic strand generation and Bézier sampling
│   │   ├── curtain.test.ts
│   │   ├── WindowLayer.tsx            # SVG sky, moon, frame, sash, and moonbeam
│   │   ├── CurtainLayer.tsx           # SVG strand rendering
│   │   └── Scene.tsx                  # Shared layer ordering and design-coordinate stage
│   ├── particles/
│   │   ├── system.ts                  # Spawn, step, layer transfer, settle, reset
│   │   ├── system.test.ts
│   │   ├── renderer.ts                # Canvas drawing only
│   │   └── ParticleCanvases.tsx       # Canvas lifecycle and DPR sizing
│   ├── audio/
│   │   ├── controller.ts              # Short synthesized cues after user activation
│   │   └── controller.test.ts
│   └── ui/
│       ├── PhraseCarousel.tsx          # Spinning, slowing, selected, result lettering
│       ├── PhraseCarousel.test.tsx
│       ├── SoundToggle.tsx
│       └── ReplayControl.tsx
└── VISUAL_QA.md                        # Actual viewport evidence and residual risks
```

---

### Task 1: Scaffold the Static App and Validate All Phrase Content

**Files:**
- Create: `projects/10-starwind-letter/package.json`
- Create: `projects/10-starwind-letter/tsconfig.json`
- Create: `projects/10-starwind-letter/tsconfig.app.json`
- Create: `projects/10-starwind-letter/tsconfig.node.json`
- Create: `projects/10-starwind-letter/vite.config.ts`
- Create: `projects/10-starwind-letter/index.html`
- Create: `projects/10-starwind-letter/src/main.tsx`
- Create: `projects/10-starwind-letter/src/App.tsx`
- Create: `projects/10-starwind-letter/src/App.css`
- Create: `projects/10-starwind-letter/src/content/content.json`
- Create: `projects/10-starwind-letter/src/content/messages.ts`
- Test: `projects/10-starwind-letter/src/content/messages.test.ts`

**Interfaces:**
- Consumes: The 60 numbered phrases and five moods in `CONTENT_SPEC.md`.
- Produces: `Mood`, `StarMessage`, `StarContent`, `parseContent(input: unknown): StarContent`, `messages: readonly StarMessage[]`, and `fallbackMessage: StarMessage`.

- [ ] **Step 1: Create the workspace-compatible package and TypeScript/Vite configuration**

Use the exact sibling-project versions and scripts:

```json
{
  "name": "10-starwind-letter",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "oxlint",
    "test": "vitest run --maxWorkers=1",
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

Set Vite `base: './'`. Use the sibling TypeScript options: ES2023, bundler resolution, `resolveJsonModule`, `react-jsx`, no emit, strict unused checks, and a node config for `vite.config.ts`.

- [ ] **Step 2: Write the failing content contract test**

```ts
import { describe, expect, it } from 'vitest'
import raw from './content.json'
import { parseContent } from './messages'

describe('star message content', () => {
  it('contains exactly the approved balanced first-release set', () => {
    const { messages } = parseContent(raw)
    expect(messages).toHaveLength(60)
    expect(new Set(messages.map((message) => message.id)).size).toBe(60)
    expect(Object.fromEntries(['calm', 'hope', 'missing', 'courage', 'dream'].map(
      (mood) => [mood, messages.filter((message) => message.mood === mood).length],
    ))).toEqual({ calm: 12, hope: 12, missing: 12, courage: 12, dream: 12 })
    expect(messages.every((message) => [...message.text.replace(/[，。！？、]/g, '')].length <= 24)).toBe(true)
  })

  it('softens concrete future promises approved in the design', () => {
    const text = parseContent(raw).messages.map((message) => message.text)
    expect(text).toContain('也许明天，会有小小惊喜')
    expect(text).toContain('愿一件好事慢慢靠近')
    expect(text).not.toContain('明天会有一个小小的惊喜')
    expect(text).not.toContain('一件好事正在慢慢靠近')
  })

  it('keeps the packaged fallback in the content file', () => {
    expect(parseContent(raw).fallback).toEqual({
      id: 'system-fallback', text: '今晚，先听一听风', mood: 'calm', weight: 1,
    })
  })
})
```

- [ ] **Step 3: Run the content test and verify the expected failure**

Run: `pnpm test -- src/content/messages.test.ts`

Expected: FAIL because `content.json` and `parseMessages` do not exist. If dependency installation is blocked by the missing lockfile importer, stop and report that exact workspace-controller action; do not modify `pnpm-lock.yaml`.

- [ ] **Step 4: Add all messages and the parser**

Copy all 60 entries from `CONTENT_SPEC.md`, assign IDs `calm-01` through `dream-12`, use `weight: 1`, and apply the two approved softened lines. Parse with explicit runtime checks:

```ts
import raw from './content.json'

export type Mood = 'calm' | 'hope' | 'missing' | 'courage' | 'dream'

export interface StarMessage {
  readonly id: string
  readonly text: string
  readonly mood: Mood
  readonly weight: number
}

export interface StarContent {
  readonly messages: readonly StarMessage[]
  readonly fallback: StarMessage
}

const moods = new Set<Mood>(['calm', 'hope', 'missing', 'courage', 'dream'])

function parseMessageList(input: unknown): readonly StarMessage[] {
  if (!Array.isArray(input)) throw new Error('Star messages must be an array')
  const result = input.map((entry, index) => {
    if (!entry || typeof entry !== 'object') throw new Error(`Invalid star message at ${index}`)
    const { id, text, mood, weight } = entry as Record<string, unknown>
    if (typeof id !== 'string' || typeof text !== 'string' || !moods.has(mood as Mood) || typeof weight !== 'number' || weight <= 0) {
      throw new Error(`Invalid star message at ${index}`)
    }
    return { id, text, mood: mood as Mood, weight }
  })
  if (new Set(result.map(({ id }) => id)).size !== result.length) throw new Error('Duplicate star message id')
  return result
}

export function parseContent(input: unknown): StarContent {
  if (!input || typeof input !== 'object') throw new Error('Star content must be an object')
  const { messages, fallback } = input as Record<string, unknown>
  const parsedMessages = parseMessageList(messages)
  const [parsedFallback] = parseMessageList([fallback])
  if (!parsedFallback) throw new Error('Fallback star message is required')
  return { messages: parsedMessages, fallback: parsedFallback }
}

const content = parseContent(raw)
export const messages = content.messages
export const fallbackMessage = content.fallback
```

Use a top-level JSON object with `messages` and `fallback`. Add a minimal `App` that imports `messages`, renders the deep-blue shell and the first phrase, and imports `App.css`; this keeps the first build independently runnable before the scene work begins.

- [ ] **Step 5: Run the test, lint, and build**

Run: `pnpm test -- src/content/messages.test.ts`

Expected: PASS with 3 tests.

Run: `pnpm lint && pnpm build`

Expected: both commands exit 0 and `dist/index.html` uses relative assets.

- [ ] **Step 6: Commit the scaffold and content slice**

```bash
git add projects/10-starwind-letter/package.json projects/10-starwind-letter/tsconfig*.json projects/10-starwind-letter/vite.config.ts projects/10-starwind-letter/index.html projects/10-starwind-letter/src/main.tsx projects/10-starwind-letter/src/App.tsx projects/10-starwind-letter/src/App.css projects/10-starwind-letter/src/content
git commit -m "feat(starwind-letter): scaffold app and add star messages"
```

---

### Task 2: Implement Deterministic Selection and the Experience State Machine

**Files:**
- Create: `projects/10-starwind-letter/src/domain/types.ts`
- Create: `projects/10-starwind-letter/src/domain/random.ts`
- Test: `projects/10-starwind-letter/src/domain/random.test.ts`
- Create: `projects/10-starwind-letter/src/experience/machine.ts`
- Test: `projects/10-starwind-letter/src/experience/machine.test.ts`

**Interfaces:**
- Consumes: `StarMessage` and `Mood` from `src/content/messages.ts`.
- Produces: `RandomSource`, `createMulberry32(seed)`, `chooseNextMessage(messages, recentIds, random)`, `ExperienceState`, `ExperienceEvent`, `transition(state, event)`.

- [ ] **Step 1: Write failing tests for recent-eight selection and click locking**

```ts
it('excludes the recent eight ids without mutating the source list', () => {
  const recent = messages.slice(0, 8).map(({ id }) => id)
  const selected = chooseNextMessage(messages, recent, () => 0)
  expect(recent).not.toContain(selected.id)
  expect(messages).toEqual(originalMessages)
})

it('accepts only the first select click', () => {
  const slowing = transition({ tag: 'spinning', run: 0 }, { type: 'select', messageId: 'calm-01' })
  expect(slowing).toEqual({ tag: 'slowing', run: 0, messageId: 'calm-01' })
  expect(transition(slowing, { type: 'select', messageId: 'hope-01' })).toBe(slowing)
})

it('allows only the documented automatic state order', () => {
  const selected = transition({ tag: 'slowing', run: 2, messageId: 'calm-01' }, { type: 'advance' })
  expect(selected.tag).toBe('selected')
  expect(transition(selected, { type: 'replay' })).toBe(selected)
})
```

- [ ] **Step 2: Run both test files and verify failure**

Run: `pnpm test -- src/domain/random.test.ts src/experience/machine.test.ts`

Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Implement deterministic random selection and pure state transitions**

Use this discriminated union so illegal states cannot carry unrelated fields:

```ts
export type ExperienceState =
  | { readonly tag: 'loading'; readonly run: number }
  | { readonly tag: 'spinning'; readonly run: number }
  | { readonly tag: 'slowing'; readonly run: number; readonly messageId: string }
  | { readonly tag: 'selected' | 'wind' | 'window-opening' | 'stars-entering' | 'result'; readonly run: number; readonly messageId: string }
  | { readonly tag: 'resetting'; readonly run: number; readonly previousMessageId: string }

export type ExperienceEvent =
  | { readonly type: 'loaded' }
  | { readonly type: 'select'; readonly messageId: string }
  | { readonly type: 'advance' }
  | { readonly type: 'replay' }
  | { readonly type: 'reset-complete' }
```

`transition` must return the same object for illegal events. `chooseNextMessage` filters recent IDs first, falls back to the full pool only when exhausted, and selects by cumulative positive weight using the injected `RandomSource`.

- [ ] **Step 4: Run tests and the project check**

Run: `pnpm test -- src/domain/random.test.ts src/experience/machine.test.ts`

Expected: PASS.

Run: `pnpm check`

Expected: lint, all tests, and build exit 0.

- [ ] **Step 5: Commit the pure domain slice**

```bash
git add projects/10-starwind-letter/src/domain projects/10-starwind-letter/src/experience/machine.ts projects/10-starwind-letter/src/experience/machine.test.ts
git commit -m "feat(starwind-letter): add selection and experience state machine"
```

---

### Task 3: Add the Unified Timeline with Pause, Resume, and Reset

**Files:**
- Create: `projects/10-starwind-letter/src/experience/timeline.ts`
- Test: `projects/10-starwind-letter/src/experience/timeline.test.ts`

**Interfaces:**
- Consumes: `ExperienceState` and the automatic `advance` event.
- Produces: `TimelineStage`, `sampleTimeline(elapsedMs, reducedMotion)`, and `createTimelineClock(now)` with `start`, `pause`, `resume`, `reset`, and `elapsed`.

- [ ] **Step 1: Write failing boundary and pause tests**

```ts
it.each([
  [0, 'slowing'], [1199, 'slowing'], [1200, 'selected'], [1900, 'wind'],
  [3400, 'window-opening'], [4300, 'stars-entering'], [6500, 'settling'], [7500, 'result'],
])('maps %dms to %s', (elapsedMs, stage) => {
  expect(sampleTimeline(elapsedMs, false).stage).toBe(stage)
})

it('does not accumulate background time while paused', () => {
  let now = 1000
  const clock = createTimelineClock(() => now)
  clock.start()
  now = 1400
  clock.pause()
  now = 6400
  clock.resume()
  now = 6600
  expect(clock.elapsed()).toBe(600)
})
```

- [ ] **Step 2: Verify the tests fail**

Run: `pnpm test -- src/experience/timeline.test.ts`

Expected: FAIL because timeline exports do not exist.

- [ ] **Step 3: Implement named stage ranges and a monotonic clock**

Return normalized progress for the active stage:

```ts
export interface TimelineSample {
  readonly stage: 'slowing' | 'selected' | 'wind' | 'window-opening' | 'stars-entering' | 'settling' | 'result'
  readonly stageProgress: number
  readonly totalProgress: number
}
```

Clamp elapsed values below 0 to 0 and values above the final duration to the result sample. In reduced motion, use the same stage order with durations `[900, 500, 700, 600, 900, 700]` milliseconds; do not skip wind, opening, or star entry.

- [ ] **Step 4: Run timeline tests and all tests**

Run: `pnpm test -- src/experience/timeline.test.ts`

Expected: PASS.

Run: `pnpm test`

Expected: all tests pass with no hanging timers.

- [ ] **Step 5: Commit the timeline**

```bash
git add projects/10-starwind-letter/src/experience/timeline.ts projects/10-starwind-letter/src/experience/timeline.test.ts
git commit -m "feat(starwind-letter): add synchronized experience timeline"
```

---

### Task 4: Lock the Perspective Geometry and Static Scene Before Animation

**Files:**
- Create: `projects/10-starwind-letter/src/scene/geometry.ts`
- Test: `projects/10-starwind-letter/src/scene/geometry.test.ts`
- Create: `projects/10-starwind-letter/src/scene/WindowLayer.tsx`
- Test: `projects/10-starwind-letter/src/scene/WindowLayer.test.tsx`
- Create: `projects/10-starwind-letter/src/scene/Scene.tsx`
- Modify: `projects/10-starwind-letter/src/App.css`
- Modify: `projects/10-starwind-letter/src/App.tsx`

**Interfaces:**
- Consumes: timeline `stageProgress` and the fixed 390×844 design coordinates.
- Produces: `Point`, `Quad`, `WINDOW_PORTAL`, `projectSash(openProgress)`, `pointInConvexQuad(point, quad)`, `crossesPortal(previous, next, portal)` and `<Scene sample={sample} />`.

- [ ] **Step 1: Write failing geometry tests**

```ts
it('keeps the right hinge edge fixed while the sash opens toward the viewer', () => {
  const closed = projectSash(0)
  const open = projectSash(1)
  expect(open.topRight).toEqual(closed.topRight)
  expect(open.bottomRight).toEqual(closed.bottomRight)
  expect(open.topLeft.x).toBeLessThan(closed.topLeft.x)
  expect(open.bottomLeft.y).toBeGreaterThan(closed.bottomLeft.y)
})

it('detects a continuous outside-to-inside portal crossing', () => {
  expect(crossesPortal({ x: 308, y: 215 }, { x: 235, y: 390 }, WINDOW_PORTAL)).toBe(true)
  expect(crossesPortal({ x: 90, y: 220 }, { x: 120, y: 410 }, WINDOW_PORTAL)).toBe(false)
})
```

- [ ] **Step 2: Verify geometry tests fail**

Run: `pnpm test -- src/scene/geometry.test.ts`

Expected: FAIL because the geometry module is absent.

- [ ] **Step 3: Implement fixed design-space geometry**

Define the window in the upper-right portion of the stage, with a sloped top edge and visible right-side depth. Use explicit constants rather than viewport-dependent coordinates:

```ts
export const DESIGN_SIZE = { width: 390, height: 844 } as const
export const WINDOW_PORTAL: Quad = {
  topLeft: { x: 214, y: 152 }, topRight: { x: 348, y: 178 },
  bottomRight: { x: 348, y: 486 }, bottomLeft: { x: 214, y: 438 },
}
```

Implement convex-quad containment with consistent cross-product signs. Implement sash projection with an eased open angle capped at 65°, preserving the right hinge edge and moving the free edge left/down with a narrowing projected width.

- [ ] **Step 4: Render the original static composition**

Build `<WindowLayer>` using SVG gradients and shapes only: deep navy room, black-blue exterior, crescent moon, sparse exterior stars, glowing perspective frame, two sash crossbars, and a closed sash. Build `<Scene>` with this exact layer order: room, exterior canvas slot, window SVG, moonbeam, curtain slot, interior canvas slot, phrase slot.

Set the stage to `aspect-ratio: 390 / 844`, `width: min(100vw, calc(100dvh * 390 / 844))`, and center it in landscape. Set `html`, `body`, and `#root` to the same deep-blue background so loading never flashes white.

- [ ] **Step 5: Add a server-render smoke test and run checks**

```ts
const html = renderToStaticMarkup(<WindowLayer openProgress={0} shakeProgress={0} />)
expect(html).toContain('viewBox="0 0 390 844"')
expect(html).toContain('data-layer="window-frame"')
expect(html).toContain('data-window-state="closed"')
```

Run: `pnpm test -- src/scene/geometry.test.ts src/scene/WindowLayer.test.tsx`

Expected: PASS.

Run: `pnpm check`

Expected: exit 0.

- [ ] **Step 6: Capture and inspect the static closed frame before proceeding**

Run the dev server and capture 390×844. Compare against `references/01-curtain-closed.jpg`: window upper-right, camera below/left, top edges sloping together, moon visible through the intended curtain region, and no centered front-facing rectangle. If any relationship fails, adjust only geometry constants and CSS before Task 5.

- [ ] **Step 7: Commit the approved static scene**

```bash
git add projects/10-starwind-letter/src/scene projects/10-starwind-letter/src/App.tsx projects/10-starwind-letter/src/App.css
git commit -m "feat(starwind-letter): establish perspective night-window scene"
```

---

### Task 5: Add the Phrase Carousel Without Disturbing the Scene

**Files:**
- Create: `projects/10-starwind-letter/src/ui/PhraseCarousel.tsx`
- Test: `projects/10-starwind-letter/src/ui/PhraseCarousel.test.tsx`
- Modify: `projects/10-starwind-letter/src/App.tsx`
- Modify: `projects/10-starwind-letter/src/App.css`

**Interfaces:**
- Consumes: `messages`, `ExperienceState`, selected message ID, and timeline sample.
- Produces: `<PhraseCarousel state={state} selected={selected} visibleMessages={visibleMessages} />` and the scene-wide click target in `App`.

- [ ] **Step 1: Write failing markup tests for the approved light-dust lettering**

```ts
it('renders a phrase as scene lettering without a card container', () => {
  const html = renderToStaticMarkup(<PhraseCarousel
    state={{ tag: 'selected', run: 0, messageId: 'calm-01' }}
    selected={messages[0]}
    visibleMessages={messages.slice(0, 5)}
    progress={1}
  />)
  expect(html).toContain('data-phrase-treatment="light-dust"')
  expect(html).not.toContain('card')
  expect(html).not.toContain('letter-sheet')
})
```

- [ ] **Step 2: Verify the test fails**

Run: `pnpm test -- src/ui/PhraseCarousel.test.tsx`

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement spinning, slowing, selected, and result presentation**

Render five phrases in a vertical reel. Central text uses 0.92 opacity; neighbors use 0.28 and 0.10 with small blur. During slowing, translate the reel using an ease-out quint curve over 1.2 seconds. After selection, remove neighbors from the accessible tree, keep the selected phrase still, dim it during wind/window opening, and relight it during settling.

CSS must use a system serif stack such as `ui-serif, "Songti SC", "Noto Serif CJK SC", serif`, a maximum width of 19em, no background, no border, and no backdrop filter. Keep the phrase below the primary wind path and cap it at two lines.

- [ ] **Step 4: Integrate one-click selection**

The stage click handler only dispatches `select` while `state.tag === 'spinning'`. Call `chooseNextMessage`, update the session recent-ID queue to the last eight values, and start the timeline exactly once. Stop propagation from the sound control.

- [ ] **Step 5: Run focused tests and project checks**

Run: `pnpm test -- src/ui/PhraseCarousel.test.tsx src/experience/machine.test.ts src/domain/random.test.ts`

Expected: PASS.

Run: `pnpm check`

Expected: exit 0.

- [ ] **Step 6: Commit the complete selection vertical slice**

```bash
git add projects/10-starwind-letter/src/ui/PhraseCarousel.tsx projects/10-starwind-letter/src/ui/PhraseCarousel.test.tsx projects/10-starwind-letter/src/App.tsx projects/10-starwind-letter/src/App.css
git commit -m "feat(starwind-letter): integrate unobtrusive star phrase selection"
```

---

### Task 6: Animate the Strand Curtain and Weighted Window Opening

**Files:**
- Create: `projects/10-starwind-letter/src/scene/curtain.ts`
- Test: `projects/10-starwind-letter/src/scene/curtain.test.ts`
- Create: `projects/10-starwind-letter/src/scene/CurtainLayer.tsx`
- Modify: `projects/10-starwind-letter/src/scene/WindowLayer.tsx`
- Modify: `projects/10-starwind-letter/src/scene/Scene.tsx`

**Interfaces:**
- Consumes: seeded random source and `TimelineSample`.
- Produces: `CurtainStrand`, `createCurtainStrands(count, random)`, `sampleCurtainPath(strand, windProgress, timeMs)`, `<CurtainLayer sample={sample} />`, and animated `<WindowLayer>`.

- [ ] **Step 1: Write failing strand invariants**

```ts
it('keeps every strand anchored while lower control points move farther', () => {
  const [strand] = createCurtainStrands(1, () => 0.5)
  const still = sampleCurtainPath(strand, 0, 0)
  const gust = sampleCurtainPath(strand, 1, 2800)
  expect(gust.start).toEqual(still.start)
  expect(Math.abs(gust.end.x - still.end.x)).toBeGreaterThan(Math.abs(gust.control1.x - still.control1.x))
})

it('creates independent delays and lengths for sixty-four strands', () => {
  const strands = createCurtainStrands(64, createMulberry32(42))
  expect(new Set(strands.map(({ delay }) => delay)).size).toBeGreaterThan(20)
  expect(new Set(strands.map(({ length }) => Math.round(length))).size).toBeGreaterThan(10)
})
```

- [ ] **Step 2: Verify the tests fail**

Run: `pnpm test -- src/scene/curtain.test.ts`

Expected: FAIL because curtain functions are missing.

- [ ] **Step 3: Implement deterministic Bézier strand motion**

Each strand stores anchor, length, brightness, phase, delay, and response. Before wind, add at most 2 design pixels of breathing at the lower end. During wind, compute delayed progress per strand and displace control points toward the lower-left, with the end point moving about 2.4 times farther than the first control point. Add a damped sine term after the peak for unequal recoil.

- [ ] **Step 4: Render strands and window motion from the same sample**

Render one SVG `<path>` per strand with a narrow silver-blue gradient stroke. Use the timeline's window-opening progress to sample `projectSash`, an 80–150ms shake envelope before opening, and the moonbeam polygon. Do not use separate CSS animation durations.

- [ ] **Step 5: Run tests and capture wind/open static frames**

Run: `pnpm test -- src/scene/curtain.test.ts src/scene/geometry.test.ts`

Expected: PASS.

Capture the wind peak near 2.9s and the open frame near 4.25s at 390×844. Compare to references 02 and 03: anchored fan-shaped curtain arc, clear window outline at peak, visible toward-viewer sash depth, and widened diagonal moonlight. Correct geometry before adding particles.

- [ ] **Step 6: Commit the animated architectural scene**

```bash
git add projects/10-starwind-letter/src/scene
git commit -m "feat(starwind-letter): animate wind-driven curtain and window"
```

---

### Task 7: Add Two-Layer Stars with Verifiable Window Crossing

**Files:**
- Create: `projects/10-starwind-letter/src/particles/system.ts`
- Test: `projects/10-starwind-letter/src/particles/system.test.ts`
- Create: `projects/10-starwind-letter/src/particles/renderer.ts`
- Create: `projects/10-starwind-letter/src/particles/ParticleCanvases.tsx`
- Modify: `projects/10-starwind-letter/src/scene/Scene.tsx`

**Interfaces:**
- Consumes: `WINDOW_PORTAL`, sash open progress, timeline sample, selected mood, and seeded random source.
- Produces: `Particle`, `ParticleWorld`, `createParticleWorld(seed, quality, mood)`, `stepParticleWorld(world, input)`, `resetParticleWorld(world)`, `drawExterior(ctx, world)`, and `drawInterior(ctx, world)`.

- [ ] **Step 1: Write failing tests for the spatial hard requirement**

```ts
it('never transfers a hero star before the sash threshold', () => {
  const world = heroStarApproachingPortal()
  const next = stepParticleWorld(world, { elapsedMs: 4700, deltaMs: 16, sashOpen: 0.39, reducedMotion: false })
  expect(next.heroStars.every(({ space }) => space === 'outside')).toBe(true)
})

it('transfers continuously through the portal and not through the wall', () => {
  const crossing = stepParticleWorld(heroStarApproachingPortal(), { elapsedMs: 4800, deltaMs: 80, sashOpen: 0.7, reducedMotion: false })
  expect(crossing.heroStars[0].space).toBe('inside')
  expect(crossing.heroStars[0].history.some((point) => pointInConvexQuad(point, WINDOW_PORTAL))).toBe(true)

  const wall = stepParticleWorld(heroStarApproachingWall(), { elapsedMs: 4800, deltaMs: 80, sashOpen: 0.7, reducedMotion: false })
  expect(wall.heroStars[0].space).toBe('outside')
})

it('clears all particles and generation counters on reset', () => {
  expect(resetParticleWorld(populatedWorld())).toEqual(emptyParticleWorld())
})
```

- [ ] **Step 2: Verify the tests fail**

Run: `pnpm test -- src/particles/system.test.ts`

Expected: FAIL because the particle system does not exist.

- [ ] **Step 3: Implement the pure particle simulation**

Use three kinds and four spaces:

```ts
export type ParticleKind = 'dust' | 'trail' | 'hero'
export type ParticleSpace = 'outside' | 'crossing' | 'inside' | 'settling'

export interface Particle {
  readonly id: number
  readonly kind: ParticleKind
  readonly space: ParticleSpace
  readonly position: Point
  readonly previous: Point
  readonly velocity: Point
  readonly ageMs: number
  readonly lifetimeMs: number
  readonly history: readonly Point[]
  readonly radius: number
  readonly twinklePhase: number
}
```

Spawn dust first, trails second, and hero stars last. Outside paths converge on points inside `WINDOW_PORTAL`. After a valid crossing, continue along the lower-left wind vector before curving toward deterministic settle anchors around the phrase. Keep hero history long enough for tests and optional development diagnostics, but never render diagnostics in production.

- [ ] **Step 4: Implement Canvas rendering and quality tiers**

`drawExterior` clears and clips to the portal polygon before drawing outside/crossing particles. `drawInterior` draws only inside/settling particles. Draw dust as low-alpha circles, trails as short gradients between previous and current positions, and hero stars as a four-point core plus glow. Cap effective DPR at 2.

Full quality uses 70 dust, 22 trails, 8 heroes; fallback uses 35, 10, and 5. A rolling frame average may switch from full to fallback after 45 consecutive frames above 22ms, but never switches back during the same run.

- [ ] **Step 5: Mount both Canvas layers on the shared clock**

`ParticleCanvases` sizes buffers from the displayed stage, transforms both contexts into design coordinates, and receives timeline samples from `Scene`. Cancel its RAF callback and clear both canvases when the run ID changes or the component unmounts.

- [ ] **Step 6: Run tests and inspect the continuous path**

Run: `pnpm test -- src/particles/system.test.ts src/scene/geometry.test.ts`

Expected: PASS.

Capture at least three consecutive points of one hero star: visible outside near the moon, centered in the opening, and inside on the lower-left trajectory. Reject the implementation if a hero appears only after crossing or teleports to the phrase.

- [ ] **Step 7: Commit the particle vertical slice**

```bash
git add projects/10-starwind-letter/src/particles projects/10-starwind-letter/src/scene/Scene.tsx
git commit -m "feat(starwind-letter): send layered stars through the window"
```

---

### Task 8: Complete Audio, Focus Safety, Reduced Motion, Result, and Replay

**Files:**
- Create: `projects/10-starwind-letter/src/audio/controller.ts`
- Test: `projects/10-starwind-letter/src/audio/controller.test.ts`
- Create: `projects/10-starwind-letter/src/ui/SoundToggle.tsx`
- Create: `projects/10-starwind-letter/src/ui/ReplayControl.tsx`
- Modify: `projects/10-starwind-letter/src/App.tsx`
- Modify: `projects/10-starwind-letter/src/App.css`
- Modify: `projects/10-starwind-letter/src/experience/timeline.test.ts`

**Interfaces:**
- Consumes: experience transitions, timeline stage changes, and browser visibility events.
- Produces: `createAudioController(factory)`, semantic sound/replay controls, one complete reset path, and reduced-motion samples.

- [ ] **Step 1: Write failing audio lifecycle and replay tests**

```ts
it('does not create an audio context before explicit activation', () => {
  const factory = vi.fn(() => fakeAudioContext())
  const audio = createAudioController(factory)
  audio.cue('wind')
  expect(factory).not.toHaveBeenCalled()
  audio.activate()
  expect(factory).toHaveBeenCalledOnce()
})

it('makes audio failure sticky and non-throwing', () => {
  const audio = createAudioController(() => { throw new Error('blocked') })
  expect(() => audio.activate()).not.toThrow()
  expect(audio.snapshot()).toEqual({ active: false, muted: true, failed: true })
})
```

Add an app orchestration test around pure exported helpers that proves one replay event increments the run ID, enters `resetting`, clears the recent visual world, and returns to `spinning` only after `reset-complete`.

- [ ] **Step 2: Verify tests fail**

Run: `pnpm test -- src/audio/controller.test.ts src/experience/machine.test.ts src/experience/timeline.test.ts`

Expected: FAIL on missing audio and replay orchestration exports.

- [ ] **Step 3: Implement short synthesized cues after activation**

Use Web Audio oscillators and gain envelopes only after the first accepted scene click. Create four cues: `select`, `wind`, `frame`, and `stars`. Wind uses a short filtered noise buffer generated in memory for immediate playback only; do not persist the buffer. Stop and disconnect every node after its envelope. Muting stops active nodes and prevents later cues without stopping visual stages.

- [ ] **Step 4: Wire visibility, reduced motion, and reset**

On `visibilitychange`, call the shared clock's `pause`/`resume` and the audio controller's corresponding methods. Read `matchMedia('(prefers-reduced-motion: reduce)')` without persisting it. Replay must lock immediately, fade particles, close the sash, settle the curtain over 1.2–2.0 seconds, reset both canvases and the clock, then dispatch `reset-complete`.

- [ ] **Step 5: Add accessible controls without adding product chrome**

The sound control is a 44×44 button with an accessible name and top offset:

```css
.sound-toggle {
  position: fixed;
  top: calc(var(--safe-area-inset-top, env(safe-area-inset-top, 0px)) + 10px);
  right: 12px;
  inline-size: 44px;
  block-size: 44px;
}
```

The replay control appears only in `result`, reads “再听一次星空”, and looks like light typography with a subtle underline/halo rather than a filled button. Both controls must have visible `:focus-visible` treatment.

- [ ] **Step 6: Run the complete automated suite and a ten-run soak**

Run: `pnpm test`

Expected: all tests pass with zero unhandled promise rejections and no open-handle warning.

In the browser, replay ten consecutive runs. Confirm each run owns one clock and one particle world; there are no duplicated sounds, residual stars, half-open sashes, or clicks accepted during reset.

- [ ] **Step 7: Commit the resilient complete experience**

```bash
git add projects/10-starwind-letter/src/audio projects/10-starwind-letter/src/ui/SoundToggle.tsx projects/10-starwind-letter/src/ui/ReplayControl.tsx projects/10-starwind-letter/src/App.tsx projects/10-starwind-letter/src/App.css projects/10-starwind-letter/src/experience
git commit -m "feat(starwind-letter): complete resilient starwind experience"
```

---

### Task 9: Perform Mobile Visual QA, Tune Without Scope Expansion, and Verify Release

**Files:**
- Modify: `projects/10-starwind-letter/src/App.css`
- Modify only if evidence requires: `projects/10-starwind-letter/src/scene/geometry.ts`
- Modify only if evidence requires: `projects/10-starwind-letter/src/scene/curtain.ts`
- Modify only if evidence requires: `projects/10-starwind-letter/src/particles/system.ts`
- Create: `projects/10-starwind-letter/VISUAL_QA.md`

**Interfaces:**
- Consumes: the complete app and the three reference images.
- Produces: viewport evidence for all required states, documented comparison findings, and release command output.

- [ ] **Step 1: Start the production-equivalent preview and capture required states**

Run: `pnpm build` followed by `pnpm preview --host 127.0.0.1`.

At 375×812, 390×844, and 430×932 CSS px, capture:

1. spinning with the window closed;
2. selected phrase before wind;
3. curtain at wind-pressure peak;
4. open window while a hero star is crossing;
5. final phrase and replay control.

Repeat 390×844 with `--safe-area-inset-top: 32px` on the root element.

- [ ] **Step 2: Compare every capture against explicit visual criteria**

Record pass/fail in `VISUAL_QA.md` for: upper-right perspective window; matching slope on rod/frame/crossbars; moon visible through closed strands; lower-left fan-shaped gust; sash visibly opening toward the viewer; outside-to-inside hero path; phrase no more than two lines; no card treatment; sound control below simulated status area; no horizontal scrolling.

- [ ] **Step 3: Tune only measured failures**

Adjust geometry constants for composition errors, curtain response constants for synchronized or flat motion, particle counts/glow for frame-time failures, and CSS clamp values for text overflow. Do not add new product features or import external assets.

- [ ] **Step 4: Verify reduced motion and fallback quality**

Emulate `prefers-reduced-motion: reduce` and confirm the window still opens automatically and at least one star visibly crosses from outside to inside. Force fallback quality through a development-only query-independent test hook exported from the pure particle module; do not ship a debug control in the UI.

- [ ] **Step 5: Run the final release gate**

Run: `pnpm lint && pnpm test && pnpm build`

Expected: all three commands exit 0. Read the full output and report exact test counts and build result.

Run: `git diff --check -- projects/10-starwind-letter`

Expected: no whitespace errors.

- [ ] **Step 6: Commit QA evidence and final tuning**

```bash
git add projects/10-starwind-letter/src projects/10-starwind-letter/VISUAL_QA.md
git commit -m "test(starwind-letter): verify mobile visual experience"
```
