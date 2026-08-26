# Earth Online RPG 重构实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复所有移动端文字、边框和导航遮挡问题，把现有现实任务工具升级为清晰、夸张且安全的“异常支线冒险者公会”。

**Architecture:** 保持现有 React 状态机、纯函数 matcher 和本地存储结构不变；在内容契约中增加任务气质与公会简报字段，由 ViewModel 透传到任务纸。布局改为安全区 HUD、无覆盖内容导航和独立任务流程；视觉特效仅由本地 SVG、CSS 与现有弥拉资源实现，不新增依赖。

**Tech Stack:** React 19、TypeScript 6、CSS、Vitest、Playwright CLI、Vite。

**Spec:** `UI-REDESIGN-V2.md`、本文件中的已批准 RPG 增补规格。

## Global Constraints

- 只修改 `projects/08-earth-online`，不修改仓库根文件、其他项目、`docs/` 或锁文件。
- 纯前端静态构建；无后端、运行时 CDN、必需外部 API 或新增依赖。
- 业务文案只写入 `src/content/content.json`。
- 只用 localStorage / IndexedDB 保存结构化状态，不保存图片、Base64、音视频或 Blob。
- 所有固定或粘性顶部控件与锚点叠加 `var(--safe-area-inset-top, env(safe-area-inset-top, 0px))`。
- 必测 375 / 390 / 430 CSS px 与 32px 模拟顶部安全区。
- 陌生人互动只能是一次、可退出、无欺骗、无纠缠、无身体接触、无拍摄、无索取隐私；“难堪”只允许参与者自愿承受轻微尴尬。
- 当前工作树包含用户批准的未提交成果，不创建提交，不覆盖无关改动。

---

### Task 1: RPG 任务内容契约

**Files:**
- Modify: `src/content/schema.ts`
- Modify: `src/content/validate.ts`
- Modify: `src/content/content.test.ts`
- Modify: `src/content/validate.test.ts`

**Interfaces:**
- Produces: `QuestTone = 'absurd' | 'courage' | 'kindness' | 'growth'`
- Produces: `Quest.tone: QuestTone` 与 `Quest.guildBrief: string`
- Consumes: 现有 `EarthOnlineContent` 与 `validateEarthOnlineContent()`

- [x] **Step 1: 写失败测试**

  在 `content.test.ts` 断言 100 项任务全部具有合法 `tone`、非模板化 `guildBrief`，四种 tone 均至少 15 项；在 `validate.test.ts` 断言缺失或非法字段会产生精确路径错误。

- [x] **Step 2: 验证 RED**

  Run: `pnpm test src/content/content.test.ts src/content/validate.test.ts`

  Expected: 因 `tone` / `guildBrief` 尚不存在而失败。

- [x] **Step 3: 最小实现类型与验证器**

  在 `schema.ts` 导出 `QUEST_TONES` 与 `QuestTone`；向 `Quest` 增加两个字段。在 `validate.ts` 校验枚举与 8–64 字符的 `guildBrief`。

- [x] **Step 4: 验证 GREEN**

  Run: `pnpm test src/content/content.test.ts src/content/validate.test.ts`

  Expected: 在内容补齐后全部通过。

### Task 2: 重写 100 条异常支线

**Files:**
- Modify: `src/content/content.json`
- Modify: `src/content/content.test.ts`

**Interfaces:**
- Consumes: Task 1 的 `QuestTone` 与字段契约。
- Produces: 100 条可匹配、独立叙事、独立步骤和独立结算文案的本地任务。

- [x] **Step 1: 写失败测试**

  增加契约：通用模板“今天只完成这一件小事”与“做到标题所述”出现次数必须为 0；每项 `steps` 为 2–3 条；陌生人任务必须包含一次性互动和允许不回应/离开的边界语句；四种 tone 分布均衡。

- [x] **Step 2: 验证 RED**

  Run: `pnpm test src/content/content.test.ts`

  Expected: 现有 100 条模板化描述与步骤违反契约。

- [x] **Step 3: 重写内容**

  保持每个类别 10 项与现有匹配字段有效。按无厘头、微勇气、善意、成长四条内容线，重写 `title`、`description`、`steps`、`completionMethod`、`acceptText`、`completionText`、`abandonText`、`shareText`，并补齐 `tone`、`guildBrief`。任务可以包含安全场合下一次友好招呼、自然服务互动、向可信熟人表达真实想法、奇怪穿搭、私密空间史诗旁白等，但不得要求纠缠陌生人。

- [x] **Step 4: 验证 GREEN**

  Run: `pnpm test src/content/content.test.ts src/content/validate.test.ts src/domain/quests.test.ts src/domain/matcher.test.ts`

  Expected: 内容、匹配和安全契约全部通过。

### Task 3: 无遮挡信息架构

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/ui/GuildFrame.tsx`
- Modify: `src/ui/CheckIn.tsx`
- Modify: `src/ui/ArchiveViews.tsx`
- Modify: `src/ui/render.test.tsx`
- Modify: `src/styles/layout.css`
- Modify: `src/styles/components.css`

**Interfaces:**
- Produces: `GuildFrame` 顶部两层 HUD 导航；任务流程页不显示全局导航。
- Produces: 登记组标题成为卡片内部标题，不再压住 `fieldset` 边框。
- Consumes: 现有 page/view 状态，不修改持久化格式。

- [x] **Step 1: 写失败测试**

  在 `render.test.tsx` 断言登记标题位于 `.choice-field__title` 内；结算页与任务流程不渲染 `.guild-navigation`；大厅、日志、图鉴、档案渲染 HUD 导航；档案最后一个统计项使用完整行类名。

- [x] **Step 2: 验证 RED**

  Run: `pnpm test src/ui/render.test.tsx`

  Expected: 旧 DOM 结构与导航条件导致失败。

- [x] **Step 3: 修改结构与 CSS**

  导航并入安全区 header 的第二行，移动端不再使用 `position: fixed`。任务流程、确认、结算隐藏全局导航。用 `fieldset` + 可见内部标题保留语义；为所有纸张建立 `isolation` 与显式内容层，伪元素边框保持 `z-index: 0` 且 `pointer-events: none`。修复深色背景上的 ghost 按钮变量，并让奇数统计项跨满一行。

- [x] **Step 4: 验证 GREEN**

  Run: `pnpm test src/ui/render.test.tsx`

  Expected: DOM 契约全部通过。

### Task 4: RPG 任务纸与 HUD 表现

**Files:**
- Modify: `src/app/view-model.ts`
- Modify: `src/app/view-model.test.ts`
- Modify: `src/ui/QuestFlow.tsx`
- Modify: `src/ui/ArchiveViews.tsx`
- Create: `src/ui/RpgEffects.tsx`
- Modify: `src/ui/render.test.tsx`
- Modify: `src/styles/components.css`
- Modify: `src/styles/tokens.css`

**Interfaces:**
- Produces: `QuestCardView.tone` 与 `QuestCardView.guildBrief`。
- Produces: `RuneField`, `QuestSigil`, `XpBurst` 纯展示组件，均 `aria-hidden="true"`。
- Consumes: Task 1–2 的内容字段和现有本地图标。

- [x] **Step 1: 写失败测试**

  在 `view-model.test.ts` 断言新字段从内容透传；在 `render.test.tsx` 断言任务纸展示气质标签和公会简报，装饰层不进入无障碍树。

- [x] **Step 2: 验证 RED**

  Run: `pnpm test src/app/view-model.test.ts src/ui/render.test.tsx`

  Expected: ViewModel 与组件尚无新字段。

- [x] **Step 3: 最小实现**

  增加透传字段与展示组件。任务纸使用较小移动端标题、分区 HUD、符文角标和清晰的主次操作；图鉴与档案升级为公会登记册，不让纹理或边框进入文字安全区。

- [x] **Step 4: 验证 GREEN**

  Run: `pnpm test src/app/view-model.test.ts src/ui/render.test.tsx`

  Expected: 新视觉数据契约与语义测试通过。

### Task 5: 夸张但可降级的交互动效

**Files:**
- Modify: `src/styles/motion.css`
- Modify: `src/styles/components.css`
- Modify: `src/ui/QuestFlow.tsx`
- Modify: `src/ui/FeedbackSheets.tsx`
- Modify: `src/ui/ArchiveViews.tsx`

**Interfaces:**
- Produces: 匹配符文阵、卷轴展开、接取压印、完成冲击波、XP 上升和徽章辉光。
- Consumes: `prefers-reduced-motion`，不写入任何新状态。

- [x] **Step 1: 写失败契约测试**

  在 `render.test.tsx` 断言匹配、揭晓和结算状态存在稳定动画挂载类；装饰节点全部 `aria-hidden`。

- [x] **Step 2: 验证 RED**

  Run: `pnpm test src/ui/render.test.tsx`

  Expected: 新挂载类尚不存在。

- [x] **Step 3: 实现动效**

  仅动画 `transform`、`opacity`、`filter` 与伪元素。匹配阵展示真实条件而非概率；完成冲击波不阻挡按钮。`prefers-reduced-motion: reduce` 将所有循环、旋转和入场动画缩短至不超过 100ms 且只执行一次。

- [x] **Step 4: 验证 GREEN**

  Run: `pnpm test src/ui/render.test.tsx`

  Expected: 结构契约通过。

### Task 6: 全页面视觉回归与交付

**Files:**
- Modify: `VISUAL-QA.md`
- Modify: `PREP_REPORT.md`
- Add artifacts only: `output/playwright/rpg-recheck/*.png`

**Interfaces:**
- Consumes: 全部前序任务。
- Produces: 可复核截图、元素边界数据和最终构建证据。

- [x] **Step 1: 自动验证**

  Run: `pnpm lint && pnpm test && pnpm build`

  Expected: 0 lint error、全部测试通过、Vite 构建成功。

- [x] **Step 2: 真实浏览器逐页验证**

  用 Playwright 检查首次引导、登记、匹配、任务揭晓、进行中、完成确认、完成结算、放回、不适合、日志、图鉴、档案、帮助和恢复页；分别使用 375×812、390×844、430×932，注入 `--safe-area-inset-top: 32px`。

- [x] **Step 3: 测量布局契约**

  记录 `scrollWidth === clientWidth`；所有可见文本无裁剪；全局导航与 `main button/a` 相交面积为 0；sticky header 顶部等于模拟安全区；长标题、长环境值、徽章名与档案统计无边框穿字。

- [x] **Step 4: reduced-motion 验证**

  模拟 `prefers-reduced-motion: reduce`，确认循环动画停止、匹配可快速完成、界面状态与普通模式一致。

- [x] **Step 5: 更新 QA 文档**

  用本轮真实测量替换旧结论，列出截图路径、视口、覆盖面积和构建结果；不得保留已失效的“固定底栏已通过”描述。
