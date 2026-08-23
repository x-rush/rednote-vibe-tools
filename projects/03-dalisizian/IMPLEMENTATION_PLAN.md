# 大理寺字案录基础实现计划

> **执行方式：** 当前 Codex 会话内联执行；每项均使用测试先行。禁止子代理、Git 写操作、依赖安装和项目外修改。

**目标：** 在现有 React + TypeScript + Vite 骨架内完成 8 案内容、剧情图校验、纯函数剧情引擎、存档层、语义页面骨架、自动测试和准备报告。

**架构：** `content.json` 是唯一业务内容源；`src/content` 负责类型、索引、schema 与图分析，`src/game` 负责有限条件解释和不可变剧情状态，`src/storage` 负责版本化 localStorage/IndexedDB，`App.tsx` 只消费类型化内容与引擎接口。所有事实结论受 [DESIGN.md](./DESIGN.md) 的来源边界约束。

**技术栈：** React 19、TypeScript 6、Vite 8、Vitest 4、浏览器 localStorage/IndexedDB；不增加依赖。

**规格：** [DESIGN.md](./DESIGN.md)

## 全局约束

- 只修改 `projects/03-dalisizian/**`。
- 业务内容只写入 `src/content/content.json`。
- 纯前端、无后端、无运行时 API、无自由输入判题、无 `eval`。
- 不保存图片、Base64、音视频或 Blob。
- 不生成最终视觉和美术资产。
- 最终只运行 `pnpm lint`、`pnpm test`、`pnpm build` 与限定目录 Git diff。

---

### 任务 1：8 案内容包与类型契约

**文件：**

- 修改：`src/content/content.test.ts`
- 修改：`src/content/content.json`
- 创建：`src/content/types.ts`
- 创建：`src/content/index.ts`

**接口：**

- 产出：`DalisizianContentPackage`、`HanziCase`、`CaseNode`、`CaseRuntimeState` 等静态类型。
- 产出：`contentPackage` 与 `buildContentIndex(contentPackage)`。
- 后续依赖：校验器、图分析、引擎、存档恢复和 App。

- [ ] **步骤 1：把现有 envelope 测试改成内容计数与 ID 契约失败测试**

测试明确断言：`contentVersion === "1.0.0"`、8 案、每案三类调查线索、人物/场景/证物/线索/节点/结局引用非空，所有稳定 ID 匹配 `/^[a-z][a-z0-9-]*$/`。当前 scaffold 因 `cases.length === 0` 失败。

- [ ] **步骤 2：运行内容测试确认 RED**

运行：`pnpm test -- src/content/content.test.ts`  
预期：断言收到 0 案而非 8 案。

- [ ] **步骤 3：定义精确 TypeScript 契约**

核心节点联合类型使用以下判别字段：

```ts
type NodeKind =
  | 'narration' | 'dialogue' | 'choice' | 'clue'
  | 'condition' | 'scene' | 'deduction' | 'ending'

type NodeChoice = {
  id: string
  text: string
  nextNodeId: string
  condition?: ConditionExpression
  effects?: NodeEffect[]
}
```

案件对象包含 `caseId/title/subtitle/order/difficulty/summary/opening/coreKnowledge/characterIds/scenes/clues/nodeIds/evidenceIds/startNodeId/requiredClueIds/deductions/correctConclusion/wrongConclusionFeedback/endingIds/scoringRules/unlockCondition/assetIds/contentVersion/sourceIds`。

- [ ] **步骤 4：机械转写 8 案内容**

案件固定为：`case-home-roof-pig`、`case-rest-under-tree`、`case-take-ear`、`case-pick-from-tree`、`case-look-into-basin`、`case-martial-stop-spear`、`case-law-water-go`、`case-autumn-insect-fire`。每案使用相同可校验纵切片结构但不同正式文案：开场 → 初判 → 三段调查（字形、字书/语境、现代流传）→ 必需线索门禁 → 推理 → 参考判词 → 结局。

每案包含 4 条冻结证据，至少 3 条线索、3 个场景、3 个推理问题、1 个结局；错误推理选项都含具体反馈。人物使用共用寺丞、书吏与逐案证人/匠人角色；所有角色、场景、证物都预留稳定 asset ID，不创建实际资产。

- [ ] **步骤 5：建立内容索引并让内容测试 GREEN**

`buildContentIndex` 返回案件、人物、节点、证物、结局，以及按案件展开的场景和线索 Map。运行 `pnpm test -- src/content/content.test.ts`，预期全部通过。

---

### 任务 2：运行时校验与节点图分析

**文件：**

- 创建：`src/content/validate.test.ts`
- 创建：`src/content/validate.ts`
- 创建：`src/content/graph.test.ts`
- 创建：`src/content/graph.ts`

**接口：**

- 消费：任务 1 的内容类型与索引。
- 产出：`validateContentPackage(value): ValidationReport`。
- 产出：`analyzeCaseGraph(caseId, index): CaseGraphReport` 与 `analyzeAllCaseGraphs(index)`。

- [ ] **步骤 1：写校验失败测试**

复制最小内容对象并逐项制造：重复 case ID、缺角色引用、缺场景引用、缺线索引用、未知条件字段、推理无正确答案、错误答案无反馈。断言错误包含稳定 `code` 和 JSON path。

- [ ] **步骤 2：运行校验测试确认 RED**

运行：`pnpm test -- src/content/validate.test.ts`  
预期：找不到校验模块或没有对应错误码。

- [ ] **步骤 3：实现结构与引用校验**

`ValidationIssue` 形状固定为：

```ts
type ValidationIssue = {
  severity: 'error' | 'warning'
  code: string
  path: string
  message: string
}
```

校验 8 案存在、所有规定 ID 唯一、引用存在且属于案件、节点/推理/结局完整、条件白名单、失败反馈、来源 ID、禁止 Base64/远程热链/脚本字符串。

- [ ] **步骤 4：运行校验测试确认 GREEN**

运行：`pnpm test -- src/content/validate.test.ts`，预期全部通过。

- [ ] **步骤 5：写图分析失败测试**

用小型内存图分别构造不可达节点、悬空跳转、非结局死节点、只能进入闭环且无结局路径四种情况；再断言正式 8 案报告全部为空且每案 `reachableEndingIds.length >= 1`。

- [ ] **步骤 6：运行图测试确认 RED**

运行：`pnpm test -- src/content/graph.test.ts`  
预期：图分析接口缺失或报告不匹配。

- [ ] **步骤 7：实现图分析**

先收集选项、条件分支、推理答案的静态边；正向 DFS 求不可达，反向 DFS 从结局求 `noEndingPathNodeIds`，Tarjan 强连通分量标识无出口闭环，零出边非 ending 节点列为意外死节点。

- [ ] **步骤 8：运行内容与图测试确认 GREEN**

运行：`pnpm test -- src/content`，预期内容、校验和图分析全通过。

---

### 任务 3：有限条件系统与通用剧情引擎

**文件：**

- 创建：`src/game/conditions.test.ts`
- 创建：`src/game/conditions.ts`
- 创建：`src/game/engine.test.ts`
- 创建：`src/game/engine.ts`
- 创建：`src/game/playthrough.test.ts`

**接口：**

- 消费：内容索引、节点和条件类型。
- 产出：`evaluateCondition`、`getAvailableOptions`。
- 产出：初始化、进入节点、选择、获取、推理、评分、解锁、重开函数。

- [ ] **步骤 1：写条件解释器失败测试**

覆盖 `all/any/not`、flag equals、集合 includes/not-includes、deduction answer-is，以及不满足条件的选项被隐藏。

- [ ] **步骤 2：运行条件测试确认 RED**

运行：`pnpm test -- src/game/conditions.test.ts`，预期接口缺失。

- [ ] **步骤 3：实现纯函数条件解释器并确认 GREEN**

解释器使用 switch 穷尽联合类型；未知表达式返回 `false`，不拼接或执行字符串。运行相同测试，预期通过。

- [ ] **步骤 4：写引擎行为失败测试**

逐项覆盖：初始化、进入节点记录已读、flag、线索/证物/场景幂等、条件选项、错误推理反馈、正确推理跳转、未集齐线索阻止结案、评分、下一案解锁、最后一案不产生无效 ID、重开保留最佳评价。

- [ ] **步骤 5：运行引擎测试确认 RED**

运行：`pnpm test -- src/game/engine.test.ts`，预期引擎接口缺失。

- [ ] **步骤 6：实现不可变剧情引擎**

状态至少包含：

```ts
type CaseRuntimeState = {
  caseId: string
  screen: ScreenState
  currentNodeId: string
  currentSceneId?: string
  flags: Record<string, boolean>
  clueIds: string[]
  evidenceIds: string[]
  unlockedSceneIds: string[]
  visitedNodeIds: string[]
  deductionAnswers: Record<string, string>
  deductionFeedback?: string
  initialVerdict?: CaseVerdict
  finalVerdict?: CaseVerdict
  styleTags: string[]
  completed: boolean
}
```

进入节点应用效果后最多保留正式节点总数的去重已读记录。领域错误返回 `{ ok: false, code, message, state }`，不抛出导致 UI 白屏的普通操作异常。

- [ ] **步骤 7：运行引擎测试确认 GREEN**

运行：`pnpm test -- src/game/engine.test.ts`，预期全部通过。

- [ ] **步骤 8：写三案自动跑通失败测试并实现通用路径驱动器**

测试只通过公开引擎 API，选择每个节点的首个可用正确路径，完整跑通家、武、法；断言完成、结局、参考判词和评分存在。其他五案由图分析覆盖。

- [ ] **步骤 9：运行全部 game 测试确认 GREEN**

运行：`pnpm test -- src/game`，预期三案自动跑通和全部单元测试通过。

---

### 任务 4：版本化存档与损坏恢复

**文件：**

- 创建：`src/storage/storage.test.ts`
- 创建：`src/storage/types.ts`
- 创建：`src/storage/storage.ts`
- 创建：`src/storage/indexedDb.ts`

**接口：**

- 消费：`CaseRuntimeState` 与当前内容索引。
- 产出：`createDefaultSave`、`loadSave`、`saveLauncher`、`saveCaseProgress`、`loadCaseProgress`、`saveVerdict`、`clearProjectData`。
- 适配器：`StorageLike` 与 `CaseRecordStore`，供浏览器和测试内存实现。

- [ ] **步骤 1：写存档失败测试**

覆盖 envelope 保存/恢复、损坏 JSON、未来 schema、旧 contentVersion、失效节点 ID、重复和过量数组、最佳评价更新、媒体/Base64/Blob 递归拒绝。

- [ ] **步骤 2：运行存档测试确认 RED**

运行：`pnpm test -- src/storage/storage.test.ts`，预期存档接口缺失。

- [ ] **步骤 3：实现白名单 envelope 与恢复**

固定 envelope：

```ts
type StoredEnvelope<T> = {
  schemaVersion: 1
  contentVersion: string
  updatedAt: string
  data: T
}
```

`loadSave` 返回 `{ data, recovered, issue? }`。解析或版本失败时不覆盖原值，返回默认数据和原因；无效非关键 ID 被过滤，当前节点失效则只重开该案。

- [ ] **步骤 4：实现 IndexedDB 记录仓库与 localStorage 降级**

浏览器仓库打开 `xhs_zi_an_lu` 版本 1，创建 `caseProgress` 和 `caseVerdicts`。打开/事务失败时切换有限 localStorage fallback key，向调用者返回 `degraded: true`。

- [ ] **步骤 5：运行存档测试确认 GREEN**

运行：`pnpm test -- src/storage`，预期全部通过。

---

### 任务 5：React 语义页面骨架

**文件：**

- 创建：`src/app/viewModel.test.ts`
- 创建：`src/app/viewModel.ts`
- 修改：`src/App.tsx`
- 修改：`src/App.css`
- 修改：`src/index.css`

**接口：**

- 消费：内容索引、校验报告、引擎和存档仓库。
- 产出：`getNodeScreen`、`getCaseListItems`、`getReturnTarget` 等纯 view model。

- [ ] **步骤 1：写页面映射失败测试**

断言 8 种节点映射到正确语义页面；案件解锁/完成/最佳评价映射正确；线索簿与证物详情关闭后返回之前节点页面。

- [ ] **步骤 2：运行映射测试确认 RED**

运行：`pnpm test -- src/app/viewModel.test.ts`，预期 view model 接口缺失。

- [ ] **步骤 3：实现 view model 并确认 GREEN**

运行相同测试，预期全部通过。

- [ ] **步骤 4：替换骨架 App**

使用 `<main>`、`<header>`、`<nav>`、`<section>`、`<article>`、`<dialog>` 语义结构实现入口、案卷、简报、调查、对话、线索、证物、推理、结案和错误/空状态。所有剧情选项来自当前节点数据；不添加文本输入框。

- [ ] **步骤 5：建立移动端基础 CSS**

容器使用 `width: min(100%, 46rem)` 与左右 `clamp(1rem, 4vw, 1.5rem)` 内边距；全局 `overflow-wrap: anywhere`；按钮 `min-height: 44px`；底部操作区包含 `env(safe-area-inset-bottom)`；网格在窄屏保持单列，不设置超过视口的固定宽度。

- [ ] **步骤 6：运行当前全部测试**

运行：`pnpm test`，预期内容、图、引擎、存档和 view model 测试全部通过。

---

### 任务 6：报告、完整验收与限定范围检查

**文件：**

- 创建：`PREP_REPORT.md`
- 可能修改：仅前述测试暴露问题对应的本项目文件。

**接口：**

- 消费：内容统计、图分析输出和新鲜验证结果。
- 产出：项目基础交付报告与 `FOUNDATION READY/BLOCKED` 证据。

- [ ] **步骤 1：生成可复核统计**

使用只读脚本/测试输出统计 8 案节点、人物、场景、线索、证物、推理和结局数量；汇总每案图报告与三案自动通关结果。

- [ ] **步骤 2：编写 `PREP_REPORT.md`**

记录统计、引擎接口、条件 AST、存档 schema、图检查、待确认汉字知识、未来 UI 接口、角色/场景/证物 asset ID，以及暂未运行的验证项。

- [ ] **步骤 3：按顺序运行新鲜验证**

在项目目录运行：

```text
pnpm lint
pnpm test
pnpm build
```

任一失败都先记录实际失败，再在限定目录内修复；修复行为必须先添加能复现问题的失败测试，然后重跑对应命令和全套命令。

- [ ] **步骤 4：补写报告中的真实结果**

只记录刚刚命令的退出码、测试数量和构建摘要，不使用“预计通过”。

- [ ] **步骤 5：执行限定目录检查**

在仓库根运行：

```text
git diff --name-only -- projects/03-dalisizian
git diff --stat -- projects/03-dalisizian
```

确认没有项目外文件由本任务修改。不分析、不恢复其他项目改动。

- [ ] **步骤 6：输出最终结论**

全部门禁通过时输出 `FOUNDATION READY`；需要共享文件或仍有失败门禁时输出 `FOUNDATION BLOCKED`，并列出精确阻塞证据。
