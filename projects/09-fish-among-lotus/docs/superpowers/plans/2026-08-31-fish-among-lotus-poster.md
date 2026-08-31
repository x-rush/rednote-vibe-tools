# Fish Among Lotus Poster Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing Canvas demo into a dense, poster-like lotus cluster with natural fish motion, pointer flow, collision avoidance, and mobile-first controls.

**Architecture:** Keep simulation behavior in testable pure TypeScript, use a small reusable spatial grid for local queries, and isolate Canvas lifecycle/drawing/particles from React UI. Scene arrays stay bounded and allocations are controlled in the animation loop.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Vitest 4, native Canvas 2D

**Spec:** `docs/superpowers/specs/2026-08-31-fish-among-lotus-poster-design.md`

## Global Constraints

- Modify only `projects/09-fish-among-lotus`.
- Add no dependencies and do not modify the workspace lockfile.
- Keep all business copy in `src/content/content.json`.
- Use no backend, runtime CDN, required external API, image persistence, Base64, audio, video, Blob, Service Worker, Node runtime API, or unconfirmed device API.
- Preserve deterministic `seededRandom`, strict TypeScript, accessibility names, and pointer cancel handling.
- Verify lint, tests, build, 375/390/430 CSS px, and non-zero safe-area insets before commit.

---

### Task 1: Pure Simulation Contracts

**Files:**
- Create: `src/spatial-grid.ts`
- Modify: `src/simulation.test.ts`
- Modify: `src/simulation.ts`

**Interfaces:**
- Produces: `SpatialGrid<T extends Point>`, `createPointerState`, `advancePointerState`, `findSafeTarget`, `computeLeafAvoidance`, `resolveLeafCollision`, `stepFish`.
- `stepFish` consumes `Fish[]`, `Leaf[]`, bounds, `PointerState`, dt, speed scale, and returns a new `Fish[]`.

- [ ] **Step 1: Write failing behavior tests** for lateral avoidance, finite adjacent-obstacle output, safe pointer projection, large-dt correction, loose pointer orbit, and clustered leaf generation.
- [ ] **Step 2: Run `node node_modules/vitest/vitest.mjs run src/simulation.test.ts`** and confirm failures are caused by missing interfaces/behavior.
- [ ] **Step 3: Implement the grid and simulation contracts** with deterministic intent, predictive tangent steering, substeps, penetration correction, pointer trail targeting, and soft bounds.
- [ ] **Step 4: Re-run the focused tests** and confirm all pass without warnings.

### Task 2: Dense Scene and Canvas Modules

**Files:**
- Create: `src/canvas/Pond.tsx`
- Create: `src/canvas/draw.ts`
- Create: `src/canvas/particles.ts`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: simulation `Fish`, `Leaf`, `PointerState`, `stepFish`, `createFish`, `createLeaves`.
- Produces: `Pond` React component and bounded `ParticleField` lifecycle.

- [ ] **Step 1: Move Canvas lifecycle into `Pond.tsx`** with capped DPR, coalesced resize, visibility pause/resume, cleanup-safe RAF/listeners, and all four pointer lifecycle events.
- [ ] **Step 2: Implement Canvas drawing** for restrained water texture, varied elliptical lotus leaves, small curved red fish, restrained flowers, ripples, and dotted trails without per-leaf gradients.
- [ ] **Step 3: Implement bounded particle pools** whose spawn rate responds to speed/follow state and reduced-motion.
- [ ] **Step 4: Run focused tests and TypeScript build** to catch module and lifecycle errors.

### Task 3: Poster Interface and Copy

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/index.css`
- Modify: `src/content/content.json`

**Interfaces:**
- Consumes: `Pond` props for level controls, reset, following state, and hint dismissal.
- Produces: asymmetric masthead, default-collapsed settings, transient hint, safe-area-aware layout, and accessible segmented controls.

- [ ] **Step 1: Put all new poster copy in content JSON** and wire it through typed JSON imports.
- [ ] **Step 2: Recompose the UI** so typography and whitespace frame the central cluster while controls remain secondary and accessible.
- [ ] **Step 3: Add responsive and reduced-motion CSS** for the four target viewports and 28px/24px simulated safe areas.
- [ ] **Step 4: Run lint, tests, and build** and fix only target-project issues.

### Task 4: Browser QA and Commit

**Files:**
- Modify only target-project files when QA reveals a defect.

**Interfaces:**
- Produces: screenshots and recorded assertions for mobile layout, interactions, and console health.

- [ ] **Step 1: Serve the production build and capture after screenshots** at 375×667, 375×812, 390×844, and 430×932.
- [ ] **Step 2: Simulate `--safe-area-inset-top: 28px` and bottom 24px**, assert no horizontal overflow, visible title, clickable controls, and unobscured panel.
- [ ] **Step 3: Exercise pointer down/move/up/cancel, panel controls, reset, reduced motion, and background visibility behavior**, recording console errors.
- [ ] **Step 4: Run final `pnpm lint`, `pnpm test`, and `pnpm build`**, or the exact existing local binaries if pnpm attempts forbidden workspace changes.
- [ ] **Step 5: Review target-only diff, create one local commit, and report hash and remaining visual gaps.**
