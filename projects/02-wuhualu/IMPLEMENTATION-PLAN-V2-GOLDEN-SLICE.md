# 《物华录》V2 黄金切片实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把已批准的极简复古图标接入真实应用，并以曾侯乙编钟为首个完整 V2 黄金样例，跑通“观察—线索印—落印—揭晓—五段故事—离柜一问—入藏”纵向闭环，同时让其余 19 件未扩写内容继续安全运行。

**Architecture:** 保留现有纯函数题局与本地存储基础，在 `Artifact` 公共字段上增加全量目录字段，并以可选 `experienceV2` 承载尚未批量完成的长内容。状态机统一使用 V2 页面阶段；缺少 `experienceV2` 的文物通过显式 legacy adapter 进入不含热点和记忆题的安全路径，不生成故事、观察点或事实。UI 拆为小型组件，`App.tsx` 只负责装配与页面路由。

**Tech Stack:** React 19、TypeScript、Vitest、Vite、CSS mask/radial-gradient、localStorage；不新增依赖。

**Spec:** `UI-REDESIGN-V2.md`、`INTERACTION-MOTION-SPEC.md`、`REDESIGN-V2.md`、`CONTENT-V2-CONTRACT.md`、`NPC-GUIDE-SYSTEM-V2.md`

## Global Constraints

- 只修改 `projects/02-wuhualu`；不修改根配置、锁文件、其他项目、`docs/` 或 `prep/`。
- 纯前端静态构建；无后端、运行时 CDN、必需外部 API、Service Worker、Node 运行时 API或未经确认的设备 API。
- 业务内容只放 `src/content/content.json`；组件和状态机不得硬编码文物事实、题目或 NPC 台词。
- localStorage 只保存结构化状态；禁止用户图片、Base64、音视频或 Blob。
- 未具备权威参考的文物不得生成形象；生成图必须标为“创意重构”，不得称“复原图”或“实拍”。
- 曾侯乙编钟是本切片唯一完整五段故事黄金样例；其余文物不得用模板填充未审核内容。
- 375 / 390 / 430 CSS px 无横向溢出；关键按钮至少 48px；长故事必须可滚到底。
- 全部动效尊重 `prefers-reduced-motion`；键盘和屏幕阅读器不依赖拖拽完成流程。
- 提交前执行 `pnpm lint && pnpm test && pnpm build`，不得删除测试。

## 当前基线

- 内容：20 件文物。
- manifest v6：9 件 `playable-static`、2 件 `text-fallback-only`、9 件 `reference-required`。
- 测试基线：10 个测试文件、46 项测试。
- 当前状态机：`landing → intro → modeSelect → question/clueRevealed → answering → feedback → summary`。
- V2 缺口：扫光热点、三类自由线索印、错误复盘、展柜揭晓、五段故事、记忆回钩、入藏、套组进度、上下文许照。

---

### Task 1: 接入已批准的极简复古应用图标

**Files:**
- Create: `public/assets/wuhualu/brand/app-icon-v2.png`
- Create: `src/ui/brand-assets.ts`
- Create: `src/ui/brand-assets.test.ts`
- Modify: `index.html`
- Modify: `src/App.tsx`
- Modify: `src/App.css`

**Interfaces:**
- Produces: `APP_ICON_URL: string`，供页头品牌标记消费。
- Consumes: 已批准生成源 `/home/xrush/.codex/generated_images/01a0380d-5480-71e2-ac0c-01f02e441100/exec-2fdf740a-87a4-45cc-b1c8-e91e1da896dc.png`。

- [ ] **Step 1: 写图标文件与路径契约失败测试**

```ts
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { fileURLToPath } from 'node:url'
import { APP_ICON_ASSET, APP_ICON_URL } from './brand-assets.ts'

describe('brand icon', () => {
  it('ships the approved 1024px PNG from a project-local URL', () => {
    const iconPath = fileURLToPath(new URL('../../public/assets/wuhualu/brand/app-icon-v2.png', import.meta.url))
    const png = readFileSync(iconPath)
    expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
    expect(png.readUInt32BE(16)).toBe(1024)
    expect(png.readUInt32BE(20)).toBe(1024)
    expect(APP_ICON_ASSET).toBe('assets/wuhualu/brand/app-icon-v2.png')
    expect(APP_ICON_URL).toBe('/assets/wuhualu/brand/app-icon-v2.png')
  })
})
```

- [ ] **Step 2: 运行测试并确认因模块或 PNG 缺失而失败**

Run: `pnpm test -- src/ui/brand-assets.test.ts`

Expected: FAIL，原因是 `brand-assets.ts` 或 `app-icon-v2.png` 尚不存在。

- [ ] **Step 3: 复制已批准图标并实现稳定 URL**

```ts
export const APP_ICON_ASSET = 'assets/wuhualu/brand/app-icon-v2.png'
export const APP_ICON_URL = `${import.meta.env.BASE_URL}${APP_ICON_ASSET}`
```

执行时将生成源复制为 `public/assets/wuhualu/brand/app-icon-v2.png`，保留生成源不删除。把 `index.html` 的 favicon 指向 `/assets/wuhualu/brand/app-icon-v2.png`，页头用 36×36 图标替换当前纯 CSS `museum-mark`，图片 `alt=""`，相邻文字继续承担品牌名称。

- [ ] **Step 4: 运行定向测试并确认通过**

Run: `pnpm test -- src/ui/brand-assets.test.ts`

Expected: PASS，PNG 签名、1024×1024 尺寸和项目内 URL 均正确。

- [ ] **Step 5: 提交图标切片**

```bash
git add projects/02-wuhualu/public/assets/wuhualu/brand/app-icon-v2.png projects/02-wuhualu/src/ui/brand-assets.ts projects/02-wuhualu/src/ui/brand-assets.test.ts projects/02-wuhualu/index.html projects/02-wuhualu/src/App.tsx projects/02-wuhualu/src/App.css
git commit -m "feat(wuhualu): adopt archive tag app icon"
```

---

### Task 2: 建立渐进式 V2 内容类型与黄金样例验证

**Files:**
- Modify: `src/content/types.ts`
- Modify: `src/content/validate.ts`
- Modify: `src/content/content.test.ts`
- Modify: `src/content/content.json`

**Interfaces:**
- Produces: `ArtifactSetId`、`ArtifactSetDefinition`、`StorySection`、`ObservationSpot`、`ClueCard`、`MemoryChallenge`、`ArtifactExperienceV2`、`hasArtifactExperienceV2(artifact)`。
- Produces: 每件文物必填 `setId` 与 `timelineOrder`；只有资料完整的文物可带 `experienceV2`。
- Produces: `content.sets` 五条业务定义，包含稳定 ID、中文名称、简介和完成台词。
- Consumes: `research/content-v2/zenghouyi-bells-v2.json` 的已核验内容，字段 `costIfAdditional` 机械归一为 `starCost`。

- [ ] **Step 1: 写 V2 黄金样例与拒绝半成品的失败测试**

```ts
it('accepts exactly one complete V2 golden experience without inventing the other nineteen', () => {
  const parsed = parseContent(rawContent)
  const enhanced = parsed.content.artifacts.filter(hasArtifactExperienceV2)
  expect(enhanced.map(({ id }) => id)).toEqual(['artifact-zenghouyi-bells'])
  expect(enhanced[0].experienceV2.story).toHaveLength(5)
  expect(enhanced[0].experienceV2.observationSpots).toHaveLength(3)
  expect(enhanced[0].experienceV2.clueCards.map(({ label }) => label)).toEqual(['看形', '辨材', '问来历'])
})

it('rejects a partial V2 block', () => {
  const broken = structuredClone(rawContent) as any
  broken.content.artifacts[0].experienceV2 = { storyHook: '只有标题的半成品' }
  expect(validateContent(broken).issues.some(({ path }) => path.includes('experienceV2'))).toBe(true)
})
```

- [ ] **Step 2: 运行内容测试并确认新契约尚不存在**

Run: `pnpm test -- src/content/content.test.ts`

Expected: FAIL，原因是 V2 类型、守卫和黄金样例尚未接入。

- [ ] **Step 3: 实现类型和类型守卫**

```ts
export type ArtifactSetId = 'first-fire' | 'ritual-bronze' | 'chu-sound' | 'han-light' | 'tang-world'
export type StorySectionId = 'first-look' | 'making' | 'lived-world' | 'journey' | 'why-now'

export type ArtifactExperienceV2 = {
  storyHook: string
  story: StorySection[]
  observationSpots: ObservationSpot[]
  clueCards: ClueCard[]
  memoryChallenge: MemoryChallenge
  relatedArtifacts: { artifactId: string; reason: string }[]
  guideLines: GuideLines
  storyFactCheckStatus: 'verified' | 'mixed-with-bounded-context' | 'pending'
  storyContentVersion: string
}

export function hasArtifactExperienceV2(artifact: Artifact): artifact is Artifact & { experienceV2: ArtifactExperienceV2 } {
  return artifact.experienceV2 !== undefined
}
```

`Artifact` 增加必填 `setId`、`timelineOrder` 与可选 `experienceV2`；`WuhualuContentPackage.content` 增加 `sets: ArtifactSetDefinition[]`。五个套组按 `REDESIGN-V2.md` 机械映射 20 件文物；`timelineOrder` 为 1–20 且全局唯一。将黄金样例内容嵌入曾侯乙编钟条目，把 UNESCO A 级来源加入顶层 `sources`。

- [ ] **Step 4: 扩展验证器**

验证以下硬门禁：五段 ID 顺序固定；正文单段 80–180 汉字、总长 480–800，只有包含 `open-question` 时允许 360–479；三个观察点坐标为 0–1、半径为 0.04–0.25；三枚线索印类别和标签互异；记忆题 2–4 个选项且答案存在；关联文物 ID 存在且不指向自身；所有来源 ID 存在；每类许照台词至少 3 条；五个套组 ID 唯一且各被四件文物引用；半成品 `experienceV2` 必须整体拒绝。

- [ ] **Step 5: 运行内容测试并确认通过**

Run: `pnpm test -- src/content/content.test.ts`

Expected: PASS，20 件目录字段完整，只有曾侯乙编钟拥有完整 V2 内容。

- [ ] **Step 6: 提交内容契约切片**

```bash
git add projects/02-wuhualu/src/content/types.ts projects/02-wuhualu/src/content/validate.ts projects/02-wuhualu/src/content/content.test.ts projects/02-wuhualu/src/content/content.json
git commit -m "feat(wuhualu): add validated V2 golden content"
```

---

### Task 3: 向后兼容地迁移学习进度存储

**Files:**
- Modify: `src/content/types.ts`
- Modify: `src/storage/storage.ts`
- Modify: `src/storage/storage.test.ts`

**Interfaces:**
- Produces: `ArtifactLearningProgress`。
- Produces: `StoragePayload.artifactProgress: ArtifactLearningProgress[]` 与 `StoragePayload.setSealIds: ArtifactSetId[]`。
- 保持: `STORAGE_KEY = 'xhs-tool:wuhualu:state:v1'` 与 `schemaVersion: 1`，旧收藏不清空。

- [ ] **Step 1: 写旧存档迁移失败测试**

```ts
it('adds empty V2 learning fields while preserving V1 collection', () => {
  const storage = new MemoryStorage()
  storage.setItem(STORAGE_KEY, JSON.stringify({
    schemaVersion: 1,
    contentVersion: '1.0.0',
    updatedAt: '2026-08-24T00:00:00.000Z',
    collection: [{ artifactId: 'artifact-a', bestStars: 2, unlockedAt: '2026-08-24T00:00:00.000Z' }],
    bestScore: 200,
    recentAttempts: [],
    currentSession: null,
    recentArtifactIds: [],
    settings: { muted: false, reducedMotion: false },
  }))
  const loaded = loadStorage(storage, validIds, '1.0.0')
  expect(loaded.payload.collection).toHaveLength(1)
  expect(loaded.payload.artifactProgress).toEqual([])
  expect(loaded.payload.setSealIds).toEqual([])
})
```

- [ ] **Step 2: 运行存储测试并确认新字段缺失**

Run: `pnpm test -- src/storage/storage.test.ts`

Expected: FAIL，`artifactProgress` 与 `setSealIds` 为 `undefined`。

- [ ] **Step 3: 实现兼容迁移与清洗**

```ts
export type ArtifactLearningProgress = {
  artifactId: string
  observedSpotIds: string[]
  storyReadSections: StorySectionId[]
  memoryCompleted: boolean
}
```

缺失字段归一为空数组；未知文物、未知故事段 ID 和重复 ID 被剔除；`memoryCompleted` 只接受布尔值；集合印只接受五个 `ArtifactSetId`。内容版本变化继续只清理当前题局，不清空收藏和学习进度。

- [ ] **Step 4: 增加恶意媒体字符串仍被拒绝的覆盖并运行测试**

Run: `pnpm test -- src/storage/storage.test.ts`

Expected: PASS，旧存档迁移、V2 round-trip、失效 ID 清洗和媒体拒绝全部通过。

- [ ] **Step 5: 提交存储迁移切片**

```bash
git add projects/02-wuhualu/src/content/types.ts projects/02-wuhualu/src/storage/storage.ts projects/02-wuhualu/src/storage/storage.test.ts
git commit -m "feat(wuhualu): migrate V2 learning progress"
```

---

### Task 4: 建立不依赖 UI 的观察、线索和记忆规则

**Files:**
- Create: `src/game/experience.ts`
- Create: `src/game/experience.test.ts`

**Interfaces:**
- Produces: `hitObservationSpot(spots, point, foundIds): ObservationSpot | null`。
- Produces: `openClueCard(openedIds, clueId): { openedIds: string[]; stars: 1 | 2 | 3 }`。
- Produces: `gradeMemoryChallenge(challenge, optionId): { correct: boolean; explanation: string }`。
- Produces: `getSetProgress(artifacts, collection, setId): { collected: number; total: 4; complete: boolean }`。

- [ ] **Step 1: 写四组纯函数失败测试**

```ts
it('finds an unseen hotspot but never requires it to continue', () => {
  expect(hitObservationSpot(spots, { x: 0.48, y: 0.49 }, [])?.id).toBe('spot-bells-corner')
  expect(hitObservationSpot(spots, { x: 0.48, y: 0.49 }, ['spot-bells-corner'])).toBeNull()
})

it('keeps the first clue free and floors later clues at one star', () => {
  expect(openClueCard([], 'shape')).toEqual({ openedIds: ['shape'], stars: 3 })
  expect(openClueCard(['shape'], 'material').stars).toBe(2)
  expect(openClueCard(['shape', 'material'], 'provenance').stars).toBe(1)
})

it('grades memory without changing stars', () => {
  expect(gradeMemoryChallenge(challenge, 'b')).toMatchObject({ correct: true })
  expect(gradeMemoryChallenge(challenge, 'a')).toMatchObject({ correct: false })
})

it('completes a four-artifact set only when all four are collected', () => {
  expect(getSetProgress(artifacts, collection, 'chu-sound')).toEqual({ collected: 4, total: 4, complete: true })
})
```

- [ ] **Step 2: 运行测试并确认模块缺失**

Run: `pnpm test -- src/game/experience.test.ts`

Expected: FAIL，`experience.ts` 尚不存在。

- [ ] **Step 3: 实现最小纯函数**

热点使用归一化坐标的欧氏距离；重复线索不重复扣星；记忆题只返回正误与原解释，不修改分数；套组总数从内容计算但必须为 4，否则返回开发错误结果而不是伪造完成。

- [ ] **Step 4: 运行定向测试并确认通过**

Run: `pnpm test -- src/game/experience.test.ts`

Expected: PASS。

- [ ] **Step 5: 提交规则切片**

```bash
git add projects/02-wuhualu/src/game/experience.ts projects/02-wuhualu/src/game/experience.test.ts
git commit -m "feat(wuhualu): add V2 artifact experience rules"
```

---

### Task 5: 把状态机升级为完整 V2 单件流程

**Files:**
- Modify: `src/app/page-model.ts`
- Modify: `src/app/page-model.test.ts`
- Modify: `src/state/game-state.ts`
- Modify: `src/state/game-state.test.ts`
- Modify: `src/tests/simulation.test.ts`

**Interfaces:**
- Produces screens: `observation | clueSelect | answering | wrongReview | reveal | story | memory | archive | setComplete`。
- Produces actions: `moveSpotlight` 不入 reducer；`discoverSpot`、`openClue`、`selectOption`、`submitAnswer`、`continueToReveal`、`openStory`、`markStorySectionRead`、`answerMemory`、`archiveArtifact`、`leaveSetComplete`。
- 保持: V1 内容通过 adapter 跳过不存在的 story/memory，不产生伪造正文。

- [ ] **Step 1: 写黄金样例状态迁移失败测试**

```ts
it('runs the golden artifact through every V2 archive stage', () => {
  let state = startedGoldenState()
  expect(state.screen).toBe('observation')
  state = appReducer(state, { type: 'discoverSpot', spotId: 'spot-bells-corner' })
  state = appReducer(state, { type: 'openClue', clueId: 'clue-bells-shape' })
  state = appReducer(state, { type: 'selectOption', optionId: currentQuestion(state).correctOptionId })
  state = appReducer(state, { type: 'submitAnswer', answeredAt: NOW })
  expect(state.screen).toBe('reveal')
  state = appReducer(state, { type: 'openStory' })
  expect(state.screen).toBe('story')
  for (const section of goldenExperience.story) state = appReducer(state, { type: 'markStorySectionRead', sectionId: section.id })
  state = appReducer(state, { type: 'answerMemory', optionId: goldenExperience.memoryChallenge.answerId })
  expect(state.screen).toBe('memory')
  state = appReducer(state, { type: 'archiveArtifact', artifacts: allArtifacts, archivedAt: NOW })
  expect(state.screen).toBe('archive')
})
```

另写错答路径：`answering → wrongReview → reveal`；重复提交必须返回原 state；热点和记忆题不改变所得星级；legacy 文物从 reveal 可直接 archive；归档恰好补齐四件套组时进入 `setComplete`，重复归档不得重复添加套组印。

- [ ] **Step 2: 运行状态机测试并确认新屏幕与动作缺失**

Run: `pnpm test -- src/state/game-state.test.ts src/tests/simulation.test.ts src/app/page-model.test.ts`

Expected: FAIL，原因是 V2 screen/action 尚未定义。

- [ ] **Step 3: 重构 play state，保持单次结算不变式**

```ts
type CaseProgress = {
  phase: 'observation' | 'clueSelect' | 'answering' | 'wrongReview' | 'reveal' | 'story' | 'memory' | 'archive'
  openedClueIds: string[]
  observedSpotIds: string[]
  storyReadSections: StorySectionId[]
  memoryAnswerId: string | null
}
```

`QuizSession` 增加当前 `caseProgress`，每次阶段变化同时写回 `payload.currentSession`；`resumeRound` 从 `caseProgress.phase` 恢复准确页面，而不是按线索数量猜测。`submitAnswer` 仍是唯一写入 answer、score、collection、recentAttempts 的动作；`wrongReview`、`reveal`、`story`、`memory` 和 `archive` 只推进展示与学习进度，绝不重复计分。进入下一件时清空本件 `CaseProgress`，持久学习进度在 `archiveArtifact` 合并。

- [ ] **Step 4: 实现 legacy adapter**

无 `experienceV2` 时：观察页仍显示现有线索裁图但无热点；三条 V1 clue 显示为顺序线索签；揭晓页只展示已有 `summary/highlight/culturalNote`；“继续入藏”直接进入 archive，记忆题不出现，并显示来自 `content.copy` 的“完整故事整理中”文案。

- [ ] **Step 5: 运行状态机、模拟与全量测试**

Run: `pnpm test -- src/state/game-state.test.ts src/tests/simulation.test.ts src/app/page-model.test.ts && pnpm test`

Expected: PASS；黄金路径、错答路径、旧内容兼容、五题模拟和原有收藏恢复均无回归。

- [ ] **Step 6: 提交状态机切片**

```bash
git add projects/02-wuhualu/src/app projects/02-wuhualu/src/state projects/02-wuhualu/src/tests
git commit -m "feat(wuhualu): add V2 archive case state flow"
```

---

### Task 6: 实现扫光、线索印、落印与上下文许照

**Files:**
- Create: `src/ui/SpotlightStage.tsx`
- Create: `src/ui/ClueSealRail.tsx`
- Create: `src/ui/ArchiveOptions.tsx`
- Create: `src/ui/GuidePresence.tsx`
- Create: `src/ui/experience-view-model.ts`
- Create: `src/ui/experience-view-model.test.ts`
- Modify: `src/App.tsx`
- Modify: `src/App.css`

**Interfaces:**
- `SpotlightStage({ artifact, spots, foundIds, onDiscover })`：pointer drag、键盘逐项查看和 reduced-motion 按钮共用归一坐标。
- `ClueSealRail({ cards, openedIds, onOpen })`：任意顺序打开，显示本次星级代价。
- `ArchiveOptions({ options, selectedId, eliminatedId, onSelect, onConfirm })`：选项和朱印确认同区。
- `GuidePresence({ moment, lines, artifactName?, onAsk? })`：只选择业务内容已提供的台词，不在 JSX 编写文物事实。

- [ ] **Step 1: 写类型化 UI view model 失败测试**

```ts
it('builds a golden observation model without leaking the artifact name', () => {
  const model = buildObservationViewModel(goldenArtifact, question, [])
  expect(model.imageAlt).toBe('当前藏品的局部观察线索，不包含答案文字')
  expect(model.clueSeals.map(({ label }) => label)).toEqual(['看形', '辨材', '问来历'])
  expect(JSON.stringify(model)).not.toContain(goldenArtifact.name)
})
```

- [ ] **Step 2: 运行测试并确认 view model 不存在**

Run: `pnpm test -- src/ui/experience-view-model.test.ts`

Expected: FAIL。

- [ ] **Step 3: 实现 view model 与四个组件**

Spotlight 使用元素 `getBoundingClientRect()` 转换 pointer 坐标，不把连续坐标写入 localStorage；只在首次命中时 dispatch 稳定 spot ID。键盘按钮按未发现顺序揭示观察札记，但不自动打开线索或扣星。问许照只排除一个干扰项，排除理由必须来自类型化候选标签或 `wrongAnswerExplanation` 的安全片段，不直接返回正确 ID。

- [ ] **Step 4: 实现 CSS 动效与无障碍边界**

使用 CSS custom properties `--spot-x/--spot-y` 驱动 `radial-gradient`；线索翻签 200ms；落印 180ms。命中反馈通过视觉同心环和 `aria-live="polite"`，不调用振动 API。许照使用 B/C 级裁切，绝不覆盖文物、选项或固定动作。

- [ ] **Step 5: 运行 UI view model 与全量测试**

Run: `pnpm test -- src/ui/experience-view-model.test.ts && pnpm test`

Expected: PASS。

- [ ] **Step 6: 提交交互切片**

```bash
git add projects/02-wuhualu/src/ui projects/02-wuhualu/src/App.tsx projects/02-wuhualu/src/App.css
git commit -m "feat(wuhualu): build observation and clue interactions"
```

---

### Task 7: 实现展柜揭晓、五段故事、记忆题和入藏仪式

**Files:**
- Create: `src/ui/RevealCabinet.tsx`
- Create: `src/ui/ArtifactStory.tsx`
- Create: `src/ui/MemoryChallenge.tsx`
- Create: `src/ui/ArchiveTransfer.tsx`
- Create: `src/ui/story-view-model.ts`
- Create: `src/ui/story-view-model.test.ts`
- Modify: `src/App.tsx`
- Modify: `src/App.css`

**Interfaces:**
- `RevealCabinet`：显示全形、星级、图片性质、正确或误判证据。
- `ArtifactStory`：五段连续正文＋顶部章节索引；`onSectionRead(id)` 只记录稳定 ID。
- `MemoryChallenge`：无惩罚单选，提交后始终显示解释。
- `ArchiveTransfer`：显示套组位置、关联文物和下一件动作。

- [ ] **Step 1: 写长故事与来源边界失败测试**

```ts
it('keeps all five sourced sections and related artifacts in reading order', () => {
  const model = buildStoryViewModel(goldenArtifact, allArtifacts)
  expect(model.sections.map(({ id }) => id)).toEqual(['first-look', 'making', 'lived-world', 'journey', 'why-now'])
  expect(model.sections.every(({ sourceIds }) => sourceIds.length > 0)).toBe(true)
  expect(model.related.map(({ artifactId }) => artifactId)).toEqual([
    'artifact-zenghouyi-zunpan',
    'artifact-jiahu-flute',
  ])
})
```

- [ ] **Step 2: 运行测试并确认 story view model 不存在**

Run: `pnpm test -- src/ui/story-view-model.test.ts`

Expected: FAIL。

- [ ] **Step 3: 实现四个组件与类型化 story view model**

故事正文完全来自 `content.json`；来源只通过顶层 source ID 解析；无 `experienceV2` 时 view model 返回 `kind: 'legacy'`，组件只渲染已有三段事实和整理中状态。记忆题答错不减少星、不删除收藏。入藏动作展示 `setId` 对应中文套组名称；套组中文名称加入 `content.json` 的 `sets`，不硬编码在组件。

- [ ] **Step 4: 实现揭晓和入藏动效**

展柜光 560ms、正文分段只做 160ms 淡入、入藏缩略 400ms。`prefers-reduced-motion: reduce` 下取消位移、缩放、mask 扫动和印章回弹，仅保留即时状态与不超过 120ms 的透明度变化。

- [ ] **Step 5: 运行定向与全量测试**

Run: `pnpm test -- src/ui/story-view-model.test.ts && pnpm test`

Expected: PASS，长故事顺序、来源、关联、legacy 降级和状态机全绿。

- [ ] **Step 6: 提交故事闭环切片**

```bash
git add projects/02-wuhualu/src/ui projects/02-wuhualu/src/App.tsx projects/02-wuhualu/src/App.css projects/02-wuhualu/src/content
git commit -m "feat(wuhualu): complete golden artifact archive flow"
```

---

### Task 8: 重做首页任务板、五组图鉴与三宽验收

**Files:**
- Create: `src/game/catalog.ts`
- Create: `src/game/catalog.test.ts`
- Create: `src/ui/SetCollection.tsx`
- Modify: `src/game/view-models.ts`
- Modify: `src/game/view-models.test.ts`
- Modify: `src/App.tsx`
- Modify: `src/App.css`
- Modify: `src/index.css`
- Modify: `TODO.md`

**Interfaces:**
- Produces: `buildSetCollectionViewModel(artifacts, collection, setDefinitions)`，五组各 4 件。
- Produces: 首页单主动作“继续上次／接取今晚五件”，其余模式进入任务板。
- 保持: 20 件图鉴口径与 9 件可玩门禁分开表达。

- [ ] **Step 1: 写五组目录和门禁文案失败测试**

```ts
it('groups all twenty artifacts into five four-item archive sets', () => {
  const model = buildSetCollectionViewModel(artifacts, [], setDefinitions)
  expect(model).toHaveLength(5)
  expect(model.every(({ artifacts }) => artifacts.length === 4)).toBe(true)
  expect(model.flatMap(({ artifacts }) => artifacts)).toHaveLength(20)
})
```

- [ ] **Step 2: 运行测试并确认目录构建器缺失**

Run: `pnpm test -- src/game/catalog.test.ts src/game/view-models.test.ts`

Expected: FAIL。

- [ ] **Step 3: 实现任务板与五组图鉴**

锁定卡可聚焦、可打开“资料整理中／尚未完成对应卷宗”的详情，不再 disabled；时期和套组只显示中文；每柜显示“已归档 n / 4”；顶部同时显示“物华录 20 件／本期可探索 9 件”，不得把门禁伪装成内容缺失。许照在首页、任务板、图鉴使用不同有效台词节点。

- [ ] **Step 4: 更新 TODO，仅勾选真实完成项**

只关闭“黄金样例内容契约”“图标接入”“V2 黄金纵向流程”和对应三宽 QA；20/20 美术、20/20 长故事和 5/5 套组完成仍保持未完成。

- [ ] **Step 5: 执行完整静态验证**

Run: `pnpm lint && pnpm test && pnpm build`

Expected: lint 0 error；全部测试通过；TypeScript 与 Vite build exit 0。

- [ ] **Step 6: 执行真实浏览器 QA**

在 375×812、390×844、430×932 依次验证：首页、任务板、曾侯乙编钟扫光、键盘观察、三线索印、选项与落印、错答复盘、揭晓、五段故事滚底、记忆题、入藏、图鉴、详情、资源失败和 reduced-motion。

每个宽度必须满足：`document.scrollWidth === document.documentElement.clientWidth`；可见主操作高度 ≥48px；0 broken image；0 console error；许照不与文物、答案或主按钮重叠。

- [ ] **Step 7: 提交完成切片**

```bash
git add projects/02-wuhualu
git commit -m "feat(wuhualu): deliver V2 golden archive slice"
```

## 后续切片，不在本计划伪完成

1. 按 `ART-REQUEST.md` 与权威参考门禁补齐其余 9 件缺失文物资源；每次只生成一件并做两轮形态核验。
2. 为越王勾践剑、长信宫灯补齐线索裁图、缩略和可信剪影。
3. 将其余 19 件扩写为 480–800 字五段故事、三观察点、三线索印、记忆题和许照台词。
4. 20/20 内容完成后把 `experienceV2` 从渐进可选提升为发布必填，并删除 legacy adapter。
5. 五套均具备 4 件完整体验后启用套组完成印章仪式。
