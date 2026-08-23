# 汴京饮子铺基础实现 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This workspace explicitly forbids subagents and all Git write operations for this task.

**Goal:** Build the complete deterministic foundation for the 100-day Bianjing drink-shop game, including production content, simulation, events, saves, semantic UI, tests, and `PREP_REPORT.md`.

**Architecture:** Keep all business content in one JSON package and implement the rules as small pure TypeScript modules. The UI consumes a typed view model, while persistence sits behind a repository interface with native IndexedDB and in-memory test implementations.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Vitest 4, native IndexedDB/localStorage, CSS.

**Spec:** `DESIGN.md`

## Global Constraints

- Modify only `projects/04-bianjing-drink-shop/**`.
- Do not install dependencies or modify any workspace/lock file.
- Do not run Git write operations.
- Runtime remains static and offline; no backend, runtime CDN, external API, Service Worker, or Node API.
- Business content lives only in `src/content/content.json`.
- Run only `pnpm lint`, `pnpm test`, and `pnpm build` for final project verification.
- Final Git reads are limited to `git diff --name-only -- projects/04-bianjing-drink-shop` and `git diff -- projects/04-bianjing-drink-shop`.

## Planned File Map

- `src/content/content.json`: all drinks, ingredients, recipes, customers, weather, seasons, events, chains, endings, balance parameters, and UI copy.
- `src/content/schema.ts`: content domain interfaces and production validation.
- `src/content/index.ts`: validated content export and ID indexes.
- `src/domain/types.ts`: runtime game, decision, result, event, ending, and save types.
- `src/domain/rng.ts`: serializable seeded PRNG.
- `src/domain/numbers.ts`: rounding and bounds.
- `src/engine/conditions.ts`: finite condition evaluator.
- `src/engine/effects.ts`: finite effect applicator.
- `src/engine/events.ts`: event eligibility, weighting, cooldown, one-shot, conflicts, and chains.
- `src/engine/economy.ts`: deterministic visitors, demand, sales, costs, inventory, and ledger.
- `src/engine/endings.ts`: bankruptcy and priority-based final ending resolution.
- `src/engine/simulator.ts`: new-game state, open/resolve day, and full-run simulation.
- `src/state/game-machine.ts`: legal page-state transitions and duplicate-resolution guard.
- `src/state/view-model.ts`: business-content-backed UI model.
- `src/storage/save-codec.ts`: validation, migration, bounded history, and recovery.
- `src/storage/repository.ts`: repository contract and memory implementation.
- `src/storage/indexed-db.ts`: native browser repository.
- `src/storage/launcher.ts`: localStorage launcher pointer/settings.
- `src/tests/fixtures.ts`: hand-checked reusable states and strategy agents.
- `src/**/*.test.ts`: behavior tests colocated with each responsibility.
- `src/App.tsx`, `src/App.css`, `src/index.css`: semantic mobile UI shell.
- `PREP_REPORT.md`: counts, formulas, risks, simulation summaries, saves, and verification.

---

### Task 1: Domain contracts, rounding, and deterministic RNG

**Files:**
- Create: `src/domain/types.ts`
- Create: `src/domain/numbers.ts`
- Create: `src/domain/numbers.test.ts`
- Create: `src/domain/rng.ts`
- Create: `src/domain/rng.test.ts`

**Interfaces:**
- Produces: `clampStat(value): number`, `roundVisitors(value): number`, `floorMoney(value): number`, `ceilEnergy(value): number`.
- Produces: `seedRng(seed): RngState`, `nextRandom(state): { value: number; state: RngState }`.
- Produces: the required `Product`, `Ingredient`, `Recipe`, `PriceSetting`, `InventoryItem`, `ShopStats`, `DayContext`, `DailyDecision`, `DailyResult`, `BusinessEvent`, `EventCondition`, `EventEffect`, `EventChoice`, `EventChain`, `Ending`, `GameState`, and `SavePayload` types.

- [ ] **Step 1: Write the failing numeric-boundary tests**

```ts
expect(clampStat(-2)).toBe(0)
expect(clampStat(104)).toBe(100)
expect(roundVisitors(8.5)).toBe(9)
expect(floorMoney(3.9)).toBe(3)
expect(ceilEnergy(3.1)).toBe(4)
```

- [ ] **Step 2: Run `pnpm test src/domain/numbers.test.ts` and confirm imports fail because the module does not exist**
- [ ] **Step 3: Implement only the four numeric functions and rerun until green**
- [ ] **Step 4: Write RNG tests with literal snapshots for seed `shop-seed-1`, state continuation, and a second distinct seed**
- [ ] **Step 5: Run `pnpm test src/domain/rng.test.ts` and confirm the missing exports cause the expected failure**
- [ ] **Step 6: Implement a string-to-uint32 hash plus serializable uint32 PRNG and rerun both test files**
- [ ] **Step 7: Add the domain discriminated unions and state interfaces, then run `pnpm build` to type-check them**

### Task 2: Production content package and validation

**Files:**
- Modify: `src/content/content.json`
- Create: `src/content/schema.ts`
- Create: `src/content/index.ts`
- Replace: `src/content/content.test.ts`

**Interfaces:**
- Produces: `validateContent(value, mode): ValidationResult` with JSON-path errors.
- Produces: `shopContent`, `eventById`, `productById`, `chainById`, and `endingById`.
- Consumes: all content-domain types from Task 1.

- [ ] **Step 1: Replace the scaffold test with failing envelope and production-count tests**

```ts
expect(result.errors).toEqual([])
expect(content.content.drinks).toHaveLength(10)
expect(content.content.customers).toHaveLength(12)
expect(content.content.events).toHaveLength(80)
expect(content.content.chains).toHaveLength(5)
expect(content.content.endings).toHaveLength(8)
```

- [ ] **Step 2: Add failing tests for global IDs, event choice IDs, referenced event/product/chain IDs, forbidden Base64/remote assets, and unknown root fields**
- [ ] **Step 3: Run `pnpm test src/content/content.test.ts` and confirm it fails on the empty scaffold counts**
- [ ] **Step 4: Implement the validator and indexes against the current envelope without weakening any failing assertion**
- [ ] **Step 5: Mechanically transcribe 10 drinks, 10 fallback ingredients, 10 recipes, 12 customers, 6 weather records, 4 seasons, and provisional balance values into `content.json`**
- [ ] **Step 6: Mechanically transcribe the 80 documented events with stable IDs, categories, ranges, cooldowns, once-per-save flags, choices, effects, follow-up IDs, conflict tags, and future asset IDs**
- [ ] **Step 7: Transcribe five three-stage chains and eight endings, preserving qualitative effects as flags/modifiers rather than invented money values**
- [ ] **Step 8: Add all page labels and fallback display copy under `content.ui`, then run the content test until green**
- [ ] **Step 9: Run `pnpm build` and fix type/schema mismatches without changing source economics**

### Task 3: Finite condition and effect engines

**Files:**
- Create: `src/engine/conditions.ts`
- Create: `src/engine/conditions.test.ts`
- Create: `src/engine/effects.ts`
- Create: `src/engine/effects.test.ts`
- Create: `src/tests/fixtures.ts`

**Interfaces:**
- Produces: `evaluateCondition(condition, context): boolean` and `conditionsMatch(conditions, context): boolean`.
- Produces: `applyEffects(state, effects, context): EffectApplication`.
- Consumes: finite condition/effect unions and indexed content.

- [ ] **Step 1: Write failing table tests for every condition discriminator, including nested `all`, `any`, and `not`**
- [ ] **Step 2: Run `pnpm test src/engine/conditions.test.ts` and verify the missing evaluator is the failure**
- [ ] **Step 3: Implement an exhaustive `switch` evaluator with no expression execution and make the condition tests green**
- [ ] **Step 4: Write failing effect tests for money, each stat, inventory clamp, flag add/remove, product unlock, modifier, scheduled effect, and chain advance/interruption**
- [ ] **Step 5: Run `pnpm test src/engine/effects.test.ts` and verify the missing applicator is the failure**
- [ ] **Step 6: Implement immutable effect application, ledger deltas, and 0–100 stat clamps; rerun both suites**

### Task 4: Event pool, cooldowns, one-shot events, conflicts, and chains

**Files:**
- Create: `src/engine/events.ts`
- Create: `src/engine/events.test.ts`

**Interfaces:**
- Produces: `eligibleEvents(state, context, events): BusinessEvent[]`.
- Produces: `selectDailyEvent(state, context, content): EventSelection`.
- Produces: `resolveChainNode(state, chain, choiceId): ChainResolution`.
- Consumes: condition evaluator and serializable RNG.

- [ ] **Step 1: Write failing tests proving date and prerequisite filtering**
- [ ] **Step 2: Add failing tests where cooldown and once-per-save exclude otherwise eligible events**
- [ ] **Step 3: Add failing conflict-tag and empty-pool fallback tests**
- [ ] **Step 4: Add a literal weighted-selection fixture that reproduces the same event and next RNG state**
- [ ] **Step 5: Run `pnpm test src/engine/events.test.ts` and verify the missing selectors are the cause**
- [ ] **Step 6: Implement ordered filtering and deterministic weighted selection, then rerun**
- [ ] **Step 7: Add failing tests for each of five chain starts, next-node priority, completion, explicit interruption, timeout interruption, and no new chain after day 90**
- [ ] **Step 8: Implement chain progression using flags and status records, then rerun the complete event suite**

### Task 5: Deterministic economy and explainable ledger

**Files:**
- Create: `src/engine/economy.ts`
- Create: `src/engine/economy.test.ts`

**Interfaces:**
- Produces: `calculateVisitors`, `allocateDemand`, `settleSales`, and `calculateTrading`.
- Produces: `TradingResult` with per-product sales and a money ledger whose sum equals the money delta.
- Consumes: content balance, products, weather, state, decision, and RNG state.

- [ ] **Step 1: Write a failing hand-calculated visitor test covering stage base, reputation diminishing returns, weather multiplier, and event delta**
- [ ] **Step 2: Write failing demand-allocation tests with literal quantities and a deterministic remainder**
- [ ] **Step 3: Write a failing sales test proving sales never exceed demand or prepared inventory**
- [ ] **Step 4: Write a failing ledger test with literal income, stock cost, waste return, fixed cost, and exact total**
- [ ] **Step 5: Write failing tests for 80%–140% integer price bounds, 0–12 preparation bounds, and 3–5 menu items**
- [ ] **Step 6: Run `pnpm test src/engine/economy.test.ts` and confirm missing functions produce the failures**
- [ ] **Step 7: Implement the minimal pure calculations with the design's rounding rules and rerun until green**
- [ ] **Step 8: Add mutation-oriented assertions for wrong rounding, missing cost, and negative inventory, then run the whole economy suite**

### Task 6: Endings and full day simulator

**Files:**
- Create: `src/engine/endings.ts`
- Create: `src/engine/endings.test.ts`
- Create: `src/engine/simulator.ts`
- Create: `src/engine/simulator.test.ts`

**Interfaces:**
- Produces: `resolveEnding(state, endings): EndingResolution | undefined`.
- Produces: `createNewGame(seed, saveId): GameState`, `openDay`, `resolveDay`, `simulateDay`, and `simulateGame`.
- Consumes: economy, event, effect, and condition engines.

- [ ] **Step 1: Write failing ending tests for immediate bankruptcy, day-99 non-final state, day-100 fallback, multiple matches, and highest-priority primary ending**
- [ ] **Step 2: Run `pnpm test src/engine/endings.test.ts`, implement resolution, and make it green**
- [ ] **Step 3: Write a failing new-game test for 120 cash, day 1, four stats, unlocked products, empty histories, and saved RNG state**
- [ ] **Step 4: Write a failing one-day integration test that asserts ordered ledger lines, event selection, event effect, state clamps, inventory, next day, and RNG state**
- [ ] **Step 5: Write failing tests for pending effects before bills, bankruptcy after costs, milestone days, day 100 ending, and duplicate resolution IDs**
- [ ] **Step 6: Run `pnpm test src/engine/simulator.test.ts` and verify the orchestration functions are missing**
- [ ] **Step 7: Implement `openDay` and `resolveDay` as separately serializable stages, then implement the thin simulation wrappers**
- [ ] **Step 8: Rerun ending, economy, event, and simulator suites together**

### Task 7: Save codec and browser repositories

**Files:**
- Create: `src/storage/save-codec.ts`
- Create: `src/storage/save-codec.test.ts`
- Create: `src/storage/repository.ts`
- Create: `src/storage/repository.test.ts`
- Create: `src/storage/indexed-db.ts`
- Create: `src/storage/launcher.ts`
- Create: `src/storage/launcher.test.ts`

**Interfaces:**
- Produces: `encodeSave(payload): string` and `decodeSave(raw, content): SaveRecoveryResult`.
- Produces: `SaveRepository` with `load`, `save`, `remove`, `list`, and `clear`.
- Produces: `MemorySaveRepository`, `IndexedDbSaveRepository`, `loadLauncher`, and `saveLauncher`.

- [ ] **Step 1: Write failing round-trip tests and assert bounded decision/event summaries**
- [ ] **Step 2: Add failing fixtures for truncated JSON, future schema, wrong types, unknown critical IDs, invalid inventory, Base64, Blob-like values, and oversized arrays**
- [ ] **Step 3: Add a failing recovery test where the current snapshot is corrupt and the previous-day snapshot is valid**
- [ ] **Step 4: Run `pnpm test src/storage/save-codec.test.ts` and confirm the missing codec is the failure**
- [ ] **Step 5: Implement the whitelist codec, v1 validation, bounded summaries, and structured recovery statuses**
- [ ] **Step 6: Write failing repository tests proving two new games coexist and project clear does not use a broad key prefix**
- [ ] **Step 7: Implement the repository interface, memory adapter, native IndexedDB object stores, and localStorage launcher key `xhs-tool:bianjing:state:v1`**
- [ ] **Step 8: Run all storage tests and `pnpm build` to verify browser API types**

### Task 8: Application state machine and semantic UI skeleton

**Files:**
- Create: `src/state/game-machine.ts`
- Create: `src/state/game-machine.test.ts`
- Create: `src/state/view-model.ts`
- Create: `src/state/view-model.test.ts`
- Modify: `src/App.tsx`
- Modify: `src/App.css`
- Modify: `src/index.css`

**Interfaces:**
- Produces: `transitionGame(machine, action): MachineResult` for all required page states.
- Produces: `buildGameViewModel(state, content): GameViewModel`.
- Consumes: simulator and storage repository without embedding business content in JSX.

- [ ] **Step 1: Write failing transition-table tests for every required state and illegal-transition recovery**
- [ ] **Step 2: Add failing tests that duplicate open/choice actions do not resolve a day twice**
- [ ] **Step 3: Run `pnpm test src/state/game-machine.test.ts`, implement the reducer, and make it green**
- [ ] **Step 4: Write failing view-model tests proving labels, product names, event copy, ledger labels, and ending copy come from content IDs**
- [ ] **Step 5: Implement the view-model builder and rerun**
- [ ] **Step 6: Replace the scaffold with semantic sections for landing, new game/tutorial, morning/preparation, opening summary, event choices, settlement ledger, milestone, bankruptcy, final ending, continue prompt, and recoverable error**
- [ ] **Step 7: Add restrained responsive CSS with 44px controls, safe-area padding, wrapping tables/cards, and no fixed widths above the viewport**
- [ ] **Step 8: Run `pnpm lint`, `pnpm test`, and `pnpm build`; fix only project-local failures**

### Task 9: Three complete simulations and balance evidence

**Files:**
- Create: `src/engine/simulation.test.ts`
- Modify: `src/tests/fixtures.ts`

**Interfaces:**
- Produces: three named strategy agents returning valid `DailyDecision` and event choice IDs.
- Consumes: `simulateGame` and production content.

- [ ] **Step 1: Write a failing aggressive-policy simulation that expects a reproducible pre-day-100 bankruptcy and literal terminal seed/day snapshot**
- [ ] **Step 2: Run the single test, verify failure, and adjust only the strategy fixture or simulator defect—not content economics—to make the intended documented path observable**
- [ ] **Step 3: Write a failing conservative-policy simulation that expects day 100 with low but nonnegative cash and a valid ending**
- [ ] **Step 4: Run it and record actual results; if unreachable under frozen values, assert the actual deterministic result and mark the requirement gap for the report**
- [ ] **Step 5: Write a failing advantageous-policy simulation that expects day 100 and a non-default positive ending or clearly stronger final stats than the conservative route**
- [ ] **Step 6: Run it and record actual results without modifying balance to force the requested narrative**
- [ ] **Step 7: Run all three together twice and assert identical terminal snapshots**
- [ ] **Step 8: Run `pnpm test` to ensure the full simulation does not destabilize unit suites**

### Task 10: Preparation report and final verification

**Files:**
- Create: `PREP_REPORT.md`
- Review: every file listed above

**Interfaces:**
- Consumes: verified content counts, formulas, fallback list, test output, build output, and simulation snapshots.
- Produces: the requested audit report without unsupported completion claims.

- [ ] **Step 1: Write report sections for content counts, formulas, rounding, RNG, event engine, five-chain reachability, eight ending conditions, three simulations, balance risks, save schema, UI/asset interfaces, and document conflicts**
- [ ] **Step 2: Run `pnpm lint` and record the fresh exit result**
- [ ] **Step 3: Run `pnpm test` and record suite/test counts plus the three terminal simulation summaries**
- [ ] **Step 4: Run `pnpm build` and record the fresh exit result and output bundle names**
- [ ] **Step 5: Inspect the built page/CSS at 375, 390, and 430 CSS px using available local browser tooling; record overflow and control-size observations**
- [ ] **Step 6: Run `git diff --name-only -- projects/04-bianjing-drink-shop` and verify every changed path is inside the assigned directory**
- [ ] **Step 7: Run `git diff -- projects/04-bianjing-drink-shop` and inspect for accidental secrets, remote URLs, Base64, unrelated changes, or deleted tests**
- [ ] **Step 8: Update `PREP_REPORT.md` with exact verification evidence and output `FOUNDATION READY` only if every required gate passed; otherwise output `FOUNDATION BLOCKED` with concrete failures**
