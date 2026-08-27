# Economy, Demand, and Crisis Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the daily business loop so morning information guides preparation, customer demand is conserved and explainable, every cost is visible before opening, and one deterministic crisis contract replaces the low-cash death spiral.

**Architecture:** Freeze one `DayForecast` before preparation, resolve aggregate preference groups through one pure demand engine, and feed both estimates and final settlement from shared economy functions. Keep crisis recovery as a separate pure state machine, persist all new state in save schema V4, and expose results only through the typed view model.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Vitest 4, oxlint, IndexedDB/localStorage, static local assets.

**Spec:** `ECONOMY-DEMAND-CRISIS-REDESIGN.md`

## Global Constraints

- Modify only `projects/04-bianjing-drink-shop`; do not modify the workspace root, other projects, `../../docs`, `../../prep`, or root lock files.
- Do not add dependencies without first reporting the need.
- Runtime business content and tunable values belong only in `src/content/content.json`; JSX consumes typed view-model data and contains no business copy.
- Keep the app fully static and offline-capable; no backend, runtime CDN, required external API, Service Worker, Node runtime API, or unapproved device API.
- Persist only structured IDs, numbers, dates, and bounded text; never persist images, Base64, audio, video, or Blob data.
- Use pure functions for core rules and explicit seeded RNG for every random result.
- Preserve the existing dirty inline workflow: do not create a worktree, commit, push, or overwrite unrelated user changes unless the user later asks.
- Implement with TDD; do not delete or weaken tests to make checks pass.
- Final verification is `pnpm lint && pnpm test && pnpm build`, plus real-browser checks at 375, 390, and 430 CSS px and desktop width.

---

## File Structure

### New files

- `src/engine/forecast.ts`: deterministic weather, market-signal, expected-demand, and hidden-demand generation.
- `src/engine/forecast.test.ts`: forecast determinism, range, and unlocked-product coverage.
- `src/engine/financial-health.ts`: warning, rescue eligibility, contracts, grace period, and failure transitions.
- `src/engine/financial-health.test.ts`: crisis state-machine and contract obligations.
- `src/engine/planning.ts`: yesterday-plan reuse and non-optimal affordable Ayuan recommendation.
- `src/engine/planning.test.ts`: recommendation affordability and stability.
- `src/storage/migrate-v3.ts`: V3-to-V4 save migration.
- `src/storage/migrate-v3.test.ts`: unopened, pending-opening, negative, ending, and fallback migrations.
- `src/ui/MorningIntel.tsx`: morning weather, market clue, and yesterday insight.
- `src/ui/MorningIntel.test.tsx`: semantic rendering and accessible labels.
- `src/ui/FinancialCrisis.tsx`: Galgame crisis presentation, contract cards, and grace status.
- `src/ui/FinancialCrisis.test.tsx`: contract eligibility, obligation copy, and action states.

### Existing files with changed responsibility

- `src/domain/types.ts`: V4 forecast, demand, crisis, contract, settlement, and page types.
- `src/content/schema.ts`: validates new content roots, shelf classes, event mode eligibility, crisis contracts, and balance values.
- `src/content/content.json`: all demand segments, market signals, shelf classes, crisis contracts, event frequencies, UI copy, and revised content version.
- `src/content/content.test.ts`: production counts, cross-references, and new content contracts.
- `src/content/event-quality.ts`: event loss ceiling and rest-event semantic validation.
- `src/content/event-quality.test.ts`: invalid-content regression fixtures.
- `src/engine/demand.ts`: replace listed-menu allocation with latent preference, price rejection, one substitution, and loss conservation.
- `src/engine/demand.test.ts`: direct purchase, substitution, mismatch, stockout, price loss, service loss, and conservation.
- `src/engine/economy.ts`: shared opening estimate, product-specific waste return, and expanded sales ledger.
- `src/engine/economy.test.ts`: estimate/settlement parity and shelf-return calculations.
- `src/engine/events.ts`: explicit priority and operating-mode eligibility.
- `src/engine/events.test.ts`: crisis/chain/follow-up/random priority and rest behavior.
- `src/engine/simulator.ts`: consumes frozen forecasts, integrates new demand/economy results, advances crisis, and prepares the next morning.
- `src/engine/simulator.test.ts`: vertical daily-flow and crisis interception tests.
- `src/engine/endings.ts`: bankruptcy only after financial-health state authorizes it.
- `src/engine/endings.test.ts`: no premature bankruptcy and post-rescue bankruptcy.
- `src/engine/settlement-insight.ts`: derive one primary explainable settlement reason from structured losses.
- `src/engine/settlement-insight.test.ts`: new primary-reason ordering.
- `src/engine/balance-audit.ts`: forecast-aware strategies and crisis metrics.
- `src/engine/balance-audit.test.ts`: survival and crisis-rate bands from the approved spec.
- `src/storage/save-codec.ts`: V4 validation, bounded serialization, and sequential migration.
- `src/storage/save-codec.test.ts`: V4 round trip, future-version, and previous-day recovery.
- `src/tests/fixtures.ts`: complete V4 state, forecast, and result factories.
- `src/state/view-model.ts`: morning, budget, forecast band, business beat, detailed demand, and crisis views.
- `src/state/view-model.test.ts`: typed presentation without JSX business calculations.
- `src/state/resume-route.ts`: resume crisis and frozen-morning routes.
- `src/state/resume-route.test.ts`: V4 resume matrix.
- `src/state/ui-flow.ts`: retain four time stages and add crisis-choice submission state where needed.
- `src/state/ui-flow.test.ts`: four-stage playback and crisis action guards.
- `src/ui/GameUi.tsx`: preparation risk cards, complete opening review, business beats, and settlement breakdown.
- `src/ui/GameUi.test.tsx`: accessible static markup for all new fields.
- `src/App.tsx`: V4 initialization, forecast persistence, plan reuse/recommendation, crisis routing, and handlers.
- `src/App.css`: responsive information hierarchy, crisis scene, demand breakdown, and host-navigation safe spacing.
- `src/index.css`: only shared tokens needed by the new components.
- `PREP_REPORT.md`: final rule and verification summary.
- `VISUAL-QA.md`: 375/390/430/desktop evidence and issue log.

---

### Task 1: Lock the V4 Domain and Content Contracts

**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/content/schema.ts`
- Modify: `src/content/content.json`
- Modify: `src/content/content.test.ts`
- Modify: `src/tests/fixtures.ts`

**Interfaces:**
- Produces: `ShelfClass`, `DayForecast`, `ForecastDemandGroup`, `DemandResolution`, `DemandLosses`, `ProductDemandOutcome`, `FinancialHealthState`, `ActiveCrisisContract`, `CrisisContractDefinition`, and V4 `GameState` fields used by every later task.
- Consumes: existing `RngState`, `OperatingMode`, `EventCondition`, `EventEffect`, `DailyDecision`, and stable content IDs.

- [ ] **Step 1: Write failing schema and fixture tests**

Add assertions that a product requires a supported shelf class, crisis settings use the approved values, market-signal and demand-segment IDs are unique, and a fixture state is schema version 4 with a same-day forecast.

```ts
expect(makeState()).toMatchObject({
  schemaVersion: 4,
  financialHealth: { phase: 'normal', rescueUsed: false },
  dayForecast: { day: 10, weatherId: expect.any(String), demandGroups: expect.any(Array) },
})
expect(validateContent({
  ...rawContent,
  content: {
    ...rawContent.content,
    drinks: rawContent.content.drinks.map((drink, index) => index === 0
      ? { ...drink, shelfClass: 'unknown' }
      : drink),
  },
}, 'production').errors).toContainEqual(expect.stringContaining('shelfClass'))
```

- [ ] **Step 2: Run the focused tests and confirm red**

Run: `pnpm exec vitest run src/content/content.test.ts src/tests/fixtures.ts`

Expected: FAIL because V4 fields and shelf-class validation do not exist.

- [ ] **Step 3: Add exact domain types**

Define the following public shapes in `src/domain/types.ts` and extend `PageState` with `'financialCrisis'`:

```ts
export type ShelfClass = 'fresh' | 'brewed' | 'dry' | 'concentrate'
export type FinancialPhase = 'normal' | 'warning' | 'offer' | 'grace'
export type DemandLossReason = 'stockout' | 'menu-mismatch' | 'price' | 'service'

export interface ForecastDemandGroup {
  segmentId: string
  expectedCustomers: number
  actualCustomers: number
}

export interface DayForecast {
  forecastId: string
  day: number
  weatherId: string
  seasonId: string
  marketSignalId: string
  activeTags: string[]
  demandGroups: ForecastDemandGroup[]
}

export interface DemandLosses {
  stockout: number
  menuMismatch: number
  price: number
  service: number
}

export interface ProductDemandOutcome {
  productId: string
  directDemand: number
  directSold: number
  substituteSold: number
  prepared: number
  unsold: number
  stockoutLost: number
}

export interface DemandResolution {
  potentialBuyers: number
  servedCustomers: number
  losses: DemandLosses
  products: ProductDemandOutcome[]
}

export type BusinessBeatKind = 'direct-sale' | 'substitute' | 'stockout' | 'menu-mismatch' | 'price-left' | 'quiet'

export interface BusinessBeat {
  stage: 0 | 1 | 2 | 3
  kind: BusinessBeatKind
  count: number
  productId?: string
  alternativeProductId?: string
}

export interface ActiveCrisisContract {
  contractId: string
  acceptedDay: number
  graceEndsDay: number
  preorderProgress: number
}

export type ContractSceneTrigger = 'accepted' | 'first-installment' | 'second-installment' | 'target-success' | 'target-failure' | 'grace-success' | 'grace-failure'

export interface PendingContractScene {
  contractId: string
  trigger: ContractSceneTrigger
}

export interface FinancialHealthState {
  phase: FinancialPhase
  rescueUsed: boolean
  activeContract?: ActiveCrisisContract
}
```

Extend `Product` with `shelfClass`, extend `BusinessEvent` with optional `allowedOperatingModes`, store `dayForecast`, `financialHealth`, and `lastDecision` in `GameState`, and add `demandResolution` plus structured `businessBeats` to `PendingOpening` and `DailyResult`.

Extend the existing `ProductSale` without removing compatibility fields:

```ts
export interface ProductSale {
  productId: string
  prepared: number
  demand: number
  directSold: number
  substituteSold: number
  sold: number
  stockoutLost: number
  unsold: number
  price: number
}
```

Also store optional `pendingContractScene` in `GameState`; it is a stable contract ID plus trigger, never copied narrative text.

Extend `ActiveModifier` with `durationBasis?: 'calendar' | 'operating'` and `remainingOperatingDays?: number`. Existing modifiers default to calendar expiry; the pawn contract uses an operating-day duration and decrements only after `full` or `half` settlement.

- [ ] **Step 4: Add exact content interfaces and validators**

Define these exact content interfaces in `src/content/schema.ts`:

```ts
export interface DemandSegmentDefinition {
  segmentId: string
  label: string
  primaryTags: string[]
  acceptableTags: string[]
  maximumPriceRatio: number
  baseWeight: number
  tagWeights: { tag: string; multiplier: number }[]
}

export interface MarketSignalDefinition {
  signalId: string
  text: string
  dayRange: [number, number]
  seasonIds: string[]
  weatherIds: string[]
  activeTags: string[]
  visitorDelta: number
  segmentWeights: { segmentId: string; multiplier: number }[]
  weight: number
}

export type CrisisObligationDefinition =
  | { type: 'operating-modifier'; target: 'energy-cost'; operation: 'add'; value: number; operatingDays: number; playerLabel: string }
  | { type: 'repayment'; installments: { delayDays: number; amount: number; labelId: string }[] }
  | { type: 'sales-target'; targetCount: number; segmentIds: string[]; successMoney: number; successReputation: number; failureReputation: number }

export interface CrisisContractDefinition {
  contractId: string
  title: string
  content: string
  eligibility: EventCondition[]
  immediateMoney: number
  obligation: CrisisObligationDefinition
  scenes: {
    trigger: ContractSceneTrigger
    title: string
    content: string
    actorRole: EventActorRole
    assetId: string
  }[]
}
```

Add content roots `demandSegments`, `marketSignals`, and `crisisContracts`; add balance sections with these exact constraints:

```ts
forecast: {
  bandPadding: number
  hiddenVariation: [number, number]
}
shelfReturnRates: Record<ShelfClass, number>
crisis: {
  warningMoney: number
  hardDebtFloor: number
  graceDays: number
}
```

Validate `warningMoney === 16`, `hardDebtFloor === -20`, `graceDays === 3`, every return rate is in `[0, 1]`, segment and signal references exist, and optional `allowedOperatingModes` contains only `full`, `half`, or `rest` without duplicates.

- [ ] **Step 5: Populate the complete structural V4 content foundation**

Update `content.json` to `4.0.0-demand-crisis`; add the approved product shelf classes, five demand segments, season/weather-covering market signals, three crisis contracts, forecast/shelf/crisis balance sections, and every UI key required by the new typed views. Use the exact values from the spec so every following task runs against valid production content at each checkpoint.

- [ ] **Step 6: Upgrade fixtures to compile against V4**

Make `makeState()` return a V4 state with a deterministic default forecast and `financialHealth`. Extend result/opening factories with zeroed conserved losses and empty business beats.

- [ ] **Step 7: Re-run focused tests**

Run: `pnpm exec vitest run src/content/content.test.ts src/content/event-quality.test.ts src/engine/economy.test.ts`

Expected: PASS with the production JSON valid under the new structural contract.

- [ ] **Step 8: Review checkpoint**

Inspect `git diff --check` and confirm no code outside project04 changed. Do not commit in the current inline workflow.

---

### Task 2: Freeze Morning Weather and Market Demand

**Files:**
- Create: `src/engine/forecast.ts`
- Create: `src/engine/forecast.test.ts`
- Modify: `src/engine/simulator.ts`
- Modify: `src/engine/simulator.test.ts`

**Interfaces:**
- Consumes: `GameState`, `ShopContent`, `RngState`, content demand segments and market signals from Task 1.
- Produces: `createDayForecast(state: GameState, content: ShopContent): { forecast: DayForecast; rngState: RngState }` and `withDayForecast(state: GameState, content: ShopContent): GameState`.

- [ ] **Step 1: Write deterministic forecast tests**

```ts
const first = createDayForecast(makeState({ dayForecast: undefined }), content)
const replay = createDayForecast(makeState({ dayForecast: undefined }), content)
expect(first).toEqual(replay)
expect(first.forecast.day).toBe(10)
expect(first.forecast.demandGroups.every((group) => group.expectedCustomers >= 0)).toBe(true)
expect(first.forecast.demandGroups.every((group) => group.actualCustomers >= 0)).toBe(true)
```

Also assert that `withDayForecast` returns the same object when a matching forecast already exists and generates a new forecast only after the day changes.

- [ ] **Step 2: Run the new test and confirm red**

Run: `pnpm exec vitest run src/engine/forecast.test.ts`

Expected: FAIL with module-not-found or missing-export errors.

- [ ] **Step 3: Implement seeded forecast generation**

Move weather selection out of `openDay`. Select season, weather, and an eligible market signal with successive `nextRandom` calls. Generate each segment's expected count from stage visitors and content weights; generate actual count by applying the saved hidden variation. Clamp every count to a non-negative integer.

```ts
export function createDayForecast(state: GameState, content: ShopContent) {
  const weatherRoll = selectWeighted(state.rngState, eligibleWeather(state.day, content))
  const signalRoll = selectWeighted(weatherRoll.rngState, eligibleSignals(state.day, weatherRoll.item, content))
  const groups = buildForecastGroups(state, weatherRoll.item, signalRoll.item, content, signalRoll.rngState)
  return {
    forecast: {
      forecastId: `${state.saveId}-forecast-${state.day}-${state.rngState.value}`,
      day: state.day,
      weatherId: weatherRoll.item.weatherId,
      seasonId: seasonForDay(state.day, content).seasonId,
      marketSignalId: signalRoll.item.signalId,
      activeTags: unique([...weatherRoll.item.preferenceTags, ...signalRoll.item.activeTags]),
      demandGroups: groups.items,
    },
    rngState: groups.rngState,
  }
}
```

- [ ] **Step 4: Generate forecasts at new-game and next-day boundaries**

Call `withDayForecast` from `createNewGame` and after `resolveDay` advances the day. Make `openDay` reject a missing or wrong-day forecast rather than rolling weather silently.

- [ ] **Step 5: Verify forecast lifecycle**

Run: `pnpm exec vitest run src/engine/forecast.test.ts src/engine/simulator.test.ts src/domain/rng.test.ts`

Expected: PASS; a refresh-equivalent replay keeps identical weather and demand groups.

- [ ] **Step 6: Review checkpoint**

Run `git diff --check`; do not commit.

---

### Task 3: Replace Menu-Only Allocation with Conserved Preference Demand

**Files:**
- Modify: `src/engine/demand.ts`
- Modify: `src/engine/demand.test.ts`
- Modify: `src/domain/types.ts`

**Interfaces:**
- Consumes: `resolveDemand(state, forecast, decision, content)` inputs from Tasks 1–2.
- Produces: `resolveDemand(...): DemandResolution` and `estimateProductDemandBands(...): Record<string, DemandBand>` where `DemandBand` is `{ minimum: number; maximum: number; tendency: 'hot' | 'steady' | 'quiet' }`.

```ts
export interface DemandBand {
  minimum: number
  maximum: number
  tendency: 'hot' | 'steady' | 'quiet'
}

export function estimateProductDemandBands(
  state: GameState,
  forecast: DayForecast,
  decision: DailyDecision,
  content: ShopContent,
): Record<string, DemandBand>
```

- [ ] **Step 1: Write a table-driven failing conservation suite**

Cover direct matches, no menu match, high-price rejection, first-choice stockout, one accepted substitute, one rejected substitute, low service capacity, and a zero-preparation listing.

```ts
const total = result.servedCustomers
  + result.losses.stockout
  + result.losses.menuMismatch
  + result.losses.price
  + result.losses.service
expect(total).toBe(result.potentialBuyers)
expect(result.products.every((item) => item.directSold + item.substituteSold <= item.prepared)).toBe(true)
```

- [ ] **Step 2: Run the demand suite and confirm red**

Run: `pnpm exec vitest run src/engine/demand.test.ts`

Expected: FAIL because the existing funnel distributes all buyers only among listed products.

- [ ] **Step 3: Implement deterministic group resolution**

Process forecast groups in stable `segmentId` order. Apply service capacity first, then price and primary-tag matching. If the chosen product is unavailable, try exactly one acceptable-tag substitute; never recurse. Track the reason for every customer who does not buy.

```ts
export function resolveDemand(
  state: GameState,
  forecast: DayForecast,
  decision: DailyDecision,
  content: ShopContent,
): DemandResolution
```

Use proportional integer allocation with stable remainder ordering so the result is deterministic and conserved.

- [ ] **Step 4: Implement forecast bands from expected—not actual—counts**

Run the same scoring rules against `expectedCustomers`, then expand each product by `bandPadding`. Never read `actualCustomers` in `estimateProductDemandBands`, ensuring the UI cannot reveal the hidden exact result.

- [ ] **Step 5: Verify all demand invariants**

Run: `pnpm exec vitest run src/engine/demand.test.ts src/engine/economy.test.ts`

Expected: PASS with no duplicated substitute customer and no sales above preparation.

- [ ] **Step 6: Review checkpoint**

Run `git diff --check`; do not commit.

---

### Task 4: Unify Opening Estimates and Final Settlement

**Files:**
- Modify: `src/engine/economy.ts`
- Modify: `src/engine/economy.test.ts`
- Modify: `src/engine/settlement-insight.ts`
- Modify: `src/engine/settlement-insight.test.ts`

**Interfaces:**
- Consumes: `DemandResolution`, `DayForecast`, `DailyDecision`, `ShopContent`.
- Produces: `estimateOpeningBudget(...)`, expanded `calculateTrading(...)`, and structured primary settlement reasons.

- [ ] **Step 1: Write failing estimate-parity and waste-return tests**

```ts
const estimate = estimateOpeningBudget(state, decision, forecast, content)
expect(estimate).toMatchObject({
  stockCost: 39,
  rentCost: 4,
  operatingCost: 2,
  cashAfterOpening: 75,
})
expect(estimate.cashAfterOpening).toBe(state.money - estimate.stockCost - estimate.rentCost - estimate.operatingCost)
```

Test one unsold unit for every shelf class and assert `Math.floor(unitCost * shelfReturnRate)`.

- [ ] **Step 2: Run economy tests and confirm red**

Run: `pnpm exec vitest run src/engine/economy.test.ts src/engine/settlement-insight.test.ts`

Expected: FAIL because budget omits fixed costs and products use one `keepRate`.

- [ ] **Step 3: Add shared budget estimation**

```ts
export interface OpeningBudgetEstimate {
  stockCost: number
  rentCost: number
  operatingCost: number
  cashAfterOpening: number
  projectedMinimum: number
  projectedMaximum: number
  risk: 'safe' | 'possible-debt' | 'certain-debt'
}

export function estimateOpeningBudget(
  state: GameState,
  decision: DailyDecision,
  forecast: DayForecast,
  content: ShopContent,
): OpeningBudgetEstimate

export function calculateTrading(
  state: GameState,
  context: DayContext,
  decision: DailyDecision,
  content: ShopContent,
  demand: DemandResolution,
): TradingResult
```

Compute fixed costs through the same helper used by final settlement. Use demand-band endpoints to calculate projected income bounds; classify `certain-debt` when even the optimistic result is below zero.

- [ ] **Step 4: Settle expanded product outcomes**

Build `ProductSale` entries from `DemandResolution`, retaining direct sales, substitute sales, stockout loss, prepared amount, sold amount, and unsold amount. Calculate shelf-class return from `content.balance.shelfReturnRates` and keep all ledger lines explainable.

- [ ] **Step 5: Derive one primary reason from structured data**

Use this precedence when the day is not rest: certain loss/negative net, price loss, menu mismatch, service loss, stockout, waste, profitable. Return only one primary reason to the first settlement screen; detailed counts remain in the breakdown.

- [ ] **Step 6: Re-run focused tests**

Run: `pnpm exec vitest run src/engine/economy.test.ts src/engine/settlement-insight.test.ts`

Expected: PASS and ledger sum equals `moneyDelta` in every fixture.

- [ ] **Step 7: Review checkpoint**

Run `git diff --check`; do not commit.

---

### Task 5: Implement the One-Time Crisis State Machine

**Files:**
- Create: `src/engine/financial-health.ts`
- Create: `src/engine/financial-health.test.ts`
- Modify: `src/engine/effects.ts`
- Modify: `src/engine/effects.test.ts`
- Modify: `src/engine/endings.ts`
- Modify: `src/engine/endings.test.ts`

**Interfaces:**
- Produces: `assessFinancialHealth`, `requiredFinancialPage`, `availableCrisisContracts`, `acceptCrisisContract`, `recordContractSales`, `advanceCrisisDay`, and `queueContractScene`.
- Consumes: V4 state, content crisis settings, generic conditions/effects, and `DailyResult`.

- [ ] **Step 1: Write failing transition tests**

Test normal at 16, warning at 15, offer at −1 with unused rescue, no premature ending, pawn always available, credit at relationships 35, preorder at reputation 35, grace hard floor −20, third-day recovery at zero, third-day failure below zero, and later immediate failure after rescue.

```ts
expect(assessFinancialHealth(makeState({ money: -1 }), content)).toBe('offer')
expect(availableCrisisContracts(makeState({ relationships: 34 }), content).map((item) => item.contractId)).toEqual(['crisis-pawn'])
expect(availableCrisisContracts(makeState({ relationships: 35 }), content).map((item) => item.contractId)).toContain('crisis-credit')
```

Use these exact signatures for state transitions:

```ts
export type FinancialAssessment = FinancialPhase | 'bankruptcy'
export function assessFinancialHealth(state: GameState, content: ShopContent): FinancialAssessment
export function requiredFinancialPage(state: GameState, content: ShopContent): 'financialCrisis' | undefined
export function recordContractSales(state: GameState, result: DailyResult, content: ShopContent): GameState
export function advanceCrisisDay(state: GameState, content: ShopContent): { state: GameState; shouldClose: boolean }
export function queueContractScene(state: GameState, trigger: ContractSceneTrigger): GameState
```

- [ ] **Step 2: Run crisis tests and confirm red**

Run: `pnpm exec vitest run src/engine/financial-health.test.ts src/engine/endings.test.ts`

Expected: FAIL because negative money currently resolves immediate bankruptcy.

- [ ] **Step 3: Implement eligibility and acceptance**

```ts
export function availableCrisisContracts(state: GameState, content: ShopContent): CrisisContractDefinition[]

export function acceptCrisisContract(
  state: GameState,
  contractId: string,
  content: ShopContent,
): { state: GameState; ledger: LedgerLine[] }
```

Reject unknown, locked, duplicate, or already-used contracts. Apply the configured immediate money, mark `rescueUsed`, set `phase: 'grace'`, and calculate `graceEndsDay = state.day + 3`.

- [ ] **Step 4: Implement exact obligations**

- Pawn: install an `energy-cost +2` modifier lasting seven operating days.
- Credit: schedule −11 money on accepted day +4 and +7, each with a visible ledger label.
- Preorder: count only sold drinks matching configured segment tags; at 12 within the three-natural-day window, award +16 and reputation; otherwise apply the configured reputation loss and no final payment.

Queue a stable `pendingContractScene` at acceptance, each credit installment, preorder success/failure, and grace success/failure. Clear it only after the player acknowledges the corresponding content-defined scene.

Use structured effects or contract-obligation data, never contract-ID checks in React.

- [ ] **Step 5: Gate bankruptcy behind financial health**

Change ending resolution so first negative cash with unused rescue routes to `financialCrisis`; only the crisis state machine can authorize `ending-closed-early` during or after rescue.

- [ ] **Step 6: Verify crisis behavior**

Run: `pnpm exec vitest run src/engine/financial-health.test.ts src/engine/effects.test.ts src/engine/endings.test.ts`

Expected: PASS; no route can use rescue twice or freeze grace by resting.

- [ ] **Step 7: Review checkpoint**

Run `git diff --check`; do not commit.

---

### Task 6: Add Reusable and Recommended Preparation Plans

**Files:**
- Create: `src/engine/planning.ts`
- Create: `src/engine/planning.test.ts`
- Modify: `src/domain/types.ts`

**Interfaces:**
- Produces: `reuseLastDecision(state, content): DailyDecision | undefined` and `recommendDecision(state, forecast, content): DailyDecision`.
- Consumes: `lastDecision`, demand bands, opening-budget estimate, unlocked drinks, and energy.

- [ ] **Step 1: Write failing planning tests**

```ts
const plan = recommendDecision(makeState({ money: 30 }), forecast, content)
const estimate = estimateOpeningBudget(state, plan, forecast, content)
expect(plan.menu).toHaveLength(3)
expect(estimate.cashAfterOpening).toBeGreaterThanOrEqual(0)
expect(plan.menu.every((item) => item.price === content.drinks.find((drink) => drink.productId === item.productId)?.basePrice)).toBe(true)
```

Assert reuse removes now-locked products, clamps quantities/prices to current rules, and returns undefined if fewer than three valid products remain.

- [ ] **Step 2: Run planning tests and confirm red**

Run: `pnpm exec vitest run src/engine/planning.test.ts`

Expected: FAIL with missing module/export.

- [ ] **Step 3: Implement the non-optimal Ayuan recommendation**

Choose three unlocked products covering the dominant forecast tags, keep base prices, prepare each product at the midpoint of its forecast band capped to 1–6, then reduce the highest-cost quantities until stock plus fixed costs are affordable. If no three one-unit products are affordable, return a rest plan and let the warning/crisis UI explain why.

- [ ] **Step 4: Implement yesterday-plan reuse**

Copy the full prior `DailyDecision`, not only aggregate summaries. Never mutate the stored decision. Revalidate it against current unlocked products and price/quantity boundaries.

- [ ] **Step 5: Verify planning helpers**

Run: `pnpm exec vitest run src/engine/planning.test.ts src/engine/economy.test.ts`

Expected: PASS across normal, low-money, zero-energy, and changed-unlock fixtures.

- [ ] **Step 6: Review checkpoint**

Run `git diff --check`; do not commit.

---

### Task 7: Integrate Forecast, Demand, Events, Settlement, and Crisis

**Files:**
- Modify: `src/engine/events.ts`
- Modify: `src/engine/events.test.ts`
- Modify: `src/engine/simulator.ts`
- Modify: `src/engine/simulator.test.ts`
- Modify: `src/engine/simulation.test.ts`
- Modify: `src/engine/story-integration.test.ts`

**Interfaces:**
- Consumes: forecast, demand, economy, crisis, and planning functions from Tasks 2–6.
- Produces: a complete V4 `openDay`/`resolveDay` vertical slice with deterministic routing.

- [ ] **Step 1: Write failing narrative-priority tests**

Assert this exact order across simulator routing and event selection: pending crisis offer or contract scene, due chain node, due follow-up, random ordinary event, none. Assert a rest day rejects business events but allows an event whose `allowedOperatingModes` includes `rest`.

```ts
const page = requiredFinancialPage(makeState({
  page: 'morning',
  pendingContractScene: { contractId: 'crisis-credit', trigger: 'first-installment' },
}), content)
expect(page).toBe('financialCrisis')
```

- [ ] **Step 2: Write failing daily-flow tests**

Cover frozen weather consumption, demand conservation in `PendingOpening`, full fixed costs, crisis interception after negative settlement, three natural days including rest, next-day forecast generation, and idempotent resolution IDs.

- [ ] **Step 3: Run integration tests and confirm red**

Run: `pnpm exec vitest run src/engine/events.test.ts src/engine/simulator.test.ts src/engine/story-integration.test.ts`

Expected: FAIL on old event ordering, weather roll, and bankruptcy route.

- [ ] **Step 4: Refactor event selection**

Route pending crisis/contract scenes before opening. Then filter event candidates through operating-mode eligibility, resolving due chain and follow-up content before the ordinary-event chance roll. Set configured ordinary chances to full 0.50, half 0.40, and rest 0.00; eligible due non-business content bypasses the rest random chance.

- [ ] **Step 5: Refactor `openDay`**

Require `state.dayForecast.day === state.day`. Build `DayContext` from the forecast, resolve event modifiers, call `resolveDemand`, call the shared economy settlement, and store structured demand plus four business beats in `PendingOpening`.

- [ ] **Step 6: Refactor `resolveDay`**

Apply all money/stat effects, update contract progress, assess financial health before ending resolution, and route first insolvency to `financialCrisis`. On normal advancement, save `lastDecision`, increment the day, and create the next frozen forecast.

- [ ] **Step 7: Verify the vertical slice**

Run: `pnpm exec vitest run src/engine/events.test.ts src/engine/simulator.test.ts src/engine/simulation.test.ts src/engine/story-integration.test.ts`

Expected: PASS; replaying a seed and decision sequence produces byte-equivalent structured outcomes.

- [ ] **Step 8: Review checkpoint**

Run `git diff --check`; do not commit.

---

### Task 8: Audit and Complete the V4 Story and Event Content

**Files:**
- Modify: `src/content/content.json`
- Modify: `src/content/schema.ts`
- Modify: `src/content/content.test.ts`
- Modify: `src/content/event-quality.ts`
- Modify: `src/content/event-quality.test.ts`
- Modify: `src/content/event-semantics.test.ts`

**Interfaces:**
- Produces: an audited `4.0.0-demand-crisis` content package with complete rest eligibility, crisis presentation copy, market-signal coverage, and zero production validation errors.
- Consumes: exact interfaces and validators from Task 1.

- [ ] **Step 1: Add failing content-quality fixtures**

Test event immediate money below −20, a rest-eligible business scene, a future hint without persistent effect, duplicate market signal IDs, missing segment references, and invalid crisis contract obligations.

```ts
expect(validateEventQuality(contentWithChoiceMoney(-21))).toContainEqual(
  expect.stringContaining('即时现钱损失不得低于 -20'),
)
```

- [ ] **Step 2: Run content tests and confirm red**

Run: `pnpm exec vitest run src/content/content.test.ts src/content/event-quality.test.ts src/content/event-semantics.test.ts`

Expected: FAIL until all V4 content and validators are present.

- [ ] **Step 3: Audit demand and market coverage**

Verify the five demand segments cover cool/sour, sweet/warm, herbal/light, hot/spiced, and novel/signature preferences. Verify market signals cover all four seasons and all weather families, with no signal referencing a locked-only preference. Rewrite any vague signal so it is specific to Northern Song street life and actionable at preparation time.

- [ ] **Step 4: Audit shelf, balance, and crisis values**

Assert the exact product classifications and return rates from the spec: fresh 0.10, brewed 0.25, dry 0.35, concentrate 0.45. Assert crisis values 16, −20, and 3, and ordinary event chances 0.50/0.40/0.00. Correct only `content.json` when an audited value differs.

- [ ] **Step 5: Complete crisis and operating UI copy**

Verify stable IDs `crisis-pawn`, `crisis-credit`, and `crisis-preorder` have the exact money, thresholds, durations, installments, target, and reputation consequences from the spec. Require content-defined acceptance and resolution scenes for every contract; credit additionally requires first/second installment scenes, and preorder requires target-success/target-failure scenes. Add or refine player-facing copy for demand bands, full cost rows, risk warnings, four business beats, detailed loss reasons, crisis status, obligations, and failure explanations.

- [ ] **Step 6: Mark rest-eligible narrative content**

Leave ordinary business events at the default selling modes. Explicitly allow rest only for logically valid letters, visits, repayments, relationship follow-ups, and contract nodes; do not allow counter disputes, queues, sales, or opening incidents during rest.

- [ ] **Step 7: Repair any event exceeding the loss ceiling**

For each choice below −20, split the consequence into an immediate amount no lower than −20 plus a clearly previewed scheduled obligation, or rebalance it while preserving narrative meaning. Re-run semantic checks after each edit.

- [ ] **Step 8: Verify production content**

Run: `pnpm exec vitest run src/content/content.test.ts src/content/event-quality.test.ts src/content/event-semantics.test.ts src/engine/story-integration.test.ts`

Expected: PASS with exact event/chain/ending counts preserved and all new references valid.

- [ ] **Step 9: Review checkpoint**

Run `git diff --check`; do not commit.

---

### Task 9: Migrate and Validate Save Schema V4

**Files:**
- Create: `src/storage/migrate-v3.ts`
- Create: `src/storage/migrate-v3.test.ts`
- Modify: `src/storage/save-codec.ts`
- Modify: `src/storage/save-codec.test.ts`
- Modify: `src/storage/migrate-v1.test.ts`
- Modify: `src/storage/migrate-v2.test.ts`
- Modify: `src/storage/repository.test.ts`

**Interfaces:**
- Produces: `migrateV3Save(value: unknown, content: ShopContent): SaveRecoveryResult` and V4-only `validState`/round-trip behavior.
- Consumes: `withDayForecast`, V4 state fields, and existing previous-day fallback.

- [ ] **Step 1: Write the V3 migration matrix**

Test unopened morning, pending opening, negative non-ending, existing bankruptcy, invalid current with valid previous day, and future version 5.

```ts
expect(migrateV3Save(v3Morning, content)).toMatchObject({
  status: 'migrated',
  payload: { schemaVersion: 4, current: { schemaVersion: 4, financialHealth: { rescueUsed: false } } },
})
expect(migrateV3Save(v3PendingOpening, content).payload.current.pendingOpening).toEqual(v3PendingOpening.current.pendingOpening)
```

- [ ] **Step 2: Run migration tests and confirm red**

Run: `pnpm exec vitest run src/storage/migrate-v3.test.ts src/storage/save-codec.test.ts`

Expected: FAIL with missing migrator and V4 rejection.

- [ ] **Step 3: Implement V3-to-V4 conversion**

- Unopened state: generate and persist one forecast.
- Pending opening: preserve its original weather, sales, ledger, RNG, and resolution ID; synthesize only compatible zeroed V4 demand fields without recalculation.
- Negative non-ending: set `phase: 'offer'`, `rescueUsed: false`, page `financialCrisis`.
- Existing ending: preserve ending and page exactly.
- Store `lastDecision` only when recoverable from the latest decision summary; otherwise leave it undefined.

- [ ] **Step 4: Chain old migrations into V4**

Run V1→V3 or V2→V3 through the existing migrators, then V3→V4. Change future-version detection to `> 4`, require state/payload schema 4, and bound all new arrays and strings. Validate `dayForecast`, conserved demand fields, `financialHealth`, `pendingContractScene`, and operating-day modifier fields; reject an operating modifier whose remaining days are negative or whose duration basis is inconsistent.

- [ ] **Step 5: Verify save safety**

Run: `pnpm exec vitest run src/storage/migrate-v1.test.ts src/storage/migrate-v2.test.ts src/storage/migrate-v3.test.ts src/storage/save-codec.test.ts src/storage/repository.test.ts`

Expected: PASS; unsafe media remains rejected and previous-day recovery still works.

- [ ] **Step 6: Review checkpoint**

Run `git diff --check`; do not commit.

---

### Task 10: Expose the New Rules Through the View Model

**Files:**
- Modify: `src/state/view-model.ts`
- Modify: `src/state/view-model.test.ts`
- Modify: `src/state/resume-route.ts`
- Modify: `src/state/resume-route.test.ts`
- Modify: `src/state/ui-flow.ts`
- Modify: `src/state/ui-flow.test.ts`

**Interfaces:**
- Produces: `MorningIntelView`, `OpeningBudgetView`, `ProductForecastView`, `DemandBreakdownView`, `BusinessBeatView`, and `FinancialCrisisView` as fields of `GameViewModel`.
- Consumes: only structured engine/content data; performs formatting and label lookup, not economic calculations.

- [ ] **Step 1: Write failing view-model tests**

```ts
expect(view.morningIntel).toMatchObject({
  weatherName: '暑热',
  marketSignal: expect.any(String),
  yesterdayInsight: expect.any(String),
})
expect(view.budget).toMatchObject({
  stockCost: expect.any(Number),
  rentCost: 4,
  operatingCost: 2,
  risk: expect.stringMatching(/safe|possible-debt|certain-debt/),
})
```

Assert all player-facing axes use Chinese labels and no view text equals `M`, `H`, `R`, or `M/H/R`.

- [ ] **Step 2: Run state tests and confirm red**

Run: `pnpm exec vitest run src/state/view-model.test.ts src/state/resume-route.test.ts src/state/ui-flow.test.ts`

Expected: FAIL because these views and crisis route do not exist.

- [ ] **Step 3: Build presentation-only views**

Call `estimateOpeningBudget` and `estimateProductDemandBands` once in `buildGameViewModel`. Format content labels, trend states, detailed demand losses, four business beats, contract eligibility, grace status, and obligations. Do not recompute customer allocation in the view model.

- [ ] **Step 4: Add resume and UI-flow routing**

`resolveResumeRoute` must return `financialCrisis` when a contract offer is pending and preserve pending business/event pages. Keep business stages clamped to 0–3 regardless of menu length. Guard duplicate crisis submissions with the existing `isSubmitting` pattern.

- [ ] **Step 5: Verify presentation contracts**

Run: `pnpm exec vitest run src/state/view-model.test.ts src/state/resume-route.test.ts src/state/ui-flow.test.ts`

Expected: PASS with no business calculation duplicated in JSX-facing types.

- [ ] **Step 6: Review checkpoint**

Run `git diff --check`; do not commit.

---

### Task 11: Build the Morning, Preparation, Settlement, and Crisis UI

**Files:**
- Create: `src/ui/MorningIntel.tsx`
- Create: `src/ui/MorningIntel.test.tsx`
- Create: `src/ui/FinancialCrisis.tsx`
- Create: `src/ui/FinancialCrisis.test.tsx`
- Modify: `src/ui/GameUi.tsx`
- Modify: `src/ui/GameUi.test.tsx`
- Modify: `src/ui/AyuanStage.tsx`
- Modify: `src/ui/AyuanStage.test.tsx`
- Modify: `src/App.css`
- Modify: `src/index.css`

**Interfaces:**
- Consumes: view types from Task 10 and callbacks supplied by `App`.
- Produces: accessible components with no hardcoded business copy.

- [ ] **Step 1: Write failing static-render tests**

Assert morning weather/signal/insight, full cost rows, demand bands, shelf class, risk text, four business moments, detailed loss counts, contract requirements, and grace countdown.

```tsx
const html = renderToStaticMarkup(<FinancialCrisis view={crisisView} copy={copy} onAccept={() => {}} />)
expect(html).toContain('典当备用铜壶')
expect(html).toContain('未来 7 个营业日')
expect(html).toContain('三日周转')
expect(html).not.toContain('M/H/R')
```

- [ ] **Step 2: Run UI tests and confirm red**

Run: `pnpm exec vitest run src/ui/MorningIntel.test.tsx src/ui/FinancialCrisis.test.tsx src/ui/GameUi.test.tsx src/ui/AyuanStage.test.tsx`

Expected: FAIL with missing components and fields.

- [ ] **Step 3: Implement morning and preparation UI**

Render Ayuan's morning stage beside weather, market clue, and yesterday insight. In preparation cards, show tendency, demand range, shelf type, quantity, price, and text-backed risk. Add “沿用昨日方案” and “采用阿元建议” actions. Render current money, stock, rent, operating cost, cash after opening, and projected range in normal flow.

- [ ] **Step 4: Implement opening and business UI**

Opening review repeats the same complete cost breakdown and requires a dedicated confirmation state for `possible-debt`; disable opening for `certain-debt`. Business playback reads exactly four structured beats by time period, independent of menu count.

- [ ] **Step 5: Implement settlement and crisis UI**

Settlement first shows net result, one primary cause, and tomorrow hint; detailed per-product demand and ledger remain expandable. Crisis uses an independent Galgame screen with large portrait, contract cards, explicit eligibility, immediate benefit, obligation, and one guarded accept action.

- [ ] **Step 6: Implement responsive styling**

Use existing tokens and `AyuanStage`. Keep actions in document flow, reserve host navigation/safe spacing with existing screen-frame patterns, ensure text/button contrast, and avoid negative margins over scene copy. At ≤430px use one-column cards; desktop may use two columns without shrinking the character portrait below the approved Galgame size.

- [ ] **Step 7: Verify component tests**

Run: `pnpm exec vitest run src/ui/MorningIntel.test.tsx src/ui/FinancialCrisis.test.tsx src/ui/GameUi.test.tsx src/ui/AyuanStage.test.tsx src/ui/ScreenFrame.test.tsx`

Expected: PASS with semantic headings, labels, alerts, and disabled states.

- [ ] **Step 8: Review checkpoint**

Run `git diff --check`; do not commit.

---

### Task 12: Wire the V4 Application Flow and Persistence

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/state/game-machine.ts`
- Modify: `src/state/game-machine.test.ts`
- Modify: `src/storage/indexed-db.ts`
- Modify: `src/storage/repository.test.ts`

**Interfaces:**
- Consumes: all V4 engine, view, routing, and UI interfaces.
- Produces: playable landing→morning→preparation→review→business/event→settlement→crisis/next-day flow.

- [ ] **Step 1: Write failing route-transition tests**

Cover new game with frozen forecast, continue morning without reroll, reuse/recommend decision actions, possible-debt confirmation, certain-debt refusal, crisis offer acceptance, grace-day persistence, and outcome after authorized failure.

- [ ] **Step 2: Run app-state tests and confirm red**

Run: `pnpm exec vitest run src/state/game-machine.test.ts src/state/resume-route.test.ts src/storage/repository.test.ts`

Expected: FAIL until V4 transitions and persistence are wired.

- [ ] **Step 3: Replace default decision creation**

At each morning prefer a valid reused plan only when the player presses reuse; otherwise initialize from `recommendDecision`. Preserve manual edits while moving between preparation and opening review.

- [ ] **Step 4: Wire debt-risk confirmation and four-stage playback**

Use view-model risk state to require confirmation for possible debt and block certain debt. Do not calculate costs in handlers. Keep quick settlement and event interruption compatible with four business stages.

- [ ] **Step 5: Wire crisis acceptance and persistence**

Add an idempotent `handleAcceptCrisisContract(contractId)` using `acceptCrisisContract`, persist current and previous snapshots, route to the next morning, and surface recoverable errors through the existing error screen.

- [ ] **Step 6: Verify full application state flow**

Run: `pnpm exec vitest run src/state/game-machine.test.ts src/state/resume-route.test.ts src/storage/repository.test.ts src/engine/simulator.test.ts`

Expected: PASS with no duplicate day resolution or contract acceptance.

- [ ] **Step 7: Review checkpoint**

Run `git diff --check`; do not commit.

---

### Task 13: Rebalance, Audit, and Complete Real-Browser QA

**Files:**
- Modify: `src/engine/balance-audit.ts`
- Modify: `src/engine/balance-audit.test.ts`
- Modify: `src/engine/simulation.test.ts`
- Modify: `src/content/content.json`
- Modify: `PREP_REPORT.md`
- Modify: `VISUAL-QA.md`

**Interfaces:**
- Consumes: completed V4 game loop.
- Produces: approved survival/crisis bands, final automated evidence, and responsive QA evidence.

- [ ] **Step 1: Write failing audit thresholds**

```ts
expect(summary.survivalRateByStrategy.informed).toBeGreaterThanOrEqual(0.75)
expect(summary.survivalRateByStrategy.informed).toBeLessThanOrEqual(0.90)
expect(summary.survivalRateByStrategy.basic).toBeGreaterThanOrEqual(0.55)
expect(summary.survivalRateByStrategy.basic).toBeLessThanOrEqual(0.75)
expect(summary.survivalRateByStrategy.overstock).toBeLessThan(0.40)
expect(summary.crisisRateByStrategy.basic).toBeGreaterThanOrEqual(0.20)
expect(summary.crisisRateByStrategy.basic).toBeLessThanOrEqual(0.35)
expect(summary.forecastCoverageRate).toBeGreaterThanOrEqual(0.75)
expect(summary.forecastCoverageRate).toBeLessThanOrEqual(0.85)
expect(summary.softLockCount).toBe(0)
```

- [ ] **Step 2: Run balance audit and confirm red where tuning is needed**

Run: `pnpm exec vitest run src/engine/balance-audit.test.ts src/engine/simulation.test.ts`

Expected: deterministic results; at least one approved band may fail before tuning.

- [ ] **Step 3: Tune only content values**

Adjust stage visitors, segment weights, hidden variation, substitution chance, service capacity, shelf returns, or product cost/price in `content.json`. Do not special-case strategies or seeds in TypeScript. Re-run the focused audit after each single-variable change.

- [ ] **Step 4: Run the complete automated gate**

Run: `pnpm lint && pnpm test && pnpm build`

Expected: lint exit 0, all Vitest files pass without skipped/deleted coverage, TypeScript/Vite build exit 0. The existing bundle-size warning may remain only if no new regression is introduced.

- [ ] **Step 5: Start the production preview for browser QA**

Run: `pnpm preview --host 127.0.0.1`

Exercise new game, manual preparation, reuse, recommendation, all four business stages, settlement expansion, an injected deterministic crisis fixture, each contract, save/refresh/resume, and final failure.

- [ ] **Step 6: Verify responsive widths and host-navigation safety**

At 375, 390, 430, and 1024 CSS px, assert `document.documentElement.scrollWidth === window.innerWidth`, no scene/dialog overlap, no clipped action, readable button contrast, visible character face, correct focus order, and zero console errors/warnings. Include the real host top navigation height or equivalent inset in the viewport check.

- [ ] **Step 7: Update project-local evidence**

Record exact commands, pass counts, tested widths, console status, balance metrics, and any non-blocking bundle warning in `PREP_REPORT.md` and `VISUAL-QA.md`. Do not edit root documentation.

- [ ] **Step 8: Final review checkpoint**

Run `git status --short -- .` and `git diff --check`. Confirm only project04 files changed, no dependency/lockfile changes exist, and every requirement in `ECONOMY-DEMAND-CRISIS-REDESIGN.md` maps to passing evidence. Do not commit or push.

---

## Execution Checkpoints

Execute inline in four reviewable batches:

1. **Rules foundation:** Tasks 1–4; run all domain/content/forecast/demand/economy tests.
2. **Crisis and vertical engine:** Tasks 5–9; run engine, event, story, and storage suites.
3. **Presentation and app flow:** Tasks 10–12; run state and UI suites, then inspect the main routes in-browser.
4. **Balance and release QA:** Task 13; run the full gate and responsive verification.

At each checkpoint, report files changed, tests run, failures found, and any design pressure requiring user approval before proceeding.
