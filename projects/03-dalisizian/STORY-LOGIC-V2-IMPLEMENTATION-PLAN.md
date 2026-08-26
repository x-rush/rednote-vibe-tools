# 《大理寺字案录》追线索剧情逻辑 V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 将八案从固定线性阅读改造成三路自由调查、主动取证、可回查推理与可变评分的完整游戏流程。

**Architecture:** 保留现有内容索引、纯函数引擎、React 单页入口和本地存档边界；通过内容类型扩展使调查路线、回查目标和评分条件完全由 `content.json` 驱动。先建立引擎与存档兼容，再做第一案黄金样板和通用 UI，最后迁移七案并执行全量内容与浏览器验证。

**Tech Stack:** React 19、TypeScript 6、Vite 8、Vitest 4、CSS；不新增依赖。

**Spec:** `STORY-LOGIC-V2-SPEC.md`

## Global Constraints

- 只修改 `projects/03-dalisizian/`。
- 不修改根 `package.json`、`pnpm-workspace.yaml`、`pnpm-lock.yaml`、`docs/`、`prep/` 或其他项目。
- 所有案件业务内容只写入 `src/content/content.json`，JSX 不硬编码案件文案。
- 纯前端静态构建；无后端、运行时 CDN、必需外部 API、新依赖或 Service Worker。
- 存储不得包含用户图片、Base64、音视频或 Blob。
- 古文字资源只接受人工核验材料；本计划不生成古文字图形。
- 不删除测试以通过质量门。
- 工作区已有本项目改动，保留并兼容；不触碰根 `.git` 元数据，不执行 Git 提交。
- 每个生产行为严格遵循 RED → GREEN → REFACTOR。

---

### Task 1: 扩展内容模型与条件语言

**Files:**
- Modify: `src/content/types.ts`
- Modify: `src/game/conditions.ts`
- Modify: `src/game/conditions.test.ts`
- Modify: `src/app/viewModel.ts`
- Modify: `src/app/viewModel.test.ts`

**Interfaces:**
- Produces: `InvestigationRoute`、`investigation-hub` 节点、`routeId`、`reviewNodeId`、`focusEvidenceIds`。
- Produces: 首次答案、尝试次数、回查路线和调查风格的有限条件表达式。
- Consumes: 现有 `CaseRuntimeState`、`evaluateCondition()` 与 `getNodeScreen()`。

- [x] **Step 1: 写失败的条件与页面映射测试**

在 `conditions.test.ts` 的 fixture 增加新状态字段，并增加：

```ts
it('evaluates first answers, attempt counts, reviewed routes, and style tags', () => {
  const stateV2 = {
    ...state,
    deductionAttempts: { 'deduction-home-method': 2 },
    firstDeductionAnswers: { 'deduction-home-method': 'option-home-method-a' },
    reviewedRouteIds: ['route-home-form'],
    styleTags: ['形证派', '审慎派'],
  }
  expect(evaluateCondition({ field: 'firstDeductionAnswers', operator: 'answer-is', key: 'deduction-home-method', value: 'option-home-method-a' }, stateV2)).toBe(true)
  expect(evaluateCondition({ field: 'deductionAttempts', operator: 'at-most', key: 'deduction-home-method', value: 2 }, stateV2)).toBe(true)
  expect(evaluateCondition({ field: 'reviewedRouteIds', operator: 'includes', value: 'route-home-form' }, stateV2)).toBe(true)
  expect(evaluateCondition({ field: 'styleTags', operator: 'includes', value: '审慎派' }, stateV2)).toBe(true)
})
```

在 `viewModel.test.ts` 的参数表加入：

```ts
['investigation-hub', 'investigation']
```

- [x] **Step 2: 运行测试并确认 RED**

Run: `pnpm test -- src/game/conditions.test.ts src/app/viewModel.test.ts`

Expected: TypeScript 或断言失败，原因是新节点和条件字段尚未定义。

- [x] **Step 3: 最小实现类型与求值**

在 `types.ts` 增加：

```ts
export type InvestigationRoute = {
  id: string
  title: string
  summary: string
  entryNodeId: string
  requiredClueIds: string[]
  accent: 'cinnabar' | 'ink' | 'bronze'
}
```

将 `investigation-hub` 加入 `NodeKind`；将 `reviewedRouteIds`、`styleTags` 加入集合条件字段；为条件联合类型增加 `firstDeductionAnswers/answer-is` 与 `deductionAttempts/at-most`。在 `evaluateCondition()` 中分别读取对应状态字段，在 `getNodeScreen()` 中把调查板映射为 `investigation`。

- [x] **Step 4: 运行目标测试并确认 GREEN**

Run: `pnpm test -- src/game/conditions.test.ts src/app/viewModel.test.ts`

Expected: 两个测试文件全部通过。

---

### Task 2: 记录首次推理、尝试次数与回查状态

**Files:**
- Modify: `src/content/types.ts`
- Modify: `src/game/engine.ts`
- Modify: `src/game/engine.test.ts`
- Modify: `src/storage/storage.ts`
- Modify: `src/storage/storage.test.ts`

**Interfaces:**
- Produces: `markRouteReviewed(state, routeId)` 幂等纯函数。
- Produces: `submitDeductionAnswer()` 在每次提交时递增次数且只写一次首次答案。
- Produces: `restoreCaseProgress()` 对旧存档补齐新字段并过滤无效路线 ID。

- [x] **Step 1: 写失败的引擎测试**

```ts
it('keeps the first deduction answer while counting every retry', () => {
  const ready = homeCase.requiredClueIds.reduce(acquireClue, createInitialCaseState(homeCase))
  let state = expectSuccess(enterNode(ready, 'node-home-16', contentIndex))
  state = expectSuccess(submitDeductionAnswer(state, 'option-home-method-a', contentIndex))
  state = expectSuccess(submitDeductionAnswer(state, 'option-home-method-b', contentIndex))
  expect(state.firstDeductionAnswers['deduction-home-method']).toBe('option-home-method-a')
  expect(state.deductionAttempts['deduction-home-method']).toBe(2)
  expect(state.deductionAnswers['deduction-home-method']).toBe('option-home-method-b')
})

it('marks a reviewed route idempotently', () => {
  const initial = createInitialCaseState(homeCase)
  expect(markRouteReviewed(markRouteReviewed(initial, 'route-home-form'), 'route-home-form').reviewedRouteIds).toEqual(['route-home-form'])
})
```

- [x] **Step 2: 运行引擎测试并确认 RED**

Run: `pnpm test -- src/game/engine.test.ts`

Expected: 新字段和 `markRouteReviewed` 不存在。

- [x] **Step 3: 实现运行时记录**

`createInitialCaseState()` 初始化：

```ts
deductionAttempts: {},
firstDeductionAnswers: {},
reviewedRouteIds: [],
```

`submitDeductionAnswer()` 在判断正误前生成：

```ts
const attempts = (state.deductionAttempts[deduction.id] ?? 0) + 1
const firstAnswers = state.firstDeductionAnswers[deduction.id]
  ? state.firstDeductionAnswers
  : { ...state.firstDeductionAnswers, [deduction.id]: option.id }
```

最近答案仍写入 `deductionAnswers`；错误仍允许安全重答。

- [x] **Step 4: 写失败的旧存档恢复测试**

在 `storage.test.ts` 用删除三个新字段的旧状态调用 `restoreCaseProgress()`，断言恢复结果为 `{}`、`{}`、`[]`；再写包含重复/未知路线的状态，断言只保留本案配置的稳定路线 ID。

- [x] **Step 5: 实现存档兼容并运行目标测试**

Run: `pnpm test -- src/game/engine.test.ts src/storage/storage.test.ts`

Expected: 两个测试文件全部通过；旧存档只发生安全补字段，不影响已得线索。

---

### Task 3: 校验调查路线、复核引用与来源边界

**Files:**
- Modify: `src/content/validate.ts`
- Modify: `src/content/validate.test.ts`
- Modify: `src/content/graph.ts`
- Modify: `src/content/graph.test.ts`

**Interfaces:**
- Consumes: `HanziCase.investigationRoutes`、`CaseNode.routeId`、`DeductionOption.reviewNodeId`。
- Produces: 路线数量、ID 唯一性、本案引用、证物来源分层的验证错误。

- [x] **Step 1: 写失败的内容校验测试**

克隆生产内容，分别制造：少于三条路线、入口指向他案节点、路线线索不存在、错误答案缺少复核节点、事实证物引用 F 来源。断言错误码包含：

```ts
expect(errorCodes(broken)).toEqual(expect.arrayContaining([
  'invalid-route-count',
  'missing-route-entry',
  'missing-route-clue',
  'missing-review-node',
  'fiction-source-on-evidence',
]))
```

- [x] **Step 2: 运行测试并确认 RED**

Run: `pnpm test -- src/content/validate.test.ts`

Expected: 新验证规则尚未报告这些错误。

- [x] **Step 3: 实现有限校验规则**

每案必须恰好三条路线；路线 ID 在本案唯一；入口、线索和 `reviewNodeId` 必须属于本案；`routeId` 必须在本案路线表；非正确推理项必须有 `reviewNodeId`；`Evidence.sourceIds` 不能指向 `type: 'F'`。

- [x] **Step 4: 扩展图测试覆盖六种调查顺序**

为每案生成三路线的六个排列，沿每条入口推进至调查板，再申请推理，断言每个排列都抵达 ending。图分析继续拒绝悬空引用和不可退出循环。

- [x] **Step 5: 运行内容与图测试并确认 GREEN**

Run: `pnpm test -- src/content/validate.test.ts src/content/graph.test.ts`

Expected: 生产内容迁移前允许暂时仅运行针对纯验证器的 fixture 测试；Task 5 完成后全量生产内容必须 GREEN。

---

### Task 4: 第一案黄金样板与可变评分

**Files:**
- Modify: `src/content/content.json`
- Modify: `src/game/playthrough.test.ts`
- Modify: `src/game/engine.test.ts`

**Interfaces:**
- Produces: 第一案三条路线 `route-home-form`、`route-home-gloss`、`route-home-context`。
- Produces: 调查板节点、路线入口/归档/返回节点、三道本案专属推理和分项评分规则。
- Consumes: Tasks 1–3 的类型、状态、条件和验证能力。

- [x] **Step 1: 写第一案行为测试并确认 RED**

测试以下行为：

```ts
it('lets the home case complete its routes in any order and only awards evidence on archive choices', () => {
  // 从初判推进到 investigation-hub。
  // 进入 route-home-context 时 clueIds 仍为空。
  // 选择明确归档选项后才包含 clue-home-context 与对应 evidence IDs。
  // 返回调查板后其余两条路线仍可选。
})

it('produces different home-case scores for clean and recovered reasoning', () => {
  // 三题首次正确为 100；一次错误后重答且完成回查为 90；多次错误且不回查低于 90。
})
```

Run: `pnpm test -- src/game/playthrough.test.ts src/game/engine.test.ts`

Expected: 第一案仍为线性流程且满分固定。

- [x] **Step 2: 重写第一案节点图**

保持现有案件、线索、证物和结案稳定 ID；将进入节点发证据改为归档 choice effects。添加调查板节点和必要的路线回看节点，使三路都返回同一调查板。删除未消费的 `flag-home-rumor-noted`。

- [x] **Step 3: 重写第一案故事与推理**

围绕“构件功能 → 传统构形说 → 社会史跨越”写三条专属路线。证人依次陈述口诀、承认省略声符可能性、澄清自己是为了说书易记。三道题必须引用 `evidence-home-early-form`、`evidence-home-shuowen`、`evidence-home-phonetic` 与 `evidence-home-social-leap`，正确位置不形成 B/B/B。

- [x] **Step 4: 实现评分条件并确认 GREEN**

把第一案评分规则改成规格中的 30/30/25/15 四维结构；`calculateVerdict()` 仍只聚合内容规则。运行：

Run: `pnpm test -- src/game/engine.test.ts src/game/playthrough.test.ts src/content/validate.test.ts src/content/graph.test.ts`

Expected: 第一案六种调查顺序、主动取证、错误回查和分数差异全部通过。

---

### Task 5: 通用调查板、复核反馈与评分明细 UI

**Files:**
- Modify: `src/app/viewModel.ts`
- Modify: `src/app/viewModel.test.ts`
- Modify: `src/App.tsx`
- Modify: `src/App.css`

**Interfaces:**
- Produces: `getInvestigationRouteItems(caseData, state)`，返回路线完成状态、所得线索和可用入口。
- Produces: `getDeductionReviewModel(deduction, state, index)`，返回断裂链与复核入口。
- Consumes: 内容驱动的 `investigationRoutes`、`focusEvidenceIds`、`reviewNodeId` 和评分规则。

- [x] **Step 1: 写失败的 view-model 测试**

```ts
it('builds completed and pending investigation route cards from content', () => {
  const items = getInvestigationRouteItems(homeCase, { ...baseState, clueIds: ['clue-home-form'] })
  expect(items.map((item) => [item.id, item.completed])).toEqual([
    ['route-home-form', true],
    ['route-home-gloss', false],
    ['route-home-context', false],
  ])
})

it('builds a review link after a failed deduction', () => {
  const model = getDeductionReviewModel(homeCase.deductions[0], failedState, contentIndex)
  expect(model?.reviewNodeId).toBe('node-home-form-review')
})
```

- [x] **Step 2: 运行测试并确认 RED**

Run: `pnpm test -- src/app/viewModel.test.ts`

Expected: 两个 helper 尚不存在。

- [x] **Step 3: 实现纯 view model 与调查板 JSX**

`renderCase()` 在 `node.kind === 'investigation-hub'` 时渲染中央案签、三条红线和三张路线卡；路线完成仍允许回看，线索齐全才显示申请终判。route card 文案全部来自内容模型。

- [x] **Step 4: 实现推理回查交互**

错误反馈区域展示本题关联证物、错误反馈和“回查此证据”按钮。点击后调用 `markRouteReviewed()` 并 `enterNode()` 到 `reviewNodeId`；内容路线返回时进入原 deduction 节点。不得将案件文案写入 JSX。

- [x] **Step 5: 实现评分明细与动效样式**

结案面板列出四个评分维度；调查板红线、路线完成、证据归档和推理闭合使用 180–240ms CSS 动效。`@media (prefers-reduced-motion: reduce)` 将过渡压到 1ms。所有新按钮最小高度 44px。

- [x] **Step 6: 运行单元测试、lint 与 build**

Run: `pnpm test -- src/app/viewModel.test.ts && pnpm lint && pnpm build`

Expected: 全部通过，无 TypeScript 穷尽性错误。

---

### Task 6: 迁移其余七案的独立故事机制

**Files:**
- Modify: `src/content/content.json`
- Modify: `src/content/content.test.ts`
- Modify: `src/content/graph.test.ts`
- Modify: `src/game/playthrough.test.ts`

**Interfaces:**
- Produces: 每案三路线、专属证人三段对话、专属推理、可变评分和回查节点。
- Consumes: 第一案确定的通用内容结构与 UI，不添加案件专用 React 分支。

- [x] **Step 1: 写失败的全案差异化测试**

断言每案三路线、正确答案位置分布、证人至少三段对白、证人整句对白跨案不重复、三道推理的选项组跨案不重复、进入材料节点不自动发证据、每个错误推理项存在本案复核节点。

Run: `pnpm test -- src/content/content.test.ts src/content/graph.test.ts src/game/playthrough.test.ts`

Expected: 旧七案因线性模板和重复对白失败。

- [x] **Step 2: 迁移第二至第四案**

按规格实现：第二案“个例与万能规则”、第三案“语义变化时间链”、第四案“采/釆/彩身份辨认”。每案复用稳定实体 ID，新增节点 ID 使用本案前缀，正确选项位置轮换。

- [x] **Step 3: 运行三案目标测试并修正图结构**

Run: `pnpm test -- src/content/content.test.ts src/content/graph.test.ts src/game/playthrough.test.ts`

Expected: 已迁移案件全部通过；未迁移案件仍以明确断言失败。

- [x] **Step 4: 迁移第五至第八案**

按规格实现：第五案“监/鉴关系图”、第六案“传统训释与早期材料”、第七案“法/灋残缺古形”、第八案“双假说权衡”。第八案正确终判保留 `uncertain`，其错误项不得暗示必须强行选定一说。

- [x] **Step 5: 清除死字段和模板文案**

移除八个未消费的 `rumor-noted` 标志；搜索并消除重复的证人套话、通用方法题和固定 B 项规律。保留真正属于界面系统的通用提示。

- [x] **Step 6: 运行全案内容与游玩测试并确认 GREEN**

Run: `pnpm test -- src/content/content.test.ts src/content/validate.test.ts src/content/graph.test.ts src/game/playthrough.test.ts`

Expected: 八案六种路线顺序、错误恢复和结案均通过。

---

### Task 7: 来源分层与事实证物清理

**Files:**
- Modify: `src/content/content.json`
- Modify: `src/content/content.test.ts`
- Modify: `src/content/validate.test.ts`

**Interfaces:**
- Produces: 事实证物仅引用 A/B 来源；F 来源只用于虚构包装。
- Consumes: 现有来源记录，不伪造无法核验的出版物。

- [x] **Step 1: 写失败的来源测试**

断言每件事实证物不含 F，每案至少一条 B 或在结案 `scholarlyUncertainty` 中明确声明当前材料不足，且每个 source ID 都被实际消费。

- [x] **Step 2: 运行测试并确认 RED**

Run: `pnpm test -- src/content/content.test.ts src/content/validate.test.ts`

Expected: 现有 `source-fiction` 挂载和 B 类缺失触发失败。

- [x] **Step 3: 机械清理来源挂载**

从 Clue、Evidence 和事实性 Ending 来源列表移除 `source-fiction`；F 来源仅保留为场景叙事声明。已有 A/B 来源按其直接支持的证物重新分配，不能把同案来源组复制给所有证物。

- [x] **Step 4: 对无法补齐的学术主张收窄措辞**

不联网伪造文献。若项目已有研究 dossier 无法给出可安全转写的 B 来源，则把相应正文改为“现有材料不能证明/仍有争议”，并在不确定性字段明确边界。

- [x] **Step 5: 运行来源与安全测试并确认 GREEN**

Run: `pnpm test -- src/content/content.test.ts src/content/validate.test.ts`

Expected: 无 F 来源污染事实证物，无悬空来源或远程媒体资源。

---

### Task 8: 全量回归与移动端视觉验收

**Files:**
- Modify if needed: `src/App.css`
- Modify if needed: `src/App.tsx`
- Create: `output/playwright/dalisizian-investigation-v2-375.png`
- Create: `output/playwright/dalisizian-investigation-v2-390.png`
- Create: `output/playwright/dalisizian-investigation-v2-430.png`
- Create: `output/playwright/dalisizian-review-v2-390.png`
- Modify: `VISUAL-QA.md`
- Modify: `TODO.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: 完整 V2 产品。
- Produces: 可复现的质量门输出和三宽度截图证据。

- [x] **Step 1: 运行项目质量门**

Run: `pnpm lint && pnpm test && pnpm build`

Expected: 三条命令退出码均为 0；不得忽略 warning 或删除测试。

- [x] **Step 2: 启动本地静态预览并走第一案**

使用已有 Playwright 工具从入口完成初判、按非默认顺序调查三路、故意答错一次、回查证据、重答、结案、打开图鉴战绩卡。验证刷新后进度仍在。

- [x] **Step 3: 验证 375 / 390 / 430 CSS px**

每个宽度检查：无水平滚动；路线卡和终判按钮可见；点击区域至少 44px；证据簿、推理回查、评分明细不遮挡；场景资源失败时仍可继续。

- [x] **Step 4: 验证 reduced motion 与离线启动**

启用 `prefers-reduced-motion: reduce`，确认无必须等待的动画。构建后阻断网络并首次加载本地静态资源，确认八案内容和现有图片均不依赖 CDN/API。

- [x] **Step 5: 更新项目内交付文档**

在 `VISUAL-QA.md` 记录宽度、路径、结果和截图；在 `TODO.md` 只保留需要人类史料审核的事项；在 `README.md` 更新真实的 V2 调查、评分和恢复机制。

- [x] **Step 6: 最终复跑质量门**

Run: `pnpm lint && pnpm test && pnpm build`

Expected: 全部通过，且 `git diff --check -- projects/03-dalisizian` 无空白错误。
