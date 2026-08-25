# SHBTI 闻山陪行与中文显形 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 SHBTI 的用户界面统一为中文维度表达，扩展闻山的状态驱动陪行与预设问答，并加入短促、可跳过、可降级的卷册动画。

**Architecture:** 内部维度代码、结果代码、计分与存储 schema 保持不变；内容包增加品牌、中文维度显示和闻山问答契约，显示层只消费中文视图模型。闻山当前台词由纯函数派生，问答选择与动画步骤保持为组件瞬时状态，统一复用现有 `GuideSheet` 的焦点、inert 和图片降级能力。

**Tech Stack:** React 19、TypeScript 6、Vite 8、Vitest、原生 CSS、localStorage、Playwright CLI

**Spec:** `projects/01-sbti/NPC-INTERACTION-ANIMATION-DESIGN.md`

## Global Constraints

- 只修改 `projects/01-sbti`。
- 正式名固定为 `SHBTI｜山海兽格测试`。
- 英文释义固定为 `Shan Hai Beast Temperament Indicator`，只出现在关于测试或完整说明区域。
- 中文解释固定为 `山海异兽性格倾向指标`。
- 产品边界固定为“娱乐性自我探索工具，不是专业心理测评”。
- 用户可见界面、无障碍名称、动画文字和分享文案不得出现内部维度代码或四字母结果代码。
- 不改变 48 题、每局 24 题、四选项、四维计分、十六种异兽映射或存储 schema。
- 不新增依赖、后端、运行时 CDN、外部 API、自由聊天、剧情分支或新计分维度。
- 不生成图片；新增美术资源未生成并验收前，运行时代码不得引用其路径。
- 不修改其他项目、根配置、锁文件、`docs/` 或 `prep/`。
- 不自动格式化既有 CRLF 文档，不提交或推送。

---

### Task 1: 冻结品牌、中文维度与闻山主题内容契约

**Files:**
- Modify: `projects/01-sbti/src/content/types.ts`
- Modify: `projects/01-sbti/src/content/content.json`
- Modify: `projects/01-sbti/src/content/validate.ts`
- Modify: `projects/01-sbti/src/content/content.test.ts`

**Interfaces:**
- Consumes: 现有 `ExperienceCopy`、`DimensionDefinition`、`GuideCopy`。
- Produces: `BrandIdentityCopy`、`GuideTopicCopy`、`QuizCompanionCopy`，以及带 `displayName` 的 `DimensionDefinition`。

- [ ] **Step 1: 写品牌与中文维度失败测试**

在 `content.test.ts` 增加断言：

```ts
it('requires the formal SHBTI identity and Chinese dimension display names', () => {
  const content = validateContent(rawContent)
  expect(content.content.experience.identity).toEqual({
    formalName: 'SHBTI｜山海兽格测试',
    englishExpansion: 'Shan Hai Beast Temperament Indicator',
    chineseMeaning: '山海异兽性格倾向指标',
    boundary: '娱乐性自我探索工具，不是专业心理测评。',
  })
  expect(content.content.dimensions.map((item) => item.displayName)).toEqual([
    '与世界相遇', '理解线索', '衡量选择', '面对变化',
  ])
})
```

- [ ] **Step 2: 写闻山问答契约失败测试**

增加测试，要求答题帮助和结果帮助各恰好三项、ID 唯一、标签与回答非空：

```ts
it('requires three unique quiz and result guide topics', () => {
  const guide = validateContent(rawContent).content.experience.guide
  expect(guide.quizCompanion.topics).toHaveLength(3)
  expect(guide.resultHelp.topics).toHaveLength(3)
  expect(new Set(guide.quizCompanion.topics.map((item) => item.id)).size).toBe(3)
  expect(new Set(guide.resultHelp.topics.map((item) => item.id)).size).toBe(3)
})
```

- [ ] **Step 3: 运行测试并确认契约缺失**

Run: `pnpm exec vitest run src/content/content.test.ts`

Expected: FAIL，指出 `identity`、`displayName` 或 `quizCompanion` 尚不存在。

- [ ] **Step 4: 扩展类型**

在 `types.ts` 增加：

```ts
export type BrandIdentityCopy = {
  formalName: 'SHBTI｜山海兽格测试'
  englishExpansion: 'Shan Hai Beast Temperament Indicator'
  chineseMeaning: '山海异兽性格倾向指标'
  boundary: '娱乐性自我探索工具，不是专业心理测评。'
}

export type GuideTopicCopy = {
  id: string
  label: string
  answer: string
}

export type QuizCompanionCopy = {
  title: string
  phase: Record<ChapterCode, { opening: string; middle: string; closing: string }>
  selected: string
  revisiting: string
  topics: [GuideTopicCopy, GuideTopicCopy, GuideTopicCopy]
}
```

将 `DimensionDefinition` 增加 `displayName: string`；将 `ExperienceCopy` 增加 `identity: BrandIdentityCopy`；将 `GuideCopy` 删除被替代的 `quizHelp`、增加 `quizCompanion: QuizCompanionCopy`，并把 `resultHelp` 改为：

```ts
resultHelp: {
  prompt: string
  title: string
  topics: [GuideTopicCopy, GuideTopicCopy, GuideTopicCopy]
}
```

- [ ] **Step 5: 在内容包写入完整业务文案**

`identity` 使用全局约束中的四个固定值。四个 `displayName` 依次使用“与世界相遇、理解线索、衡量选择、面对变化”。

`quizCompanion.topics` 固定为：

```json
[
  { "id": "choosing", "label": "这一题应该怎么选？", "answer": "选四种行动里你更可能真的采取的一种，不必寻找标准答案，也不必猜测它对应哪种兽格。" },
  { "id": "editing", "label": "落印以后还能修改吗？", "answer": "可以。返回旧页或在前进前换一张行动签，最终只记录你确认后的选择。" },
  { "id": "privacy", "label": "答案会保存到哪里？", "answer": "答案只作为结构化进度保存在这台设备的浏览器中，不会上传图片、音视频或其他个人文件。" }
]
```

`resultHelp.topics` 固定使用 ID `dimensions`、`neighbor`、`cultural-boundary`，复用现有三段回答并补充对应中文问题标签。

- [ ] **Step 6: 扩展校验器**

校验四个品牌字段为固定值；校验每个维度的 `displayName` 非空且唯一；新增 `guideTopicsAt()`，要求数组恰好三项、ID 为 kebab-case、ID 唯一、`label` 与 `answer` 非空；校验 `quizCompanion.phase` 覆盖四章及 `opening/middle/closing`。

- [ ] **Step 7: 运行内容测试**

Run: `pnpm exec vitest run src/content/content.test.ts`

Expected: PASS。

- [ ] **Step 8: 无提交检查点**

Run: `git diff --check -- projects/01-sbti/src/content`

Expected: 无输出。保留工作树，不提交。

---

### Task 2: 建立答题闻山台词的纯派生层

**Files:**
- Create: `projects/01-sbti/src/guide/quizCompanion.ts`
- Create: `projects/01-sbti/src/guide/quizCompanion.test.ts`

**Interfaces:**
- Consumes: `ChapterCode`、`QuizCompanionCopy`、当前题号、是否已选和是否返回旧题。
- Produces: `deriveQuizCompanionLine(input, copy): string`。

- [ ] **Step 1: 写六类状态的失败测试**

```ts
expect(deriveQuizCompanionLine({ chapter: 'entry', current: 1, selected: false, revisiting: false }, copy)).toBe(copy.phase.entry.opening)
expect(deriveQuizCompanionLine({ chapter: 'entry', current: 3, selected: false, revisiting: false }, copy)).toBe(copy.phase.entry.middle)
expect(deriveQuizCompanionLine({ chapter: 'entry', current: 6, selected: false, revisiting: false }, copy)).toBe(copy.phase.entry.closing)
expect(deriveQuizCompanionLine({ chapter: 'trace', current: 8, selected: true, revisiting: false }, copy)).toBe(copy.selected)
expect(deriveQuizCompanionLine({ chapter: 'trace', current: 7, selected: true, revisiting: true }, copy)).toBe(copy.revisiting)
```

- [ ] **Step 2: 运行测试并确认函数缺失**

Run: `pnpm exec vitest run src/guide/quizCompanion.test.ts`

Expected: FAIL，模块或导出不存在。

- [ ] **Step 3: 实现纯函数**

```ts
export function deriveQuizCompanionLine(input: QuizCompanionInput, copy: QuizCompanionCopy) {
  if (input.revisiting) return copy.revisiting
  if (input.selected) return copy.selected
  const offset = (input.current - 1) % 6
  const phase = offset < 2 ? 'opening' : offset < 4 ? 'middle' : 'closing'
  return copy.phase[input.chapter][phase]
}
```

- [ ] **Step 4: 运行测试**

Run: `pnpm exec vitest run src/guide/quizCompanion.test.ts`

Expected: PASS。

- [ ] **Step 5: 无提交检查点**

Run: `git diff --check -- projects/01-sbti/src/guide`

Expected: 无输出。

---

### Task 3: 建立复用现有模态能力的三问闻山卷页

**Files:**
- Modify: `projects/01-sbti/src/components/guide/GuideSheet.tsx`
- Create: `projects/01-sbti/src/components/guide/GuideTopicSheet.tsx`
- Create: `projects/01-sbti/src/components/guide/GuideTopicSheet.test.tsx`
- Modify: `projects/01-sbti/src/App.css`

**Interfaces:**
- Consumes: `GuideTopicCopy[]`、闻山姓名与身份、标题、关闭回调和焦点归还 ref。
- Produces: `GuideTopicSheet`，一次显示一个回答并复用 `GuideSheet` 的焦点循环、背景 inert、Escape 和图片降级。

- [ ] **Step 1: 写默认主题的失败测试**

使用 `renderToStaticMarkup()` 渲染三项主题，断言三个问题按钮均存在、首项回答可见、其余回答不可见，并且不存在自由输入控件。

```ts
expect(html).toContain('这一题应该怎么选？')
expect(html).toContain('落印以后还能修改吗？')
expect(html).toContain('答案会保存到哪里？')
expect(html).toContain(topics[0].answer)
expect(html).not.toContain('<textarea')
```

- [ ] **Step 2: 运行测试并确认组件缺失**

Run: `pnpm exec vitest run src/components/guide/GuideTopicSheet.test.tsx`

Expected: FAIL，模块不存在。

- [ ] **Step 3: 为 GuideSheet 增加组合插槽**

在 `GuideSheetProps` 增加 `children?: ReactNode`，在 `.guide-lines` 之前渲染 `{props.children}`。不改变现有标题聚焦、Tab 循环、inert、Escape 或焦点归还实现。

- [ ] **Step 4: 实现 GuideTopicSheet**

组件内部以首项 ID 初始化 `activeId`，用普通按钮与 `aria-pressed` 表达当前主题；把当前回答作为 `GuideSheet.lines` 传入。独立复核后放弃不完整的 tab 语义，避免引入并未实现的方向键与 roving focus 契约。

- [ ] **Step 5: 增加主题签样式**

新增 `.guide-topics`、`.guide-topic` 和 `.guide-topic--active`。三项在 375–430px 保持单列或可自然换行，不使用横向滚动；最小触控高度 44px。

- [ ] **Step 6: 运行组件测试**

Run: `pnpm exec vitest run src/components/guide/GuideTopicSheet.test.tsx src/components/guide/GuideMarkup.test.tsx`

Expected: PASS。

- [ ] **Step 7: 无提交检查点**

Run: `git diff --check -- projects/01-sbti/src/components/guide projects/01-sbti/src/App.css`

Expected: 无输出。

---

### Task 4: 将答题页升级为状态驱动的闻山守卷席

**Files:**
- Modify: `projects/01-sbti/src/components/QuizExperience.tsx`
- Modify: `projects/01-sbti/src/components/QuizPage.tsx`
- Modify: `projects/01-sbti/src/components/QuizPrimitives.test.tsx`
- Create: `projects/01-sbti/src/components/QuizCompanion.test.tsx`

**Interfaces:**
- Consumes: Task 2 的 `deriveQuizCompanionLine()` 和 Task 3 的 `GuideTopicSheet`。
- Produces: 每题动态闻山台词、返回旧题识别和三问闻山入口；不修改正式答题状态。

- [ ] **Step 1: 写动态台词标记测试**

让 `QuizPage` 接收必填 `guideLine: string`，静态渲染时断言该文本进入 `GuidePresence`，不再固定取 `guide.quizHelp[0]`。

- [ ] **Step 2: 运行测试并确认接口缺失**

Run: `pnpm exec vitest run src/components/QuizPrimitives.test.tsx src/components/QuizCompanion.test.tsx`

Expected: FAIL，`guideLine` 尚未进入组件接口或 DOM。

- [ ] **Step 3: 在 QuizExperience 派生返回状态**

使用 `maxCurrentRef` 记录本次挂载期间到达过的最大题号。`props.current < maxCurrentRef.current` 时为返回旧题；在 effect 中将最大题号更新为 `Math.max(previous, props.current)`。刷新恢复不伪装成返回行为。

- [ ] **Step 4: 传入动态台词**

使用当前章节 ID、题号、`Boolean(selectedOptionId)` 和返回状态调用 `deriveQuizCompanionLine()`，把结果传给 `QuizPage.guideLine`。

- [ ] **Step 5: 替换帮助卷页**

用 `GuideTopicSheet` 替换答题中的普通 `GuideSheet`，标题和三项主题全部从 `guide.quizCompanion` 获取。打开、关闭、焦点归还和章节过场优先级保持不变。

- [ ] **Step 6: 运行测试**

Run: `pnpm exec vitest run src/components/QuizPrimitives.test.tsx src/components/QuizCompanion.test.tsx src/guide/interludeState.test.ts`

Expected: PASS；第 6→7→6→7 题仍不重复收卷。

- [ ] **Step 7: 无提交检查点**

Run: `git diff --check -- projects/01-sbti/src/components/QuizExperience.tsx projects/01-sbti/src/components/QuizPage.tsx`

Expected: 无输出。

---

### Task 5: 从用户界面移除内部维度和结果代码

**Files:**
- Create: `projects/01-sbti/src/quiz/presentation.ts`
- Create: `projects/01-sbti/src/quiz/presentation.test.ts`
- Modify: `projects/01-sbti/src/components/CalculatingPage.tsx`
- Modify: `projects/01-sbti/src/components/RevealSequence.tsx`
- Modify: `projects/01-sbti/src/components/RevealSequence.test.tsx`
- Modify: `projects/01-sbti/src/components/ResultPage.tsx`
- Modify: `projects/01-sbti/src/components/ResultGuide.test.tsx`
- Modify: `projects/01-sbti/src/App.tsx`

**Interfaces:**
- Consumes: `DimensionDefinition[]`、`DimensionResult[]`、结果异兽名和中文兽格名。
- Produces: `toDimensionDisplay()` 与 `formatResultIdentity()`，所有用户显示只含中文。

- [ ] **Step 1: 写中文维度视图模型测试**

```ts
expect(toDimensionDisplay(result, definition)).toEqual({
  title: '与世界相遇',
  left: '应世',
  right: '隐世',
  preferred: '应世',
  strengthLabel: result.label,
})
expect(formatResultIdentity('陆吾', '山司型')).toBe('陆吾 · 山司型')
```

- [ ] **Step 2: 写用户界面禁码失败测试**

更新揭晓、结果和分享预览静态渲染测试，断言包含四个中文维度标题，并断言不匹配：

```ts
expect(html).not.toMatch(/>\s*(RH|TV|LE|SM)\s*</)
expect(html).not.toContain(result.code)
expect(html).not.toContain(result.summary.neighborCode)
```

- [ ] **Step 3: 运行测试并确认当前英文字母泄漏**

Run: `pnpm exec vitest run src/quiz/presentation.test.ts src/components/RevealSequence.test.tsx src/components/ResultGuide.test.tsx`

Expected: FAIL，揭晓仍渲染内部维度代码，分享预览仍渲染结果代码。

- [ ] **Step 4: 实现中文视图模型**

`toDimensionDisplay()` 只从 `DimensionDefinition.displayName`、两个 pole 的中文名称和 `DimensionResult.preferredPole` 生成显示对象；内部代码只用于查找，不进入返回字段。

- [ ] **Step 5: 改造揭晓组件**

`RevealSequence` 接收 `dimensions: DimensionDefinition[]`，四枚卷印显示 `displayName` 和两侧中文倾向。组件 key 可以继续使用内部 code，但 DOM 文本与 aria-label 不得包含它。

当前显形阶段不提前展示真实偏向，避免为动画改变结果计算时机；真实偏向在兽志结果页的连续倾向条显示。

- [ ] **Step 6: 改造结果与分享显示**

删除 `ResultPage` 的 `DIMENSION_COPY` 硬编码，改为接收 `dimensionDefinitions` 并调用 `toDimensionDisplay()`。分享卡 `<small>` 只显示免责声明，不显示 `share.code`。相邻兽格标签改为必填中文 `neighborLabel`，不得回退到 `neighborCode`。

- [ ] **Step 7: 在 App 传入中文定义**

将 `content.content.dimensions` 传给 `CalculatingPage` 和 `ResultPage`。如果相邻结果映射缺失，抛出内容错误或进入现有内容恢复路径，不以内部代码兜底。

- [ ] **Step 8: 运行测试**

Run: `pnpm exec vitest run src/quiz/presentation.test.ts src/components/RevealSequence.test.tsx src/components/ResultGuide.test.tsx`

Expected: PASS，用户 DOM 中无内部代码。

- [ ] **Step 9: 无提交检查点**

Run: `git diff --check -- projects/01-sbti/src/quiz projects/01-sbti/src/components projects/01-sbti/src/App.tsx`

Expected: 无输出。

---

### Task 6: 在品牌说明和结果页接入正式 SHBTI 定义

**Files:**
- Modify: `projects/01-sbti/src/components/LandingPage.tsx`
- Modify: `projects/01-sbti/src/components/IntroPage.tsx`
- Modify: `projects/01-sbti/src/components/ResultPage.tsx`
- Create: `projects/01-sbti/src/components/BrandIdentity.test.tsx`

**Interfaces:**
- Consumes: Task 1 的 `BrandIdentityCopy`。
- Produces: 首页正式名、测前完整解释、结果页底部产品边界；英文释义不进入答题或结果主体。

- [ ] **Step 1: 写品牌位置失败测试**

断言首页包含完整正式名和中文解释；测前说明的展开区域包含英文释义；结果页底部包含中文解释与产品边界；答题与显形静态 DOM 不包含英文释义。

- [ ] **Step 2: 运行测试并确认缺失**

Run: `pnpm exec vitest run src/components/BrandIdentity.test.tsx`

Expected: FAIL，页面尚未接收 `identity`。

- [ ] **Step 3: 接入品牌定义**

为 `LandingPage`、`IntroPage` 和 `ResultPage` 增加 `identity` prop。首页品牌锁定使用 `formalName`；中文解释位于次级说明。英文释义只放入测前 `<details>`；结果页底部只显示中文解释和边界。

- [ ] **Step 4: 运行测试**

Run: `pnpm exec vitest run src/components/BrandIdentity.test.tsx`

Expected: PASS。

- [ ] **Step 5: 无提交检查点**

Run: `git diff --check -- projects/01-sbti/src/components projects/01-sbti/src/App.tsx`

Expected: 无输出。

---

### Task 7: 增加短促、可降级的卷册动画

**Files:**
- Modify: `projects/01-sbti/src/components/ChoiceSlip.tsx`
- Modify: `projects/01-sbti/src/components/VolumeProgress.tsx`
- Modify: `projects/01-sbti/src/components/guide/GuidePresence.tsx`
- Modify: `projects/01-sbti/src/components/ChapterInterlude.tsx`
- Modify: `projects/01-sbti/src/components/RevealSequence.tsx`
- Modify: `projects/01-sbti/src/App.css`
- Modify: `projects/01-sbti/src/components/QuizPrimitives.test.tsx`

**Interfaces:**
- Consumes: 现有 selected、完成卷、显形 step 和 `html[data-reduced-motion]` 状态。
- Produces: 行动签落印、闻山台词墨迹交替、卷印压印、递卷/收卷和中文显形动画。

- [ ] **Step 1: 写语义终态测试**

测试 selected 行动签具有 `data-state="selected"`；完成卷具有文本或 `aria-label` 的“已完成”；减少动态的揭晓首次渲染直接包含四个中文维度和“展开兽志”。

- [ ] **Step 2: 运行测试并确认状态标记缺失**

Run: `pnpm exec vitest run src/components/QuizPrimitives.test.tsx src/components/RevealSequence.test.tsx`

Expected: FAIL，部分 `data-state` 或中文揭晓终态尚未实现。

- [ ] **Step 3: 增加稳定 DOM 状态标记**

为 `ChoiceSlip`、`VolumeProgress`、`GuidePresence`、`ChapterInterlude` 和 `RevealSequence` 增加基于真实状态的 `data-state` 或 BEM modifier。动画只依赖这些状态，不新增持久化字段。

- [ ] **Step 4: 实现标准动画**

在 `App.css` 增加：

- `choice-ink-trace`：160–200ms 边缘墨线。
- `choice-seal-drop`：180ms 朱印缩放与 2–4 度偏转。
- `guide-ink-swap`：120–180ms 台词墨迹交替。
- `volume-seal-press`：220–320ms 完成压印。
- `sheet-pass`：400–650ms 递卷/收卷。
- `dimension-unfurl`：四枚中文维度在总计不超过 1.4s 内出现。
- `result-paper-reveal`：300–500ms 夜墨到暖纸。

- [ ] **Step 5: 完整减少动态覆盖**

在 `@media (prefers-reduced-motion: reduce)` 与 `html[data-reduced-motion="true"]` 下统一取消 animation、transition、transform 和循环雾气；保留边框、朱印、完成文字和全部按钮。

- [ ] **Step 6: 运行测试与 lint**

Run: `pnpm exec vitest run src/components/QuizPrimitives.test.tsx src/components/RevealSequence.test.tsx && pnpm lint`

Expected: PASS，lint 0 warning、0 error。

- [ ] **Step 7: 无提交检查点**

Run: `git diff --check -- projects/01-sbti/src`

Expected: 无输出。

---

### Task 8: 将结果帮助改为三问闻山并保持异兽主视觉

**Files:**
- Modify: `projects/01-sbti/src/components/ResultPage.tsx`
- Modify: `projects/01-sbti/src/components/ResultGuide.test.tsx`
- Modify: `projects/01-sbti/src/App.css`

**Interfaces:**
- Consumes: `GuideTopicSheet`、`guide.resultHelp.topics`、中文结果身份和中文维度视图模型。
- Produces: 结果稳定后出现的次级闻山入口及可切换的三项解释。

- [ ] **Step 1: 写结果三问失败测试**

断言结果帮助卷页包含“三问闻山”的三个中文问题、默认只显示首个回答、页面主标题仍先于闻山入口，并且不存在结果代码。

- [ ] **Step 2: 运行测试并确认当前一次铺满三段**

Run: `pnpm exec vitest run src/components/ResultGuide.test.tsx`

Expected: FAIL，当前仍使用普通 `GuideSheet` 一次显示三段。

- [ ] **Step 3: 接入 GuideTopicSheet**

用 `GuideTopicSheet` 替换结果帮助的普通 `GuideSheet`。保持 `GuidePresence` 为 compact 次级入口，CSS 动画延迟只影响视觉，不延迟 DOM 可用性或键盘访问。

- [ ] **Step 4: 运行测试**

Run: `pnpm exec vitest run src/components/ResultGuide.test.tsx`

Expected: PASS。

- [ ] **Step 5: 无提交检查点**

Run: `git diff --check -- projects/01-sbti/src/components/ResultPage.tsx projects/01-sbti/src/App.css`

Expected: 无输出。

---

### Task 9: 完成 V2 设计、动效、预览与美术交付物

**Files:**
- Create: `projects/01-sbti/UI-REDESIGN-V2.md`
- Create: `projects/01-sbti/INTERACTION-MOTION-SPEC.md`
- Create: `projects/01-sbti/design/preview-v2.html`
- Create: `projects/01-sbti/ART-REQUEST.md`
- Modify: `projects/01-sbti/README.md`
- Modify: `projects/01-sbti/VISUAL-QA.md`

**Interfaces:**
- Consumes: 已完成的真实运行时组件、`NPC-INTERACTION-ANIMATION-DESIGN.md` 和浏览器验证结果。
- Produces: 可独立审阅的 UI 设计、逐项动效规格、至少 12 个手机状态预览和 Codex 桌面端美术生成清单。

- [ ] **Step 1: 编写 UI-REDESIGN-V2.md**

记录正式品牌、全中文四维、闻山触点、页面信息层级、12 个以上关键状态、375/390/430 约束、状态降级和禁止项。明确答题期间不透露真实维度方向。

- [ ] **Step 2: 编写 INTERACTION-MOTION-SPEC.md**

逐项记录触发条件、DOM 状态、标准时长、缓动、可跳过路径、减少动态终态和失败降级。动效名称与 Task 7 CSS keyframes 完全一致。

- [ ] **Step 3: 创建 preview-v2.html**

用单文件 HTML/CSS 和现有本地资源或明确尺寸的 CSS 线框，覆盖以下 14 个状态：首次首页、续卷首页、品牌说明、未选题、已选题、返回修改、答题三问、章节递卷、章节收卷、中文维度显形、显形完成、结果首屏、结果三问、存储恢复。

页面在 1440px 使用多列编辑墙，在 390px 使用单列；不得加载外部 URL、第三方图片或不存在的资源路径。

- [ ] **Step 4: 编写 ART-REQUEST.md**

将资源分为：

- 必须生成：无；当前正式图、头像和 placeholder 已满足核心流程。
- 可用 CSS/SVG：雾气、卷边、墨线、朱印、维度卷印、显影遮罩。
- 可选增强：守案、递卷、阅卷、异常安抚四种闻山姿态。

四种姿态分别使用资源 ID：`guide-wenshan-desk-v2`、`guide-wenshan-pass-scroll-v1`、`guide-wenshan-read-seals-v1`、`guide-wenshan-recovery-v1`。每项写明页面、功能、主体、真实参考要求、工笔纸墨风格、3:4 比例、900×1200 像素、背景要求、安全区、文字留白、裁切、状态差分、复用范围、优先级和 fallback。后续用户授权直接生成后，递卷与阅卷采用与现有母版一致的低细节案房背景，而非透明抠图，以适配既有卷页的 `object-fit: cover`；守案与异常安抚仍暂缓。

统一生成提示词必须明确：保持现有闻山的脸型、幞头、交领、深墨绿与赭色配色；单一成年守卷人；双手结构清楚；无文字、法术光效、武器、现代物件、二次元少年化或帝王服饰。

- [ ] **Step 5: 更新 README 与 VISUAL-QA**

README 说明正式品牌定义、全中文显示和闻山实际节点；VISUAL-QA 记录 14 个预览状态、三宽度、减少动态、断图、焦点与控制台结果。不覆盖既有用户证据，只追加本轮章节。

- [ ] **Step 6: 检查设计交付物**

Run: `rg -n 'TB[D]|TO[D]O|\x{5f85}\x{5b9a}' projects/01-sbti/UI-REDESIGN-V2.md projects/01-sbti/INTERACTION-MOTION-SPEC.md projects/01-sbti/ART-REQUEST.md`

Expected: 无输出。

Run: `git diff --check -- projects/01-sbti/UI-REDESIGN-V2.md projects/01-sbti/INTERACTION-MOTION-SPEC.md projects/01-sbti/ART-REQUEST.md projects/01-sbti/design/preview-v2.html`

Expected: 无输出。

---

### Task 10: 完整自动化与真实浏览器门禁

**Files:**
- Modify only if evidence requires: files already listed in Tasks 1–9

**Interfaces:**
- Consumes: 全部前序任务。
- Produces: 可交付的绿色项目工作树和准确 QA 报告。

- [ ] **Step 1: 执行全量项目门禁**

Run: `pnpm lint && pnpm test && pnpm build`

Expected: lint 0 warning、0 error；全部测试文件与测试项通过；Vite build 成功。

- [ ] **Step 2: 验证全流程**

用 Playwright CLI 在 390×844 完成：首次闻山说明、开始、四项行动选择、换签、答题三问、返回修改、四次递卷、三次收卷、中文维度显形、结果三问和返回首页。

- [ ] **Step 3: 验证三宽度**

在 375×812、390×844、430×932 检查首页、长题、帮助卷页、章节交接、中文显形和结果页：`document.documentElement.scrollWidth === innerWidth`。

- [ ] **Step 4: 验证可访问性与减少动态**

确认 GuideTopicSheet 标题初始聚焦、Tab/Shift+Tab 循环、背景 inert、Escape 关闭、焦点归还；减少动态时行动签、卷印、中文显形和结果页直接达到语义终态。

- [ ] **Step 5: 验证资源降级**

分别阻断闻山 master、placeholder 和 avatar：主图按 master → placeholder → CSS 墨影降级，头像失败显示 CSS fallback；所有台词、主题按钮和主流程仍可操作。

- [ ] **Step 6: 验证用户界面无内部代码**

在首页、答题、显形、结果、相邻兽格、历史和分享预览运行：

```js
document.body.innerText.match(/\b(RH|TV|LE|SM|[RHTVLESM]{4})\b/g)
```

Expected: `null`。允许正式品牌字符串 `SHBTI`。

- [ ] **Step 7: 检查控制台与构建体积**

正常资源会话要求 0 error、0 warning。记录 `dist/index.html`、CSS、JS 的原始与 gzip 大小，以及 `du -sb dist` 和 `find dist -type f | wc -l`。

- [ ] **Step 8: 最终工作树检查**

Run: `git diff --check -- projects/01-sbti/src projects/01-sbti/UI-REDESIGN-V2.md projects/01-sbti/INTERACTION-MOTION-SPEC.md projects/01-sbti/ART-REQUEST.md projects/01-sbti/design/preview-v2.html`

Expected: 无输出。若项目整体仍被既有 CRLF 文档报告尾随空白，准确列出文件，不批量格式化。

- [ ] **Step 9: 保留未提交工作树**

不提交、不推送。最终报告修改范围、测试数量、build 体积、三宽度、动效降级、美术需求数量、内部代码可见性和任何既有 diff-check 阻塞。
