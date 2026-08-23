# SBTI Foundation Implementation Plan

> **For agentic workers:** Execute inline with test-driven development. Shared-workspace rules prohibit subagent edits and every Git write operation for this task.

**Goal:** Build the complete pre-design engineering foundation for the 48-question, 16-result SBTI quiz.

**Architecture:** A validated JSON content package feeds pure selection/scoring functions, a pure reducer, and a versioned storage adapter. Thin React page components consume typed props and view models; visual treatment remains a restrained mobile-safe placeholder.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Vitest 4, Oxlint; no new dependencies.

**Spec:** `projects/01-sbti/PREP_DESIGN.md`

## Global Constraints

- Modify only `projects/01-sbti/**`; do not perform Git writes or package installation.
- Keep all business content in `src/content/content.json`.
- No backend, runtime API, remote asset/font, Service Worker, device API, or persisted media.
- Every production behavior starts with a failing test and a verified red-green cycle.
- Final verification is project-local and includes 375, 390, and 430 CSS px.

---

### Task 1: Typed content contract and production validation

**Files:**
- Create: `src/content/types.ts`
- Create: `src/content/validate.ts`
- Replace: `src/content/content.test.ts`

**Interfaces:**
- Produces `SbtiContentPackage`, `Question`, `AnswerOption`, `DimensionCode`, `DimensionScore`, `BeastProfile`, `PersonalityType`, and `validateContent(input: unknown): SbtiContentPackage`.

- [ ] Write content tests that require the production counts, exact type-code set, unique IDs, valid option scoring, valid source/creature/neighbor/tie-breaker references, and actionable JSON paths for malformed fixtures.
- [ ] Run `pnpm test src/content/content.test.ts` and verify the production-count assertion fails against the scaffold.
- [ ] Add the smallest types and runtime assertions needed for the tests.
- [ ] Run the focused tests and verify green.

### Task 2: Formal 48-question and 16-result content

**Files:**
- Replace: `src/content/content.json`
- Modify: `src/content/content.test.ts`

**Interfaces:**
- Consumes `validateContent` and produces one validated content package with `contentVersion: 1.0.0`.

- [ ] Extend the tests with the 4×4×3 question matrix, balanced option positions, result/share field completeness, legal asset IDs, and 16 unique mapped beasts.
- [ ] Run the focused test and verify failure against incomplete content.
- [ ] Mechanically transcribe Q01–Q48 and the frozen mappings; add required PRODUCT copy without changing classical claims.
- [ ] Run content tests and verify green.

### Task 3: Deterministic selection, scoring, and result view models

**Files:**
- Create: `src/quiz/types.ts`
- Create: `src/quiz/selection.ts`
- Create: `src/quiz/scoring.ts`
- Create: `src/quiz/scoring.test.ts`

**Interfaces:**
- Produces `QuizAnswer`, `QuizProgress`, `QuizResult`, `ResultSummary`, `ShareCardViewModel`, `selectQuestionIds(content, seed)`, `recordAnswer`, `isQuestionAnswered`, `calculateProgress`, `aggregateDimensionScores`, `determineTypeCode`, `findBeastForType`, `generateResultSummary`, `generateShareCardViewModel`, and `resetQuiz`.

- [ ] Write failing selection tests for 24 questions, chapter/dimension quotas, tie-breaker inclusion, adjacency, and repeatable seed output.
- [ ] Implement deterministic selection and verify green.
- [ ] Write failing scoring tests for replacement semantics, rejection cases, deterministic ties, all 16 codes, repeatability, three full simulations, and share fields.
- [ ] Implement scoring/result functions and verify green.

### Task 4: Reducer state model

**Files:**
- Create: `src/app/state.ts`
- Create: `src/app/state.test.ts`

**Interfaces:**
- Produces the seven required page states, `AppAction`, `createInitialState`, `appReducer`, and `restoreQuizProgress`.

- [ ] Write failing transition tests for start, answer, previous, incomplete submit, calculation/result, history, restart, home, restore, and error fallback.
- [ ] Implement the minimal pure reducer and restoration helper.
- [ ] Run focused tests and verify green.

### Task 5: Versioned local storage adapter

**Files:**
- Create: `src/storage/storage.ts`
- Create: `src/storage/storage.test.ts`

**Interfaces:**
- Produces `StoragePayload`, `StorageLike`, `loadStorage`, `saveStorage`, `clearStorage`, and the fixed key `xhs-tool:sbti:state:v1`.

- [ ] Write failing tests for no data, valid round-trip, corrupt JSON, missing fields, future schema, stale content references, and bounded result storage.
- [ ] Implement validation and typed recovery outcomes without direct storage access in quiz logic.
- [ ] Run focused tests and verify green.

### Task 6: Semantic React flow and neutral mobile shell

**Files:**
- Create: `src/app/useSbtiApp.ts`
- Create: `src/components/LandingPage.tsx`
- Create: `src/components/IntroPage.tsx`
- Create: `src/components/QuizPage.tsx`
- Create: `src/components/CalculatingPage.tsx`
- Create: `src/components/ResultPage.tsx`
- Create: `src/components/HistoryPage.tsx`
- Create: `src/components/ErrorPage.tsx`
- Replace: `src/App.tsx`
- Replace: `src/App.css`
- Modify: `src/index.css`
- Modify: `index.html`

**Interfaces:**
- Consumes the validated package, reducer, quiz functions, and storage adapter. Produces the complete keyboard-operable page flow without business rules in event handlers.

- [ ] Add state/controller behavior tests where observable pure logic is missing; verify red.
- [ ] Implement the controller and focused semantic components.
- [ ] Add restrained responsive structural CSS and correct document metadata.
- [ ] Run tests and build; correct only failures inside this project.

### Task 7: Final report and evidence

**Files:**
- Create: `PREP_REPORT.md`

- [ ] Run `pnpm lint`, `pnpm test`, and `pnpm build` separately and record exact results.
- [ ] Serve the production build and inspect 375/390/430 CSS px for overflow, touch targets, and flow completion.
- [ ] Record counts, algorithms, state/storage contracts, tests, conflicts, outstanding design/assets, future interfaces, asset IDs, and risks.
- [ ] Run `git diff --name-only -- projects/01-sbti` and `git diff --stat -- projects/01-sbti`; verify no file outside the assigned directory changed.
