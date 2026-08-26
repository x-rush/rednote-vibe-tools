# 出门检查官 V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This project must be executed inline; do not dispatch subagents and do not perform Git write operations.

**Goal:** Build the approved mobile-first “light outdoor field board” UI, complete its missing checklist interactions, generate its local art assets, and preserve the deterministic offline rule engine.

**Execution status (2026-08-26):** Complete. All tasks were implemented inline, and final verification is recorded in `VISUAL-QA.md` and `PREP_REPORT.md`.

**Architecture:** The existing validated JSON package and pure checklist engine remain the business source of truth. New pure UI view-model helpers derive priority/category/location groups, critical-item mode, route progress, and condition diffs; the reducer owns page/overlay state; the storage adapter owns explicit overwrite and the guide preference; React components consume those typed models without duplicating business content.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Vitest 4, browser localStorage, static SVG/WebP assets, CSS without new dependencies.

**Spec:** `UI-REDESIGN-V2.md`, `INTERACTION-MOTION-SPEC.md`, and `ART-REQUEST.md`

## Global Constraints

- Modify only `projects/06-departure-checker/**`.
- Do not install, update, or remove dependencies and do not modify any lockfile.
- Keep all runtime business content in `src/content/content.json`.
- Pure static frontend; no backend, runtime CDN, external API, location, weather API, Service Worker, online AI, or user media storage.
- Do not save user images, Base64, audio, video, or Blob values.
- Do not perform Git write operations; use verification checkpoints instead of commits.
- Do not remove or weaken existing tests.
- Verify 375×812, 390×844, and 430×932 CSS px.

---

### Task 1: Final art assets and asset manifest

**Files:**
- Create: `public/assets/icons/*.svg` — exactly the 30 files in `ART-REQUEST.md`
- Create: `public/assets/guide/guide-master-v2.webp`
- Create: `public/assets/guide/guide-avatar-v2.webp`
- Create: `src/ui/assets.ts`
- Create: `src/ui/assets.test.ts`

**Interfaces:**
- Produces: `SCENARIO_ICON_PATHS`, `CATEGORY_ICON_PATHS`, `LOCATION_ICON_PATHS`, `STATUS_ICON_PATHS`, `GUIDE_ASSETS`, and `assetPathFor(assetId)`.
- Asset IDs consumed from JSON remain `icon-scenario-*`, `icon-category-*`, and `icon-location-*`.

- [ ] **Step 1: Write the failing asset manifest test**

```ts
import { access, readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import rawContent from '../content/content.json'
import { assetPathFor, GUIDE_ASSETS, STATUS_ICON_PATHS } from './assets'

const ids = [
  ...rawContent.content.scenarios.map((item) => item.iconAssetId),
  ...rawContent.content.categories.map((item) => item.iconAssetId),
  ...rawContent.content.locations.map((item) => item.iconAssetId),
]

describe('art asset manifest', () => {
  it('resolves every displayed content asset to a local file', async () => {
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) await access(`public${assetPathFor(id)}`)
  })

  it('ships uniform accessible SVG files', async () => {
    for (const id of [...ids, ...Object.keys(STATUS_ICON_PATHS)]) {
      const svg = await readFile(`public${assetPathFor(id)}`, 'utf8')
      expect(svg).toContain('viewBox="0 0 24 24"')
      expect(svg).toContain('<title>')
      expect(svg).toContain('stroke-width="2"')
    }
  })

  it('ships both local guide images', async () => {
    await access(`public${GUIDE_ASSETS.master}`)
    await access(`public${GUIDE_ASSETS.avatar}`)
  })
})
```

- [ ] **Step 2: Run the test and verify missing-module failure**

Run: `pnpm test -- src/ui/assets.test.ts`
Expected: FAIL because `src/ui/assets.ts` and resource files do not exist.

- [ ] **Step 3: Create the typed manifest**

```ts
export const SCENARIO_ICON_PATHS = {
  'icon-scenario-commute': '/assets/icons/scenario-commute.svg',
  'icon-scenario-short-trip': '/assets/icons/scenario-short-trip.svg',
  'icon-scenario-exercise': '/assets/icons/scenario-exercise.svg',
  'icon-scenario-date': '/assets/icons/scenario-date.svg',
  'icon-scenario-with-child': '/assets/icons/scenario-with-child.svg',
  'icon-scenario-with-pet': '/assets/icons/scenario-with-pet.svg',
  'icon-scenario-appointment': '/assets/icons/scenario-appointment.svg',
  'icon-scenario-event': '/assets/icons/scenario-event.svg',
} as const

export const CATEGORY_ICON_PATHS = {
  'icon-category-essentials': '/assets/icons/category-essentials.svg',
  'icon-category-electronics': '/assets/icons/category-electronics.svg',
  'icon-category-weather': '/assets/icons/category-weather.svg',
  'icon-category-health': '/assets/icons/category-health.svg',
  'icon-category-work': '/assets/icons/category-work.svg',
  'icon-category-sports': '/assets/icons/category-sports.svg',
  'icon-category-child': '/assets/icons/category-child.svg',
  'icon-category-pet': '/assets/icons/category-pet.svg',
  'icon-category-event': '/assets/icons/category-event.svg',
  'icon-category-confirmation': '/assets/icons/category-confirmation.svg',
  'icon-category-custom': '/assets/icons/category-custom.svg',
} as const

export const LOCATION_ICON_PATHS = {
  'icon-location-desk': '/assets/icons/location-desk.svg',
  'icon-location-charging': '/assets/icons/location-charging.svg',
  'icon-location-bedroom': '/assets/icons/location-bedroom.svg',
  'icon-location-bathroom': '/assets/icons/location-bathroom.svg',
  'icon-location-fridge': '/assets/icons/location-fridge.svg',
  'icon-location-entryway': '/assets/icons/location-entryway.svg',
  'icon-location-documents': '/assets/icons/location-documents.svg',
  'icon-location-pet-area': '/assets/icons/location-pet-area.svg',
  'icon-location-child-area': '/assets/icons/location-child-area.svg',
} as const

export const STATUS_ICON_PATHS = {
  'icon-completion-stamp': '/assets/icons/completion-stamp.svg',
  'icon-partial-available': '/assets/icons/partial-available.svg',
} as const

export const GUIDE_ASSETS = {
  master: '/assets/guide/guide-master-v2.webp',
  avatar: '/assets/guide/guide-avatar-v2.webp',
} as const

const ASSET_PATHS = { ...SCENARIO_ICON_PATHS, ...CATEGORY_ICON_PATHS, ...LOCATION_ICON_PATHS, ...STATUS_ICON_PATHS }
export const assetPathFor = (assetId: string) => ASSET_PATHS[assetId as keyof typeof ASSET_PATHS]
```

- [ ] **Step 4: Produce the three SVG baselines and inspect them at 16/24/32px**

Create `scenario-short-trip.svg`, `category-electronics.svg`, and `location-entryway.svg` first. Every file uses this exact envelope and replaces only `<title>` plus paths:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <title>资源的中文名称</title>
  <!-- resource-specific paths from ART-REQUEST.md -->
</svg>
```

Render the three files on a local resource board at 16, 24, and 32px. Reject any pair whose silhouette cannot be distinguished without labels.

- [ ] **Step 5: Produce the remaining 27 SVG files in ART-REQUEST order**

Each file must use a unique silhouette matching its numbered art brief. Do not use `<text>`, external links, embedded raster data, official document layouts, a red cross, or brand marks.

- [ ] **Step 6: Generate the guide master and avatar**

Generate the 900×1200 master from the frozen prompt in `ART-REQUEST.md` and `research/lulan-reference-dossier.md`. Produce the avatar from that master, preserving the same face, clothing, and shoulder strap; export both as WebP at the listed paths.

- [ ] **Step 7: Run the focused test**

Run: `pnpm test -- src/ui/assets.test.ts`
Expected: PASS, resolving 28 content icons, 2 status icons, and 2 guide images.

---

### Task 2: Pure checklist view models

**Files:**
- Create: `src/ui/checklistView.ts`
- Create: `src/ui/checklistView.test.ts`

**Interfaces:**
- Consumes: `GeneratedChecklist`, `ChecklistCategory[]`, and `ChecklistLocation[]`.
- Produces: `groupChecklist`, `getCriticalRemaining`, `getLocationRoute`, and `diffChecklists`.

- [ ] **Step 1: Write failing view-model tests**

```ts
const checklist = generateChecklist({ scenarioId: 'scenario-short-trip', conditions: { overnight: true } }, content)

it('groups one shared entry set without duplicate IDs', () => {
  for (const mode of ['priority', 'category', 'location'] as const) {
    const groups = groupChecklist(checklist, mode, content.content.categories, content.content.locations)
    const ids = groups.flatMap((group) => group.entries.map((entry) => entry.entryId))
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toHaveLength(checklist.entries.length)
  }
})

it('keeps only unchecked must entries in last-minute mode', () => {
  const checked = setEntryChecked(checklist, checklist.sections.must[0].entryId, true)
  expect(getCriticalRemaining(checked).every((entry) => !entry.checked && entry.priority === 'must')).toBe(true)
})

it('advances to the next unfinished location', () => {
  const route = getLocationRoute(checklist, content.content.locations)
  expect(route.find((stop) => stop.current)?.remaining).toBeGreaterThan(0)
})

it('reports added, removed, and preserved checked IDs', () => {
  const before = setEntryChecked(generateChecklist({ scenarioId: 'scenario-commute', conditions: { rain: true } }, content), 'phone', true)
  const after = generateChecklist({ scenarioId: 'scenario-commute', conditions: { rain: false, battery: 'low' } }, content)
  expect(diffChecklists(before, after)).toMatchObject({ preservedCheckedIds: ['phone'] })
  expect(diffChecklists(before, after).removed.map((entry) => entry.itemId)).toContain('umbrella')
})
```

- [ ] **Step 2: Run and verify missing-module failure**

Run: `pnpm test -- src/ui/checklistView.test.ts`
Expected: FAIL because the four helpers do not exist.

- [ ] **Step 3: Implement focused types and helpers**

```ts
export type ChecklistViewMode = 'priority' | 'category' | 'location'
export type ChecklistGroup = { id: string; label: string; iconAssetId?: string; entries: ChecklistEntry[] }
export type LocationStop = ChecklistGroup & { remaining: number; complete: boolean; current: boolean }
export type ChecklistDiff = {
  next: GeneratedChecklist
  added: ChecklistEntry[]
  removed: ChecklistEntry[]
  preservedCheckedIds: string[]
}
```

Implement grouping from supplied content arrays, filter empty groups, preserve entry object identity, mark the first stop with unchecked entries as current, and use `entry.itemId ?? entry.entryId` as the stable diff key.

- [ ] **Step 4: Run the focused tests**

Run: `pnpm test -- src/ui/checklistView.test.ts`
Expected: PASS.

---

### Task 3: Recoverable content loading

**Files:**
- Modify: `src/content/validate.ts`
- Modify: `src/content/content.test.ts`

**Interfaces:**
- Produces: `loadContentRecoverably(value)`.
- Return type: `{ status: 'ok'; content } | { status: 'recovered'; content; diagnosticCode: 'CONTENT_RULE_REFERENCE' } | { status: 'error'; issues }`.

- [ ] **Step 1: Add failing recovery tests**

```ts
it('drops a rule with a stale item reference and keeps the valid package', () => {
  const candidate = structuredClone(content)
  candidate.content.rules[0].effect.addItemIds = ['missing-item']
  const result = loadContentRecoverably(candidate)
  expect(result.status).toBe('recovered')
  if (result.status === 'recovered') {
    expect(result.diagnosticCode).toBe('CONTENT_RULE_REFERENCE')
    expect(result.content.content.rules.some((rule) => rule.ruleId === candidate.content.rules[0].ruleId)).toBe(false)
  }
})

it('does not pretend a broken scenario base list is partially usable', () => {
  const candidate = structuredClone(content)
  candidate.content.scenarios[0].baseItemIds = ['missing-item']
  expect(loadContentRecoverably(candidate).status).toBe('error')
})
```

- [ ] **Step 2: Run and verify export failure**

Run: `pnpm test -- src/content/content.test.ts`
Expected: FAIL because `loadContentRecoverably` is missing.

- [ ] **Step 3: Implement narrowly scoped recovery**

Clone the input, build the existing item ID set, remove only rules whose effect references a missing item, then run the existing strict `loadContent`. Do not repair scenarios, items, conditions, or arbitrary malformed fields. Return stable diagnostic code `CONTENT_RULE_REFERENCE` without including user-entered conditions.

- [ ] **Step 4: Run content and engine tests**

Run: `pnpm test -- src/content/content.test.ts src/domain/checklist.test.ts`
Expected: PASS.

---

### Task 4: Explicit overwrite and guide preference storage

**Files:**
- Modify: `src/content/schema.ts`
- Modify: `src/storage/checklistStorage.ts`
- Modify: `src/storage/checklistStorage.test.ts`

**Interfaces:**
- `StoragePayload` gains optional `guideDismissed?: boolean`.
- Produces: `save(checklist, overwriteId?)`, returning `overwrite-required` with `candidateId` when full.
- Produces: `setGuideDismissed(value)`.

- [ ] **Step 1: Replace the silent fourth-save expectation with failing explicit-overwrite tests**

```ts
it('requires an explicit target before saving a fourth list', () => {
  const memory = new MemoryStorage()
  const storage = createChecklistStorage(memory, content)
  storage.save(saved('save-1', '2026-08-24T01:00:00.000Z'))
  storage.save(saved('save-2', '2026-08-24T02:00:00.000Z'))
  storage.save(saved('save-3', '2026-08-24T03:00:00.000Z'))
  expect(storage.save(saved('save-4', '2026-08-24T04:00:00.000Z'))).toEqual({
    ok: false, error: 'overwrite-required', candidateId: 'save-1',
  })
  expect(storage.save(saved('save-4', '2026-08-24T04:00:00.000Z'), 'save-1')).toEqual({ ok: true })
  expect(storage.load().payload.savedChecklists.map((item) => item.id)).toEqual(['save-4', 'save-3', 'save-2'])
})

it('persists the guide preference across ordinary writes', () => {
  const memory = new MemoryStorage()
  const storage = createChecklistStorage(memory, content)
  expect(storage.setGuideDismissed(true)).toEqual({ ok: true })
  storage.save(saved('save-1', '2026-08-24T01:00:00.000Z'))
  expect(storage.load().payload.guideDismissed).toBe(true)
})
```

- [ ] **Step 2: Run and verify behavior failures**

Run: `pnpm test -- src/storage/checklistStorage.test.ts`
Expected: FAIL because the current adapter silently trims and does not store the preference.

- [ ] **Step 3: Implement the additive schema and adapter changes**

```ts
export type StorageWriteResult =
  | { ok: true }
  | { ok: false; error: 'storage-corrupt' | 'invalid-data' | 'write-failed' }
  | { ok: false; error: 'overwrite-required'; candidateId: string }
```

Preserve `guideDismissed` in `load`, `save`, `remove`, and `setGuideDismissed`. When three distinct records already exist, choose the oldest by `updatedAt`, return it without writing, and only replace the exact `overwriteId` passed by the caller.

- [ ] **Step 4: Run storage tests**

Run: `pnpm test -- src/storage/checklistStorage.test.ts`
Expected: PASS.

---

### Task 5: Application state for overlays, diffs, custom editing, and last-minute mode

**Files:**
- Modify: `src/app/state.ts`
- Modify: `src/app/state.test.ts`

**Interfaces:**
- Pages: `'home' | 'conditions' | 'generating' | 'checklist' | 'savedLists' | 'summary' | 'error'`.
- Overlays: `'guide' | 'itemDetail' | 'conditionDiff' | 'customEditor' | 'help' | 'overwrite'`.
- Actions include question navigation, diff preview/confirm/cancel, guide/help, custom add/edit/delete, last-minute enter/exit, and overwrite selection.

- [ ] **Step 1: Add failing reducer tests**

```ts
it('opens the guide only when the stored preference is false', () => {
  expect(appReducer(createInitialState([], false), { type: 'select-scenario', scenarioId: 'scenario-commute' }).overlay).toBe('guide')
  expect(appReducer(createInitialState([], true), { type: 'select-scenario', scenarioId: 'scenario-commute' }).overlay).toBeUndefined()
})

it('previews and confirms a condition diff without mutating the old checklist early', () => {
  const oldChecklist = generateChecklist({ scenarioId: 'scenario-commute', conditions: { rain: true } }, content)
  const nextChecklist = generateChecklist({ scenarioId: 'scenario-commute', conditions: { rain: false } }, content)
  let state = { ...createInitialState([], true), page: 'checklist' as const, checklist: oldChecklist }
  state = appReducer(state, { type: 'preview-regeneration', checklist: nextChecklist })
  expect(state.checklist).toBe(oldChecklist)
  expect(state.overlay).toBe('conditionDiff')
  state = appReducer(state, { type: 'confirm-regeneration' })
  expect(state.checklist?.entries.some((item) => item.itemId === 'umbrella')).toBe(false)
})

it('enters and exits last-minute mode without losing checks', () => {
  const checklist = generateChecklist({ scenarioId: 'scenario-short-trip', conditions: {} }, content)
  let state = { ...createInitialState([], true), page: 'checklist' as const, checklist }
  state = appReducer(state, { type: 'enter-last-minute' })
  expect(state.lastMinute).toBe(true)
  state = appReducer(state, { type: 'exit-last-minute' })
  expect(state.lastMinute).toBe(false)
  expect(state.checklist).toBe(checklist)
})
```

Add tests for question index bounds, overlay close behavior, custom item editing with 30-character trimming, saved-list restore/copy, overwrite selection, and error recovery.

- [ ] **Step 2: Run and verify reducer failures**

Run: `pnpm test -- src/app/state.test.ts`
Expected: FAIL on missing state fields and actions.

- [ ] **Step 3: Implement the reducer without DOM effects**

Keep storage calls, timeouts, focus, and scrolling outside the reducer. Store `pendingChecklist` and a typed `checklistDiff` only while the condition-diff overlay is open. Reuse the pure helpers from Task 2.

- [ ] **Step 4: Run reducer and helper tests**

Run: `pnpm test -- src/app/state.test.ts src/ui/checklistView.test.ts`
Expected: PASS.

---

### Task 6: Home, guide, condition wizard, and generation transition

**Files:**
- Create: `src/ui/AssetIcon.tsx`
- Create: `src/ui/GuideSheet.tsx`
- Create: `src/ui/HomeScreen.tsx`
- Create: `src/ui/ConditionWizard.tsx`
- Create: `src/ui/GenerationTransition.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- `AssetIcon({ assetId, label?, className? })` hides on load error and never renders an asset ID.
- `HomeScreen` consumes scenarios and the most recent saved list.
- `ConditionWizard` consumes one `ScenarioQuestion` and one `ConditionDefinition` at a time.
- `GuideSheet` consumes no business rules and emits `onSkip` / `onContinue`.

- [ ] **Step 1: Add failing pure assertions for question rendering data**

Extend `src/ui/checklistView.test.ts` with a `getScenarioQuestions(scenario, content)` test asserting all four questions resolve to a definition and preserve scenario order.

- [ ] **Step 2: Run and verify helper failure**

Run: `pnpm test -- src/ui/checklistView.test.ts`
Expected: FAIL because `getScenarioQuestions` does not exist.

- [ ] **Step 3: Implement `getScenarioQuestions` and the five focused components**

`ConditionWizard` maps input types as follows:

```ts
const inputPresentation = {
  boolean: 'three-choice',
  single: 'option-grid',
  multiple: 'multi-option-grid',
  number: 'number-with-presets',
} as const
```

Use semantic buttons for options, an actual number input for numeric values, `aria-current="step"` for progress, and a sticky bottom action. The app opens directly on `HomeScreen`; remove the extra “开始检查” page.

- [ ] **Step 4: Connect local generation feedback**

Use one cancellable `setTimeout` between 360 and 600ms. The transition text describes local stages only. In reduced-motion mode, CSS hides stage changes but behavior remains deterministic.

- [ ] **Step 5: Run tests, lint, and build checkpoint**

Run: `pnpm test && pnpm lint && pnpm build`
Expected: all pass; the production bundle resolves the new SVG and WebP paths.

---

### Task 7: Checklist workspace, three views, detail, condition diff, and last-minute mode

**Files:**
- Create: `src/ui/ChecklistRow.tsx`
- Create: `src/ui/ChecklistWorkspace.tsx`
- Create: `src/ui/LocationRouteView.tsx`
- Create: `src/ui/ItemDetailSheet.tsx`
- Create: `src/ui/ConditionDiffSheet.tsx`
- Create: `src/ui/LastMinuteMode.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- All three views consume the same `ChecklistEntry` objects and emit `onChecked(entryId, checked)`.
- Item detail consumes one entry and derived category/location labels.
- Last-minute mode consumes `getCriticalRemaining(checklist)`.

- [ ] **Step 1: Add edge-case tests for route and last-minute completion**

```ts
it('has no current route stop when every entry is checked', () => {
  const allChecked = checklist.entries.reduce((value, entry) => setEntryChecked(value, entry.entryId, true), checklist)
  expect(getLocationRoute(allChecked, content.content.locations).some((stop) => stop.current)).toBe(false)
})

it('includes must confirmations and excludes unchecked should entries', () => {
  const remaining = getCriticalRemaining(checklist)
  expect(remaining.some((entry) => entry.entryType === 'confirmation')).toBe(true)
  expect(remaining.some((entry) => entry.priority !== 'must')).toBe(false)
})
```

- [ ] **Step 2: Run and verify any missing edge behavior**

Run: `pnpm test -- src/ui/checklistView.test.ts`
Expected: FAIL until helpers satisfy both edges.

- [ ] **Step 3: Implement shared rows and three view renderers**

Use `entry.entryId` as every React key. Resolve row art from `entry.categoryId` through the content category asset ID; do not request `icon-item-*`. Empty groups are not rendered.

- [ ] **Step 4: Implement detail and diff sheets**

Both sheets use a labelled modal container, close on Escape, and return focus to the triggering button. The detail sheet renders every reason and the official-notice sentence when required. The diff sheet does not dispatch `confirm-regeneration` until its main button is activated.

- [ ] **Step 5: Implement last-minute mode**

Render only unchecked `must` entries, preserve an exit button, use a 64px main action, and send the same `toggle-entry` action as the full list. When no critical entries remain, dispatch `show-summary`.

- [ ] **Step 6: Run tests, lint, and build checkpoint**

Run: `pnpm test && pnpm lint && pnpm build`
Expected: all pass.

---

### Task 8: Custom editor, saved lists, overwrite confirmation, and recovery screens

**Files:**
- Create: `src/ui/CustomItemSheet.tsx`
- Create: `src/ui/SavedListsScreen.tsx`
- Create: `src/ui/OverwriteDialog.tsx`
- Create: `src/ui/RecoveryScreen.tsx`
- Modify: `src/App.tsx`
- Modify: `src/app/state.ts`

**Interfaces:**
- Custom editor returns `{ label, priority, categoryId, locationId }`.
- Saved lists emit continue, copy-and-recalculate, delete, and create-new actions.
- Overwrite dialog emits the exact saved checklist ID selected by the user.

- [ ] **Step 1: Add reducer tests for full custom metadata and copy flow**

```ts
it('adds and edits a custom item with selected metadata', () => {
  const draft = { label: '给朋友的书', priority: 'should' as const, categoryId: 'category-custom', locationId: 'location-desk' }
  const added = appReducer(stateWithChecklist, { type: 'save-custom-entry', entryId: 'custom-1', draft })
  expect(added.checklist?.entries.find((entry) => entry.entryId === 'custom-1')).toMatchObject(draft)
  const edited = appReducer(added, { type: 'save-custom-entry', entryId: 'custom-1', draft: { ...draft, locationId: 'location-entryway' } })
  expect(edited.checklist?.entries.find((entry) => entry.entryId === 'custom-1')?.locationId).toBe('location-entryway')
})
```

Add a test that copy-and-recalculate opens conditions without deleting or mutating the source saved checklist.

- [ ] **Step 2: Run and verify reducer failures**

Run: `pnpm test -- src/app/state.test.ts`
Expected: FAIL until metadata edit and copy state are implemented.

- [ ] **Step 3: Implement the four components and App storage wiring**

When `save` returns `overwrite-required`, open `OverwriteDialog` with its `candidateId`; do not write storage. On confirmation call `save(pendingSavedChecklist, selectedId)`. For corrupt or future storage, render `RecoveryScreen` before accessing a checklist. Use `loadContentRecoverably` to show either normal, partial, or fatal content states.

- [ ] **Step 4: Protect destructive operations**

Deleting custom text, deleting a saved instance, and clearing corrupt storage each require an explicit confirmation. Clearing uses only `STORAGE_KEY`; never call `localStorage.clear()`.

- [ ] **Step 5: Run all automated checks**

Run: `pnpm lint && pnpm test && pnpm build`
Expected: PASS.

---

### Task 9: Visual system, responsive behavior, and motion

**Files:**
- Modify: `src/index.css`
- Modify: `src/App.css`

**Interfaces:**
- Implements tokens and motion from `UI-REDESIGN-V2.md` and `INTERACTION-MOTION-SPEC.md`.
- No component depends on an external font, image host, or CSS library.

- [ ] **Step 1: Replace the scaffold tokens with the approved palette**

```css
:root {
  --paper: #f6f2e8;
  --paper-raised: #fffcf5;
  --ink: #24312d;
  --muted: #68736e;
  --forest: #386b59;
  --forest-dark: #244a3e;
  --mist: #577c87;
  --clay: #c77c45;
  --line: #cfd4cc;
  --danger: #9a4e45;
}
```

- [ ] **Step 2: Implement component layout and minimum targets**

Use a 560px maximum app shell, two-column scenarios at all three mobile widths, 64px checklist rows, 48px ordinary actions, and a 64px last-minute action. Use `minmax(0, 1fr)` for every text-bearing grid column and `overflow-wrap: anywhere` for user text.

- [ ] **Step 3: Implement safe-area and responsive rules**

At 375px use 12px page gutters and 8px card gaps; at 390px use 16px; at 430px use 20px. Every sticky bottom action includes `env(safe-area-inset-bottom)` and must not cover the last focusable row.

- [ ] **Step 4: Implement approved motion and reduced-motion overrides**

Use only selection, row-state, route-progress, sheet, and completion-stamp animations. Under `prefers-reduced-motion: reduce`, remove transforms and animations and cap remaining color transitions at 80ms.

- [ ] **Step 5: Run lint, tests, and build**

Run: `pnpm lint && pnpm test && pnpm build`
Expected: PASS.

---

### Task 10: Browser QA, accessibility inspection, and final report

**Files:**
- Modify: `VISUAL-QA.md`
- Modify: `PREP_REPORT.md`
- Modify: `TODO.md`

**Interfaces:**
- Records exact automated results, browser widths, asset counts, state coverage, and remaining limitations.

- [ ] **Step 1: Run the complete verification gate**

Run: `pnpm lint && pnpm test && pnpm build`
Expected: zero lint errors, all test files and assertions pass, and Vite production build succeeds.

- [ ] **Step 2: Exercise the golden browser flow at 390×844**

Use Playwright CLI to perform: home → short trip → skip guide → overnight → train → skip remaining conditions → generate → check one item → switch category → switch location → open/close detail → modify conditions → confirm diff → enter/exit last-minute → save → open recent list → restore.

- [ ] **Step 3: Verify the three required widths**

At 375×812, 390×844, and 430×932 assert:

```js
({ viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth })
```

Expected at every width: `viewport === scrollWidth`. Capture screenshots of home, conditions, priority checklist, location route, last-minute mode, and recovery state.

- [ ] **Step 4: Check keyboard and reduced motion**

Tab through the full primary flow, verify visible focus, Escape behavior, dialog focus return, native checkbox names, and 44px minimum controls. Emulate reduced motion and verify there is no spinner, list translation, route translation, or stamp transform animation.

- [ ] **Step 5: Update project-local reports**

Record actual resource totals, exact test totals, build artifact sizes, responsive measurements, browser console results, and any remaining non-blocking limitations. Mark completed V2 TODO items without deleting historical context.

- [ ] **Step 6: Verify scope**

Run: `git status --short -- projects/06-departure-checker` and `git diff --check -- projects/06-departure-checker`
Expected: every changed path is inside `projects/06-departure-checker`, with no whitespace errors.
