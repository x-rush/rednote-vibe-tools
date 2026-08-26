# Earth Online Logo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the approved “地球支线传送门” logo as a local SVG brand mark, release PNG, favicon, and header interaction.

**Architecture:** Keep one clean 512×512 SVG master under the project’s local brand assets and consume it through the existing typed asset-path module. Use a simplified favicon variant for very small sizes and export the release PNG from the master in a real browser. The header remains semantic and gains only a bounded hover/press treatment.

**Tech Stack:** SVG, React 19, CSS, Vitest, Vite, Playwright CLI

**Spec:** Approved chat design, reflected in `ART-REQUEST.md` and the constraints below.

## Global Constraints

- Modify only `projects/08-earth-online`.
- Use only local static assets; add no dependency, CDN, runtime API, Base64, Blob, or service worker.
- Mark: deep guild-green rounded square, parchment globe/portal, vermilion route, brass four-point quest star.
- No words inside the icon; remain legible at 24px and use a simple silhouette.
- Preserve accessible title text and reduced-motion behavior.
- Verify `pnpm lint && pnpm test && pnpm build`, 375/390/430 CSS px, and a non-zero safe-area inset.

---

### Task 1: Brand asset contract

**Files:**
- Modify: `src/content/assets.test.ts`
- Modify: `src/ui/render.test.tsx`

**Interfaces:**
- Consumes: the existing static asset checks and `GuildFrame` server render.
- Produces: a failing contract for `/assets/earth-online/brand/logo-mark.svg` and its header use.

- [x] **Step 1: Write the failing tests**

Add a brand-asset test that opens the local logo, requires a 512 square viewBox, accessible title, no embedded text, and no external URL. Extend the shell-render test to require the new brand path.

- [x] **Step 2: Run tests to verify RED**

Run: `pnpm test src/content/assets.test.ts src/ui/render.test.tsx`

Expected: FAIL because the brand asset and header reference do not exist.

### Task 2: Logo master and application integration

**Files:**
- Create: `public/assets/earth-online/brand/logo-mark.svg`
- Create: `public/favicon.svg`
- Modify: `src/ui/asset-paths.ts`
- Modify: `src/ui/GuildFrame.tsx`
- Modify: `src/styles/components.css`

**Interfaces:**
- Consumes: `assets.brand.mark`, existing header button, and the approved palette.
- Produces: a local logo shown in the header with keyboard-safe hover/press motion.

- [x] **Step 1: Implement the minimal logo asset**

Create the approved simple geometric mark with an SVG `<title>`, 512 square viewBox, local-only shapes, and no text glyphs.

- [x] **Step 2: Integrate the asset**

Expose `assets.brand.mark`, render it in `GuildFrame`, and style the icon as a rounded-square app mark with a subtle hover lift/glow and reduced-motion fallback.

- [x] **Step 3: Create the favicon**

Create a compact SVG variant using the same four visual elements and keep `index.html`’s existing `/favicon.svg` reference valid.

- [x] **Step 4: Run tests to verify GREEN**

Run: `pnpm test src/content/assets.test.ts src/ui/render.test.tsx`

Expected: PASS.

### Task 3: Release export and competition verification

**Files:**
- Create: `release-assets/tool-icon-v1.png`
- Temporary: browser viewport captures for visual inspection; remove them after recording the results

**Interfaces:**
- Consumes: the completed local SVG and built Vite application.
- Produces: the 1024px release icon and browser evidence at required widths.

- [x] **Step 1: Export the release PNG**

Serve the project locally, open the master SVG at 1024×1024 in Chromium, and capture the icon to `release-assets/tool-icon-v1.png`.

- [x] **Step 2: Run full static verification**

Run: `pnpm lint && pnpm test && pnpm build`

Expected: all commands exit 0.

- [x] **Step 3: Verify responsive and safe-area rendering**

Capture the real page at 375, 390, and 430 CSS px. Apply a 44px `--safe-area-inset-top` simulation and confirm the fixed header and brand remain below it without clipping or overflow.

- [x] **Step 4: Inspect the exported icon**

Check the PNG dimensions and visually inspect the release icon plus the three page captures for recognizable silhouette, clean path/star separation, and unblocked header text.
