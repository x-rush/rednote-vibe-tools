# 汴京饮子铺全局体验重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task. Subagent execution is disabled for this workspace. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不改变百日经营、剧情和存档语义的前提下，系统修复全页面对比度、实机顶部遮挡、空旷续玩页和页面切换不连续问题。

**Architecture:** 以 `ScreenFrame` 建立统一页面契约，以 `ActionGroup` 显式区分深色／纸面操作，以纯函数 `resolveResumeRoute` 统一存档续接。CSS 自定义属性为实机导航、刘海安全区和粘性预算提供同一基线，页面层轻动效和焦点复位由统一外壳承担。

**Tech Stack:** React 19、TypeScript 6、Vite 8、Vitest 4、Oxlint、Playwright CLI、CSS Custom Properties、IndexedDB。

**Spec:** `UX-POLISH-DESIGN.md`

## Global Constraints

- 只修改 `projects/04-bianjing-drink-shop`；不修改根配置、锁文件或其他项目。
- 不新增依赖、后端、远程 API、CDN、Service Worker 或设备 API。
- 不改变经济、剧情、结局和 V2 存档数据语义。
- 默认宿主导航高度为 `56px`，允许宿主通过 `--host-nav-height` 覆写；必须叠加 `safe-area-inset-top`。
- 普通文字与背景对比度目标不低于 `4.5:1`，主要非文字操作高度不低于 `46px`。
- 必须支持 `prefers-reduced-motion: reduce`；动画不能成为信息或操作的唯一载体。
- 按本会话“内联执行”要求，不 commit、不 push；每个任务以测试与 diff 检查作为检查点。

---

### Task 1: 建立直接续接路由

**Files:**
- Create: `src/state/resume-route.ts`
- Create: `src/state/resume-route.test.ts`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `GameState`, `ShopContent`, `EventTiming`, 当前 `pendingOpening` 结构。
- Produces: `resolveResumeRoute(state: GameState, content: ShopContent): ResumeRoute`，其中 `ResumeRoute = { displayPage: ResumeDisplayPage; eventTiming?: EventTiming }`。

- [x] **Step 1: 为续玩的五类存档节点写失败测试**

```ts
import { describe, expect, it } from 'vitest'
import { shopContent } from '../content'
import { seedRng } from '../domain/rng'
import { basicDecision, makeState } from '../tests/fixtures'
import { resolveResumeRoute } from './resume-route'

describe('resume route', () => {
  it.each([
    ['morning', makeState({ page: 'morning' }), { displayPage: 'morning' }],
    ['settlement', makeState({ page: 'settlement' }), { displayPage: 'settlement' }],
    ['ending', makeState({ page: 'finalEnding' }), { displayPage: 'finalEnding' }],
  ] as const)('resumes %s without an intermediate confirmation page', (_label, state, expected) => {
    expect(resolveResumeRoute(state, shopContent.content)).toEqual(expected)
  })

  it('restores an unresolved business event through business playback', () => {
    const state = makeState({
      page: 'event',
      pendingOpening: {
        resolutionId: 'resume-business',
        dayContext: {
          day: 10,
          weatherId: 'weather-clear',
          seasonId: 'season-early-spring',
          eventVisitorDelta: 0,
          activeTags: [],
        },
        decision: basicDecision,
        visitors: 8,
        sales: [],
        ledger: [],
        moneyDelta: 0,
        energyCost: 8,
        chainInterruptions: [],
        selectionKind: 'event',
        eventId: 'event-first-customer',
        rngState: seedRng('resume-business'),
      },
    })
    expect(resolveResumeRoute(state, shopContent.content)).toMatchObject({
      displayPage: 'business', eventTiming: 'business',
    })
  })
})
```

再以同一完整 `pendingOpening` 对象仅替换 `eventId`，增加 opening 事件直达 `event` 和 closing 事件直达 `event` 的显式用例。

- [x] **Step 2: 运行测试并确认因模块缺失而失败**

Run: `pnpm test src/state/resume-route.test.ts`

Expected: FAIL，错误指向 `./resume-route` 不存在，而不是夹具缺字段。

- [x] **Step 3: 实现纯路由函数**

```ts
export type ResumeDisplayPage = PageState | 'business'
export interface ResumeRoute {
  displayPage: ResumeDisplayPage
  eventTiming?: EventTiming
}

export function pendingEventTiming(state: GameState, content: ShopContent): EventTiming | undefined {
  const opening = state.pendingOpening
  if (!opening || opening.selectionKind === 'none') return undefined
  if (opening.selectionKind === 'event') {
    return content.events.find((event) => event.eventId === opening.eventId)?.scene.timing ?? 'closing'
  }
  return content.chains
    .find((chain) => chain.chainId === opening.chainId)
    ?.nodes.find((node) => node.nodeId === opening.nodeId)?.scene.timing ?? 'closing'
}

export function resolveResumeRoute(state: GameState, content: ShopContent): ResumeRoute {
  const eventTiming = pendingEventTiming(state, content)
  if (!eventTiming) return { displayPage: state.page }
  return {
    displayPage: eventTiming === 'business' ? 'business' : 'event',
    eventTiming,
  }
}
```

- [x] **Step 4: 将 `App.tsx` 接入纯路由并删除空旷中间页**

- 删除 `App.tsx` 内部 `pendingEventTiming`，改为从 `resume-route.ts` 导入。
- 首页“继续上次经营”从 `setDisplayPage('continueGame')` 改为 `resumeGame`。
- `resumeGame` 使用 `resolveResumeRoute`，如存在 `eventTiming` 则 dispatch `event-open`，然后一次设置目标页。
- 删除 `displayPage === 'continueGame'` 的 JSX；保留 `PageState` 中历史值以维持存档兼容。

- [x] **Step 5: 运行续玩与 UI 流测试**

Run: `pnpm test src/state/resume-route.test.ts src/state/ui-flow.test.ts`

Expected: PASS，且无 warning。

- [x] **Step 6: 检查点**

Run: `git diff --check -- src/state/resume-route.ts src/state/resume-route.test.ts src/App.tsx`

Expected: 无输出。

---

### Task 2: 建立统一页面外壳与切换契约

**Files:**
- Create: `src/ui/ScreenFrame.tsx`
- Create: `src/ui/ScreenFrame.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.css`

**Interfaces:**
- Consumes: `ReactNode`，每个页面的 `className`、`aria-labelledby` 和表面语义。
- Produces: `ScreenFrame({ className, labelledBy, surface, children })`，稳定根 ID `screen-root` 和 `tabIndex={-1}`。

- [x] **Step 1: 写页面外壳失败测试**

```tsx
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ScreenFrame } from './ScreenFrame'

describe('ScreenFrame', () => {
  it('declares its surface and a stable programmatic focus target', () => {
    const html = renderToStaticMarkup(
      <ScreenFrame className="guide-screen" labelledBy="guide-title" surface="dark">
        <h1 id="guide-title">Guide</h1>
      </ScreenFrame>,
    )
    expect(html).toContain('id="screen-root"')
    expect(html).toContain('tabindex="-1"')
    expect(html).toContain('surface-dark')
    expect(html).toContain('aria-labelledby="guide-title"')
  })
})
```

- [x] **Step 2: 运行并确认失败**

Run: `pnpm test src/ui/ScreenFrame.test.tsx`

Expected: FAIL，`ScreenFrame` 模块不存在。

- [x] **Step 3: 实现 `ScreenFrame`**

```tsx
import type { ReactNode } from 'react'

export function ScreenFrame({ className = '', labelledBy, surface, children }: {
  className?: string
  labelledBy?: string
  surface: 'dark' | 'paper'
  children: ReactNode
}) {
  return <main
    id="screen-root"
    className={`app-shell surface-${surface} ${className}`.trim()}
    aria-labelledby={labelledBy}
    tabIndex={-1}
  >{children}</main>
}
```

- [x] **Step 4: 把 `App.tsx` 的所有顶层 `<main>` 替换为 `ScreenFrame`**

- 首页、引导、新开、恢复、加载使用 `surface="dark"`。
- 晨间、备货、开门、营业、事件、日结、里程碑和结局使用 `surface="dark"`，内部纸面卡片保留自身表面。
- 有标题的页面传入真实 `labelledBy`；纯加载页省略。

- [x] **Step 5: 建立页面切换 effect**

```ts
useEffect(() => {
  const frame = window.requestAnimationFrame(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    document.getElementById('screen-root')?.focus({ preventScroll: true })
  })
  return () => window.cancelAnimationFrame(frame)
}, [displayPage, error, loading])
```

保留 `loading` 依赖，确保初始存档读取完成后的首个真实页面获得焦点。不将 `game`、`decision` 或输入数值放入依赖，避免备货时每次点击都把页面拉回顶部。

- [x] **Step 6: 增加页面根焦点样式**

```css
.app-shell:focus { outline: none; }
.app-shell:focus-visible { outline: 3px solid var(--focus); outline-offset: -3px; }
```

- [x] **Step 7: 运行组件与全量测试**

Run: `pnpm test src/ui/ScreenFrame.test.tsx && pnpm test`

Expected: `ScreenFrame` 测试与全量测试全部 PASS。

---

### Task 3: 用表面语义统一操作组和对比度

**Files:**
- Create: `src/ui/ActionGroup.tsx`
- Create: `src/ui/ActionGroup.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/ui/GameUi.tsx`
- Modify: `src/ui/GameUi.test.tsx`
- Modify: `src/App.css`
- Modify: `src/index.css`

**Interfaces:**
- Consumes: 已有 `.primary-action`、`.secondary-action`、`.text-button` 按钮角色。
- Produces: `ActionGroup({ layout, surface, children })`，类名 `action-stack|split-actions` 与 `action-surface-dark|action-surface-paper`。

- [x] **Step 1: 写操作组语义失败测试**

```tsx
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ActionGroup } from './ActionGroup'

describe('ActionGroup', () => {
  it.each([
    ['dark', 'split', 'split-actions action-surface-dark'],
    ['paper', 'stack', 'action-stack action-surface-paper'],
  ] as const)('marks %s actions on a %s layout', (surface, layout, expected) => {
    const html = renderToStaticMarkup(<ActionGroup surface={surface} layout={layout}><button>Action</button></ActionGroup>)
    expect(html).toContain(`class="${expected}"`)
  })
})
```

- [x] **Step 2: 运行并确认失败**

Run: `pnpm test src/ui/ActionGroup.test.tsx`

Expected: FAIL，`ActionGroup` 模块不存在。

- [x] **Step 3: 实现 `ActionGroup`**

```tsx
import type { ReactNode } from 'react'

export function ActionGroup({ layout, surface, children }: {
  layout: 'stack' | 'split'
  surface: 'dark' | 'paper'
  children: ReactNode
}) {
  const layoutClass = layout === 'stack' ? 'action-stack' : 'split-actions'
  return <div className={`${layoutClass} action-surface-${surface}`}>{children}</div>
}
```

- [x] **Step 4: 接入所有双按钮或堆叠操作**

- `App.tsx`：首页 stack = dark，引导 split = dark，恢复 split = dark。
- `GameUi.tsx`：开门清单 split = paper，营业流水 split = paper。
- 单一主按钮不需要包装为操作组。

- [x] **Step 5: 定义表面颜色变量和完整按钮状态**

```css
:root {
  --dark-text: #fbf2dd;
  --dark-muted: #bdc5bb;
  --dark-accent: #e3b75f;
  --dark-border: rgb(242 229 199 / 70%);
  --dark-button: rgb(31 41 39 / 78%);
}

.action-surface-dark .secondary-action {
  color: var(--dark-text);
  border-color: var(--dark-border);
  background: var(--dark-button);
}
.action-surface-dark .secondary-action:hover:not(:disabled) {
  color: #fffaf0;
  border-color: var(--paper);
  background: rgb(75 52 40 / 92%);
}
.action-surface-paper .secondary-action {
  color: var(--wood-dark);
  border-color: var(--wood);
  background: transparent;
}
.surface-dark > .section-kicker,
.surface-dark > .screen-heading .section-kicker {
  color: var(--dark-accent);
}
```

保留 `.paper-panel .section-kicker`、`.business-ticker .section-kicker`、`.event-experience .section-kicker` 为梅红，避免深色页面根规则污染纸面卡片。删除只为首页“重新开店”存在的临时 `.cover-shell .secondary-action` 特例，由语义规则取代。

- [x] **Step 6: 更新 `GameUi` 标记测试并运行**

```ts
expect(openingHtml).toContain('split-actions action-surface-paper')
expect(tickerHtml).toContain('split-actions action-surface-paper')
```

Run: `pnpm test src/ui/ActionGroup.test.tsx src/ui/GameUi.test.tsx`

Expected: PASS。

- [x] **Step 7: 用真实浏览器做对比度红／绿验证**

1. 在未修正构建上记录“跳过引导”为 `rgb(75, 52, 40)` 且透明背景。
2. 构建后断言它为暖白文字、非透明深色背景、米金边框。
3. 聚焦后断言 outline 宽度至少 `3px`；hover 后文字仍为浅色。

Expected: “跳过引导”、有存档时“重新开店”和恢复页“回到开店首页”均可读。

---

### Task 4: 统一实机导航、安全区和粘性顶部

**Files:**
- Modify: `src/index.css`
- Modify: `src/App.css`
- Modify: `VISUAL-QA.md`

**Interfaces:**
- Consumes: 宿主可覆写 CSS 变量 `--host-nav-height`。
- Produces: `--safe-top`、`--content-top`、`--sticky-top` 三个统一布局变量。

- [x] **Step 1: 在真实浏览器记录失败基线**

在 390×844 晨间页设置 `--host-nav-height:56px`，记录 `.game-header.getBoundingClientRect().top`。

Expected before fix: `18px`，小于宿主导航高度。

- [x] **Step 2: 定义统一顶部变量**

```css
:root {
  --host-nav-height: 56px;
  --safe-top: env(safe-area-inset-top, 0px);
  --content-top: calc(var(--host-nav-height) + var(--safe-top) + 18px);
  --sticky-top: calc(var(--host-nav-height) + var(--safe-top));
}
```

- [x] **Step 3: 将页面外壳和备货预算接入同一基线**

```css
.app-shell {
  padding: var(--content-top) 0 max(28px, env(safe-area-inset-bottom));
}
.budget-strip { top: var(--sticky-top); }
```

不在单个页面再写 `top: 56px`。

- [x] **Step 4: 三宽与三导航高度验证**

对 375×812、390×844、430×932 分别设置 `--host-nav-height: 0px / 56px / 72px`，并额外设置 `--safe-top:24px` 做可控模拟。

Assert:

```js
header.getBoundingClientRect().top >= hostNavHeight + safeTop
getComputedStyle(document.querySelector('.budget-strip')).top === `${hostNavHeight + safeTop}px`
document.documentElement.scrollWidth === window.innerWidth
```

Expected: 全部 PASS，且页面最后主操作可滚动到完整可见。

- [x] **Step 5: 记录精确尺寸到 `VISUAL-QA.md`**

记录每个视口的 header top、sticky top、scrollWidth、最小主按钮高度和断图数。

---

### Task 5: 优化引导、晨间和备货信息密度

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.css`
- Modify: `src/ui/GameUi.tsx`
- Modify: `src/ui/GameUi.test.tsx`

**Interfaces:**
- Consumes: 已有 `GuideCard`、`PreparationPanel`、`ScreenFrame`、`ActionGroup`。
- Produces: 无重复提示的晨间页，状态清楚的备货商品行，紧凑但可滚动的引导卡。

- [x] **Step 1: 写备货选中语义失败测试**

在 `GameUi.test.tsx` 中对 `PreparationPanel` 的静态输出断言：

```ts
expect(html).toContain('product-row product-selected')
expect(html).toContain('aria-describedby="selection-rule"')
expect(html).toContain('id="selection-rule"')
```

Expected: 现有第一条通过，选择规则的可访问关联失败。

- [x] **Step 2: 运行并确认失败原因**

Run: `pnpm test src/ui/GameUi.test.tsx`

Expected: FAIL，因 `selection-rule` 关联尚未实现。

- [x] **Step 3: 连接备货说明并强化商品状态**

- `PreparationPanel` 的表单增加 `aria-describedby="selection-rule"`。
- 在商品列表前加入 `<p id="selection-rule" className="selection-rule">`，文案使用已有备货帮助文案，不在 JSX 硬编码业务中文。
- `.product-selected` 使用纸面深一级背景和梅红左边标记；未选行保持低噪声，disabled checkbox 旁保留文字规则。

- [x] **Step 4: 移除晨间重复文案**

在 `App.tsx` 的 `morning-panel` 中删除 `GuideCard` 之前重复的 `<p>{ui.morningHint}</p>`，保留卡片中的阿沅提示与主操作。

- [x] **Step 5: 收紧引导卡的手机尺寸**

```css
@media (max-width: 430px) {
  .guide-screen { align-content: start; }
  .guide-card:not(.guide-compact) > img {
    height: clamp(220px, 62vw, 270px);
  }
  .guide-screen > h1 { text-wrap: balance; }
}
```

确保 56px 宿主导航存在时页面允许正常纵向滚动，不通过压缩文字或按钮高度强行塞入首屏。

- [x] **Step 6: 运行组件测试与三宽浏览器复验**

Run: `pnpm test src/ui/GameUi.test.tsx`

Browser assertions: 引导最后按钮可达、晨间只出现一次完整提示、长备货页无横溢出，所有步进按钮不低于 44px，主按钮不低于 46px。

---

### Task 6: 建立页面进入、操作和状态反馈

**Files:**
- Modify: `src/App.css`
- Modify: `src/index.css`
- Modify: `src/state/ui-flow.test.ts`
- Modify: `src/ui/GameUi.test.tsx`

**Interfaces:**
- Consumes: 已有 `uiFlow.isSubmitting`、`aria-pressed`、`aria-expanded`、disabled 和 `prefers-reduced-motion`。
- Produces: `screen-in`、`selection-pulse`、状态友好的按钮与选项过渡。

- [x] **Step 1: 先补提交锁和选中语义回归断言**

在已有测试中明确断言：

```ts
expect(reduceUiFlow(submitting, { type: 'select-choice', choiceId: 'choice-b' })).toBe(submitting)
expect(choiceHtml).toContain('aria-pressed="true"')
expect(choiceHtml).toContain('disabled')
```

第一条必须使用处于 `isSubmitting: true` 的 state；第二、三条使用 `EventChoicePanel` 的已选且提交中夹具。

- [x] **Step 2: 运行现有测试并核对是否已有保护**

Run: `pnpm test src/state/ui-flow.test.ts src/ui/EventExperience.test.tsx`

Expected: 提交锁已有行为应 PASS；若标记断言失败，只修复标记，不改动结算引擎。

- [x] **Step 3: 实现轻量页面与控件过渡**

```css
.app-shell { animation: screen-in 220ms ease-out both; }
.choice-grid button,
.product-row,
.ledger-lines,
.budget-strip dd { transition: color 140ms ease, background-color 140ms ease, border-color 140ms ease, transform 140ms ease; }
.choice-grid button[aria-pressed="true"] { transform: translate3d(0, -1px, 0); }
@keyframes screen-in {
  from { opacity: 0; transform: translate3d(0, 8px, 0); }
  to { opacity: 1; transform: translate3d(0, 0, 0); }
}
```

不对整个长备货列表做持续 transform，不使用循环呼吸、闪烁或视差。

- [x] **Step 4: 扩展减少动效覆盖**

保留现有 `prefers-reduced-motion` 规则，并确保新增 `screen-in` 最长持续时间在 reduce 下为 `0.00001s`，页面内容无位移依赖。

- [x] **Step 5: 浏览器检查页面切换和减少动效**

- 正常模式：页面进入动画 180–240ms，按钮状态 100–160ms。
- 减少动效：全页最长 animation/transition 不高于 `0.00001s`。
- 从长备货页进入开门清单后 `scrollY === 0`，`document.activeElement.id === 'screen-root'`。

---

### Task 7: 全流程视觉与逻辑巡检

**Files:**
- Modify: `VISUAL-QA.md`

**Interfaces:**
- Consumes: Tasks 1–6 的续玩路由、页面外壳、表面操作、顶部偏移和交互状态。
- Produces: 全页面审计证据；本任务不在没有失败测试的情况下追加临时 CSS 补丁。

- [x] **Step 1: 建立受控页面矩阵**

使用现有 IndexedDB V2 夹具覆盖以下状态：

1. 无存档首页；
2. 有存档首页；
3. 引导第 1 和第 3 步；
4. 晨间；
5. 备货顶部与底部；
6. 开门清单；
7. 营业流水第 1 和第 4 段；
8. opening / business / closing / chain 事件的 situation / selection / result；
9. 有事件日结与无事件日结；
10. 里程碑、破产、普通百日结局和特色结局。

- [x] **Step 2: 在三宽下运行统一布局断言**

```js
({
  scrollWidth: document.documentElement.scrollWidth,
  viewportWidth: window.innerWidth,
  brokenImages: [...document.images].filter((image) => !image.complete || image.naturalWidth === 0).length,
  primaryMinHeight: Math.min(...[...document.querySelectorAll('.primary-action')].map((node) => node.getBoundingClientRect().height)),
  lastActionReachable: [...document.querySelectorAll('button')].at(-1).getBoundingClientRect().bottom <= document.documentElement.scrollHeight,
})
```

Expected: `scrollWidth === viewportWidth`，`brokenImages === 0`，`primaryMinHeight >= 46`，`lastActionReachable === true`。

- [x] **Step 3: 检查交互和路由不变式**

- 续玩只点击一次即到真实节点。
- 引导“跳过”与“下一句”都可读，主次层级清楚。
- 备货返回修改后数量、售价和提前打烊不丢失。
- 事件选择确认前可切换，确认双击只结算一次。
- 日结账簿展开后每笔数值与净变化一致。
- 刷新后回到相同经营节点，资金、口碑、体力和人情不变。

- [x] **Step 4: 逐项确认 Tasks 1–6 的明确修正已关闭**

审计表必须分别记录：深色次按钮、深色小标题、直接续玩、56px 导航偏移、备货吸顶、晨间去重、商品选中态、页面滚动／焦点与减少动效的 PASS 证据。如任一项失败，不勾选本步骤，先在本任务下增加“失败测量→单一根因→最小修正→同组合绿灯”的具体修订步骤，再改代码。

- [x] **Step 5: 记录控制台、请求和减少动效**

Expected:

- console error = 0，warning = 0；
- 所有请求指向当前 `127.0.0.1` 预览；
- 无远程 URL、Base64 生产资源、Blob、Service Worker 或媒体设备调用；
- reduced motion 最长时长 `0.00001s`。

- [x] **Step 6: 修复事件确认双击跨页穿透（巡检新增）**

失败测量：在“确认选择”上执行真实双击，第一次点击切到结果页后，第二次点击命中新页同位置的“记下结果”，结果页被直接跳过；账目只结算一次，但关键反馈不可见。

单一根因：`ScreenFrame` 切页后立即允许指针命中，而原按钮双击序列尚未结束。

最小修正：`ScreenFrame` 初次挂载的 220ms 内增加 `screen-entering` 指针锁；页面动效结束后自动解锁。先为初始标记写失败断言，再复跑真实双击，必须停留在事件结果页。

---

### Task 8: 完整回归、平衡审计与交付记录

**Files:**
- Modify: `VISUAL-QA.md`
- Modify: `UX-POLISH-IMPLEMENTATION-PLAN.md`

**Interfaces:**
- Consumes: Tasks 1–7 全部产出。
- Produces: 新鲜的自动化、浏览器、平衡和禁止能力证据。

- [x] **Step 1: 运行完整自动化门禁**

Run:

```bash
pnpm lint
pnpm test
pnpm build
```

Expected: lint 0 warning；所有测试 PASS；TypeScript 和 Vite 正式构建成功。

- [x] **Step 2: 确认 1,000 局平衡审计没有漂移**

Run: `pnpm test src/engine/balance-audit.test.ts --reporter=verbose`

Expected:

- `totalRuns === 1000`；
- bankruptcy rate 在 `0.05–0.45`；
- money median `<= 2500`；
- zero-energy rate `<= 0.30`；
- 每种策略至少一局到达第 100 日；
- deterministic replay = true。

- [x] **Step 3: 运行项目边界与禁止能力检查**

Run:

```bash
git diff --check -- .
git status --short -- .
rg -n "data:.*base64|https?://|Blob\(|serviceWorker|navigator\.mediaDevices" src public index.html
```

Expected: diff 无空白错误；本轮产出全在 04 目录；匹配只存在拒绝校验与负向测试。

- [x] **Step 4: 更新最终证据**

`VISUAL-QA.md` 必须写入：

- 最终测试文件数与用例数；
- CSS / JS 构建体积与 gzip 体积；
- 三宽与三导航高度的顶部、溢出、按钮和断图测量；
- 有／无存档续玩、引导、备货、四类事件、日结和结局证据；
- 对比度、focus、reduced motion、console 和请求数据；
- 所有未满足项；若无，明确记录“无”。

- [x] **Step 5: 关闭浏览器与预览进程，完成内联交付**

不 commit、不 push。确认没有留下 Playwright 会话或 04 预览端口，然后勾选所有计划项并报告最终证据。
