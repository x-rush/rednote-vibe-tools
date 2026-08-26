# 路岚陪伴式布局 V3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking. Execute inline; do not dispatch subagents and do not perform Git write operations.

**Goal:** Recompose the existing mobile UI so Lu Lan remains visibly present through the main flow with large portrait artwork, without changing checklist business behavior.

**Architecture:** Add one presentation-only `GuidePortrait` component backed by a tested variant configuration. Existing screens place that component in dedicated visual stages; CSS owns crop, gradient, overlap, and responsive behavior, while the reducer, content package, checklist engine, and storage remain unchanged.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Vitest 4, existing local WebP assets, responsive CSS.

**Spec:** `NPC-LAYOUT-V3.md`

## Global Constraints

- Modify only `projects/06-departure-checker/**`.
- Do not add dependencies or modify root manifests, workspace files, or lockfiles.
- Reuse `public/assets/guide/guide-master-v2.webp`; do not generate a different character identity.
- Do not modify `src/content/content.json`, checklist rules, storage schema, or reducer behavior.
- Keep all required text and controls as DOM content; the portrait must remain optional presentation.
- Verify 375×812, 390×844, and 430×932 CSS px.
- Run `pnpm lint && pnpm test && pnpm build` before completion.

---

### Task 1: Shared portrait presentation component

**Files:**
- Create: `src/ui/GuidePortrait.tsx`
- Create: `src/ui/guidePresentation.ts`
- Create: `src/ui/guidePresentation.test.ts`

**Interfaces:**
- Produces: `GuidePortraitVariant = 'home' | 'wizard' | 'summary' | 'urgent' | 'completion' | 'help'`.
- Produces: `guidePresentationFor(variant)` returning `{ className, alt }`.
- Produces: `<GuidePortrait variant interactive? onActivate? />` using `GUIDE_ASSETS.master`.

- [x] **Step 1: Write the failing variant-contract test**

```ts
import { describe, expect, it } from 'vitest'
import { guidePresentationFor, GUIDE_PORTRAIT_VARIANTS } from './guidePresentation'

describe('guide portrait presentation', () => {
  it('defines every approved stage without repeating meaningful alt text', () => {
    expect(GUIDE_PORTRAIT_VARIANTS).toEqual(['home', 'wizard', 'summary', 'urgent', 'completion', 'help'])
    expect(guidePresentationFor('home').alt).toContain('路岚')
    for (const variant of GUIDE_PORTRAIT_VARIANTS.filter((item) => item !== 'home')) {
      expect(guidePresentationFor(variant).alt).toBe('')
    }
  })
})
```

- [x] **Step 2: Run the focused test and verify missing-module failure**

Run: `pnpm test -- src/ui/guidePresentation.test.ts`
Expected: FAIL because `guidePresentation.ts` does not exist.

- [x] **Step 3: Implement the typed configuration**

```ts
export const GUIDE_PORTRAIT_VARIANTS = ['home', 'wizard', 'summary', 'urgent', 'completion', 'help'] as const
export type GuidePortraitVariant = typeof GUIDE_PORTRAIT_VARIANTS[number]

const PRESENTATIONS = {
  home: { className: 'guide-portrait-home', alt: '路岚手持三折出门清单站在明亮玄关' },
  wizard: { className: 'guide-portrait-wizard', alt: '' },
  summary: { className: 'guide-portrait-summary', alt: '' },
  urgent: { className: 'guide-portrait-urgent', alt: '' },
  completion: { className: 'guide-portrait-completion', alt: '' },
  help: { className: 'guide-portrait-help', alt: '' },
} satisfies Record<GuidePortraitVariant, { className: string; alt: string }>

export const guidePresentationFor = (variant: GuidePortraitVariant) => PRESENTATIONS[variant]
```

- [x] **Step 4: Implement `GuidePortrait`**

Render a `<figure className="guide-portrait-stage …">` with the existing master WebP, a gradient layer, optional DOM copy, and either a semantic `<button aria-label="打开路岚帮助">` or a non-interactive figure. Never put text inside the image.

- [x] **Step 5: Run the focused test**

Run: `pnpm test -- src/ui/guidePresentation.test.ts`
Expected: PASS.

---

### Task 2: Home and question-flow composition

**Files:**
- Modify: `src/ui/HomeScreen.tsx`
- Modify: `src/ui/ConditionWizard.tsx`
- Modify: `src/App.css`

**Interfaces:**
- Consumes: `GuidePortrait variant="home" | "wizard"`.
- Preserves every existing callback and condition value contract.

- [x] **Step 1: Add the home portrait stage**

Place `<GuidePortrait variant="home">` after the brand bar and before the main paper section. Keep only the compact DOM message “容易忘的，我陪你查。” in the stage, move “今天去哪儿？” to the paper, and keep recent/scenario buttons unchanged.

- [x] **Step 2: Add the wizard companion stage**

Place `<GuidePortrait variant="wizard">` between progress and the question card. Show `第 {questionIndex + 1} 步` and “先确认这一个条件。” as DOM copy; do not derive new business recommendations.

- [x] **Step 3: Add mobile-first stage CSS**

Implement the home stage at 218px and `.wizard-guide-stage` at 188px; use a right-aligned image, left-to-right paper/forest gradient, and a `-20px` question-card overlap. At `max-width: 390px`, reduce heights to 196px and 172px. At low viewport heights, reduce wizard stage to 150px.

- [x] **Step 4: Run current unit tests and build**

Run: `pnpm test && pnpm build`
Expected: all existing tests and TypeScript build pass.

---

### Task 3: Checklist banner and large help sheet

**Files:**
- Modify: `src/ui/ChecklistWorkspace.tsx`
- Modify: `src/ui/GuideSheet.tsx`
- Modify: `src/App.css`

**Interfaces:**
- Consumes: `GuidePortrait variant="summary" interactive onActivate={onHelp}`.
- Consumes: `GuidePortrait variant="help"` inside the existing modal contract.

- [x] **Step 1: Replace the summary avatar with a portrait banner**

Keep scenario, condition chips, remaining count, completion count, and modify-condition action in the left content layer. Render the summary portrait on the right as a real button that calls `onHelp` and is labelled “打开路岚帮助”.

- [x] **Step 2: Upgrade help mode**

In `GuideSheet mode="help"`, place a 210px portrait stage above the identity row and three current help explanations. Preserve the close button, dialog semantics, Escape behavior, and focus trap.

- [x] **Step 3: Style the banner and help crop**

Make `.checklist-summary` at least 196px high with 58% readable text width, a forest gradient over the portrait, and no absolute child extending beyond the banner. Keep the three view tabs directly adjacent below.

- [x] **Step 4: Run lint and build**

Run: `pnpm lint && pnpm build`
Expected: PASS without accessibility lint errors or TypeScript errors.

---

### Task 4: Urgent, completion, saved, and recovery presence

**Files:**
- Modify: `src/ui/LastMinuteMode.tsx`
- Modify: `src/ui/CompletionScreen.tsx`
- Modify: `src/ui/SavedListsScreen.tsx`
- Modify: `src/ui/RecoveryScreen.tsx`
- Modify: `src/App.css`

**Interfaces:**
- Consumes: `GuidePortrait variant="urgent" | "completion"`.
- Uses existing `GUIDE_ASSETS.avatar` for compact informational screens.
- Preserves all existing actions and data-loss protections.

- [x] **Step 1: Add the urgent companion stage**

Render the urgent portrait beside the “没有倒计时” copy before the complete remaining list. Keep the remaining count and first current item visible without scrolling at 390×844 when practical.

- [x] **Step 2: Recompose completion**

Place the 210px completion portrait behind a separate paper card containing the completion stamp, counts, and both navigation actions. Do not overlap the stamp with the face or hands.

- [x] **Step 3: Add compact identity rows**

Use the 160×160 avatar beside the Saved Lists title and partial/no-match recovery copy. Keep content/storage failure marks as the primary visual for fatal states.

- [x] **Step 4: Add responsive and reduced-motion CSS**

Cancel portrait entrance transforms under `prefers-reduced-motion: reduce`. Ensure portrait stages remain clipped, images use stable object positions, and compact identity images remain 48–56px.

- [x] **Step 5: Run full tests**

Run: `pnpm test`
Expected: all tests pass with no behavior changes.

---

### Task 5: Browser QA and documentation

**Files:**
- Modify: `NPC-LAYOUT-V3.md`
- Modify: `VISUAL-QA.md`
- Modify: `PREP_REPORT.md`
- Modify: `README.md`

**Interfaces:**
- Documents the final screen coverage, asset reuse, responsive results, and verification output.

- [x] **Step 1: Run the production app in a real browser**

Exercise home → event scenario → four questions → checklist → help → location route → last minute → completion. Confirm the portrait is visible on home, every question, checklist, help, urgent, and completion screens.

- [x] **Step 2: Verify the three required widths**

At 375×812, 390×844, and 430×932 evaluate:

```js
({
  width: innerWidth,
  documentWidth: document.documentElement.scrollWidth,
  brokenImages: [...document.images].filter((image) => !image.complete || image.naturalWidth === 0).length,
})
```

Expected: `documentWidth === width` and `brokenImages === 0` at all three widths.

- [x] **Step 3: Check keyboard and reduced motion**

Open the large help sheet, verify initial focus, Tab loop, Escape close, restored trigger focus, and body scroll restoration. Emulate reduced motion and verify portrait stages are static.

- [x] **Step 4: Update delivery documents**

Mark `NPC-LAYOUT-V3.md` implemented. Record that the existing 900×1200 master is reused across six screen families and no new art files were needed.

- [x] **Step 5: Run the final gate**

Run: `pnpm lint && pnpm test && pnpm build && git diff --check -- .`
Expected: exit code 0 for the complete command.
