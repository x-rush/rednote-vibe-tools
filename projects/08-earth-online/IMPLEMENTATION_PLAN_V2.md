# Earth Online Competition UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a competition-ready, mobile-first “living real-world adventurer guild” experience around the existing 100 safe quests, with complete art, explainable matching, recoverable persistence, accessible motion, and a polished end-to-end quest loop.

**Architecture:** Keep quest matching, progression, lifecycle, and storage rules as pure TypeScript modules. Add a separate UI-state reducer for transient presentation state, move all product/business copy into the typed local content package, split the React surface into focused components, and use a thin App controller to coordinate synchronous localStorage persistence plus asynchronous IndexedDB logging. Project art is local: one generated Mira master with deterministic derivatives, plus code-native SVG badges and props.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Vitest 4, browser localStorage/IndexedDB, CSS animations, local SVG/PNG/WebP assets, Playwright CLI for real-browser QA. No new dependencies.

**Spec:** `UI-REDESIGN-V2.md`, `INTERACTION-MOTION-SPEC.md`, `ART-REQUEST.md`

## Global Constraints

- Modify only `projects/08-earth-online/**`; do not modify the workspace root, other projects, root lockfiles, `docs/`, or `prep/`.
- Do not install, upgrade, or remove dependencies.
- Generate all approved art before changing application implementation code.
- Keep all business/product copy in `src/content/content.json`; JSX may only render typed content and short non-business accessibility fallbacks.
- Static frontend only: no backend, runtime CDN/API, Service Worker, geolocation, upload, forced timer, or unapproved device API.
- Persist only stable IDs, numbers, timestamps, booleans, enums, and bounded text; never persist images, Base64, audio/video, Blob, coordinates, or completion proof.
- All sticky/fixed top controls and anchor targets must include `var(--safe-area-inset-top, env(safe-area-inset-top, 0px))` and pass a non-zero simulated inset.
- Main touch targets are at least 44px; primary mobile actions are at least 52px.
- Support `prefers-reduced-motion: reduce` without losing state information.
- Do not perform Git writes; verify only the limited project diff.
- Before completion run `pnpm lint && pnpm test && pnpm build` inside this project and verify 375/390/430 CSS px.

## File Structure

```text
public/assets/earth-online/
├── guide/                 Mira master, avatar, placeholder
├── categories/            10 category SVGs
├── ranks/                 E/D/C SVGs
├── status/                5 state SVGs + completion seal
├── badges/                5 achievement SVGs
└── props/                 6 ambient prop SVGs
src/
├── app/
│   ├── controller.ts      match context, persistence payloads, transition decisions
│   ├── controller.test.ts
│   ├── state.ts           durable app page/domain state
│   └── view-model.ts      typed page and quest presentation models
├── content/
│   ├── content.json       sole business/product copy source
│   ├── schema.ts          UI copy, settings, feedback, and content types
│   └── validate.ts        runtime content/art reference validation
├── domain/
│   ├── matcher.ts         explainable scoring including reversible soft avoidance
│   └── quests.ts          domain state with settings/feedback fields
├── storage/
│   ├── storage.ts         version-compatible local state sanitization
│   └── adventure-log.ts   structured long-term log and feedback
├── ui/
│   ├── state.ts           transient UI reducer
│   ├── state.test.ts
│   ├── asset-paths.ts     stable local asset mapping
│   ├── GuildFrame.tsx
│   ├── MiraGuide.tsx
│   ├── CheckIn.tsx
│   ├── QuestFlow.tsx
│   ├── ArchiveViews.tsx
│   ├── FeedbackSheets.tsx
│   └── render.test.tsx    semantic server-render tests without new libraries
├── styles/
│   ├── tokens.css
│   ├── layout.css
│   ├── components.css
│   └── motion.css
├── App.tsx                thin orchestration
└── App.css                local style imports
```

---

### Task 1: Produce and validate the complete local art set

**Files:**

- Create: `public/assets/earth-online/guide/mira-master-v3.png`
- Create: `public/assets/earth-online/guide/mira-avatar-v3.webp`
- Create: `public/assets/earth-online/guide/mira-placeholder-v3.webp`
- Create: `public/assets/earth-online/categories/category-{rest,tidy,observe,move,create,learn,connect,kind,digital,adventure}.svg`
- Create: `public/assets/earth-online/ranks/rank-{e,d,c}.svg`
- Create: `public/assets/earth-online/status/status-{active,completed,abandoned,unsuitable,temporary}.svg`
- Create: `public/assets/earth-online/status/completion-seal.svg`
- Create: `public/assets/earth-online/badges/badge-{first-quest,five-quests,three-day-streak,level-three,mover}.svg`
- Create: `public/assets/earth-online/props/{ticket-stub,route-slip,backpack-tag,notice-pin,paperclip,guild-brooch}.svg`
- Create after all art exists: `src/content/assets.test.ts`

**Interfaces:**

- Consumes: exact prompts, paths, dimensions, visual semantics, and prohibited elements from `ART-REQUEST.md`.
- Produces: 33 local assets referenced by `asset-paths.ts` and `content.json`; every SVG has a `0 0 48 48` viewBox where it is an icon, a `<title>`, and consistent `2.25` stroke width.

- [x] **Step 1: Generate Mira A01 with the built-in image generation tool**

Use this final prompt exactly as the production brief, allowing only prompt normalization:

```text
Use case: stylized-concept
Asset type: transparent character master for a mobile web app
Primary request: original adult female western-fantasy adventurer guild commission officer named Mira, warm and reliable, waist-up through complete hands
Subject: chestnut-brown braided hair, hazel eyes, midnight-blue and warm-white layered medieval dress, short wine-red shoulder cape, brass fasteners, practical leather belt pouch, original four-direction path brass brooch; one hand holds a completely blank parchment quest ledger, the other makes a restrained open invitation gesture
Style/medium: premium 2D editorial game illustration, refined cel shading with subtle hand-painted texture, adult proportions, original character design
Composition/framing: 3:4 portrait, centered readable silhouette, both hands and ledger fully visible, head and shoulders safe for a square avatar crop
Lighting/mood: soft warm light from upper left, subtle deep-blue rim light from the right, welcoming guild atmosphere
Color palette: midnight blue, warm ivory, wine red, aged brass, chestnut brown
Constraints: genuinely transparent background; no text, logo, watermark, pseudo-writing; blank ledger; anatomically credible hands; no resemblance to an existing commercial game character
Avoid: elf ears, pink or silver hair, green corset, feather collar, spread red cloth, circular waist ornament, maid lace, sexualization, childlike proportions, weapon, wand, wings, modern uniform, clipboard, photorealism
```

- [x] **Step 2: Inspect and persist the selected image**

Use the image viewer to inspect the generated result at original detail. Reject it if hands, ledger, silhouette, costume, or originality fail. Copy the accepted built-in output from its generated-images path to `public/assets/earth-online/guide/mira-master-v3.png`; never leave the project reference pointing outside the workspace.

- [x] **Step 3: Derive avatar and placeholder without identity drift**

Use local `ffmpeg` only for deterministic transforms:

```bash
ffmpeg -y -i public/assets/earth-online/guide/mira-master-v3.png -vf "crop=760:760:163:0,scale=320:320:flags=lanczos" -c:v libwebp -quality 65 public/assets/earth-online/guide/mira-avatar-v3.webp
ffmpeg -y -i public/assets/earth-online/guide/mira-master-v3.png -vf "scale=144:192:force_original_aspect_ratio=decrease" -c:v libwebp -quality 72 public/assets/earth-online/guide/mira-placeholder-v3.webp
```

Confirm both derivatives preserve transparency and identity. If either exceeds its budget, repeat only that conversion at quality 76 for the avatar or 64 for the placeholder; do not alter the accepted master.

- [x] **Step 4: Draw the 30 code-native SVG assets**

Create the 10 category, 3 rank, 5 status, 1 seal, 5 achievement, and 6 prop files using the exact semantic motifs in `ART-REQUEST.md`. Use this icon shell for every 48×48 emblem and replace only title/path geometry:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">
  <title>观察附近</title>
  <path d="M7 24c5-8 11-12 17-12s12 4 17 12c-5 8-11 12-17 12S12 32 7 24Z"/>
  <circle cx="24" cy="24" r="5"/>
  <path d="M24 5v3M40 10l-2 3M8 10l2 3"/>
</svg>
```

Do not use a cross for `tidy` or `kind`; do not use weapons, trophies, coins, loot, or chat-app bubbles.

- [x] **Step 5: Write the asset contract test after assets exist**

```ts
import { readFileSync, statSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('earth online art assets', () => {
  it.each(svgPaths)('%s is a titled local SVG with the expected icon contract', (path) => {
    const source = readFileSync(new URL(`../../public${path}`, import.meta.url), 'utf8')
    expect(source).toContain('<title>')
    expect(source).toContain('viewBox="0 0 48 48"')
    expect(source).toContain('stroke-width="2.25"')
  })
  it('keeps Mira derivatives within their budgets', () => {
    expect(statSync(new URL('../../public/assets/earth-online/guide/mira-avatar-v3.webp', import.meta.url)).size).toBeLessThanOrEqual(24_576)
    expect(statSync(new URL('../../public/assets/earth-online/guide/mira-placeholder-v3.webp', import.meta.url)).size).toBeLessThanOrEqual(8_192)
  })
})
```

- [x] **Step 6: Run the asset test and inspect a contact sheet**

Run: `pnpm test -- src/content/assets.test.ts`
Expected: all asset paths, XML contracts, and derivative budgets pass. Build a temporary browser contact sheet under `.playwright-cli/`, inspect 20/32/48px icon sizes, then remove no final assets.

---

### Task 2: Type and validate all UI copy, settings, and feedback

**Files:**

- Modify: `src/content/content.json`
- Modify: `src/content/schema.ts`
- Modify: `src/content/validate.ts`
- Modify: `src/content/validate.test.ts`
- Modify: `src/content/content.test.ts`

**Interfaces:**

- Consumes: approved page, guide, help, recovery, action, and empty-state copy from `UI-REDESIGN-V2.md`.
- Produces: `UiContent`, `GuildSettings`, `UnsuitableReason`, typed `content.content.ui`, and runtime validation of every referenced asset ID.

- [x] **Step 1: Write failing UI content validation tests**

```ts
it('contains complete UI copy and resolvable art references', () => {
  expect(content.content.ui.intro.lines).toHaveLength(3)
  expect(content.content.ui.navigation.map(({ id }) => id)).toEqual(['guildHall', 'questHistory', 'badgeList', 'adventurerProfile'])
  expect(validateContent(content, 'production').issues).toEqual([])
  expect(content.content.categories.every(({ assetId }) => assetId.startsWith('category-'))).toBe(true)
})
```

- [x] **Step 2: Run the tests to verify the new contract is absent**

Run: `pnpm test -- src/content/validate.test.ts src/content/content.test.ts`
Expected: FAIL because `content.content.ui` and its types/validation do not exist.

- [x] **Step 3: Add exact types**

```ts
export type UnsuitableReason = 'too-tiring' | 'environment' | 'no-time' | 'changed-mind' | 'unsafe-now'
export type GuildSettings = { hasSeenGuide: boolean; softAvoidCategoryIds: QuestCategory[] }
export type UiContent = {
  brand: { eyebrow: string; title: string; description: string }
  navigation: { id: 'guildHall' | 'questHistory' | 'badgeList' | 'adventurerProfile'; label: string }[]
  intro: { name: string; role: string; lines: [string, string, string]; skipLabel: string; nextLabel: string }
  pages: Record<PageCopyId, { eyebrow: string; title: string; description: string }>
  actions: Record<ActionCopyId, string>
  help: { id: string; title: string; body: string }[]
  reasons: Record<UnsuitableReason, string>
  notices: { privacy: string; noProof: string; noPressure: string; temporary: string; indexedDb: string }
}
```

Define `PageCopyId` and `ActionCopyId` as explicit string unions covering every used screen/action; do not use arbitrary `string` keys.

- [x] **Step 4: Add `ui` copy to JSON and validate it**

Move the current `view-model.ts` page copy and all new guide/action/help/recovery copy into `content.content.ui`. Extend `validateContent` to reject missing intro lines, missing page/action keys, invalid navigation IDs, unknown unsuitable reasons, and category/badge asset IDs that do not map to the frozen asset naming scheme.

- [x] **Step 5: Re-run content tests**

Run: `pnpm test -- src/content/validate.test.ts src/content/content.test.ts`
Expected: PASS with exactly 100 unchanged quests and complete UI copy.

---

### Task 3: Add transient UI state and explainable offer state

**Files:**

- Create: `src/ui/state.ts`
- Create: `src/ui/state.test.ts`
- Modify: `src/app/state.ts`
- Modify: `src/app/state.test.ts`
- Modify: `src/app/view-model.ts`
- Modify: `src/app/view-model.test.ts`

**Interfaces:**

- Consumes: `QuestMatch`, `UiContent`, existing `AppState` and `PageState`.
- Produces: `UiState`, `uiReducer`, `OfferExplanation`, and page models whose copy comes from content.

- [x] **Step 1: Write failing reducer tests**

```ts
it('opens and closes confirmation/help states without changing the quest domain', () => {
  const initial = createInitialUiState(false)
  const help = uiReducer(initial, { type: 'OPEN_SHEET', sheet: 'help' })
  expect(help.sheet).toBe('help')
  expect(uiReducer(help, { type: 'CLOSE_SHEET' }).sheet).toBeNull()
})

it('skips the matching ritual immediately under reduced motion', () => {
  const state = uiReducer(createInitialUiState(true), { type: 'START_MATCHING' })
  expect(state.matching).toEqual({ active: true, revealReady: true })
})
```

- [x] **Step 2: Run tests and confirm missing module failure**

Run: `pnpm test -- src/ui/state.test.ts src/app/state.test.ts src/app/view-model.test.ts`
Expected: FAIL because `src/ui/state.ts` and offer explanation support do not exist.

- [x] **Step 3: Implement exact transient state**

```ts
export type UiSheet = 'complete' | 'abandon' | 'unsuitable' | 'help' | null
export type LogFilter = 'all' | 'completed' | 'abandoned' | 'swapped'
export type UiState = {
  introStep: 0 | 1 | 2 | null
  matching: { active: boolean; revealReady: boolean }
  sheet: UiSheet
  logFilter: LogFilter
  temporaryMode: boolean
  reducedMotion: boolean
}
export type OfferExplanation = Pick<QuestMatch, 'score' | 'stage' | 'reasons' | 'relaxed'>
```

Implement explicit actions for intro next/skip, matching start/reveal/end, sheet open/close, log filter, temporary mode, and reduced-motion changes.

- [x] **Step 4: Carry real match explanations in app state**

Change `OFFER_CREATED` and `QUEST_SWAPPED` to include `explanation: OfferExplanation`. Clear the explanation on acceptance/abandonment/completion. Update `createPageViewModel(state, content)` so all page copy comes from `content.content.ui.pages` and quest offer models expose real `reasons`/`relaxed` values.

- [x] **Step 5: Re-run state/view-model tests**

Run: `pnpm test -- src/ui/state.test.ts src/app/state.test.ts src/app/view-model.test.ts`
Expected: PASS for intro, sheets, reduced motion, real explanations, navigation, restore, and completion replay.

---

### Task 4: Make settings, reversible feedback, and persistence outcomes truthful

**Files:**

- Create: `src/app/controller.ts`
- Create: `src/app/controller.test.ts`
- Modify: `src/content/schema.ts`
- Modify: `src/domain/quests.ts`
- Modify: `src/domain/quests.test.ts`
- Modify: `src/domain/matcher.ts`
- Modify: `src/domain/matcher.test.ts`
- Modify: `src/storage/storage.ts`
- Modify: `src/storage/storage.test.ts`
- Modify: `src/storage/adventure-log.ts`
- Modify: `src/storage/adventure-log.test.ts`

**Interfaces:**

- Consumes: `GuildSettings`, `UnsuitableReason`, `GuildDomainState`, `QuestMatch`, `StorageEnvelope`.
- Produces: `createStorageEnvelope`, `persistBeforeTransition`, reversible category avoidance, and structured long-term feedback.

- [x] **Step 1: Write failing controller and matcher tests**

```ts
it('does not announce a persisted transition when localStorage fails', () => {
  const result = persistBeforeTransition(failingStorage, envelope)
  expect(result).toEqual({ kind: 'temporary-required', reason: 'quota-or-unavailable' })
})

it('soft avoidance lowers score but never removes the only safe candidate', () => {
  const result = matchQuest([safeQuest], preference, { ...context, softAvoidCategoryIds: [safeQuest.category] })
  expect(result.kind).toBe('match')
})
```

- [x] **Step 2: Verify the tests fail**

Run: `pnpm test -- src/app/controller.test.ts src/domain/matcher.test.ts src/storage/storage.test.ts`
Expected: FAIL because the controller/settings contracts do not exist.

- [x] **Step 3: Add backward-compatible settings and soft avoidance**

```ts
export type StoragePayload = {
  // existing fields unchanged
  settings: GuildSettings
}

export type MatchContext = {
  // existing fields unchanged
  softAvoidCategoryIds: QuestCategory[]
}
```

When loading an existing schema-v1 payload without settings, default to `{ hasSeenGuide: false, softAvoidCategoryIds: [] }`. Apply `-15` score per soft-avoided category but never hard-filter it. Add pure guild actions to set guide completion, add avoidance, and undo avoidance.

- [x] **Step 4: Implement truthful persistence decisions**

```ts
export type PersistDecision =
  | { kind: 'persisted' }
  | { kind: 'temporary-required'; reason: 'forbidden-data' | 'quota-or-unavailable' }

export function persistBeforeTransition(
  storage: Pick<Storage, 'setItem'>,
  envelope: StorageEnvelope,
): PersistDecision
```

`createStorageEnvelope` must copy only the whitelisted storage payload. App actions that announce offer acceptance or permanent completion may dispatch only after this decision is `persisted`; otherwise UI enters temporary mode.

- [x] **Step 5: Extend structured feedback repository**

Persist `{ questId, category, reason, active, updatedAt }` in the existing `questFeedback` store. Add `undoFeedback(questId, updatedAt)` and ensure no free text is accepted. The memory repository and IndexedDB repository must expose identical behavior.

- [x] **Step 6: Run all domain/storage tests**

Run: `pnpm test -- src/app/controller.test.ts src/domain/quests.test.ts src/domain/matcher.test.ts src/storage/storage.test.ts src/storage/adventure-log.test.ts`
Expected: PASS for old schema recovery, forbidden data, save failure, reversible feedback, soft scoring, and unchanged hard safety gates.

---

### Task 5: Build the shell, Mira guide, hall, and check-in UI

**Files:**

- Create: `src/ui/asset-paths.ts`
- Create: `src/ui/GuildFrame.tsx`
- Create: `src/ui/MiraGuide.tsx`
- Create: `src/ui/CheckIn.tsx`
- Create: `src/ui/render.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.css`
- Create: `src/styles/tokens.css`
- Create: `src/styles/layout.css`
- Create: `src/styles/components.css`
- Create: `src/styles/motion.css`
- Modify: `src/index.css`

**Interfaces:**

- Consumes: `UiContent`, `UiState`, guild/profile ViewModels, local art paths.
- Produces: accessible `GuildFrame`, `MiraGuide`, `GuildHall`, and `CheckIn` components plus the visual token/layout foundation.

- [x] **Step 1: Write failing semantic render tests**

```tsx
it('renders first-run guide with a skip control and no missing business copy', () => {
  const html = renderToStaticMarkup(<MiraGuide copy={content.content.ui.intro} step={0} onNext={noop} onSkip={noop} />)
  expect(html).toContain('主线不用着急')
  expect(html).toContain('<button')
  expect(html).toContain('/assets/earth-online/guide/mira-master-v3.png')
})

it('renders check-in as named fieldsets', () => {
  const html = renderToStaticMarkup(<CheckIn content={content} preference={preference} onChange={noop} onSubmit={noop} />)
  expect(html.match(/<fieldset/g)).toHaveLength(6)
})
```

- [x] **Step 2: Run render tests and verify missing components**

Run: `pnpm test -- src/ui/render.test.tsx`
Expected: FAIL because the UI component modules do not exist.

- [x] **Step 3: Implement stable asset paths and shell semantics**

```ts
export const assets = {
  mira: {
    master: '/assets/earth-online/guide/mira-master-v3.png',
    avatar: '/assets/earth-online/guide/mira-avatar-v3.webp',
    placeholder: '/assets/earth-online/guide/mira-placeholder-v3.webp',
  },
  category: (id: QuestCategory) => `/assets/earth-online/categories/category-${id}.svg`,
  rank: (rank: 'e' | 'd' | 'c') => `/assets/earth-online/ranks/rank-${rank}.svg`,
} as const
```

`GuildFrame` uses semantic header/nav/main/footer, active navigation state, safe-area header padding, and optional nav suppression during focused quest flow.

- [x] **Step 4: Implement Mira guide, hall variants, and check-in**

Guide supports three lines, next, skip, responsive image dimensions, and image-failure fallback. Hall prioritizes active quest when present. Check-in renders exact valid values from content/schema, automatically synchronizes location with indoor/outdoor, and keeps the 0-yuan safety statement non-editable.

- [x] **Step 5: Add the competition visual foundation**

Define all approved colors, type stacks, spacing, radius, shadow, motion, header height, and safe-area tokens. Implement midnight hall, parchment surfaces, notice board, thumb-zone actions, visible focus, mobile single-column layout, and reduced-motion overrides. `App.css` only imports the four focused style sheets.

- [x] **Step 6: Re-run render and existing tests**

Run: `pnpm test -- src/ui/render.test.tsx src/app/view-model.test.ts src/content/content.test.ts`
Expected: PASS with no hardcoded task/UI business copy in JSX.

---

### Task 6: Implement matching ritual, reveal, swap, fallback, and active quest

**Files:**

- Create: `src/ui/QuestFlow.tsx`
- Modify: `src/ui/render.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/app/controller.ts`
- Modify: `src/styles/components.css`
- Modify: `src/styles/motion.css`

**Interfaces:**

- Consumes: real `QuestMatch`, `OfferExplanation`, `persistBeforeTransition`, `Quest`, `UiState`.
- Produces: `MatchingRitual`, `QuestSheet`, `QuestOffer`, and `ActiveQuestView` with truthful match/persistence states.

- [ ] **Step 1: Add failing render tests for exact and relaxed offers**

```tsx
it('renders real relaxed and never-relaxed conditions', () => {
  const html = renderToStaticMarkup(<QuestOffer quest={quest} explanation={{ stage: 'goal-relaxed', score: 80, reasons: ['目标已放宽'], relaxed: ['目标类型'] }} copy={copy} actions={actions} />)
  expect(html).toContain('目标已放宽')
  expect(html).toContain('目标类型')
  expect(html).toContain(quest.abandonRule)
})
```

- [ ] **Step 2: Run the focused test to see the missing component failure**

Run: `pnpm test -- src/ui/render.test.tsx`
Expected: FAIL because `QuestFlow.tsx` is absent.

- [ ] **Step 3: Implement matching and reveal components**

`MatchingRitual` receives actual selected condition labels and exposes a skip button. `QuestSheet` always renders category, rank, title, description, time, energy, environment, social, 0 yuan, steps, reason, and abandon rule. `QuestOffer` shows relaxed conditions before the paper whenever `stage !== 'exact'`.

- [ ] **Step 4: Coordinate match, save, reveal, swap, and accept**

In App, calculate the match synchronously, dispatch `START_MATCHING`, wait only for the visual minimum when motion is allowed, call `persistBeforeTransition` for the offered guild state, then dispatch the offer and reveal. Swap keeps the old paper readable until a new result exists. Accept persists the active state before displaying the brass accepted seal. Failures enter temporary recovery without a false success state.

- [ ] **Step 5: Implement paper motion with reduced-motion equivalence**

Add board stagger, condition-tag confirmation, paper lift/reveal, board reorder, and accept-stamp classes using only transform/opacity. Under reduced motion, all transitions are at most 100ms and no artificial matching delay is used.

- [ ] **Step 6: Run focused and full domain tests**

Run: `pnpm test -- src/ui/render.test.tsx src/app/controller.test.ts src/app/state.test.ts src/domain/matcher.test.ts src/domain/quests.test.ts`
Expected: PASS for exact, relaxed, no-match, save failure, swap, accept, and active quest rendering.

---

### Task 7: Complete settlement, feedback, archive, profile, help, and recovery

**Files:**

- Create: `src/ui/ArchiveViews.tsx`
- Create: `src/ui/FeedbackSheets.tsx`
- Modify: `src/ui/render.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/app/controller.ts`
- Modify: `src/styles/components.css`
- Modify: `src/styles/motion.css`

**Interfaces:**

- Consumes: completion result, adventure log summary/repository, badge/category definitions, profile ViewModel, `UiSheet`, persistence decisions.
- Produces: confirmation sheets, XP receipt, log filters, category codex, badge shelf, profile, Mira help, and truthful recovery panels.

- [ ] **Step 1: Add failing render tests for completion, abandonment, archives, and recovery**

```tsx
it('renders completion without monetary or streak-pressure language', () => {
  const html = renderToStaticMarkup(<XpReceipt awardedXp={20} completionText={quest.completionText} profile={profile} newBadges={[]} copy={copy} />)
  expect(html).toContain('+20 XP')
  expect(html).not.toMatch(/金币|断签|战斗力/)
})

it('labels temporary mode without claiming permanent rewards', () => {
  const html = renderToStaticMarkup(<RecoveryPanel kind="temporary" copy={copy} />)
  expect(html).toContain('关闭页面后')
  expect(html).toContain('不会写入')
})
```

- [ ] **Step 2: Run focused tests and confirm missing views**

Run: `pnpm test -- src/ui/render.test.tsx`
Expected: FAIL because archive/feedback/recovery components are absent.

- [ ] **Step 3: Implement confirmation and result sheets**

Completion sheet repeats the quest title and invokes the idempotent domain completion only after confirmation. Abandon sheet records one optional enum reason. Unsuitable sheet records one enum reason, adds a reversible category soft avoidance, and treats `unsafe-now` as an immediate stop recommendation rather than a mere weight change.

- [ ] **Step 4: Implement archive and profile views**

Log supports `all/completed/abandoned/swapped` filters and removed-content titles. Category codex derives completion counts from structured history. Badge shelf uses five real badge SVGs and explicit unlock conditions. Profile shows level, total XP, in-level XP, next threshold, completed count, current/best record, and low-pressure explanation.

- [ ] **Step 5: Wire IndexedDB with explicit degradation**

Create the repository once, append completed/abandoned entries after permanent localStorage success, and record/undo structured feedback. If IndexedDB fails, keep the finite localStorage flow and surface the `indexedDb` notice. Never roll back a correctly persisted localStorage completion merely because long-term logging failed.

- [ ] **Step 6: Implement help and recovery**

Mira help sheet renders five content-driven sections and restores focus to its trigger. Recovery distinguishes no-match, corrupt/future local state, localStorage write failure/temporary mode, and IndexedDB degradation. Corrupt storage is not overwritten until the user explicitly confirms reset.

- [ ] **Step 7: Add settlement and archive motion**

Implement completion stamp, ink spread, XP number transition, badge edge illumination, log intake, and paper-return motion. Ensure replayed completion returns zero award and does not re-run reward motion.

- [ ] **Step 8: Run the full test suite**

Run: `pnpm test`
Expected: all content, state, view-model, domain, persistence, asset, and semantic render tests pass.

---

### Task 8: Browser QA, safe-area verification, performance polish, and final checks

**Files:**

- Create: `design/preview-v2.html` only if it is generated from or directly embeds the final production component states; do not maintain a divergent second UI.
- Modify: `VISUAL-QA.md`
- Modify: `PREP_REPORT.md`
- Modify: any project-local source/test file needed to fix discovered defects.

**Interfaces:**

- Consumes: the complete production build.
- Produces: verified mobile behavior, updated QA evidence, and a clean limited diff.

- [ ] **Step 1: Start the real app and exercise the golden flow**

Run `pnpm dev --host 127.0.0.1`, open it through the Playwright CLI, snapshot before every interaction, and exercise:

```text
first guide → check-in → matching → reveal → accept → refresh → active quest
→ completion confirm → XP receipt → adventure log → badge/profile
```

Expected: state survives refresh, task copy is real content, XP applies once, and no console error or broken image occurs.

- [ ] **Step 2: Exercise recovery and feedback flows**

Verify swap, non-exact explanation, no-match, abandon, unsuitable/undo, help focus return, corrupt local state, simulated localStorage failure/temporary mode, and IndexedDB degradation. Expected: no false “saved” or permanent reward claims.

- [ ] **Step 3: Verify the required mobile sizes**

At 375×812, 390×844, and 430×932 assert:

```js
document.documentElement.scrollWidth <= window.innerWidth
```

Measure all primary controls at ≥52px and all other controls at ≥44px. Use the longest 27-character quest title and longest description/exit copy.

- [ ] **Step 4: Verify a non-zero safe area and anchor targets**

Set `--safe-area-inset-top: 32px` on `:root`, repeat hall, check-in, offer, active, help, and archive screenshots, and verify sticky/fixed controls plus all focused/anchor targets remain below the simulated status bar.

- [ ] **Step 5: Verify accessibility and reduced motion**

Use keyboard-only navigation through nav, check-in, offer, sheets, help, and archive. Emulate reduced motion and confirm no decorative motion exceeds 100ms, matching has no artificial delay, and final state/live text remains present.

- [ ] **Step 6: Update project QA documents with measured evidence**

Record exact state coverage, three viewport results, 32px safe-area result, broken-image count, min target size, reduced-motion behavior, asset count/budgets, test counts, build size, storage degradation behavior, and any remaining known limitation in `VISUAL-QA.md` and `PREP_REPORT.md`.

- [ ] **Step 7: Run mandatory verification**

Run:

```bash
pnpm lint && pnpm test && pnpm build
git diff --check -- .
git status --short -- .
git diff --stat -- .
```

Expected: lint exit 0; every test passes; TypeScript/Vite build exits 0; no whitespace error; all changed/untracked paths remain under `projects/08-earth-online`.
