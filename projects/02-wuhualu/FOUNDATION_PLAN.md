# 器华录 FOUNDATION Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. User constraints forbid subagent dispatch and all Git write operations.

**Goal:** Build the complete, deterministic, locally persisted FOUNDATION for the 20-artifact Wuhualu guessing and collection game.

**Architecture:** One validated `content.json` feeds focused pure-function modules for selection, scoring, collection, view models, state transitions, and storage. React consumes those types and view models through a semantic single-page skeleton; all random and persistent boundaries are injectable.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Vitest 4, Oxlint, browser localStorage.

**Spec:** `FOUNDATION_DESIGN.md`

## Global Constraints

- Modify only `projects/02-wuhualu/**`; all workspace and sibling files are read-only.
- Do not add, remove, install, or upgrade dependencies; do not modify any lockfile.
- Do not perform Git write operations.
- Keep all business content in `src/content/content.json`.
- Static frontend only: no backend, runtime CDN/API, Service Worker, Node runtime API, or unconfirmed device API.
- Never persist images, Base64, audio, video, or Blob values.
- Do not generate or download artwork in this phase.
- Write each behavior test first, run it and observe the expected failure, then add the minimum implementation.
- Final verification is exactly `pnpm lint`, `pnpm test`, and `pnpm build` from the project directory, followed by scoped read-only diffs.

---

### Task 1: Content package, domain types, and production validation

**Files:**
- Replace: `src/content/content.json`
- Replace: `src/content/content.test.ts`
- Create: `src/content/types.ts`
- Create: `src/content/validate.ts`

**Interfaces:**
- Produces: `WuhualuContentPackage`, `Artifact`, `ArtifactCategory`, `ArtifactClue`, `AssetReference`, `DistractorCandidate`, and `validateContent(input: unknown): ContentValidationResult`.
- Produces: `parseContent(input: unknown): WuhualuContentPackage`, throwing `ContentValidationError` with path-based issues when invalid.
- Consumes: only the frozen Markdown content copied into the JSON package.

- [x] **Step 1: Replace the scaffold content test with failing production-envelope and count tests**

```ts
const result = validateContent(content)
expect(result.issues).toEqual([])
expect(content.content.artifacts).toHaveLength(20)
expect(new Set(content.content.artifacts.map(({ id }) => id)).size).toBe(20)
```

- [x] **Step 2: Run `pnpm test -- src/content/content.test.ts` and verify failure because production content/types/validator are absent**

- [x] **Step 3: Add failing table-driven tests for three clues, legal asset IDs, source references, allowed tags, unlock copy, and nonexistent Artifact references**

```ts
for (const artifact of content.content.artifacts) {
  expect(artifact.clues.map(({ level }) => level)).toEqual([1, 2, 3])
  expect(artifact.assetRefs.fallbackAssetId).toMatch(/^asset-[a-z0-9-]+$/)
  expect(artifact.unlockCopy.trim().length).toBeGreaterThan(0)
}
```

- [x] **Step 4: Mechanically encode the 20 artifacts, categories, sources, authored distractor candidates, UI copy, rules, and planned asset manifest in `content.json`**

- [x] **Step 5: Implement the content types and recursive runtime checks needed to make the production package pass**

```ts
export type ContentValidationResult = {
  issues: { path: string; message: string }[]
}

export function validateContent(input: unknown): ContentValidationResult
export function parseContent(input: unknown): WuhualuContentPackage
```

- [x] **Step 6: Run `pnpm test -- src/content/content.test.ts` and verify all content tests pass**

---

### Task 2: Seeded selection and option generation

**Files:**
- Create: `src/game/random.ts`
- Create: `src/game/quiz.ts`
- Create: `src/game/quiz.test.ts`

**Interfaces:**
- Consumes: `Artifact[]`, `DistractorCandidate[]`, and round rules from Task 1.
- Produces: `createSeededRandom(seed: string): () => number`.
- Produces: `selectRoundArtifacts(artifacts, seed, recentArtifactIds, count): Artifact[]`.
- Produces: `createQuizQuestion(target, candidates, seed): QuizQuestion | QuizGenerationError`.

- [x] **Step 1: Write failing deterministic-seed and recent-artifact avoidance tests**

```ts
expect(selectRoundArtifacts(artifacts, 'daily-2026-08-23', [], 5).map(a => a.id))
  .toEqual(selectRoundArtifacts(artifacts, 'daily-2026-08-23', [], 5).map(a => a.id))
expect(selectRoundArtifacts(artifacts, 'replay', recentIds, 5).slice(0, 3).every(a => !recentIds.includes(a.id))).toBe(true)
```

- [x] **Step 2: Run the focused test and verify failure because selection functions do not exist**

- [x] **Step 3: Implement string hashing, a deterministic PRNG, seeded shuffle, and constrained round selection**

```ts
export function createSeededRandom(seed: string): () => number {
  let state = hashSeed(seed) || 0x6d2b79f5
  return () => {
    state |= 0
    state = (state + 0x6d2b79f5) | 0
    let value = Math.imul(state ^ (state >>> 15), 1 | state)
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}
```

- [x] **Step 4: Write failing tests proving four unique options, exactly one correct option, correct option presence, and identical order for identical seeds**

- [x] **Step 5: Implement ranked candidate selection: authored candidates, tag overlap, then deterministic global fallback**

```ts
const ranked = candidates
  .filter(candidate => candidate.forArtifactIds.includes(target.id))
  .sort((a, b) => overlap(b.tags, target.distractorTags) - overlap(a.tags, target.distractorTags))
const unique = dedupeByLabel([...ranked, ...seededShuffle(candidates, random)])
```

- [x] **Step 6: Add a failing insufficient-candidate test that expects a structured `insufficient-distractors` error rather than duplicates**

- [x] **Step 7: Implement the explicit generation error and rerun the focused suite until green**

---

### Task 3: Clues, scoring, feedback, collection, and view models

**Files:**
- Create: `src/game/progress.ts`
- Create: `src/game/collection.ts`
- Create: `src/game/view-models.ts`
- Create: `src/game/progress.test.ts`
- Create: `src/game/collection.test.ts`
- Create: `src/game/view-models.test.ts`

**Interfaces:**
- Produces: `revealNextClue(question, revealedClueIds): string[]`.
- Produces: `evaluateGuess(question, optionId, additionalCluesUsed, streak): GuessResult`.
- Produces: `unlockArtifact(collection, artifactId, stars, unlockedAt): CollectionEntry[]`.
- Produces: `buildArtifactDetailViewModel(artifact, entry, assets): ArtifactDetailViewModel`.
- Produces: `buildRoundSummaryViewModel(session, artifacts): RoundSummaryViewModel`.

- [x] **Step 1: Write and run failing tests for ordered clue reveal and repeat-reveal idempotence**
- [x] **Step 2: Implement minimal clue progression and verify green**

```ts
export function revealNextClue(question: QuizQuestion, revealed: string[]): string[] {
  const next = question.clues.find(clue => !revealed.includes(clue.id))
  return next ? [...revealed, next.id] : revealed
}
```
- [x] **Step 3: Write and run failing literal scoring tests for 0/1/2 additional clues producing 3/2/1 stars and decreasing points**
- [x] **Step 4: Implement scoring, answer evaluation, streak increment/reset, and content-backed feedback**

```ts
const stars = Math.max(1, 3 - additionalCluesUsed) as 1 | 2 | 3
const correct = optionId === question.correctOptionId
return { correct, stars, points: correct ? stars * 100 + streak * 10 : 0,
  nextStreak: correct ? streak + 1 : 0, feedback: correct ? question.successFeedback : question.wrongFeedback }
```
- [x] **Step 5: Write and run failing collection tests proving first unlock, duplicate unlock idempotence, earliest timestamp retention, and best-star upgrade**
- [x] **Step 6: Implement immutable collection updates and verify green**

```ts
const existing = collection.find(entry => entry.artifactId === artifactId)
return existing
  ? collection.map(entry => entry.artifactId === artifactId ? { ...entry, bestStars: Math.max(entry.bestStars, stars) as 1 | 2 | 3 } : entry)
  : [...collection, { artifactId, unlockedAt, bestStars: stars }]
```
- [x] **Step 7: Write failing view-model completeness tests using one hand-checked Artifact fixture and one five-answer summary**
- [x] **Step 8: Implement detail and summary ViewModel builders, then run all Task 3 tests**

```ts
return {
  id: artifact.id,
  title: artifact.name,
  subtitle: `${artifact.period} · ${artifact.material}`,
  facts: [artifact.summary, artifact.highlight, artifact.culturalNote],
  asset: assets.get(artifact.assetRefs.fullAssetId),
  unlocked: Boolean(entry),
  bestStars: entry?.bestStars ?? 0,
}
```

---

### Task 4: Versioned local storage and recovery

**Files:**
- Create: `src/storage/storage.ts`
- Create: `src/storage/storage.test.ts`

**Interfaces:**
- Consumes: valid Artifact IDs and the current content version.
- Produces: `StorageLike`, `StoragePayload`, `createDefaultStoragePayload(contentVersion)`, `loadStorage(storage, validArtifactIds, contentVersion)`, `saveStorage(storage, payload)`, and `clearStorage(storage)`.
- Returns: `{ payload, recovery: null | StorageRecoveryReason }` from reads.

- [x] **Step 1: Write failing real in-memory-adapter round-trip tests using the exact storage key `xhs-tool:wuhualu:state:v1`**
- [x] **Step 2: Run and verify failure because the storage module is absent**
- [x] **Step 3: Implement serialization through the injected `StorageLike` interface**

```ts
export function saveStorage(storage: StorageLike, payload: StoragePayload): void {
  assertPersistable(payload)
  storage.setItem(STORAGE_KEY, JSON.stringify(payload))
}
```
- [x] **Step 4: Write failing tests for truncated JSON, unknown future schema, wrong field types, stale Artifact IDs, and oversized histories**
- [x] **Step 5: Implement safe defaults, recovery reasons, ID filtering, record caps, and forbidden binary/data-URL rejection**

```ts
if (!raw) return { payload: createDefaultStoragePayload(contentVersion), recovery: null }
try {
  const parsed: unknown = JSON.parse(raw)
  return normalizeStoragePayload(parsed, validArtifactIds, contentVersion)
} catch {
  return { payload: createDefaultStoragePayload(contentVersion), recovery: 'corrupt-json' }
}
```
- [x] **Step 6: Run the storage suite and verify all cases pass without browser globals**

---

### Task 5: Application state machine and complete-game simulations

**Files:**
- Create: `src/state/game-state.ts`
- Create: `src/state/game-state.test.ts`
- Create: `src/tests/simulation.test.ts`

**Interfaces:**
- Consumes: quiz, scoring, collection, and storage-domain types from Tasks 1–4.
- Produces: `AppState`, `AppAction`, `createInitialState(payload)`, and `appReducer(state, action): AppState`.
- Supports every required screen tag and recovery transition from the design spec.

- [x] **Step 1: Write failing reducer transition tests for landing → intro → modeSelect → question**
- [x] **Step 2: Implement the minimal discriminated union and start transitions**

```ts
export type AppState =
  | { screen: 'landing'; payload: StoragePayload }
  | { screen: 'intro'; payload: StoragePayload }
  | { screen: 'modeSelect'; payload: StoragePayload }
  | PlayState
  | { screen: 'collection'; payload: StoragePayload; returnTo: 'landing' | 'summary' }
  | { screen: 'artifactDetail'; payload: StoragePayload; artifactId: string }
  | { screen: 'error'; payload: StoragePayload; message: string }
```
- [x] **Step 3: Write failing tests for clueRevealed, answering, feedback, next question, summary, collection, detail, exit, replay, and error recovery**
- [x] **Step 4: Implement pure transitions and reject invalid/duplicate submissions without changing score or collection**

```ts
case 'submitAnswer':
  if (state.screen !== 'answering' || state.answer) return state
  return { ...state, screen: 'feedback', answer: action.result }
```
- [x] **Step 5: Write three failing five-question simulations with literal assertions for completed count, total score, streak, and unlocked IDs**
- [x] **Step 6: Add the minimal session orchestration helpers needed by the simulations and verify all state/simulation tests pass**

```ts
export function playAnswer(state: PlayState, optionId: string): PlayState {
  const result = evaluateGuess(state.question, optionId, state.additionalCluesUsed, state.streak)
  return { ...state, screen: 'feedback', answer: result, score: state.score + result.points, streak: result.nextStreak }
}
```

---

### Task 6: Semantic React page skeleton

**Files:**
- Replace: `src/App.tsx`
- Replace: `src/App.css`
- Replace: `src/index.css`
- Modify: `src/main.tsx`
- Modify: `index.html`

**Interfaces:**
- Consumes: validated content, state reducer, storage adapter, quiz builders, and ViewModels.
- Produces: semantic renderers for landing, intro, modeSelect, question/clueRevealed/answering, feedback, summary, collection/empty collection, artifact detail, and error.

- [x] **Step 1: Add a failing pure page-model/state test proving every required state has a renderable title and primary action**
- [x] **Step 2: Run the test and verify the page mapping is absent**
- [x] **Step 3: Implement the App composition and semantic page components without business strings in JSX**

```tsx
function Screen({ state, dispatch }: ScreenProps) {
  switch (state.screen) {
    case 'landing': return <LandingPage model={buildLandingViewModel(content, state.payload)} dispatch={dispatch} />
    case 'question': return <QuestionPage model={buildQuestionViewModel(state)} dispatch={dispatch} />
    case 'error': return <ErrorPage model={buildErrorViewModel(state)} dispatch={dispatch} />
    default: return renderNonQuestionScreen(state, dispatch)
  }
}
```
- [x] **Step 4: Connect persistence at reducer state boundaries, making duplicate button clicks harmless**

```ts
const [state, dispatch] = useReducer(appReducer, initialPayload, createInitialState)
useEffect(() => saveStorage(window.localStorage, state.payload), [state.payload])
```
- [x] **Step 5: Add neutral responsive CSS with 44px controls, safe-area padding, visible focus, reduced motion, and no horizontal overflow at 375/390/430px**
- [x] **Step 6: Update document language/title and run the full test suite plus TypeScript build to catch integration errors**

---

### Task 7: Foundation report and requirement audit

**Files:**
- Modify: `FOUNDATION_DESIGN.md`
- Modify: `FOUNDATION_PLAN.md`
- Create: `PREP_REPORT.md`

**Interfaces:**
- Consumes: final content statistics, validation output, tests, and build evidence.
- Produces: the requested report with file changes, 20-artifact statistics, pending fact checks, algorithms, seed/storage/asset conventions, page interfaces, tests, verification results, and Windows art/design handoff.

- [x] **Step 1: Audit every numbered user requirement against code or a named test and fix any uncovered behavior through a new red-green cycle**
- [x] **Step 2: Count content verification statuses and document every pending fact or image-license check without promoting it to verified**
- [x] **Step 3: Write `PREP_REPORT.md` with concrete file paths, algorithms, schema versions, storage limits, and page contracts**
- [x] **Step 4: Mark completed checkboxes in this plan and update the design status to implemented only after verification**

---

### Task 8: Fresh verification and scoped diff inspection

**Files:**
- Inspect only: `projects/02-wuhualu/**`

**Interfaces:**
- Produces: fresh command evidence for the final READY/BLOCKED decision.

- [x] **Step 1: Run `pnpm lint` and record the exit code/output**
- [x] **Step 2: Run `pnpm test` and record test-file/test counts with zero failures**
- [x] **Step 3: Run `pnpm build` and record the exit code and output size summary**
- [x] **Step 4: Verify responsive CSS rules for 375/390/430px and confirm no external asset URL, Base64, Blob, or IndexedDB image cache exists**
- [x] **Step 5: Run `git diff --name-only -- projects/02-wuhualu` and `git diff --stat -- projects/02-wuhualu` from the repository root**
- [x] **Step 6: Update `PREP_REPORT.md` with fresh evidence; output `FOUNDATION READY` only if every gate passed, otherwise `FOUNDATION BLOCKED` with the exact failure**
