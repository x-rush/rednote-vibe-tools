# Economy, Story, and Light Galgame Rebalance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the daily economy around real conversion and three operating modes, add six branching ordinary-event follow-ups, and present preparation/rest/settlement through a responsive light-Galgame Ayuan stage.

**Architecture:** Keep all authored values and Chinese copy in `src/content/content.json`; pure TypeScript modules calculate foot traffic, conversion, demand, service capacity, trading, and settlement insight. Upgrade saves from schema 2 to schema 3 without recalculating frozen openings, then expose typed view-model fields to focused React components. Implement in vertical slices with failing tests first and preserve the existing event-chain resolver.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Vitest 4, oxlint, CSS; no new dependencies.

**Spec:** `ECONOMY-STORY-REBALANCE-DESIGN.md`

## Global Constraints

- Modify only `projects/04-bianjing-drink-shop`; do not change root manifests, lockfiles, `docs/`, `prep/`, or any other project.
- Business values and user-facing copy live only in `src/content/content.json`; JSX consumes typed view-model data.
- Pure static frontend; no backend, runtime CDN, required external API, Service Worker, Node runtime API, or unconfirmed device API.
- Save only stable IDs, numbers, timestamps, and bounded text; never save images, Base64, audio, video, or Blob values.
- Preserve deterministic fixed-seed simulation and frozen pending-opening results.
- No new dependencies.
- Do not commit or push from the current dirty shared worktree; each task ends in a test checkpoint instead.
- Completion requires `pnpm lint && pnpm test && pnpm build` and real-browser checks at 375, 390, and 430 CSS px.
- Do not delete or weaken tests to obtain a pass.

## File Structure

- Create `src/engine/demand.ts`: pure conversion-rate, buyer-count, service-capacity, and product-demand functions.
- Create `src/engine/operating-mode.ts`: pure mode lookup, decision normalization, mode validation, and energy-delta helpers.
- Create `src/engine/settlement-insight.ts`: choose one stable, typed primary settlement reason for Ayuan feedback.
- Create `src/storage/migrate-v2.ts`: convert schema-2 saves and frozen openings to schema 3.
- Create `src/ui/AyuanStage.tsx`: accessible preparation/rest/settlement character stage.
- Create `src/ui/AyuanStage.test.tsx`: static-render contracts for stage variants and copy.
- Modify `src/domain/types.ts`: operating modes, demand funnel fields, follow-up queue, schema-3 result fields, and insight types.
- Modify `src/content/schema.ts`: validate new balance configuration, final 92-event contract, and follow-up references.
- Modify `src/content/content.json`: authored balance values, mode/insight copy, 12 follow-up events, and content version.
- Modify `src/engine/economy.ts`: retain foot-traffic and trading ledger work, delegating demand to `demand.ts`.
- Modify `src/engine/simulator.ts`: full/half/rest state transitions, follow-up queue writes, and new result fields.
- Modify `src/engine/events.ts`: mode-aware ordinary-event probability and queued follow-up priority after chains.
- Modify `src/engine/balance-audit.ts`: ten-day and long-run strategies using the three modes.
- Modify `src/state/view-model.ts`: expose operating choices, demand funnel, settlement insight, and Ayuan dialogue.
- Modify `src/ui/GameUi.tsx`: operating-mode controls, rest-mode form behavior, opening summary, and richer sales results.
- Modify `src/App.tsx`: new decision handlers and Ayuan stage integration.
- Modify `src/App.css`: responsive Galgame composition with no image/text overlap.
- Modify existing tests and fixtures named in each task; preserve all current suites.

---

### Task 1: Lock the schema-3 domain and authored balance contract

**Files:**
- Create: `src/engine/operating-mode.ts`
- Modify: `src/domain/types.ts`
- Modify: `src/content/schema.ts`
- Modify: `src/content/content.json`
- Modify: `src/content/content.test.ts`
- Modify: `src/tests/fixtures.ts`

**Interfaces:**
- Produces: `OperatingMode = 'full' | 'half' | 'rest'`.
- Produces: `OperatingModeDefinition`, `ConversionDefinition`, `ServiceDefinition`, and new `BalanceDefinition` fields.
- Produces: `OperatingMode`, transitional decision/history compatibility fields, `PendingFollowUp`, and schema-3 demand/result fields.
- Consumes: existing product, weather, modifier, ledger, and event types.

- [ ] **Step 1: Write failing content and type-contract tests**

Add assertions to `src/content/content.test.ts` that production content has all three operating modes, bounded conversion rates, and positive service capacity:

```ts
expect(Object.keys(content.balance.operatingModes).sort()).toEqual(['full', 'half', 'rest'])
expect(content.balance.conversion.minimumRate).toBeGreaterThanOrEqual(0)
expect(content.balance.conversion.maximumRate).toBeLessThanOrEqual(1)
expect(content.balance.conversion.minimumRate).toBeLessThan(content.balance.conversion.maximumRate)
expect(content.balance.service.baseCapacity).toBeGreaterThan(0)
```

Change `basicDecision` in `src/tests/fixtures.ts` to use `operatingMode: 'full'`; TypeScript should fail until the domain type is updated.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `pnpm test -- src/content/content.test.ts`

Expected: FAIL because the balance fields do not exist.

- [ ] **Step 3: Add the domain interfaces and safe initial configuration**

Define these exact shapes in `src/domain/types.ts` and `src/content/schema.ts`:

```ts
export type OperatingMode = 'full' | 'half' | 'rest'

export interface PendingFollowUp {
  eventId: string
  earliestDay: number
}

export interface DemandFunnel {
  footTraffic: number
  buyers: number
  unserved: number
  conversionRate: number
  productDemand: Record<string, number>
}

export type SettlementReason =
  | 'rested'
  | 'profitable'
  | 'loss'
  | 'price-high'
  | 'poor-fit'
  | 'low-energy'
  | 'stockout'
  | 'waste'
```

Add a short-lived compatibility seam so the project remains type-buildable between tasks: `DailyDecision` and `DecisionSummary` temporarily accept optional `operatingMode` beside deprecated optional `closeEarly`. Add `resolveOperatingMode(decision)` in `operating-mode.ts` during this task; it returns explicit `operatingMode` first, then maps legacy `closeEarly`, then falls back to `full`. Task 7 removes the deprecated field after all UI and tests have migrated. Store `footTraffic`, `buyers`, `unserved`, `conversionRate`, and `energyDelta` on `PendingOpening` and `DailyResult`. Add `pendingFollowUps: PendingFollowUp[]` to `GameState`.

Use the following configuration shape:

```ts
export interface OperatingModeDefinition {
  visitorMultiplier: number
  rentCost: number
  operatingCost: number
  baseEnergyCost: number
  energyRecovery: number
  ordinaryEventChance: number
}

export interface ConversionDefinition {
  baseRate: number
  minimumRate: number
  maximumRate: number
  highPricePenalty: number
  lowPriceBonus: number
  preferenceBonus: number
  reputationBonus: number
  lowEnergyPenalty: number
  varietyBonus: number
}

export interface ServiceDefinition {
  baseCapacity: number
  energyCapacityFactor: number
}
```

Initialize content values as a safe first pass, to be tuned only in Task 9:

```json
"operatingModes": {
  "full": { "visitorMultiplier": 1, "rentCost": 4, "operatingCost": 2, "baseEnergyCost": 4, "energyRecovery": 0, "ordinaryEventChance": 1 },
  "half": { "visitorMultiplier": 0.58, "rentCost": 4, "operatingCost": 1, "baseEnergyCost": 2, "energyRecovery": 0, "ordinaryEventChance": 0.6 },
  "rest": { "visitorMultiplier": 0, "rentCost": 4, "operatingCost": 0, "baseEnergyCost": 0, "energyRecovery": 18, "ordinaryEventChance": 0 }
},
"conversion": {
  "baseRate": 0.7, "minimumRate": 0.15, "maximumRate": 0.94,
  "highPricePenalty": 0.62, "lowPriceBonus": 0.1,
  "preferenceBonus": 0.12, "reputationBonus": 0.1,
  "lowEnergyPenalty": 0.2, "varietyBonus": 0.04
},
"service": { "baseCapacity": 4, "energyCapacityFactor": 0.12 }
```

Keep the existing 80 events unchanged in this task. Task 8 adds the 12 fully authored follow-up entries, changes the production count to 92, and sets `contentVersion` to `3.0.0-economy-story`.

- [ ] **Step 4: Validate all numeric and reference boundaries**

In `validateContent`, reject mode multipliers/chances outside `[0, 1]`, negative costs/recovery, conversion limits outside `[0, 1]`, an inverted min/max range, and follow-up IDs that do not exist. Assert `rest.visitorMultiplier === 0`, `rest.ordinaryEventChance === 0`, and `rest.energyRecovery > 0`.

- [ ] **Step 5: Run the focused tests and type build**

Run: `pnpm test -- src/content/content.test.ts && pnpm build`

Expected: PASS with existing callers handled by the explicit compatibility resolver; new fixtures use `operatingMode`.

### Task 2: Implement the real conversion and demand funnel

**Files:**
- Create: `src/engine/demand.ts`
- Create: `src/engine/demand.test.ts`
- Modify: `src/engine/economy.ts`
- Modify: `src/engine/economy.test.ts`
- Modify: `src/engine/modifiers.ts`

**Interfaces:**
- Consumes: `OperatingMode`, `DemandFunnel`, products, state, context, balance, and existing demand modifiers.
- Produces: `calculateDemandFunnel(footTraffic, menu, products, state, context, balance): DemandFunnel`.
- Produces: `allocateProductDemand(buyers, menu, products, state, context, balance): Record<string, number>`.

- [ ] **Step 1: Write failing demand-direction tests**

Create `src/engine/demand.test.ts` with fixed state/context/menu fixtures and these contracts:

```ts
expect(base.buyers).toBeLessThanOrEqual(base.footTraffic)
expect(Object.values(base.productDemand).reduce((sum, value) => sum + value, 0)).toBe(base.buyers)
expect(expensive.buyers).toBeLessThan(base.buyers)
expect(lowEnergy.unserved).toBeGreaterThan(healthy.unserved)
expect(matched.buyers).toBeGreaterThan(mismatched.buyers)
expect(calculateDemandFunnel(0, menu, products, state, context, balance)).toMatchObject({ buyers: 0, unserved: 0 })
```

Use every selected product at base, minimum, and maximum legal prices so the test cannot pass by changing only one product share.

- [ ] **Step 2: Verify the tests fail against the old allocator**

Run: `pnpm test -- src/engine/demand.test.ts src/engine/economy.test.ts`

Expected: FAIL because `calculateDemandFunnel` does not exist and the old allocator converts every visitor.

- [ ] **Step 3: Implement conversion before allocation**

In `demand.ts`, compute a bounded rate from average menu price ratio, matching preference tags, diminishing reputation, available variety, and low-energy penalty. Use deterministic rounding and never consume RNG:

```ts
const rawRate = baseRate + priceEffect + preferenceEffect + reputationEffect + varietyEffect - energyPenalty
const willingBuyers = roundVisitors(footTraffic * clamp(rawRate, minimumRate, maximumRate))
const serviceCapacity = Math.max(0, Math.floor(balance.service.baseCapacity + state.energy * balance.service.energyCapacityFactor))
const buyers = Math.min(willingBuyers, serviceCapacity)
const unserved = willingBuyers - buyers
```

Calculate high-price penalty from the amount above ratio `1`; calculate low-price bonus from the amount below ratio `1`. Only use products in `decision.menu`, and return zero demand for missing definitions.

- [ ] **Step 4: Move stable largest-remainder allocation into `demand.ts`**

Allocate exactly `buyers` units using the existing stable product-ID tie-breaker. Preserve product-level `product-demand` modifiers, but do not let them increase total demand beyond `buyers`.

- [ ] **Step 5: Make `economy.ts` consume a `DemandFunnel`**

Keep `calculateVisitors`, `settleSales`, stock cost, revenue, waste return, and energy-by-complexity in `economy.ts`. Replace the old public `allocateDemand` usage with `calculateDemandFunnel`; trading receives `funnel.productDemand`.

- [ ] **Step 6: Run focused and regression tests**

Run: `pnpm test -- src/engine/demand.test.ts src/engine/economy.test.ts src/engine/modifiers.test.ts`

Expected: PASS, including a regression proving maximum legal prices reduce buyers and do not always increase money delta.

### Task 3: Implement full, half, and rest day transitions

**Files:**
- Modify: `src/engine/operating-mode.ts`
- Create: `src/engine/operating-mode.test.ts`
- Modify: `src/engine/simulator.ts`
- Modify: `src/engine/simulator.test.ts`
- Modify: `src/engine/simulation.test.ts`
- Modify: `src/engine/endings.test.ts`

**Interfaces:**
- Consumes: `DailyDecision.operatingMode`, balance mode definitions, `calculateDemandFunnel`, and existing due-effect/ending resolution.
- Produces: `validateOperatingMode(state, decision): string[]`.
- Produces: `resolveOperatingMode(decision): OperatingMode` and `operatingModeDefinition(mode, balance): OperatingModeDefinition`.
- Produces: pending openings/results with `footTraffic`, `buyers`, `unserved`, `conversionRate`, and signed `energyDelta`.

- [ ] **Step 1: Write failing operating-mode behavior tests**

Cover the same seed and state across all modes:

```ts
expect(() => openDay(makeState({ energy: 0 }), fullDecision, content)).toThrow()
expect(() => openDay(makeState({ energy: 0 }), halfDecision, content)).toThrow()
expect(openDay(makeState({ energy: 0 }), restDecision, content).state.pendingOpening).toMatchObject({
  footTraffic: 0,
  buyers: 0,
  sales: [],
  selectionKind: 'none',
})
expect(half.state.pendingOpening!.footTraffic).toBeLessThan(full.state.pendingOpening!.footTraffic)
expect(half.state.pendingOpening!.energyDelta).toBeGreaterThan(full.state.pendingOpening!.energyDelta)
```

After `resolveDay(restOpened, undefined, content)`, assert the day advances, rent is charged, due scheduled effects are applied, energy increases but remains at most 100, and no ordinary event is recorded.

- [ ] **Step 2: Verify the focused tests fail**

Run: `pnpm test -- src/engine/operating-mode.test.ts src/engine/simulator.test.ts`

Expected: FAIL because rest is not a real transition and zero energy still permits the old half-day exploit.

- [ ] **Step 3: Implement mode validation and mode-specific opening**

Rules:

```ts
if (state.energy === 0 && decision.operatingMode !== 'rest') errors.push('体力见底，今日只能休息')
if (decision.operatingMode === 'rest' && decision.menu.length !== 0) errors.push('休息日无需备货')
if (decision.operatingMode !== 'rest') errors.push(...validateDecisionMenu(decision.menu, products))
```

For `full` and `half`, multiply foot traffic before conversion, calculate sales, charge rent plus operating cost, and set negative `energyDelta`. For `rest`, build a frozen opening with empty sales, rent-only ledger, positive `energyDelta`, and no ordinary event.

All simulation decisions pass through `resolveOperatingMode`; no engine branch reads `closeEarly` directly after this step.

- [ ] **Step 4: Preserve chains and world time during rest**

Call `interruptExpiredChains`, weather/season selection, due scheduled effects, modifier expiry, ending resolution, and day advancement for rest exactly once. Permit a due chain node on a rest day only through a dedicated `selectDueChainEvent` path; never call ordinary weighted selection for rest.

- [ ] **Step 5: Apply signed energy once during resolution**

Replace subtraction of `energyCost` with:

```ts
energy: clampStat(openedState.energy + opening.energyDelta)
```

Keep money and inventory application idempotent through `resolutionId` and `lastResolutionId`.

- [ ] **Step 6: Run engine regression tests**

Run: `pnpm test -- src/engine/operating-mode.test.ts src/engine/simulator.test.ts src/engine/simulation.test.ts src/engine/endings.test.ts`

Expected: PASS with full, half, and rest all advancing exactly one day and no zero-energy sales path.

### Task 4: Make ordinary events mode-aware and implement queued follow-ups

**Files:**
- Modify: `src/engine/events.ts`
- Modify: `src/engine/events.test.ts`
- Modify: `src/engine/simulator.ts`
- Modify: `src/engine/story-integration.test.ts`
- Modify: `src/content/event-quality.ts`
- Modify: `src/content/event-quality.test.ts`

**Interfaces:**
- Consumes: `PendingFollowUp[]`, `OperatingModeDefinition.ordinaryEventChance`, and `EventChoice.followUpEventIds`.
- Produces: `selectDailyEvent(state, context, content, operatingMode): EventSelection`.
- Produces: `queueFollowUps(state, eventId, choiceId, content): GameState` with `earliestDay = state.day + 2`.

- [ ] **Step 1: Write failing priority and queue tests**

Add tests using a local typed content fixture with `event-test-starter` and `event-test-followup`, proving this order: due chain node, due queued follow-up, ordinary weighted event, none. Assert:

```ts
expect(queueFollowUps(state, 'event-test-starter', 'a', fixtureContent).pendingFollowUps).toContainEqual({
  eventId: 'event-test-followup',
  earliestDay: state.day + 2,
})
```

Also prove rest never selects ordinary/follow-up events, half-day event chance consumes deterministic RNG, a queued event is removed only after it resolves, and repeated resolution cannot enqueue twice.

- [ ] **Step 2: Verify event tests fail**

Run: `pnpm test -- src/engine/events.test.ts src/engine/story-integration.test.ts`

Expected: FAIL because `followUpEventIds` are currently validated but never executed.

- [ ] **Step 3: Implement deterministic selection order**

Keep active chains first so they cannot time out behind optional content. For non-rest modes, find eligible due follow-ups sorted by `earliestDay` then `eventId`. If none is due, roll once against the mode's `ordinaryEventChance`, then use the existing weighted event roll.

- [ ] **Step 4: Queue and consume follow-ups during event resolution**

After applying a normal event choice, append its referenced IDs with `earliestDay = current day + 2`, deduplicate by event ID, and cap the queue to 24 items. When the selected queued event resolves, remove its queue entry. Store only stable event IDs and numbers.

- [ ] **Step 5: Add event-quality gates**

Reject a follow-up event if it has positive random weight, if both starter branches point to the same text/effects without a real difference, or if a referenced follow-up cannot occur after its starter's day range. Require all events tagged `follow-up` to be referenced by exactly one starter choice.

- [ ] **Step 6: Run all event suites**

Run: `pnpm test -- src/engine/events.test.ts src/engine/story-integration.test.ts src/content/event-quality.test.ts src/content/event-semantics.test.ts src/engine/event-variants.test.ts`

Expected: PASS while retaining the five chains and all 20 final chain paths.

### Task 5: Migrate schema-2 saves without changing frozen results

**Files:**
- Create: `src/storage/migrate-v2.ts`
- Create: `src/storage/migrate-v2.test.ts`
- Modify: `src/storage/migrate-v1.ts`
- Modify: `src/storage/save-codec.ts`
- Modify: `src/storage/save-codec.test.ts`
- Modify: `src/storage/repository.test.ts`

**Interfaces:**
- Consumes: untrusted schema-2 payload and current `ShopContent`.
- Produces: `migrateV2Save(value, content): SaveMigrationResult` returning a bounded schema-3 payload.
- Produces: schema-3 validator accepting only legal modes, demand funnel values, follow-up IDs, and signed energy deltas.

- [ ] **Step 1: Write failing migration tests for all legacy states**

Cover `closeEarly: false -> full`, `closeEarly: true -> half`, both decision histories, previous-day snapshots, and a frozen pending opening. For the frozen opening assert ledger, sales, money delta, event ID, variant ID, and RNG are byte-for-byte equivalent after migration; derive only:

```ts
operatingMode: legacy.closeEarly ? 'half' : 'full'
footTraffic: legacy.visitors
buyers: legacy.sales.reduce((sum, sale) => sum + sale.demand, 0)
unserved: 0
conversionRate: legacy.visitors === 0 ? 0 : buyers / legacy.visitors
energyDelta: -legacy.energyCost
```

- [ ] **Step 2: Verify migration tests fail**

Run: `pnpm test -- src/storage/migrate-v2.test.ts src/storage/save-codec.test.ts`

Expected: FAIL because schema 3 and V2 migration do not exist.

- [ ] **Step 3: Implement tolerant V2 migration and strict V3 validation**

Validate legacy IDs against current content, bound all arrays, initialize `pendingFollowUps: []`, and preserve recoverable pending openings. If a zero-energy legacy state is still on preparation/morning, normalize only the next editable decision in UI; do not invent a pending rest result.

Update V1 migration to output the new schema-3 state directly using `operatingMode` and `pendingFollowUps`, then update `decodeSave` routing:

```ts
if (value.schemaVersion === 1) return migrateV1Save(value, content)
if (value.schemaVersion === 2) return migrateV2Save(value, content)
if (value.schemaVersion > 3) return { status: 'future-version', reason: '存档来自更高版本' }
```

- [ ] **Step 4: Reject unsafe or impossible schema-3 data**

Validate mode enum, rest menu emptiness, `buyers <= footTraffic`, nonnegative counts, conversion `[0, 1]`, bounded follow-up queue, referenced follow-up event IDs, and finite signed `energyDelta`. Keep current media/Base64 rejection.

- [ ] **Step 5: Run storage and resume-flow regression tests**

Run: `pnpm test -- src/storage/migrate-v1.test.ts src/storage/migrate-v2.test.ts src/storage/save-codec.test.ts src/storage/repository.test.ts src/state/resume-route.test.ts`

Expected: PASS, including resume of an old frozen event without changed story or money.

### Task 6: Expose explainable operating and settlement view models

**Files:**
- Create: `src/engine/settlement-insight.ts`
- Create: `src/engine/settlement-insight.test.ts`
- Modify: `src/state/view-model.ts`
- Modify: `src/state/view-model.test.ts`
- Modify: `src/content/content.json`

**Interfaces:**
- Consumes: `DailyDecision`, `DailyResult`, state, products, and content copy.
- Produces: `deriveSettlementReason(result, products): SettlementReason`.
- Produces: `GameViewModel.operatingModes`, `GameViewModel.ayuanPreparation`, and `GameViewModel.settlementInsight`.

- [ ] **Step 1: Write failing priority tests for settlement reasons**

Lock the reason order so one day has one useful diagnosis:

```ts
rested > low-energy > price-high > stockout > waste > poor-fit > loss > profitable
```

Test each branch with literal result fixtures and assert the returned reason is stable regardless of sales array ordering.

- [ ] **Step 2: Verify insight tests fail**

Run: `pnpm test -- src/engine/settlement-insight.test.ts src/state/view-model.test.ts`

Expected: FAIL because the insight fields do not exist.

- [ ] **Step 3: Implement typed insight derivation**

Use result facts rather than recomputing economy formulas: operating mode, `unserved`, weighted price ratio, total demand versus sold, unsold ratio, money delta, and energy delta. Return the enum only; map it to authored content in the view model.

- [ ] **Step 4: Add authored Ayuan copy and view-model fields**

Add distinct `content.ui` strings for preparation full/half/rest advice and all eight settlement reasons. Build:

```ts
ayuanPreparation: { name: string; role: string; mode: OperatingMode; text: string }
settlementInsight?: { reason: SettlementReason; name: string; role: string; text: string }
operatingModes: { id: OperatingMode; label: string; consequence: string; disabled: boolean }[]
```

At energy zero, expose only rest as enabled. Do not expose formulas or future event conditions.

- [ ] **Step 5: Run view-model tests**

Run: `pnpm test -- src/engine/settlement-insight.test.ts src/state/view-model.test.ts`

Expected: PASS with all Chinese text sourced from content JSON.

### Task 7: Build and integrate the light-Galgame operating UI

**Files:**
- Create: `src/ui/AyuanStage.tsx`
- Create: `src/ui/AyuanStage.test.tsx`
- Modify: `src/ui/GameUi.tsx`
- Modify: `src/ui/GameUi.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/state/ui-flow.test.ts`
- Modify: `src/App.css`

**Interfaces:**
- Consumes: `ayuanPreparation`, `settlementInsight`, `operatingModes`, and `DailyDecision.operatingMode`.
- Produces: `AyuanStage({ variant, name, role, text, tone })` where `variant` is `'preparation' | 'rest' | 'settlement'` and `tone` is `'neutral' | 'positive' | 'warning'`.
- Produces: preparation form callback `onOperatingMode(mode: OperatingMode): void`.

- [ ] **Step 1: Write failing component contracts**

In static markup tests, require:

```ts
expect(stage).toContain('class="ayuan-stage ayuan-stage-settlement')
expect(stage).toContain('ayuan-master.webp')
expect(stage).toContain('阿沅')
expect(stage).toContain('今日滞销')
expect(stage).not.toContain('style=')
```

For preparation, assert three radio controls share one accessible fieldset, disabled modes expose `disabled`, rest removes product controls, and non-rest keeps the 3–5 product rule.

- [ ] **Step 2: Verify UI tests fail**

Run: `pnpm test -- src/ui/AyuanStage.test.tsx src/ui/GameUi.test.tsx src/state/ui-flow.test.ts`

Expected: FAIL because the character stage and operating-mode selector do not exist.

- [ ] **Step 3: Implement `AyuanStage` and semantic mode cards**

Render the image, name, role, and dialogue in DOM order. Use an `<aside>` with `aria-labelledby`, a normal `<img>` alt using the character name, and no auto-typing timer. Render mode choices as native radio inputs wrapped by labels.

- [ ] **Step 4: Replace the preparation checkbox flow**

Remove `onCloseEarly`. Selecting rest sets `menu: []`; returning to full/half restores a fresh default 3-item menu using unlocked products and current prices. Submission validates mode and budget. Opening review shows the selected mode and, for rest, uses authored “歇业休息” confirmation copy. In the same mechanical pass, replace remaining test/audit decision literals with required `operatingMode`, then remove deprecated `closeEarly` from `DailyDecision` and `DecisionSummary`; legacy handling remains isolated to `migrate-v2.ts`.

- [ ] **Step 5: Replace settlement compact guide with the full stage**

Render net result, Ayuan stage, expandable ledger, demand/sales cards, and next-day action in that reading order. Sales cards include demand, sold, stockout, and unsold values; rest settlement shows no empty sales grid.

- [ ] **Step 6: Implement responsive CSS without overlap**

Use grid, not negative margins:

```css
.ayuan-stage { display: grid; grid-template-columns: minmax(132px, 42%) minmax(0, 1fr); overflow: hidden; }
.ayuan-stage img { width: 100%; height: clamp(170px, 48vw, 270px); object-fit: contain; object-position: center bottom; }
@media (min-width: 860px) {
  .preparation-experience { display: grid; grid-template-columns: minmax(250px, .68fr) minmax(0, 1.6fr); }
  .ayuan-stage img { height: clamp(280px, 34vw, 420px); }
}
```

Keep the sticky budget below the real top safe-area variable and the action footer above `env(safe-area-inset-bottom)`. Under 375px or long text, allow the stage to stack vertically rather than clip.

- [ ] **Step 7: Run UI and app tests**

Run: `pnpm test -- src/ui/AyuanStage.test.tsx src/ui/GameUi.test.tsx src/ui/ScreenFrame.test.tsx src/state/ui-flow.test.ts src/App.test.tsx`

If `src/App.test.tsx` does not exist, run the first four listed suites plus `src/ui/EventExperience.test.tsx`; do not create a redundant app test solely to satisfy this command.

Expected: PASS with no 64×82px compact guide used as the settlement's main character presentation.

### Task 8: Author six two-act ordinary-event follow-ups

**Files:**
- Modify: `src/content/content.json`
- Modify: `src/content/event-semantics.test.ts`
- Modify: `src/content/event-quality.test.ts`
- Modify: `src/engine/story-integration.test.ts`

**Interfaces:**
- Consumes: working follow-up queue from Task 4 and existing actor assets.
- Produces: six starters with two distinct branch-specific follow-up IDs and 12 `follow-up` events at weight 0.

- [ ] **Step 1: Write failing authored-story contracts**

First update the production event-count assertion from 80 to 92, then assert these exact branches exist and are reachable only from the matching choice:

```text
event-wrong-change -> event-wrong-change-returned / event-wrong-change-delayed
event-traveler-question -> event-runner-kept-promise / event-runner-kept-distance
event-neighbor-borrow-fire -> event-neighbor-fire-returned / event-neighbor-fire-boundary
event-new-supplier -> event-supplier-honest-return / event-supplier-tested-return
event-first-customer -> event-youth-respect-return / event-youth-kindness-return
event-scholar-critique -> event-regular-clear-recipe / event-regular-sweet-recipe
```

For every pair, resolve the starter choice, advance to `earliestDay`, select the follow-up, and assert title, content, both choices, result text, and at least one real effect differ across branches.

- [ ] **Step 2: Verify story tests fail**

Run: `pnpm test -- src/content/event-semantics.test.ts src/content/event-quality.test.ts src/engine/story-integration.test.ts`

Expected: FAIL because the 12 final follow-up entries still contain structural copy from Task 1.

- [ ] **Step 3: Author the six arcs with grounded consequences**

Write each second act around the approved themes: returned copper and street trust; a footman's promise and dignity; neighborly borrowing boundaries; supplier honesty under a changing market; help that does not humiliate a young customer; and clear product identity versus broad sweetness. Each branch must contain an immediate operating trade-off and a character response. Do not use “kind choice always earns more money” or unexplained reputation loss.

Add all 12 entries as `oncePerSave: true`, `weight: 0`, and tagged `follow-up`; update the schema production count to 92 and set `contentVersion` to `3.0.0-economy-story` only after the full authored entries pass content validation.

- [ ] **Step 4: Preserve event economics and asset constraints**

Use existing actor roles/assets only. Keep ordinary immediate deltas within the established small/medium/large bands from `EVENT-LOGIC-REPAIR-DESIGN.md`. Every future hint must correspond to the queue, a flag, modifier, unlock, scheduled effect, or chain transition.

- [ ] **Step 5: Prove ten-day discoverability without event monopoly**

Add a deterministic seed sweep that uses both starter choices and verifies at least one complete ordinary follow-up in a representative ten-day run set, while at least three unrelated ordinary events remain selectable across those seeds.

- [ ] **Step 6: Run the entire story suite**

Run: `pnpm test -- src/content/content.test.ts src/content/event-quality.test.ts src/content/event-semantics.test.ts src/engine/events.test.ts src/engine/event-variants.test.ts src/engine/story-integration.test.ts`

Expected: PASS with 92 unique event IDs, six complete ordinary follow-ups, and 20 valid final chain paths.

### Task 9: Tune challenge through multi-strategy simulation

**Files:**
- Modify: `src/engine/balance-audit.ts`
- Modify: `src/engine/balance-audit.test.ts`
- Modify: `src/content/content.json`
- Modify: `src/engine/simulation.test.ts`

**Interfaces:**
- Consumes: final mode, demand, event, and save behavior.
- Produces: ten-day and hundred-day audit summaries with money, energy, loss days, rest days, conversion, and bankruptcy distributions.

- [ ] **Step 1: Write failing audit metrics before tuning values**

Add named strategies `steady`, `max-price`, `overstock`, `aggressive-full`, and `balanced-rest`. Extend the summary with:

```ts
dayTenMoneyMedianByStrategy
dayTenBankruptcyRateByStrategy
averageConversionByStrategy
averageRestDaysByStrategy
averageLossDaysByStrategy
```

Assert reasonable `steady` day-10 money median is 150–220, reasonable bankruptcy is 0–8%, max-price buyers are lower than base-price buyers, reckless routes have observable losses, and deterministic replay remains true.

- [ ] **Step 2: Verify the audit fails with first-pass values**

Run: `pnpm test -- src/engine/balance-audit.test.ts src/engine/simulation.test.ts`

Expected: at least one envelope assertion FAIL, establishing that tuning is evidence-driven.

- [ ] **Step 3: Tune only authored balance fields**

Adjust stage foot traffic, mode costs/recovery, conversion weights/limits, service capacity, and product keep rates in `content.json`. Do not add strategy-specific conditionals to TypeScript. Keep days 1–3 forgiving and days 4–10 pressured through the shared rules.

- [ ] **Step 4: Check dominance and recovery**

For the same state and seed, compare minimum, base, and maximum prices across representative weather/season contexts. Confirm no price tier wins every context. Simulate a bad day followed by half/rest recovery and prove the standard route can return to positive cash flow.

- [ ] **Step 5: Run the full 1,000-route audit**

Run: `pnpm test -- src/engine/balance-audit.test.ts src/engine/simulation.test.ts src/engine/economy.test.ts src/engine/demand.test.ts`

Expected: PASS all ten-day and hundred-day envelopes without weakening assertions.

### Task 10: Full regression, real-browser QA, and evidence handoff

**Files:**
- Modify: `VISUAL-QA.md`
- Modify: `README.md` only if its gameplay instructions still describe the old `closeEarly` checkbox.

**Interfaces:**
- Consumes: complete implementation from Tasks 1–9.
- Produces: verified release evidence for logic, accessibility, responsiveness, storage, and build.

- [ ] **Step 1: Run all required automated checks**

Run: `pnpm lint && pnpm test && pnpm build`

Expected: exit code 0 for all commands. Record the test file/test counts and any non-fatal bundle warning exactly.

- [ ] **Step 2: Start the built preview and run real browser flows**

Run `pnpm preview --host 127.0.0.1` and use the project browser automation wrapper to complete these flows with fixed seeds:

1. New game → full day → base prices → event → settlement.
2. Half day → lower foot traffic and lower energy use.
3. Zero energy → only rest enabled → no sales → energy restored.
4. Trigger one starter and its queued follow-up, then verify branch-specific copy.
5. Reload during a frozen opening and confirm unchanged sales, event, and ledger.

- [ ] **Step 3: Verify 375, 390, and 430 CSS px**

At each width, inspect preparation, rest confirmation, event choices, positive settlement, negative settlement, and expanded ledger. Assert no horizontal overflow, broken image, console error, text/button overlap, clipped face/hands, sticky-header collision, or bottom-safe-area obstruction. Measure all primary actions at least 44 CSS px high.

- [ ] **Step 4: Verify accessibility and reduced motion**

Keyboard through operating modes, product controls, event choices, ledger toggle, and next-day action. Confirm visible focus, logical DOM order, native control names, meaningful image alt, and no delayed transition under reduced-motion emulation.

- [ ] **Step 5: Update QA evidence and perform a final diff audit**

Append dated results, viewport measurements, flows, screenshots paths if generated, and command outputs to `VISUAL-QA.md`. Run:

```bash
git diff --check -- .
git status --short -- .
```

Confirm every changed file is inside project 04, no dependency/lockfile changed, no test was removed, and no user-owned unrelated edit was overwritten.
