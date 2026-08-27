# Complete Story and Event System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task. Subagent execution is disabled for this workspace. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a production-ready 100-day shop story with 80 fully authored events, five working cross-day chains, meaningful long-term effects, readable event outcomes, safe V1 migration, balanced economics, and complete mobile verification.

**Architecture:** Keep the deterministic single-event-per-day loop, but turn `openDay` into an immutable day-plan builder and make `resolveDay` the only economic commit point. Add typed presentation metadata, context-aware conditions, generic modifiers, explicit chain starts, and event-resolution view models; then replace every fallback event and chain node with authored content in `content.json`.

**Tech Stack:** React 19, TypeScript 6, Vitest 4, Vite 8, IndexedDB/localStorage, CSS, built-in image generation, local WebP assets.

**Spec:** `CONTENT-REFACTOR-DESIGN.md`

## Global Constraints

- Modify only `projects/04-bianjing-drink-shop`; root configuration, lockfiles, other projects, root `docs/`, and `prep/` remain read-only.
- Add no dependencies.
- Put all business copy in `src/content/content.json`; JSX and TypeScript may contain only structural/error text already allowed by project conventions.
- Preserve exactly 100 days, 80 ordinary events, five chains with three follow-up nodes each, eight endings, and deterministic fixed-seed behavior.
- Store only stable IDs, numbers, timestamps, and bounded text; never persist images, Base64, audio/video, or Blob values.
- Do not use runtime remote URLs, CDNs, external APIs, Service Worker, Node APIs in the client, or unconfirmed device APIs.
- Event choices show qualitative Chinese direction before confirmation and exact deltas after confirmation.
- Do not expose internal codes `M / R / E / H / F / X / C`, flag IDs, modifier IDs, or future node IDs.
- Git writes are prohibited by the user; every task ends with tests and `git diff --check`, not a commit.
- Final gate: `pnpm lint && pnpm test && pnpm build`, plus real-browser checks at 375×812, 390×844, and 430×932.

## File and Responsibility Map

**Create:**

- `src/content/event-quality.ts` — production-quality event, choice, flag, and modifier validation independent of envelope parsing.
- `src/content/event-quality.test.ts` — small synthetic fixtures proving every quality error and a valid fixture.
- `src/engine/modifiers.ts` — generic target/operation modifier calculations.
- `src/engine/modifiers.test.ts` — all supported modifier targets and expiry behavior.
- `src/engine/story-integration.test.ts` — real daily-loop tests for all phases and all five chains.
- `src/storage/migrate-v1.ts` — V1 save-to-V2 migration with explicit recovery outcomes.
- `src/storage/migrate-v1.test.ts` — migration fixtures for pending days and broken chains.
- `src/ui/EventExperience.tsx` — isolated situation, selection, and result components.
- `src/ui/EventExperience.test.tsx` — semantic rendering and internal-code rejection assertions.
- `src/engine/balance-audit.ts` — deterministic multi-strategy simulation summary.
- `src/engine/balance-audit.test.ts` — 1,000-run thresholds and reproducibility.
- `public/assets/customers/youth.webp` — youth role, transparent 800×1000 WebP.
- `public/assets/customers/elder.webp` — elderly regular role, transparent 800×1000 WebP.
- `public/assets/customers/neighbor-woman.webp` — neighborhood woman role, transparent 800×1000 WebP.
- `public/assets/customers/runner.webp` — public-office runner role, transparent 800×1000 WebP.

**Modify:**

- `src/domain/types.ts` — timing, actor, impact hint, modifier, pending plan, event resolution, V2 save types.
- `src/content/schema.ts` — parse/reference validation for every new field and effect.
- `src/content/content.json` — all event/chain prose, hints, results, conditions, effects, actor roles, copy, and balance.
- `src/content/content.test.ts` — final production package gates.
- `src/engine/conditions.ts` — context-aware weather and season conditions.
- `src/engine/events.ts` — phase-compatible eligibility and explicit chain scheduling.
- `src/engine/effects.ts` — explicit `start-chain`, structured modifiers, and resolution metadata.
- `src/engine/economy.ts` — all modifier targets and immutable base trade plan.
- `src/engine/simulator.ts` — plan-only opening and atomic resolution.
- `src/storage/save-codec.ts` — V2 decoding, migration, and recovery routing.
- `src/state/view-model.ts` — readable hints, results, long-term states, actor/scene mapping, precise ledger labels.
- `src/state/ui-flow.ts` — event situation/selection/result and phase-aware business playback.
- `src/ui/GameUi.tsx` — remove the old raw-tag event renderer and consume `EventExperience`.
- `src/App.tsx` — route opening/business/closing events and post-confirmation result playback.
- `src/App.css`, `src/index.css` — long event text, result deltas, clue card, and four new role crops.
- `src/tests/fixtures.ts` and all affected tests — V2 fixtures and regression coverage.
- `PROMPTS.md`, `ART-REQUEST.md`, `VISUAL-QA.md` — generation evidence and final browser results.

---

### Task 1: Add typed event-presentation and content-quality contracts

**Files:**
- Create: `src/content/event-quality.ts`
- Create: `src/content/event-quality.test.ts`
- Modify: `src/domain/types.ts`
- Modify: `src/content/schema.ts`
- Modify: `src/tests/fixtures.ts`

**Interfaces:**
- Produces: `EventTiming`, `EventActorRole`, `EventScene`, `ImpactHint`, `ModifierTarget`, `ModifierOperation`, `validateEventPresentation(events, chains): string[]`, and `validateEventQuality(content: ShopContent): string[]`.
- Transitional rule: new fields are structurally understood here, but production `content.json` is not required to pass `validateEventQuality` until Task 13.

- [x] **Step 1: Write failing synthetic quality tests**

Create fixtures that assert exact errors for a template body, raw `M`, missing result text, effect/hint direction mismatch, a dead flag, and an unsupported modifier target:

```ts
expect(validateEventQuality(contentWith({ content: '坏账摆在柜前，你要如何应对？' })))
  .toContain('event-a.content: 禁止标题模板正文')
expect(validateEventQuality(contentWith({ impactHints: [{ axis: 'money', direction: 'down', text: 'M' }] })))
  .toContain('event-a/a.impactHints[0].text: 禁止内部缩写')
expect(validateEventQuality(contentWith({ resultText: '' })))
  .toContain('event-a/a.resultText: 必填')
```

- [x] **Step 2: Run the quality test and verify the module is missing**

Run: `pnpm test src/content/event-quality.test.ts`

Expected: FAIL because `event-quality.ts` does not exist.

- [x] **Step 3: Add exact domain types**

Add the unions and fields from spec §5, including:

```ts
export type EventTiming = 'opening' | 'business' | 'closing'
export type EventActorRole = 'none' | 'worker' | 'merchant' | 'scholar' | 'youth' | 'elder' | 'neighbor-woman' | 'runner'
export interface ImpactHint {
  axis: 'money' | 'reputation' | 'energy' | 'relationships' | 'inventory' | 'future'
  direction: 'up' | 'down' | 'mixed' | 'uncertain'
  text: string
}
```

Extend `EventChoice` with required `impactHints` and `resultText`, and event/node presentation with `scene`.

- [x] **Step 4: Implement the isolated quality validator**

Implement deterministic error ordering by event ID, node ID, choice ID, then field path. `validateEventPresentation` checks prose, hints, results, actors, and effect-direction agreement for a supplied subset. `validateEventQuality` calls it for the full package and additionally checks global flag consumers, modifier support, and chain entrances. Derive immediate axes from `money-delta` and `stat-delta`; require `up/down/mixed` to agree with the sign, while `future/uncertain` may describe non-immediate effects.

- [x] **Step 5: Extend structural schema validation with synthetic fixtures**

Teach `validateContent` to reject unknown timing, actor, axis, direction, modifier target, and malformed context condition. Keep the final call to `validateEventQuality` disabled until Task 13 so intermediate content work remains runnable.

- [x] **Step 6: Run focused tests**

Run: `pnpm test src/content/event-quality.test.ts src/content/content.test.ts`

Expected: all synthetic structural/quality tests PASS and existing production content still loads during migration.

- [x] **Step 7: Review checkpoint**

Run: `git diff --check -- .`

Expected: no whitespace errors.

### Task 2: Make conditions aware of weather and season

**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/engine/conditions.ts`
- Modify: `src/engine/conditions.test.ts`
- Modify: `src/engine/events.ts`
- Modify: `src/engine/events.test.ts`

**Interfaces:**
- Produces: `conditionsMatch(conditions: EventCondition[], state: GameState, context: DayContext): boolean`.
- Consumes: `weather-is`, `weather-in`, `season-is`, and `season-in` condition types from Task 1.

- [x] **Step 1: Add failing context-condition tests**

```ts
expect(conditionsMatch([{ type: 'weather-is', weatherId: 'weather-rain' }], state, rainy)).toBe(true)
expect(conditionsMatch([{ type: 'weather-is', weatherId: 'weather-rain' }], state, sunny)).toBe(false)
expect(conditionsMatch([{ type: 'season-in', seasonIds: ['season-winter-entry'] }], state, winter)).toBe(true)
```

- [x] **Step 2: Verify the old signature fails**

Run: `pnpm test src/engine/conditions.test.ts`

Expected: FAIL on unsupported condition kinds or missing context argument.

- [x] **Step 3: Implement finite context condition matching**

Add explicit switch cases only; do not introduce expression strings or `eval`. Nested `all/any/not` must pass the same `DayContext` recursively.

- [x] **Step 4: Pass context through ordinary event eligibility**

Update `eligibleEvents` to call `conditionsMatch(event.conditions, state, context)`. Add a regression fixture where `event-sudden-rain` is ineligible under `weather-clear` and eligible under `weather-rain`.

- [x] **Step 5: Run focused engine tests**

Run: `pnpm test src/engine/conditions.test.ts src/engine/events.test.ts`

Expected: PASS.

- [x] **Step 6: Review checkpoint**

Run: `git diff --check -- .`

Expected: no whitespace errors.

### Task 3: Implement generic, consumable long-term modifiers

**Files:**
- Create: `src/engine/modifiers.ts`
- Create: `src/engine/modifiers.test.ts`
- Modify: `src/domain/types.ts`
- Modify: `src/engine/effects.ts`
- Modify: `src/engine/effects.test.ts`
- Modify: `src/engine/economy.ts`
- Modify: `src/engine/economy.test.ts`

**Interfaces:**
- Produces: `modifierAdd(state, target, day, productId?): number` and `modifierFactor(state, target, day, productId?): number`.
- `ActiveModifier` stores `modifierId`, `target`, `operation`, `value`, `expiresDay`, optional `productId`, and `playerLabel`.

- [x] **Step 1: Write failing tests for every target**

Cover `visitor-count`, `energy-cost`, `fixed-cost`, `sales-income`, `waste-return`, and `product-demand`; assert expiry and product-specific filtering:

```ts
expect(modifierAdd(state, 'visitor-count', 12)).toBe(3)
expect(modifierFactor(state, 'sales-income', 12)).toBeCloseTo(0.9)
expect(modifierAdd(state, 'product-demand', 12, 'drink-green-plum')).toBe(2)
expect(modifierAdd(state, 'visitor-count', 99)).toBe(0)
```

- [x] **Step 2: Run modifier tests and verify failure**

Run: `pnpm test src/engine/modifiers.test.ts`

Expected: FAIL because the module does not exist.

- [x] **Step 3: Implement generic modifier aggregation**

Use additive identity `0` and multiplicative identity `1`. Multiple multipliers multiply; do not add percentages. Reject non-finite values at content validation rather than silently coercing them.

- [x] **Step 4: Store structured modifiers in `applyEffects`**

Update `set-modifier` handling to copy every structured field and use `expiresDay = context.day + durationDays`. Return activated modifier IDs in effect metadata for event results.

- [x] **Step 5: Route all targets into economy calculations**

- Apply `visitor-count` before visitor rounding.
- Apply `product-demand` before demand allocation.
- Apply `sales-income` to each product income line.
- Apply `waste-return` before money flooring.
- Apply `fixed-cost` to the daily fixed-cost line.
- Apply `energy-cost` before the lower bound of zero.

- [x] **Step 6: Add an explicit temporary legacy mapping**

Until Tasks 9–13 rewrite content, map existing modifier IDs in one named function `legacyModifierFields(modifierId)`; mark its removal as a Task 13 assertion. Do not scatter ID checks through `economy.ts`.

- [x] **Step 7: Run affected tests**

Run: `pnpm test src/engine/modifiers.test.ts src/engine/effects.test.ts src/engine/economy.test.ts`

Expected: PASS.

- [x] **Step 8: Review checkpoint**

Run: `git diff --check -- .`

Expected: no whitespace errors.

### Task 4: Make opening immutable and settlement atomic

**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/engine/simulator.ts`
- Modify: `src/engine/simulator.test.ts`
- Modify: `src/engine/simulation.test.ts`
- Create: `src/engine/story-integration.test.ts`

**Interfaces:**
- `openDay(initial, decision, content)` returns a state whose money, stats, inventory, and day equal `initial`, plus an immutable `pendingOpening` containing sales, ledger, money delta, energy cost, and event selection.
- `resolveDay(openedState, choiceId, content)` commits that exact plan once and returns `DailyResult.eventResolution`.

- [x] **Step 1: Write the failing no-early-mutation test**

```ts
const opened = openDay(initial, decision, content)
expect(opened.state.money).toBe(initial.money)
expect(opened.state.energy).toBe(initial.energy)
expect(opened.state.inventory).toEqual(initial.inventory)
expect(opened.state.pendingOpening?.sales.length).toBeGreaterThan(0)
```

- [x] **Step 2: Write the failing atomic commit test**

Assert that the sum of the stored base ledger and confirmed event ledger equals the final money delta, and a second `resolveDay` with the same `resolutionId` throws without changing state.

- [x] **Step 3: Run simulator tests and verify the old early mutation fails**

Run: `pnpm test src/engine/simulator.test.ts src/engine/story-integration.test.ts`

Expected: FAIL because `openDay` currently changes money, energy, and inventory.

- [x] **Step 4: Move trading mutations into `resolveDay`**

Keep weather/event RNG consumption and pure trading calculation in `openDay`; store `energyCost` and `moneyDelta` in `PendingOpening`. In `resolveDay`, apply planned inventory clearing, ledger sum, energy cost, event effects, endings, milestone routing, and day increment exactly once.

- [x] **Step 5: Preserve deterministic replay**

Add a test that serializes the opened state, decodes it, resolves the same choice, and gets byte-for-byte equal `DailyResult` data except timestamps outside the engine.

- [x] **Step 6: Update three existing simulation strategies**

Keep their intent—bankruptcy, cash buffer, strong balanced route—but update expected totals only where atomic ordering legitimately changes them. Do not weaken determinism assertions.

- [x] **Step 7: Run the complete engine suite**

Run: `pnpm test src/engine`

Expected: all engine tests PASS.

- [x] **Step 8: Review checkpoint**

Run: `git diff --check -- .`

Expected: no whitespace errors.

### Task 5: Replace overloaded chain advancement with explicit cross-day starts

**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/content/content.json`
- Modify: `src/content/schema.ts`
- Modify: `src/engine/effects.ts`
- Modify: `src/engine/events.ts`
- Modify: `src/engine/events.test.ts`
- Modify: `src/engine/story-integration.test.ts`

**Interfaces:**
- Produces: `EventEffect` variant `{ type: 'start-chain'; chainId: string }`.
- `start-chain` sets active progress at `nodeIndex: -1`; `advance-chain` is used only by actual chain nodes.

- [x] **Step 1: Add a failing realistic poet-chain test**

Start through `event-poet-credit`, finish the day, increment naturally, open complete subsequent days at each allowed delay, and assert `poet-song-spreads` is not duplicated or timed out.

- [x] **Step 2: Add the same loop for all five chains**

The test must call `openDay` and `resolveDay` for every elapsed day; it may not assign `state.day = lastAdvancedDay + minDelayDays` directly.

- [x] **Step 3: Run and capture the existing timeout failure**

Run: `pnpm test src/engine/story-integration.test.ts`

Expected: FAIL with chains interrupted before the first follow-up node.

- [x] **Step 4: Implement `start-chain` and stable node progression**

Use array position as the single progress index. `nextChainNode` reads `nodes[nodeIndex + 1]`; resolving a node advances exactly one index; `complete` is recorded only after the third follow-up node.

- [x] **Step 5: Mechanically separate the five entrances from their first follow-up nodes**

Replace the five designated entrance effects with `start-chain`. Keep stable node IDs for migration, but give each first node a minimum delay of at least one day and a non-duplicated structural role: poet debt acknowledgement, festival preparation, apprentice first workday, order terms confirmed, and signature research direction. Task 13 supplies their final authored prose.

- [x] **Step 6: Replace direct timeout IDs with structured interruption results**

Return `chainStatus: 'interrupted'` plus a stable reason ID. Player-facing interruption text remains in content and is mapped by the view model.

- [x] **Step 7: Run chain tests**

Run: `pnpm test src/engine/events.test.ts src/engine/story-integration.test.ts`

Expected: all five chains complete through real cross-day calls.

- [x] **Step 8: Review checkpoint**

Run: `git diff --check -- .`

Expected: no whitespace errors.

### Task 6: Add V2 save migration and safe pending-day recovery

**Files:**
- Create: `src/storage/migrate-v1.ts`
- Create: `src/storage/migrate-v1.test.ts`
- Modify: `src/storage/save-codec.ts`
- Modify: `src/storage/save-codec.test.ts`
- Modify: `src/storage/repository.test.ts`
- Modify: `src/domain/types.ts`

**Interfaces:**
- Produces: `migrateV1Save(value: unknown, content: ShopContent): SaveMigrationResult`.
- V2 save schema version is `2`; future versions remain rejected.

- [x] **Step 1: Write five failing migration fixtures**

Cover valid V1 morning, V1 pending day with valid `previousDay`, V1 pending day without `previousDay`, active `nodeIndex: -1`, and bug-generated `interrupted/timeout` before any follow-up node.

```ts
expect(migrateV1Save(v1PendingWithPrevious, content)).toMatchObject({ status: 'migrated', payload: { current: { page: 'morning' } } })
expect(migrateV1Save(v1PendingWithoutPrevious, content)).toMatchObject({ status: 'unrecoverable-pending' })
expect(migrateV1Save(v1TimedOutEntrance, content).payload.current.chainProgress['chain-poet']).toMatchObject({ status: 'active', nodeIndex: -1 })
```

- [x] **Step 2: Run and verify the migration module is missing**

Run: `pnpm test src/storage/migrate-v1.test.ts`

Expected: FAIL.

- [x] **Step 3: Implement bounded V1 migration**

Copy only whitelisted V1 fields. Preserve completed history, stats, inventory, unlocks, and endings. Map known legacy modifiers through Task 3's single mapping. Never preserve an old `pendingOpening` as a committed V2 day.

- [x] **Step 4: Normalize broken chain entrances**

For active or timeout-interrupted progress with `nodeIndex: -1` and no later node history, set `status: 'active'`, retain the chain ID, and set `lastAdvancedDay` to the migrated current day. Do not revive completed or player-interrupted chains.

- [x] **Step 5: Route decoding through migration**

`decodeSave` accepts schemas 1 and 2, migrates 1, rejects `>2`, and still falls back to a valid previous snapshot if current V2 data is corrupt.

- [x] **Step 6: Run all storage tests**

Run: `pnpm test src/storage`

Expected: PASS with no Base64/media safety regression.

- [x] **Step 7: Review checkpoint**

Run: `git diff --check -- .`

Expected: no whitespace errors.

### Task 7: Build the event situation-selection-result UI

**Files:**
- Create: `src/ui/EventExperience.tsx`
- Create: `src/ui/EventExperience.test.tsx`
- Modify: `src/ui/GameUi.tsx`
- Modify: `src/ui/GameUi.test.tsx`
- Modify: `src/state/view-model.ts`
- Modify: `src/state/view-model.test.ts`
- Modify: `src/state/ui-flow.ts`
- Modify: `src/state/ui-flow.test.ts`

**Interfaces:**
- Produces: `EventSituation`, `EventChoicePanel`, and `EventResultPanel`.
- `GameViewModel.event.choices` exposes `impactHints`; `GameViewModel.eventResolution` exposes result text, exact deltas, modifier labels, and chain status.

- [x] **Step 1: Write failing SSR component tests**

Assert that the situation contains actor/location text, selection contains full Chinese hints, result contains exact signed deltas, and rendered output contains none of `>M<`, `>R<`, `>E<`, `>H<`, `>F<`, `>X<`, or `>C<`.

- [x] **Step 2: Write failing UI-flow tests**

Add `eventStage: 'situation' | 'selection' | 'result'`; selection does not resolve, submit locks, resolution opens result, acknowledgement routes by `EventTiming`, and reset clears all event-only fields.

- [x] **Step 3: Run focused tests and verify failure**

Run: `pnpm test src/ui/EventExperience.test.tsx src/state/ui-flow.test.ts src/state/view-model.test.ts`

Expected: FAIL on missing module and fields.

- [x] **Step 4: Implement isolated semantic components**

Use `<article>`, one event heading, actual buttons, `aria-pressed`, disabled confirmation before selection, `<dl>` for exact result deltas, and a status region for chain clues. Image failure must not remove any text.

- [x] **Step 5: Map content IDs to player-facing resolution data**

Resolve `resultText` by event/node and choice ID. Map modifier IDs to stored `playerLabel`; map chain status to content-provided active/completed/interrupted copy. Add `actorYouth`, `actorElder`, `actorNeighborWoman`, `actorRunner`, and the existing three role labels to `content.ui`; use them for alt text and scene identity. Ledger labels include event title and selected action.

- [x] **Step 6: Keep pre-rewrite content readable through one isolated adapter**

Add `legacyImpactHints(choice)` beside the view-model mapping. It derives full Chinese direction text from the choice's actual immediate effects and maps future effects to “可能留下后续”; it never displays a raw letter. Task 13 removes this adapter after all 190 choices carry authored hints.

- [x] **Step 7: Remove the old raw `impactTags.join` renderer**

Delete the legacy `EventDecision` implementation from `GameUi.tsx` after all callers use `EventExperience`. Add `rg -n "impactTags\.join|>M<|>R<" src` to the checkpoint and require no production match.

- [x] **Step 8: Run focused UI tests**

Run: `pnpm test src/ui src/state/ui-flow.test.ts src/state/view-model.test.ts`

Expected: PASS.

- [x] **Step 9: Review checkpoint**

Run: `git diff --check -- .`

Expected: no whitespace errors.

### Task 8: Route event phases through the complete React daily loop

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.css`
- Modify: `src/index.css`
- Modify: `src/ui/GameUi.tsx`
- Modify: `src/ui/GameUi.test.tsx`
- Modify: `src/engine/story-integration.test.ts`

**Interfaces:**
- Consumes: event timing, immutable pending plan, UI event stage, and event result from Tasks 4–7.
- Produces: opening event → result → business, business event between playback beats, closing event after playback, and no-event direct settlement.

- [x] **Step 1: Add failing routing tests around pure UI decisions**

Add and test the exact pure function `nextDisplayAfterEvent(timing: EventTiming): 'business' | 'settlement'` in `src/state/ui-flow.ts`:

```ts
expect(nextDisplayAfterEvent('opening')).toBe('business')
expect(nextDisplayAfterEvent('business')).toBe('business')
expect(nextDisplayAfterEvent('closing')).toBe('settlement')
```

- [x] **Step 2: Update App routing without recomputation**

`handleOpen` persists the pending plan. `handleResolve` sets `lastResult` and displays the result panel before routing onward. Business playback reads only `pendingOpening.sales` before resolution and `lastResult.sales` after resolution; it never calls the economy again.

- [x] **Step 3: Keep the HUD honest**

Before confirmation, display committed state totals. On result and settlement, display exact before/after deltas tied to `lastResult.day`; do not label the already-advanced state as though it were the event day.

- [x] **Step 4: Add responsive event-result styles**

Use document flow for long text, minimum 46px primary actions, no fixed overlay over the last line, and only opacity/transform animations. Add a reduced-motion rule that removes entry transitions.

- [x] **Step 5: Run UI and full tests**

Run:

```bash
pnpm test src/ui src/state src/engine/story-integration.test.ts
pnpm test
```

Expected: PASS.

- [x] **Step 6: Review checkpoint**

Run: `git diff --check -- .`

Expected: no whitespace errors.

### Task 9: Author daily-operation and weather-season events 01–20

**Files:**
- Modify: `src/content/content.json`
- Modify: `src/content/content.test.ts`
- Modify: `src/content/event-quality.test.ts`

**Interfaces:**
- Produces: twenty quality-valid ordinary events with scene, timing, authored body, two choices, hints, results, and effects.

- [x] **Step 1: Add a failing group-quality assertion**

Filter categories `daily` and `weather-season`; call `validateEventPresentation(events, [])` and require 20 events, 40 choices, no template bodies, no internal codes, non-empty result text, and valid effect/hint direction.

- [x] **Step 2: Verify current fallback content fails**

Run: `pnpm test src/content/event-quality.test.ts`

Expected: FAIL on all twenty template bodies and raw impact codes.

- [x] **Step 3: Rewrite the ten daily-operation hooks**

Use these exact timing/role anchors:

- `event-signboard` — opening/merchant — repair personally versus pay a craftsperson;
- `event-cup-shortage` — business/worker — reduce orders versus buy mismatched emergency bowls;
- `event-wrong-change` — closing/elder — retrieve an honest mistake versus absorb it;
- `event-spoiled-stock` — opening/none — disclose and discount usable stock versus discard it;
- `event-busy-counter` — business/worker — speed with quality risk versus limit orders;
- `event-price-board` — business/merchant — transparent prices versus flexible bargaining;
- `event-leftover-syrup` — closing/none — make a small special batch versus store with spoilage risk;
- `event-cracked-stove` — opening/none — repair now versus operate carefully and risk recurrence;
- `event-account-gap` — closing/none — spend energy reconciling versus carry uncertainty forward;
- `event-cleaning-day` — closing/worker — close for a full clean versus do only the visible area.

- [x] **Step 4: Rewrite the ten weather-season hooks with real conditions**

- `event-hot-noon` — business/worker — `weather-hot` only;
- `event-sudden-rain` — business/none — `weather-rain` only;
- `event-cold-morning` — opening/elder — `weather-cold` only;
- `event-wind-dust` — opening/none — `weather-dust` only;
- `event-first-spring` — opening/neighbor-woman — `season-early-spring` only;
- `event-plum-rain` — opening/merchant — rain plus spring/long-summer;
- `event-summer-night` — business/worker — `season-long-summer` plus clear/hot;
- `event-autumn-dry` — opening/elder — `season-early-autumn` plus clear/dust;
- `event-early-frost` — opening/merchant — `season-winter-entry` plus cold;
- `event-clear-festival` — business/neighbor-woman — clear weather and its existing date window.

- [x] **Step 5: Rebalance effects and make every future promise executable**

Use event-specific ledger lines for current-day extra trade. Convert menu, spoilage, repair, and seasonal promises into consumed flags/modifiers or rewrite the result so it does not promise a mechanical effect.

- [x] **Step 6: Run group and engine tests**

Run: `pnpm test src/content/event-quality.test.ts src/engine/conditions.test.ts src/engine/economy.test.ts`

Expected: PASS for categories 01–20.

- [x] **Step 7: Review checkpoint**

Run: `git diff --check -- .`

Expected: no whitespace errors.

### Task 10: Author customer and market-supply events 21–40

**Files:**
- Modify: `src/content/content.json`
- Modify: `src/content/content.test.ts`
- Modify: `src/content/event-quality.test.ts`

**Interfaces:**
- Produces: twenty quality-valid events with customer identity and supply consequences.

- [x] **Step 1: Add the failing 21–40 quality gate**

Call `validateEventPresentation` for the customer and market-supply subsets; require category counts, authored bodies, hints/results, and actor roles. Global unused-flag validation remains in Task 13 because consumers may live in later categories.

- [x] **Step 2: Verify failure on current templates**

Run: `pnpm test src/content/event-quality.test.ts`

Expected: FAIL.

- [x] **Step 3: Rewrite customer events with these role anchors**

- first customer/youth; child spill/youth; old regular/elder; traveler question/worker;
- scholar critique/scholar; large family/neighbor-woman; quiet repeat customer/worker;
- lost purse/merchant; ingredient question/neighbor-woman; word-of-mouth/merchant.

The first-customer options become fully worded: “添一小盏，请他带回去解渴” and “照价卖一盏，把今日第一笔账记清”。Both results must respect the chosen action without moral ranking.

- [x] **Step 4: Rewrite market-supply events with these conflict anchors**

- sugar price: explain a small rise versus absorb cost;
- herb shortage: pause one item versus test a substitute;
- new supplier: small trial versus bulk bargain risk;
- old supplier: prepay to preserve trust versus protect cash;
- fake goods: share identification knowledge versus keep it private;
- cart delay: shrink menu versus expensive emergency purchase;
- bulk discount: stock heavily versus buy only what can be used;
- competing shop: differentiate versus reduce prices;
- cup cartel: refundable deposit versus accept the rise;
- final seasonal stock: farewell special versus let the season end.

- [x] **Step 5: Make allergy and adulteration choices responsible**

The ingredient-question event must never reward falsely claiming certainty. A dishonest answer may create immediate sales but must carry a real, disclosed reputation/safety risk with a downstream consumer; the honest option remains economically costly but viable.

- [x] **Step 6: Run content and effect tests**

Run: `pnpm test src/content/event-quality.test.ts src/engine/effects.test.ts`

Expected: PASS for categories 21–40.

- [x] **Step 7: Review checkpoint**

Run: `git diff --check -- .`

Expected: no whitespace errors.

### Task 11: Author energy-self and neighborhood events 41–60

**Files:**
- Modify: `src/content/content.json`
- Modify: `src/content/content.test.ts`
- Modify: `src/content/event-quality.test.ts`

**Interfaces:**
- Produces: twenty events whose care, rest, and reciprocity choices have visible but non-moralizing trade-offs.

- [x] **Step 1: Add the failing 41–60 quality gate**

Call `validateEventPresentation` for the energy-self and neighborhood subsets; require 20 authored events, 40 results, and appropriate opening/closing timing for self-care. Task 13's full-package gate proves every neighborhood flag has an actual consumer.

- [x] **Step 2: Verify current content fails**

Run: `pnpm test src/content/event-quality.test.ts`

Expected: FAIL.

- [x] **Step 3: Rewrite the ten energy-self stories**

Use sore arms, sleeplessness, burnout, practice, family letter, minor burn, good rhythm, old recipe book, overcommitment, and lantern-festival leave as distinct personal moments. Rest choices cost real opportunity; working choices can earn money but cannot bypass energy limits or trivialize injury.

- [x] **Step 4: Rewrite the ten neighborhood stories**

Use borrowing fire, watching a neighboring shop, shared drainage, a street musician, night lighting, a child's errand, storefront boundaries, a community feast, a nearby fire, and joint purchasing. Give neighbors names or recognizable roles inside prose without adding new stable person IDs to storage.

- [x] **Step 5: Connect reciprocity to later conditions**

At least four neighborhood outcomes must be consumed by later help, cost, risk, or ending conditions. Avoid a single generic “good-neighbor” flag; use specific remembered actions so later text can name what returned.

- [x] **Step 6: Run content, condition, and ending tests**

Run: `pnpm test src/content/event-quality.test.ts src/engine/conditions.test.ts src/engine/endings.test.ts`

Expected: PASS for categories 41–60.

- [x] **Step 7: Review checkpoint**

Run: `git diff --check -- .`

Expected: no whitespace errors.

### Task 12: Author risk and opportunity-growth events 61–80

**Files:**
- Modify: `src/content/content.json`
- Modify: `src/content/content.test.ts`
- Modify: `src/content/event-quality.test.ts`

**Interfaces:**
- Produces: twenty quality-valid events, including all five explicit chain entrances.

- [x] **Step 1: Add the failing 61–80 quality gate**

Call `validateEventPresentation` for the risk and opportunity-growth subsets; require result text, one and only one `start-chain` effect for each designated entrance, and no obsolete `C/F/X` hints. Task 13 proves global risk-state consumption.

- [x] **Step 2: Verify current content fails**

Run: `pnpm test src/content/event-quality.test.ts`

Expected: FAIL.

- [x] **Step 3: Rewrite the ten risk events**

Cover inspection preparation, counterfeit money, a seating dispute, canceled bulk order, missing recipe notes, false ingredient rumor, roof leak, pest signs, street crowding, and debt maturity. Risky choices must state uncertainty before confirmation and have a real scheduled/conditional consequence.

- [x] **Step 4: Rewrite the ten growth events**

Cover poet credit, cook exchange, festival stall, apprentice, public-office order, traveler recipe exchange, expansion, spreading fame, signature drink, and shop chronicle. The five designated chain entrances use `start-chain`; declining them remains a legitimate route without hidden punishment.

- [x] **Step 5: Remove accidental guaranteed-profit opportunities**

Check every growth choice for immediate money plus positive long-term effects. Add a cost, uncertainty, capacity/energy burden, or narrower audience where required; keep the alternative economically respectable.

- [x] **Step 6: Run content and chain-start tests**

Run: `pnpm test src/content/event-quality.test.ts src/engine/events.test.ts src/engine/effects.test.ts`

Expected: PASS for categories 61–80 and exactly five valid entrances.

- [x] **Step 7: Review checkpoint**

Run: `git diff --check -- .`

Expected: no whitespace errors.

### Task 13: Rewrite all fifteen chain nodes and enable the final production quality gate

**Files:**
- Modify: `src/content/content.json`
- Modify: `src/content/schema.ts`
- Modify: `src/content/content.test.ts`
- Modify: `src/content/event-quality.test.ts`
- Modify: `src/engine/story-integration.test.ts`
- Modify: `src/engine/modifiers.ts`

**Interfaces:**
- Produces: five complete chains, 30 fully described choices, player-facing interruption results, and zero transitional schema/modifier paths.

- [x] **Step 1: Add failing full-package gates**

```ts
expect(validateEventQuality(shopContent.content)).toEqual([])
expect(allOrdinaryChoices).toHaveLength(160)
expect(allChainChoices).toHaveLength(30)
expect(allChoices.every(choice => choice.impactHints.length > 0 && choice.resultText.length >= 12)).toBe(true)
```

Also assert `legacyModifierFields` and `legacyImpactHints` are absent and `producedFlags.every(flag => consumedFlags.has(flag))` is true.

- [x] **Step 2: Rewrite `chain-poet` nodes**

Keep stable node IDs for migration, but change `poet-credit` into the first later consequence rather than repeating the entrance. Supply development, turn, conclusion result text, delays of at least one day, and distinct money/reputation/relationship outcomes.

- [x] **Step 3: Rewrite `chain-festival` nodes**

Make registration preparation, crowd-pressure response, and final settlement depend on prior flags and available energy. Completion can yield profit, reputation, or a modest loss with learned experience.

- [x] **Step 4: Rewrite `chain-apprentice` nodes**

Make teaching choice affect the mistake scene; make repair style affect the final stay/recommend decision. A staying apprentice activates both `energy-cost` relief and `fixed-cost` wage modifiers.

- [x] **Step 5: Rewrite `chain-official-order` nodes**

Make shortage and final quality conditions consume prior honesty/supply choices. Avoid unconditional official favor; result copy focuses on contract, food quality, and bookkeeping.

- [x] **Step 6: Rewrite `chain-signature` nodes**

Persist direction and response flags, consume them in launch conditions, unlock the signature drink only for coherent results, and provide a visible niche/overworked alternative.

- [x] **Step 7: Turn on production quality validation**

Call `validateEventQuality` from `validateContent(..., 'production')`. Remove optional/transitional presentation handling, raw `impactTags`, `legacyImpactHints`, and `legacyModifierFields`.

- [x] **Step 8: Run content, chain, and complete test suites**

Run:

```bash
pnpm test src/content src/engine/story-integration.test.ts src/engine/events.test.ts
pnpm test
```

Expected: 80 events, 190 choices, five cross-day chains, and all existing suites PASS.

- [x] **Step 9: Review checkpoint**

Run: `git diff --check -- .`

Expected: no whitespace errors.

### Task 14: Generate four role assets and connect actor-aware scenes

**Files:**
- Create: `public/assets/customers/youth.webp`
- Create: `public/assets/customers/elder.webp`
- Create: `public/assets/customers/neighbor-woman.webp`
- Create: `public/assets/customers/runner.webp`
- Modify: `PROMPTS.md`
- Modify: `ART-REQUEST.md`
- Modify: `src/ui/GameUi.tsx`
- Modify: `src/ui/GameUi.test.tsx`
- Modify: `src/App.css`

**Interfaces:**
- Consumes: `EventActorRole` from Task 1.
- Produces: `actorAssetPath(role): string | undefined` in `src/ui/actor-assets.ts`; `none` returns no character layer.

- [x] **Step 1: Add failing role-to-asset tests**

Assert all seven visual roles resolve to local `.webp` paths, `none` resolves `undefined`, and event alt text uses the content role label rather than an internal filename.

- [x] **Step 2: Use the imagegen skill and existing accepted style constraints**

Generate four transparent 800×1000 characters matching the existing worker/merchant/scholar set. Required distinctions:

- youth: adolescent errand runner, plain short working clothes, both hands visible, no poverty caricature;
- elder: ordinary elderly regular, restrained layered robe, walking stick or cloth purse without writing;
- neighbor woman: adult neighborhood shopkeeper/resident, practical Song-inspired layered clothing, both hands visible;
- runner: adult public-office errand worker, plain duty clothing without official rank insignia, weapons, or authority spectacle.

Reject modern aprons, Qing garments, braids, fantasy armor, text, seals, logos, malformed hands, and cropped role-defining props.

- [x] **Step 3: Convert accepted sources to WebP and record evidence**

Use local conversion only. Record full prompts, rejected variants, dimensions, alpha, and byte sizes in `PROMPTS.md`. Update `ART-REQUEST.md` paths and acceptance status.

- [x] **Step 4: Implement role-aware rendering**

Map actor role to asset. For `none`, render only shop/weather/category layers. Do not fall back to scholar for an unknown actor; retain textual fallback and log no console error.

- [x] **Step 5: Run asset and UI tests**

Run:

```bash
find public/assets/customers -maxdepth 1 -type f -name '*.webp' -print
pnpm test src/ui/GameUi.test.tsx
```

Expected: seven customer role WebPs plus no-person rendering PASS.

- [x] **Step 6: Review checkpoint**

Run: `git diff --check -- .`

Expected: no whitespace errors.

### Task 15: Rebalance 1,000 runs, verify endings, and complete browser/final gates

**Files:**
- Create: `src/engine/balance-audit.ts`
- Create: `src/engine/balance-audit.test.ts`
- Modify: `src/content/content.json`
- Modify: `src/engine/endings.test.ts`
- Modify: `src/engine/simulation.test.ts`
- Modify: `VISUAL-QA.md`
- Modify: `CONTENT-REFACTOR-IMPLEMENTATION-PLAN.md`

**Interfaces:**
- Produces: `runBalanceAudit(content, seedsPerStrategy): BalanceAuditSummary` with route totals, bankruptcy rate, ending distribution, money median, zero-energy rate, and deterministic replay evidence.

- [x] **Step 1: Write the failing balance thresholds**

Implement five strategies—steady, profit, relationships, reputation, rest—and 200 stable seeds per strategy. Assert:

```ts
expect(summary.totalRuns).toBe(1000)
expect(summary.bankruptcyRate).toBeGreaterThanOrEqual(0.05)
expect(summary.bankruptcyRate).toBeLessThanOrEqual(0.45)
expect(summary.moneyMedian).toBeLessThanOrEqual(2500)
expect(summary.zeroEnergyRate).toBeLessThanOrEqual(0.30)
expect(summary.maxSingleEndingShareByStrategy).toBeLessThanOrEqual(0.80)
```

- [x] **Step 2: Run and capture current balance failures**

Run: `pnpm test src/engine/balance-audit.test.ts`

Expected: FAIL because the audit module is missing or current economics exceed thresholds.

- [x] **Step 3: Implement deterministic audit aggregation**

Do not use `Math.random`. Re-run one seed per strategy and assert the full terminal snapshot equals its first run.

- [x] **Step 4: Rebalance content values only**

Adjust event effects, modifier values/durations, and ending thresholds in `content.json`. Do not add strategy-specific engine branches. Record the final aggregate summary in `VISUAL-QA.md`.

- [x] **Step 5: Prove all eight endings are reachable**

Use explicit constructed states and completed chain progress where appropriate. Assert bankruptcy priority, base hundred-day fallback, and every特色 ending independently.

- [x] **Step 6: Run the complete automated gate**

Run:

```bash
pnpm lint
pnpm test
pnpm build
```

Expected: exit code 0; all tests PASS; Vite production build succeeds.

- [x] **Step 7: Serve the production build and run the golden browser flow**

Start `pnpm preview --host 127.0.0.1`. In a real browser, verify new game → guide → preparation → opening summary → correctly timed event → select first choice → switch to second → confirm once → result text → business/settlement → detailed ledger → next day → reload recovery.

- [x] **Step 8: Verify all event timing fixtures at three widths**

Use controlled IndexedDB V2 fixtures for one opening, business, closing, and chain event. At 375×812, 390×844, and 430×932 assert:

```js
document.documentElement.scrollWidth === window.innerWidth
Math.min(...[...document.querySelectorAll('.primary-action')].map(el => el.getBoundingClientRect().height)) >= 46
[...document.images].every(image => image.complete && image.naturalWidth > 0)
```

Also verify longest body/result text, last action reachability, no scholar fallback for non-scholar roles, reduced motion, zero console error/warning, and no remote request.

- [x] **Step 9: Run repository and prohibited-data checks**

Run:

```bash
git diff --check -- .
git status --short -- .
rg -n "data:.*base64|https?://|Blob\(|serviceWorker|navigator\.mediaDevices" src public index.html
```

Expected: no whitespace errors; only project 04 paths are part of this change; matches for Base64/URL exist only in validators and their negative tests, never production content or runtime loading.

- [x] **Step 10: Record final evidence and close every checkbox**

Update `VISUAL-QA.md` with exact test counts, build sizes, 1,000-run statistics, asset dimensions/bytes, three viewport measurements, broken-image count, console count, and any explicitly unmet item. Mark a plan checkbox complete only after its command has fresh passing evidence.
