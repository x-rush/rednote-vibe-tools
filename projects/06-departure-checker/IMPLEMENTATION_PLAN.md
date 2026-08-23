# 出门检查官基础实现 Implementation Plan

> **For agentic workers:** Execute inline with test-driven development. Git write operations are forbidden for this project task; verification checkpoints replace commits.

**Goal:** Build the content-driven, deterministic departure checklist foundation with local persistence and a semantic mobile-first application skeleton.

**Architecture:** One typed JSON content package feeds a validated index and a pure rule engine. A reducer owns page/checklist state, a narrow storage adapter owns versioned localStorage, and React renders typed view models without embedding business copy.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Vitest 4, browser localStorage.

**Spec:** `DESIGN.md`

## Global Constraints

- Modify only `projects/06-departure-checker/**`.
- Do not install, update, or remove dependencies and do not modify the lockfile.
- Keep all runtime business content in `src/content/content.json`.
- Pure static frontend; no backend, runtime CDN, external API, location, Service Worker, or user media storage.
- Do not perform Git write operations.

---

### Task 1: Content types and validation

**Files:**
- Create: `src/content/schema.ts`
- Create: `src/content/validate.ts`
- Modify: `src/content/content.test.ts`

**Interfaces:**
- Produces: `DepartureContentPackage`, `validateContent(value, mode)`, `loadContent(value)`.

- [x] Write failing tests for envelope shape, IDs, references, conditions, priority enums, safety reasons, icon IDs, replacement cycles, and scenario output coverage.
- [x] Run `pnpm test` and confirm failures are caused by missing contracts.
- [x] Implement runtime-safe type guards, issue paths, indexes, and validation.
- [x] Run `pnpm test` and confirm the validation slice passes.

### Task 2: Production content package

**Files:**
- Modify: `src/content/content.json`
- Modify: `src/content/content.test.ts`

**Interfaces:**
- Consumes: schema from Task 1.
- Produces: 8 scenarios, 60–90 items, categories, locations, condition definitions, and explainable rules.

- [x] Add failing production-count and golden-reference tests.
- [x] Run `pnpm test` and confirm the scaffold content fails production validation.
- [x] Mechanically encode the frozen content contract into the single JSON package.
- [x] Run `pnpm test` and confirm all content checks pass.

### Task 3: Deterministic checklist engine

**Files:**
- Create: `src/domain/checklist.ts`
- Create: `src/domain/checklist.test.ts`

**Interfaces:**
- Produces: `generateChecklist(input, content)`, `restoreChecklist(saved, generated)`, `resetChecklist(generated)`.

- [x] Add failing tests for base items, safety protection, dedupe, reason merging, removals, conflict winners, replacements, priority changes, stable sorting, empty/extreme conditions, and determinism.
- [x] Run `pnpm test` and confirm engine exports are missing.
- [x] Implement the eight-stage rule pipeline as pure functions.
- [x] Run `pnpm test` and confirm engine tests pass.

### Task 4: Versioned storage

**Files:**
- Create: `src/storage/checklistStorage.ts`
- Create: `src/storage/checklistStorage.test.ts`

**Interfaces:**
- Produces: `createChecklistStorage(storage)`, typed load/save/delete/clear results, corruption metadata.

- [x] Add failing tests for round-trip, three-record cap, overwrite order, malformed JSON, future schema, invalid references, and quota failures.
- [x] Run `pnpm test` and confirm the storage adapter is missing.
- [x] Implement a dependency-injected localStorage adapter with payload sanitization.
- [x] Run `pnpm test` and confirm storage tests pass.

### Task 5: Application state and semantic flow

**Files:**
- Create: `src/app/state.ts`
- Create: `src/app/state.test.ts`
- Modify: `src/App.tsx`
- Modify: `src/App.css`
- Modify: `src/index.css`

**Interfaces:**
- Produces: `createInitialState`, `appReducer`, page state union, typed actions, and the complete semantic UI skeleton.

- [x] Add failing reducer tests for navigation, condition edits, regeneration, checking, reset, restore, delete, summary, and errors.
- [x] Run `pnpm test` and confirm state exports are missing.
- [x] Implement reducer and connect it to the rule engine and storage.
- [x] Implement the semantic mobile-first pages and asset-ID placeholders.
- [x] Run `pnpm test` and confirm state and existing suites pass.

### Task 6: Report and final verification

**Files:**
- Create: `PREP_REPORT.md`

**Interfaces:**
- Documents content statistics, engine order, conflict policy, golden outputs, storage schema, UI interfaces, future icon IDs, and verification evidence.

- [x] Run `pnpm lint`.
- [x] Run `pnpm test`.
- [x] Run `pnpm build`.
- [x] Record exact results and responsive CSS checks for 375/390/430 CSS px.
- [x] Run `git diff --name-only -- projects/06-departure-checker` and verify every changed file is in scope.
