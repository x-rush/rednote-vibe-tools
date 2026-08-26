# Conversation Replay V4 Hero and Privacy Stage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将首页改造成迟言主导的编辑手账 Hero，并将开始前确认页改造成连续的陪伴工作台与保存模式选择页。

**Architecture:** 新建 `LandingHero` 与 `PrivacyStage` 两个无状态展示组件，继续消费既有 `ScreenViewModelV2` 与 `CompanionViewModel`。`App.tsx` 保留 reducer 派发与页面编排；首页和 privacy 页绕过通用 `CompanionNote`，关系／目标／情境仍用 featured companion，五层复盘及其后仍用紧凑 companion。

**Tech Stack:** React 19、TypeScript 6、Vite 8、Vitest 4、react-dom/server、项目内 WebP、CSS、Playwright CLI。

**Spec:** `HERO-PRIVACY-REDESIGN-V4.md`

## Global Constraints

- 只修改 `projects/07-conversation-replay/**`；不修改其他项目、根配置、锁文件、`docs/` 或 `prep/`。
- 不新增依赖，不执行 Git 写操作；每个任务以目标测试和文件清单作为检查点。
- 不生成新美术资源；复用 `chiyan-guide-master.webp` 与 `chiyan-placeholder.webp`。
- 不改变 reducer 页面顺序、保存 schema、情境匹配、安全分流或隐私承诺。
- 不新增自由聊天、消息气泡、在线状态、好感度、角色记忆、后端、运行时 API 或 CDN。
- 界面身份只显示“迟言 / 温和编辑搭档”，不追加角色性质标签。
- 首页人物正脸、头顶、双手和笔记本必须完整，视觉重心位于中右侧。
- sticky 顶栏与锚点继续叠加 `var(--safe-area-inset-top, env(safe-area-inset-top, 0px))`。
- 最终执行 `pnpm lint && pnpm test && pnpm build`，并验证 375／390／430 CSS px 与 32px 非零安全区。

---

## File Structure

- Create `src/features/intro/LandingHero.tsx`: 首页纯展示 Hero 舞台与主图 fallback。
- Create `src/features/intro/LandingHero.test.tsx`: 首页 Hero SSR 语义测试。
- Create `src/features/intro/PrivacyStage.tsx`: 开始前确认场景、三张纸签与两种保存模式按钮。
- Create `src/features/intro/PrivacyStage.test.tsx`: privacy 场景 SSR 结构测试。
- Modify `src/App.tsx`: 将两个新组件装回 landing/privacy，保留 reducer action。
- Modify `src/app/viewV2.ts`: featured companion 只映射 relationship/goal/scenario。
- Modify `src/app/viewV2.test.ts`: 锁定新的 featured 页面边界。
- Modify `src/App.css`: 首页 Hero、privacy 工作台与三宽响应式布局。
- Modify `HERO-PRIVACY-REDESIGN-V4.md`: 实施后状态。
- Modify `VISUAL-QA.md`: 三宽、首屏、失败降级与安全区证据。
- Modify `PREP_REPORT.md`: V4 组件与最终门禁数字。

---

### Task 1: LandingHero 语义组件

**Files:**
- Create: `src/features/intro/LandingHero.tsx`
- Create: `src/features/intro/LandingHero.test.tsx`

**Interfaces:**
- Consumes: `CompanionViewModel`、既有首页修订前后文本。
- Produces: `LandingHero({ companion, beforeText, afterText })`，供 `App.tsx` landing 分支使用。

- [ ] **Step 1: 写首页 Hero 失败测试**

创建 `src/features/intro/LandingHero.test.tsx`：

```tsx
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { LandingHero } from './LandingHero'

describe('LandingHero', () => {
  it('renders an illustrated editorial hero instead of a companion note', () => {
    const html = renderToStaticMarkup(<LandingHero
      companion={{
        name: '迟言',
        role: '温和编辑搭档',
        pose: 'welcome',
        featured: false,
        invitation: '如果愿意，我陪你从一个最接近的情境开始。',
        reassurance: '不用贴聊天记录，也不用一次讲完整。',
        autonomy: '你可以随时停下，决定权一直在你。',
        imageSrc: '/assets/guide/chiyan-guide-master.webp',
        fallbackSrc: '/assets/guide/chiyan-placeholder.webp',
      }}
      beforeText="你根本不在乎我。"
      afterText="约定时间过去后，我没有收到回复。"
    />)

    expect(html).toContain('landing-hero')
    expect(html).toContain('landing-hero-art')
    expect(html).toContain('你根本不在乎我。')
    expect(html).toContain('约定时间过去后，我没有收到回复。')
    expect(html).toContain('如果愿意，我陪你从一个最接近的情境开始。')
    expect(html).toContain('你可以随时停下，决定权一直在你。')
    expect(html).not.toContain('companion-note')
    expect(html).not.toContain('textbox')
  })
})
```

- [ ] **Step 2: 运行测试并确认红灯**

Run:

```bash
pnpm test -- --run src/features/intro/LandingHero.test.tsx
```

Expected: FAIL because `./LandingHero` does not exist.

- [ ] **Step 3: 实现最小 LandingHero**

创建 `src/features/intro/LandingHero.tsx`：

```tsx
import type { SyntheticEvent } from 'react'
import type { CompanionViewModel } from '../../app/viewV2'

function fallbackTo(fallbackSrc: string) {
  return (event: SyntheticEvent<HTMLImageElement>) => {
    event.currentTarget.onerror = null
    event.currentTarget.src = fallbackSrc
  }
}

export function LandingHero({
  companion,
  beforeText,
  afterText,
}: {
  companion: CompanionViewModel
  beforeText: string
  afterText: string
}) {
  return (
    <section className="landing-hero" aria-label={`${companion.name}的编辑工作台`}>
      <div className="landing-revision" aria-label="表达修订示例">
        <p className="landing-revision-before"><span>原表达</span><s>{beforeText}</s></p>
        <p className="landing-revision-after"><span>更可核对</span><b>{afterText}</b></p>
      </div>
      <div className="landing-hero-art" aria-hidden="true">
        <img src={companion.imageSrc} alt="" width="900" height="1200" onError={fallbackTo(companion.fallbackSrc)} />
      </div>
      <aside className="landing-hero-note">
        <span><b>{companion.name}</b><small>{companion.role}</small></span>
        <p>{companion.invitation}</p>
        {companion.reassurance ? <small>{companion.reassurance}</small> : null}
        <em>{companion.autonomy}</em>
      </aside>
    </section>
  )
}
```

- [ ] **Step 4: 重跑目标测试**

```bash
pnpm test -- --run src/features/intro/LandingHero.test.tsx
```

Expected: PASS; no unrelated failures.

- [ ] **Step 5: 检查点**

```bash
git diff -- src/features/intro/LandingHero.tsx src/features/intro/LandingHero.test.tsx
```

确认组件无状态、不派发 action、不包含按钮或新增业务文案。

---

### Task 2: PrivacyStage 场景与模式卡

**Files:**
- Create: `src/features/intro/PrivacyStage.tsx`
- Create: `src/features/intro/PrivacyStage.test.tsx`

**Interfaces:**
- Consumes: `CompanionViewModel`、`ScreenSectionV2[]`、两个按钮标签、两段来自 `content.json` 的模式说明与两个回调。
- Produces: `PrivacyStage({ companion, sections, primaryLabel, secondaryLabel, ephemeralDescription, localDescription, onEphemeral, onLocal })`。

- [ ] **Step 1: 写 privacy 场景失败测试**

创建 `src/features/intro/PrivacyStage.test.tsx`：

```tsx
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { PrivacyStage } from './PrivacyStage'

describe('PrivacyStage', () => {
  it('renders three privacy guarantees and two mode actions', () => {
    const html = renderToStaticMarkup(<PrivacyStage
      companion={{
        name: '迟言',
        role: '温和编辑搭档',
        pose: 'welcome',
        featured: false,
        invitation: '开始前，我们先把保存方式说清楚。',
        reassurance: '无痕只留在当前会话；本机保存最多三份结构化复盘。',
        autonomy: '选哪一种都不影响后面的整理。',
        imageSrc: '/assets/guide/chiyan-guide-master.webp',
        fallbackSrc: '/assets/guide/chiyan-placeholder.webp',
      }}
      sections={[
        { id: 'no-upload', title: '不上传', body: '只选择大致情境和自己的体验。' },
        { id: 'no-judgment', title: '不判断对错', body: '不猜测人格、动机或关系责任。' },
        { id: 'local-only', title: '本机最多三份', body: '仅保存结构化选择和有限编辑。' },
      ]}
      primaryLabel="使用无痕模式"
      secondaryLabel="使用本机保存"
      ephemeralDescription="关闭或退出后，无痕内容会消失。"
      localDescription="仅保存结构化选择和有限编辑。"
      onEphemeral={() => undefined}
      onLocal={() => undefined}
    />)

    expect(html).toContain('privacy-stage')
    expect(html).toContain('不上传')
    expect(html).toContain('不判断对错')
    expect(html).toContain('本机最多三份')
    expect(html.match(/<button/g)).toHaveLength(2)
    expect(html).toContain('使用无痕模式')
    expect(html).toContain('使用本机保存')
    expect(html).toContain('关闭或退出后，无痕内容会消失。')
    expect(html).toContain('仅保存结构化选择和有限编辑。')
    expect(html).not.toContain('companion-note')
  })
})
```

- [ ] **Step 2: 运行测试并确认红灯**

```bash
pnpm test -- --run src/features/intro/PrivacyStage.test.tsx
```

Expected: FAIL because `./PrivacyStage` does not exist.

- [ ] **Step 3: 实现 PrivacyStage**

创建 `src/features/intro/PrivacyStage.tsx`，使用如下公开接口和结构：

```tsx
import type { SyntheticEvent } from 'react'
import type { CompanionViewModel, ScreenSectionV2 } from '../../app/viewV2'

function fallbackTo(fallbackSrc: string) {
  return (event: SyntheticEvent<HTMLImageElement>) => {
    event.currentTarget.onerror = null
    event.currentTarget.src = fallbackSrc
  }
}

export function PrivacyStage({
  companion,
  sections,
  primaryLabel,
  secondaryLabel,
  ephemeralDescription,
  localDescription,
  onEphemeral,
  onLocal,
}: {
  companion: CompanionViewModel
  sections: ScreenSectionV2[]
  primaryLabel: string
  secondaryLabel: string
  ephemeralDescription: string
  localDescription: string
  onEphemeral(): void
  onLocal(): void
}) {
  return (
    <>
      <section className="privacy-stage" aria-label={`${companion.name}说明保存方式`}>
        <div className="privacy-stage-copy">
          <span><b>{companion.name}</b><small>{companion.role}</small></span>
          <p>{companion.invitation}</p>
          {companion.reassurance ? <small>{companion.reassurance}</small> : null}
          <em>{companion.autonomy}</em>
        </div>
        <div className="privacy-stage-art" aria-hidden="true">
          <img src={companion.imageSrc} alt="" width="900" height="1200" onError={fallbackTo(companion.fallbackSrc)} />
        </div>
        <div className="privacy-tags">
          {sections.map((section, index) => <article key={section.id}><b>{index + 1}</b><span><strong>{section.title}</strong><small>{section.body}</small></span></article>)}
        </div>
      </section>
      <div className="privacy-mode-cards">
        <button className="privacy-mode primary-mode" type="button" onClick={onEphemeral}>
          <strong>{primaryLabel}</strong><small>{ephemeralDescription}</small>
        </button>
        <button className="privacy-mode local-mode" type="button" onClick={onLocal}>
          <strong>{secondaryLabel}</strong><small>{localDescription}</small>
        </button>
      </div>
    </>
  )
}
```

两段说明只可通过 props 读取 `content.json` 的既有页面文案；不得在组件内硬编码业务文案，也不得加入推荐徽标或默认选中状态。

- [ ] **Step 4: 重跑目标测试**

```bash
pnpm test -- --run src/features/intro/PrivacyStage.test.tsx
```

Expected: PASS; two buttons and three guarantees present.

- [ ] **Step 5: 检查点**

```bash
git diff -- src/features/intro/PrivacyStage.tsx src/features/intro/PrivacyStage.test.tsx
```

确认组件仅通过 props 回调，不读取 reducer、window 或 localStorage。

---

### Task 3: 页面装回与 featured 边界

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/app/viewV2.ts`
- Modify: `src/app/viewV2.test.ts`

**Interfaces:**
- Consumes: Task 1 `LandingHero`、Task 2 `PrivacyStage`。
- Produces: landing/privacy 专用场景；relationship/goal/scenario featured companion；其余页面 compact companion。

- [ ] **Step 1: 先修改 featured 映射测试并确认红灯**

将 `src/app/viewV2.test.ts` 的 `featuredPages` 改为：

```ts
const featuredPages: ReplayPageV2[] = ['relationship', 'goal', 'scenario']
```

Run:

```bash
pnpm test -- --run src/app/viewV2.test.ts
```

Expected: FAIL on landing/privacy because current ViewModel still returns `featured: true`.

- [ ] **Step 2: 修改 ViewModel featured 映射**

在 `src/app/viewV2.ts` 将 companion 构建中的映射改为：

```ts
featured: ['relationship', 'goal', 'scenario'].includes(state.page),
```

- [ ] **Step 3: 装回 LandingHero**

在 `src/App.tsx` 导入：

```ts
import { LandingHero } from './features/intro/LandingHero'
```

将 landing 分支中 `.cover-revision` 和 `<CompanionNote>` 替换为：

```tsx
<LandingHero
  companion={screen.companion}
  beforeText="你根本不在乎我。"
  afterText="约定时间过去后，我没有收到回复。"
/>
```

保留现有 `privacy-note`、主按钮、次按钮与 dispatch action。

- [ ] **Step 4: 装回 PrivacyStage**

在 `src/App.tsx` 导入：

```ts
import { PrivacyStage } from './features/intro/PrivacyStage'
```

将 privacy 分支改为：

```tsx
<section className="paper-page privacy-page">
  <PageIntro {...screen} showCompanion={false} />
  <PrivacyStage
    companion={screen.companion}
    sections={screen.sections}
    primaryLabel={screen.primaryLabel}
    secondaryLabel={screen.secondaryLabel ?? '使用本机保存'}
    ephemeralDescription={screen.lead}
    localDescription={screen.sections.find(({ id }) => id === 'local-only')?.body.toString() ?? ''}
    onEphemeral={() => dispatch({ type: 'CHOOSE_MODE', mode: 'ephemeral' })}
    onLocal={() => dispatch({ type: 'CHOOSE_MODE', mode: 'local' })}
  />
</section>
```

删除 privacy 分支旧 `.privacy-rules` 和旧 `.button-stack`，避免重复显示同一内容与操作。

- [ ] **Step 5: 重跑组件、ViewModel 和 reducer 回归**

```bash
pnpm test -- --run src/features/intro/LandingHero.test.tsx src/features/intro/PrivacyStage.test.tsx src/app/viewV2.test.ts src/state/replayStateV2.test.ts
```

Expected: PASS; mode actions仍由现有 reducer 测试保护。

- [ ] **Step 6: 检查点**

```bash
git diff -- src/App.tsx src/app/viewV2.ts src/app/viewV2.test.ts
```

确认 landing/privacy 均不重复渲染 `CompanionNote`，其他分支保持原业务交互。

---

### Task 4: Hero 与 PrivacyStage 视觉系统

**Files:**
- Modify: `src/App.css`

**Interfaces:**
- Consumes: `.landing-hero*`、`.privacy-stage*`、`.privacy-mode*` DOM。
- Produces: 375–430px 移动构图、431px 以上桌面构图、失败占位和 reduced-motion 行为。

- [ ] **Step 1: 增加首页 Hero 基础样式**

在 companion 样式后增加：

```css
.landing-hero {
  position: relative;
  min-width: 0;
  min-height: 410px;
  margin: 4px 0 24px;
  overflow: hidden;
  background: linear-gradient(145deg, color-mix(in srgb, var(--blue) 12%, var(--paper-bright)), var(--paper-bright) 62%);
  border: 1px solid var(--line);
  border-left: 4px solid var(--blue);
}
.landing-hero-art { position: absolute; right: -10px; bottom: 0; width: min(52%, 350px); height: 100%; }
.landing-hero-art img { display: block; width: 100%; height: 100%; object-fit: contain; object-position: right bottom; }
.landing-revision { position: relative; z-index: 2; width: 46%; padding: 28px 0 0 24px; }
.landing-revision p { margin: 0 0 12px; padding: 12px 14px; background: var(--paper-bright); border: 1px solid var(--line); box-shadow: 0 8px 24px rgb(48 55 53 / 8%); }
.landing-revision span { display: block; margin-bottom: 5px; color: var(--muted); font-size: 11px; letter-spacing: .08em; }
.landing-revision-before { color: var(--rose-muted); transform: rotate(-1deg); }
.landing-revision-after { color: var(--ink); transform: translateX(10px) rotate(.5deg); }
.landing-hero-note { position: absolute; z-index: 3; left: 24px; bottom: 22px; width: 46%; padding: 14px 16px; background: rgb(255 253 248 / 92%); border-left: 3px solid var(--ochre); }
.landing-hero-note span { display: flex; align-items: baseline; gap: 8px; }
.landing-hero-note small, .landing-hero-note em { display: block; color: var(--muted); font-size: 11px; font-style: normal; line-height: 1.55; }
.landing-hero-note p { margin: 7px 0; font-family: "Songti SC", serif; line-height: 1.65; }
```

- [ ] **Step 2: 增加 privacy 场景与模式卡样式**

```css
.privacy-stage { position: relative; min-width: 0; margin-bottom: 16px; overflow: hidden; background: color-mix(in srgb, var(--blue) 7%, var(--paper-bright)); border: 1px solid var(--line); }
.privacy-stage-copy { position: relative; z-index: 2; width: 52%; min-height: 250px; padding: 24px; }
.privacy-stage-copy span { display: flex; align-items: baseline; gap: 8px; }
.privacy-stage-copy p { margin: 14px 0 8px; font-family: "Songti SC", serif; font-size: 18px; line-height: 1.7; }
.privacy-stage-copy small, .privacy-stage-copy em { display: block; color: var(--muted); font-size: 12px; font-style: normal; line-height: 1.6; }
.privacy-stage-art { position: absolute; top: 0; right: 0; width: 45%; height: 250px; }
.privacy-stage-art img { width: 100%; height: 100%; object-fit: contain; object-position: right bottom; }
.privacy-tags { position: relative; z-index: 3; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; padding: 10px; background: rgb(245 242 235 / 92%); border-top: 1px solid var(--line); }
.privacy-tags article { min-width: 0; padding: 10px; background: var(--paper-bright); border: 1px solid var(--line); }
.privacy-tags article > b, .privacy-tags strong, .privacy-tags small { display: block; }
.privacy-tags article > b { color: var(--blue); }
.privacy-tags small { margin-top: 4px; color: var(--muted); font-size: 11px; line-height: 1.5; }
.privacy-mode-cards { display: grid; gap: 10px; }
.privacy-mode { display: grid; min-height: 64px; padding: 13px 16px; text-align: left; border: 1px solid var(--line); background: var(--paper-bright); }
.privacy-mode strong, .privacy-mode small { display: block; }
.privacy-mode small { margin-top: 4px; color: var(--muted); }
.privacy-mode.primary-mode { color: white; background: var(--blue-deep); border-color: var(--blue-deep); }
.privacy-mode.primary-mode small { color: rgb(255 255 255 / 78%); }
.privacy-mode.local-mode { border-color: var(--blue); }
```

- [ ] **Step 3: 增加 430px 移动布局**

在现有 `@media (max-width: 430px)` 末尾加入：

```css
.cover-page .page-intro { margin-top: 18px; margin-bottom: 18px; }
.landing-hero { min-height: 315px; margin-bottom: 18px; }
.landing-hero-art { right: -16px; width: 250px; height: 100%; }
.landing-revision { width: 52%; padding: 16px 0 0 12px; }
.landing-revision p { padding: 9px 10px; font-size: 13px; line-height: 1.45; }
.landing-hero-note { left: 12px; bottom: 12px; width: 59%; padding: 10px 11px; }
.landing-hero-note p { margin: 5px 0; font-size: 13px; line-height: 1.5; }
.landing-hero-note small, .landing-hero-note em { font-size: 10px; }
.privacy-stage-copy { width: 58%; min-height: 230px; padding: 16px 12px; }
.privacy-stage-copy p { margin-top: 9px; font-size: 15px; line-height: 1.55; }
.privacy-stage-art { width: 48%; height: 230px; }
.privacy-tags { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.privacy-tags article:last-child { grid-column: 1 / -1; }
```

- [ ] **Step 4: 限制动效与失败布局**

只在 `@media (prefers-reduced-motion: no-preference)` 中给 `.landing-hero-art img` 和 `.privacy-stage-art img` 添加 180ms opacity 淡入，不添加 transform 动画。现有 reduce 规则继续强制 `animation:none`、`transition:none`。

确保 `.landing-hero-art` 与 `.privacy-stage-art` 自身具有固定尺寸和背景色；即使两层图片均失败，文案与按钮位置不改变。

- [ ] **Step 5: 运行静态门禁**

```bash
pnpm lint
pnpm test
pnpm build
```

Expected: lint 0 errors, all tests pass, production build succeeds with no external asset URLs.

---

### Task 5: 真实浏览器验收与报告

**Files:**
- Modify: `HERO-PRIVACY-REDESIGN-V4.md`
- Modify: `VISUAL-QA.md`
- Modify: `PREP_REPORT.md`
- Create screenshots under: `output/playwright/`

**Interfaces:**
- Consumes: Tasks 1–4 final application.
- Produces: 可审计的首页 Hero、privacy 场景、三宽与失败降级证据。

- [ ] **Step 1: 启动生产预览**

```bash
pnpm build
pnpm preview --host 127.0.0.1 --port 4175
```

使用 Playwright CLI 新会话打开 `http://127.0.0.1:4175/`。

- [ ] **Step 2: 验证 390px 首页与第二页**

在 390×844：

```js
({
  viewport: innerWidth,
  documentWidth: document.documentElement.scrollWidth,
  hero: document.querySelectorAll('.landing-hero').length,
  genericCompanion: document.querySelectorAll('.companion-note').length,
  broken: [...document.images].filter((image) => !image.complete || !image.naturalWidth).length,
  minButton: Math.min(...[...document.querySelectorAll('button')].map((button) => button.getBoundingClientRect().height)),
})
```

Expected on landing: `documentWidth=390`, `hero=1`, `genericCompanion=0`, `broken=0`, `minButton>=48`。截图保存为 `output/playwright/v4-landing-390.png`。

点击主按钮进入 privacy；Expected: `.privacy-stage=1`、`.privacy-mode=2`、`.companion-note=0`、0 断图。截图保存为 `output/playwright/v4-privacy-390.png`。

- [ ] **Step 3: 验证人物构图**

使用截图和 DOM rect 同时确认：

```js
const art = document.querySelector('.landing-hero-art').getBoundingClientRect()
const image = document.querySelector('.landing-hero-art img').getBoundingClientRect()
({ artLeft: art.left, artRight: art.right, imageWidth: image.width, viewport: innerWidth })
```

人物容器右缘接近舞台右缘，图像使用 `object-fit: contain`；人工查看正脸、头顶、双手、笔记本完整，修订纸条不覆盖脸或持笔手。

- [ ] **Step 4: 验证 375／430 与安全区**

在 375×812 与 430×932 重复 landing/privacy：

```js
document.documentElement.style.setProperty('--safe-area-inset-top', '32px')
window.scrollTo(0, 0)
const rail = document.querySelector('.top-rail').getBoundingClientRect()
const anchor = document.querySelector('[data-anchor]').getBoundingClientRect()
({ railTop: rail.top, railBottom: rail.bottom, anchorTop: anchor.top })
```

Expected: `railTop=32`、`anchorTop>=railBottom`、document width equals viewport、0 broken images、所有按钮最小高度 48px。

- [ ] **Step 5: 验证模式按钮与后续衔接**

- 点击“使用无痕模式”进入三步引导，再跳过到 relationship。
- 确认 relationship 显示 `.companion-note.is-featured`，landing/privacy 不显示 `.companion-note`。
- 返回 privacy 后点击“使用本机保存”，确认同样进入引导且顶栏模式更新为本机。
- 确认两个按钮均为真实可操作路径，不存在预选或自动保存。

- [ ] **Step 6: 验证失败降级与减少动态**

对 `.landing-hero-art img` 和 `.privacy-stage-art img` 分别派发原生 `error`，Expected `src` 切换为 `/assets/guide/chiyan-placeholder.webp` 且按钮位置不变。

使用：

```js
await page.emulateMedia({ reducedMotion: 'reduce' })
```

Expected: 两个舞台图片 `animation-name: none`、`transform: none`。

- [ ] **Step 7: 更新报告状态**

- `HERO-PRIVACY-REDESIGN-V4.md` 状态改为 `IMPLEMENTED`。
- `VISUAL-QA.md` 记录三宽、Hero/Privacy DOM 数量、人物视觉检查、32px 安全区、fallback 和控制台。
- `PREP_REPORT.md` 记录两个新组件、测试文件数、测试数和最终构建产物大小。

- [ ] **Step 8: 最终门禁**

```bash
pnpm lint && pnpm test && pnpm build
```

读取完整输出并记录 0 failures 与最终构建大小。

- [ ] **Step 9: 检查修改范围**

```bash
git status --short -- .
git diff --name-only -- .
```

确认本轮所有修改均位于 `projects/07-conversation-replay/**`，没有依赖、锁文件或其他项目变化。
