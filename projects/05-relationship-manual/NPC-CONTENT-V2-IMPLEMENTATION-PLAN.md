# 深夜信笺编辑部 V2 Implementation Plan

状态：`IMPLEMENTED · VERIFIED 2026-08-26`

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将关系说明书升级为具有小满三态 Galgame 立绘、七章 21 题、三种关系语境和安全章节转场的深夜信笺编辑部体验。

**Architecture:** `src/content/content.json` 继续作为唯一业务内容源；类型化内容契约驱动章节、题目、结果和 NPC cue。纯函数处理章节进度、NPC 选择、七章结果、旧草稿迁移和状态转换；React 组件只消费 ViewModel，三张立绘作为项目内静态 WebP 加载并提供无图回退。

**Tech Stack:** React 19、TypeScript 6、Vite 8、Vitest 4、浏览器 localStorage、内置 image generation、FFmpeg WebP 转换。

**Spec:** `projects/05-relationship-manual/NPC-CONTENT-V2-DESIGN.md`

## Global Constraints

- 只修改 `projects/05-relationship-manual/**`；不修改根配置、锁文件、其他项目、根 `docs/` 或 `prep/`。
- 不安装、删除或升级依赖；`ffmpeg` 已存在于 `/usr/bin/ffmpeg`，仅用于生成资源格式转换。
- 不执行 Git 写操作；每个任务以限定 diff 检查和测试检查点结束，不提交。
- 纯静态前端，无后端、运行时 CDN、外部 API、Service Worker 或未经确认的设备 API。
- 业务内容只存在于 `src/content/content.json`；JSX 不新增业务题目、结果句或 NPC 台词。
- localStorage 只保存稳定 ID、有限文本、设置和时间；不保存立绘、图片 URL、Base64、Blob、聊天或用户图片。
- 结果使用第一人称偏好、情境、行动和修复语言；不诊断、不评分、不要求服从、不诱导依赖小满。
- 三张立绘身份、发型、服装、比例、光线和色板一致；图片内无文字、水印、爱心、诊断符号或私人内容。
- 完成前执行 `pnpm lint && pnpm test && pnpm build`，并验证 375×812、390×844、430×932 CSS px。

## File Structure

- `src/content/schema.ts`：V2 内容、结果、NPC cue、关系语境与草稿类型。
- `src/content/validate.ts`：21 题、七章、三语境、NPC cue、引用和安全语言校验。
- `src/content/content.json`：七章、21 题、选项解释、结果句、三语境和全部 NPC 台词。
- `src/domain/profile.ts`：从答案归纳七章偏好、触发情境、行动和修复依据。
- `src/domain/card.ts`：生成七章卡片及句子职责。
- `src/app/presentation.ts`：七章展示、资源路径、章节转换和无业务文案的视觉元数据。
- `src/app/npc.ts`：根据稳定状态选择 NPC cue 与立绘资源。
- `src/state/state.ts`：章节转场、已看章节和 V2 页面状态。
- `src/storage/storage.ts`：v1→v2 草稿迁移、双 key 读取与项目级清除。
- `src/components/XiaomanStage.tsx`：三态立绘、头像裁切和图片失败回退。
- `src/components/DialoguePanel.tsx`：NPC 台词、主次动作与跳过。
- `src/components/ChapterIntro.tsx`：章节文件夹与转场。
- `src/components/TopicProgress.tsx`：七章进度。
- `src/components/QuestionSheet.tsx`：场景引子、问题、选项标题与解释。
- `src/components/ConflictNote.tsx`：预定义冲突提示。
- `src/components/RelationshipCard.tsx`：七章与 `need/trigger/action/repair` 职责展示。
- `public/assets/guide/xiaoman-*-v2.webp`：三张透明立绘。
- `src/App.tsx`：页面编排与现有存储、生成、编辑流程连接。
- `src/App.css`：立绘舞台、对话框、章节转场、响应式与缩减动效。

---

### Task 1: V2 内容契约与 21 题生产内容

**Files:**
- Modify: `src/content/schema.ts`
- Modify: `src/content/validate.ts`
- Modify: `src/content/content.json`
- Modify: `src/content/content.test.ts`

**Interfaces:**
- Produces: `RelationshipContext = 'close-relationship' | 'friendship' | 'family'`。
- Produces: `SentenceRole = 'need' | 'trigger' | 'action' | 'repair'`、`NpcPose`、`NpcCue`、`RelationshipChapter`、`RelationshipContextCopy`。
- Produces: 带 `sceneLead` 的问题、带 `subtitle` 的选项、七章与 NPC cue 内容。

- [x] **Step 1: 写 21 题、七章、三语境和 NPC cue 失败测试**

```ts
it('ships seven complete chapters and twenty-one scene-led questions', () => {
  const chapters = content.content.chapters
  const questions = content.content.questions
  expect(chapters.map((chapter) => chapter.category)).toEqual([
    'contact', 'listening', 'conflict', 'space', 'care', 'boundary', 'repair',
  ])
  expect(questions).toHaveLength(21)
  for (const chapter of chapters) {
    expect(questions.filter((question) => question.category === chapter.category)).toHaveLength(3)
  }
  expect(questions.every((question) => question.sceneLead.length >= 28)).toBe(true)
  expect(questions.flatMap((question) => question.options).every((option) => option.subtitle.length >= 16)).toBe(true)
})

it('keeps the sixteen original IDs and adds exactly five reviewed questions', () => {
  const ids = new Set(content.content.questions.map((question) => question.questionId))
  expect([...ids].filter((id) => id.startsWith('question-'))).toHaveLength(21)
  expect([...ids]).toEqual(expect.arrayContaining([
    'question-advice-permission',
    'question-care-details',
    'question-public-conflict',
    'question-apology',
    'question-repair-follow-through',
  ]))
})

it('provides three relationship contexts and three NPC poses', () => {
  expect(Object.keys(content.content.contextCopy).sort()).toEqual([
    'close-relationship', 'family', 'friendship',
  ])
  expect(new Set(content.content.npcCues.map((cue) => cue.pose))).toEqual(
    new Set(['daily', 'listening', 'reminder']),
  )
})
```

- [x] **Step 2: 运行内容测试并确认因 V2 字段缺失而失败**

Run: `pnpm test src/content/content.test.ts`
Expected: FAIL，明确报告缺少 `chapters`、`sceneLead`、`subtitle`、`contextCopy` 或 `npcCues`。

- [x] **Step 3: 扩展类型和校验器**

```ts
export type RelationshipContext = 'close-relationship' | 'friendship' | 'family'
export type SentenceRole = 'need' | 'trigger' | 'action' | 'repair'
export type NpcPose = 'daily' | 'listening' | 'reminder'

export type RelationshipChapter = {
  chapterId: string
  category: RelationshipCategory
  title: string
  shortTitle: string
  folderLabel: string
}

export type NpcCue = {
  cueId: string
  trigger: 'landing' | 'chapter-intro' | 'conflict' | 'binding' | 'storage-error'
  category?: RelationshipCategory
  conflictRuleId?: string
  pose: NpcPose
  speaker: '小满'
  roleLabel: '关系卡片整理员'
  text: string
  primaryAction: string
  secondaryAction?: string
  skippable: boolean
}
```

校验器必须冻结：七章顺序、21 题、每章 3 题、三语境、三姿态；并验证 cue 的 category／conflictRule 引用、场景引子和选项解释长度。

- [x] **Step 4: 按规格第 6 节机械转写 21 题**

保留规格列出的 16 个旧问题 ID；新增五个指定 ID。将 `question-disagree-story` 归入 `conflict`，将 `question-pause-signal` 归入 `space`。每个选项保留稳定 ID；语义发生根本变化时新增 ID，不复用旧 ID 伪装兼容。

`content.json` 的章节顺序必须为：

```json
[
  { "chapterId": "chapter-contact", "category": "contact", "title": "回信的节奏", "shortTitle": "联系", "folderLabel": "01" },
  { "chapterId": "chapter-listening", "category": "listening", "title": "先让我被听见", "shortTitle": "倾听", "folderLabel": "02" },
  { "chapterId": "chapter-conflict", "category": "conflict", "title": "分歧摆上桌面", "shortTitle": "分歧", "folderLabel": "03" },
  { "chapterId": "chapter-space", "category": "space", "title": "给彼此留一页空白", "shortTitle": "空间", "folderLabel": "04" },
  { "chapterId": "chapter-care", "category": "care", "title": "关心如何抵达", "shortTitle": "关心", "folderLabel": "05" },
  { "chapterId": "chapter-boundary", "category": "boundary", "title": "不能被翻过的页", "shortTitle": "边界", "folderLabel": "06" },
  { "chapterId": "chapter-repair", "category": "repair", "title": "把修改写进以后", "shortTitle": "修复", "folderLabel": "07" }
]
```

- [x] **Step 5: 写入三语境章节引子和所有 NPC cue**

`contextCopy` 为三种语境提供七章引子；核心问题保持中性。NPC cue 至少包括：首页 1 条、章节引子 7 条、冲突规则每条 1 条、装订 1 条、存储失败 1 条。所有 cue 遵循规格第 4.2 节，不包含依赖诱导或判断正确性的表达。

- [x] **Step 6: 重跑内容测试**

Run: `pnpm test src/content/content.test.ts`
Expected: PASS，且禁止语言扫描覆盖 `chapters`、`questions`、`sentenceFragments`、`npcCues` 和 `contextCopy`。

- [x] **Step 7: 限定检查点**

Run: `git diff --check -- src/content && git diff --name-only -- src/content`
Expected: 仅四个内容契约文件变化，无锁文件或其他项目。

---

### Task 2: 七章结果与四种句子职责

**Files:**
- Modify: `src/content/schema.ts`
- Modify: `src/content/content.json`
- Modify: `src/domain/profile.ts`
- Modify: `src/domain/card.ts`
- Modify: `src/domain/relationship.test.ts`
- Modify: `src/app/view-model.ts`
- Modify: `src/app/view-model.test.ts`
- Modify: `src/state/state.ts`

**Interfaces:**
- Produces: 七个 `CardSection`，section ID 与 `RelationshipCategory` 一致。
- Produces: `paragraphRoles: SentenceRole[]` 和带 `role` 的 `EditableCardItem`。
- Preserves: 稳定 `itemId`／`sourceTextKey` 对齐的用户编辑。

- [x] **Step 1: 写七章结果和职责失败测试**

```ts
it('builds seven chapter sections with need and action roles', () => {
  const profile = buildRelationshipProfile(content, goldenAnswers, now)
  const card = buildCardViewModel(content, profile, 'family')
  expect(card.sections.map((section) => section.sectionId)).toEqual([
    'contact', 'listening', 'conflict', 'space', 'care', 'boundary', 'repair',
  ])
  for (const section of card.sections) {
    expect(section.paragraphRoles).toContain('need')
    expect(section.paragraphRoles).toContain('action')
  }
  expect(card.relationshipLabel).toBe('家人关系')
})

it('keeps a hand edit when its stable item moves to a new chapter', () => {
  const previous = [{ ...oldItem, itemId: 'text:pref-space', editedText: '我的改写' }]
  const regenerated = [{ ...newItem, itemId: 'text:pref-space', sectionId: 'space' as const }]
  expect(reconcileCardItems(previous, regenerated)[0]).toMatchObject({
    itemId: 'text:pref-space', sectionId: 'space', editedText: '我的改写',
  })
})
```

- [x] **Step 2: 运行关系与 ViewModel 测试并确认失败**

Run: `pnpm test src/domain/relationship.test.ts src/app/view-model.test.ts`
Expected: FAIL，现有结果只有六章且没有 `paragraphRoles`。

- [x] **Step 3: 扩展结果和编辑类型**

```ts
export type CardSectionId = RelationshipCategory

export type CardSection = {
  sectionId: CardSectionId
  title: string
  paragraphs: string[]
  paragraphRoles: SentenceRole[]
  paragraphIds: string[]
  paragraphSourceTextKeys: Array<string | null>
  paragraphProvenanceIds: string[][]
  sensitive: boolean
  visible: boolean
  order: number
}

export type EditableCardItem = {
  // existing fields
  role: SentenceRole
}
```

- [x] **Step 4: 为每个结果片段声明角色并生成七章**

`sentenceFragments` 每项增加 `role`。每章至少生成一个 `need` 和一个 `action`；只有题目依据存在时才生成 `trigger`／`repair`。边界章的具体触发句设置 `sensitive: true`。缺少答案时使用对应章节的中性 need/action fallback，不复制同一句填充两种角色。

- [x] **Step 5: 更新卡片编辑与简洁版规则**

`cardToEditableItems()` 将 `paragraphRoles[index]` 写入 `EditableCardItem.role`。`buildDisplayCard()` 在完整模式保留所有可见项；简洁模式每章最多选一条，优先合并后的安全 action，其次 need，并继续默认排除敏感项。

- [x] **Step 6: 重跑关系与 ViewModel 测试**

Run: `pnpm test src/domain/relationship.test.ts src/app/view-model.test.ts`
Expected: PASS，包括亲密、好友、家人三组黄金输入和旧编辑跨章节保留。

- [x] **Step 7: 运行全部纯逻辑测试**

Run: `pnpm test src/content src/domain src/app src/state`
Expected: PASS，无六章固定断言残留。

---

### Task 3: 草稿 v2 迁移与章节转场状态

**Files:**
- Modify: `src/content/schema.ts`
- Modify: `src/storage/storage.ts`
- Modify: `src/storage/storage.test.ts`
- Modify: `src/state/state.ts`
- Modify: `src/state/state.test.ts`
- Modify: `src/app/presentation.ts`
- Modify: `src/app/presentation.test.ts`

**Interfaces:**
- Produces: `DraftPayloadV2`、`migrateV1Draft(input, content)`。
- Produces: `chapterIntro` 页面、`seenChapterIds` 和章节边界转换。
- Preserves: v1 合法答案、稳定编辑项与最近结果；新增题保持未答。

- [x] **Step 1: 写 v1→v2 迁移失败测试**

```ts
it('migrates a v1 draft without losing stable answers or hand edits', () => {
  storage.setItem(LEGACY_STORAGE_KEY_V1, JSON.stringify(v1Draft))
  const result = loadDraft(storage, content.contentVersion, { questionsById })
  expect(result.status).toBe('ok')
  if (result.status !== 'ok') return
  expect(result.payload.schemaVersion).toBe(2)
  expect(result.payload.answers.map((answer) => answer.questionId)).toContain('question-busy-contact')
  expect(result.payload.cardItems.find((item) => item.itemId === 'text:pref-space')?.editedText).toBe('我的旧改写')
  expect(result.payload.seenChapterIds).toEqual([])
})
```

- [x] **Step 2: 写章节边界失败测试**

```ts
it('opens a chapter intro once when the next question enters a new category', () => {
  let state = { ...createInitialState(), page: 'questionnaire' as const, currentQuestionIndex: 2 }
  state = relationshipReducer(state, {
    type: 'ADVANCE', questionCount: 21, currentCategory: 'contact', nextCategory: 'listening',
  })
  expect(state).toMatchObject({ page: 'chapterIntro', currentQuestionIndex: 3 })
  state = relationshipReducer(state, { type: 'CONTINUE_CHAPTER', category: 'listening' })
  expect(state.page).toBe('questionnaire')
  expect(state.seenChapterIds).toContain('listening')
})
```

- [x] **Step 3: 运行存储与状态测试并确认失败**

Run: `pnpm test src/storage/storage.test.ts src/state/state.test.ts`
Expected: FAIL，现有 schema 只接受 v1 且没有 `chapterIntro`。

- [x] **Step 4: 实现双 key 迁移**

```ts
export const STORAGE_KEY_V2 = 'xhs-tool:relationship-manual:state:v2'
export const LEGACY_STORAGE_KEY_V1 = 'xhs-tool:relationship-manual:state:v1'
```

读取顺序：先 v2，再 v1；v1 通过现有问题和选项索引清洗后转换为 v2。保存只写 v2；成功保存 v2 后不主动删除 v1。`clearDraft()` 明确删除两个项目 key。读取损坏 v2 时不回退覆盖为 v1，以免掩盖最新草稿损坏。

- [x] **Step 5: 实现章节状态与动作**

```ts
type RelationshipAction =
  | { type: 'OPEN_FIRST_CHAPTER'; category: RelationshipCategory }
  | { type: 'CONTINUE_CHAPTER'; category: RelationshipCategory }
  | { type: 'ADVANCE'; questionCount: number; currentCategory: RelationshipCategory; nextCategory?: RelationshipCategory }
  // existing actions
```

`BEGIN` 进入第一章转场；跨分类边界且该章未看过时进入 `chapterIntro`；同章内直接进入下一题。恢复草稿时保留题目位置，未看过对应章节才显示一次转场。

- [x] **Step 6: 重跑存储和状态测试**

Run: `pnpm test src/storage/storage.test.ts src/state/state.test.ts src/app/presentation.test.ts`
Expected: PASS，包括未来版本、损坏 JSON、非法 ID、v1 迁移和两个 key 清除。

---

### Task 4: 生成并验收小满日常陪伴立绘

**Files:**
- Create: `public/assets/guide/xiaoman-daily-v2.webp`
- Modify: `ART-REQUEST.md`
- Modify: `PROMPTS.md`

**Interfaces:**
- Produces: 后续两态身份与风格参考图。
- Produces: 透明 3:4 WebP，项目正式 UI 使用。

- [x] **Step 1: 使用内置 image generation 生成 `daily`**

使用以下完整提示，一次调用生成一个候选：

```text
Use case: stylized-concept
Asset type: transparent Galgame companion character sprite for a mobile relationship-card editor
Primary request: an original adult Chinese female editorial companion named Xiaoman, age appearance 24–28, gently smiling as she welcomes the player into a rainy-night letter editing studio
Subject: deep-brown medium-length hair in a loose low ponytail with natural wisps; warm-gray knitted cardigan; plain sage-green shirt; one hand naturally holds a blue pencil; the other hand displays exactly two completely blank warm-white cards
Style/medium: premium Japanese Galgame character sprite; refined line art; soft cel shading; mature anatomy and facial proportions; tasteful contemporary character design
Composition/framing: true transparent background; vertical 3:4; head to mid-thigh; full head, both hands, blue pencil and both cards visible; centered clean silhouette with mobile UI safe margins
Lighting/mood: soft warm editorial desk side light; calm, trustworthy, companionable; no drawn environment
Constraints: original face; adult appearance; exactly two blank cards; no text, symbols or lines on cards; correct hands; no watermark
Avoid: childlike proportions, school uniform, maid outfit, white coat, clinic or therapy symbols, hearts, romantic fan service, readable text, private messages, charts, computer, coffee cup, extra fingers, cropped hands
```

- [x] **Step 2: 视觉检查候选**

用 `view_image` 检查：成年观感、原创脸、两张空白卡、蓝铅笔、双手、透明边缘、服装颜色和 3:4 安全区。任何一项失败，只针对失败项迭代一次；不同时改变姿态、服装和画风。

- [x] **Step 3: 转换为正式 WebP**

将内置工具生成的选定 PNG 从 `$CODEX_HOME/generated_images/...` 转换到项目：

先把工具返回的真实绝对路径赋给任务专用变量，再执行转换；不得猜测或依赖系统临时目录：

```bash
XIAOMAN_DAILY_SOURCE_PNG=/absolute/path/returned/by/image-generation.png
test -f "$XIAOMAN_DAILY_SOURCE_PNG"
ffmpeg -y -i "$XIAOMAN_DAILY_SOURCE_PNG" -c:v libwebp -q:v 88 -compression_level 6 -pix_fmt yuva420p public/assets/guide/xiaoman-daily-v2.webp
```

- [x] **Step 4: 验证透明度、尺寸和解码**

Run: `ffprobe -v error -show_entries stream=width,height,pix_fmt -of default=nw=1 public/assets/guide/xiaoman-daily-v2.webp`
Expected: 竖幅 3:4 附近，像素格式包含 alpha；浏览器加载 `naturalWidth > 0`。

- [x] **Step 5: 更新资源台账**

在 `ART-REQUEST.md` 和 `PROMPTS.md` 记录最终提示、生成模式、源结果路径、正式文件、尺寸、字节数和单资源验收结论。

---

### Task 5: 基于日常立绘生成倾听与提醒两态

**Files:**
- Create: `public/assets/guide/xiaoman-listening-v2.webp`
- Create: `public/assets/guide/xiaoman-reminder-v2.webp`
- Modify: `ART-REQUEST.md`
- Modify: `PROMPTS.md`

**Interfaces:**
- Consumes: `xiaoman-daily-v2.webp` 作为身份、服装、发型、比例和光线参考。
- Produces: `NpcPose` 的全部三个正式资源。

- [x] **Step 1: 查看日常立绘并生成倾听态**

先用 `view_image` 载入日常立绘，再用内置 image generation 编辑／派生：

```text
Use case: identity-preserve
Asset type: transparent Galgame companion character sprite variant
Primary request: create the listening pose of the same Xiaoman character; change only pose and expression
Input image: daily Xiaoman sprite as the identity, hairstyle, clothing, palette, anatomy and lighting reference
Subject change: attentive gentle expression; blue pencil lowered slightly; upper body leans forward a little; both hands remain natural and visible; no cards need to be displayed
Composition/framing: true transparent background; vertical 3:4; head to mid-thigh; preserve the same scale and mobile safe margins
Constraints: preserve face identity, adult age, hairstyle, warm-gray cardigan, sage-green shirt, body proportions, line art, cel shading and warm side light; no text; no watermark
Avoid: sadness, pitying expression, closed eyes, childlike proportions, romantic fan service, clinic symbols, hearts, extra fingers, cropped hands
```

- [x] **Step 2: 检查倾听态并转换 WebP**

单独检查身份一致、表情不怜悯、双手正确和透明背景。使用 Task 4 相同 FFmpeg 参数输出 `xiaoman-listening-v2.webp`。

- [x] **Step 3: 重新查看日常立绘并生成提醒态**

```text
Use case: identity-preserve
Asset type: transparent Galgame companion character sprite variant
Primary request: create the gentle reminder pose of the same Xiaoman character; change only pose and expression
Input image: daily Xiaoman sprite as the identity, hairstyle, clothing, palette, anatomy and lighting reference
Subject change: mildly concerned but never scolding; use the blue pencil to point toward exactly one completely blank removable note held naturally in the other hand
Composition/framing: true transparent background; vertical 3:4; head to mid-thigh; preserve the same scale and mobile safe margins
Constraints: preserve face identity, adult age, hairstyle, warm-gray cardigan, sage-green shirt, body proportions, line art, cel shading and warm side light; note has no text, lines or symbols; no watermark
Avoid: angry expression, raised finger, teacher-like scolding, childlike proportions, romantic fan service, clinic symbols, hearts, readable text, extra fingers, cropped hands
```

- [x] **Step 4: 检查提醒态并转换 WebP**

单独检查身份一致、表情不责备、恰好一张空白便签、蓝铅笔与手部正确。输出 `xiaoman-reminder-v2.webp`。

- [x] **Step 5: 三图一致性验收**

并排检查三图：脸、发型、服装、色板、比例、线条、光线和裁切一致；姿态在 160px 宽度仍能区分。记录三文件尺寸和合计字节数，目标合计不超过 1.2MB；超过时将 `-q:v` 调整为 82 并重新检查透明边缘和面部细节。

---

### Task 6: NPC cue 选择、章节组件与无图回退

**Files:**
- Create: `src/app/npc.ts`
- Create: `src/app/npc.test.ts`
- Create: `src/components/XiaomanStage.tsx`
- Create: `src/components/DialoguePanel.tsx`
- Create: `src/components/ChapterIntro.tsx`
- Create: `src/components/TopicProgress.tsx`
- Create: `src/components/QuestionSheet.tsx`
- Create: `src/components/ConflictNote.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Produces: `selectNpcCue(content, request): NpcCue | null`。
- Produces: `getNpcAsset(pose): string`。
- Components consume typed props only; no component reads raw JSON directly except the app composition boundary.

- [x] **Step 1: 写 cue 选择和资源失败测试**

```ts
it('selects a chapter cue by stable category', () => {
  expect(selectNpcCue(content, { trigger: 'chapter-intro', category: 'boundary' })).toMatchObject({
    pose: 'reminder', trigger: 'chapter-intro', category: 'boundary',
  })
})

it('returns null instead of inventing dialogue for an unknown conflict', () => {
  expect(selectNpcCue(content, { trigger: 'conflict', conflictRuleId: 'missing' })).toBeNull()
})

it('maps every pose to a local guide asset', () => {
  expect(['daily', 'listening', 'reminder'].map(getNpcAsset)).toEqual([
    '/assets/guide/xiaoman-daily-v2.webp',
    '/assets/guide/xiaoman-listening-v2.webp',
    '/assets/guide/xiaoman-reminder-v2.webp',
  ])
})
```

- [x] **Step 2: 运行 NPC 测试并确认模块缺失失败**

Run: `pnpm test src/app/npc.test.ts`
Expected: FAIL，`src/app/npc.ts` 尚不存在。

- [x] **Step 3: 实现纯 NPC 选择函数**

```ts
export type NpcCueRequest = {
  trigger: NpcCue['trigger']
  category?: RelationshipCategory
  conflictRuleId?: string
}

export function selectNpcCue(content: RelationshipContentPackage, request: NpcCueRequest): NpcCue | null
export function getNpcAsset(pose: NpcPose): string
```

严格匹配 trigger，并在提供 category／conflictRuleId 时同时匹配；找不到返回 `null`，不生成临时台词。

- [x] **Step 4: 重跑 NPC 测试**

Run: `pnpm test src/app/npc.test.ts`
Expected: PASS。

- [x] **Step 5: 实现聚焦组件**

```ts
type XiaomanStageProps = {
  pose: NpcPose
  mode: 'stage' | 'avatar'
  name: string
  roleLabel: string
}

type DialoguePanelProps = {
  cue: NpcCue
  onPrimary: () => void
  onSecondary?: () => void
  onSkip?: () => void
}

type ChapterIntroProps = {
  chapter: RelationshipChapter
  cue: NpcCue
  completedQuestionCount: number
  onContinue: () => void
  onSkip: () => void
}
```

`XiaomanStage` 在 `img.onError` 后隐藏图片并显示“满”字印章；对话仍由 `DialoguePanel` 渲染。组件不写 localStorage，不读取用户编辑文本。

- [x] **Step 6: 将 App 编排改为组件消费**

`chapterIntro` 使用 `ChapterIntro`；问答使用 `TopicProgress`＋`QuestionSheet`；冲突规则命中时使用 `ConflictNote`。跨页继续使用已有滚动复位函数。不得在新组件中复制 21 题或 NPC 台词。

- [x] **Step 7: 运行相关测试与类型构建**

Run: `pnpm test src/app src/state && pnpm build`
Expected: PASS，无未使用 props、资源路径或类型错误。

---

### Task 7: 立绘舞台、对话演出与七章卡片 UI

**Files:**
- Modify: `src/App.css`
- Modify: `src/index.css`
- Modify: `src/components/RelationshipCard.tsx`
- Modify: `src/components/XiaomanStage.tsx`
- Modify: `src/components/DialoguePanel.tsx`
- Modify: `src/components/ChapterIntro.tsx`
- Modify: `ART-REQUEST.md`

**Interfaces:**
- Consumes: Task 5 三张 WebP、Task 6 组件、Task 2 七章卡片。
- Produces: 手机与桌面 Galgame 混合布局、图片失败回退、缩减动效。

- [x] **Step 1: 实现章节转场舞台**

移动端 `.xiaoman-stage--chapter` 高度使用 `clamp(18rem, 46svh, 30rem)`；立绘 `object-fit: contain; object-position: center bottom`。对话框位于普通文档流，最多向上覆盖立绘空白区，不覆盖按钮或正文。

- [x] **Step 2: 实现问答头像模式**

`.xiaoman-stage--avatar` 固定为 48–56px 圆形裁切，和一行提示共同占用题目标题上方区域；提示关闭后保留不超过 44px 的角色召回按钮。

- [x] **Step 3: 实现三态切换与 180ms 演出**

章节入场使用透明度＋不超过 12px 的纵向位移；对话批注淡入 180ms。不得逐字打印台词。图片切换保留容器尺寸，防止布局跳动。

- [x] **Step 4: 更新七章结果卡**

每章标题下按 `need/trigger/action/repair` 显示中文职责标签“我的需要／容易卡住的时刻／可以这样做／一起修复”。简洁版每章只显示一条合并句；边界敏感项继续带文字标记且默认排除。

- [x] **Step 5: 添加缩减动效和图片失败样式**

```css
@media (prefers-reduced-motion: reduce) {
  .xiaoman-stage__image,
  .dialogue-panel,
  .chapter-folder {
    animation: none !important;
    transition: none !important;
    transform: none !important;
  }
}
```

无图回退印章必须与角色名、身份和按钮同时可见；CSS 不得依赖图片宽度维持布局。

- [x] **Step 6: 运行 lint 和 build**

Run: `pnpm lint && pnpm build`
Expected: PASS。

---

### Task 8: 全流程回归、视觉验收与交付记录

**Files:**
- Modify: `PROMPTS.md`
- Modify: `VISUAL-QA.md`
- Modify: `PREP_REPORT.md`
- Modify: `NPC-CONTENT-V2-DESIGN.md`
- Modify: `NPC-CONTENT-V2-IMPLEMENTATION-PLAN.md`

**Interfaces:**
- Consumes: 全部 V2 内容、逻辑、资源和 UI。
- Produces: 可复核的门禁、三宽证据、隐私与资源记录。

- [x] **Step 1: 运行完整自动门禁**

Run: `pnpm lint && pnpm test && pnpm build`
Expected: 全部 exit 0，记录测试文件数、测试数、构建资源大小。

- [x] **Step 2: 用真实浏览器走完三语境黄金流程**

亲密关系在 375×812、好友在 390×844、家人在 430×932 各走一次：首页 → 章节转场 → 单选 → 多选 → 冲突提示 → 回顾 → 七章结果 → 编辑 → 简洁版 → 本机保存／恢复。

每个宽度执行：

```js
({
  width: innerWidth,
  scrollWidth: document.documentElement.scrollWidth,
  brokenImages: [...document.images].filter((img) => !img.complete || img.naturalWidth === 0).length,
  minButtonHeight: Math.min(...[...document.querySelectorAll('button')].map((button) => button.getBoundingClientRect().height)),
})
```

Expected: `scrollWidth === width`、`brokenImages === 0`、`minButtonHeight >= 44`。

- [x] **Step 3: 验证降级场景**

拦截三张立绘请求，确认印章、姓名、身份、台词和操作仍完整；模拟 localStorage 读取／写入拒绝，确认当前会话可继续并提供复制／截图；启用 reduced motion，确认立绘与对话框无位移。

- [x] **Step 4: 验证内容安全与隐私**

检查 localStorage envelope：只包含 schema/content 版本、页面、题号、关系语境、答案 ID、有限编辑文本、章节 ID、设置和最近结果；不包含图片路径、Base64、Blob、NPC 对话历史或用户图片。

- [x] **Step 5: 更新台账和状态**

在 `PROMPTS.md` 记录三张最终提示和资源验收；在 `VISUAL-QA.md` 记录三宽、图片失败和动效结果；在 `PREP_REPORT.md` 更新 7 章／21 题／3 语境／3 立绘统计。将设计规格状态改为 `IMPLEMENTED`，将本计划已完成步骤勾选。

- [x] **Step 6: 最终限定检查**

Run: `git diff --check -- . && git status --short -- .`
Expected: 只有 `projects/05-relationship-manual/**` 内的计划文件、内容、源码、测试、文档和三张立绘发生变化；无根文件、锁文件或其他项目变化。
