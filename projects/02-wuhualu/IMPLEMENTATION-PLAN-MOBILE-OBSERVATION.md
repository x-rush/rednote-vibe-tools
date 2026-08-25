# 手机观察签 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 V2 黄金样例的“鼠标移动光斑”改成手机优先的可点观察签，并让许照在第一次观察时提供原位引导。

**Architecture:** 继续以 `observationSpots` 作为唯一观察点数据源，在器物图上将每个观察点渲染为真实按钮；已发现状态仍由现有 `discoverSpot` action 和稳定 ID 管理。组件只消费 `content.json` 提供的引导文案，不新增持久化字段、依赖或设备 API。

**Tech Stack:** React 19、TypeScript、CSS、Vitest SSR、Playwright CLI。

**Spec:** `UI-REDESIGN-V2.md`、`INTERACTION-MOTION-SPEC.md`

## Global Constraints

- 只修改 `projects/02-wuhualu`，不得修改根工作区、其他项目或根锁文件。
- 业务内容只写入 `src/content/content.json`，JSX 不硬编码业务文案。
- 纯前端静态构建，不新增后端、运行时 CDN、外部 API 或未经确认的设备 API。
- 点击目标至少 48×48 CSS px，页面保持纵向滚动；375／390／430 CSS px 均无横向溢出。
- 提交前执行 `pnpm lint && pnpm test && pnpm build`，不得删除测试。

---

### Task 1: 观察引导内容契约

**Files:**
- Modify: `src/content/content.test.ts`
- Modify: `src/content/types.ts`
- Modify: `src/content/content.json`
- Modify: `src/content/validate.ts`

**Interfaces:**
- Produces: `observationGuideLabel`、`observationGuideFirst`、`observationGuideContinue`、`observationGuideComplete`、`observationMarkerLabel`、`observationProgressLabel` 六个 `ContentCopy` 字段。

- [x] **Step 1: 写失败测试**

  在 semantic copy 列表加入六个观察引导字段，并断言首页、引导页和观察说明不再出现“移动光斑”。

- [x] **Step 2: 验证 RED**

  Run: `pnpm test -- src/content/content.test.ts`

  Expected: FAIL，缺少新字段或旧文案仍包含“移动光斑”。

- [x] **Step 3: 最小实现**

  扩展 `ContentCopy` 和运行时必填校验，在 `content.json` 增加许照引导、观察进度和按钮标签，并把现有光斑文案改为“轻触观察签”。

- [x] **Step 4: 验证 GREEN**

  Run: `pnpm test -- src/content/content.test.ts`

  Expected: PASS。

### Task 2: 触控观察台

**Files:**
- Create: `src/ui/SpotlightStage.test.tsx`
- Create: `src/ui/ArtifactMedia.test.tsx`
- Modify: `src/ui/SpotlightStage.tsx`
- Modify: `src/ui/ArtifactMedia.tsx`
- Modify: `src/ui/artifact-assets.ts`
- Modify: `src/ui/artifact-assets.test.ts`
- Modify: `src/App.tsx`
- Modify: `src/App.css`

**Interfaces:**
- Consumes: Task 1 的六个 `ContentCopy` 字段。
- Produces: `SpotlightStage` 的 `copy` 属性；每个 `ObservationSpot` 对应一个绝对定位的 48×48 按钮。

- [x] **Step 1: 写失败测试**

  使用 `renderToStaticMarkup` 验证三种状态：未观察时第 01 签带推荐状态和首次提示；观察一处后显示札记与继续提示；全部观察后显示完成提示和 `3 / 3` 进度。断言每个热点均为图上真实按钮。

- [x] **Step 2: 验证 RED**

  Run: `pnpm test -- src/ui/SpotlightStage.test.tsx`

  Expected: FAIL，旧组件没有 `copy` 属性、观察签和渐进式提示。

- [x] **Step 3: 最小实现**

  删除 pointer move、pointer capture、光斑 veil 和重复的键盘按钮列表；使用统一坐标校准的 observation 底图并在图上渲染编号观察签，点击复用 `onDiscover`。在图下用许照头像与 `aria-live` 展示当前引导，已发现札记保持可读。

- [x] **Step 4: 验证 GREEN**

  Run: `pnpm test -- src/ui/SpotlightStage.test.tsx src/content/content.test.ts`

  Expected: PASS。

- [x] **Step 5: 移动端样式与 reduced-motion**

  让观察台使用 `touch-action: pan-y`，观察签最小 48×48，首次推荐签只做轻量脉冲；`prefers-reduced-motion: reduce` 下取消脉冲并保留静态描边。

### Task 3: 设计文档与验收

**Files:**
- Modify: `UI-REDESIGN-V2.md`
- Modify: `INTERACTION-MOTION-SPEC.md`
- Modify: `CONTENT-V2-CONTRACT.md`
- Modify: `VISUAL-QA.md`

**Interfaces:**
- Consumes: Task 2 的触控观察行为和 CSS 选择器。
- Produces: 与实现一致的手机交互、键盘、屏幕阅读器和 reduced-motion 规范。

- [x] **Step 1: 同步规范**

  把“聚光拖动／隐藏热点”改为“轻触观察签／可见编号”，写明首次只强调 01、命中后开放任意顺序、非通关门槛、纵向滚动和 48px 目标。

- [x] **Step 2: 浏览器验收**

  用 Playwright CLI 在 375／390／430 CSS px 验证：无横向溢出、观察签均至少 48px、点击 01 后札记与 `1 / 3` 进度出现、页面无需 hover/拖动、控制台无错误。

- [x] **Step 3: 完整验证**

  Run: `pnpm lint && pnpm test && pnpm build`

  Expected: 三项全部退出码 0。

- [x] **Step 4: 提交**

  仅暂存 `projects/02-wuhualu` 的本次文件，提交信息：`feat(wuhualu): make artifact inspection touch-first`。
