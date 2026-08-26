# Conversation Replay V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有基础向导升级为完整的“事实—感受—推测—需要—请求”句子编辑台，并在任何应用代码修改前完成全部美术资源生成与验收。

**Architecture:** `content.json` 继续作为唯一业务内容源；运行时校验器产生类型化内容，纯函数建立筛选、草稿和结果 ViewModel，reducer 管理流程，React 组件只渲染 ViewModel。localStorage／IndexedDB 只保存 schema v2 的稳定 ID、数值、时间和有限文本，并对 v1 做受控迁移。

**Tech Stack:** React 19、TypeScript 6、Vite 8、Vitest 4、原生 localStorage／IndexedDB、项目内 SVG／WebP、CSS 动效。

**Spec:** `UI-REDESIGN-V2.md`、`INTERACTION-MOTION-SPEC.md`、`ART-REQUEST.md`。

## Global Constraints

- 只修改 `projects/07-conversation-replay/**`；不修改其他项目、根配置、锁文件、`docs/` 或 `prep/`。
- 不新增依赖；无后端、运行时 CDN、外部 API、Service Worker 或必需设备 API。
- 阶段 A 的全部资源完成并通过验收前，不得修改 `src` 应用代码。
- 业务文案只存在于 `src/content/content.json`；JSX 只消费类型化 ViewModel。
- 不接收、读取、上传或分析聊天记录和截图；核心流程使用结构化选项。
- 浏览器存储不得保存图片、Base64、音视频或 Blob。
- sticky 顶栏与锚点同时叠加 `var(--safe-area-inset-top, env(safe-area-inset-top, 0px))`。
- 不执行 Git 写操作；每项任务用测试与文件清单形成检查点。
- 最终执行 `pnpm lint && pnpm test && pnpm build`，并验证 375／390／430 CSS px 与 32px 非零顶部安全区。

---

## Phase A — 美术资源硬门槛

### Task 1: 生成迟言位图资源

**Files:**
- Create: `public/assets/guide/chiyan-guide-master.webp`
- Create: `public/assets/guide/chiyan-avatar.webp`
- Create: `public/assets/guide/chiyan-placeholder.webp`
- Reference: `ART-REQUEST.md`
- Reference: `research/chiyan-reference-dossier.md`

**Interfaces:**
- Produces: 首次引导使用的 3:4 主图、节点使用的正方形头像、加载降级使用的轻量占位图。
- Consumes: 不复制现实人物的冻结角色描述；不依赖缺失的旧资源。

- [ ] **Step 1: 用 imagegen 生成迟言主图**

使用以下冻结提示词，不附带现实人物参考图：

```text
原创虚构中国年轻男性编辑“迟言”，沉静、诚实、温和专注，深海军蓝薄外套式衬衫、暖灰内搭。站在安静的暖白纸面编辑台前，一手托住横向打开的分栏便签本，另一手自然握木色铅笔悬停在两栏之间。便签本只允许一道中央竖向分栏线、恰好四块完全空白的可移除纸条和两枚无文字细线重排箭头。成熟克制的生活方式编辑插画，细腻铅笔与淡水粉质感，蓝灰、鼠尾草绿、赭石与少量灰玫瑰色，透明或纯暖白背景，竖幅 3:4；头顶、双手、铅笔和整本便签本完整，人物至大腿中部，手指与纸张受力可信。不得出现文字、伪字、聊天气泡、头像、消息截图、分数、红绿对错、咨询室、白大褂、法官、法袍、客服耳麦、围裙、咖啡设备、AI 机器人、情侣冲突、品牌或现实人物相貌。
```

- [ ] **Step 2: 单图视觉验收**

使用本地图片查看器以原始细节检查：

```text
头顶完整；双手各五指结构可信；铅笔未穿过手指；整本笔记本完整；
恰好四块空白纸条；一道分栏线；两枚重排箭头；无文字和禁用符号。
```

任一检查失败时，只编辑主图，直到全部通过；不得从失败主图派生头像。

- [ ] **Step 3: 导出主图 WebP**

将 imagegen 通过验收的原始结果保存为 `public/assets/guide/chiyan-guide-master-source.png`，再用现有 ffmpeg 导出：

```bash
ffmpeg -y -i public/assets/guide/chiyan-guide-master-source.png -vf "scale=900:1200:force_original_aspect_ratio=increase,crop=900:1200" -c:v libwebp -quality 86 public/assets/guide/chiyan-guide-master.webp
```

预期：900×1200、可正常解码、无可读文字。三份 WebP 验收后移除这张明确的临时源图，最终资源目录只保留交付文件。

- [ ] **Step 4: 从主图派生头像**

生成提示词固定人物正面居中，因此使用主图上部居中裁切：

```bash
ffmpeg -y -i public/assets/guide/chiyan-guide-master.webp -vf "crop=480:480:210:90,scale=320:320" -c:v libwebp -quality 84 public/assets/guide/chiyan-avatar.webp
```

预期：320×320，完整头部和肩部，人物身份与主图一致。

- [ ] **Step 5: 派生轻量占位图**

```bash
ffmpeg -y -i public/assets/guide/chiyan-guide-master.webp -vf "scale=72:96" -c:v libwebp -quality 45 public/assets/guide/chiyan-placeholder.webp
```

预期：72×96，保持 3:4，不含新增生成细节。

- [ ] **Step 6: 移除已完成转换的临时源图**

```bash
rm -- public/assets/guide/chiyan-guide-master-source.png
```

该文件由本任务生成且三份交付 WebP 已完成，移除后无需恢复。

- [ ] **Step 7: 验证文件属性**

```bash
ffprobe -v error -select_streams v:0 -show_entries stream=width,height,codec_name -of default=noprint_wrappers=1 public/assets/guide/chiyan-guide-master.webp
ffprobe -v error -select_streams v:0 -show_entries stream=width,height,codec_name -of default=noprint_wrappers=1 public/assets/guide/chiyan-avatar.webp
ffprobe -v error -select_streams v:0 -show_entries stream=width,height,codec_name -of default=noprint_wrappers=1 public/assets/guide/chiyan-placeholder.webp
```

预期尺寸依次为 900×1200、320×320、72×96，编码均为 WebP。

### Task 2: 制作并验收 17 个 SVG

**Files:**
- Create: `public/assets/icons/step-fact.svg`
- Create: `public/assets/icons/step-feeling.svg`
- Create: `public/assets/icons/step-inference.svg`
- Create: `public/assets/icons/step-need.svg`
- Create: `public/assets/icons/step-request.svg`
- Create: `public/assets/icons/privacy-ephemeral.svg`
- Create: `public/assets/icons/privacy-local.svg`
- Create: `public/assets/icons/tone-gentle.svg`
- Create: `public/assets/icons/tone-direct.svg`
- Create: `public/assets/icons/tone-firm.svg`
- Create: `public/assets/icons/edit-note.svg`
- Create: `public/assets/icons/edit-hide.svg`
- Create: `public/assets/icons/edit-delete.svg`
- Create: `public/assets/icons/edit-reorder.svg`
- Create: `public/assets/icons/edit-undo.svg`
- Create: `public/assets/icons/safety-priority.svg`
- Create: `public/assets/icons/guide-help.svg`
- Create: `design/assets-board.html`

**Interfaces:**
- Produces: `ICON_PATHS` 后续引用的固定公共路径。
- Consumes: `ART-REQUEST.md` 中的图形隐喻和禁用项。

- [ ] **Step 1: 建立统一 SVG 外壳**

先用以下完整基线创建 `step-fact.svg`；其余资源沿用相同根属性：

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" role="img">
  <title>事实</title>
  <rect x="4" y="3" width="16" height="18" rx="2"/>
  <path d="m8 9 2 2 4-4"/>
  <path d="M8 15h8M8 18h6"/>
</svg>
```

- [ ] **Step 2: 绘制五步与隐私资源**

按 `ART-REQUEST.md` 的固定隐喻绘制 7 个 SVG。事实用核验框与记录线；感受用中性躯干轮廓和两道波纹；推测用两栏及移动箭头；需要用中心留白与支撑线；请求用内容卡进入行动刻度；无痕用记录页与退出清除；本机用设备轮廓与内部记录页。

- [ ] **Step 3: 绘制语气、编辑、安全和帮助资源**

三语气共用三道句线，通过边缘留白与边界线变化表达差异；编辑标记分别使用页边笔记、划线隐藏、删除线、上下重排和回转箭头；安全使用稳定盾牌与确认线；帮助使用铅笔与页边批注。

- [ ] **Step 4: 创建独立尺寸板**

`design/assets-board.html` 以 16／24／32px 三列引用全部 17 个 SVG，背景同时覆盖暖白、蓝灰和深色。每个引用旁显示资源文件名；页面不得依赖运行时 CDN。

- [ ] **Step 5: 静态检查 SVG**

```bash
test "$(find public/assets/icons -maxdepth 1 -name '*.svg' | wc -l)" -eq 17
rg -L 'viewBox="0 0 24 24"' public/assets/icons/*.svg
rg -L 'stroke-width="2"' public/assets/icons/*.svg
rg -L '<title>' public/assets/icons/*.svg
rg -n '#[0-9A-Fa-f]{3,8}|rgb\(|fill="[^n]' public/assets/icons/*.svg
```

预期：文件数 17；前三项无输出；最后一项不出现硬编码色或非 `none` 填充。

- [ ] **Step 6: 浏览器视觉验收尺寸板**

在 390px 与桌面宽度打开尺寸板，确认 17×3 个引用均解码，五步互相可辨，三语气视觉重量同级，隐私与安全图标不脱离文字承诺单独使用。

- [ ] **Step 7: 阶段 A 硬门槛检查**

```bash
find public/assets/guide public/assets/icons -maxdepth 1 -type f | sort
```

预期：3 个 WebP 与 17 个 SVG 全部存在。记录主图、头像、占位图尺寸和尺寸板视觉结论。只有本步骤通过后才能开始 Task 3。

---

## Phase B — 应用代码与内容

### Task 3: V2 内容契约与 32 情境五步数据

**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/content/content.json`
- Modify: `src/content/validate.ts`
- Modify: `src/content/content.test.ts`

**Interfaces:**
- Produces: `ScenarioReplayContent`、`FactOption`、`InferenceOption`、`RequestOption`、`PracticeOption` 与严格运行时校验。
- Consumes: 现有 32 个 `ConversationScenario`、48 个感受、48 个需要、8 个原表达、6 个回应和 32 个 rewrite。

- [ ] **Step 1: 写 V2 契约失败测试**

在 `content.test.ts` 增加表驱动断言：

```ts
it('gives every scenario complete five-layer replay content', () => {
  const result = validateContent(rawContent)
  expect(result.ok).toBe(true)
  const content = parseContent(rawContent)
  for (const scenario of content.content.scenarios) {
    expect(scenario.replay.factOptions.length).toBeGreaterThanOrEqual(2)
    expect(scenario.replay.inferenceOptions.length).toBeGreaterThanOrEqual(1)
    expect(scenario.replay.requestOptions.length).toBeGreaterThanOrEqual(2)
    expect(scenario.replay.practiceOptions.length).toBeGreaterThanOrEqual(1)
    expect(scenario.replay.practiceOptions.every((item) => item.replyOptions.length >= 2)).toBe(true)
  }
})
```

再增加稳定 kebab-case ID、情境内唯一 ID、非空解释、请求三段结构和练习 `responseId` 引用测试。

- [ ] **Step 2: 运行目标测试并确认失败**

```bash
pnpm test src/content/content.test.ts
```

预期：因 `scenario.replay` 不存在而失败。

- [ ] **Step 3: 定义 V2 类型**

```ts
export type FactOption = { id: string; label: string; explanation: string }
export type InferenceOption = { id: string; label: string; explanation: string }
export type RequestOption = {
  id: string
  label: string
  structure: { when: string; behavior: string; boundary: string }
}
export type PracticeReply = { id: string; label: string; action: NextStep['action'] }
export type PracticeOption = {
  id: string
  responseId: ResponseOption
  label: string
  replyOptions: PracticeReply[]
}
export type ScenarioReplayContent = {
  factOptions: FactOption[]
  inferenceOptions: InferenceOption[]
  requestOptions: RequestOption[]
  practiceOptions: PracticeOption[]
}
```

给 `ConversationScenario` 增加 `replay: ScenarioReplayContent`。

- [ ] **Step 4: 为 32 情境补齐 replay 数据**

每个情境机械使用冻结字段编写：

- `factOptions`：2–3 条带时间、频率或可观察行为的句子，第一条忠实改写 `description`。
- `inferenceOptions`：1–2 条来自该情境 `riskPoints` 和适用原表达的动机判断。
- `requestOptions`：2–3 条；第一条与 `rewrite.nextTimeLine` 一致，另外选项分别体现可协商边界与不采取普通沟通的暂停路径。
- `practiceOptions`：覆盖该情境现有 `responseIds`／`likelyResponses`，每项提供至少两个分别用于澄清、暂停、修复、协调或坚持边界的下一句。

安全级情境的请求和练习只提供离开、暂停、记录或寻求可信支持，不提供优化对质。

- [ ] **Step 5: 扩展运行时校验**

校验数组类型、最小数量、嵌套 ID、非空用户文案、请求 `when/behavior/boundary`、合法 `responseId`、合法 action、安全情境动作白名单，以及禁止诊断／操控文案。

- [ ] **Step 6: 重跑内容测试**

```bash
pnpm test src/content/content.test.ts
```

预期：现有计数测试与新增 V2 契约测试全部通过。

### Task 4: V2 草稿、筛选和结果纯函数

**Files:**
- Modify: `src/domain/types.ts`
- Create: `src/domain/replay.ts`
- Create: `src/domain/replay.test.ts`
- Modify: `src/domain/result.ts`
- Modify: `src/domain/result.test.ts`
- Modify: `src/domain/matching.ts`
- Modify: `src/domain/matching.test.ts`

**Interfaces:**
- Produces: `ReplayDraftV2`、`filterScenarioCatalog()`、`resolveScenario()`、`buildReplayLayers()`、`buildReplayResultV2()`。
- Consumes: Task 3 的 `ScenarioReplayContent` 和现有确定性匹配函数。

- [ ] **Step 1: 写筛选与具体情境锁定失败测试**

```ts
expect(filterScenarioCatalog(scenarios, { relationshipType: 'friend', communicationGoal: 'coordinate' })
  .every((scenario) => scenario.relationshipType === 'friend' && scenario.communicationGoalIds.includes('coordinate'))).toBe(true)
expect(resolveScenario({ ...completeDraft, scenarioId: 'friend-late' }, content).scenarioId).toBe('friend-late')
```

增加安全等级覆盖具体情境，以及“不确定”才调用 fallback 的测试。

- [ ] **Step 2: 写五层结果失败测试**

断言 `buildReplayResultV2()` 返回选中事实、感受标签、推测、需要、请求结构、三语气、演练和下一步；安全结果不包含普通演练。

- [ ] **Step 3: 运行目标测试并确认失败**

```bash
pnpm test src/domain/replay.test.ts src/domain/result.test.ts src/domain/matching.test.ts
```

- [ ] **Step 4: 定义草稿类型与纯函数**

```ts
export type ReplayDraftV2 = {
  scenarioId?: string
  relationshipType?: RelationshipType
  communicationGoal?: CommunicationGoal
  conflictLevel?: ConflictLevel
  factOptionIds: string[]
  feelingIds: string[]
  feelingIntensity?: 'light' | 'clear' | 'strong'
  inferenceOptionIds: string[]
  needIds: string[]
  requestOptionId?: string
  selectedTone?: ToneVariant
  practiceOptionId?: string
  practiceReplyId?: string
  limitedEdits: Partial<Record<ToneVariant, string>>
}
```

实现 `filterScenarioCatalog()`、`resolveScenario()`、严格引用解析和稳定排序；`buildReplayLayers(draft, content)` 返回五层用户可见标签与解释；`buildReplayResultV2(draft, content)` 组合五层、三语气、演练和下一步，安全结果省略普通演练。

- [ ] **Step 5: 重跑目标测试**

```bash
pnpm test src/domain/replay.test.ts src/domain/result.test.ts src/domain/matching.test.ts
```

预期：新增和现有领域测试全部通过。

### Task 5: V2 状态机与 v1 存储迁移

**Files:**
- Modify: `src/state/replayState.ts`
- Modify: `src/state/replayState.test.ts`
- Modify: `src/storage/storage.ts`
- Modify: `src/storage/storage.test.ts`

**Interfaces:**
- Produces: `ReplayPageV2`、`ReplayStepV2`、`ReplayActionV2`、schema v2 envelope、`migrateV1ToV2()`。
- Consumes: Task 4 的 `ReplayDraftV2`。

- [ ] **Step 1: 写 V2 页面流失败测试**

覆盖 `landing → privacy → guide → relationship → goal → scenario → fact → feeling → inference → need → request → draft → practice → comparison → result`，以及 guide 跳过、安全跳转、帮助召回和返回焦点目标。

- [ ] **Step 2: 写修改清理失败测试**

```ts
const changed = replayReducer(completedState, { type: 'SET_SCENARIO', scenarioId: 'friend-cancel' })
expect(changed.draft.factOptionIds).toEqual([])
expect(changed.draft.feelingIds).toEqual([])
expect(changed.draft.scenarioId).toBe('friend-cancel')
```

关系改变清理情境及五层；感受改变不清理事实；请求改变只清理演练及结果。

- [ ] **Step 3: 写存储迁移失败测试**

使用现有 v1 fixture，断言迁移保留保存模式、情境、关系、目标、情绪和三份上限；无法映射的 v1 字段不伪造 V2 选项，并返回恢复说明。

- [ ] **Step 4: 运行目标测试并确认失败**

```bash
pnpm test src/state/replayState.test.ts src/storage/storage.test.ts
```

- [ ] **Step 5: 实现 V2 reducer 与存储**

页面和步骤使用判别联合；所有 action 明确清理边界。schema v2 递归拒绝媒体字段、未知字段、`data:`／`blob:` 内容和超长文本。有限编辑按每语气 280 个 Unicode 字符截断并在界面提示。

- [ ] **Step 6: 重跑目标测试**

```bash
pnpm test src/state/replayState.test.ts src/storage/storage.test.ts
```

预期：迁移、损坏恢复、未来 schema、失效引用和三份上限全部通过。

### Task 6: 页面 ViewModel 与资源清单

**Files:**
- Create: `src/assets/manifest.ts`
- Create: `src/assets/manifest.test.ts`
- Modify: `src/app/view.ts`
- Modify: `src/app/view.test.ts`

**Interfaces:**
- Produces: `ICON_PATHS`、`GUIDE_ASSETS`、`buildScreenViewModelV2()`。
- Consumes: Phase A 文件、Task 3 内容、Task 4 结果、Task 5 状态。

- [ ] **Step 1: 写资源清单失败测试**

```ts
expect(Object.keys(ICON_PATHS)).toHaveLength(17)
expect(GUIDE_ASSETS.master).toBe('/assets/guide/chiyan-guide-master.webp')
```

- [ ] **Step 2: 写 24 状态 ViewModel 失败测试**

为设计规格列出的每个状态断言 eyebrow、标题、主动作、可恢复动作和业务选项来自内容包；安全状态不得返回普通 practice。

- [ ] **Step 3: 运行目标测试并确认失败**

```bash
pnpm test src/assets/manifest.test.ts src/app/view.test.ts
```

- [ ] **Step 4: 实现固定资源清单和 V2 ViewModel**

资源清单只包含 Phase A 已验收路径。ViewModel 为情境筛选、五步、语气、演练、结果、安全、退出和恢复提供页面所需字段；React 不读取情境内部引用。

- [ ] **Step 5: 重跑目标测试**

```bash
pnpm test src/assets/manifest.test.ts src/app/view.test.ts
```

### Task 7: 拆分应用外壳与入口流程

**Files:**
- Modify: `src/App.tsx`
- Create: `src/components/QuietShell.tsx`
- Create: `src/components/TopRail.tsx`
- Create: `src/components/PrivacyStamp.tsx`
- Create: `src/components/ChiyanGuide.tsx`
- Create: `src/features/scenario/ScenarioNavigator.tsx`
- Create: `src/features/scenario/ScenarioList.tsx`
- Create: `src/features/scenario/ScenarioDetail.tsx`
- Create: `src/features/intro/IntroScreens.tsx`

**Interfaces:**
- Produces: 封面、隐私、迟言、关系、目标、3–6 个匹配情境与确认页。
- Consumes: Task 5 reducer、Task 6 ViewModel 和 Phase A 资源。

- [ ] **Step 1: 用现有纯视图测试定义入口结构**

断言首页主标题、隐私四项、guide 三页可跳过、关系／目标单步选择、匹配结果不超过 6 个、明确“不确定”入口和返回行为。

- [ ] **Step 2: 运行入口相关测试并确认失败**

```bash
pnpm test src/app/view.test.ts src/state/replayState.test.ts
```

- [ ] **Step 3: 实现组件**

`App.tsx` 只负责 bootstrap、reducer、存储适配和页面路由；入口业务文案全部来自 ViewModel。迟言图片提供宽高、占位图、错误降级文字、跳过和继续动作。

- [ ] **Step 4: 重跑入口相关测试**

```bash
pnpm test src/app/view.test.ts src/state/replayState.test.ts
```

### Task 8: 五步编辑台与可访问纸条移动

**Files:**
- Create: `src/features/replay/StepRail.tsx`
- Create: `src/features/replay/ReplayStep.tsx`
- Create: `src/features/replay/SentenceDesk.tsx`
- Create: `src/features/replay/SemanticSlip.tsx`
- Create: `src/features/replay/MarginNote.tsx`
- Create: `src/features/replay/replayInteraction.ts`
- Create: `src/features/replay/replayInteraction.test.ts`

**Interfaces:**
- Produces: 五步选择、纸条移动命令、撤回命令、ARIA 宣告文本。
- Consumes: `ReplayDraftV2` 和 `buildScreenViewModelV2()`。

- [ ] **Step 1: 写交互纯函数失败测试**

```ts
expect(moveSlip({ factIds: ['fact-1'], inferenceIds: [] }, 'fact-1', 'inference'))
  .toEqual({ factIds: [], inferenceIds: ['fact-1'], announcement: '已移到推测：fact-1' })
expect(undoMove(moved, 'fact-1').factIds).toEqual(['fact-1'])
```

增加最大选择数、重复 ID、键盘取消和 reduced-motion 静态模式测试。

- [ ] **Step 2: 运行目标测试并确认失败**

```bash
pnpm test src/features/replay/replayInteraction.test.ts
```

- [ ] **Step 3: 实现五步组件**

事实、感受、需要限制 1–2 项；请求单选；解释可展开。`SemanticSlip` 提供按钮移动和撤回；增强拖动不得成为唯一入口。移动完成后聚焦分类理由，`aria-live` 宣告结果。

- [ ] **Step 4: 实现 reduced-motion 等价**

CSS 媒体查询禁用位移；DOM 同时提供原位置划去、目标位置文本、箭头和分类原因。

- [ ] **Step 5: 重跑目标和状态测试**

```bash
pnpm test src/features/replay/replayInteraction.test.ts src/state/replayState.test.ts
```

### Task 9: 草稿、三语气、演练与结果卡

**Files:**
- Create: `src/features/result/ToneSwitcher.tsx`
- Create: `src/features/result/PracticeBoard.tsx`
- Create: `src/features/result/BeforeAfter.tsx`
- Create: `src/features/result/ReplayCard.tsx`
- Create: `src/features/result/exportReplayCard.ts`
- Create: `src/features/result/exportReplayCard.test.ts`

**Interfaces:**
- Produces: 三语气切换、有限编辑、演练、表达对比、结果卡与用户触发的临时下载。
- Consumes: Task 4 结果和 Task 6 ViewModel。

- [ ] **Step 1: 写导出序列化失败测试**

断言导出内容只包含用户可见标题、五层摘要和选中语气；不得包含隐藏句、安全内部标签、存储 ID 或诊断编号。特殊字符必须 XML 转义。

- [ ] **Step 2: 运行目标测试并确认失败**

```bash
pnpm test src/features/result/exportReplayCard.test.ts
```

- [ ] **Step 3: 实现三语气和有限编辑**

三个页签同尺寸、同权重；每语气编辑上限 280 字，显示剩余字数。缺失语气回退综合稿并显示明确说明。

- [ ] **Step 4: 实现演练和对比**

`PracticeBoard` 使用纸面回应卡和下一句选项，不使用头像、气泡或预测措辞。`BeforeAfter` 使用“容易被听成／更明确表达”，不使用错误／正确。

- [ ] **Step 5: 实现临时结果卡导出**

将经过转义的可见 ViewModel 绘制到临时 Canvas 或 SVG，用户点击后立即下载；不写入 localStorage／IndexedDB，不把 data URL 或 Blob 放入 React state，下载后撤销对象 URL。

- [ ] **Step 6: 重跑目标和结果测试**

```bash
pnpm test src/features/result/exportReplayCard.test.ts src/domain/result.test.ts
```

### Task 10: 保存、退出、安全、帮助与恢复页面

**Files:**
- Create: `src/features/system/SavedResults.tsx`
- Create: `src/features/system/ExitSheet.tsx`
- Create: `src/features/system/SafetyNotice.tsx`
- Create: `src/features/system/RecoveryPanel.tsx`
- Create: `src/features/system/GuideRecall.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Produces: 三份收藏、第四份覆盖、无痕退出、安全优先、保存失败、坏档和迟言召回完整页面。
- Consumes: Task 5 存储、Task 6 ViewModel、Phase A 图标与头像。

- [ ] **Step 1: 扩充状态与存储失败测试**

断言退出清单列出当前实际存在的情境、五步、语气编辑与隐藏项；第四份覆盖显示最旧标题与时间；保存失败保留 draft；安全页面不显示普通草稿主动作；关闭帮助恢复原焦点和步骤。

- [ ] **Step 2: 运行目标测试并确认失败**

```bash
pnpm test src/state/replayState.test.ts src/storage/storage.test.ts src/app/view.test.ts
```

- [ ] **Step 3: 实现系统页面**

所有确认使用项目内页面／sheet，不依赖 `window.confirm`。清除操作明确目标；保存失败提供重试、复制、临时下载和返回编辑；安全页面提供清除本次内容与可信支持说明。

- [ ] **Step 4: 重跑目标测试**

```bash
pnpm test src/state/replayState.test.ts src/storage/storage.test.ts src/app/view.test.ts
```

### Task 11: 完整视觉系统、响应式与安全区

**Files:**
- Modify: `src/App.css`
- Modify: `src/index.css`
- Modify: `index.html`

**Interfaces:**
- Produces: 暖白纸面、五步纸条、批注、三语气、动效、响应式、焦点和安全区样式。
- Consumes: Tasks 7–10 组件 class names 与 Phase A 资源。

- [ ] **Step 1: 建立设计 token**

```css
:root {
  --paper: #f5f2eb;
  --ink: #303735;
  --line: #d8d2c7;
  --blue: #6e8490;
  --sage: #82917f;
  --ochre: #b18a52;
  --rose-muted: #a87972;
  --safety: #8c554d;
  --safe-area-inset-top: env(safe-area-inset-top, 0px);
}
```

- [ ] **Step 2: 实现纸面、组件与移动优先布局**

375／390 单列；430 主区单列并允许短批注侧栏；宽屏才使用事实／推测双栏。按钮最小高度 48px，长词设置 `overflow-wrap:anywhere`，所有 Grid 子项使用 `min-width:0`。

- [ ] **Step 3: 实现动效与 reduced-motion**

页面 160–200ms；事实到推测 220ms 短直线路径；语气 140–180ms。reduced-motion 禁止位移和连续动画，保留静态对照。

- [ ] **Step 4: 实现 sticky 与锚点安全区**

```css
.top-rail { top: var(--safe-area-inset-top, env(safe-area-inset-top, 0px)); }
[data-anchor] { scroll-margin-top: calc(var(--safe-area-inset-top, env(safe-area-inset-top, 0px)) + var(--top-rail-height) + 16px); }
```

- [ ] **Step 5: 运行静态门禁**

```bash
pnpm lint
pnpm test
pnpm build
```

预期：全部通过且构建无外部运行时资源请求。

### Task 12: 浏览器全流程验收与报告

**Files:**
- Modify: `VISUAL-QA.md`
- Modify: `PREP_REPORT.md`
- Modify: `TODO.md`

**Interfaces:**
- Produces: 可审计的三宽、完整路径、资源和门禁证据。
- Consumes: Tasks 1–11 的最终静态应用。

- [ ] **Step 1: 启动生产预览并验证资源**

```bash
pnpm build
pnpm preview --host 127.0.0.1
```

检查 3 个 WebP、17 个 SVG 全部 200 且浏览器正常解码，控制台 0 error。

- [ ] **Step 2: 验证三个手机视口**

在 375×812、390×844、430×932 分别跑普通完整路径，记录 `document.scrollWidth === viewportWidth`、最小按钮高度 ≥48px、顶部控件未遮挡、结果卡无截断。

- [ ] **Step 3: 验证非零安全区**

在根元素设置 `--safe-area-inset-top:32px`，逐一验证 sticky 顶栏、页面标题、纸条分类理由、错误标题和锚点目标不被遮挡。

- [ ] **Step 4: 验证特殊路径**

跑安全优先、无痕退出、第四份覆盖、IndexedDB 不可用、v1 存档迁移、坏存档、图片加载失败、reduced-motion 和纯键盘路径。

- [ ] **Step 5: 验证内容压力**

使用现有测试夹具覆盖长中文、连续英文、emoji、换行和特殊字符，确认无横向溢出、XML 注入或意外导出隐藏数据。

- [ ] **Step 6: 执行最终门禁**

```bash
pnpm lint && pnpm test && pnpm build
```

预期：三项全部通过。

- [ ] **Step 7: 更新项目证据**

在 `VISUAL-QA.md` 记录视口、路径、安全区、资源解码和控制台结果；在 `PREP_REPORT.md` 记录 schema v2、测试数量、构建结果与隐私边界；在 `TODO.md` 勾选实际完成项，未验证项保持未完成并写明原因。

- [ ] **Step 8: 检查修改范围**

```bash
git diff --name-only -- projects/07-conversation-replay
```

预期：只出现 `projects/07-conversation-replay/**`。
