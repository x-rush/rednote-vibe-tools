# 地球 Online 基础能力实施计划

> **执行要求：** 按任务顺序在当前会话内执行；每项均采用 RED → GREEN → REFACTOR。禁止 Git 写操作。

**目标：** 交付 100 条安全现实任务、确定性匹配与回退、完整任务生命周期及奖励、本地恢复、语义页面骨架、测试和准备报告。

**架构：** 业务逻辑由无副作用 TypeScript 函数组成，React 只消费 reducer 与 ViewModel。静态业务内容只来自 `src/content/content.json`；localStorage 保存当前恢复状态，IndexedDB 保存结构化长期日志并允许明确降级。

**技术栈：** React 19、TypeScript 6、Vite 8、Vitest 4、浏览器 localStorage/IndexedDB；不增加依赖。

**规格：** `projects/08-earth-online/DESIGN.md`

## 全局约束

- 只修改 `projects/08-earth-online/**`。
- 不修改根配置、锁文件、共享 docs、prep 或其他项目。
- 不安装、升级或删除依赖。
- 不执行 add、commit、push、branch 等 Git 写操作。
- 业务内容只写入 `src/content/content.json`，JSX 不硬编码任务业务内容。
- 纯静态前端，不使用后端、远程运行时 API、定位、Service Worker 或设备 API。
- 不保存图片、Base64、音视频、Blob、位置或完成证明。
- 最终只运行项目内 `pnpm lint`、`pnpm test`、`pnpm build`。

---

### 任务 1：冻结内容类型与运行时校验接口

**文件：**

- 创建：`src/content/schema.ts`
- 创建：`src/content/validate.ts`
- 创建：`src/content/validate.test.ts`
- 修改：`src/content/content.test.ts`

**接口：**

```ts
export type QuestCategory = 'rest' | 'tidy' | 'observe' | 'move' | 'create' | 'learn' | 'connect' | 'kind' | 'digital' | 'adventure'
export type TimeCost = 5 | 10 | 15 | 20
export type EnergyLevel = 1 | 2 | 3
export type LocationCondition = 'any-safe-place' | 'familiar-indoor' | 'familiar-public-area'
export type SocialLevel = 'solo' | 'optional' | 'required'
export type QuestPreference = { minutes: TimeCost; energy: EnergyLevel; environment: 'indoor' | 'outdoor'; social: 'none' | 'optional'; spend: 'none' | 'allowed'; timeOfDay: 'day' | 'night'; location: LocationCondition; goalId: string; excludedConditions: string[] }
export type QuestMatch = { quest: Quest; score: number; stage: MatchStage; reasons: string[]; relaxed: string[]; nextSeed: number }
export type ActiveQuest = { acceptanceId: string; questId: string; acceptedAt: string; preference: QuestPreference }
export type CompletedQuest = { acceptanceId: string; questId: string; acceptedAt: string; completedAt: string; completionDate: string; xpAwarded: number }
export type AdventurerProfile = { xp: number; streak: StreakState; unlockedBadgeIds: string[] }
export type BadgeDefinition = { id: string; title: string; description: string; rule: BadgeRule; assetId: string; contentVersion: string }
export type StoragePayload = { preference: QuestPreference; offeredQuestId?: string; activeQuest?: ActiveQuest; recentQuestIds: string[]; completedQuestIds: string[]; history: QuestHistoryEntry[]; xp: number; streak: StreakState; unlockedBadgeIds: string[]; rngState: number }
export function validateContent(input: unknown, mode?: 'envelope' | 'production'): ValidationResult
```

- [ ] 写失败测试：空对象必须返回带 `$` 路径的 envelope 错误；非法枚举、缺安全标签、错误 asset ID、缺徽章引用和不可匹配任务必须在 production 模式失败。
- [ ] 运行 `pnpm test -- src/content/validate.test.ts`，确认因模块不存在失败。
- [ ] 实现上述类型、枚举集合和递归白名单校验；校验器返回 `{ ok: boolean; issues: { path: string; message: string }[] }`，不抛出不可恢复异常。
- [ ] 重跑测试，确认通过；再运行现有内容测试确认 scaffold 仍被 envelope 模式接受。

### 任务 2：录入并验收首发 100 条任务

**文件：**

- 修改：`src/content/content.json`
- 修改：`src/content/content.test.ts`

**内容形状：**

```json
{
  "schemaVersion": 1,
  "contentVersion": "1.0.0",
  "projectId": "earth-online",
  "meta": { "title": "地球 Online：冒险者公会大厅", "locale": "zh-CN", "updatedAt": "2026-08-23" },
  "sources": [{ "id": "source-earth-online-quests-v1", "title": "首发 100 任务与数据契约", "license": "project-authored" }],
  "content": { "categories": [], "goals": [], "badges": [], "tasks": [], "filters": [], "cooldown": {}, "fallback": {}, "safetyRules": [] }
}
```

- [ ] 写失败测试：断言 production 校验成功、任务恰好 100、全局 ID 唯一、十类各 10 条、所有任务 0 元、户外/运动/数字任务安全标签完整、asset ID 统一、徽章引用存在。
- [ ] 写 12 组黄金偏好的表驱动测试数据，逐组断言内容池至少有一个满足不可放宽硬条件的任务。
- [ ] 运行 `pnpm test -- src/content/content.test.ts`，确认 scaffold 的 0 条任务导致预期失败。
- [ ] 将 `docs/08-地球Online/24-地球Online首发100任务与数据契约.md` 的 100 个稳定 ID 与标题机械转写；逐条补齐 DESIGN.md 规定的扩展字段和 2–4 个可执行步骤，不润色权威标题。
- [ ] 加入 10 类、目标、徽章、安全规则、冷却与回退配置；保证业务文案不散落到 TypeScript。
- [ ] 重跑内容测试并输出实际类别、等级、时间、精力和环境分布，修复全部校验问题。

### 任务 3：实现 seed、硬过滤、评分与逐级放宽

**文件：**

- 创建：`src/domain/random.ts`
- 创建：`src/domain/matcher.ts`
- 创建：`src/domain/matcher.test.ts`

**接口：**

```ts
export function hashSeed(seed: string | number): number
export function nextRandom(state: number): { value: number; state: number }
export type MatchContext = { seed: string | number; nowDate: string; recentQuestIds: string[]; completed: CompletedQuest[]; abandoned: QuestHistoryEntry[]; previousCategoryIds: QuestCategory[] }
export function matchQuest(quests: Quest[], preference: QuestPreference, context: MatchContext): QuestMatch | NoMatch
```

- [ ] 写失败测试：相同 seed 返回同一任务，不同换取状态可返回另一任务；分钟、精力、地点、昼夜、预算、安全、不社交和室内/户外硬条件均不能被评分突破。
- [ ] 写失败测试：近期展示去重；目标放宽、精力贴合放宽、近期放宽和安全回退依序发生，返回的 `stage`、`reasons` 与 `relaxed` 准确。
- [ ] 写失败测试：构造只有危险任务的池，断言返回 `no-match`，证明安全条件永不放宽。
- [ ] 运行 `pnpm test -- src/domain/matcher.test.ts`，确认因模块不存在失败。
- [ ] 实现 FNV-1a 与整数 PRNG；对候选 ID 排序后选择，消除 JSON 数组顺序对复现性的影响。
- [ ] 实现硬谓词、五阶段候选、整数评分、最高分组 seed 选择和中文解释。
- [ ] 重跑 matcher 测试；对每个现实变异点做心智 mutation check：移除某个硬谓词时必须有测试失败。

### 任务 4：实现任务生命周期、XP、等级、连续记录、徽章与档案

**文件：**

- 创建：`src/domain/progression.ts`
- 创建：`src/domain/quests.ts`
- 创建：`src/domain/progression.test.ts`
- 创建：`src/domain/quests.test.ts`

**接口：**

```ts
export function levelFromXp(xp: number): LevelProgress
export function updateStreak(streak: StreakState, completionDate: string): StreakState
export function unlockedBadges(definitions: BadgeDefinition[], summary: ProgressSummary, currentIds: string[]): string[]
export function createProfileViewModel(profile: AdventurerProfile, definitions: BadgeDefinition[], history: QuestHistoryEntry[]): AdventurerProfileViewModel
export function offerQuest(state: GuildDomainState, match: QuestMatch, offeredAt: string): GuildDomainState
export function acceptQuest(state: GuildDomainState, acceptedAt: string): GuildDomainState
export function swapQuest(state: GuildDomainState, match: QuestMatch, swappedAt: string): GuildDomainState
export function abandonQuest(state: GuildDomainState, abandonedAt: string): GuildDomainState
export function completeQuest(state: GuildDomainState, quest: Quest, badges: BadgeDefinition[], completedAt: string, completionDate: string): CompletionResult
export function summarizeHistory(history: QuestHistoryEntry[], questsById: ReadonlyMap<string, Quest>): QuestHistorySummary
```

- [ ] 写失败测试：领取不奖励、接受幂等、换任务记录旧 offer、放弃不扣分、同一 acceptanceId 完成两次只奖励一次。
- [ ] 写失败测试：XP 在 99/100/299/300/599/600 的等级边界；同日、隔日、跨月、跨年和断档连续记录。
- [ ] 写失败测试：首次、累计数、连续天数、类别数和等级徽章只解锁一次；历史摘要忽略缺失内容引用但保留数量。
- [ ] 运行两个测试文件，确认因实现缺失失败。
- [ ] 实现纯函数，不读取 Date、Math.random、localStorage 或 React 状态；所有时间由参数传入。
- [ ] 重跑两个测试文件，确认生命周期与奖励测试通过。

### 任务 5：实现版本化本地存储和 IndexedDB 日志接口

**文件：**

- 创建：`src/storage/storage.ts`
- 创建：`src/storage/storage.test.ts`
- 创建：`src/storage/adventure-log.ts`
- 创建：`src/storage/adventure-log.test.ts`

**接口：**

```ts
export const STORAGE_KEY = 'xhs-tool:earth-online:state:v1'
export type StorageEnvelope = { schemaVersion: 1; contentVersion: string; updatedAt: string; data: StoragePayload }
export function loadState(storage: Pick<Storage, 'getItem'>, validQuestIds: ReadonlySet<string>): StorageLoadResult
export function saveState(storage: Pick<Storage, 'setItem'>, envelope: StorageEnvelope): StorageSaveResult
export function clearState(storage: Pick<Storage, 'removeItem'>): void
export interface AdventureLogRepository { list(limit?: number): Promise<QuestHistoryEntry[]>; append(entry: QuestHistoryEntry): Promise<void>; recordFeedback(questId: string, status: 'swapped' | 'abandoned', at: string): Promise<void>; clear(): Promise<void> }
export function createIndexedDbAdventureLog(indexedDb: IDBFactory): AdventureLogRepository
```

- [ ] 写失败测试：截断 JSON、未来版本、错误字段类型、失效 quest ID、超大历史、setItem 配额异常均返回明确结果且不白屏。
- [ ] 写失败测试：保存 envelope 不含 `data:`, `base64`, `blob`, `latitude`, `longitude`, `image`, `proof` 等媒体/位置/证明字段；历史截为最近 100 条，推荐截为最近 10 条。
- [ ] 使用最小内存 IDBFactory 替身验证仓储调用契约；不对替身本身断言，只断言 append/list/feedback/clear 的可见行为。
- [ ] 运行存储测试，确认模块缺失导致失败。
- [ ] 实现 localStorage 严格读取与 IndexedDB 两 store 仓储；打开失败转换成可识别 `storage-unavailable` 错误。
- [ ] 重跑存储测试，确认损坏恢复和隐私边界通过。

### 任务 6：实现应用 reducer 与刷新恢复

**文件：**

- 创建：`src/app/state.ts`
- 创建：`src/app/state.test.ts`

**接口：**

```ts
export type PageState = 'guildHall' | 'preferenceSelect' | 'questOffer' | 'questAccepted' | 'questComplete' | 'questAbandoned' | 'adventurerProfile' | 'questHistory' | 'badgeList' | 'error'
export type AppAction =
  | { type: 'OPEN_PREFERENCES' }
  | { type: 'OFFER_CREATED'; state: GuildDomainState }
  | { type: 'QUEST_ACCEPTED'; state: GuildDomainState }
  | { type: 'QUEST_SWAPPED'; state: GuildDomainState }
  | { type: 'QUEST_COMPLETED'; result: CompletionResult }
  | { type: 'QUEST_ABANDONED'; state: GuildDomainState }
  | { type: 'NAVIGATE'; page: 'guildHall' | 'adventurerProfile' | 'questHistory' | 'badgeList' }
  | { type: 'RESTORE'; payload: StoragePayload }
  | { type: 'FAIL'; message: string; recoverable: boolean }
  | { type: 'RESET' }
export function appReducer(state: AppState, action: AppAction): AppState
export function restorePage(payload: StoragePayload): PageState
```

- [ ] 写失败测试：覆盖十个页面状态、正常领取链、换一个、放弃、完成、查看档案、今日已有 offer/active 的刷新恢复、无匹配和损坏错误。
- [ ] 写失败测试：完成 action 重放不会重复加 XP；非法 action 顺序保持安全状态并返回可解释错误。
- [ ] 运行 reducer 测试，确认模块缺失导致失败。
- [ ] 实现判别联合 reducer 与恢复优先级：active → offered → guild hall。
- [ ] 重跑 reducer 测试，确认完整状态转换通过。

### 任务 7：接入语义页面骨架和移动端基础样式

**文件：**

- 修改：`src/App.tsx`
- 修改：`src/App.css`
- 修改：`src/index.css`
- 创建：`src/app/view-model.ts`
- 创建：`src/app/view-model.test.ts`

**页面结构：**

```text
header：产品名、等级与 XP 入口
nav：公会大厅、冒险日志、徽章、档案
main：当前 PageState 对应 section
footer：本地运行、无定位、无上传证明说明
```

- [ ] 写失败测试：ViewModel 对十种状态均返回标题、说明、主操作和可用导航；任务页文案来自 content/Quest，不在 ViewModel 复制任务文案。
- [ ] 运行 `pnpm test -- src/app/view-model.test.ts`，确认模块缺失失败。
- [ ] 实现 ViewModel，并将 App 改为 useReducer 驱动的可操作纵向流程；错误/无匹配均提供返回偏好或重置入口。
- [ ] 实现克制的公会告示板基础样式，使用 CSS 形状与文字，不生成最终插画或 emoji 徽章；触控目标至少 44px。
- [ ] 用构建后的页面在 375、390、430 CSS px 检查 `document.documentElement.scrollWidth <= innerWidth`，并确认首页、偏好、任务、档案、历史和错误页无横向溢出。
- [ ] 重跑 ViewModel 测试和完整测试集。

### 任务 8：准备报告、全量验证与限定 diff

**文件：**

- 创建：`PREP_REPORT.md`

- [ ] 从 production 校验和测试输出记录 100 任务总数、十类分布、等级/时间/精力/环境分布，不手工猜数。
- [ ] 记录匹配评分、永不放宽条件、五级放宽顺序、seed 规则、XP/等级公式、连续记录、徽章接口、Storage schema、12 组黄金条件结果和后续 UI/美术需求。
- [ ] 在项目目录运行 `pnpm lint`，记录退出码和摘要。
- [ ] 在项目目录运行 `pnpm test`，记录测试文件数、测试数、失败数和退出码。
- [ ] 在项目目录运行 `pnpm build`，记录 TypeScript 与 Vite 构建结果。
- [ ] 运行 `git diff --check -- projects/08-earth-online`、`git diff --name-only -- projects/08-earth-online` 和 `git diff --stat -- projects/08-earth-online`；另用 `git status --short -- projects/08-earth-online` 纳入未跟踪文件清单。
- [ ] 对照用户的内容、匹配、游戏化、安全、状态、存储、页面和 22 项测试要求逐条复核；有缺口则继续 RED → GREEN 修复并重新执行三条验收命令。
