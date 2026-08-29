# 地球 Online 任务库升级 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将任务库升级为 100 个更有过程感和挑战层次的活跃现实支线，同时完整保留退役任务、旧历史标题和升级时仍在进行的任务。

**Architecture:** 活跃、退役与保留 ID 的旧版本任务都封装在本地 `content.json`，由独立目录解析器提供 active/retired/legacy 视图并按 `questId + contentVersion` 精确解析；匹配器永远只接收 active 列表。领域层在接取和写历史时固化内容版本与任务快照，本地存储升级到 schemaVersion 2，并把 schemaVersion 1 的旧 ID 记录通过完整 v1 任务档案迁移为不可变快照。

> 实施复核修订：最初计划只归档 20 个退役 ID，无法覆盖仍沿用 ID 但步骤或 XP 已变化的 80 个 v1 进行中任务。最终实现增加 `legacyTasks` 保存这 80 个完整 v1 定义；这是为兑现“正在进行的旧任务完整保留”所需的兼容修正。

**Tech Stack:** React 19、TypeScript 6、Vite 8、Vitest 4、localStorage、IndexedDB、现有 CSS 与本地静态资源。

**Spec:** `projects/08-earth-online/CONTENT_REFRESH_DESIGN.md`

## Global Constraints

- 只允许修改 `projects/08-earth-online/**`。
- 不修改根 `package.json`、`pnpm-workspace.yaml`、`pnpm-lock.yaml`、`docs/`、其他项目或共享配置。
- 不安装、升级或删除依赖。
- 不执行任何 Git 写操作；每个任务末尾使用测试和只读 `git diff --check -- projects/08-earth-online` 作为检查点。
- 应用保持纯前端静态构建，不增加后端、运行时 CDN、必需外部 API、定位、上传证明、图片存储或运行时 AI。
- 业务内容只写入本项目 `src/content/content.json`。
- 运动任务必须保持低风险表达并允许用户按自身状态停止。
- 活跃任务严格保持 100 项，10 类各 10 项；退役任务不参与匹配。
- 实现采用 TDD：先写最小失败测试，确认失败原因正确，再写实现。
- 最终只运行 `pnpm lint`、`pnpm test`、`pnpm build`，并验证 375、390、430 CSS px 与非零安全区。

## File Structure

- `src/content/schema.ts`：定义任务目录、内容快照、v2 历史与当前任务类型。
- `src/content/catalog.ts`：构造活跃/退役/all 索引，解析旧任务并创建不可变快照。
- `src/content/catalog.test.ts`：验证目录隔离、全局唯一 ID 和快照值。
- `src/content/validate.ts`：校验 100 个活跃任务、退役目录、分布、安全和旧模板禁用。
- `src/content/content.json`：保存 100 个活跃任务、20 个完整退役任务和全部 UI 文案。
- `src/content/content.test.ts`：验证精确分布、20 个替换任务和内容质量。
- `src/domain/quests.ts`：在接受、换任务、放弃和完成时写入任务版本或历史快照。
- `src/domain/quests.test.ts`：验证旧任务结算、重复奖励和快照不可变。
- `src/storage/storage.ts`：保存 schemaVersion 2，并迁移 schemaVersion 1。
- `src/storage/storage.test.ts`：验证旧历史、旧当前任务、损坏与未来版本。
- `src/app/controller.ts`：生成 v2 存储 envelope。
- `src/app/controller.test.ts`：验证 v2 envelope 与禁止字段。
- `src/app/view-model.ts`：同时解析活跃与退役当前任务，历史使用快照。
- `src/app/view-model.test.ts`：验证退役任务可恢复和历史标题不漂移。
- `src/App.tsx`：注入任务目录，匹配仅使用活跃任务，旧当前任务仍可完成。
- `src/ui/QuestFlow.tsx`：为退役的进行中任务显示“经典任务”。
- `src/ui/ArchiveViews.tsx`：历史页直接显示快照标题和快照类别。
- `src/ui/render.test.tsx`：验证经典任务标记和历史快照渲染。
- `src/storage/adventure-log.test.ts`、`src/app/state.test.ts`：更新 `QuestHistoryEntry` 测试夹具。
- `PREP_REPORT.md`：记录新分布、退役策略、迁移、测试和浏览器验收结果。

---

### Task 1: 建立活跃/退役任务目录与不可变快照类型

**Files:**
- Modify: `projects/08-earth-online/src/content/schema.ts`
- Create: `projects/08-earth-online/src/content/catalog.ts`
- Create: `projects/08-earth-online/src/content/catalog.test.ts`

**Interfaces:**
- Consumes: 现有 `Quest`、`EarthOnlineContent`、`QuestCategory`、`QuestDifficulty`。
- Produces: `QuestSnapshot`、`EarthOnlineContent.content.retiredTasks` 类型、`QuestCatalog`、`createQuestCatalog(content)`、`snapshotQuest(quest)`。`ActiveQuest` 与 `QuestHistoryEntry` 在 Task 2 一次性升级，避免本任务留下编译红灯。

- [ ] **Step 1: 写目录隔离和快照的失败测试**

在 `src/content/catalog.test.ts` 写入：

```ts
import { describe, expect, it } from 'vitest'
import rawContent from './content.json'
import type { EarthOnlineContent, Quest } from './schema'
import { createQuestCatalog, snapshotQuest } from './catalog'

const original = rawContent as unknown as EarthOnlineContent
const retired = original.content.tasks[0]
const content: EarthOnlineContent = {
  ...original,
  content: {
    ...original.content,
    tasks: original.content.tasks.slice(1),
    retiredTasks: [retired],
  },
}

describe('versioned quest catalog', () => {
  it('keeps active and retired quests in separate indexes', () => {
    const active = content.content.tasks[0]
    const retiredQuest = content.content.retiredTasks[0]
    const catalog = createQuestCatalog(content)

    expect(catalog.activeById.get(active.questId)).toBe(active)
    expect(catalog.activeById.has(retiredQuest.questId)).toBe(false)
    expect(catalog.retiredById.get(retiredQuest.questId)).toBe(retiredQuest)
    expect(catalog.resolve(retiredQuest.questId)).toBe(retiredQuest)
    expect(catalog.isRetired(retiredQuest.questId)).toBe(true)
  })

  it('creates an immutable history snapshot from authored quest fields', () => {
    const quest = content.content.tasks[0] as Quest
    expect(snapshotQuest(quest)).toEqual({
      questTitle: quest.title,
      questContentVersion: quest.contentVersion,
      questCategory: quest.category,
      questDifficulty: quest.difficulty,
    })
  })
})
```

- [ ] **Step 2: 运行测试并确认因缺少类型和目录模块而失败**

Run: `pnpm test -- src/content/catalog.test.ts`

Expected: FAIL，错误包含 `Cannot find module './catalog'` 或 `retiredTasks does not exist`。

- [ ] **Step 3: 扩展内容目录与快照类型**

在 `src/content/schema.ts` 增加：

```ts
export type QuestSnapshot = {
  questTitle: string
  questContentVersion: string
  questCategory: QuestCategory
  questDifficulty: QuestDifficulty
}

```

将 `EarthOnlineContent['content']` 扩展为：

```ts
content: {
  categories: QuestCategoryDefinition[]
  goals: GoalDefinition[]
  badges: BadgeDefinition[]
  tasks: Quest[]
  retiredTasks: Quest[]
  // 保留其余既有字段
}
```

本任务不修改 `ActiveQuest` 或 `QuestHistoryEntry`，这些互相依赖的状态类型和全部调用方在 Task 2 同时升级。

- [ ] **Step 4: 实现任务目录**

在 `src/content/catalog.ts` 实现：

```ts
import type { EarthOnlineContent, Quest, QuestSnapshot } from './schema'

export type QuestCatalog = {
  active: readonly Quest[]
  retired: readonly Quest[]
  activeById: ReadonlyMap<string, Quest>
  retiredById: ReadonlyMap<string, Quest>
  allById: ReadonlyMap<string, Quest>
  resolve: (questId: string) => Quest | undefined
  isRetired: (questId: string) => boolean
}

export function createQuestCatalog(content: EarthOnlineContent): QuestCatalog {
  const active = content.content.tasks
  const retired = content.content.retiredTasks
  const activeById = new Map(active.map((quest) => [quest.questId, quest]))
  const retiredById = new Map(retired.map((quest) => [quest.questId, quest]))
  const allById = new Map([...activeById, ...retiredById])
  return {
    active,
    retired,
    activeById,
    retiredById,
    allById,
    resolve: (questId) => allById.get(questId),
    isRetired: (questId) => retiredById.has(questId),
  }
}

export function snapshotQuest(quest: Quest): QuestSnapshot {
  return {
    questTitle: quest.title,
    questContentVersion: quest.contentVersion,
    questCategory: quest.category,
    questDifficulty: quest.difficulty,
  }
}
```

- [ ] **Step 5: 运行目录测试与 TypeScript 构建**

Run: `pnpm test -- src/content/catalog.test.ts`

Expected: PASS。

Run: `pnpm build`

Expected: PASS。生产 JSON 仍通过显式类型断言加载，Task 4 会在运行时校验接入前一次性加入正式 `retiredTasks`。

- [ ] **Step 6: 只读检查范围**

Run: `git diff --check -- projects/08-earth-online`

Expected: 无输出。

---

### Task 2: 在任务生命周期中固化版本和历史快照

**Files:**
- Modify: `projects/08-earth-online/src/domain/quests.ts`
- Modify: `projects/08-earth-online/src/domain/quests.test.ts`
- Modify: `projects/08-earth-online/src/App.tsx`
- Modify: `projects/08-earth-online/src/app/state.ts`
- Modify: `projects/08-earth-online/src/app/state.test.ts`
- Modify: `projects/08-earth-online/src/storage/adventure-log.test.ts`

**Interfaces:**
- Consumes: `snapshotQuest(quest)`、`QuestSnapshot`、现有 `GuildDomainState`。
- Produces: `acceptQuest(state, quest, acceptedAt)`、`swapQuest(state, offeredQuest, match, swappedAt)`、`abandonQuest(state, quest, abandonedAt)`，以及始终含快照字段的新历史记录。

- [ ] **Step 0: 一次性升级状态类型**

在 `src/content/schema.ts` 将旧类型替换为：

```ts
export type ActiveQuest = {
  acceptanceId: string
  questId: string
  acceptedAt: string
  questContentVersion: string
  preference: QuestPreference
}

export type QuestHistoryEntry = QuestSnapshot & {
  acceptanceId: string
  questId: string
  status: 'completed' | 'abandoned' | 'swapped'
  occurredAt: string
  xpAwarded: number
  completionDate?: string
}
```

移除旧 `QuestHistoryEntry.category` 可选字段；后续统计统一读取必填 `questCategory`。

- [ ] **Step 1: 把生命周期测试改为要求快照和旧 XP**

在 `src/domain/quests.test.ts` 将接取、交换、放弃与完成测试改为以下调用和断言：

```ts
const accepted = acceptQuest(offered, quest, '2026-08-24T08:01:00.000Z')
expect(accepted.activeQuest).toMatchObject({
  questId: quest.questId,
  questContentVersion: quest.contentVersion,
})

const swapped = swapQuest(offered, quest, match(otherQuest), '2026-08-24T08:02:00.000Z')
expect(swapped.history[0]).toMatchObject({
  questId: quest.questId,
  questTitle: quest.title,
  questContentVersion: quest.contentVersion,
  questCategory: quest.category,
  questDifficulty: quest.difficulty,
  status: 'swapped',
  xpAwarded: 0,
})

const abandoned = abandonQuest(accepted, quest, '2026-08-24T08:03:00.000Z')
expect(abandoned.history.at(-1)?.questTitle).toBe(quest.title)

const completed = completeQuest(accepted, quest, content.content.badges, '2026-08-24T08:06:00.000Z', '2026-08-24')
expect(completed.state.history.at(-1)).toMatchObject({
  questTitle: quest.title,
  questContentVersion: quest.contentVersion,
  questCategory: quest.category,
  questDifficulty: quest.difficulty,
  xpAwarded: quest.xp,
})
```

新增不可变测试：完成后构造同 ID、不同标题的任务传给 `summarizeHistory`，断言摘要仍显示历史条目的 `questTitle`。

- [ ] **Step 2: 运行领域测试并确认签名或字段失败**

Run: `pnpm test -- src/domain/quests.test.ts`

Expected: FAIL，原因是 `acceptQuest`、`swapQuest`、`abandonQuest` 仍使用旧签名或历史缺少快照。

- [ ] **Step 3: 用统一辅助函数生成历史记录**

在 `src/domain/quests.ts` 引入 `snapshotQuest`，并实现：

```ts
function historyEntry(
  quest: Quest,
  fields: Pick<QuestHistoryEntry, 'acceptanceId' | 'status' | 'occurredAt' | 'xpAwarded'> & Pick<QuestHistoryEntry, 'completionDate'>,
): QuestHistoryEntry {
  return { questId: quest.questId, ...snapshotQuest(quest), ...fields }
}
```

如果 TypeScript 不接受必选 `completionDate` 的 `Pick`，使用明确参数类型：

```ts
type HistoryFields = {
  acceptanceId: string
  status: QuestHistoryEntry['status']
  occurredAt: string
  xpAwarded: number
  completionDate?: string
}
```

所有 `swapped`、`abandoned`、`completed` 条目必须通过该辅助函数创建。

- [ ] **Step 4: 修改领域函数签名并验证任务 ID**

实现以下签名：

```ts
export function acceptQuest(state: GuildDomainState, quest: Quest, acceptedAt: string): GuildDomainState
export function swapQuest(state: GuildDomainState, offeredQuest: Quest, match: QuestMatch, swappedAt: string): GuildDomainState
export function abandonQuest(state: GuildDomainState, quest: Quest, abandonedAt: string): GuildDomainState
```

三者都必须先确认 `quest.questId` 与对应的 offered/active ID 相同；不相同则返回原 state。接取时写入：

```ts
const activeQuest: ActiveQuest = {
  acceptanceId: `${quest.questId}:${acceptedAt}:${state.rngState}`,
  questId: quest.questId,
  acceptedAt,
  questContentVersion: quest.contentVersion,
  preference: state.preference,
}
```

- [ ] **Step 5: 历史摘要只读取不可变快照**

将签名收窄为：

```ts
export function summarizeHistory(history: QuestHistoryEntry[]): QuestHistorySummary
```

每个摘要条目使用：

```ts
{
  questId: entry.questId,
  title: entry.questTitle,
  status: entry.status,
  occurredAt: entry.occurredAt,
}
```

- [ ] **Step 6: 更新 App 调用与分类统计字段**

在 `App.tsx` 当前活跃目录尚未接入退役任务前，使用现有 `questById`：

```ts
if (!offeredQuest) return
const nextGuild = acceptQuest(state.guild, offeredQuest, now)

const nextGuild = swapping && offeredQuest
  ? swapQuest(baseState, offeredQuest, result, now)
  : offerQuest(baseState, result, now)

if (!activeQuest) return
const nextGuild = abandonQuest(state.guild, activeQuest, now)
```

将所有 `entry.category` 改为 `entry.questCategory`，包括 matcher context、`deriveCategoryCounts` 和 `app/state.ts` 的 payload 恢复统计。

- [ ] **Step 7: 更新测试夹具并运行受影响测试**

所有手写 `QuestHistoryEntry` 使用真实任务生成快照字段。`src/storage/adventure-log.test.ts` 的示例条目补充：

```ts
questTitle: '把休息两分钟命名为「王国停战协议」',
questContentVersion: '1.0.0',
questCategory: 'rest',
questDifficulty: 'tiny',
```

Run: `pnpm test -- src/domain/quests.test.ts src/app/state.test.ts src/storage/adventure-log.test.ts`

Expected: PASS。

- [ ] **Step 8: 运行构建检查**

Run: `pnpm build`

Expected: PASS，TypeScript 不再有缺失快照字段或旧函数签名错误。

- [ ] **Step 9: 只读检查范围**

Run: `git diff --check -- projects/08-earth-online`

Expected: 无输出。

---

### Task 3: 升级本地存储并迁移 schemaVersion 1

**Files:**
- Modify: `projects/08-earth-online/src/storage/storage.ts`
- Modify: `projects/08-earth-online/src/storage/storage.test.ts`
- Modify: `projects/08-earth-online/src/app/controller.ts`
- Modify: `projects/08-earth-online/src/app/controller.test.ts`
- Modify: `projects/08-earth-online/src/App.tsx`

**Interfaces:**
- Consumes: `Pick<QuestCatalog, 'activeById' | 'allById'>`、`snapshotQuest(quest)`、v2 `StoragePayload`。
- Produces: `STORAGE_SCHEMA_VERSION = 2`、`StorageEnvelope` schemaVersion 2、`loadState(storage, catalog)`，以及 v1 到 v2 的内存迁移。

- [ ] **Step 1: 写 v1 历史与旧当前任务迁移测试**

在 `src/storage/storage.test.ts` 创建一个不带快照字段的原始 v1 payload，并从现有任务克隆一个仅供迁移单测使用的退役任务夹具；正式 `retiredTasks` 在 Task 4 才录入：

```ts
const active = content.content.tasks[0]
const retired = {
  ...content.content.tasks[1],
  questId: 'quest-retired-storage-fixture',
  title: '旧版存储任务',
  contentVersion: '1.0.0',
}
const catalog = {
  activeById: new Map([[active.questId, active]]),
  allById: new Map([[active.questId, active], [retired.questId, retired]]),
}

const legacy = legacyPayload()
legacy.activeQuest = {
  acceptanceId: 'legacy-active',
  questId: retired.questId,
  acceptedAt: '2026-08-28T08:00:00.000Z',
  preference: legacy.preference,
}
legacy.history = [{
  acceptanceId: 'legacy-history',
  questId: retired.questId,
  status: 'completed',
  occurredAt: '2026-08-27T08:00:00.000Z',
  completionDate: '2026-08-27',
  xpAwarded: retired.xp,
  category: retired.category,
}]

const loaded = loadState(memoryStorage(JSON.stringify({
  schemaVersion: 1,
  contentVersion: '1.0.0',
  updatedAt: '2026-08-28T09:00:00.000Z',
  data: legacy,
})), catalog)

expect(loaded.status).toBe('ok')
if (loaded.status !== 'ok') return
expect(loaded.envelope.schemaVersion).toBe(2)
expect(loaded.envelope.data.activeQuest).toMatchObject({
  questId: retired.questId,
  questContentVersion: retired.contentVersion,
})
expect(loaded.envelope.data.history[0]).toMatchObject({
  questTitle: retired.title,
  questContentVersion: retired.contentVersion,
  questCategory: retired.category,
  questDifficulty: retired.difficulty,
  xpAwarded: retired.xp,
})
```

另加测试：v1 active quest ID 未知时返回 `corrupt/invalid-state`；v1 history 中未知非关键记录被移除；schemaVersion 99 仍返回 `future-version`。

- [ ] **Step 2: 运行存储测试确认版本与快照失败**

Run: `pnpm test -- src/storage/storage.test.ts`

Expected: FAIL，原因包括 envelope 仍为版本 1、`loadState` 参数仍是 Set、历史没有快照。

- [ ] **Step 3: 定义 v1 原始形状和 v2 envelope**

在 `src/storage/storage.ts`：

```ts
export const STORAGE_SCHEMA_VERSION = 2 as const
export type StorageEnvelope = {
  schemaVersion: 2
  contentVersion: string
  updatedAt: string
  data: StoragePayload
}

type LegacyHistoryEntry = {
  acceptanceId: string
  questId: string
  status: QuestHistoryEntry['status']
  occurredAt: string
  xpAwarded: number
  completionDate?: string
  category?: QuestCategory
}
```

保留现有 `STORAGE_KEY = 'xhs-tool:earth-online:state:v1'`，否则无法发现并迁移旧数据。

- [ ] **Step 4: 实现版本分派和快照迁移**

将入口签名改为：

```ts
export function loadState(
  storage: Pick<Storage, 'getItem'>,
  catalog: Pick<QuestCatalog, 'activeById' | 'allById'>,
): StorageLoadResult
```

版本分派：

```ts
if (parsed.schemaVersion > STORAGE_SCHEMA_VERSION) {
  return { status: 'future-version', foundVersion: parsed.schemaVersion }
}
if (parsed.schemaVersion !== 1 && parsed.schemaVersion !== 2) {
  return { status: 'corrupt', reason: 'invalid-envelope' }
}
```

迁移历史时使用：

```ts
function migrateHistoryEntry(value: LegacyHistoryEntry, questsById: ReadonlyMap<string, Quest>): QuestHistoryEntry | undefined {
  const quest = questsById.get(value.questId)
  if (!quest) return undefined
  return {
    acceptanceId: value.acceptanceId,
    questId: value.questId,
    status: value.status,
    occurredAt: value.occurredAt,
    completionDate: value.completionDate,
    xpAwarded: Math.max(0, Math.floor(value.xpAwarded)),
    ...snapshotQuest(quest),
  }
}
```

schemaVersion 2 的历史必须验证并保留已有快照，不允许再从当前内容覆盖标题。

- [ ] **Step 5: 迁移旧 activeQuest 并保留原内容版本**

`sanitizeActiveQuest` 查找 `catalog.allById.get(value.questId)`；版本 1 缺少 `questContentVersion` 时使用该任务的 `contentVersion`，版本 2 则要求字段为非空字符串。未知 active quest 是关键状态，返回 `invalid-state`，不得静默替换成新任务。

`offeredQuestId` 和 `recentQuestIds` 只接受 `catalog.activeById` 中的 ID；因此尚未接取就被退役的 offer 会安全回到大厅，退役任务也不会继续占据近期推荐列表。历史迁移和 `completedQuestIds` 使用 `catalog.allById`，保留旧完成记录。

- [ ] **Step 6: 更新 controller 与 App 注入 lookup**

`createStorageEnvelope` 返回：

```ts
return { schemaVersion: 2, contentVersion, updatedAt, data: toStoragePayload(guild) }
```

Task 4 之前，`App.tsx` 暂时把现有活跃任务 map 同时作为 active/all：

```ts
const loaded = loadState(window.localStorage, { activeById: questById, allById: questById })
```

Task 5 再替换为真实 `catalog`。

- [ ] **Step 7: 验证迁移和写入拒绝规则**

Run: `pnpm test -- src/storage/storage.test.ts src/app/controller.test.ts`

Expected: PASS，且禁止媒体、定位、证明字段与 quota 错误测试继续通过。

- [ ] **Step 8: 运行构建与只读 diff 检查**

Run: `pnpm build`

Expected: PASS。

Run: `git diff --check -- projects/08-earth-online`

Expected: 无输出。

---

### Task 4: 轮换 20 项任务并重写 100 项活跃内容

**Files:**
- Modify: `projects/08-earth-online/src/content/content.json`
- Modify: `projects/08-earth-online/src/content/validate.ts`
- Modify: `projects/08-earth-online/src/content/validate.test.ts`
- Modify: `projects/08-earth-online/src/content/content.test.ts`
- Modify: `projects/08-earth-online/src/domain/matcher.test.ts`

**Interfaces:**
- Consumes: `EarthOnlineContent.content.retiredTasks`、现有 Quest 数据契约与匹配器。
- Produces: contentVersion `2.0.0`、100 个活跃任务、20 个退役任务、精确挑战分布和对应运行时校验。

- [ ] **Step 1: 写任务轮换、分布和模板禁用的失败测试**

在 `src/content/content.test.ts` 增加：

```ts
const retiredIds = [
  'quest-rest-silent-minute',
  'quest-rest-hands',
  'quest-tidy-expired-note',
  'quest-tidy-downloads',
  'quest-observe-shadow',
  'quest-observe-reflection',
  'quest-observe-room-route',
  'quest-move-carry-light',
  'quest-move-posture-change',
  'quest-move-reset-break',
  'quest-learn-one-page',
  'quest-learn-label',
  'quest-learn-question',
  'quest-connect-thanks',
  'quest-connect-memory',
  'quest-connect-question',
  'quest-kind-clear-path',
  'quest-digital-name-file',
  'quest-adventure-door-count',
  'quest-adventure-bench-pause',
] as const

const replacementIds = [
  'quest-rest-sensory-recharge',
  'quest-rest-room-calibration',
  'quest-tidy-seven-decisions',
  'quest-tidy-forgotten-object',
  'quest-observe-time-traces',
  'quest-observe-reflection-triad',
  'quest-observe-memory-scan',
  'quest-move-comfort-combo',
  'quest-move-song-relay',
  'quest-move-motion-bingo',
  'quest-learn-teach-back',
  'quest-learn-design-detective',
  'quest-learn-two-answers',
  'quest-connect-small-recommendation',
  'quest-connect-daily-surprise',
  'quest-connect-choice-card',
  'quest-kind-friction-fix',
  'quest-digital-retrieval-drill',
  'quest-adventure-reality-bingo',
  'quest-adventure-three-point-loop',
] as const

it('ships 100 active quests and exactly 20 resolvable retired quests', () => {
  const activeIds = new Set(content.content.tasks.map(({ questId }) => questId))
  const archivedIds = new Set(content.content.retiredTasks.map(({ questId }) => questId))
  expect(content.content.tasks).toHaveLength(100)
  expect(content.content.retiredTasks).toHaveLength(20)
  expect([...activeIds].some((id) => archivedIds.has(id))).toBe(false)
  expect(retiredIds.every((id) => archivedIds.has(id))).toBe(true)
  expect(replacementIds.every((id) => activeIds.has(id))).toBe(true)
})

it('uses every supported challenge tier with the approved distribution', () => {
  expect(countBy(content.content.tasks, 'timeCost')).toEqual({ 5: 30, 10: 35, 15: 25, 20: 10 })
  expect(countBy(content.content.tasks, 'energyLevel')).toEqual({ 1: 45, 2: 40, 3: 15 })
  expect(countBy(content.content.tasks, 'difficulty')).toEqual({ tiny: 35, light: 40, standard: 20, brave: 5 })
})

it('contains no previous universal description or second-step template', () => {
  const oldPhrases = [
    '认真演完这段荒唐，普通日常就会短暂获得剧情。',
    '只挑战一次已经算赢，任何不舒服都可以立刻撤退。',
    '不求感谢、不留证明，让善意自然发生后就离场。',
    '把范围锁小，完成后允许这点进步正式算数。',
    '用一句话确认刚才发生了什么，不追加更大的目标。',
    '完成后给这段行动起一个荒唐但正式的任务名，然后立刻收工。',
  ]
  for (const quest of content.content.tasks) {
    const authored = `${quest.description}\n${quest.steps.join('\n')}`
    for (const phrase of oldPhrases) expect(authored).not.toContain(phrase)
    expect(new Set(quest.steps).size).toBe(quest.steps.length)
  }
})
```

实现测试辅助函数：

```ts
function countBy<K extends 'timeCost' | 'energyLevel' | 'difficulty'>(quests: Quest[], key: K): Record<string, number> {
  return quests.reduce<Record<string, number>>((counts, quest) => {
    const value = String(quest[key])
    counts[value] = (counts[value] ?? 0) + 1
    return counts
  }, {})
}
```

- [ ] **Step 2: 写退役隔离和 E3 精确匹配测试**

在 `src/domain/matcher.test.ts` 增加：

```ts
it('never recommends a retired quest', () => {
  for (let seed = 0; seed < 100; seed += 1) {
    const result = matchQuest(quests, basePreference, { ...emptyContext, seed })
    if (result.kind === 'match') {
      expect(content.content.retiredTasks.map(({ questId }) => questId)).not.toContain(result.quest.questId)
    }
  }
})

it('matches a 20-minute E3 quest without relaxing energy', () => {
  const preference: QuestPreference = {
    ...basePreference,
    minutes: 20,
    energy: 3,
    goalId: 'explore',
  }
  const result = matchQuest(quests, preference, emptyContext)
  expect(result.kind).toBe('match')
  if (result.kind !== 'match') return
  expect(result.stage).toBe('exact')
  expect(result.quest.timeCost).toBeLessThanOrEqual(20)
  expect(result.quest.energyLevel).toBe(3)
  expect(result.quest.goalIds).toContain('explore')
})
```

- [ ] **Step 3: 运行内容测试并确认空退役目录、旧模板和缺少高阶任务失败**

Run: `pnpm test -- src/content/content.test.ts src/content/catalog.test.ts src/domain/matcher.test.ts`

Expected: FAIL，至少包含 retired count、旧模板、20 分钟/E3 分布错误。

- [ ] **Step 4: 将 20 项旧任务完整移动到 retiredTasks**

从现有 `tasks` 移出上面 `retiredIds` 的完整对象，原样放入 `retiredTasks`。退役对象继续保持 `contentVersion: "1.0.0"`、原 XP、步骤与文案，以保证旧进行中任务可按原版本完成。

不得只保存标题，不得更改退役任务的 XP、类别或步骤。

- [ ] **Step 5: 新增 20 项有机制的替换任务**

使用 `replacementIds`，按以下明确任务简报创作完整 `Quest` 字段：

| ID | 标题与核心完成机制 | 类型 |
|---|---|---|
| `quest-rest-sensory-recharge` | 十分钟无屏补给；离开屏幕，找到三条不同感官线索并写一句当前状态 | rest |
| `quest-rest-room-calibration` | 恢复站环境校准；从光线、声音、坐姿、饮水中改善两项并比较前后 | rest |
| `quest-tidy-seven-decisions` | 七件决策冲刺；每件只准归位、删除、安排三选一 | tidy |
| `quest-tidy-forgotten-object` | 小区域限时考古；整理一个明确区域并找出一件被遗忘的物品 | tidy |
| `quest-observe-time-traces` | 时间痕迹侦察；找出三条能证明时间流动的线索 | observe |
| `quest-observe-reflection-triad` | 三面反射侦察；从三个反光面分别发现一个平时忽略的细节 | observe |
| `quest-observe-memory-scan` | 三十秒记忆侦查；观察、背对、写下五个细节、回看核对 | observe |
| `quest-move-comfort-combo` | 舒适动作组合；自选三种低风险动作，每项 30 秒，共两轮 | move |
| `quest-move-song-relay` | 一首歌四段移动接力；每段更换一种舒适动作 | move |
| `quest-move-motion-bingo` | 十五分钟动作宾果；走动、舒展、平衡、放松各完成一格 | move |
| `quest-learn-teach-back` | 三句话复述挑战；读一小段、合上材料、复述并留下一个问题 | learn |
| `quest-learn-design-detective` | 日常物品设计侦探；识别三项设计选择及其解决的问题 | learn |
| `quest-learn-two-answers` | 双答案调查；找两种不同解释并写出关键分歧 | learn |
| `quest-connect-small-recommendation` | 十分钟推荐交换；向可信熟人索取一个低成本小推荐，不等回复也算完成 | connect |
| `quest-connect-daily-surprise` | 今日意外交换；把今天最意外的一件小事发给熟人，不要求即时回应 | connect |
| `quest-connect-choice-card` | 二选一联络卡；给可信熟人发一道二选一并先回答自己 | connect |
| `quest-kind-friction-fix` | 十分钟摩擦修复；在责任范围内修复一件反复制造不便的小事 | kind |
| `quest-digital-retrieval-drill` | 数字逃生演练；一分钟内找到一项重要资料的安全路径，不复制敏感内容 | digital |
| `quest-adventure-reality-bingo` | 现实五格宾果；寻找圆形、年份、手写字、重复图案和自然痕迹 | adventure |
| `quest-adventure-three-point-loop` | 三地标安全环线；白天在熟悉公共区域走完三个地标且路线不重复 | adventure |

每项写 2–4 个具体步骤；完成方式必须描述可自行判断的结果；放弃规则必须与该任务实际风险相关；分享短句不得暗示定位或证明。

- [ ] **Step 6: 重写全部活跃任务的描述和步骤**

对 80 个保留 ID 的任务和 20 个新任务执行同一作者标准：

- `description` 必须说明任务为什么值得做、动作边界和可观察结果，不能只复述标题。
- `steps[0]` 给出准备或选择，后续步骤给出行动和结束条件。
- 每项至少一个独有名词或数量约束，使任何两项任务的完整 steps 不相同。
- `guildBrief` 保持 8–64 字，但改成该任务专属提示，不使用按类别复制的前缀句。
- `completionText` 描述该任务真实产生的结果。
- `abandonText` 与 `abandonRule` 针对当前任务，不使用 tone 通用模板。

更新所有活跃任务 `contentVersion` 为 `2.0.0`，并将包级 `contentVersion`、`meta.updatedAt` 更新为 `2.0.0`、`2026-08-29`。

- [ ] **Step 7: 调整精确分布与 XP**

将活跃任务调到以下精确统计：

```text
timeCost: 5=30, 10=35, 15=25, 20=10
energyLevel: 1=45, 2=40, 3=15
difficulty: tiny=35, light=40, standard=20, brave=5
```

XP 与难度保持固定映射：

```text
tiny=20, light=35, standard=55, brave=80
```

冷却只使用 3、7、14 天：简单可变任务可用 3 天，多阶段任务用 7 天，容易产生重复疲劳的特色任务用 14 天。

至少安排 10 个 20 分钟任务、15 个 E3 任务；其中必须包含同时满足 20 分钟、E3、`explore`、室内、单人的任务，确保高精力黄金条件不依赖户外。

- [ ] **Step 8: 扩展生产校验**

在 `src/content/validate.ts`：

- 将 `retiredTasks` 加入 required roots。
- 使用同一个 `questIds` Set 先校验 100 个 active，再校验 retired，从而捕获跨目录重复 ID。
- active 必须恰好 100；发布内容测试要求本轮 retired 恰好 20，但运行时校验允许退役目录在未来版本继续累积。
- active 类别必须 10 类各 10 项。
- active 统计必须满足 Task 4 Step 7 的精确值。
- XP 必须与 difficulty 映射一致。
- cooldownDays 必须是 3、7、14。
- active 描述/步骤不得包含旧模板短句。
- retired 只验证基本字段、安全字段、引用和 asset ID，不套用新分布与新文案规则。

在 `src/content/validate.test.ts` 添加一个 active/retired 重复 ID 夹具和一个旧模板夹具，分别断言 issue path 指向对应任务。

- [ ] **Step 9: 运行内容、目录、匹配和全部测试**

Run: `pnpm test -- src/content/content.test.ts src/content/catalog.test.ts src/content/validate.test.ts src/domain/matcher.test.ts`

Expected: PASS。

Run: `pnpm test`

Expected: PASS。

- [ ] **Step 10: 运行构建和只读 diff 检查**

Run: `pnpm build`

Expected: PASS。

Run: `git diff --check -- projects/08-earth-online`

Expected: 无输出。

---

### Task 5: 接入退役任务恢复、历史快照和“经典任务”呈现

**Files:**
- Modify: `projects/08-earth-online/src/App.tsx`
- Modify: `projects/08-earth-online/src/app/view-model.ts`
- Modify: `projects/08-earth-online/src/app/view-model.test.ts`
- Modify: `projects/08-earth-online/src/ui/QuestFlow.tsx`
- Modify: `projects/08-earth-online/src/ui/ArchiveViews.tsx`
- Modify: `projects/08-earth-online/src/ui/render.test.tsx`
- Modify: `projects/08-earth-online/src/content/schema.ts`
- Modify: `projects/08-earth-online/src/content/content.json`
- Modify: `projects/08-earth-online/src/App.css`

**Interfaces:**
- Consumes: `createQuestCatalog(content)`、`QuestHistoryEntry` 快照、`ActiveQuest.questContentVersion`。
- Produces: active-only matching、active+retired current quest resolution、`classic` UI flag、snapshot-only history rendering。

- [ ] **Step 1: 写退役当前任务 view model 测试**

在 `src/app/view-model.test.ts` 增加：

```ts
it('resolves a retired active quest without exposing it as an offer candidate', () => {
  const retired = content.content.retiredTasks[0]
  const guild = {
    ...createGuildState(preference, 1),
    activeQuest: {
      acceptanceId: 'legacy-active',
      questId: retired.questId,
      acceptedAt: '2026-08-28T08:00:00.000Z',
      questContentVersion: retired.contentVersion,
      preference,
    },
  }
  const model = createPageViewModel({ page: 'questAccepted', guild, lastAwardedXp: 0, newlyUnlockedBadgeIds: [] }, content)
  expect(model.quest?.title).toBe(retired.title)
  expect(model.questIsRetired).toBe(true)
})
```

新增历史漂移测试：构造 `questTitle: '旧标题'` 的历史记录，同时目录中同 ID 任务标题为其他值，断言 `model.history.entries[0].title === '旧标题'`。

- [ ] **Step 2: 写经典任务和历史快照渲染测试**

在 `src/ui/render.test.tsx`：

```tsx
it('labels a retired active quest as a classic quest', () => {
  const quest = content.content.retiredTasks[0]
  const html = renderToStaticMarkup(
    <ActiveQuestView
      quest={quest}
      categoryName="恢复精力"
      classic
      ui={content.content.ui}
      onComplete={noop}
      onAbandon={noop}
      onUnsuitable={noop}
    />,
  )
  expect(html).toContain(content.content.ui.quest.labels.classic)
  expect(html).toContain(quest.title)
})
```

为 `AdventureLog` 传入含 `questTitle: '旧版任务名'` 的历史，不再传 `quests`，断言 HTML 显示旧版名称。

- [ ] **Step 3: 运行 view model 和渲染测试确认失败**

Run: `pnpm test -- src/app/view-model.test.ts src/ui/render.test.tsx`

Expected: FAIL，原因是 active map 不含 retired、缺少 `questIsRetired`/`classic`、历史仍查询当前任务。

- [ ] **Step 4: 接入统一任务目录**

在 `App.tsx` 顶层替换 `questById`：

```ts
const content = rawContent as unknown as EarthOnlineContent
const catalog = createQuestCatalog(content)
```

使用规则：

```ts
const activeQuest = state.guild.activeQuest ? catalog.resolve(state.guild.activeQuest.questId) : undefined
const offeredQuest = state.guild.offeredQuestId ? catalog.activeById.get(state.guild.offeredQuestId) : undefined
const settledQuest = state.page === 'questComplete' || state.page === 'questAbandoned'
  ? catalog.resolve(state.guild.history.at(-1)?.questId ?? '')
  : undefined
```

- 匹配继续显式传 `catalog.active`。
- `loadState` 传 `catalog`。
- offered quest 只能从 `activeById` 解析。
- active/settled quest 从 `resolve` 解析。
- `confirmCompletion` 和 `confirmAbandon` 将解析出的旧 Quest 传给领域函数，因此旧 XP 和旧快照保持正确。

- [ ] **Step 5: view model 同时解析旧任务并标记**

在 `PageViewModel` 增加：

```ts
questIsRetired?: boolean
```

`createPageViewModel` 内构建 catalog，并返回：

```ts
quest: questId ? catalog.resolve(questId) : undefined,
questIsRetired: questId ? catalog.isRetired(questId) : false,
history: summarizeHistory(state.guild.history),
```

- [ ] **Step 6: 历史页只显示快照**

从 `AdventureLogProps` 删除 `quests: Quest[]`。列表渲染使用：

```tsx
<span>{categoryMap.get(entry.questCategory) ?? entry.questCategory} · {entry.occurredAt.slice(0, 10)}</span>
<strong>{entry.questTitle}</strong>
<small>{ui.archive.statuses[entry.status]} · {entry.xpAwarded} XP</small>
```

App 调用同步删除 `quests={content.content.tasks}`。

- [ ] **Step 7: 加入经典任务内容文案和可访问标记**

在 `UiContent.quest.labels` 增加 `classic`，在 `content.json` 写入：

```json
"classic": "经典任务"
```

`ActiveQuestView` 增加 `classic?: boolean`，传给 `QuestSheet`。`QuestSheet` 在标题区域输出：

```tsx
{classic && <span className="classic-quest-label">{ui.quest.labels.classic}</span>}
```

在 `App.css` 增加与现有纸张色系一致的文字标签样式，不使用 emoji，不使用 sticky/fixed。

- [ ] **Step 8: 运行集成测试和全量测试**

Run: `pnpm test -- src/app/view-model.test.ts src/ui/render.test.tsx src/domain/quests.test.ts src/storage/storage.test.ts`

Expected: PASS。

Run: `pnpm test`

Expected: PASS。

- [ ] **Step 9: 运行 lint/build 与只读 diff 检查**

Run: `pnpm lint`

Expected: PASS。

Run: `pnpm build`

Expected: PASS。

Run: `git diff --check -- projects/08-earth-online`

Expected: 无输出。

---

### Task 6: 更新准备报告并完成真实浏览器验收

**Files:**
- Modify: `projects/08-earth-online/PREP_REPORT.md`
- Modify only if verification exposes a defect: files already listed in Tasks 1–5

**Interfaces:**
- Consumes: 最终内容统计、存储 schemaVersion 2、测试和浏览器输出。
- Produces: 可审计的任务轮换、迁移、分布、安全与验收记录。

- [ ] **Step 1: 用只读脚本生成最终统计**

Run:

```bash
node - <<'NODE'
const content = require('./src/content/content.json').content
const count = (key) => Object.fromEntries(Object.entries(content.tasks.reduce((result, quest) => {
  result[quest[key]] = (result[quest[key]] ?? 0) + 1
  return result
}, {})).sort(([left], [right]) => left.localeCompare(right, undefined, { numeric: true })))
console.log({
  active: content.tasks.length,
  retired: content.retiredTasks.length,
  categories: count('category'),
  time: count('timeCost'),
  energy: count('energyLevel'),
  difficulty: count('difficulty'),
  xp: count('xp'),
  cooldown: count('cooldownDays'),
})
NODE
```

Expected: active 100、retired 20、类别各 10，并与设计分布一致。

- [ ] **Step 2: 更新 PREP_REPORT.md**

增加以下明确内容：

- contentVersion 2.0.0 与 20 个 retired/new ID 对照表。
- 时间、精力、难度、XP、冷却、类型和社交分布。
- “挑战来自约束和成果，不来自风险”的安全原则。
- retiredTasks 不参与匹配的规则。
- storage schemaVersion 1 → 2 迁移步骤。
- 历史标题快照字段与旧 active quest 完成规则。
- 新增的 20 分钟/E3 黄金条件结果。
- 本轮 lint/test/build 与浏览器验证结果。

不得删除原报告中的匹配放宽、seed、等级、连续记录、徽章或安全边界说明。

- [ ] **Step 3: 运行最终静态验证**

在 `projects/08-earth-online` 目录依次运行：

```text
pnpm lint
pnpm test
pnpm build
```

Expected:

- lint exit 0。
- test exit 0，所有测试文件和测试用例通过。
- build exit 0，TypeScript 与 Vite 构建成功。

- [ ] **Step 4: 启动本地 preview 并执行真实浏览器主流程**

使用 Playwright CLI 或项目已有浏览器工具验证：

1. 清空本项目 localStorage。
2. 完成引导并选择 20 分钟、E3、室内、独处、探索。
3. 验证得到 exact 阶段且任务卡显示 20 分钟、E3、standard/brave 或对应高阶标签。
4. 接取、刷新，确认当前任务恢复。
5. 完成任务，确认 XP 与任务 difficulty 对应且历史显示接取时标题。
6. 注入 schemaVersion 1、指向退役任务的 active/history payload，刷新后确认出现“经典任务”、原步骤与原历史标题。
7. 完成旧任务，确认按退役定义的原 XP 结算。

- [ ] **Step 5: 验证三个窄屏和非零安全区**

分别设置 375、390、430 CSS px 宽度，检查：

- `document.documentElement.scrollWidth === window.innerWidth`。
- 任务标题、四级难度、步骤和经典任务标签无横向溢出。
- 历史长标题可换行，不遮挡日期或 XP。

设置：

```js
document.documentElement.style.setProperty('--safe-area-inset-top', '32px')
```

再次验证顶部 HUD 与页面主标题不被遮挡；如果发生失败，只修复项目内 CSS，并重新运行 lint/test/build。

- [ ] **Step 6: 最终只读差异检查**

Run:

```text
git diff --check -- projects/08-earth-online
git diff --name-only -- projects/08-earth-online
git diff --stat -- projects/08-earth-online
```

Expected: diff 仅包含 `projects/08-earth-online/**`，无空白错误。

- [ ] **Step 7: 报告完成状态**

只有在 lint、test、build、三档宽度、非零安全区、旧任务迁移和主流程全部通过后，才报告升级完成。由于明确禁止 Git 写操作，不创建提交、不推送、不切换分支。
