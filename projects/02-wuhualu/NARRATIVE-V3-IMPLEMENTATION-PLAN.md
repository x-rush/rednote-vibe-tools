# Xu Zhao Narrative Arc Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a prologue, five collection-driven Xu Zhao interludes, a 20/20 finale, deterministic guide-line rotation, and replayable completion UI without changing the existing artifact play loop.

**Architecture:** Runtime narrative copy lives in `src/content/content.json` and is validated with the rest of the production package. Pure helpers derive unlocked chapters and stable dialogue variants; the reducer owns first-play/deferral/resume state, while a focused `NarrativeInterlude` component renders the mobile GALGAME presentation. Existing collection and session data migrate in place by adding sanitized stable-ID arrays.

**Tech Stack:** React 19, TypeScript, Vitest, Vite, CSS, localStorage, local WebP assets.

**Spec:** `projects/02-wuhualu/NARRATIVE-V3-SPEC.md`

## Global Constraints

- Modify only `projects/02-wuhualu`; do not change root manifests, lockfiles, other projects, `docs/`, or `prep/`.
- Add no dependency and use no backend, runtime CDN, required external API, Service Worker, Node runtime API, or unconfirmed device API.
- Put all runtime business copy in `src/content/content.json`.
- Persist only structured stable IDs; never store images, Base64, audio, video, Blob, or remote URLs.
- Keep all 20 existing artifact observation, clue, answer, five-section story, memory, and archive data unchanged.
- Validate at 375, 390, and 430 CSS px.
- Before the final commit run `pnpm lint && pnpm test && pnpm build`; do not remove tests.

---

### Task 1: Narrative content contract and production copy

**Files:**
- Modify: `src/content/types.ts`
- Modify: `src/content/validate.ts`
- Modify: `src/content/content.json`
- Modify: `src/content/content.test.ts`

**Interfaces:**
- Consumes: existing `WuhualuContentPackage` and `validateContent(input)`.
- Produces: `NarrativeContent`, `NarrativeChapter`, `NarrativeBeat`, `NarrativeChapterId`, and `content.content.narrative`.

- [ ] **Step 1: Write failing content-contract tests**

Add tests that assert observable validation behavior and the hand-derived production milestones:

```ts
it('ships the complete fictional Xu Zhao arc at ordered collection milestones', () => {
  const parsed = parseContent(content)
  expect(parsed.content.narrative.chapters.map(({ id, unlockCount }) => [id, unlockCount])).toEqual([
    ['act-1', 1], ['act-2', 4], ['act-3', 8],
    ['act-4', 12], ['act-5', 16], ['finale', 20],
  ])
  expect(parsed.content.narrative.chapters.every(chapter => chapter.beats.length >= 3 && chapter.beats.length <= 5)).toBe(true)
})

it('rejects a narrative chapter whose milestone or image asset is invalid', () => {
  const broken = structuredClone(content)
  broken.content.narrative.chapters[1].unlockCount = 3
  broken.content.narrative.chapters[1].imageAssetId = 'https://example.com/x.webp'
  expect(validateContent(broken).issues.map(({ path }) => path)).toContain('$.content.narrative.chapters[1].unlockCount')
  expect(validateContent(broken).issues.map(({ path }) => path)).toContain('$.content.narrative.chapters[1].imageAssetId')
})
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm test -- src/content/content.test.ts`

Expected: TypeScript/runtime failure because `content.narrative` and its validation do not exist.

- [ ] **Step 3: Add the minimal types and validation**

Define the exact contract:

```ts
export type NarrativeChapterId = 'act-1' | 'act-2' | 'act-3' | 'act-4' | 'act-5' | 'finale'
export type NarrativeBeat = { id: string; speaker: '许照' | '旁白'; body: string }
export type NarrativeChapter = {
  id: NarrativeChapterId
  unlockCount: 1 | 4 | 8 | 12 | 16 | 20
  eyebrow: string
  title: string
  summary: string
  imageAssetId: string
  beats: NarrativeBeat[]
  actionLabel: string
}
export type NarrativeContent = {
  fictionLabel: string
  journalTitle: string
  journalIntro: string
  recentArtifactResponseTemplate: string
  prologue: NarrativeBeat[]
  chapters: NarrativeChapter[]
  completionSeal: string
  completionLine: string
}
```

Validate exact IDs and milestones, stable beat IDs, 3–5 beats per chapter, non-empty short copy, local `asset-*` IDs, unique IDs, and ordered thresholds. Add `narrative: NarrativeContent` to the content package.

- [ ] **Step 4: Write the production narrative in `content.json`**

Set `contentVersion` to `3.1.0-narrative-arc`. Add the prologue and six chapters described in the spec, using 3–5 mobile-length beats per chapter. Mark every scene with the fiction label and keep all historical claims outside the fictional beats.

- [ ] **Step 5: Run content tests and verify GREEN**

Run: `pnpm test -- src/content/content.test.ts`

Expected: all content tests pass and production validation has zero issues.

- [ ] **Step 6: Commit the content contract**

```bash
git add projects/02-wuhualu/src/content
git commit -m "feat(wuhualu): add Xu Zhao narrative content"
```

---

### Task 2: Pure milestone and dialogue-selection logic

**Files:**
- Create: `src/narrative/narrative.ts`
- Create: `src/narrative/narrative.test.ts`

**Interfaces:**
- Consumes: `NarrativeChapter`, `NarrativeChapterId`, collection count, stable string inputs.
- Produces:
  - `unlockedNarrativeChapters(chapters, collectionCount): NarrativeChapter[]`
  - `nextUnreadNarrativeChapter(chapters, collectionCount, seenIds, deferredIds): NarrativeChapter | null`
  - `pickGuideLine(lines, roundSeed, artifactId, phase): string`
  - `formatRecentArtifactResponse(template, artifactName, evidenceLabel): string`

- [ ] **Step 1: Write failing pure-logic tests**

```ts
it('unlocks milestones in order and returns the first unseen non-deferred chapter', () => {
  expect(unlockedNarrativeChapters(chapters, 8).map(({ id }) => id)).toEqual(['act-1', 'act-2', 'act-3'])
  expect(nextUnreadNarrativeChapter(chapters, 8, ['act-1'], ['act-2'])?.id).toBe('act-3')
})

it('keeps a guide line stable within a round and rotates across seeds', () => {
  const lines = ['甲', '乙', '丙']
  expect(pickGuideLine(lines, 'round-a', 'artifact-a', 'reveal')).toBe(pickGuideLine(lines, 'round-a', 'artifact-a', 'reveal'))
  expect(new Set(['round-a', 'round-b', 'round-c', 'round-d'].map(seed => pickGuideLine(lines, seed, 'artifact-a', 'reveal'))).size).toBeGreaterThan(1)
})

it('formats the recent-artifact response without moving copy into TypeScript', () => {
  expect(formatRecentArtifactResponse('你记住了「{artifact}」的{evidence}。', '贾湖骨笛', '成列音孔')).toBe('你记住了「贾湖骨笛」的成列音孔。')
})
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm test -- src/narrative/narrative.test.ts`

Expected: module-not-found failure because the narrative helper does not exist.

- [ ] **Step 3: Implement minimal pure helpers**

Use a small deterministic 32-bit string hash over `${roundSeed}:${artifactId}:${phase}`. Return an empty string only when `lines` is empty. Replace only `{artifact}` and `{evidence}` placeholders in the template. Do not read global state or call `Math.random()`.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `pnpm test -- src/narrative/narrative.test.ts`

Expected: all narrative helper tests pass.

- [ ] **Step 5: Commit pure narrative logic**

```bash
git add projects/02-wuhualu/src/narrative
git commit -m "feat(wuhualu): derive narrative milestones"
```

---

### Task 3: Backward-compatible narrative persistence

**Files:**
- Modify: `src/content/types.ts`
- Modify: `src/storage/storage.ts`
- Modify: `src/storage/storage.test.ts`

**Interfaces:**
- Consumes: `NarrativeChapterId` and existing schema-1 payloads.
- Produces: `StoragePayload.seenNarrativeIds`, `StoragePayload.deferredNarrativeIds`, sanitized load behavior, and empty defaults.

- [ ] **Step 1: Write failing migration and sanitation tests**

```ts
it('adds empty narrative progress while preserving an older collection', () => {
  // Store a valid schema-1 payload without narrative fields.
  const loaded = loadStorage(storage, validIds, '3.1.0-narrative-arc', now)
  expect(loaded.payload.collection.map(({ artifactId }) => artifactId)).toEqual(['artifact-a'])
  expect(loaded.payload.seenNarrativeIds).toEqual([])
  expect(loaded.payload.deferredNarrativeIds).toEqual([])
})

it('deduplicates valid narrative IDs and drops unknown IDs', () => {
  // Store ['act-1', 'act-1', 'bad'] and ['act-2', 'bad'].
  expect(loaded.payload.seenNarrativeIds).toEqual(['act-1'])
  expect(loaded.payload.deferredNarrativeIds).toEqual(['act-2'])
  expect(loaded.recovery).toBe('sanitized-references')
})
```

- [ ] **Step 2: Run storage tests and verify RED**

Run: `pnpm test -- src/storage/storage.test.ts`

Expected: missing narrative progress properties.

- [ ] **Step 3: Implement optional-field migration**

Add both arrays to `StoragePayload` and `createDefaultStoragePayload`. Normalize against the exact chapter-ID set, deduplicate, remove IDs already seen from deferred, and include sanitation in the existing recovery calculation. Do not clear collection or learning progress when the fields are absent.

- [ ] **Step 4: Run storage tests and verify GREEN**

Run: `pnpm test -- src/storage/storage.test.ts`

Expected: all storage tests pass, including media rejection.

- [ ] **Step 5: Commit persistence changes**

```bash
git add projects/02-wuhualu/src/content/types.ts projects/02-wuhualu/src/storage
git commit -m "feat(wuhualu): persist narrative progress"
```

---

### Task 4: Reducer-driven interlude lifecycle

**Files:**
- Modify: `src/state/game-state.ts`
- Modify: `src/state/game-state.test.ts`

**Interfaces:**
- Consumes: `nextUnreadNarrativeChapter`, `NarrativeChapter[]`, and persisted progress arrays.
- Produces: `narrativeInterlude` app state and actions `openPendingNarrative`, `completeNarrative`, `deferNarrative`, `replayNarrative`.

- [ ] **Step 1: Write failing state-machine tests**

Cover these observable transitions with real content and reducer actions:

```ts
it('opens act one after the first archive and resumes the next question after completion', () => {
  // Complete the first current artifact through the existing real flow.
  state = appReducer(state, { type: 'nextQuestion', narrative: content.content.narrative.chapters })
  expect(state.screen).toBe('narrativeInterlude')
  if (state.screen !== 'narrativeInterlude') throw new Error('expected interlude')
  expect(state.chapterId).toBe('act-1')
  state = appReducer(state, { type: 'completeNarrative' })
  expect(state.payload.seenNarrativeIds).toEqual(['act-1'])
  expect(state.screen).toBe('observation')
})

it('does not replay a seen milestone and preserves a pending set-complete continuation', () => {
  // Archive the fourth item of a set, leave its seal, show act two, then continue.
  expect(afterInterlude.screen).toBe('observation')
  expect(afterInterlude.payload.setSealIds).toContain(completedSetId)
})

it('queues act five before the finale at twenty collected artifacts', () => {
  expect(first.chapterId).toBe('act-5')
  expect(appReducer(first, { type: 'completeNarrative' }).chapterId).toBe('finale')
})
```

- [ ] **Step 2: Run reducer tests and verify RED**

Run: `pnpm test -- src/state/game-state.test.ts`

Expected: new actions/state are absent.

- [ ] **Step 3: Implement explicit continuation state**

Add:

```ts
type NarrativeResumeTarget =
  | { kind: 'advance'; resultState: ResultCore }
  | { kind: 'modeSelect' }
  | { kind: 'collection'; returnTo: 'landing' | 'summary'; summarySession: QuizSession | null }

type NarrativeInterludeState = StoredState & {
  screen: 'narrativeInterlude'
  chapterId: NarrativeChapterId
  replay: boolean
  resumeTarget: NarrativeResumeTarget
}
```

Keep continuation data in memory only; persist only seen/deferred IDs. Route from archive/set-complete exit after the current archive screen has been viewed. `completeNarrative` marks the ID seen, removes it from deferred, then immediately checks whether another unlocked required chapter must precede the finale; otherwise resume. `deferNarrative` records the ID and returns to the continuation. `replayNarrative` never edits seen/deferred arrays.

- [ ] **Step 4: Run reducer tests and verify GREEN**

Run: `pnpm test -- src/state/game-state.test.ts`

Expected: all old and new state-machine tests pass.

- [ ] **Step 5: Commit reducer changes**

```bash
git add projects/02-wuhualu/src/state
git commit -m "feat(wuhualu): route collection story interludes"
```

---

### Task 5: Mobile GALGAME interlude and completion UI

**Files:**
- Create: `src/ui/NarrativeInterlude.tsx`
- Create: `src/ui/NarrativeInterlude.test.tsx`
- Create: `src/ui/guide-assets.ts`
- Modify: `src/App.tsx`
- Modify: `src/App.css`
- Modify: `src/app/page-model.ts`
- Modify: `src/app/page-model.test.ts`
- Modify: collection/task-board UI files only where needed for replay and completion entry.

**Interfaces:**
- Consumes: `NarrativeChapter`, guide image resolver, reducer actions, collection count, `completionSeal`, and `completionLine`.
- Produces: `resolveGuideAsset(imageAssetId)`, beat-by-beat large-portrait dialogue, deferred/replay actions, task-board journal, and 20/20 completion seal.

- [ ] **Step 1: Write failing component and page-model tests**

```tsx
it('renders one mobile-readable beat with the fictional-story boundary', () => {
  const markup = renderToStaticMarkup(<NarrativeInterlude chapter={chapter} fictionLabel="馆内叙事 · 虚构角色线" beatIndex={0} onContinue={() => {}} onDefer={() => {}} />)
  expect(markup).toContain('馆内叙事 · 虚构角色线')
  expect(markup).toContain(chapter.beats[0].body)
  expect(markup).not.toContain(chapter.beats[1].body)
  expect(markup).toContain('narrative-interlude__portrait')
})

it('exposes the journal on the task board and a finale replay at 20/20', () => {
  const model = buildNarrativeJournalModel(narrative, 20, ['act-1', 'act-2', 'act-3', 'act-4', 'act-5', 'finale'])
  expect(model.complete).toBe(true)
  expect(model.replayableIds).toContain('finale')
})

it('keeps the prologue inside the existing first-time guide instead of adding another blocking screen', () => {
  const markup = renderToStaticMarkup(<IntroPage narrative={narrative} />)
  expect(markup).toContain(narrative.prologue[0].body)
  expect(markup).toContain(narrative.prologue[1].body)
  expect(markup).toContain(copy.introObserveTitle)
})
```

- [ ] **Step 2: Run focused UI tests and verify RED**

Run: `pnpm test -- src/ui/NarrativeInterlude.test.tsx src/app/page-model.test.ts`

Expected: missing component/model behavior.

- [ ] **Step 3: Implement the component and application wiring**

Render one beat at a time; keep the beat index local and reset when `chapter.id` changes. Use a real `<button>` for progression and deferral, semantic speaker text, a decorative portrait alt for repeated character imagery, and the fiction boundary in visible text. Resolve the three guide asset IDs in `guide-assets.ts` to project paths; copy remains in JSON. Render all prologue beats inside the existing intro page around the existing three teaching steps, so onboarding gains context without another screen.

Use `pickGuideLine` in wrong-review, reveal, archive, contextual help, and set-complete sites with the current round seed. For act three, format `recentArtifactResponseTemplate` with the latest collection entry's artifact name and its first observed evidence label; if learning progress is absent, use the artifact summary as the evidence value. Add the journal entry to mode selection and the completion seal/replay action to the collection header.

- [ ] **Step 4: Add responsive styling**

At 375–430 px, allocate approximately 46–52svh to the portrait and keep the dialogue/actions below it. Use `object-fit: cover` with `object-position: 50% 18%` and safe padding so head/hands remain visible. Add only opacity/translate animations of 180–240ms; remove translate and portrait scaling under `prefers-reduced-motion` and `.reduced-motion`.

- [ ] **Step 5: Run focused and full tests and verify GREEN**

Run: `pnpm test -- src/ui/NarrativeInterlude.test.tsx src/app/page-model.test.ts src/state/game-state.test.ts`

Expected: all tests pass with no SSR warning.

- [ ] **Step 6: Commit UI integration**

```bash
git add projects/02-wuhualu/src
git commit -m "feat(wuhualu): present Xu Zhao story interludes"
```

---

### Task 6: Identity-preserving Xu Zhao chapter and finale art

**Files:**
- Create: `public/assets/wuhualu/guide/guide-journal-v1.webp`
- Create: `public/assets/wuhualu/guide/guide-finale-v1.webp`
- Modify: `public/assets/asset-manifest.json`
- Modify: `ART-REQUEST.md`
- Modify: `src/ui/artifact-assets.test.ts`

**Interfaces:**
- Consumes: existing `guide-master-v1.webp` as the identity edit target and the exact art direction in the spec.
- Produces: two local 900×1200 WebP files and manifest entries matching content image asset IDs.

- [ ] **Step 1: Write a failing asset-contract test**

Add a real file/dimension test that expects both narrative asset IDs to resolve, both files to exist locally, and each decoded/inspected dimension to equal 900×1200. The production change that makes the test pass is adding the two approved local assets and resolver entries.

- [ ] **Step 2: Run the focused asset test and verify RED**

Run: `pnpm test -- src/ui/artifact-assets.test.ts`

Expected: missing asset/resolver entries.

- [ ] **Step 3: Generate two identity-preserving edits**

Use the built-in image generation edit flow after viewing `guide-master-v1.webp`.

Journal prompt invariants: same woman, facial identity, hair, deep-blue work coat, white shirt, magnifier pendant; night archive desk; both hands on a blank cream journal; no readable text, artifacts, watermark, extra person, or cropped head/hands.

Finale prompt invariants: same identity/clothes/hair/pendant; dawn archive room; closes a blank journal and looks toward player with a restrained warm smile; no readable text, artifacts, watermark, extra person, or cropped head/hands.

Inspect both results, reject identity drift or unsafe crops, convert approved masters to 900×1200 WebP, and copy them into the project.

- [ ] **Step 4: Update manifest and art documentation**

Add exact dimensions, byte counts, role, identity source, mobile safe zones, and AI fictional-character labels. Do not claim these images depict a real museum worker.

- [ ] **Step 5: Run the asset test and verify GREEN**

Run: `pnpm test -- src/ui/artifact-assets.test.ts`

Expected: both local assets resolve and pass dimensions/size checks.

- [ ] **Step 6: Commit approved art**

```bash
git add projects/02-wuhualu/public/assets projects/02-wuhualu/ART-REQUEST.md projects/02-wuhualu/src
git commit -m "feat(wuhualu): add Xu Zhao narrative portraits"
```

---

### Task 7: Regression, mobile browser QA, review, and final handoff

**Files:**
- Modify only files required by a test-backed defect found during verification.

**Interfaces:**
- Consumes: complete narrative implementation and local production build.
- Produces: verified 02 project with no Critical/Important review findings and a clean project worktree.

- [ ] **Step 1: Run static and automated verification**

Run: `pnpm lint && pnpm test && pnpm build`

Expected: lint clean, every test file passes, TypeScript build and Vite production build succeed.

- [ ] **Step 2: Run mobile browser QA at all required widths**

With a real browser against the production preview, validate 375×900, 390×900, and 430×900:

- no horizontal overflow (`documentElement.scrollWidth === innerWidth`);
- no completed image with `naturalWidth === 0`;
- portrait head and hands remain inside the visible media region;
- every beat, defer action, finale completion, journal replay, and 20/20 collection return is reachable by touch;
- reduced-motion mode removes translation/scale motion.

- [ ] **Step 3: Request independent code review**

Review only Critical and Important findings for content boundary, migration loss, duplicate triggers, inaccessible controls, broken resume targets, or other-project edits. Fix every confirmed finding with a failing regression test first.

- [ ] **Step 4: Re-run final verification after review fixes**

Run: `pnpm lint && pnpm test && pnpm build`

Expected: clean output after the final source change.

- [ ] **Step 5: Inspect scope and commit any final fixes**

```bash
git diff --check -- projects/02-wuhualu
git status --short -- projects/02-wuhualu
git add projects/02-wuhualu
git commit -m "feat(wuhualu): complete Xu Zhao narrative arc"
```

Confirm staged and committed paths belong only to `projects/02-wuhualu`.
