# 地球 Online：抽取多样性与旧档案按需加载 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不放宽安全或用户明确条件的前提下，将同条件任务的强去重窗口扩展到 8 次，并让标准 Web 构建只在发现旧存档时加载完整 v1 任务档案。

**Architecture:** 匹配器继续使用现有 seeded weighted selection，但增加位置相关的近期衰减、最近 4 次类别疲劳和 25 分高适配带。`content.json` 保持唯一业务内容源，由项目内 Vite 插件在构建期提供 current/archive/loader 虚拟模块；标准 Web 使用 lazy archive chunk，小程序构建使用 eager 单包，异步 bootstrap 在创建 App 前按 localStorage 最小结构决定是否加载 archive。

**Tech Stack:** React 19、TypeScript 6、Vite 8、Vitest 4、localStorage、现有 Playwright CLI、项目现有 minitool 构建工具。

**Spec:** `projects/08-earth-online/DRAW_DIVERSITY_AND_LAZY_ARCHIVE_DESIGN.md`

## Global Constraints

- 只允许修改 `projects/08-earth-online/**`。
- 不修改根 `package.json`、`pnpm-workspace.yaml`、`pnpm-lock.yaml`、`docs/`、其他项目或共享配置。
- 不安装、升级或删除依赖，不修改 lockfile。
- 不执行 Git 提交、推送、checkout、reset、worktree 或其他 Git 写操作；计划中的检查点只使用限定项目目录的只读 diff。
- `src/content/content.json` 必须继续是唯一业务内容源；不得提交生成后的内容副本。
- 保持纯前端静态运行；不增加 fetch、外部 API、运行时 CDN、后端、定位、上传证明、图片存储、Service Worker 或运行时 AI。
- 安全、时间上限、精力上限、环境、地点、社交、预算和不适用条件永不因多样性策略放宽。
- 标准 Web 构建可以使用本地动态 chunk；minitool 构建必须保持单 HTML、单经典 IIFE JS、无动态 import。
- 使用 TDD：每个行为先写失败测试并确认失败原因，再实现最小代码。
- 最终执行 `pnpm lint`、`pnpm test`、`pnpm build`；只有在产品确认本设计允许扩展验证命令后，才额外运行 `pnpm build:minitool`、`pnpm validate:minitool`。

## File Structure

- `src/domain/matcher.ts`：8 项近期窗口、位置衰减、类别疲劳、25 分质量带和多样性解释。
- `src/domain/matcher.test.ts`：连续 8 次不重复、最久未见优先、类别疲劳、seed 和硬条件回归。
- `src/content/schema.ts`、`src/content/content.json`：为匹配解释增加 `fresh`、`variety` 类型化文案，不改变任务数据。
- `src/storage/archive-requirement.ts`：只解析 envelope 最小结构，判断是否需要 archive。
- `src/storage/archive-requirement.test.ts`：空/损坏/未来/v1/v2 当前/v2 经典条件矩阵。
- `vite.content-plugin.ts`：从唯一 JSON 源构造 current/archive/loader 三个虚拟模块，支持 lazy/eager 两种 loader。
- `vite.content-plugin.test.ts`：验证 current 不含档案、archive 完整、lazy/eager loader 源码契约。
- `vite.config.ts`、`vite.minitool.config.ts`：分别接入 lazy 和 eager 插件。
- `tsconfig.node.json`：纳入两个 Vite config 和内容插件的类型检查。
- `src/content/virtual-content.d.ts`：三个虚拟模块的 TypeScript 声明。
- `src/app/bootstrap.ts`：合并 archive、校验内容、创建 catalog，并把加载错误转为可恢复启动结果。
- `src/app/bootstrap.test.ts`：通过注入 loader 验证仅在需要时加载以及失败不覆盖存储。
- `src/App.tsx`：接收 prepared content/catalog/bootstrap error，不再同步导入完整 JSON。
- `src/main.tsx`：渲染轻量加载状态，异步 prepare 后渲染 App。
- `src/app/view-model.ts`：允许调用方复用已经准备好的 catalog，避免每次重新构建。
- `PREP_REPORT.md`：记录新 matcher 规则、构建拆包、体积和验证证据。

---

### Task 1: 扩大近期去重并让候选耗尽后优先最久未出现任务

**Files:**
- Modify: `projects/08-earth-online/src/domain/matcher.test.ts`
- Modify: `projects/08-earth-online/src/domain/matcher.ts`

**Interfaces:**
- Consumes: `matchQuest(quests, preference, context)`、`MatchContext.recentQuestIds`、现有 `nextSeed`。
- Produces: `RECENT_WINDOW = 8` 的确定性选择；近期候选评分由位置决定，最新任务惩罚最大。

- [ ] **Step 1: 写连续 8 次无重复的失败测试**

在 `matcher.test.ts` 使用 8 个硬条件相同、不同 ID 的 fixture，循环调用 matcher 并把每次 `questId` 与 `nextSeed` 写回 context：

```ts
it('does not repeat across eight consecutive draws when eight clean candidates exist', () => {
  const candidates = Array.from({ length: 8 }, (_, index) => withQuest(quests[0], {
    questId: `quest-variety-${index}`,
    timeCost: 10,
    energyLevel: 1,
    goalIds: ['relax'],
  }))
  let recentQuestIds: string[] = []
  let seed: string | number = 'eight-draws'
  const drawn: string[] = []

  for (let index = 0; index < 8; index += 1) {
    const result = matchQuest(candidates, basePreference, { ...emptyContext, seed, recentQuestIds })
    expect(result.kind).toBe('match')
    if (result.kind !== 'match') return
    drawn.push(result.quest.questId)
    recentQuestIds = [...recentQuestIds, result.quest.questId].slice(-10)
    seed = result.nextSeed
  }

  expect(new Set(drawn).size).toBe(8)
})
```

- [ ] **Step 2: 运行完整测试并确认 RED**

Run: `pnpm test`

Expected: FAIL，旧实现只排除最近 3 项，8 次抽取出现重复。

- [ ] **Step 3: 把 clean 窗口从 3 改为 8**

在 matcher 顶层加入并使用：

```ts
const recentWindow = 8
const recentIds = context.recentQuestIds.slice(-recentWindow)
const recent = new Set(recentIds)
```

保留存储侧最多 10 项的上限，不改变 Storage Schema。

- [ ] **Step 4: 写“候选耗尽后选择最久未出现”的失败测试**

使用 4 个候选，令 recent 顺序为 `[A, B, C, D]`，断言进入 `recent-relaxed` 后选择 A；再把顺序旋转为 `[B, C, D, A]`，断言选择 B：

```ts
const ids = ['quest-age-a', 'quest-age-b', 'quest-age-c', 'quest-age-d']
const candidates = ids.map((questId) => withQuest(quests[0], {
  questId,
  timeCost: 10,
  energyLevel: 1,
  goalIds: ['relax'],
}))
const drawWithRecent = (recentQuestIds: string[]) => matchQuest(candidates, basePreference, {
  ...emptyContext,
  seed: 'oldest-first',
  recentQuestIds,
})
const first = drawWithRecent(ids)
const rotated = drawWithRecent([...ids.slice(1), ids[0]])
expect(first.kind === 'match' && first.quest.questId).toBe(ids[0])
expect(rotated.kind === 'match' && rotated.quest.questId).toBe(ids[1])
```

- [ ] **Step 5: 实现位置相关近期衰减**

用最新位置计算分数，不依赖真实时间：

```ts
function recencyScore(questId: string, recentIds: readonly string[]): number {
  const index = recentIds.lastIndexOf(questId)
  if (index < 0) return 30
  const age = recentIds.length - 1 - index
  return -220 + age * 30
}
```

在 `scoreQuest` 中以 `recencyScore` 替换现有二元 `+30/0`。最新任务为 -220，越旧每个位置恢复 30 分；8 项窗口中最旧任务为 -10。相邻位置差 30，大于 25 分质量带，因此 recent-relaxed 首先选择最久未见候选。

- [ ] **Step 6: 把质量带从 15 扩为 25并重跑测试**

```ts
const qualityBand = 25
```

Run: `pnpm test`

Expected: PASS，包括既有 seed、硬过滤、放宽顺序以及新增两项多样性测试。

- [ ] **Step 7: 只读检查点**

Run: `git diff --check -- projects/08-earth-online`

Expected: 无输出；不得执行 Git 写操作。

---

### Task 2: 增加最近类别疲劳和可解释文案

**Files:**
- Modify: `projects/08-earth-online/src/domain/matcher.test.ts`
- Modify: `projects/08-earth-online/src/domain/matcher.ts`
- Modify: `projects/08-earth-online/src/content/schema.ts`
- Modify: `projects/08-earth-online/src/content/content.json`
- Modify: `projects/08-earth-online/src/content/content.test.ts`

**Interfaces:**
- Consumes: recent ID 顺序、候选任务类别、`UiContent.matching.positive`。
- Produces: 最近 4 次同类每次 -15；`positive.fresh`、`positive.variety` 推荐理由。

- [ ] **Step 1: 写类别疲劳失败测试**

构造两个除类别外同分的候选；recent 最后两项均为候选 A 的类别，使累计惩罚 -30，超过 25 分质量带：

```ts
it('moves a repeatedly offered category outside the quality band', () => {
  const sameCategory = withQuest(quests[0], { questId: 'quest-same-category', category: 'rest', timeCost: 10, energyLevel: 1, goalIds: ['relax'] })
  const variedCategory = withQuest(quests[0], { questId: 'quest-varied-category', category: 'observe', timeCost: 10, energyLevel: 1, goalIds: ['relax'] })
  const recentFixtures = [
    withQuest(quests[0], { questId: 'quest-recent-rest-a', category: 'rest' }),
    withQuest(quests[0], { questId: 'quest-recent-rest-b', category: 'rest' }),
  ]
  const result = matchQuest([...recentFixtures, sameCategory, variedCategory], basePreference, {
    ...emptyContext,
    recentQuestIds: recentFixtures.map(({ questId }) => questId),
  })
  expect(result.kind).toBe('match')
  if (result.kind === 'match') expect(result.quest.questId).toBe(variedCategory.questId)
})
```

- [ ] **Step 2: 运行测试确认 RED**

Run: `pnpm test`

Expected: FAIL，旧评分只看上一条历史类别，不从 recent offers 推导类别疲劳。

- [ ] **Step 3: 实现最近 4 次类别计数**

在 `matchQuest` 内建立 ID 索引并把类别计数传给评分：

```ts
const questsById = new Map(quests.map((quest) => [quest.questId, quest]))
const recentCategoryIds = recentIds
  .slice(-4)
  .flatMap((id) => questsById.get(id)?.category ?? [])

function categoryFatigueScore(category: QuestCategory, recentCategoryIds: readonly QuestCategory[]): number {
  return -15 * recentCategoryIds.filter((id) => id === category).length
}
```

保留既有上一条历史类别 -10，二者用途不同：history 表示最近处理结果，recent 表示最近曝光。

- [ ] **Step 4: 写类型化解释文案失败测试**

扩展内容测试的 key 契约：

```ts
expect(Object.keys(content.content.ui.matching.positive)).toEqual([
  'goal', 'time', 'solo', 'optional', 'fresh', 'variety',
])
```

在 matcher 测试断言非近期任务含 `fresh`；与最近类别不同且 recent 非空时含 `variety`。

- [ ] **Step 5: 扩展 Schema、内容与理由生成**

```ts
positive: {
  goal: string
  time: string
  solo: string
  optional: string
  fresh: string
  variety: string
}
```

`content.json` 使用：

```json
"fresh": "这项支线近期没有出现过",
"variety": "这次换了一类冒险体验"
```

`positiveReasons` 只有在事实成立时追加文案，不得声称绝对不重复。

```ts
if (!recent.has(quest.questId)) reasons.push(copy.positive.fresh)
if (recentCategoryIds.length > 0 && !recentCategoryIds.includes(quest.category)) reasons.push(copy.positive.variety)
```

- [ ] **Step 6: 重跑测试并检查硬条件回归**

Run: `pnpm test`

Expected: PASS；安全、时间、精力、环境、社交、预算和 seed 测试保持绿色。

- [ ] **Step 7: 只读检查点**

Run: `git diff --check -- projects/08-earth-online`

Expected: 无输出。

---

### Task 3: 建立不依赖任务档案的 archive requirement inspector

**Files:**
- Create: `projects/08-earth-online/src/storage/archive-requirement.ts`
- Create: `projects/08-earth-online/src/storage/archive-requirement.test.ts`

**Interfaces:**
- Consumes: `Pick<Storage, 'getItem'>`、current active `ReadonlyMap<string, Quest>`。
- Produces: `storageNeedsArchive(storage, activeById): boolean`。

- [ ] **Step 1: 写条件矩阵失败测试**

测试以下输入：

```ts
const active = content.content.tasks[0]
const activeById = new Map([[active.questId, active]])
const storage = (value?: unknown): Pick<Storage, 'getItem'> => ({
  getItem: () => value === undefined ? null : typeof value === 'string' ? value : JSON.stringify(value),
})
const v2 = (data: Record<string, unknown>) => ({ schemaVersion: 2, contentVersion: '2.0.0', updatedAt: '2026-08-29T00:00:00.000Z', data })
const emptyStorage = storage()
const invalidJsonStorage = storage('{')
const schema1Storage = storage({ schemaVersion: 1, contentVersion: '1.0.0', updatedAt: '2026-08-28', data: {} })
const futureSchemaStorage = storage({ schemaVersion: 99, contentVersion: '99.0.0', updatedAt: '2026-08-29', data: {} })
const currentV2Storage = storage(v2({ activeQuest: { questId: active.questId, questContentVersion: active.contentVersion }, completedQuestIds: [] }))
const oldActiveV2Storage = storage(v2({ activeQuest: { questId: active.questId, questContentVersion: '1.0.0' }, completedQuestIds: [] }))
const oldCompletedIdV2Storage = storage(v2({ completedQuestIds: ['quest-retired-id'] }))

expect(storageNeedsArchive(emptyStorage, activeById)).toBe(false)
expect(storageNeedsArchive(invalidJsonStorage, activeById)).toBe(false)
expect(storageNeedsArchive(schema1Storage, activeById)).toBe(true)
expect(storageNeedsArchive(futureSchemaStorage, activeById)).toBe(false)
expect(storageNeedsArchive(currentV2Storage, activeById)).toBe(false)
expect(storageNeedsArchive(oldActiveV2Storage, activeById)).toBe(true)
expect(storageNeedsArchive(oldCompletedIdV2Storage, activeById)).toBe(true)
```

其中 current v2 active 必须同时匹配 ID 和 `questContentVersion`；历史快照本身不触发 archive。

- [ ] **Step 2: 运行测试确认 RED**

Run: `pnpm test`

Expected: FAIL，模块不存在。

- [ ] **Step 3: 实现最小只读解析器**

```ts
export function storageNeedsArchive(
  storage: Pick<Storage, 'getItem'>,
  activeById: ReadonlyMap<string, Quest>,
): boolean {
  const raw = storage.getItem(STORAGE_KEY)
  if (raw === null) return false
  let envelope: unknown
  try { envelope = JSON.parse(raw) } catch { return false }
  if (!isRecord(envelope) || typeof envelope.schemaVersion !== 'number') return false
  if (envelope.schemaVersion === 1) return true
  if (envelope.schemaVersion !== STORAGE_SCHEMA_VERSION || !isRecord(envelope.data)) return false

  const active = envelope.data.activeQuest
  if (isRecord(active) && typeof active.questId === 'string') {
    const current = activeById.get(active.questId)
    if (!current || active.questContentVersion !== current.contentVersion) return true
  }
  if (Array.isArray(envelope.data.completedQuestIds) && envelope.data.completedQuestIds.some((id) => typeof id === 'string' && !activeById.has(id))) return true
  return false
}
```

未来 schema 仍交给现有 `loadState` 报错，不加载 archive；inspector 不解释历史快照，也不修改 envelope。

- [ ] **Step 4: 补充“不改变原存储”断言并重跑测试**

测试 storage 的原始字符串在调用前后完全相同。

Run: `pnpm test`

Expected: PASS。

- [ ] **Step 5: 只读检查点**

Run: `git diff --check -- projects/08-earth-online`

Expected: 无输出。

---

### Task 4: 用 Vite 虚拟模块从单一 JSON 源拆分 current 与 archive

**Files:**
- Create: `projects/08-earth-online/vite.content-plugin.ts`
- Create: `projects/08-earth-online/vite.content-plugin.test.ts`
- Modify: `projects/08-earth-online/vite.config.ts`
- Modify: `projects/08-earth-online/vite.minitool.config.ts`
- Modify: `projects/08-earth-online/tsconfig.node.json`
- Create: `projects/08-earth-online/src/content/virtual-content.d.ts`

**Interfaces:**
- Produces: `buildEarthContentModules({ archiveMode: 'lazy' | 'eager' }): ReadonlyMap<string, string>`，供纯单元测试验证内容边界。
- Produces: `createEarthContentPlugin({ archiveMode: 'lazy' | 'eager' }): Plugin`，只负责把上述 module source 暴露给 Vite。
- Produces virtual modules: `virtual:earth-current-content`、`virtual:earth-archive-content`、`virtual:earth-archive-loader`。
- Loader export: `loadQuestArchive(): Promise<QuestArchiveContent>`。

- [ ] **Step 1: 写插件失败测试**

直接调用纯函数构造的 module source，避免在测试里伪造 Vite plugin context：

```ts
const lazy = buildEarthContentModules({ archiveMode: 'lazy' })
expect(lazy.get('virtual:earth-current-content')).not.toContain('一分钟不回任何消息')
expect(lazy.get('virtual:earth-archive-content')).toContain('一分钟不回任何消息')
expect(lazy.get('virtual:earth-archive-loader')).toContain('import("virtual:earth-archive-content")')

const eager = buildEarthContentModules({ archiveMode: 'eager' })
expect(eager.get('virtual:earth-archive-loader')).toContain('import archive from "virtual:earth-archive-content"')
expect(eager.get('virtual:earth-archive-loader')).not.toContain('import("')
```

同时解析 current/archive 默认导出并断言 active=100、retired=0/20、legacy=0/80。

```ts
function parseDefaultExport(source: string | undefined): unknown {
  if (!source?.startsWith('export default ')) throw new Error('Expected a default-export virtual module')
  return JSON.parse(source.slice('export default '.length))
}
```

- [ ] **Step 2: 运行测试确认 RED**

Run: `pnpm test`

Expected: FAIL，插件模块不存在。

- [ ] **Step 3: 实现虚拟模块插件**

插件只在 Node 构建/开发期读取 `src/content/content.json`：

```ts
export function buildEarthContentModules({ archiveMode }: { archiveMode: 'lazy' | 'eager' }): ReadonlyMap<string, string> {
  const projectRoot = fileURLToPath(new URL('.', import.meta.url))
  const contentPath = resolve(projectRoot, 'src/content/content.json')
  const source = JSON.parse(readFileSync(contentPath, 'utf8')) as EarthOnlineContent
  const current = {
    ...source,
    content: { ...source.content, retiredTasks: [], legacyTasks: [] },
  }
  const archive = {
    retiredTasks: source.content.retiredTasks,
    legacyTasks: source.content.legacyTasks,
  }

  return new Map([
    ['virtual:earth-current-content', `export default ${JSON.stringify(current)}`],
    ['virtual:earth-archive-content', `export default ${JSON.stringify(archive)}`],
    ['virtual:earth-archive-loader', archiveMode === 'lazy'
      ? 'export async function loadQuestArchive(){return (await import("virtual:earth-archive-content")).default}'
      : 'import archive from "virtual:earth-archive-content"; export async function loadQuestArchive(){return archive}'],
  ])
}

export function createEarthContentPlugin(options: { archiveMode: 'lazy' | 'eager' }): Plugin {
  const modules = buildEarthContentModules(options)
  return {
    name: 'earth-online-content-split',
    resolveId(id) { return modules.has(id) ? `\0${id}` : undefined },
    load(id) { return id.startsWith('\0') ? modules.get(id.slice(1)) : undefined },
  }
}
```

插件不得写生成文件。

- [ ] **Step 4: 接入两个 Vite 配置**

标准配置：

```ts
plugins: [createEarthContentPlugin({ archiveMode: 'lazy' }), react()]
```

minitool 配置：

```ts
plugins: [createEarthContentPlugin({ archiveMode: 'eager' }), removeUnavailableReactConnectionProbe(), react(), emitMinitoolHtml()]
```

更新 `tsconfig.node.json` include：

```json
"include": ["vite.config.ts", "vite.minitool.config.ts", "vite.content-plugin.ts"]
```

- [ ] **Step 5: 添加虚拟模块类型**

```ts
declare module 'virtual:earth-current-content' {
  import type { EarthOnlineContent } from './schema'
  const content: EarthOnlineContent
  export default content
}

declare module 'virtual:earth-archive-content' {
  import type { Quest } from './schema'
  const archive: { retiredTasks: Quest[]; legacyTasks: Quest[] }
  export default archive
}

declare module 'virtual:earth-archive-loader' {
  import type { Quest } from './schema'
  export function loadQuestArchive(): Promise<{ retiredTasks: Quest[]; legacyTasks: Quest[] }>
}
```

- [ ] **Step 6: 重跑测试和类型构建**

Run: `pnpm test`

Expected: PASS。

Run: `pnpm build`

Expected at this task: build may still keep full JSON because App has not switched imports；插件本身和 config 必须成功编译。

- [ ] **Step 7: 只读检查点**

Run: `git diff --check -- projects/08-earth-online`

Expected: 无输出。

---

### Task 5: 建立按需 archive bootstrap，并保持失败恢复语义

**Files:**
- Create: `projects/08-earth-online/src/app/bootstrap.ts`
- Create: `projects/08-earth-online/src/app/bootstrap.test.ts`
- Modify: `projects/08-earth-online/src/App.tsx`
- Modify: `projects/08-earth-online/src/main.tsx`
- Modify: `projects/08-earth-online/src/app/view-model.ts`
- Modify: `projects/08-earth-online/src/app/view-model.test.ts`

**Interfaces:**
- Produces: `prepareRuntime(storage, archiveLoader?): Promise<PreparedRuntime>`。
- `PreparedRuntime`: `{ status: 'ready' | 'archive-error'; content: EarthOnlineContent; catalog: QuestCatalog }`。
- `AppProps`: `{ content: EarthOnlineContent; catalog: QuestCatalog; bootstrapError?: 'archive-load' }`。

- [ ] **Step 1: 写 bootstrap 是否调用 loader 的失败测试**

注入计数 loader，不 mock 模块系统：

```ts
it('does not load archive for empty or current v2 storage', async () => {
  const content = rawContent as unknown as EarthOnlineContent
  const fullArchive = { retiredTasks: content.content.retiredTasks, legacyTasks: content.content.legacyTasks }
  const emptyStorage = memoryStorage()
  const currentV2Storage = memoryStorage(JSON.stringify({
    schemaVersion: 2,
    contentVersion: content.contentVersion,
    updatedAt: '2026-08-29T00:00:00.000Z',
    data: { activeQuest: undefined, completedQuestIds: [] },
  }))
  let calls = 0
  const loader = async () => { calls += 1; return fullArchive }
  expect((await prepareRuntime(emptyStorage, loader)).status).toBe('ready')
  expect((await prepareRuntime(currentV2Storage, loader)).status).toBe('ready')
  expect(calls).toBe(0)
})

it('loads archive for v1 and old active tasks', async () => {
  const content = rawContent as unknown as EarthOnlineContent
  const fullArchive = { retiredTasks: content.content.retiredTasks, legacyTasks: content.content.legacyTasks }
  const schema1Storage = memoryStorage(JSON.stringify({ schemaVersion: 1, contentVersion: '1.0.0', updatedAt: '2026-08-28T00:00:00.000Z', data: {} }))
  let calls = 0
  const loader = async () => { calls += 1; return fullArchive }
  const runtime = await prepareRuntime(schema1Storage, loader)
  expect(calls).toBe(1)
  expect(runtime.catalog.resolve('quest-rest-name-enough', '1.0.0')?.xp).toBe(20)
})

function memoryStorage(initial: string | null = null): Pick<Storage, 'getItem'> {
  return { getItem: () => initial }
}
```

- [ ] **Step 2: 写加载失败不覆盖存储的失败测试**

```ts
const persisted = JSON.stringify({ schemaVersion: 1, contentVersion: '1.0.0', updatedAt: '2026-08-28', data: {} })
const storage = { getItem: () => persisted }
const before = storage.getItem(STORAGE_KEY)
const runtime = await prepareRuntime(storage, async () => { throw new Error('chunk unavailable') })
expect(runtime.status).toBe('archive-error')
expect(storage.getItem(STORAGE_KEY)).toBe(before)
```

- [ ] **Step 3: 运行测试确认 RED**

Run: `pnpm test`

Expected: FAIL，bootstrap 模块不存在。

- [ ] **Step 4: 实现 archive 合并和 prepareRuntime**

```ts
import currentContent from 'virtual:earth-current-content'
import { loadQuestArchive } from 'virtual:earth-archive-loader'

export async function prepareRuntime(
  storage: Pick<Storage, 'getItem'>,
  archiveLoader = loadQuestArchive,
): Promise<PreparedRuntime> {
  const currentCatalog = createQuestCatalog(currentContent)
  if (!storageNeedsArchive(storage, currentCatalog.activeById)) {
    return { status: 'ready', content: currentContent, catalog: currentCatalog }
  }
  try {
    const archive = await archiveLoader()
    const content = { ...currentContent, content: { ...currentContent.content, ...archive } }
    const validation = validateContent(content, 'production')
    if (!validation.ok) return { status: 'archive-error', content: currentContent, catalog: currentCatalog }
    return { status: 'ready', content, catalog: createQuestCatalog(content) }
  } catch {
    return { status: 'archive-error', content: currentContent, catalog: currentCatalog }
  }
}
```

不在 bootstrap 内调用 `loadState` 或写 localStorage；现有 App 初始化仍是唯一状态迁移入口。

- [ ] **Step 5: 把 App 改为显式依赖注入**

移除 `rawContent` 顶层 import 和全局 catalog：

```ts
type AppProps = {
  content: EarthOnlineContent
  catalog: QuestCatalog
  bootstrapError?: 'archive-load'
}

function App({ content, catalog, bootstrapError }: AppProps) {
  const [state, dispatch] = useReducer(
    appReducer,
    undefined,
    () => initializeState(content, catalog, bootstrapError),
  )
  // existing flow
}
```

`initializeState` 在 `bootstrapError` 存在时返回 `error.code='content'`，不得清除存储。`categoryName`、`preferenceSummary` 改为接收 content 参数。`createPageViewModel` 使用以下签名，App 传入 prepared catalog：

```ts
export function createPageViewModel(
  state: AppState,
  content: EarthOnlineContent,
  catalog: QuestCatalog = createQuestCatalog(content),
): PageViewModel
```

- [ ] **Step 6: 在 main 中异步准备并渲染**

```tsx
const root = createRoot(document.getElementById('root')!)
root.render(<StrictMode><main aria-busy="true">正在整理任务档案……</main></StrictMode>)

void prepareRuntime(window.localStorage).then((runtime) => {
  root.render(
    <StrictMode>
      <App
        content={runtime.content}
        catalog={runtime.catalog}
        bootstrapError={runtime.status === 'archive-error' ? 'archive-load' : undefined}
      />
    </StrictMode>,
  )
})
```

加载文案只描述本地准备，不声称联网。

- [ ] **Step 7: 重跑测试**

Run: `pnpm test`

Expected: PASS，包括 v1 同 ID 原 XP、App 状态恢复和新 bootstrap 测试。

- [ ] **Step 8: 只读检查点**

Run: `git diff --check -- projects/08-earth-online`

Expected: 无输出。

---

### Task 6: 验证标准 Web 拆包与 minitool 单包兼容

**Files:**
- Modify only if tests reveal a defect: `projects/08-earth-online/vite.content-plugin.ts`
- Modify only if tests reveal a defect: `projects/08-earth-online/vite.minitool.config.ts`
- Modify: `projects/08-earth-online/PREP_REPORT.md`

**Interfaces:**
- Standard build: current content in entry chunk, archive in one lazy chunk。
- Minitool build: current+archive eager 内联进唯一 IIFE。

- [ ] **Step 1: 构建标准 Web**

Run: `pnpm build`

Expected: PASS；输出至少 entry 与 archive 两个 JS chunk；不再出现 entry 超过 500 kB 的提示。

- [ ] **Step 2: 用只读命令验证内容边界**

从 `dist/index.html` 找到 entry JS：

```bash
rg -o 'assets/[^" ]+\.js' dist/index.html
```

断言旧标题样本“写下一件今日小胜利，并当场给它封爵”只存在于非 entry archive chunk；当前标题“十五分钟动作宾果”存在 entry chunk。不得只根据文件名猜测边界。

- [ ] **Step 3: 构建并验证 minitool**

Run only after product confirms this expanded validation: `pnpm build:minitool`

Expected: PASS，`dist-minitool/assets/app.js` 为唯一 JS。

Run only after product confirms this expanded validation: `pnpm validate:minitool`

Expected: PASS，输出 `minitool-valid`；无 dynamic import、fetch 或其他禁止能力。

- [ ] **Step 4: 若构建失败，按模式修复**

- 标准构建没有 archive chunk：检查 lazy loader 是否是字面量动态 import。
- entry 仍含旧标题：检查 App 是否仍直接或间接 import `content.json`。
- minitool 报 dynamic import：检查 eager loader 源码是否完全不含 `import(`。
- minitool 多 JS：确认 eager plugin 在 minitool config 中位于 React plugin 前且 loader 使用静态 import。

每次修复后重新运行 Step 1–3，不修改共享配置或依赖。

- [ ] **Step 5: 更新 PREP_REPORT 构建证据**

记录：entry/archive 文件的 raw/gzip 体积、干净用户加载边界、v1 兼容、minitool 单包结果和 matcher 新评分。不得预填未实际测得的数字。

- [ ] **Step 6: 只读检查点**

Run: `git diff --check -- projects/08-earth-online`

Expected: 无输出。

---

### Task 7: 浏览器验收和最终验证

**Files:**
- Modify only if evidence differs: `projects/08-earth-online/PREP_REPORT.md`

**Interfaces:**
- Consumes最终构建产物。
- Produces可复查的网络、迁移、响应式和构建证据。

- [ ] **Step 1: 启动本地 preview 并验证干净用户**

清空 localStorage 后加载页面，通过浏览器请求列表确认：

- current entry 和 CSS 正常加载；
- archive chunk 未请求；
- 领取与换任务可用；
- 相同偏好连续领取/换一个 8 次，在候选充足时 ID 不重复。

- [ ] **Step 2: 注入 v1 同 ID 旧任务并刷新**

使用 `quest-rest-name-enough` v1 fixture：

- archive chunk 被请求一次；
- 页面显示旧标题、旧步骤、“经典任务”和 20 XP；
- 完成后只奖励 20 XP；
- localStorage 写回 schemaVersion 2，历史快照为 contentVersion 1.0.0。

- [ ] **Step 3: 验证 archive 失败恢复**

在浏览器路由或 request interception 中让 archive chunk 失败，确认进入内容恢复页，原 storage 字符串完全不变；恢复请求后刷新可重新进入旧任务。

- [ ] **Step 4: 响应式与安全区**

在 375×812、390×844、430×932 检查 `html/body.scrollWidth === innerWidth`。430px 设置：

```js
document.documentElement.style.setProperty('--safe-area-inset-top', '32px')
```

确认 `.safe-header` top=32px，`.page-heading` top 不小于 header bottom，任务文案与动作无横向溢出。

- [ ] **Step 5: 最终三项自动验证**

Run: `pnpm lint`

Expected: exit 0。

Run: `pnpm test`

Expected: 所有测试通过，0 failures。

Run: `pnpm build`

Expected: exit 0，entry 不再包含 legacy 数据，记录实际体积。

- [ ] **Step 6: 最终限定目录检查**

Run:

```bash
git diff --check -- projects/08-earth-online
git diff --name-only -- projects/08-earth-online
git diff --stat -- projects/08-earth-online
git status --short -- projects/08-earth-online
```

Expected: diff-check 无输出；所有变更均位于 `projects/08-earth-online/**`；没有 Playwright 临时快照、生成内容副本或共享文件变更。
