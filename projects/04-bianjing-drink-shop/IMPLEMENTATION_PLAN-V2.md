# 汴京饮子铺 UI/UX V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This workspace forbids subagent execution for the current task.

**Goal:** Deliver a functional, mobile-first “shop stage + paper operations desk” interface for the complete deterministic daily business loop, with a coherent 15-image art pack and explainable feedback.

**Architecture:** Preserve the simulator, event engine, save schema, and content counts. Extend the typed presentation model, introduce a small pure UI-flow reducer, render focused React components, and let `App` orchestrate storage and engine calls without duplicating economic rules.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Vitest 4, native IndexedDB/localStorage, CSS/SVG, built-in image generation.

**Spec:** `UI-REDESIGN-V2.md`, `INTERACTION-MOTION-SPEC.md`, `ART-REQUEST.md`

## Global Constraints

- Modify only `projects/04-bianjing-drink-shop/**`.
- Do not install dependencies or modify any workspace file or lock file.
- Runtime remains static and offline; no backend, runtime CDN, external API, Service Worker, Node API, or unconfirmed device API.
- Business copy remains in `src/content/content.json`; JSX consumes a typed view model.
- Do not change the 100-day formulas, 80 events, five chains, eight endings, or seeded RNG behavior.
- Do not store images, Base64, audio, video, or Blob data in browser persistence.
- Generated bitmap assets live under `public/assets/`; CSS/SVG decoration remains code-native.
- Do not delete or weaken tests. Do not perform Git write operations.
- Final verification is `pnpm lint && pnpm test && pnpm build`, plus 375×812, 390×844, and 430×932 browser checks.

## Planned File Map

- `public/assets/scenes/shop-base-day.webp`: reusable verified shop stage.
- `public/assets/guide/ayuan-master.webp`: guide master art, cropped in CSS for avatar use.
- `public/assets/customers/*.webp`: three customer identity baselines.
- `public/assets/drinks/*.webp`: ten product illustrations keyed by product ID.
- `src/content/content.json`: UI-only labels and presentation copy.
- `src/content/content.test.ts`: required UI-copy contract tests.
- `src/state/view-model.ts`: weather, inventory, asset, budget, ticker, ledger, and outcome presentation.
- `src/state/view-model.test.ts`: presentation behavior tests.
- `src/state/ui-flow.ts`: pure UI-only reducer for tutorial, business playback, event confirmation, and submission guard.
- `src/state/ui-flow.test.ts`: reducer red/green tests.
- `src/ui/GameUi.tsx`: focused visual components with no business mutation.
- `src/ui/GameUi.test.tsx`: server-rendered semantic and fallback tests.
- `src/App.tsx`: storage and simulator orchestration.
- `src/App.css`: component layout, responsive behavior, and motion.
- `src/index.css`: global tokens, typography, reset, and reduced-motion baseline.
- `PROMPTS.md`: final asset prompts, paths, dimensions, sizes, and acceptance notes.
- `VISUAL-QA.md`: final three-width and asset verification evidence.

---

### Task 1: Generate and validate the 15-image art pack

**Files:**
- Create: `public/assets/scenes/shop-base-day.webp`
- Create: `public/assets/guide/ayuan-master.webp`
- Create: `public/assets/customers/market-worker.webp`
- Create: `public/assets/customers/merchant.webp`
- Create: `public/assets/customers/scholar.webp`
- Create: `public/assets/drinks/drink-green-plum.webp`
- Create: `public/assets/drinks/drink-ginger-honey.webp`
- Create: `public/assets/drinks/drink-perilla.webp`
- Create: `public/assets/drinks/drink-lychee-paste.webp`
- Create: `public/assets/drinks/drink-fragrant-bean.webp`
- Create: `public/assets/drinks/drink-lotus.webp`
- Create: `public/assets/drinks/drink-mint.webp`
- Create: `public/assets/drinks/drink-cinnamon.webp`
- Create: `public/assets/drinks/drink-date.webp`
- Create: `public/assets/drinks/drink-signature.webp`
- Modify: `PROMPTS.md`

**Interfaces:**
- Produces: stable public URLs `/assets/scenes/shop-base-day.webp`, `/assets/guide/ayuan-master.webp`, `/assets/customers/<identity>.webp`, and `/assets/drinks/<productId>.webp`.
- Consumes: exact subject, costume, vessel, composition, and avoid requirements from `ART-REQUEST.md`.

- [x] **Step 1: Read the image generation prompting references and normalize the 15 prompts**

Use case slugs: `historical-scene` for the shop, `illustration-story` for people, and `product-mockup` for drinks. Every prompt must include “no text, no logo, no watermark” and the specific historical exclusions from `ART-REQUEST.md`.

- [x] **Step 2: Generate the shop and four character masters with the built-in image tool**

Generate one asset per prompt. Inspect each output for architecture, costume, hands, props, fake writing, and mobile-safe composition before accepting it.

- [x] **Step 3: Generate ten drink assets with the built-in image tool**

Generate one asset per product. Each prompt names the exact liquid color, ingredient cues, plain vessel, 43px legibility requirement, and prohibited modern additions recorded in `ART-REQUEST.md`.

- [x] **Step 4: Copy accepted outputs into `public/assets` and convert final files to WebP if needed**

Run:

```bash
find public/assets -maxdepth 4 -type f -print
find public/assets -maxdepth 4 -type f -name '*.webp' -exec file {} \;
```

Expected: exactly 15 readable WebP files and no Base64, audio, video, or Blob file.

- [x] **Step 5: Record generation evidence in `PROMPTS.md`**

For every accepted file, record final prompt, built-in tool mode, dimensions, byte size, inspection result, and any rejected variant reason.

### Task 2: Extend content-backed presentation data

**Files:**
- Modify: `src/content/content.test.ts`
- Modify: `src/content/content.json`
- Modify: `src/state/view-model.test.ts`
- Modify: `src/state/view-model.ts`

**Interfaces:**
- Produces: `buildGameViewModel(state, content, context?)` where `context` is `{ decision?: DailyDecision; result?: DailyResult }`.
- Produces: `GameViewModel.weather`, `season`, `products[].assetPath`, `products[].inventory`, `budget`, `ticker`, `ledger`, and `outcome`.
- Consumes: `GameState`, `DailyDecision`, `DailyResult`, and `ShopContent` without calculating new game outcomes.

- [x] **Step 1: Add failing UI-copy contract assertions**

```ts
const requiredUiKeys = [
  'coverPromise','todayIntel','preparationBudget','openingSummary',
  'businessTitle','quickSettlement','selectedChoice','confirmChoice',
  'guideName','guideRole','guideLedger','recoveryLoss','outcomeRoute',
]
for (const key of requiredUiKeys) expect(shopContent.content.ui[key]).toBeTruthy()
```

- [x] **Step 2: Run the content test and verify the new key assertions fail**

Run: `pnpm test src/content/content.test.ts`

Expected: FAIL because `coverPromise` and the remaining V2 labels are absent.

- [x] **Step 3: Add the exact V2 labels to `content.json`**

Add only string entries under `content.ui`; do not change content counts, economic fields, event effects, or ending conditions.

- [x] **Step 4: Add failing view-model assertions for assets, budget, ticker, and ledger labels**

```ts
const view = buildGameViewModel(opened.state, shopContent.content, {
  decision: basicDecision,
  result,
})
expect(view.products[0]).toMatchObject({
  assetPath: './assets/drinks/drink-green-plum.webp',
  inventory: 0,
})
expect(view.budget?.stockCost).toBeGreaterThan(0)
expect(view.ticker[0]?.text).toContain('售出')
expect(view.ledger.every((line) => !line.label.startsWith('ledger.'))).toBe(true)
```

- [x] **Step 5: Run the view-model test and verify missing fields cause failure**

Run: `pnpm test src/state/view-model.test.ts`

Expected: FAIL because `assetPath`, `budget`, `ticker`, and `ledger` are not defined.

- [x] **Step 6: Implement the minimal presentation mapping**

Use product IDs for image paths, `pendingOpening.dayContext` for weather/season names, the existing decision for `stockCost`, `pendingOpening.sales` for ticker copy, and a finite label map for `ledger.income`, `ledger.stock-cost`, `ledger.waste-return`, `ledger.fixed-cost`, event, and scheduled entries.

- [x] **Step 7: Run content and view-model tests until green**

Run: `pnpm test src/content/content.test.ts src/state/view-model.test.ts`

Expected: both test files PASS while production counts remain 10/12/80/5/8.

### Task 3: Implement the UI-only flow reducer

**Files:**
- Create: `src/state/ui-flow.test.ts`
- Create: `src/state/ui-flow.ts`

**Interfaces:**
- Produces: `createUiFlow(): UiFlowState`.
- Produces: `reduceUiFlow(state, action): UiFlowState`.
- `UiFlowState` fields: `tutorialStep`, `businessStage`, `selectedChoiceId`, `isSubmitting`, `ledgerExpanded`.
- `UiFlowAction` covers `tutorial-next`, `tutorial-skip`, `business-next`, `business-skip`, `select-choice`, `submit-start`, `submit-end`, `toggle-ledger`, and `reset-day`.

- [x] **Step 1: Write failing tutorial and business playback tests**

```ts
let state = createUiFlow()
state = reduceUiFlow(state, { type: 'tutorial-next' })
expect(state.tutorialStep).toBe(1)
state = reduceUiFlow(state, { type: 'business-skip' })
expect(state.businessStage).toBe(3)
```

- [x] **Step 2: Write failing event selection and double-submit guard tests**

```ts
state = reduceUiFlow(state, { type: 'select-choice', choiceId: 'choice-a' })
expect(state.selectedChoiceId).toBe('choice-a')
state = reduceUiFlow(state, { type: 'submit-start' })
expect(reduceUiFlow(state, { type: 'submit-start' })).toBe(state)
```

- [x] **Step 3: Run the reducer test and verify the module is missing**

Run: `pnpm test src/state/ui-flow.test.ts`

Expected: FAIL because `ui-flow.ts` does not exist.

- [x] **Step 4: Implement the reducer with clamped tutorial/business stages**

`tutorialStep` ranges 0–2, `businessStage` ranges 0–3, `submit-start` is ignored while already submitting, and `reset-day` clears selection/submission/playback state.

- [x] **Step 5: Run the reducer test until green**

Run: `pnpm test src/state/ui-flow.test.ts`

Expected: all reducer cases PASS.

### Task 4: Build semantic visual components

**Files:**
- Create: `src/ui/GameUi.test.tsx`
- Create: `src/ui/GameUi.tsx`

**Interfaces:**
- Produces: `GameHeader`, `ShopScene`, `GuideCard`, `PreparationPanel`, `OpeningSummary`, `BusinessTicker`, `EventDecision`, `LedgerPanel`, and `OutcomePanel`.
- Consumes: `GameViewModel` and callback props; components do not call the simulator or storage.

- [x] **Step 1: Write failing server-render tests for the header, fallback scene, and event confirmation**

```tsx
const html = renderToStaticMarkup(<EventDecision event={event} selectedChoiceId="choice-a" isSubmitting={false} onSelect={() => {}} onConfirm={() => {}} />)
expect(html).toContain('aria-pressed="true"')
expect(html).toContain('确认选择')
expect(html).not.toContain('disabled=""')
```

Also assert `ShopScene` includes textual scene fallback adjacent to its `<img>` and `GameHeader` renders all four named stats.

- [x] **Step 2: Run the component test and verify the module is missing**

Run: `pnpm test src/ui/GameUi.test.tsx`

Expected: FAIL because `GameUi.tsx` does not exist.

- [x] **Step 3: Implement the components with semantic HTML and stable class names**

Use `header`, `section`, `article`, `fieldset`, `dl`, and `button`; add `aria-label`, `aria-pressed`, `aria-busy`, descriptive image `alt`, and textual fallbacks. Keep all callbacks explicit and business-free.

- [x] **Step 4: Run component tests until green**

Run: `pnpm test src/ui/GameUi.test.tsx`

Expected: semantic, selection, fallback, and button-state assertions PASS.

### Task 5: Integrate the complete daily loop in App

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.css`
- Modify: `src/index.css`

**Interfaces:**
- Consumes: `reduceUiFlow`, V2 components, `buildGameViewModel`, `openDay`, `resolveDay`, and existing persistence adapters.
- Produces: cover → tutorial → morning → preparation → opening summary → business playback → event select/confirm → settlement → milestone/outcome/recovery.

- [x] **Step 1: Run the existing test suite before integration**

Run: `pnpm test`

Expected: current suites PASS before changing `App.tsx`.

- [x] **Step 2: Replace direct page markup with V2 components and reducer state**

Keep `persist`, `beginNewGame`, `openDay`, and `resolveDay` as the only state-changing business paths. `handleResolve` receives only the reducer’s confirmed `selectedChoiceId`; a first click on a choice never calls it.

- [x] **Step 3: Add the staged opening/business flow**

After `handleOpen`, show the read-only opening summary, then the business stage. `business-next` advances textual playback; `business-skip` jumps to the final stage; the final action routes to event or normal settlement without recalculating the day.

- [x] **Step 4: Replace the settlement table with `LedgerPanel` and preserve outcome routing**

Use view-model labels and product cards. On “next day”, reset UI-only flow and follow `game.page`; milestone continues to morning without altering the finished result.

- [x] **Step 5: Implement the visual system and responsive layouts**

Add tokenized paper/wood/ink styles, scene layers, 46px controls, 2×2 mobile HUD, sticky-safe action dock, desktop dual column, CSS event icons, weather/time overlays, and `prefers-reduced-motion` static fallbacks. Only animate `opacity` and `transform`.

- [x] **Step 6: Run focused and full automated tests**

Run:

```bash
pnpm test src/state/ui-flow.test.ts src/state/view-model.test.ts src/ui/GameUi.test.tsx
pnpm test
```

Expected: all focused tests and all existing engine/storage/content tests PASS.

### Task 6: Browser interaction and three-width visual verification

**Files:**
- Modify: `VISUAL-QA.md`

**Interfaces:**
- Consumes: built Vite app and browser-visible daily loop.
- Produces: recorded evidence for navigation, event confirmation, asset loading, motion fallback, and mobile layout.

- [x] **Step 1: Build and serve the project locally**

Run: `pnpm build && pnpm preview --host 127.0.0.1`

Expected: Vite preview starts and relative JS/CSS/assets load without remote requests.

- [x] **Step 2: Exercise the golden daily flow in a real browser**

Open a new game, finish/skip the guide, enter preparation, edit quantity and price, inspect opening summary, skip business playback, select one event option, change to the other, confirm once, inspect the ledger, and continue to the next day.

- [x] **Step 3: Verify error and fallback states**

Confirm image text fallback remains present, reduced-motion suppresses looping movement, event confirm cannot double-submit, and recovery copy identifies what is retained and lost.

- [x] **Step 4: Verify 375×812, 390×844, and 430×932**

At each viewport assert `document.documentElement.scrollWidth === window.innerWidth`, all primary buttons are at least 46px high, the final product row is reachable, event copy is not clipped, and the action dock does not cover the last item.

- [x] **Step 5: Record exact browser evidence in `VISUAL-QA.md`**

Add viewport results, observed asset dimensions, broken-image count, overflow values, minimum control height, daily-flow outcome, and any remaining visual gap.

### Task 7: Final verification and handoff

**Files:**
- Review: every modified file under `projects/04-bianjing-drink-shop`
- Modify: `PROMPTS.md`
- Modify: `VISUAL-QA.md`

**Interfaces:**
- Produces: fresh completion evidence and a project-local change inventory.

- [x] **Step 1: Run the required project checks**

Run: `pnpm lint && pnpm test && pnpm build`

Expected: exit code 0 for all three commands, with zero failing tests.

- [x] **Step 2: Check asset and repository boundaries**

Run:

```bash
find public/assets -type f -printf '%p %s bytes\n' | sort
git diff --check -- projects/04-bianjing-drink-shop
git status --short -- projects/04-bianjing-drink-shop
```

Expected: 15 intended WebP assets, clean diff whitespace, and no changed path outside project 04.

- [x] **Step 3: Inspect for prohibited data and remote runtime dependencies**

Run:

```bash
rg -n "data:.*base64|https?://|Blob\(|serviceWorker|navigator\.mediaDevices" src public index.html
```

Expected: no runtime match; research/document source URLs are outside the scanned runtime paths.

- [x] **Step 4: Update evidence documents with final results**

Record final asset paths/prompts and fresh lint/test/build/browser evidence. Report any unmet item explicitly instead of claiming completion.
