# 百日叙事 / 三十回合 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 100 个重复操作日重构为横跨百日历的 30 个关键经营回合，并修复营业过程按钮的因果表达。

**Architecture:** 保留 `GameState.day` 作为内容日期，新建 `GameState.operatingDay` 作为玩法时钟；所有跨回合期限通过集中式 campaign timeline 换算。内容日期筛选不变，推进、冷却、危机和终局改用经营回合。

**Tech Stack:** TypeScript 6、React 19、Vitest 4、Vite 8、纯静态 localStorage 存档。

**Spec:** `CAMPAIGN-PACING-REDESIGN.md`

## Global Constraints

- 只修改 `projects/04-bianjing-drink-shop`。
- 不新增依赖，不修改根锁文件或工作区配置。
- 业务文案与平衡参数只放 `src/content/content.json`。
- 当前工作区包含用户已确认的未提交改动；内联执行，不创建提交，不覆盖无关改动。
- 每项行为变更严格执行 RED → GREEN；最终执行完整 lint / test / build 与三档移动宽度检查。

---

### Task 1: 双时间轴契约

**Files:**
- Create: `src/engine/campaign.ts`
- Create: `src/engine/campaign.test.ts`
- Modify: `src/content/schema.ts`
- Modify: `src/content/content.json`
- Modify: `src/domain/types.ts`
- Modify: `src/tests/fixtures.ts`

**Interfaces:**
- Produces: `calendarDayForOperatingDay(day, campaign)`、`operatingDayForCalendarDay(day, campaign)`、`calendarDayAfterTurns(day, turns, campaign)`、`remainingOperatingDays(state, campaign)`、`campaignChapter(state, campaign)`。

- [ ] **Step 1: Write the failing tests** for all 30 monotonic mappings, reverse migration mapping, chapter boundaries and end clamping.
- [ ] **Step 2: Run `pnpm test src/engine/campaign.test.ts`** and verify failure because the module/contract is absent.
- [ ] **Step 3: Add typed campaign content** with the exact 30-day map and four chapters; implement pure timeline functions and add `operatingDay` to game state/context/result/forecast types.
- [ ] **Step 4: Run `pnpm test src/engine/campaign.test.ts src/content/content.test.ts src/tests/fixtures.test.ts`** and verify green.

### Task 2: 三十回合推进与故事期限

**Files:**
- Modify: `src/engine/simulator.test.ts`
- Modify: `src/engine/events.test.ts`
- Modify: `src/engine/financial-health.test.ts`
- Modify: `src/engine/forecast.test.ts`
- Modify: `src/engine/simulator.ts`
- Modify: `src/engine/events.ts`
- Modify: `src/engine/effects.ts`
- Modify: `src/engine/forecast.ts`
- Modify: `src/engine/financial-health.ts`
- Modify: `src/engine/modifiers.ts`

**Interfaces:**
- Consumes: campaign timeline helpers from Task 1.
- Produces: a full run of exactly 30 results ending at calendar day 100; turn-based follow-ups, chain windows, scheduled effects, modifiers and crisis deadlines.

- [ ] **Step 1: Write failing boundary tests** proving 1→4 progression, milestones at 7/15/23, terminal turn 30, three-turn crisis near the finale, and rejection of events whose promised consequences cannot fit.
- [ ] **Step 2: Run the focused engine tests** and verify expected assertion failures against 100-day behavior.
- [ ] **Step 3: Implement operating-day progression** and replace calendar subtraction/addition in cooldowns, chains, follow-ups, delayed effects and crisis deadlines with timeline helpers.
- [ ] **Step 4: Run all engine tests** and update only expectations whose semantics intentionally changed.

### Task 3: V4 → V5 存档迁移

**Files:**
- Create: `src/storage/migrate-v4.ts`
- Create: `src/storage/migrate-v4.test.ts`
- Modify: `src/storage/save-codec.test.ts`
- Modify: `src/storage/save-codec.ts`
- Modify: `src/storage/migrate-v3.ts`
- Modify: `src/storage/repository.test.ts`

**Interfaces:**
- Produces: `migrateV4Save(value, content)` returning the existing recovery union with a V5 payload.

- [ ] **Step 1: Write failing migration tests** for days 1, 18, 99 and 100, previous-day recovery, future-version refusal and a pending-opening snapshot.
- [ ] **Step 2: Run focused storage tests** and verify failure on unsupported schema version 5 / missing migration.
- [ ] **Step 3: Implement migration and V5 validation**, mapping narrative dates without discarding pending decisions or safe snapshots.
- [ ] **Step 4: Run all storage tests** and verify both legacy V1–V3 and new V4 upgrade paths.

### Task 4: 营业交互与双日期界面

**Files:**
- Modify: `src/state/ui-flow.test.ts`
- Modify: `src/ui/GameUi.test.tsx`
- Modify: `src/state/view-model.test.ts`
- Modify: `src/state/ui-flow.ts`
- Modify: `src/state/view-model.ts`
- Modify: `src/ui/GameUi.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.css`
- Modify: `src/content/content.json`

**Interfaces:**
- Produces: `businessPrimaryAction(...)` / direct settlement routing; `GameViewModel.dayLabel` and `campaignLabel` suitable for the header and milestones.

- [ ] **Step 1: Write failing UI tests** proving an unresolved business event exposes one direct event action, no-event skip resolves in one action, revealed beats contain actual sales/loss signals, and both time axes render.
- [ ] **Step 2: Run focused state/component tests** and verify failures describe the old ambiguous flow.
- [ ] **Step 3: Implement direct routes and campaign labels**, replace ambiguous copy, and update the milestone card to chapter progress rather than `game.day - 1`.
- [ ] **Step 4: Run focused UI tests** and verify green.

### Task 5: 平衡审计与内容收束

**Files:**
- Modify: `src/engine/balance-audit.test.ts`
- Modify: `src/engine/balance-audit.ts`
- Modify: `src/content/event-quality.test.ts`
- Modify: `src/content/content.json`

**Interfaces:**
- Produces: 1,000-run 30-turn audit with survival, loss-day and ending-distribution measures.

- [ ] **Step 1: Write failing audit assertions** for 30-result completion, sensible-strategy viability, reckless-strategy penalties, ending diversity and deterministic replay.
- [ ] **Step 2: Run the audit test** and capture the initial distribution after timeline compression.
- [ ] **Step 3: Rebalance only authored JSON values**: event probabilities, stage visitors, crisis wording/deadlines and ending thresholds until the audit meets the approved difficulty intent.
- [ ] **Step 4: Run content quality and full engine suite** and verify no dangling final-turn promises or contradictory day wording.

### Task 6: 完整验证与移动端实机检查

**Files:**
- Modify if evidence requires: `src/App.css`, `VISUAL-QA.md`

**Interfaces:**
- Consumes: all completed behavior.
- Produces: verification evidence for functionality, build and 375 / 390 / 430 px layouts.

- [ ] **Step 1: Run `pnpm lint && pnpm test && pnpm build`** and fix only failures caused by this scope.
- [ ] **Step 2: Run the built app in a real browser** and traverse landing → tutorial → morning → preparation → opening → business/event → settlement.
- [ ] **Step 3: Capture/inspect 375, 390 and 430 CSS px states** with top navigation safe-area emulation; verify no overlap, horizontal overflow or unreadable action colors.
- [ ] **Step 4: Re-run `pnpm lint && pnpm test && pnpm build`** after any visual correction and record the fresh results.
