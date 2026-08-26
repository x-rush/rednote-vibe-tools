# Earth Online Minitool Package Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce an upload-ready offline ZIP whose root contains a compliant `index.html`, classic bundled JavaScript, local assets, and no forbidden container capabilities.

**Architecture:** Keep the normal Vite build intact and add a dedicated minitool library build that emits one IIFE script plus CSS and copied public assets. A local Node validation script checks the built tree and final ZIP contract; JDK `jar --no-manifest` creates the ZIP because the host has no `zip` executable.

**Tech Stack:** Vite 8, Rollup IIFE output, React 19, Node validation script, JDK jar, Vitest

**Spec:** `/.codex/SKILL.md`, `/.codex/references/zip-artifact-spec.md`, `/.codex/references/device-capabilities.md`, `/.codex/references/cross-platform-h5.md`

## Global Constraints

- Modify only `projects/08-earth-online`; add no dependency and do not edit the workspace lockfile.
- ZIP root must contain `index.html`; only supported static file types may be included.
- All resource paths must be relative and local.
- ZIP HTML must use a classic external script, with no module script, inline script, external URL, base, iframe, object, or custom CSP.
- The runtime must contain no forbidden network, device, worker, dynamic-code, window, download, or navigation capability.
- Final ZIP must be at most 10MB and preferably below 2MB.

---

### Task 1: Establish failing container contracts

- [x] Update render expectations to require relative local art paths.
- [x] Run focused tests and a shell acceptance check against the current `dist`; confirm failures for absolute paths and `type="module"`.

### Task 2: Add the dedicated minitool build

- [x] Convert runtime public-asset references to relative paths through the shared asset helper.
- [x] Bring source `index.html` metadata up to the cross-platform viewport and language contract.
- [x] Add `vite.minitool.config.ts` to emit `dist-minitool/index.html`, `assets/app.js` as IIFE, `assets/style.css`, and copied local assets.
- [x] Add `scripts/validate-minitool.mjs` to enforce file types, root entry, CSP-facing HTML rules, local relative paths, forbidden capability scans, referenced-file existence, and size budget.
- [x] Add `build:minitool`, `validate:minitool`, and `package:minitool` scripts without changing dependencies.

### Task 3: Build, package, and verify

- [x] Run focused tests to GREEN.
- [x] Run `pnpm package:minitool` and inspect the ZIP root/listing and byte size.
- [x] Extract the ZIP to a temporary directory, validate it again, and open it through a local static server for browser smoke testing.
- [x] Run `pnpm lint && pnpm test && pnpm build` and confirm the ordinary project build still passes.
