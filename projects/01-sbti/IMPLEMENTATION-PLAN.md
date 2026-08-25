# SHBTI UI 与闻山陪行体验 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有四选项 SHBTI 改造成“闻山陪行的山海夜读卷”，加入四卷进度、行动签、章节交接、显形仪式与上下文帮助，同时保持既有题库、计分、存储和结果映射不变。

**Architecture:** 业务台词继续由 `src/content/content.json` 驱动；NPC 出现规则和章节边界由纯函数派生；通用闻山卷页、进度、行动签和显形组件保持无业务状态。`QuizExperience` 只编排一次性章节过场，`useShbtiApp` 继续拥有正式测评状态和持久化。

**Tech Stack:** React 19、TypeScript 6、Vite 8、Vitest 4、原生 CSS；不新增依赖。

**Spec:** `projects/01-sbti/UI-NPC-REDESIGN.md`

## Global Constraints

- 只修改 `projects/01-sbti`；不得修改其他项目、根 `package.json`、`pnpm-workspace.yaml`、`pnpm-lock.yaml`、根 `docs/` 或 `prep/`。
- 纯前端静态构建；无后端、运行时 CDN、必需外部 API、Service Worker、Node 运行时 API 或未经确认的设备 API。
- 所有新增闻山业务台词只放 `src/content/content.json`；组件只保留通用控件动词与内容包不可读时的安全错误文案。
- 不生成新资源；只复用现有闻山主图、头像、placeholder 和 CSS 墨影降级。
- 不改变 48 题题库、每局 24 题、四维计分、确定性平分规则或 16 种结果映射。
- 不新增章节动画持久化字段，不保存用户图片、Base64、音视频或 Blob。
- 保留当前未提交四选项改版和项目文档修改；不做无关格式化。
- 最终门禁为 `pnpm lint && pnpm test && pnpm build`、375/390/430 CSS px 浏览器验证和项目路径 `git diff --check`。
- 工作区已有未提交文件。每个任务保留提交检查点，但除非用户明确授权，不执行 `git commit`。

## File Map

- `src/content/types.ts`、`content.json`、`validate.ts`：闻山内容契约和门禁。
- `src/guide/guideMoment.ts`：NPC 时刻优先级纯函数。
- `src/guide/journey.ts`：章节边界与交接纯函数。
- `src/components/guide/*`：通用闻山入口、卷页和过场。
- `src/components/VolumeProgress.tsx`、`ChoiceSlip.tsx`：四卷进度与行动签。
- `src/components/QuizExperience.tsx`：只编排瞬时章节过场。
- `src/components/RevealSequence.tsx`：可跳过且支持减少动态的显形步骤。
- `src/App.tsx`、`src/app/*`：路由接线、正式状态和结果计算。
- `src/App.css`：夜案、卷页、卷印、行动签、过场和暖纸兽志视觉。
- `UX-SPEC.md`、`UI-HANDOFF.md`、`VISUAL-QA.md`、`README.md`：同步最终运行时事实。

---

### Task 1: 扩展闻山内容契约与门禁

**Files:**
- Modify: `src/content/types.ts`
- Modify: `src/content/content.json`
- Modify: `src/content/validate.ts`
- Modify: `src/content/content.test.ts`

**Interfaces:**
- Consumes: `ChapterCode`、现有 `ExperienceCopy`。
- Produces: `GuideCopy`，供全部闻山组件和状态派生函数使用。

- [ ] **Step 1: 写内容契约失败测试**

在 `src/content/content.test.ts` 增加：

```ts
it('requires complete Wenshan journey copy for all four chapters', () => {
  const broken = structuredClone(rawContent)
  delete (broken.content.experience.guide.chapterStart as Record<string, string>).trace
  expect(() => validateContent(broken)).toThrow(/guide\.chapterStart\.trace/)
})

it('requires result help and both recovery branches', () => {
  const broken = structuredClone(rawContent)
  broken.content.experience.guide.resultHelp.neighbor = ''
  delete (broken.content.experience.guide.recovery as Record<string, string>).storage
  expect(() => validateContent(broken)).toThrow(/resultHelp\.neighbor/)
  expect(() => validateContent(broken)).toThrow(/recovery\.storage/)
})

it('keeps Wenshan copy neutral and non-diagnostic', () => {
  expect(JSON.stringify(rawContent.content.experience.guide)).not.toMatch(/吉凶|命定|治愈|治疗|更聪明|更优秀|能力更强/)
})
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `pnpm test -- src/content/content.test.ts`

Expected: FAIL，指出 `chapterStart`、`resultHelp` 或 `recovery` 尚不存在。

- [ ] **Step 3: 定义精确类型**

在 `src/content/types.ts` 增加：

```ts
export type GuideCopy = {
  name: string
  role: string
  intro: [string, string, string]
  landing: { fresh: string; resume: string; recent: string }
  chapterStart: Record<ChapterCode, string>
  chapterEnd: Partial<Record<ChapterCode, string>>
  reveal: { collecting: string; reading: string; complete: string }
  quizHelp: string[]
  resultHelp: { dimensions: string; neighbor: string; culturalBoundary: string }
  recovery: { content: string; storage: string }
}
```

将 `ExperienceCopy.guide` 改为 `GuideCopy`，原 `steps` 迁移为 `intro`。

- [ ] **Step 4: 增加已批准业务台词**

在 `content.json` 中保持现有三句含义，增加 `landing`、四章 `chapterStart`、前三章 `chapterEnd`、`reveal`、`quizHelp`、`resultHelp` 和 `recovery`。`landing.resume` 使用 `{chapter}` 与 `{current}`；章节台词不得评价答案。

- [ ] **Step 5: 实现嵌套对象校验**

在 `validate.ts` 增加：

```ts
function recordStringsAt(value: unknown, keys: readonly string[], path: string, issues: string[]) {
  if (!isRecord(value)) {
    issues.push(`${path}: expected an object`)
    return
  }
  keys.forEach((key) => stringAt(value[key], `${path}.${key}`, issues))
}
```

分别校验 `landing`、`chapterStart`、`chapterEnd`、`reveal`、`resultHelp`、`recovery`；要求 `intro` 恰好三句、`quizHelp` 至少一条，并扫描全部 guide 文本中的禁用措辞。

- [ ] **Step 6: 运行内容测试**

Run: `pnpm test -- src/content/content.test.ts`

Expected: PASS；内容 JSON 被返回为完整类型。

- [ ] **Step 7: 提交检查点**

运行 `git diff --check -- projects/01-sbti/src/content`。获授权时只暂存本任务四个精确文件，提交消息为 `feat(shbti): add Wenshan journey copy contract`。

### Task 2: 建立 NPC 时刻与章节边界纯函数

**Files:**
- Create: `src/guide/guideMoment.ts`
- Create: `src/guide/guideMoment.test.ts`
- Create: `src/guide/journey.ts`
- Create: `src/guide/journey.test.ts`

**Interfaces:**
- Consumes: `AppScreen`、`ChapterCode`。
- Produces: `deriveGuideMoment()`、`chapterPosition()`、`advanceInterlude()`。

- [ ] **Step 1: 写 NPC 优先级失败测试**

```ts
expect(deriveGuideMoment({ screen: 'error', recoveryReason: 'storage', guideUnseen: true })?.kind).toBe('recovery')
expect(deriveGuideMoment({ screen: 'landing', guideUnseen: true, hasProgress: true })?.kind).toBe('intro')
expect(deriveGuideMoment({ screen: 'landing', hasProgress: true, hasRecentResult: true, chapter: 'trace', current: 9 }))
  .toEqual({ kind: 'landing-resume', chapter: 'trace', current: 9 })
expect(deriveGuideMoment({ screen: 'landing', hasRecentResult: true })).toEqual({ kind: 'landing-recent' })
expect(deriveGuideMoment({ screen: 'quiz', chapter: 'trace', current: 9 })).toBeUndefined()
```

- [ ] **Step 2: 写章节边界失败测试**

```ts
it.each([[1, 'entry'], [7, 'trace'], [13, 'change'], [19, 'return']] as const)(
  'marks question %i as the start of %s',
  (current, chapter) => expect(chapterPosition(current)).toMatchObject({ chapter, isStart: true }),
)

it.each([[6, 'entry', 'trace'], [12, 'trace', 'change'], [18, 'change', 'return']] as const)(
  'creates a transition after question %i',
  (current, chapter, nextChapter) => expect(advanceInterlude(current)).toEqual({ chapter, nextChapter }),
)
expect(advanceInterlude(24)).toBeUndefined()
```

- [ ] **Step 3: 运行测试并确认缺少模块**

Run: `pnpm test -- src/guide/guideMoment.test.ts src/guide/journey.test.ts`

Expected: FAIL with module resolution errors。

- [ ] **Step 4: 实现章节接口**

```ts
export type ChapterPosition = { chapter: ChapterCode; chapterIndex: number; isStart: boolean; isEnd: boolean }
export type InterludeTransition = { chapter: Exclude<ChapterCode, 'return'>; nextChapter: Exclude<ChapterCode, 'entry'> }
export function chapterPosition(current: number): ChapterPosition
export function advanceInterlude(current: number): InterludeTransition | undefined
```

只接受 1–24 的整数；非法值抛出 `RangeError`。章节每 6 题划分，交接只发生在 6、12、18。

- [ ] **Step 5: 实现 NPC 派生接口**

```ts
export type GuideMomentContext = {
  screen: AppScreen
  guideUnseen?: boolean
  introStep?: number
  hasProgress?: boolean
  hasRecentResult?: boolean
  chapter?: ChapterCode
  current?: number
  requestedHelp?: 'quiz' | 'result'
  interlude?: { mode: 'start' | 'end'; chapter: ChapterCode }
  revealStep?: 'collecting' | 'reading' | 'complete'
  recoveryReason?: 'content' | 'storage'
}

export type GuideMoment =
  | { kind: 'intro'; step: number }
  | { kind: 'landing-fresh' }
  | { kind: 'landing-resume'; chapter: ChapterCode; current: number }
  | { kind: 'landing-recent' }
  | { kind: 'chapter-start'; chapter: ChapterCode }
  | { kind: 'chapter-end'; chapter: ChapterCode }
  | { kind: 'reveal'; step: 'collecting' | 'reading' | 'complete' }
  | { kind: 'quiz-help' }
  | { kind: 'result-help' }
  | { kind: 'recovery'; reason: 'content' | 'storage' }

export function deriveGuideMoment(context: GuideMomentContext): GuideMoment | undefined
```

优先级固定为恢复、首次引导、显形、主动帮助、章节交接、首页续卷、最近结果、新卷；普通答题页返回 `undefined`。

- [ ] **Step 6: 运行纯函数测试**

Run: `pnpm test -- src/guide/guideMoment.test.ts src/guide/journey.test.ts`

Expected: 两个测试文件全部 PASS。

- [ ] **Step 7: 提交检查点**

运行项目限定 `git diff --check`。获授权时只提交本任务四个文件，消息为 `feat(shbti): derive Wenshan journey moments`。

### Task 3: 收敛通用闻山组件

**Files:**
- Create: `src/components/guide/GuidePresence.tsx`
- Create: `src/components/guide/GuideSheet.tsx`
- Create: `src/components/guide/GuideMarkup.test.tsx`
- Modify: `src/components/guide/GuideAvatarButton.tsx`
- Delete after migration: `src/components/guide/GuideIntro.tsx`

**Interfaces:**
- Consumes: `GuideCopy`、现有闻山主图、头像和 placeholder。
- Produces: `GuidePresence` 与 `GuideSheet`，供首页、答题、章节、结果和恢复复用。

- [ ] **Step 1: 写静态语义失败测试**

使用已有 `react-dom/server`，不新增 DOM 测试依赖：

```tsx
const presence = renderToStaticMarkup(
  <GuidePresence name="闻山" role="山海司守卷人" line="卷已备好" onOpen={vi.fn()} />,
)
expect(presence).toContain('guide-presence')
expect(presence).toContain('闻山')
expect(presence).toContain('卷已备好')

const sheet = renderToStaticMarkup(
  <GuideSheet title="阅卷说明" name="闻山" role="山海司守卷人" lines={['第一句']} onClose={vi.fn()} />,
)
expect(sheet).toContain('role="dialog"')
expect(sheet).toContain('aria-modal="true"')
expect(sheet).toContain('关闭')
```

- [ ] **Step 2: 运行测试并确认组件缺失**

Run: `pnpm test -- src/components/guide/GuideMarkup.test.tsx`

Expected: FAIL with missing `GuidePresence` and `GuideSheet` modules。

- [ ] **Step 3: 实现 `GuidePresence` 图片降级**

```ts
type GuidePresenceProps = {
  name: string
  role: string
  line: string
  compact?: boolean
  onOpen?: (trigger: HTMLButtonElement) => void
}
```

有 `onOpen` 时渲染 button，否则渲染静态 aside。头像失败后显示 `.guide-avatar--fallback` CSS 墨影，身份和台词始终保留。

- [ ] **Step 4: 实现 `GuideSheet` 焦点和降级规则**

```ts
type GuideSheetProps = {
  title: string
  name: string
  role: string
  lines: string[]
  portrait?: boolean
  step?: number
  primaryLabel?: string
  secondaryLabel?: string
  returnFocusRef?: RefObject<HTMLButtonElement | null>
  onPrimary?: () => void
  onSecondary?: () => void
  onClose: () => void
}
```

挂载时聚焦标题；Escape 关闭；关闭后用 `requestAnimationFrame` 归还焦点。主图失败时保留 placeholder，再失败仍有 CSS 墨影；卷页超高时自身滚动。

- [ ] **Step 5: 迁移首次三句引导**

把 `GuideAvatarButton` 收敛为 `GuidePresence` 的兼容包装。首页用 `GuideSheet` 和本地 `step` 展示 `copy.intro`；完成或跳过仍调用现有 `markGuideDismissed()`。删除已无引用的 `GuideIntro.tsx`。

- [ ] **Step 6: 运行组件和引导状态测试**

Run: `pnpm test -- src/components/guide/GuideMarkup.test.tsx src/guide/guideState.test.ts && pnpm build`

Expected: 测试与构建 PASS，无 `guide.steps` 或 `GuideIntro` 残留引用。

- [ ] **Step 7: 提交检查点**

运行限定路径 `git diff --check`。获授权时只提交本任务组件，消息为 `feat(shbti): unify Wenshan guide surfaces`。

### Task 4: 实现四卷进度、行动签与章节交接

**Files:**
- Create: `src/components/VolumeProgress.tsx`
- Create: `src/components/ChoiceSlip.tsx`
- Create: `src/components/ChapterInterlude.tsx`
- Create: `src/components/QuizExperience.tsx`
- Create: `src/components/QuizPrimitives.test.tsx`
- Modify: `src/components/QuizPage.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `chapterPosition()`、`advanceInterlude()`、`GuideCopy`、`Question`、`ChapterDefinition`。
- Produces: `QuizExperience`，以现有答题回调接入 `App.tsx`。

- [ ] **Step 1: 写卷印与行动签语义失败测试**

```tsx
const progress = renderToStaticMarkup(<VolumeProgress current={9} total={24} />)
expect((progress.match(/volume-progress__seal/g) ?? [])).toHaveLength(4)
expect(progress).toContain('第 2 章 · 9 / 24')

const slip = renderToStaticMarkup(
  <ChoiceSlip name="q1" optionId="o1" text="先辨认足迹" selected onChoose={vi.fn()} />,
)
expect(slip).toContain('type="radio"')
expect(slip).toContain('checked=""')
expect(slip).toContain('choice-slip--selected')
```

- [ ] **Step 2: 运行测试并确认组件缺失**

Run: `pnpm test -- src/components/QuizPrimitives.test.tsx`

Expected: FAIL with missing component modules。

- [ ] **Step 3: 实现 `VolumeProgress` 与 `ChoiceSlip`**

`VolumeProgress` 根据 `chapterPosition(current)` 输出四章未开始、当前、已完成类名和可访问文字；不得只靠颜色。`ChoiceSlip` 使用原生 radio，label 最小高度由 CSS 保证 72px，选中时显示 `aria-hidden` 的朱印“选”。

- [ ] **Step 4: 将 `QuizPage` 改为无过场答题表面**

保持现有 props，并增加：

```ts
guide: GuideCopy
onGuideOpen: (trigger: HTMLButtonElement) => void
```

用 `VolumeProgress` 替换 `<progress>`，用四个 `ChoiceSlip` 替换 `.option`。未选择时主按钮文案为“请先选择一种行动”，选择后为“落印，下一问”，末题为“收卷，让兽格显形”。选择后不得自动跳题。

- [ ] **Step 5: 实现章节过场**

```ts
type ChapterInterludeProps = {
  mode: 'start' | 'end'
  chapter: ChapterDefinition
  copy: GuideCopy
  onComplete: () => void
}
```

用 `GuideSheet` 展示递卷或收卷台词；主动作分别为“展开此卷”和“收好此卷”，次动作均为“跳过过场”，两者到达相同终态。

- [ ] **Step 6: 实现 `QuizExperience` 瞬时状态机**

初始挂载若当前题为 1/7/13/19，创建 start 过场。非末题提交时执行：

```ts
const transition = advanceInterlude(current)
if (!transition) onNext()
else setInterlude({ mode: 'end', chapter: transition.chapter, nextChapter: transition.nextChapter })
```

完成 end 后先调用 `onNext()`，再显示下一章 start；完成 start 后清空本地状态。`onPrevious()` 不触发收卷。该状态不进入 `QuizProgress` 或 localStorage。过场和主动帮助都通过 `deriveGuideMoment()` 取得当前 NPC kind，组件不得自行复制优先级。

- [ ] **Step 7: 接入答题帮助**

`QuizExperience` 保存触发按钮 ref，点击紧凑 `GuidePresence` 后用 `GuideSheet` 展示 `guide.quizHelp`；关闭后回到头像按钮，不改变当前答案或题号。

- [ ] **Step 8: 接入 `App.tsx` 并验证**

将 quiz 路由改为 `QuizExperience`，传入全部四章和 `copy.guide`。

Run: `pnpm test -- src/components/QuizPrimitives.test.tsx src/guide/journey.test.ts src/app/state.test.ts && pnpm build`

Expected: 测试与构建 PASS；原计分和 reducer 行为不变。

- [ ] **Step 9: 提交检查点**

运行限定路径 `git diff --check`。获授权时精确提交本任务文件，消息为 `feat(shbti): add four-volume quiz journey`。

### Task 5: 接入首页、显形、结果帮助与恢复

**Files:**
- Modify: `src/components/LandingPage.tsx`
- Create: `src/components/RevealSequence.tsx`
- Create: `src/components/RevealSequence.test.tsx`
- Modify: `src/components/CalculatingPage.tsx`
- Modify: `src/components/ResultPage.tsx`
- Modify: `src/components/ErrorPage.tsx`
- Modify: `src/app/state.ts`
- Modify: `src/app/state.test.ts`
- Modify: `src/app/useShbtiApp.ts`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `GuideSheet`、`GuidePresence`、`deriveGuideMoment()`、`GuideCopy`。
- Produces: 可完成或跳过的显形、首页优先状态、结果帮助和分类型恢复页面。

- [ ] **Step 1: 写显式计算完成状态测试**

在 `src/app/state.test.ts` 增加：

```ts
it('stays in calculating until reveal completion is dispatched', () => {
  let state = appReducer(createInitialState(), { type: 'START', seed: 'state-seed', questionIds })
  for (const questionId of questionIds) {
    state = appReducer(state, { type: 'ANSWER', answer: { questionId, optionId: `option-${questionId}` } })
  }
  state = appReducer(state, { type: 'SUBMIT' })
  expect(state.screen).toBe('calculating')
  expect(state.result).toBeUndefined()
  state = appReducer(state, { type: 'CALCULATED', result })
  expect(state.screen).toBe('result')
})
```

- [ ] **Step 2: 写减少动态显形失败测试**

```tsx
const html = renderToStaticMarkup(
  <RevealSequence copy={{ collecting: '收卷', reading: '辨印', complete: '显形' }} reducedMotion onComplete={vi.fn()} />,
)
expect(html).toContain('RH')
expect(html).toContain('TV')
expect(html).toContain('LE')
expect(html).toContain('SM')
expect(html).toContain('显形')
```

- [ ] **Step 3: 运行定向测试**

Run: `pnpm test -- src/app/state.test.ts src/components/RevealSequence.test.tsx`

Expected: reducer用例 PASS，显形用例因模块缺失 FAIL。

- [ ] **Step 4: 实现显形和显式完成**

标准动态按 `collecting → reading → complete` 推进，总时长不超过 1.8 秒，并提供“跳过显形”。减少动态首次渲染即展示四枚印和 complete 文案，再由“展开兽志”按钮调用 `onComplete`，不得在 render 期间更新状态。

删除 `useShbtiApp` 自动 dispatch `CALCULATED` 的 effect，公开：

```ts
function completeReveal() {
  if (state.screen !== 'calculating' || !state.progress) return
  const result = generateQuizResult(
    state.progress.questionIds,
    state.progress.answers,
    content,
    new Date().toISOString(),
  )
  dispatch({ type: 'CALCULATED', result })
}
```

`CalculatingPage` 接收 `copy.guide.reveal`、`settings.reducedMotion` 和 `completeReveal`。

- [ ] **Step 5: 实现首页闻山状态优先级**

首页把 `guideUnseen`、进度、最近结果、章节和题号传给 `deriveGuideMoment()`；首次引导优先，之后按“进行中进度 > 最近结果 > 新卷”选择 `guide.landing`。`resume` 只替换 `{chapter}` 与 `{current}`。复用闻山主图作为案房一侧锚点，图片失败遵循 placeholder 和 CSS 墨影链。

- [ ] **Step 6: 增加结果帮助卷页**

`ResultPage` 增加次级 `GuidePresence`，打开后展示 `resultHelp.dimensions`、`neighbor`、`culturalBoundary`。关闭归还焦点；帮助开关不改变 result 状态，闻山视觉不得与异兽主图等权。

- [ ] **Step 7: 区分内容与存储错误**

给 `AppState` 增加：

```ts
errorReason?: 'content' | 'storage'
```

`FAIL` action 接收 reason；存储失败使用 `storage`。有已验证内容时使用 `guide.recovery[reason]`；内容包本身不可读时使用安全兜底“内容包未能读取，请重新加载后再试。”。恢复不得无条件清除仍有效的内存答案。

在 `src/app/state.test.ts` 增加保存失败恢复断言：

```ts
it('preserves valid in-memory progress when recovering from a storage failure', () => {
  const progress = { seed: 'saved', questionIds, currentIndex: 4, answers: [] }
  let state = createInitialState(undefined, progress)
  state = appReducer(state, { type: 'FAIL', reason: 'storage', message: '保存失败' })
  state = appReducer(state, { type: 'RECOVER' })
  expect(state.screen).toBe('landing')
  expect(state.progress).toEqual(progress)
})
```

`CalculatingPage`、`ResultPage` 和 `ErrorPage` 同样用 `deriveGuideMoment()` 选择 reveal、result-help 与 recovery kind，保证联合类型在所有规格节点都有运行时消费者。

- [ ] **Step 8: 运行状态、显形和全量测试**

Run: `pnpm test -- src/app/state.test.ts src/components/RevealSequence.test.tsx src/guide/guideMoment.test.ts && pnpm test`

Expected: 全部测试 PASS；显形不会自动跳过；错误 reason 可区分。

- [ ] **Step 9: 提交检查点**

运行限定路径 `git diff --check`。获授权时精确提交本任务文件，消息为 `feat(shbti): complete Wenshan reveal and recovery flow`。

### Task 6: 完成夜读卷视觉、文档与发布门禁

**Files:**
- Modify: `src/App.css`
- Modify relevant sections only: `UX-SPEC.md`
- Modify relevant sections only: `UI-HANDOFF.md`
- Modify relevant sections only: `VISUAL-QA.md`
- Modify relevant sections only: `README.md`

**Interfaces:**
- Consumes: 前五个任务产出的稳定 DOM 类名和交互状态。
- Produces: 375/390/430 CSS px 可用的夜案、卷页、行动签、过场与兽志体验，以及准确验收记录。

- [ ] **Step 1: 记录浏览器基线**

运行 `pnpm dev --host 127.0.0.1`，在真实浏览器以 390×844 打开首页和答题页，记录控制台以及：

```js
({ viewport: [innerWidth, innerHeight], overflow: document.documentElement.scrollWidth - innerWidth })
```

Expected: 应用可启动；记录用于对照最终视觉和溢出结果。

- [ ] **Step 2: 实现夜案与卷页层级**

在 `App.css` 精准更新：

- `.page--quiz` 使用深墨绿、低对比等高线和窄幅卷页；
- `.volume-progress` 为四枚卷印，状态同时有图形、文字与颜色；
- `.choice-slip` 为纵向纸签，最小高度 72px，选中时轻抬、墨边与朱印；
- `.chapter-interlude`、`.reveal-sequence` 沿用卷页和印章语言；
- `.page--result` 过渡到暖纸，异兽图是唯一强视觉中心；
- `.guide-presence` 点击区至少 44×44px，不 fixed，不遮挡操作。

- [ ] **Step 3: 加入受控动态与减少动态终态**

只为行动签、递收卷、卷印和显形定义规格时长，并加入：

```css
@media (prefers-reduced-motion: reduce) {
  .choice-slip, .guide-sheet, .chapter-interlude, .reveal-sequence__seal {
    animation: none;
    transition: none;
  }
}

:root[data-reduced-motion="true"] .choice-slip,
:root[data-reduced-motion="true"] .guide-sheet,
:root[data-reduced-motion="true"] .chapter-interlude,
:root[data-reduced-motion="true"] .reveal-sequence__seal {
  animation: none;
  transition: none;
}
```

- [ ] **Step 4: 验证三个移动宽度**

在 375、390、430 CSS px 分别验证首页、最长题干、四个最长行动签、章节过场、显形、结果和帮助卷页。每页执行：

```js
({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, overflow: document.documentElement.scrollWidth > innerWidth })
```

Expected: `overflow` 全为 `false`；最后选项和主按钮可滚动到达；无固定元素遮挡。

- [ ] **Step 5: 验证完整流程与降级**

覆盖首次三句引导、四次递卷、三次收卷、返回修改、刷新恢复、第 24 题显形、结果帮助、减少动态、主图失败、头像失败、placeholder 失败、存储写入失败。每条路径由 DOM 文本表达状态，控制台 warning/error 为 0。

- [ ] **Step 6: 精准同步项目文档**

只更新相关段落：`UX-SPEC.md` 记录四卷旅程；`UI-HANDOFF.md` 记录组件、焦点、动效和降级；`VISUAL-QA.md` 记录三宽度和 NPC 场景结果；`README.md` 更新闻山实际使用节点。保留现有未提交内容，不整篇重写。

- [ ] **Step 7: 运行最终自动门禁**

Run: `pnpm lint && pnpm test && pnpm build`

Expected: lint 0 errors；所有测试文件和测试项 PASS；Vite 构建成功并输出 `dist/` 产物大小。

- [ ] **Step 8: 检查范围、空白和资源纪律**

从仓库根运行：

```bash
git diff --check -- projects/01-sbti
git status --short
git diff --name-only -- projects/01-sbti
```

Expected: `git diff --check` 无输出；修改只在 `projects/01-sbti`；没有依赖、锁文件或新生成图片变化。

- [ ] **Step 9: 最终提交检查点**

若用户明确授权提交，逐项复核路径后仅提交项目文件；否则保留未提交并完整报告路径、lint 结果、测试文件数和测试数、build 产物大小及浏览器门禁。
