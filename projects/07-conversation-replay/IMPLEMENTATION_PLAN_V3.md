# Conversation Replay V3 NPC Companion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将迟言升级为贯穿主要页面的温和编辑搭档，新增并验收六张一致立绘，重审全部正向业务文案，同时保持隐私、安全和用户自主权边界。

**Architecture:** `src/content/content.json` 新增经过审核的 NPC 身份与页面 moment，运行时校验器负责完整性和伦理门禁，`buildScreenViewModelV2()` 将当前页面映射为 `CompanionViewModel`，React 的 `CompanionNote` 只渲染 ViewModel。六张新 WebP 先于任何 `src/**` 修改完成并通过独立资源板硬门槛；NPC 表现状态不进入用户草稿或 schema 2 存储。

**Tech Stack:** React 19、TypeScript 6、Vite 8、Vitest 4、项目内 WebP／SVG、CSS、Playwright CLI、内置 imagegen。

**Spec:** `NPC-COMPANION-V3.md`

## Global Constraints

- 只修改 `projects/07-conversation-replay/**`；不修改其他项目、根配置、锁文件、`docs/` 或 `prep/`。
- 不新增依赖；不执行 Git 写操作，以测试和文件清单作为检查点。
- 六张新增立绘全部生成并通过视觉验收前，不修改 `src/**` 应用代码。
- 业务文案只存在于 `src/content/content.json`；组件不得自行拼接迟言台词。
- 不新增自由聊天、NPC 记忆、好感度、语音、后端、运行时 API 或 CDN。
- 不读取、上传或保存聊天记录、用户图片、Base64、Blob、音视频。
- 迟言不得制造排他依赖、永久承诺、诊断、结果保证、情绪绑架或代替用户决定关系。
- 安全页面明确现实支持优先，不出现普通沟通草稿、演练或鼓励对质。
- sticky 顶栏与锚点继续叠加 `var(--safe-area-inset-top, env(safe-area-inset-top, 0px))`，并用 32px 非零值验证。
- 最终执行 `pnpm lint && pnpm test && pnpm build`，并验证 375／390／430 CSS px。

---

## Phase A — 六张立绘先行硬门槛

### Task 1: 生成六张迟言语义立绘

**Files:**
- Reference: `public/assets/guide/chiyan-guide-master.webp`
- Create: `public/assets/guide/chiyan-attend.webp`
- Create: `public/assets/guide/chiyan-observe.webp`
- Create: `public/assets/guide/chiyan-sort.webp`
- Create: `public/assets/guide/chiyan-pause.webp`
- Create: `public/assets/guide/chiyan-compose.webp`
- Create: `public/assets/guide/chiyan-complete.webp`

**Interfaces:**
- Consumes: 已验收的 900×1200 迟言主图，只作为身份、服装、媒介和道具参考。
- Produces: 六张 900×1200 WebP，后续 `COMPANION_ASSETS` 使用稳定文件名。

- [ ] **Step 1: 检查参考主图并冻结不变量**

使用本地图片查看器以原始细节打开：

```text
public/assets/guide/chiyan-guide-master.webp
```

记录并在六次生成中重复：同一原创中国年轻男性、相同脸型与黑色蓬松短发、深海军蓝薄外套、暖灰内搭、米色长裤、木色铅笔、暖白分栏本、细腻铅笔与淡水粉质感、蓝灰／鼠尾草绿／赭石／少量灰玫瑰色、透明或纯暖白背景。

- [ ] **Step 2: 生成 `attend` 倾听立绘**

使用内置 imagegen，参考本地主图，提示词固定为：

```text
Use case: identity-preserve
Asset type: mobile web NPC companion standing illustration
Primary request: Create a new pose of the exact same original fictional editor Chiyan from the reference. He leans forward slightly with calm attentive eye contact, both hands naturally resting on a closed blank divider notebook held near his waist. The pose communicates quiet listening without touching or embracing anyone.
Style/medium: preserve the reference's delicate pencil and light watercolor editorial illustration.
Composition/framing: transparent or solid warm-white background, vertical 3:4, complete head, both hands and notebook, cropped around mid-thigh, readable at 80px wide.
Constraints: preserve identity, face, hair, navy overshirt, warm-gray inner shirt, beige trousers, wooden pencil and notebook design. Neutral warm expression; hands anatomically credible.
Avoid: text, pseudo-text, chat bubbles, phones, ratings, red/green correctness, counseling room, medical clothing, customer-service headset, physical comforting touch, romance, brand marks, extra people.
```

- [ ] **Step 3: 生成 `observe` 观察立绘**

```text
Use case: identity-preserve
Asset type: mobile web NPC companion standing illustration
Primary request: Create a new pose of the exact same original fictional editor Chiyan from the reference. One hand supports the open divider notebook; the other holds the wooden pencil and points gently toward one completely blank removable paper slip, as if identifying only what can be observed.
Style/medium: preserve the reference's delicate pencil and light watercolor editorial illustration.
Composition/framing: transparent or solid warm-white background, vertical 3:4, complete head, both hands, pencil and full notebook, cropped around mid-thigh, readable at 80px wide.
Constraints: preserve identity, face, hair and clothing. Exactly one highlighted blank slip; remaining paper areas blank; calm neutral expression; credible fingers and paper pressure.
Avoid: any text or pseudo-text, camera logos, chat bubbles, phones, ratings, pointing at the viewer, warning gestures, brands, extra people.
```

- [ ] **Step 4: 生成 `sort` 分类立绘**

```text
Use case: identity-preserve
Asset type: mobile web NPC companion standing illustration
Primary request: Create a new pose of the exact same original fictional editor Chiyan from the reference. He is carefully moving one completely blank removable paper slip from the left side of an open two-column notebook to the right side. A single subtle line arrow inside the notebook shows the classification movement.
Style/medium: preserve the reference's delicate pencil and light watercolor editorial illustration.
Composition/framing: transparent or solid warm-white background, vertical 3:4, complete head, both hands and full notebook, cropped around mid-thigh, movement readable at 80px wide.
Constraints: preserve identity, face, hair and clothing; one center divider; credible hands; blank slips only; expression focused and nonjudgmental.
Avoid: text, pseudo-text, chat bubbles, scores, red/green feedback, game effects, diagnosis imagery, brains, question marks, brands, extra people.
```

- [ ] **Step 5: 生成 `pause` 停笔立绘**

```text
Use case: identity-preserve
Asset type: mobile web NPC companion standing illustration
Primary request: Create a new pose of the exact same original fictional editor Chiyan from the reference. He holds the divider notebook steadily while the wooden pencil rests lightly along the page edge. His shoulders are relaxed and the composition leaves visual breathing room, expressing permission to pause.
Style/medium: preserve the reference's delicate pencil and light watercolor editorial illustration.
Composition/framing: transparent or solid warm-white background, vertical 3:4, complete head, both hands, pencil and notebook, cropped around mid-thigh, readable at 80px wide.
Constraints: preserve identity, face, hair and clothing; sober calm expression, not sad or frightened; credible hands.
Avoid: text, pseudo-text, alarms, sirens, heroic rescue pose, hugging, chat bubbles, phones, medical or counseling symbols, brands, extra people.
```

- [ ] **Step 6: 生成 `compose` 组织表达立绘**

```text
Use case: identity-preserve
Asset type: mobile web NPC companion standing illustration
Primary request: Create a new pose of the exact same original fictional editor Chiyan from the reference. He arranges four completely blank removable paper slips in a clear sequence beside the center divider, using the wooden pencil as a gentle ordering tool. He faces the user without pointing or commanding.
Style/medium: preserve the reference's delicate pencil and light watercolor editorial illustration.
Composition/framing: transparent or solid warm-white background, vertical 3:4, complete head, both hands, pencil and full notebook, cropped around mid-thigh, sequence readable at 80px wide.
Constraints: preserve identity, face, hair and clothing; exactly four blank slips; calm collaborative expression; credible fingers.
Avoid: text, pseudo-text, chat bubbles, message UI, arrows aimed at the viewer, ratings, red/green correctness, brands, extra people.
```

- [ ] **Step 7: 生成 `complete` 收束立绘**

```text
Use case: identity-preserve
Asset type: mobile web NPC companion standing illustration
Primary request: Create a new pose of the exact same original fictional editor Chiyan from the reference. He has partly closed the blank divider notebook and gives a very small calm nod. The pose communicates completion and returning the decision to the user, not celebration or approval.
Style/medium: preserve the reference's delicate pencil and light watercolor editorial illustration.
Composition/framing: transparent or solid warm-white background, vertical 3:4, complete head, both hands, pencil and notebook, cropped around mid-thigh, readable at 80px wide.
Constraints: preserve identity, face, hair and clothing; restrained neutral-warm expression; credible hands.
Avoid: text, pseudo-text, thumbs-up, applause, trophies, confetti, stars, scores, chat bubbles, brands, extra people.
```

- [ ] **Step 8: 逐张原图验收并单点修正**

对六张生成结果逐一使用本地图片查看器；每张必须同时通过：

```text
身份、脸型、发型和服装与主图一致；头顶、双手和语义道具完整；
动作符合文件语义；手指、铅笔、本脊和纸条受力可信；
无文字、伪字、聊天、评分、品牌、真人或额外人物；
80px 宽缩略时仍能区分 attend / observe / sort / pause / compose / complete。
```

若失败，只针对失败项再调用一次 imagegen 编辑；不得把失败版本放入项目。

- [ ] **Step 9: 将通过原图复制进项目并导出 WebP**

将每张内置 imagegen 结果从 `$CODEX_HOME/generated_images/...` 复制为项目内临时 `*-source.png`，再逐张执行：

```bash
ffmpeg -y -i public/assets/guide/chiyan-attend-source.png -vf "scale=900:1200:force_original_aspect_ratio=increase,crop=900:1200" -c:v libwebp -quality 84 public/assets/guide/chiyan-attend.webp
ffmpeg -y -i public/assets/guide/chiyan-observe-source.png -vf "scale=900:1200:force_original_aspect_ratio=increase,crop=900:1200" -c:v libwebp -quality 84 public/assets/guide/chiyan-observe.webp
ffmpeg -y -i public/assets/guide/chiyan-sort-source.png -vf "scale=900:1200:force_original_aspect_ratio=increase,crop=900:1200" -c:v libwebp -quality 84 public/assets/guide/chiyan-sort.webp
ffmpeg -y -i public/assets/guide/chiyan-pause-source.png -vf "scale=900:1200:force_original_aspect_ratio=increase,crop=900:1200" -c:v libwebp -quality 84 public/assets/guide/chiyan-pause.webp
ffmpeg -y -i public/assets/guide/chiyan-compose-source.png -vf "scale=900:1200:force_original_aspect_ratio=increase,crop=900:1200" -c:v libwebp -quality 84 public/assets/guide/chiyan-compose.webp
ffmpeg -y -i public/assets/guide/chiyan-complete-source.png -vf "scale=900:1200:force_original_aspect_ratio=increase,crop=900:1200" -c:v libwebp -quality 84 public/assets/guide/chiyan-complete.webp
```

转换完成并确认六个 WebP 后，只移除本任务生成的六个 `*-source.png`。

- [ ] **Step 10: 验证六张交付属性**

```bash
for f in public/assets/guide/chiyan-{attend,observe,sort,pause,compose,complete}.webp; do
  ffprobe -v error -select_streams v:0 -show_entries stream=width,height,codec_name -of default=noprint_wrappers=1 "$f"
done
```

预期：六张均为 WebP、900×1200、正常解码。

### Task 2: 扩展独立资源板并执行美术硬门槛

**Files:**
- Modify: `design/assets-board.html`
- Modify: `ART-REQUEST.md`
- Modify: `PROMPTS.md`

**Interfaces:**
- Consumes: Task 1 的六张 WebP 与现有 3 张 WebP／17 个 SVG。
- Produces: 资源开发前验收证据；通过后才允许进入 Phase B。

- [ ] **Step 1: 在资源板增加立绘区**

在现有 SVG 尺寸板前增加 7 张语义卡：欢迎主图和六张新增立绘。每卡同时显示 80px 移动端裁切与 180px 中型裁切，使用以下路径数组：

```js
const companions = ['guide-master', 'attend', 'observe', 'sort', 'pause', 'compose', 'complete']
```

生成 `<img src="/assets/guide/chiyan-${name}.webp">`；`guide-master` 单独映射到 `/assets/guide/chiyan-guide-master.webp`。每张图必须有文件名和中文姿态说明。

- [ ] **Step 2: 浏览器验证 390px 和 1080px 资源板**

在开发服务器打开 `/design/assets-board.html`，分别测量：

```js
({
  images: document.images.length,
  broken: [...document.images].filter((image) => !image.complete || !image.naturalWidth).length,
  viewport: innerWidth,
  documentWidth: document.documentElement.scrollWidth,
})
```

预期：65 个图片引用（7 张立绘×2 种裁切 + 17×3 SVG）、`broken=0`、`documentWidth===viewport`、控制台 0 error／warning。

- [ ] **Step 3: 人工检查姿态区分和情感正确性**

逐一确认：

```text
attend 不像恋爱凝视或心理咨询；observe 不像责备；sort 不像游戏奖励；
pause 不像恐慌或悲伤诊断；compose 不像命令；complete 不像打分或庆祝；
七张身份一致，80px 裁切仍可识别动作，人物不携带可读文字。
```

- [ ] **Step 4: 更新资源台账**

在 `ART-REQUEST.md` 记录最终文件、尺寸、字节数、逐图结论和资源板数据；在 `PROMPTS.md` 保存六条最终提示词、内置 imagegen 原图路径及任何单点修正。

- [ ] **Step 5: Phase A 硬门槛**

```bash
test "$(find public/assets/guide -maxdepth 1 -name '*.webp' | wc -l)" -eq 9
test "$(find public/assets/icons -maxdepth 1 -name '*.svg' | wc -l)" -eq 17
```

预期：9 个 WebP、17 个 SVG；只有本步骤和浏览器资源板均通过后才开始 Task 3。

---

## Phase B — 文案、内容契约与应用

### Task 3: 建立 NPC 内容契约与伦理门禁

**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/content/content.test.ts`
- Modify: `src/content/validate.ts`
- Modify: `src/content/content.json`

**Interfaces:**
- Consumes: `NPC-COMPANION-V3.md` 的角色边界和页面陪伴地图。
- Produces: `NpcPose`、`NpcMomentKey`、`NpcMoment`、`NpcContent` 与经过校验的 `content.npc`。

- [ ] **Step 1: 写 NPC 契约失败测试**

在 `src/content/content.test.ts` 增加：

```ts
const momentKeys = [
  'landing', 'privacy', 'guide', 'relationship', 'goal', 'scenario', 'fact', 'feeling',
  'inference', 'need', 'request', 'draft', 'practice', 'comparison', 'result', 'saved',
  'exit', 'safety', 'recovery',
] as const

it('provides a complete and bounded Chiyan companion script', () => {
  const content = parseContent(rawContent)
  expect(content.content.npc.id).toBe('chiyan')
  expect(content.content.npc.role).toBe('温和编辑搭档')
  expect(Object.keys(content.content.npc.moments).sort()).toEqual([...momentKeys].sort())
  for (const key of momentKeys) {
    const moment = content.content.npc.moments[key]
    expect(moment.invitation.trim(), key).not.toBe('')
    expect(moment.autonomy.trim(), key).not.toBe('')
  }
  expect(content.content.npc.moments.safety.pose).toBe('safety')
  expect(content.content.npc.moments.safety.reassurance).toContain('现实')
})
```

- [ ] **Step 2: 写伦理违规失败测试**

```ts
it.each([
  ['只有我懂你', '排他依赖'],
  ['我会永远陪着你', '永久承诺'],
  ['这样说对方一定会理解', '结果保证'],
  ['你现在必须当面对质', '强迫对质'],
])('rejects unsafe NPC copy: %s', (copy, expected) => {
  const invalid = structuredClone(rawContent) as typeof rawContent
  invalid.content.npc.moments.fact.invitation = copy
  const result = validateContent(invalid, 'production')
  expect(result.ok).toBe(false)
  expect(result.errors.some(({ message }) => message.includes(expected))).toBe(true)
})
```

再复制安全 moment，把 `reassurance` 改成“现在继续练习怎样对质”，断言错误路径为 `content.npc.moments.safety.reassurance`。

- [ ] **Step 3: 运行测试并确认红灯**

```bash
pnpm test src/content/content.test.ts
```

预期：因 `content.npc` 和相关类型／校验不存在而失败。

- [ ] **Step 4: 定义类型**

在 `src/domain/types.ts` 增加：

```ts
export type NpcPose = 'welcome' | 'attend' | 'observe' | 'sort' | 'pause' | 'compose' | 'complete' | 'safety'
export type NpcMomentKey =
  | 'landing' | 'privacy' | 'guide' | 'relationship' | 'goal' | 'scenario'
  | 'fact' | 'feeling' | 'inference' | 'need' | 'request' | 'draft'
  | 'practice' | 'comparison' | 'result' | 'saved' | 'exit' | 'safety' | 'recovery'
export type NpcMoment = {
  pose: NpcPose
  invitation: string
  reassurance?: string
  autonomy: string
}
export type NpcContent = {
  id: 'chiyan'
  name: string
  role: string
  boundaries: string[]
  moments: Record<NpcMomentKey, NpcMoment>
}
```

给 `ConversationContentPackage['content']` 增加 `npc: NpcContent`，保持 `schemaVersion: 1` 和存储 schema 2 不变。

- [ ] **Step 5: 写入 19 个经过审核的 moment**

在 `src/content/content.json` 的 `content` 内增加以下内容；不得把这些句子复制进 JSX：

```json
{
  "npc": {
    "id": "chiyan",
    "name": "迟言",
    "role": "温和编辑搭档",
    "boundaries": [
      "只陪你整理表达，不判断谁对谁错。",
      "不替你推断人格、动机或关系责任。",
      "不保证换种说法就能得到理解或答应。",
      "遇到安全风险时，现实支持优先于应用陪伴。"
    ],
    "moments": {
      "landing": { "pose": "welcome", "invitation": "如果愿意，我陪你从一个最接近的情境开始。", "reassurance": "不用贴聊天记录，也不用一次讲完整。", "autonomy": "你可以随时停下，决定权一直在你。" },
      "privacy": { "pose": "welcome", "invitation": "开始前，我们先把保存方式说清楚。", "reassurance": "无痕只留在当前会话；本机保存最多三份结构化复盘。", "autonomy": "选哪一种都不影响后面的整理。" },
      "guide": { "pose": "welcome", "invitation": "我会陪你区分事实、感受、推测、需要和请求。", "reassurance": "我们只整理你愿意整理的部分。", "autonomy": "你可以跳过引导，也可以随时返回修改。" },
      "relationship": { "pose": "attend", "invitation": "先不用解释完整故事，我们只找一个大致位置。", "autonomy": "选最接近的一项就够了。" },
      "goal": { "pose": "attend", "invitation": "关系已经选好，接着只看你这次最想表达什么。", "autonomy": "没有标准答案，选此刻最重要的一项。" },
      "scenario": { "pose": "attend", "invitation": "我不会替你认定发生了什么；先找最接近的一种。", "autonomy": "不确定时，也可以使用通用结构继续。" },
      "fact": { "pose": "observe", "invitation": "情境放在桌上了。我们先只看能够观察或核对的部分。", "reassurance": "解释和动机可以稍后再放回来。", "autonomy": "只选你确认发生过的内容。" },
      "feeling": { "pose": "attend", "invitation": "事实先放好了。到这里可以慢一点，看看自己的体验。", "reassurance": "感受没有标准答案，也不需要证明合理。", "autonomy": "选一到两项最接近的词就可以。" },
      "inference": { "pose": "sort", "invitation": "有些判断很真实，但还需要核对。我们把它们暂时放进推测栏。", "reassurance": "分类不是说你想多了，也不否定刚才的感受。", "autonomy": "你可以移动，也可以撤回。" },
      "need": { "pose": "pause", "invitation": "先把“对方必须怎样”放到一边，看看这次想守住什么。", "reassurance": "需要说的是你的重视，不是给对方的命令。", "autonomy": "只选此刻最重要的一到两项。" },
      "request": { "pose": "compose", "invitation": "接下来把需要变成一个具体、可执行的请求。", "reassurance": "清楚请求不等于强迫答应。", "autonomy": "对方可以拒绝或协商，你也可以据此决定自己的下一步。" },
      "draft": { "pose": "compose", "invitation": "五层材料已经齐了。我们先把它们组织成一份备选表达。", "reassurance": "先读一遍，不必马上发送。", "autonomy": "语气和文字都可以由你修改。" },
      "practice": { "pose": "compose", "invitation": "如果愿意，我们只练习一种可能的回应。", "reassurance": "这不是预测对方，也不是要求你继续谈。", "autonomy": "你可以选一句继续，也可以返回草稿。" },
      "comparison": { "pose": "complete", "invitation": "现在可以看看，哪些层次比原来更容易被听见。", "reassurance": "更清楚不代表原来的感受不真实。", "autonomy": "这只是结构对照，不是对错评分。" },
      "result": { "pose": "complete", "invitation": "这次的结构已经整理到这里。", "reassurance": "它是一份可选草稿，不保证对方理解或答应。", "autonomy": "是否使用、何时使用，都由你决定。" },
      "saved": { "pose": "attend", "invitation": "这里列出的，只是你主动保存在本机的结构化复盘。", "autonomy": "你可以恢复或逐份删除，不会影响当前未保存内容。" },
      "exit": { "pose": "pause", "invitation": "可以停在这里。退出前，我们把会消失的内容说清楚。", "autonomy": "继续整理或不保存退出，都由你决定。" },
      "safety": { "pose": "safety", "invitation": "这里我先退到辅助位置。现在更重要的是确认现实中的安全。", "reassurance": "应用里的陪伴不能代替可信任的人、紧急支持或专业帮助。", "autonomy": "如果此刻不安全，可以先离开可能升级的现场，再决定是否沟通。" },
      "recovery": { "pose": "attend", "invitation": "当前结构化选择仍在这次会话里。我们先确认下一步。", "reassurance": "保存失败不会自动改用云端，也不会要求上传聊天记录。", "autonomy": "你可以重试、返回编辑，或不保存退出。" }
    }
  }
}
```

- [ ] **Step 6: 实现运行时 NPC 校验**

在 `validate.ts` 增加固定集合和函数：

```ts
const npcMomentKeys = new Set<NpcMomentKey>([
  'landing', 'privacy', 'guide', 'relationship', 'goal', 'scenario', 'fact', 'feeling',
  'inference', 'need', 'request', 'draft', 'practice', 'comparison', 'result', 'saved',
  'exit', 'safety', 'recovery',
])
const npcPoses = new Set<NpcPose>(['welcome', 'attend', 'observe', 'sort', 'pause', 'compose', 'complete', 'safety'])
const npcCopyRules = [
  { pattern: /只有我懂你|只需要和我/, label: '排他依赖' },
  { pattern: /永远陪|一直陪着你/, label: '永久承诺' },
  { pattern: /一定会理解|保证.+(?:答应|修复)|照.+做.+就能/, label: '结果保证' },
  { pattern: /必须.+(?:当面|对质)/, label: '强迫对质' },
] as const
```

验证精确 moment key、合法 pose、非空 `invitation`／`autonomy`、可选但非空的 `reassurance`、非空 boundaries；对 NPC 全部文案运行规则并返回精确路径。安全 moment 额外要求 `reassurance` 包含“现实”，且 invitation／reassurance／autonomy 合并文本不含“演练”“对质”。

- [ ] **Step 7: 重跑内容测试**

```bash
pnpm test src/content/content.test.ts
```

预期：NPC 契约与现有 32 情境测试全部通过。

### Task 4: 全量正向文案审查与回归门禁

**Files:**
- Create: `COPY-AUDIT-V3.md`
- Modify: `src/content/content.json`
- Modify: `src/content/content.test.ts`

**Interfaces:**
- Consumes: 内容包中的 32 情境、32 rewrites、请求、练习、安全规则和 NPC moment。
- Produces: 审计记录，以及 `collectPositiveCopy()` 覆盖的正向文案伦理回归测试。

- [ ] **Step 1: 建立正向输出收集器测试**

在测试文件内建立只收集用户可能采用的表达，不扫描作为反例展示的 `discouragedExpressions`：

```ts
function collectPositiveCopy(content: ReturnType<typeof parseContent>) {
  return [
    ...content.content.scenarios.flatMap((scenario) => [
      ...scenario.replay.factOptions.flatMap(({ label, explanation }) => [label, explanation]),
      ...scenario.replay.requestOptions.flatMap(({ label, structure }) => [label, structure.when, structure.behavior, structure.boundary]),
      ...scenario.replay.practiceOptions.flatMap(({ label, replyOptions }) => [label, ...replyOptions.map(({ label: reply }) => reply)]),
    ]),
    ...content.content.rewrites.flatMap(({ tones, repairLine, nextTimeLine, nextSteps }) => [
      tones.gentle, tones.direct, tones.firm, repairLine, nextTimeLine,
      ...nextSteps.flatMap(({ label, description }) => [label, description]),
    ]),
    ...Object.values(content.content.npc.moments).flatMap(({ invitation, reassurance, autonomy }) => [invitation, reassurance ?? '', autonomy]),
  ]
}
```

断言正向文案不命中：

```ts
const forbidden = [
  /只有我懂你|只需要和我/,
  /永远陪|一直陪着你/,
  /如果你在乎我.+就/,
  /一定会理解|保证.+(?:答应|修复)/,
  /你(?:就是|一定是).*(?:有病|人格|自恋)/,
]
for (const copy of collectPositiveCopy(content)) {
  for (const pattern of forbidden) expect(copy).not.toMatch(pattern)
}
```

- [ ] **Step 2: 按十项框架逐条审阅内容**

对每个 scenarioId 建立一行审计表，列：事实、感受归属、推测留白、需要非命令、请求可拒绝、责任、情绪承接、修复、演练、安全。`COPY-AUDIT-V3.md` 必须有 32 行且每行写 `通过` 或具体修订，不使用空白状态。

- [ ] **Step 3: 修订发现的问题**

只修改 `content.json` 中确有问题的正向字段。修订规则固定：

```text
动机断言 → “我把它理解成……，但不确定，想先核对”；
抽象要求 → 时间／可观察行为／自身边界；
隐含强迫 → 明确允许拒绝或提供替代方式；
过度认错 → “我刚才把表达说成了判断，真正想说明的是……”；
结果保证 → “更清楚不保证理解或答应”；
安全情境 → 暂停普通沟通，现实支持优先。
```

不得修改冻结 `description` 的事实含义，不新增第二条虚构事实。

- [ ] **Step 4: 记录逐项结论**

`COPY-AUDIT-V3.md` 顶部汇总：检查字段数量、修改字段数量、无需修改数量、安全情境数量；末尾记录所有实际修改的 JSON 路径和修改理由。

- [ ] **Step 5: 运行内容测试**

```bash
pnpm test src/content/content.test.ts
```

预期：32 情境冻结计数、NPC 伦理门禁和正向文案扫描全部通过。

### Task 5: 资源清单与 Companion ViewModel

**Files:**
- Modify: `src/assets/manifest.ts`
- Modify: `src/assets/manifest.test.ts`
- Modify: `src/app/viewV2.ts`
- Modify: `src/app/viewV2.test.ts`

**Interfaces:**
- Consumes: Task 1 的六张 WebP、Task 3 的 `NpcPose`／`NpcMomentKey`／`NpcMoment`。
- Produces: `COMPANION_ASSETS`、`CompanionViewModel` 和 `ScreenViewModelV2.companion`。

- [ ] **Step 1: 写资源与页面映射失败测试**

资源测试增加：

```ts
expect(Object.keys(COMPANION_ASSETS)).toHaveLength(8)
expect(COMPANION_ASSETS.safety).toBe(COMPANION_ASSETS.pause)
for (const path of new Set(Object.values(COMPANION_ASSETS))) {
  expect(existsSync(join(process.cwd(), 'public', path)), path).toBe(true)
}
```

ViewModel 测试在现有 19 页循环内增加：

```ts
expect(screen.companion.name, page).toBe('迟言')
expect(screen.companion.invitation.trim(), page).not.toBe('')
expect(screen.companion.autonomy.trim(), page).not.toBe('')
```

安全页额外断言：

```ts
expect(screen.companion.pose).toBe('safety')
expect(screen.companion.reassurance).toContain('现实')
expect(`${screen.companion.invitation}${screen.companion.reassurance}`).not.toContain('演练')
```

- [ ] **Step 2: 运行测试并确认红灯**

```bash
pnpm test src/assets/manifest.test.ts src/app/viewV2.test.ts
```

预期：`COMPANION_ASSETS` 和 `screen.companion` 不存在而失败。

- [ ] **Step 3: 实现稳定资源清单**

在 `manifest.ts` 增加：

```ts
export const COMPANION_ASSETS = {
  welcome: 'assets/guide/chiyan-guide-master.webp',
  attend: 'assets/guide/chiyan-attend.webp',
  observe: 'assets/guide/chiyan-observe.webp',
  sort: 'assets/guide/chiyan-sort.webp',
  pause: 'assets/guide/chiyan-pause.webp',
  compose: 'assets/guide/chiyan-compose.webp',
  complete: 'assets/guide/chiyan-complete.webp',
  safety: 'assets/guide/chiyan-pause.webp',
} as const satisfies Record<NpcPose, string>
```

- [ ] **Step 4: 定义并构建 Companion ViewModel**

在 `viewV2.ts` 增加：

```ts
export type CompanionViewModel = NpcMoment & {
  name: string
  role: string
  imageSrc: string
  fallbackSrc: string
}
```

`ScreenViewModelV2` 增加 `companion: CompanionViewModel`。在 `buildScreenViewModelV2()` 入口用 `state.page` 读取 `content.content.npc.moments[state.page]`，guide 仍映射 `guide`；`imageSrc = assetUrl(COMPANION_ASSETS[moment.pose])`，`fallbackSrc = assetUrl(GUIDE_ASSETS.placeholder)`。`base()` 必须接收 companion，不能在组件内硬编码 fallback 台词。

- [ ] **Step 5: 重跑目标测试**

```bash
pnpm test src/assets/manifest.test.ts src/app/viewV2.test.ts
```

预期：资源 8 个语义键、7 个唯一图片路径、19 页 companion 和安全映射全部通过。

### Task 6: 实现常驻 CompanionNote 与页面装回

**Files:**
- Create: `src/components/CompanionNote.tsx`
- Create: `src/components/CompanionNote.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/features/intro/ChiyanGuide.tsx`
- Modify: `src/features/system/SystemViews.tsx`

**Interfaces:**
- Consumes: `CompanionViewModel`。
- Produces: 文档流内的统一 NPC 陪伴条和全页面装回。

- [ ] **Step 1: 写静态语义失败测试**

使用 `react-dom/server`，不新增测试依赖：

```tsx
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CompanionNote } from './CompanionNote'

it('renders a companion note without chat-app semantics', () => {
  const html = renderToStaticMarkup(<CompanionNote companion={{
    name: '迟言', role: '温和编辑搭档', pose: 'attend', featured: true,
    invitation: '先找一个大致位置。', autonomy: '选最接近的一项就够了。',
    imageSrc: '/assets/guide/chiyan-attend.webp', fallbackSrc: '/assets/guide/chiyan-placeholder.webp',
  }} />)
  expect(html).toContain('迟言')
  expect(html).not.toContain('虚构角色')
  expect(html).toContain('先找一个大致位置。')
  expect(html).not.toContain('textbox')
  expect(html).not.toContain('正在输入')
})
```

- [ ] **Step 2: 运行测试并确认红灯**

```bash
pnpm test src/components/CompanionNote.test.tsx
```

预期：组件文件不存在而失败。

- [ ] **Step 3: 实现 CompanionNote**

组件结构固定为：

```tsx
<aside className={`companion-note pose-${companion.pose}`} aria-label={`${companion.name}的当前提示`}>
  <div className="companion-art" aria-hidden="true">
    <img src={companion.imageSrc} alt="" width="180" height="240" onError={fallbackTo(companion.fallbackSrc)} />
  </div>
  <div className="companion-copy">
    <span className="companion-identity"><b>{companion.name}</b><small>{companion.role}</small></span>
    <p>{companion.invitation}</p>
    {companion.reassurance ? <p className="companion-reassurance">{companion.reassurance}</p> : null}
    <small className="companion-autonomy">{companion.autonomy}</small>
  </div>
</aside>
```

`fallbackTo()` 返回一次性 `onError` handler：清除自身 `onerror` 后替换为 placeholder；图片是装饰性，文字承担语义。

- [ ] **Step 4: 装回所有非 guide 页面**

在 `App.tsx` 建立：

```tsx
const companion = state.page === 'guide' ? null : <CompanionNote companion={screen.companion} />
```

每个 `.paper-page` 在 `PageIntro` 后、首个业务选择／结果组件前插入 `{companion}`。首页放在 `cover-revision` 后；安全页放在 `PageIntro` 后且使用 `pose-safety`。不得把 companion 放到 fixed、modal backdrop 或导出卡内部。

- [ ] **Step 5: 让 guide 和帮助层使用内容身份**

`ChiyanGuide` 增加 `companion` prop，用 `companion.name`／`role` 替换 JSX 硬编码身份，图片仍用欢迎主图。`GuideRecall` 增加 `name`／`role`／`boundaries` props，显示当前步骤和四条内容边界，不新增自由输入。

- [ ] **Step 6: 重跑组件和 ViewModel 测试**

```bash
pnpm test src/components/CompanionNote.test.tsx src/app/viewV2.test.ts
```

预期：SSR 语义、19 页 companion 和安全路径全部通过。

### Task 7: 陪伴视觉系统、响应式与降级

**Files:**
- Modify: `src/App.css`
- Modify: `src/index.css`

**Interfaces:**
- Consumes: Task 6 的 `.companion-note`、`.companion-art`、`.companion-copy`、`.pose-*`。
- Produces: 立绘常驻布局、移动裁切、失败降级和 reduced-motion。

- [ ] **Step 1: 实现桌面陪伴条**

新增样式：

```css
.companion-note {
  display: grid;
  grid-template-columns: 124px minmax(0, 1fr);
  align-items: end;
  min-width: 0;
  margin: -8px 0 24px;
  background: color-mix(in srgb, var(--blue) 7%, var(--paper-bright));
  border: 1px solid var(--line);
  border-left: 4px solid var(--blue);
}
.companion-art { align-self: stretch; min-height: 150px; overflow: hidden; background: var(--soft); }
.companion-art img { width: 100%; height: 100%; object-fit: cover; object-position: center 18%; }
.companion-copy { min-width: 0; padding: 18px 18px 16px; }
.companion-identity { display: flex; align-items: baseline; gap: 8px; }
.companion-identity small, .companion-autonomy { color: var(--muted); }
.companion-copy p { margin: 10px 0 0; line-height: 1.75; }
.companion-reassurance { color: var(--blue-deep); }
.companion-autonomy { display: block; margin-top: 10px; line-height: 1.6; }
.pose-safety { border-left-color: var(--safety); background: color-mix(in srgb, var(--safety) 7%, var(--paper-bright)); }
```

- [ ] **Step 2: 实现 430px 以下布局**

```css
@media (max-width: 430px) {
  .companion-note { grid-template-columns: 76px minmax(0, 1fr); align-items: stretch; margin-bottom: 20px; }
  .companion-art { min-height: 126px; }
  .companion-art img { object-position: center 12%; }
  .companion-copy { padding: 13px 13px 12px; }
  .companion-identity { display: grid; gap: 1px; }
  .companion-copy p { margin-top: 7px; font-size: 14px; }
  .companion-autonomy { font-size: 12px; }
}
```

确保 `.companion-note > * { min-width:0 }` 和所有文案 `overflow-wrap:anywhere`。

- [ ] **Step 3: 控制动效与失败状态**

只在 `prefers-reduced-motion: no-preference` 下给图片 180ms opacity 淡入；不做横移、弹跳、呼吸或持续动画。图片失败切换占位图；若占位也失败，背景仍保留且文本不移动。

- [ ] **Step 4: 运行静态门禁**

```bash
pnpm lint
pnpm test
pnpm build
```

预期：无 lint／TypeScript／测试错误，构建无外部资源。

### Task 8: 浏览器完整验收与报告

**Files:**
- Modify: `VISUAL-QA.md`
- Modify: `PREP_REPORT.md`
- Modify: `TODO.md`
- Modify: `NPC-COMPANION-V3.md`

**Interfaces:**
- Consumes: Tasks 1–7 的最终静态应用。
- Produces: 可审计的角色资源、文案、安全与三宽证据。

- [ ] **Step 1: 生产构建与预览**

```bash
pnpm build
pnpm preview --host 127.0.0.1
```

记录实际预览端口，浏览器控制台必须 0 error／warning。

- [ ] **Step 2: 走完 390px 普通路径**

从首页依次完成隐私、引导、关系、目标、情境、事实、感受、推测、需要、请求、草稿、演练、对照、结果、保存和恢复。逐页确认：

```text
迟言身份和邀请可见；姿态符合页面语义；邀请与按钮行为一致；
人物不遮挡标题、选项、文本区和主动作；不出现聊天 App 语义；
scrollWidth=390；最小 button 高度>=48；0 断图。
```

- [ ] **Step 3: 验证 375px 与 430px**

在 375×812、430×932 复跑普通路径的关键节点：首页、情境、事实、推测、草稿、演练、结果。记录每个视口的 `document.documentElement.scrollWidth === innerWidth`、所有按钮完整、立绘裁切不截断脸和双手语义。

- [ ] **Step 4: 验证 32px 安全区**

```js
document.documentElement.style.setProperty('--safe-area-inset-top', '32px')
```

在长页面滚动后检查 `.top-rail` 顶部为 32px；调用 `[data-anchor].scrollIntoView()` 后目标顶部不小于顶栏底部。陪伴条不得进入状态栏区域。

- [ ] **Step 5: 验证安全页与角色退位**

选择“伴侣 → 说明边界 → 身体边界没有被立即尊重”。确认 `pose-safety` 使用 pause 立绘、文案明确现实支持优先、无“演练”“草稿”“当面对质”、主要操作为退出清除或返回情境。

- [ ] **Step 6: 验证图片失败降级**

依次阻断六张新增 WebP 请求并刷新对应页面；确认 placeholder 接管。再阻断 placeholder，确认角色姓名、虚构身份、邀请、自主权和所有操作仍可用，页面无横向溢出。

- [ ] **Step 7: 验证 reduced-motion 与键盘**

模拟 `prefers-reduced-motion: reduce`，确认立绘无 transform／animation；只用 Tab／Shift+Tab／Enter 完成一个五步路径，焦点不进入装饰图片。

- [ ] **Step 8: 执行最终门禁**

```bash
pnpm lint && pnpm test && pnpm build
```

预期：全部通过；记录测试文件数、测试数和构建产物大小。

- [ ] **Step 9: 更新报告与状态**

`VISUAL-QA.md` 记录 375／390／430、32px 安全区、普通／安全路径、失败降级与控制台；`PREP_REPORT.md` 记录 NPC 内容契约、资源总数、文案审计数量、存储不变；`TODO.md` 勾选本轮完成项；`NPC-COMPANION-V3.md` 状态改为 `IMPLEMENTED`。

- [ ] **Step 10: 检查修改范围**

```bash
git status --short -- .
git diff --name-only -- .
```

预期：所有修改和新增文件都位于 `projects/07-conversation-replay/**`，未修改依赖或锁文件。
