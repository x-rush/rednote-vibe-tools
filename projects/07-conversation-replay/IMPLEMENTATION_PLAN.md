# 当时这样说就好了 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成一个纯前端、全选项驱动、可解释匹配且具备安全回退的沟通复盘 MVP 基础实现。

**Architecture:** `content.json` 是唯一业务内容源；类型化读取器负责运行时校验，纯函数负责筛选、匹配和 ViewModel，reducer 负责页面状态，浏览器存储适配器只持久化结构化 ID 与有限结果。React 页面只消费 ViewModel，并提供可走通的语义骨架。

**Tech Stack:** React 19、TypeScript 6、Vite 8、Vitest 4、浏览器 localStorage/IndexedDB。

**Spec:** `PROJECT_BRIEF.md` 及仓库冻结资料 `docs/00-总控与共用/31-八项目内容封装Schema与测试样本.md`、`docs/07-对话复盘/23-对话复盘首发内容与数据契约.md`、`docs/07-对话复盘/25-对话复盘32组完整情境库.md`。

## Global Constraints

- 只修改 `projects/07-conversation-replay/**`，不修改共享配置与锁文件，不执行 Git 写操作。
- 不新增依赖；纯前端、无后端、无运行时外部 API、无用户媒体存储。
- 业务文案只存在于 `src/content/content.json`，组件只消费类型化 ViewModel。
- 全流程由选项驱动，不分析自由文本；高风险输入进入安全提示。
- 完成后运行 `pnpm lint`、`pnpm test`、`pnpm build`，并检查 375/390/430 CSS px。

---

### Task 1: 内容契约与运行时校验

**Files:**
- Create: `src/domain/types.ts`
- Create: `src/content/validate.ts`
- Modify: `src/content/content.test.ts`
- Modify: `src/content/content.json`

**Interfaces:**
- Produces: `ConversationContentPackage`、`ConversationScenario` 等领域类型，以及 `validateContent(input): ValidationResult`、`parseContent(input): ConversationContentPackage`。

- [x] **Step 1: 写失败测试**：断言生产包恰好有 32 个情境、48 个感受、48 个需要，ID 唯一，引用完整，三语气和下一步完整，高风险情境具备安全提示。
- [x] **Step 2: 运行 `pnpm test src/content/content.test.ts`，确认因空内容和缺失校验器失败。**
- [x] **Step 3: 定义枚举、实体类型和路径化校验错误，实现最小校验器。**
- [x] **Step 4: 将冻结内容机械封装为唯一 `content.json`，补齐 32 个情境的结构化字段和引用。**
- [x] **Step 5: 重跑内容测试并保持通过。**

### Task 2: 确定性筛选、风险匹配与 fallback

**Files:**
- Create: `src/domain/matching.ts`
- Create: `src/domain/matching.test.ts`

**Interfaces:**
- Consumes: `ConversationScenario`、`ReplayAnswers`。
- Produces: `filterByRelationship`、`filterByGoal`、`filterByConflictLevel`、`matchExpressionRisks`、`selectBestScenario` 与可解释的 `MatchExplanation`。

- [x] **Step 1: 写失败测试**：分别覆盖关系、目标、冲突筛选，情绪/原表达风险，稳定决胜和明确 fallback 顺序。
- [x] **Step 2: 运行目标测试，确认缺少模块导致失败。**
- [x] **Step 3: 实现无随机的过滤和整数评分；候选同分时按 `scenarioId` 排序。**
- [x] **Step 4: 实现逐层放宽 fallback，并返回匹配级别与原因。**
- [x] **Step 5: 重跑目标测试。**

### Task 3: ReplayResult 与复盘卡 ViewModel

**Files:**
- Create: `src/domain/result.ts`
- Create: `src/domain/result.test.ts`

**Interfaces:**
- Consumes: `ReplayAnswers`、匹配结果、内容索引。
- Produces: `buildReplayResult(answers, content): ReplayResult` 与 `buildReplayCardViewModel(result): ReplayCardViewModel`。

- [x] **Step 1: 写失败测试**：断言误解点、表达结构、柔和/直接/坚定版本、补一句、下次表达、下一步及分享摘要完整。
- [x] **Step 2: 写八组表驱动黄金路径和安全路径测试并确认失败。**
- [x] **Step 3: 实现结果与 ViewModel 纯函数；安全场景只输出安全优先建议。**
- [x] **Step 4: 重跑测试，并检查输出不含诊断式或操控式建议。**

### Task 4: 页面状态机

**Files:**
- Create: `src/state/replayState.ts`
- Create: `src/state/replayState.test.ts`

**Interfaces:**
- Produces: `ReplayState`、`ReplayAction`、`initialReplayState`、`replayReducer`。

- [x] **Step 1: 写失败测试**：覆盖 landing、intro、scenarioSelect、replayWizard、comparison、result、savedResults、safetyNotice、error。
- [x] **Step 2: 覆盖上一步、修改答案、重开、安全跳转和恢复结果，并确认失败。**
- [x] **Step 3: 实现 reducer，保证修改早期答案会清理不再有效的结果。**
- [x] **Step 4: 重跑状态测试。**

### Task 5: 本地结构化存储

**Files:**
- Create: `src/storage/storage.ts`
- Create: `src/storage/storage.test.ts`

**Interfaces:**
- Produces: `createStoragePayload`、`serializeStorage`、`restoreStorage`、`saveLocalState`、`loadLocalState`、`clearLocalState`、`SavedReplayRepository`。

- [x] **Step 1: 写失败测试**：覆盖正常恢复、损坏 JSON、未来 schema、无效引用、最多三条和禁止媒体字段。
- [x] **Step 2: 确认测试因存储模块缺失失败。**
- [x] **Step 3: 实现 localStorage envelope 与可注入存储接口；损坏时返回安全默认值和恢复原因。**
- [x] **Step 4: 用原生 IndexedDB 实现主动保存最近三份的 repository，并在不可用时返回明确错误。**
- [x] **Step 5: 重跑存储测试。**

### Task 6: 语义页面骨架

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.css`
- Modify: `src/index.css`
- Create: `src/app/App.test.tsx`（仅在现有依赖可直接支持 DOM 测试时；否则以 reducer/构建和浏览器验收覆盖）

**Interfaces:**
- Consumes: 已校验内容、reducer、ReplayCardViewModel、存储适配器。
- Produces: 可操作的单页语义流程。

- [x] **Step 1: 先用状态/渲染纯函数测试定义各页面必须呈现的标题、选项和动作。**
- [x] **Step 2: 确认新页面测试失败。**
- [x] **Step 3: 实现首页、隐私、情境/关系/目标/情绪/原表达选择、对比、三语气、下一步、复盘卡、安全、空状态和错误状态。**
- [x] **Step 4: 添加移动优先的基础 CSS：无横向溢出、触控目标至少 44px、安全区 padding、375/390/430 宽度适配。**
- [x] **Step 5: 重跑全部测试。**

### Task 7: 报告和最终验证

**Files:**
- Create: `PREP_REPORT.md`

**Interfaces:**
- Consumes: 最终内容统计、匹配与 fallback 规则、存储 schema、验证输出。
- Produces: 可审计的准备报告。

- [x] **Step 1: 运行 `pnpm lint` 并修复项目内问题。**
- [x] **Step 2: 运行 `pnpm test`，记录测试数量与结果。**
- [x] **Step 3: 运行 `pnpm build`，记录构建结果。**
- [x] **Step 4: 在 375/390/430 CSS px 检查布局与横向溢出。**
- [x] **Step 5: 写 `PREP_REPORT.md`，记录内容统计、规则、安全边界、ViewModel、存储和后续 UI/资产需求。**
- [x] **Step 6: 再次运行三项验收命令，并执行 `git diff --name-only -- projects/07-conversation-replay`。**
