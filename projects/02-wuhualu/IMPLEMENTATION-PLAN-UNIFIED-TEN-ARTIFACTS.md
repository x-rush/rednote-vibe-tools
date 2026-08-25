# 《物华录》十件文物统一完整体验 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将十件已有静态美术资源的文物统一制作成无旧版降级分支的完整观察、辨认、故事、记忆与入藏体验。

**Architecture:** `content.json` 是唯一业务内容源；内容校验器保证十件资源文物的完整体验契约，资源层把这些记录提升为 `CompleteArtifact`，页面只消费完整类型。观察台使用每件资源的真实比例和不裁切坐标系；另外十件不完整文物留在内容库但不进入运行时题池。

**Tech Stack:** React 19、TypeScript 6、Vitest、Vite 8、CSS、Playwright CLI、本地静态 WebP/SVG 资源。

**Spec:** `projects/02-wuhualu/DESIGN-UNIFIED-TEN-ARTIFACTS.md`

## Global Constraints

- 只修改 `projects/02-wuhualu`；不修改根配置、锁文件、其他项目、根 `docs/` 或 `prep/`。
- 不新增依赖、后端、运行时 CDN、外部 API、Service Worker 或设备权限。
- 业务内容只写入 `src/content/content.json`；组件不得硬编码文物故事、线索或许照台词。
- 本地存储只保存稳定 ID、数值、时间和有限文本，不保存图片、Base64、音视频、Blob。
- 十件资源文物必须全部成为 `CompleteArtifact`；另外十件不进入题局，也不触发旧页面。
- 每件完整体验必须有 5 段故事、3 个观察签、3 枚线索印、1 道三选一离柜一问、至少 2 件关联文物、五类各至少 3 条许照台词。
- 事实表述必须使用内容包中的权威来源；未知或争议使用 `open-question`，不得虚构铭文、人物对白或无名制作者动机。
- 观察图完整显示，320 / 360 / 375 / 390 / 430 CSS px 不得横向溢出。
- 每个生产改动先写失败测试并确认预期失败，再写最小实现。
- 提交前运行 `pnpm lint && pnpm test && pnpm build`，不得删除测试。

---

## 文件职责

- `src/content/content.json`：十件完整体验的全部业务文本、来源记录和语义界面文案。
- `src/content/types.ts`：`CompleteArtifact` 及完整体验相关静态类型。
- `src/content/validate.ts`：内容长度、来源等级、十件覆盖率和旧字段禁止规则。
- `src/content/content.test.ts`：十件、30 个观察签、50 段故事、30 枚线索印和旧字段移除门禁。
- `src/ui/artifact-assets.ts`：十件本地资源清单、观察图 URL 和真实宽高。
- `src/ui/artifact-assets.test.ts`：资源清单与完整体验清单的一致性。
- `src/ui/experience-view-model.ts`：只从 `CompleteArtifact` 生成观察与线索模型。
- `src/ui/story-view-model.ts`：只从 `CompleteArtifact` 生成五段故事模型。
- `src/ui/SpotlightStage.tsx`：根据资源比例显示不裁切观察图和三个观察签。
- `src/ui/SpotlightStage.test.tsx`：比例、不裁切、三个可见按钮和 NPC 引导回归。
- `src/ui/ArtifactMedia.tsx`：观察图角色与不泄露答案的失败占位。
- `src/App.tsx`：完整体验单一路径，删除旧故事与旧观察条件渲染。
- `src/App.css`：真实比例观察台和 320–430px 防溢出规则。
- `CONTENT-V2-CONTRACT.md`、`VISUAL-QA.md`：最终契约与实测证据。

---

### Task 1: 建立十件完整体验的失败门禁

**Files:**
- Modify: `projects/02-wuhualu/src/content/content.test.ts`
- Modify: `projects/02-wuhualu/src/ui/artifact-assets.test.ts`

**Interfaces:**
- Consumes: 现有 `hasArtifactExperienceV2`、`playableArtifactIds`、`parseContent`。
- Produces: 十件完整体验的精确验收常量与失败测试，后续内容和运行时任务以这些断言为门禁。

- [ ] **Step 1: 写十件覆盖率与计数失败测试**

在 `content.test.ts` 定义并使用精确 ID 清单：

```ts
const completeArtifactIds = [
  'artifact-eagle-tripod',
  'artifact-face-fish-basin',
  'artifact-jiahu-flute',
  'artifact-jade-dragon',
  'artifact-houmuwu-ding',
  'artifact-four-ram-zun',
  'artifact-lotus-crane-hu',
  'artifact-cloud-bronze-jin',
  'artifact-zenghouyi-bells',
  'artifact-zenghouyi-zunpan',
] as const

it('provides a complete experience for all ten locally illustrated artifacts', () => {
  const parsed = parseContent(content)
  const complete = parsed.content.artifacts.filter(hasArtifactExperienceV2)
  expect(complete.map(({ id }) => id).sort()).toEqual([...completeArtifactIds].sort())
  expect(complete.flatMap(item => item.experienceV2.observationSpots)).toHaveLength(30)
  expect(complete.flatMap(item => item.experienceV2.story)).toHaveLength(50)
  expect(complete.flatMap(item => item.experienceV2.clueCards)).toHaveLength(30)
  expect(complete.map(item => item.experienceV2.memoryChallenge)).toHaveLength(10)
})
```

- [ ] **Step 2: 写完整字段质量失败测试**

```ts
it('gives every complete artifact the same evidence and story structure', () => {
  const complete = parseContent(content).content.artifacts.filter(hasArtifactExperienceV2)
  for (const artifact of complete) {
    const experience = artifact.experienceV2
    expect(experience.story.map(({ id }) => id)).toEqual([
      'first-look', 'making', 'lived-world', 'journey', 'why-now',
    ])
    expect(experience.observationSpots).toHaveLength(3)
    expect(experience.clueCards.map(({ label }) => label)).toEqual(['看形', '辨材', '问来历'])
    expect(experience.memoryChallenge.options).toHaveLength(3)
    expect(experience.relatedArtifacts.length).toBeGreaterThanOrEqual(2)
    for (const lines of Object.values(experience.guideLines)) expect(lines.length).toBeGreaterThanOrEqual(3)
  }
})
```

- [ ] **Step 3: 写资源 ID 与完整体验 ID 一致性失败测试**

在 `artifact-assets.test.ts` 增加：

```ts
it('keeps all locally illustrated artifacts complete and playable', () => {
  const completeIds = artifacts.filter(hasArtifactExperienceV2).map(({ id }) => id).sort()
  expect(completeIds).toEqual([...playableArtifactIds].sort())
})
```

- [ ] **Step 4: 运行测试并确认 RED**

Run: `pnpm test -- src/content/content.test.ts src/ui/artifact-assets.test.ts`

Expected: FAIL，完整体验 ID 只有 `artifact-zenghouyi-bells`，计数分别为 3、5、3、1。

- [ ] **Step 5: 提交失败门禁**

```bash
git add projects/02-wuhualu/src/content/content.test.ts projects/02-wuhualu/src/ui/artifact-assets.test.ts
git commit -m "test(wuhualu): require ten complete artifact experiences"
```

---

### Task 2: 核对十件文物的权威来源

**Files:**
- Modify: `projects/02-wuhualu/src/content/content.json`
- Test: `projects/02-wuhualu/src/content/content.test.ts`

**Interfaces:**
- Consumes: 内容包 `sources[]`、十件文物现有 `sourceIds` 和事实核验状态。
- Produces: 每件故事段、记忆题和争议说明可引用的 A 级来源 ID。

- [ ] **Step 1: 写来源等级失败测试**

```ts
it('backs every verified story section with an A-level source', () => {
  const parsed = parseContent(content)
  const sourceLevels = new Map(parsed.sources.map(source => [source.id, source.level]))
  for (const artifact of parsed.content.artifacts.filter(hasArtifactExperienceV2)) {
    for (const section of artifact.experienceV2.story) {
      if (section.narrativeMode !== 'verified-fact') continue
      expect(section.sourceIds.some(id => sourceLevels.get(id) === 'A'), `${artifact.id}/${section.id}`).toBe(true)
    }
  }
})
```

在 `validate.ts` 的故事段校验处增加同等运行时断言，错误文案固定为 `verified-fact 必须引用至少一个 A 级来源`。

- [ ] **Step 2: 运行来源测试并确认 RED**

Run: `pnpm test -- src/content/content.test.ts`

Expected: FAIL，因为校验器尚未检查来源等级。

- [ ] **Step 3: 使用联网搜索逐件核对官方页面**

优先运行火山豆包搜索脚本，查询均限制权威来源：

```bash
python3 /home/xrush/.agents/skills/byted-web-search/scripts/web_search.py "中国国家博物馆 鹰形陶鼎 人面鱼纹彩陶盆 红山玉龙 馆藏" --count 10 --auth-level 1
python3 /home/xrush/.agents/skills/byted-web-search/scripts/web_search.py "河南博物院 贾湖骨笛 莲鹤方壶 云纹铜禁 馆藏" --count 10 --auth-level 1
python3 /home/xrush/.agents/skills/byted-web-search/scripts/web_search.py "中国国家博物馆 后母戊鼎 四羊方尊 馆藏" --count 10 --auth-level 1
python3 /home/xrush/.agents/skills/byted-web-search/scripts/web_search.py "湖北省博物馆 曾侯乙编钟 曾侯乙尊盘 馆藏" --count 10 --auth-level 1
```

逐页核对馆名、年代、材质、尺寸、发现/出土地点、用途、制作方法和争议边界。只把直接支持内容表述的 HTTPS 页面写入 `sources[]`；红山玉龙和云纹铜禁找不到独立权威详情时，保留 `pending-review` 并把对应推断写为 `open-question`。

- [ ] **Step 4: 更新来源记录与校验器**

在 `validate.ts` 建立来源等级表：

```ts
const sourceLevels = new Map<string, string>()
// 遍历 sources 时，在 ID 通过格式与重复校验后写入 source.level。
```

故事段 `verified-fact` 校验使用：

```ts
if (section.narrativeMode === 'verified-fact' &&
    !section.sourceIds.some(id => sourceLevels.get(String(id)) === 'A')) {
  issue(`${sectionPath}.sourceIds`, 'verified-fact 必须引用至少一个 A 级来源')
}
```

- [ ] **Step 5: 运行来源测试并确认 GREEN**

Run: `pnpm test -- src/content/content.test.ts`

Expected: 新来源等级测试 PASS；Task 1 的十件覆盖率测试继续按预期 FAIL。

- [ ] **Step 6: 提交来源核对**

```bash
git add projects/02-wuhualu/src/content/content.json projects/02-wuhualu/src/content/content.test.ts projects/02-wuhualu/src/content/validate.ts
git commit -m "content(wuhualu): verify sources for complete artifacts"
```

---

### Task 3: 补齐四件史前文物完整体验

**Files:**
- Modify: `projects/02-wuhualu/src/content/content.json`
- Test: `projects/02-wuhualu/src/content/content.test.ts`

**Interfaces:**
- Consumes: Task 2 核对后的 A 级来源记录与现有基础字段。
- Produces: 鹰形陶鼎、人面鱼纹彩陶盆、贾湖骨笛、红山玉龙的完整 `experienceV2`。

- [ ] **Step 1: 写四件体验存在性失败测试**

```ts
it.each([
  'artifact-eagle-tripod',
  'artifact-face-fish-basin',
  'artifact-jiahu-flute',
  'artifact-jade-dragon',
])('%s has a production-ready complete experience', id => {
  const artifact = parseContent(content).content.artifacts.find(item => item.id === id)
  expect(artifact && hasArtifactExperienceV2(artifact)).toBe(true)
  if (!artifact || !hasArtifactExperienceV2(artifact)) return
  expect(artifact.experienceV2.story).toHaveLength(5)
  expect(artifact.experienceV2.observationSpots).toHaveLength(3)
  expect(artifact.experienceV2.relatedArtifacts.length).toBeGreaterThanOrEqual(2)
})
```

- [ ] **Step 2: 运行四件测试并确认 RED**

Run: `pnpm test -- src/content/content.test.ts`

Expected: 四个参数化用例均 FAIL，原因是缺少 `experienceV2`。

- [ ] **Step 3: 为四件文物写五段故事**

在 `content.json` 为四件文物增加完整对象，段落必须围绕以下已核对问题展开：

- 鹰形陶鼎：鹰形整体与鼎口、陶塑与容器结合、仰韶文化使用边界、发现与收藏记录、动物造型器物的观察价值。
- 人面鱼纹彩陶盆：盆内对称构图、彩陶制作、人面鱼纹解释争议、半坡遗址发现背景、为何不能把单一宗教解释写成定论。
- 贾湖骨笛：骨管与音孔、材料和制孔、可发音证据与用途边界、贾湖遗址发现、早期音乐考古价值。
- 红山玉龙：C 形侧影与长鬣、玉材琢磨与悬孔、用途未知、发现与命名记录、“第一龙”称号和学术定论的区别。

每件五段顺序固定，正文 80–180 字，合计 480–800 字；争议段使用 `open-question`。

- [ ] **Step 4: 为四件文物写观察、线索、记忆和许照内容**

使用本地揭晓图按以下完整图坐标写入观察点；实现时在真实浏览器中检查按钮中心确实落在目标细节上，三个中心点不得重叠：

| 文物 | 观察签 01 | 观察签 02 | 观察签 03 |
|---|---|---|---|
| 鹰形陶鼎 | `spot-eagle-beak`，`x=.25 y=.35`，“下弯鹰喙” | `spot-eagle-opening`，`x=.76 y=.31`，“背部鼎口” | `spot-eagle-legs`，`x=.53 y=.72`，“三足承腹” |
| 人面鱼纹彩陶盆 | `spot-basin-rim`，`x=.50 y=.33`，“敞口深腹” | `spot-basin-face`，`x=.61 y=.54`，“圆形人面” | `spot-basin-fish`，`x=.31 y=.56`，“两侧鱼纹” |
| 贾湖骨笛 | `spot-flute-mouth`，`x=.14 y=.66`，“骨管吹口” | `spot-flute-holes`，`x=.55 y=.50`，“成列音孔” | `spot-flute-surface`，`x=.76 y=.38`，“骨质表面” |
| 红山玉龙 | `spot-dragon-snout`，`x=.22 y=.31`，“前伸吻部” | `spot-dragon-mane`，`x=.49 y=.20`，“扬起长鬣” | `spot-dragon-hole`，`x=.48 y=.46`，“中段穿孔” |

每个观察点的 `radius` 使用 `0.10`，`assetRole` 使用 `observation`；note 分别解释表中可见细节如何支持识别。三枚线索按 `shape/material/provenance` 排列；离柜一问固定三选一；相关文物至少两件；五类许照台词各三条。

- [ ] **Step 5: 运行内容测试并确认四件 GREEN**

Run: `pnpm test -- src/content/content.test.ts`

Expected: 四件参数化测试 PASS；完整体验总数变为 5，Task 1 总覆盖率仍 FAIL。

- [ ] **Step 6: 提交史前文物内容**

```bash
git add projects/02-wuhualu/src/content/content.json projects/02-wuhualu/src/content/content.test.ts
git commit -m "content(wuhualu): complete four early artifact stories"
```

---

### Task 4: 补齐五件青铜文物完整体验

**Files:**
- Modify: `projects/02-wuhualu/src/content/content.json`
- Test: `projects/02-wuhualu/src/content/content.test.ts`

**Interfaces:**
- Consumes: Task 2 核对后的来源和曾侯乙编钟黄金样例结构。
- Produces: 后母戊青铜方鼎、四羊方尊、莲鹤方壶、云纹铜禁、曾侯乙尊盘的完整 `experienceV2`，使十件覆盖门禁变绿。

- [ ] **Step 1: 写五件体验存在性失败测试**

```ts
it.each([
  'artifact-houmuwu-ding',
  'artifact-four-ram-zun',
  'artifact-lotus-crane-hu',
  'artifact-cloud-bronze-jin',
  'artifact-zenghouyi-zunpan',
])('%s has a production-ready complete experience', id => {
  const artifact = parseContent(content).content.artifacts.find(item => item.id === id)
  expect(artifact && hasArtifactExperienceV2(artifact)).toBe(true)
  if (!artifact || !hasArtifactExperienceV2(artifact)) return
  expect(artifact.experienceV2.story).toHaveLength(5)
  expect(artifact.experienceV2.observationSpots).toHaveLength(3)
  expect(artifact.experienceV2.memoryChallenge.options).toHaveLength(3)
})
```

- [ ] **Step 2: 运行五件测试并确认 RED**

Run: `pnpm test -- src/content/content.test.ts`

Expected: 五个参数化用例均因缺少 `experienceV2` 失败。

- [ ] **Step 3: 为五件文物写五段故事**

使用核对后的来源按以下证据主线写作：

- 后母戊青铜方鼎：长方深腹与四柱足、范铸和大型铸造组织、礼器用途、发现与名称变化、重量和铭文能证明什么。
- 四羊方尊：四角卷角羊首、平面纹饰与立体附饰的铸造结合、尊的盛酒器类别、发现和收藏记录、复杂造型为何不能只看成装饰。
- 莲鹤方壶：莲瓣立鹤和龙兽附饰、分铸与合铸结构、春秋礼器与视觉动势、成对出土和分藏关系、从严整礼制到新审美的解释边界。
- 云纹铜禁：案形和镂空兽饰、复杂铸造工艺、承放酒器的“禁”、墓葬发现记录、失蜡法表述的证据边界。
- 曾侯乙尊盘：尊置于盘的组合、繁密镂空攀附结构、礼仪使用边界、曾侯乙墓出土、复杂工艺与可拆组合的知识价值。

- [ ] **Step 4: 为五件文物写观察、线索、记忆和许照内容**

以每件现有完整揭晓图为坐标底图，按下表写入三个不重叠观察点：

| 文物 | 观察签 01 | 观察签 02 | 观察签 03 |
|---|---|---|---|
| 后母戊青铜方鼎 | `spot-ding-ears`，`x=.23 y=.20`，“立耳与口沿” | `spot-ding-body`，`x=.52 y=.48`，“长方深腹” | `spot-ding-legs`，`x=.34 y=.76`，“四柱足” |
| 四羊方尊 | `spot-zun-rim`，`x=.50 y=.21`，“外侈方口” | `spot-zun-rams`，`x=.50 y=.51`，“四角羊首” | `spot-zun-relief`，`x=.36 y=.65`，“羊身与腹部” |
| 莲鹤方壶 | `spot-hu-crane`，`x=.54 y=.13`，“展翅立鹤” | `spot-hu-lotus`，`x=.49 y=.26`，“双层莲瓣” | `spot-hu-beasts`，`x=.45 y=.86`，“卷尾承兽” |
| 云纹铜禁 | `spot-jin-platform`，`x=.50 y=.51`，“案形承面” | `spot-jin-openwork`，`x=.50 y=.58`，“云纹镂空” | `spot-jin-beasts`，`x=.79 y=.58`，“兽形承托” |
| 曾侯乙尊盘 | `spot-zunpan-rim`，`x=.50 y=.25`，“镂空尊口” | `spot-zunpan-climbers`，`x=.50 y=.49`，“攀附龙兽” | `spot-zunpan-pan`，`x=.50 y=.69`，“尊盘组合” |

每个观察点 `radius=.10`，并在 375px 浏览器中确认按钮中心落在表中目标细节上。三枚线索分别回答器形、材质/工艺、来历；离柜一问只考一个关键误区；每件至少两条关联关系；五类许照台词各三条。任何线索和观察札记都不得出现完整答案名称。

- [ ] **Step 5: 运行十件覆盖测试并确认 GREEN**

Run: `pnpm test -- src/content/content.test.ts src/ui/artifact-assets.test.ts`

Expected: 十件 ID、30 个观察签、50 段故事、30 枚线索印、10 道记忆题全部 PASS，`validateContent(content).issues` 为空。

- [ ] **Step 6: 提交青铜文物内容**

```bash
git add projects/02-wuhualu/src/content/content.json projects/02-wuhualu/src/content/content.test.ts
git commit -m "content(wuhualu): complete five bronze artifact stories"
```

---

### Task 5: 删除旧版运行时并建立 CompleteArtifact 单一路径

**Files:**
- Modify: `projects/02-wuhualu/src/content/types.ts`
- Modify: `projects/02-wuhualu/src/content/validate.ts`
- Modify: `projects/02-wuhualu/src/content/content.json`
- Modify: `projects/02-wuhualu/src/content/content.test.ts`
- Modify: `projects/02-wuhualu/src/ui/artifact-assets.ts`
- Modify: `projects/02-wuhualu/src/ui/artifact-assets.test.ts`
- Modify: `projects/02-wuhualu/src/ui/experience-view-model.ts`
- Modify: `projects/02-wuhualu/src/ui/experience-view-model.test.ts`
- Modify: `projects/02-wuhualu/src/ui/story-view-model.ts`
- Modify: `projects/02-wuhualu/src/ui/story-view-model.test.ts`
- Modify: `projects/02-wuhualu/src/App.tsx`

**Interfaces:**
- Consumes: 十件完整 `experienceV2` 内容和十件静态资源清单。
- Produces: `CompleteArtifact`、`isCompleteArtifact`、返回 `CompleteArtifact[]` 的题池过滤器，以及无 `legacy` 联合类型的观察/故事 view model。

- [ ] **Step 1: 写旧逻辑禁止与完整类型失败测试**

在 `content.test.ts` 增加：

```ts
it('removes semantic copy for the retired legacy experience', () => {
  const copy = content.content.copy as Record<string, unknown>
  expect(copy).not.toHaveProperty('legacyObservationInstruction')
  expect(copy).not.toHaveProperty('legacyStoryPending')
  expect(copy).not.toHaveProperty('legacyArchiveAction')
  expect(copy).not.toHaveProperty('guideLegacyLine')
  expect(JSON.stringify(content)).not.toContain('完整故事整理中')
})
```

在 `experience-view-model.test.ts` 把旧版用例替换为只接受完整文物的断言：

```ts
const model = buildObservationViewModel(completeArtifact, question, [])
expect(model.spots).toHaveLength(3)
expect(model).not.toHaveProperty('kind')
```

- [ ] **Step 2: 运行相关测试并确认 RED**

Run: `pnpm test -- src/content/content.test.ts src/ui/experience-view-model.test.ts src/ui/story-view-model.test.ts src/ui/artifact-assets.test.ts`

Expected: FAIL，旧 copy 仍存在，view model 仍含 `kind`，资源过滤器返回 `Artifact[]`。

- [ ] **Step 3: 定义完整类型和守卫**

在 `types.ts` 增加：

```ts
export type CompleteArtifact = Artifact & { experienceV2: ArtifactExperienceV2 }

export function isCompleteArtifact(artifact: Artifact): artifact is CompleteArtifact {
  return artifact.experienceV2 !== undefined
}
```

删除 `hasArtifactExperienceV2`，所有测试和调用方改用 `isCompleteArtifact`。

- [ ] **Step 4: 收紧资源过滤器**

将接口改成：

```ts
export function filterPlayableArtifacts(artifacts: readonly Artifact[]): CompleteArtifact[] {
  return artifacts.filter(
    (artifact): artifact is CompleteArtifact =>
      isPlayableArtifactId(artifact.id) && isCompleteArtifact(artifact),
  )
}
```

增加 `findIncompleteRuntimeArtifactIds(artifacts): string[]`，返回资源清单中缺少完整体验的 ID；应用初始化发现非空数组时进入现有可恢复 `dataError` 页面。

- [ ] **Step 5: 删除观察和故事旧分支**

`buildObservationViewModel` 签名改为：

```ts
export function buildObservationViewModel(
  artifact: CompleteArtifact,
  question: QuizQuestion,
  openedIds: readonly string[],
): ObservationViewModel
```

直接读取 `artifact.experienceV2`，删除 `kind`、`legacy` instruction 参数和基础 `question.clues` 映射。`buildStoryViewModel` 同样只接受 `CompleteArtifact` 并只返回五段增强故事模型。

- [ ] **Step 6: 删除 App 条件渲染和旧 copy**

从 `content.json`、`ContentCopy`、`requiredCopy` 删除四个旧字段。`PlayExperience` 的 `artifact` 从 `state.artifacts` 中取得时必须是 `CompleteArtifact`；删掉 `hasArtifactExperienceV2` 分支、旧摘记、旧继续入藏按钮和旧许照台词路径。

- [ ] **Step 7: 运行相关测试并确认 GREEN**

Run: `pnpm test -- src/content/content.test.ts src/ui/experience-view-model.test.ts src/ui/story-view-model.test.ts src/ui/artifact-assets.test.ts src/app/page-model.test.ts`

Expected: 全部 PASS；源码和内容中 `rg -n "legacyObservation|legacyStory|legacyArchive|guideLegacy|hasArtifactExperienceV2" src` 无结果。

- [ ] **Step 8: 提交单一路径改造**

```bash
git add projects/02-wuhualu/src
git commit -m "refactor(wuhualu): remove legacy artifact experience"
```

---

### Task 6: 使用真实比例观察底图并修复窄屏裁切

**Files:**
- Modify: `projects/02-wuhualu/src/ui/artifact-assets.ts`
- Modify: `projects/02-wuhualu/src/ui/artifact-assets.test.ts`
- Modify: `projects/02-wuhualu/src/ui/ArtifactMedia.tsx`
- Modify: `projects/02-wuhualu/src/ui/SpotlightStage.tsx`
- Modify: `projects/02-wuhualu/src/ui/SpotlightStage.test.tsx`
- Modify: `projects/02-wuhualu/src/App.css`

**Interfaces:**
- Consumes: `RuntimeArtifactAssets.observationWidth/observationHeight` 与 30 个完整图坐标。
- Produces: `SpotlightStage` 的真实宽高比样式、完整图片内容盒和不产生横向滚动的手机观察台。

- [ ] **Step 1: 写真实比例和默认观察图失败测试**

在 `artifact-assets.test.ts` 增加：

```ts
it.each(playableArtifactIds)('%s observes the stable full artifact image without clue switching', id => {
  const assets = getRuntimeArtifactAssets(id)
  expect(assets?.observation).toBeTruthy()
  expect(assets?.observationWidth).toBeGreaterThan(0)
  expect(assets?.observationHeight).toBeGreaterThan(0)
  if (id !== 'artifact-zenghouyi-bells') expect(assets?.observation).toBe(assets?.reveal)
})
```

在 `SpotlightStage.test.tsx` 断言：

```ts
const stage = screen.getByRole('region', { name: '互动观察台' })
expect(stage.style.aspectRatio).toBe(`${assets.observationWidth} / ${assets.observationHeight}`)
expect(screen.getByRole('img')).toHaveProperty('src', expect.stringContaining(assets.observation))
expect(screen.getAllByRole('button', { name: /观察签/ })).toHaveLength(3)
```

- [ ] **Step 2: 运行组件与资源测试并确认 RED**

Run: `pnpm test -- src/ui/artifact-assets.test.ts src/ui/SpotlightStage.test.tsx`

Expected: FAIL，九件默认观察图仍为首张局部图，stage 未输出资源比例内联样式。

- [ ] **Step 3: 改用完整揭晓图作为默认观察图**

把 `entry` 默认 observation 从首张 clue 改为 reveal：

```ts
observation: { file: string; width: number; height: number } = {
  file: reveal,
  width: 900,
  height: 1125,
},
```

曾侯乙编钟保留 1200 × 800 显式覆盖。

- [ ] **Step 4: 让观察台输出真实比例**

`SpotlightStage` 获取资源后设置：

```tsx
style={{ aspectRatio: `${assets.observationWidth} / ${assets.observationHeight}` }}
```

CSS 删除 `.spotlight-stage` 的 `min-height: 260px`，图片规则改为：

```css
.spotlight-stage { width: 100%; min-width: 0; }
.spotlight-stage .artifact-media img { width: 100%; height: 100%; object-fit: contain; }
```

观察签仍以图片内容盒坐标定位；由于 stage 与图片使用同一宽高比，外层不产生 letterbox 坐标偏差。

- [ ] **Step 5: 运行组件与资源测试并确认 GREEN**

Run: `pnpm test -- src/ui/artifact-assets.test.ts src/ui/SpotlightStage.test.tsx src/ui/ArtifactMedia.test.tsx`

Expected: 全部 PASS。

- [ ] **Step 6: 提交观察台修复**

```bash
git add projects/02-wuhualu/src/ui projects/02-wuhualu/src/App.css
git commit -m "fix(wuhualu): keep mobile artifact observations uncropped"
```

---

### Task 7: 更新内容契约并完成全量验证

**Files:**
- Modify: `projects/02-wuhualu/CONTENT-V2-CONTRACT.md`
- Modify: `projects/02-wuhualu/VISUAL-QA.md`
- Modify: `projects/02-wuhualu/IMPLEMENTATION-PLAN-UNIFIED-TEN-ARTIFACTS.md`
- Test: all `projects/02-wuhualu/src/**/*.test.ts*`

**Interfaces:**
- Consumes: Tasks 1–6 的完整内容、单一路径运行时和响应式观察台。
- Produces: 可复现的自动化与真实浏览器验收记录、干净提交。

- [ ] **Step 1: 更新契约文档**

将 `CONTENT-V2-CONTRACT.md` 从“单件黄金样例”更新为“十件完整体验门禁”，明确另外十件不参与运行时、旧 copy 已删除、观察图使用真实比例完整图。

- [ ] **Step 2: 运行项目完整自动化门禁**

Run: `pnpm lint && pnpm test && pnpm build`

Expected: lint 无警告；全部测试 PASS；Vite 生产构建成功且无资源解析错误。

- [ ] **Step 3: 启动真实浏览器并检查五个宽度**

Run: `pnpm dev --host 127.0.0.1`

使用 Playwright CLI 在 320 / 360 / 375 / 390 / 430 宽度逐一检查：

```js
({
  innerWidth,
  scrollWidth: document.documentElement.scrollWidth,
  markerSizes: [...document.querySelectorAll('.inspection-marker')].map(element => {
    const rect = element.getBoundingClientRect()
    return { width: rect.width, height: rect.height }
  }),
  brokenImages: [...document.images].filter(image => !image.complete || image.naturalWidth === 0).length,
})
```

每个宽度必须满足 `scrollWidth === innerWidth`、三个 marker 均至少 48 × 48、`brokenImages === 0`。

- [ ] **Step 4: 跑通十件文物的关键页面**

使用固定 seed 或结构化本地状态逐件进入观察页，确认 10 件均显示三个观察签；至少完整跑通一件竖图文物和曾侯乙编钟横图文物的观察、拆印、作答、五段故事、离柜一问、入藏。记录控制台 error/warning 数量为 0，并验证 reduced-motion 下推荐观察签仍有静态轮廓。

- [ ] **Step 5: 写入视觉 QA 证据并清理浏览器产物**

把每个视口的 `innerWidth/scrollWidth`、观察台宽高、marker 尺寸、资源错误和控制台结果写入 `VISUAL-QA.md`。关闭浏览器与开发服务器，清理项目内 `.playwright-cli` 临时目录。

- [ ] **Step 6: 再次运行最终门禁**

Run: `pnpm lint && pnpm test && pnpm build && git diff --check -- projects/02-wuhualu`

Expected: 所有命令退出码为 0。

- [ ] **Step 7: 完成计划复选框并提交**

把本计划所有步骤标为 `[x]`，只暂存 `projects/02-wuhualu`，核对 `git diff --cached --name-only` 不含其他项目，然后提交：

```bash
git add projects/02-wuhualu
git commit -m "feat(wuhualu): complete ten artifact experiences"
```
