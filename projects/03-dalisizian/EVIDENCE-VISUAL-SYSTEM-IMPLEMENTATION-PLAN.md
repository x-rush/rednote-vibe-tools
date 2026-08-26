# Interactive Evidence Visual System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every generic evidence placeholder with one of four source-safe interactive visual artifacts and surface all 32 artifacts during acquisition, inspection, deduction review, and archive browsing.

**Architecture:** Extend `Evidence` with a discriminated `visualSpec`, keep observation progress as sanitized structured case state, derive render models in pure functions, and render four small React template components behind a shared `EvidenceArtifact` boundary. User-visible evidence copy remains in `src/content/content.json`; local SVG plates provide imagery without embedding factual prose, while HTML/CSS overlays carry the evidence-specific labels and interactions.

**Tech Stack:** React 19, TypeScript 6, Vite 8 IIFE build, Vitest 4, existing CSS, local SVG/WebP assets, existing CDP browser QA harness; no new dependency.

**Spec:** `projects/03-dalisizian/EVIDENCE-VISUAL-SYSTEM-SPEC.md`

## Global Constraints

- Modify only `projects/03-dalisizian`; do not modify workspace manifests, lockfiles, other projects, `docs/`, or `prep/`.
- Pure static frontend: no backend, runtime CDN, required external API, Service Worker, Node API in runtime code, or unapproved device API.
- All business content stays in `src/content/content.json`.
- Persist only structured observation IDs; never persist images, Base64, audio, video, or Blob values.
- Exact ancient glyphs and book text require authoritative provenance and human review; an unverified shape must be replaced by an honest structure diagram, never an AI imitation.
- All 32 evidence records must render a distinct visual; no normal path may show the generic “人工核验资源位”.
- Every fixed or sticky top control and anchor target must include `var(--safe-area-inset-top, env(safe-area-inset-top, 0px))`.
- Verify 375×667, 390×844, and 430×932 CSS px with simulated top safe areas 0, 24, and 47 CSS px.
- Before every implementation commit, run the task's focused tests. Before final delivery, run `pnpm lint && pnpm test && pnpm build`.
- The release artifact always overwrites `release-assets/大理寺字案录-小工具包-20260826.zip`; do not create v4/v5-style packages.

## File Structure

**Create:**

- `src/evidence/model.ts` — pure artifact-model and observation-progress helpers.
- `src/evidence/model.test.ts` — focused tests for model construction, progress, fallback, and template semantics.
- `src/evidence/EvidenceArtifact.tsx` — common artifact shell and template dispatch.
- `src/evidence/EvidenceThumbnail.tsx` — compact visual shared by acquisition, ledger, and deduction tray.
- `src/evidence/GlyphTimelineArtifact.tsx` — stage selection and source-state presentation.
- `src/evidence/LexiconScrollArtifact.tsx` — entry expansion and highlighted-term observation.
- `src/evidence/SemanticMapArtifact.tsx` — node and edge inspection.
- `src/evidence/MythVerdictArtifact.tsx` — claim/material reveal and evidence-boundary comparison.
- `src/evidence/evidence.css` — all evidence visual, animation, safe-area, reduced-motion, and responsive styles.
- `src/evidence/assets.ts` — exhaustive stable-ID-to-local-SVG mapping.
- `src/evidence/assets.test.ts` — resolver completeness and local-file existence tests.
- `src/evidence/components.test.tsx` — server-render smoke tests for all four templates and fallbacks.
- `qa/evidence-browser.mjs` — real-browser acquisition, inspection, deduction, accessibility, image, and viewport checks.
- `research/evidence-source-register.md` — 32-item provenance and visual-mode audit.
- `public/assets/evidence/<case-key>/<asset-id>-v1.svg` — 32 local evidence plates, one per evidence record.

**Modify:**

- `src/content/types.ts` — discriminated visual-spec types and observation state.
- `src/content/content.json` — 32 complete `visualSpec` objects and any corrected source metadata.
- `src/content/content.test.ts` — full visual-spec coverage and source-boundary tests.
- `src/content/validate.ts` — structural, reference, template/type, and factual-source validation.
- `src/content/validate.test.ts` — one failure test per new validation family.
- `src/storage/storage.ts` — observation-map sanitization during case restore.
- `src/storage/storage.test.ts` — old-save migration, invalid-ID removal, bounds, and media rejection.
- `src/App.tsx` — evidence navigation context, acquisition preview, inspector, ledger thumbnails, and deduction tray.
- `src/App.css` — remove obsolete placeholder rules and integrate evidence surfaces with existing page layout.
- `src/app/viewModel.ts` — derive acquired evidence and deduction evidence tray models without mixing UI state into the engine.
- `src/app/viewModel.test.ts` — exact acquired-evidence and review-return models.
- `README.md`, `TODO.md`, `VISUAL-QA.md` — document completed evidence behavior and verification evidence.
- `release-assets/大理寺字案录-小工具包-20260826.zip` — overwrite with the verified final build.

## Execution Order

The required TypeScript contract and the real JSON content must never land separately on a broken main tree. Execute Task 1 through its red validation gate, then jump to Task 3 and commit Tasks 1+3 as one green schema/content slice. Return to Task 2 for observation persistence, then continue Tasks 4–9 in numeric order. This is the only intentional dependency jump in the plan.

---

### Task 1: Define the Four Visual-Spec Contracts and Reject Invalid Content

**Files:**

- Modify: `src/content/types.ts`
- Modify: `src/content/validate.ts`
- Modify: `src/content/validate.test.ts`

**Interfaces:**

- Produces: `EvidenceVisualSpec`, `EvidenceObservationPoint`, `EvidencePalette`, `EvidenceVisualTemplate`.
- Produces: validation codes `missing-evidence-visual`, `evidence-template-mismatch`, `invalid-evidence-observation`, `missing-evidence-visual-source`, `invalid-evidence-visual-reference`.
- Consumes: existing `SourceRecord`, `Evidence.type`, stable kebab-case IDs, and the existing `sourceTypes` lookup.

- [ ] **Step 1: Write failing validation tests for absent, mismatched, and untraceable specs**

Add tests that mutate a cloned package and assert exact codes:

```ts
it('requires a complete visual spec on every evidence record', () => {
  const broken = structuredClone(contentPackage)
  delete (broken.content.evidence[0] as Partial<Evidence>).visualSpec
  expect(errorCodes(broken)).toContain('missing-evidence-visual')
})

it('matches each evidence type to its approved template', () => {
  const broken = structuredClone(contentPackage)
  broken.content.evidence[0].visualSpec.template = 'myth-verdict'
  expect(errorCodes(broken)).toContain('evidence-template-mismatch')
})

it('requires factual observation points to cite a non-fiction source', () => {
  const broken = structuredClone(contentPackage)
  broken.content.evidence[0].visualSpec.observationPoints[0].sourceIds = ['source-fiction']
  expect(errorCodes(broken)).toContain('missing-evidence-visual-source')
})
```

- [ ] **Step 2: Run the tests and verify the red state**

Run: `pnpm vitest run src/content/validate.test.ts`

Expected: TypeScript or assertions fail because `visualSpec` and the new validation codes do not exist.

- [ ] **Step 3: Add the exact discriminated unions**

Add these contracts to `src/content/types.ts` and make `Evidence.visualSpec` required:

```ts
export type EvidenceVisualTemplate = 'glyph-timeline' | 'lexicon-scroll' | 'semantic-map' | 'myth-verdict'
export type EvidencePalette = 'jade' | 'cinnabar' | 'bronze' | 'ink'

export type EvidenceObservationPoint = {
  id: string
  title: string
  body: string
  sourceIds: string[]
  anchor: { x: number; y: number }
}

type EvidenceVisualBase = {
  thumbnailLabel: string
  palette: EvidencePalette
  completionPrompt: string
  fallbackSummary: string
  observationPoints: EvidenceObservationPoint[]
}

export type GlyphTimelineVisual = EvidenceVisualBase & {
  template: 'glyph-timeline'
  stages: Array<{ id: string; label: string; period: string; assetId?: string; materialKind: 'structure-diagram' | 'database-rendering' | 'rubbing' | 'manual-tracing'; certainty: string; sourceIds: string[] }>
}

export type LexiconScrollVisual = EvidenceVisualBase & {
  template: 'lexicon-scroll'
  entries: Array<{ id: string; heading: string; originalText: string; interpretation: string; highlight: string; sourceIds: string[] }>
}

export type SemanticMapVisual = EvidenceVisualBase & {
  template: 'semantic-map'
  nodes: Array<{ id: string; label: string; detail: string }>
  edges: Array<{ id: string; from: string; to: string; label: string; strength: 'supported' | 'possible' | 'blocked'; sourceIds: string[] }>
}

export type MythVerdictVisual = EvidenceVisualBase & {
  template: 'myth-verdict'
  claim: string
  supports: string[]
  limits: string[]
  disputes: string[]
}

export type EvidenceVisualSpec = GlyphTimelineVisual | LexiconScrollVisual | SemanticMapVisual | MythVerdictVisual
```

- [ ] **Step 4: Implement structural and source validation**

Use this fixed mapping and enforce it before inspecting template-specific fields:

```ts
const evidenceTemplateByType = {
  字形: 'glyph-timeline',
  字书: 'lexicon-scroll',
  语义: 'semantic-map',
  辨伪: 'myth-verdict',
} as const
```

Validate 1–6 observation points, unique kebab-case IDs, anchors within 0–100, nonempty copy, and at least one existing A/B source per factual observation. Validate stage/entry/edge references and reject any remote `assetId`.

- [ ] **Step 5: Run focused and full content tests**

Run: `pnpm vitest run src/content/validate.test.ts src/content/content.test.ts`

Expected: validation tests for broken fixtures pass; the real package remains red until Task 3 adds all 32 specs.

- [ ] **Step 6: Commit the contract slice after Task 3 makes the package green**

Do not commit a permanently failing main tree. Stage Task 1 together with Task 3 after the real content is complete:

```bash
git add src/content/types.ts src/content/validate.ts src/content/validate.test.ts src/content/content.json src/content/content.test.ts research/evidence-source-register.md
git commit -m "feat(dalisizian): define source-safe evidence visuals"
```

---

### Task 2: Persist and Sanitize Evidence Observation Progress

**Files:**

- Modify: `src/content/types.ts`
- Modify: `src/game/engine.ts`
- Modify: `src/game/engine.test.ts`
- Modify: `src/storage/storage.ts`
- Modify: `src/storage/storage.test.ts`

**Interfaces:**

- Produces: `CaseRuntimeState.evidenceObservationIdsByEvidenceId: Record<string, string[]>`.
- Produces: `markEvidenceObserved(state, evidenceId, observationId, index): CaseRuntimeState`.
- Consumes: valid evidence and observation IDs from `ContentIndex`.

- [ ] **Step 1: Write failing engine tests for immutable, idempotent observation updates**

```ts
it('marks a valid evidence observation once without changing story progress', () => {
  const state = createInitialCaseState(homeCase)
  const next = markEvidenceObserved(state, 'evidence-home-early-form', 'home-form-structure', contentIndex)
  expect(next.evidenceObservationIdsByEvidenceId).toEqual({
    'evidence-home-early-form': ['home-form-structure'],
  })
  expect(next.currentNodeId).toBe(state.currentNodeId)
  expect(markEvidenceObserved(next, 'evidence-home-early-form', 'home-form-structure', contentIndex)).toEqual(next)
})
```

- [ ] **Step 2: Run the engine test and verify it fails**

Run: `pnpm vitest run src/game/engine.test.ts`

Expected: FAIL because the state field and helper do not exist.

- [ ] **Step 3: Add the state field and pure engine helper**

Initialize the field to `{}` in `createInitialCaseState`. Return the original state for unknown evidence, evidence from another case, or unknown observation ID. Cap each list at the spec's observation-point count.

- [ ] **Step 4: Write failing restore tests for old, corrupt, duplicated, and oversized saves**

```ts
it('migrates old saves and sanitizes observation IDs', () => {
  const restored = restoreCaseProgress({
    ...validProgress,
    evidenceObservationIdsByEvidenceId: {
      'evidence-home-early-form': ['home-form-structure', 'bad-id', 'home-form-structure'],
      'evidence-other-case': ['foreign-point'],
    },
  }, homeCase, contentIndex)
  expect(restored.data.evidenceObservationIdsByEvidenceId).toEqual({
    'evidence-home-early-form': ['home-form-structure'],
  })
  expect(restoreCaseProgress(validProgressWithoutObservationMap, homeCase, contentIndex).data.evidenceObservationIdsByEvidenceId).toEqual({})
})
```

- [ ] **Step 5: Implement restore sanitization**

Only retain keys from `caseData.evidenceIds`; only retain observation IDs present in that evidence's `visualSpec`; deduplicate in source order; omit empty arrays. Keep schema version 1 because the new field is backward-compatible and safely defaulted.

- [ ] **Step 6: Run storage, engine, and media-safety tests**

Run: `pnpm vitest run src/game/engine.test.ts src/storage/storage.test.ts`

Expected: all tests pass, including existing Base64/Blob rejection.

- [ ] **Step 7: Commit**

```bash
git add src/content/types.ts src/game/engine.ts src/game/engine.test.ts src/storage/storage.ts src/storage/storage.test.ts
git commit -m "feat(dalisizian): persist evidence observations"
```

---

### Task 3: Author and Audit All 32 Evidence Visual Specs

**Files:**

- Create: `research/evidence-source-register.md`
- Modify: `src/content/content.json`
- Modify: `src/content/content.test.ts`

**Interfaces:**

- Produces: a complete `visualSpec` for every existing `Evidence` ID.
- Produces: a 32-row audit register with evidence ID, visual mode, factual claim, source IDs, resource nature, reviewer, review date, and status.
- Consumes: the unions and validation rules from Task 1.

- [ ] **Step 1: Add a failing 32/32 coverage test**

```ts
it('gives all 32 evidence records a distinct interactive visual', () => {
  expect(content.content.evidence).toHaveLength(32)
  expect(new Set(content.content.evidence.map((item) => item.assetId)).size).toBe(32)
  expect(new Set(content.content.evidence.map((item) => item.visualSpec.thumbnailLabel)).size).toBe(32)
  expect(new Set(content.content.evidence.map((item) => item.visualSpec.template)).size).toBe(4)
  for (const item of content.content.evidence) {
    expect(item.visualSpec.observationPoints.length).toBeGreaterThanOrEqual(2)
    expect(item.visualSpec.fallbackSummary.length).toBeGreaterThan(12)
  }
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm vitest run src/content/content.test.ts`

Expected: FAIL on missing `visualSpec`.

- [ ] **Step 3: Create the source register before drawing exact glyphs**

Use one row for every ID below. Set `resourceNature` to exactly one of `structure-diagram`, `database-rendering`, `rubbing`, `manual-tracing`, `product-typesetting`, or `product-diagram`. Exact ancient shapes may only use the middle three image-bearing modes after provenance and reviewer fields are filled; otherwise select `structure-diagram`.

Verify every new factual claim against the existing A/B record or an authoritative primary/official source before adding it. Record the direct source URL and access date in the register, but keep runtime behavior offline and package no remote dependency.

```text
evidence-home-early-form       evidence-home-shuowen          evidence-home-phonetic          evidence-home-social-leap
evidence-rest-components      evidence-rest-gloss             evidence-rest-method-limit      evidence-rest-modern-shape
evidence-take-form            evidence-take-rite              evidence-take-semantic-change   evidence-take-moral-fallacy
evidence-pick-form            evidence-pick-bian-distinction  evidence-pick-extensions        evidence-pick-leaf-story
evidence-watch-form           evidence-watch-gloss            evidence-watch-mirror-relation  evidence-watch-modern-story
evidence-martial-form         evidence-martial-shuowen        evidence-martial-foot           evidence-martial-value-origin
evidence-law-old-form         evidence-law-shuowen            evidence-law-simplification     evidence-law-water-fairness
evidence-autumn-variants      evidence-autumn-insect-fire     evidence-autumn-modern-form     evidence-autumn-debate
```

- [ ] **Step 4: Add the four `家` and four `休` specs**

Use exact observation themes: `宀／豕与声符边界`, `传统字书原文／现代解释`, `构件功能／社会史不可倒推`, `传闻成立处／越界处`; and `人木结构`, `息止传统解释`, `个例方法边界`, `现代楷形遮蔽`. Reuse each record's existing `sourceIds`; do not introduce factual wording without an A/B source.

- [ ] **Step 5: Add the four `取` and four `采` specs**

Use exact observation themes: `手耳构形`, `取耳制度语境`, `早期语境与后世义变`, `制度材料不等于永恒道德`; and `手取木上之物`, `釆与采分字`, `采与彩的关系层级`, `彩叶故事的拼接步骤`.

- [ ] **Step 6: Add the four `监` and four `武` specs**

Use exact observation themes: `人／器皿／俯视关系`, `監临下传统条`, `监与鉴的阶段关系`, `照镜单一起源的压缩`; and `止与戈构件`, `止戈传统解释`, `止的足部与行进义`, `价值阐释不能替代构形证据`.

- [ ] **Step 7: Add the four `法` and four `秋` specs**

Use exact observation themes: `灋旧形层次`, `传统字书与神兽叙述`, `灋到法的省变时序`, `水与公平故事的证据缺口`; and `秋字多种早形`, `虫火材料`, `现代禾火结构`, `竞争解释与保留争议`.

- [ ] **Step 8: Run validation and content tests until all 32 are green**

Run: `pnpm vitest run src/content/content.test.ts src/content/validate.test.ts`

Expected: all real content passes; each deliberately broken fixture returns the exact new code.

- [ ] **Step 9: Commit Task 1 and Task 3 together**

Use the Task 1 commit command after `git diff --check` succeeds.

---

### Task 4: Produce and Resolve 32 Local Evidence Plates

**Files:**

- Create: `src/evidence/assets.ts`
- Create: `src/evidence/assets.test.ts`
- Create: `public/assets/evidence/home/*.svg`
- Create: `public/assets/evidence/rest/*.svg`
- Create: `public/assets/evidence/take/*.svg`
- Create: `public/assets/evidence/pick/*.svg`
- Create: `public/assets/evidence/watch/*.svg`
- Create: `public/assets/evidence/martial/*.svg`
- Create: `public/assets/evidence/law/*.svg`
- Create: `public/assets/evidence/autumn/*.svg`

**Interfaces:**

- Produces: `resolveEvidenceAsset(assetId: string): string | undefined`.
- Produces: 32 SVGs at `./assets/evidence/<case-key>/<asset-id>-v1.svg`.
- Consumes: existing `Evidence.assetId`; contains no user-visible factual prose.

- [ ] **Step 1: Write the failing exhaustive resolver test**

```ts
it('resolves every evidence asset ID to a packaged SVG', () => {
  for (const evidence of content.content.evidence) {
    const path = resolveEvidenceAsset(evidence.assetId)
    expect(path).toMatch(/^\.\/assets\/evidence\/[a-z-]+\/[a-z0-9-]+-v1\.svg$/)
    expect(existsSync(resolve('public', path!.replace('./assets/', 'assets/')))).toBe(true)
  }
  expect(resolveEvidenceAsset('asset-evidence-unknown')).toBeUndefined()
})
```

- [ ] **Step 2: Run the resolver test and verify it fails**

Run: `pnpm vitest run src/evidence/assets.test.ts`

Expected: FAIL because resolver and files do not exist.

- [ ] **Step 3: Implement an explicit, exhaustive map**

Do not infer paths from arbitrary content strings. Export a frozen `Record<string, string>` with exactly 32 known IDs and a lookup function. Use `./assets/...` paths so the ZIP works without an HTTP origin.

- [ ] **Step 4: Create four reusable plate grammars, then export a distinct SVG per record**

Use `viewBox="0 0 720 480"`, no scripts, no external URLs, and no embedded raster/Base64. The SVG plate may include paper, borders, empty annotation targets, abstract case motifs, and non-factual decorative seals. Evidence labels, claims, exact glyph stages, and source copy remain HTML driven from `content.json`.

Required visible distinctions:

- glyph plates: stage rails and 3–4 empty mounted specimens;
- lexicon plates: folded scroll, ruled entry blocks, and a朱框 target;
- semantic plates: node medallions and relationship tracks;
- myth plates: two layered slips and a broken朱批 line.

Within each type, vary the case motif and plate composition so hashes and silhouettes are distinct, not filename-only duplicates.

- [ ] **Step 5: Add a duplicate-content guard**

In `assets.test.ts`, hash all 32 SVG byte strings and assert `new Set(hashes).size === 32`. Also reject `<script`, `http://`, `https://`, `data:`, and text nodes matching the case claims.

- [ ] **Step 6: Run resolver and content tests**

Run: `pnpm vitest run src/evidence/assets.test.ts src/content/content.test.ts`

Expected: 32 assets resolve, exist, are unique, and contain no forbidden payload.

- [ ] **Step 7: Commit**

```bash
git add src/evidence/assets.ts src/evidence/assets.test.ts public/assets/evidence
git commit -m "feat(dalisizian): add thirty-two evidence plates"
```

---

### Task 5: Build Pure Artifact Models and Progress Semantics

**Files:**

- Create: `src/evidence/model.ts`
- Create: `src/evidence/model.test.ts`
- Modify: `src/app/viewModel.ts`
- Modify: `src/app/viewModel.test.ts`

**Interfaces:**

- Produces: `createEvidenceArtifactModel(evidence, observedIds, sources): EvidenceArtifactModel`.
- Produces: `getEvidenceProgress(evidence, observedIds): { observed: number; total: number; complete: boolean }`.
- Produces: `getAcquiredEvidenceItems(node, caseState, index): Evidence[]`.
- Produces: `getDeductionEvidenceItems(deduction, caseState, index): Array<{ evidence: Evidence; acquired: boolean }>`.

- [ ] **Step 1: Write failing model tests for all four templates**

```ts
it.each(['glyph-timeline', 'lexicon-scroll', 'semantic-map', 'myth-verdict'] as const)(
  'creates a traceable %s artifact model',
  (template) => {
    const evidence = content.content.evidence.find((item) => item.visualSpec.template === template)!
    const model = createEvidenceArtifactModel(evidence, [], content.sources)
    expect(model.template).toBe(template)
    expect(model.assetPath).toBe(resolveEvidenceAsset(evidence.assetId))
    expect(model.progress).toEqual({ observed: 0, total: evidence.visualSpec.observationPoints.length, complete: false })
    expect(model.sources.every((source) => source.type !== 'F')).toBe(true)
  },
)
```

- [ ] **Step 2: Run the model tests and verify they fail**

Run: `pnpm vitest run src/evidence/model.test.ts src/app/viewModel.test.ts`

Expected: FAIL because the model functions do not exist.

- [ ] **Step 3: Implement small pure helpers**

Normalize observed IDs by `visualSpec.observationPoints` order, derive completion without mutating evidence, and return a semantic fallback even when `resolveEvidenceAsset` returns `undefined`. Do not put React nodes or DOM state in the model.

- [ ] **Step 4: Implement acquired and deduction selectors**

`getAcquiredEvidenceItems` must use `node.acquireEvidenceIds`, filter by the case state's acquired IDs, and preserve node order. Deduction items preserve `focusEvidenceIds` order and mark unacquired items without granting them.

- [ ] **Step 5: Run focused tests**

Run: `pnpm vitest run src/evidence/model.test.ts src/app/viewModel.test.ts`

Expected: all model and existing view-model tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/evidence/model.ts src/evidence/model.test.ts src/app/viewModel.ts src/app/viewModel.test.ts
git commit -m "feat(dalisizian): derive evidence artifact models"
```

---

### Task 6: Render the Four Interactive Evidence Templates

**Files:**

- Create: `src/evidence/EvidenceArtifact.tsx`
- Create: `src/evidence/EvidenceThumbnail.tsx`
- Create: `src/evidence/GlyphTimelineArtifact.tsx`
- Create: `src/evidence/LexiconScrollArtifact.tsx`
- Create: `src/evidence/SemanticMapArtifact.tsx`
- Create: `src/evidence/MythVerdictArtifact.tsx`
- Create: `src/evidence/components.test.tsx`
- Create: `src/evidence/evidence.css`

**Interfaces:**

- Produces: `<EvidenceArtifact evidence sources observedIds onObserve reducedMotion />`.
- Produces: `<EvidenceThumbnail evidence observedIds />`.
- Consumes: Task 5 models and Task 4 asset resolver.

- [ ] **Step 1: Write server-render smoke tests**

Use `renderToStaticMarkup` from `react-dom/server` without adding a test dependency:

```tsx
it.each(content.content.evidence)('renders $id without a placeholder', (evidence) => {
  const html = renderToStaticMarkup(
    <EvidenceArtifact evidence={evidence} sources={content.sources} observedIds={[]} onObserve={() => {}} reducedMotion />,
  )
  expect(html).toContain(`data-evidence-id="${evidence.id}"`)
  expect(html).toContain(`data-template="${evidence.visualSpec.template}"`)
  expect(html).not.toContain('人工核验资源位')
})
```

- [ ] **Step 2: Run the component test and verify it fails**

Run: `pnpm vitest run src/evidence/components.test.tsx`

Expected: FAIL because components do not exist.

- [ ] **Step 3: Implement the shared shell and thumbnail**

The shell renders the local plate image as decorative art, template content above it, progress text, source affordance, and per-evidence fallback. The thumbnail renders the same plate, template badge, unique `thumbnailLabel`, and progress seal; it never contains an independent copy of evidence text.

- [ ] **Step 4: Implement `GlyphTimelineArtifact`**

Use button tabs for stages. Selecting a stage reveals period, material kind, certainty, and source count, then calls `onObserve` for the observation point anchored to that stage. Do not render an exact glyph unless the stage contains an approved local `assetId`; otherwise render labelled component zones over the structure plate.

- [ ] **Step 5: Implement `LexiconScrollArtifact`**

Render entries as buttons controlling an expanded definition region. Separate `originalText` and `interpretation` with explicit labels. Clicking the highlighted term marks its related observation.

- [ ] **Step 6: Implement `SemanticMapArtifact`**

Render nodes and edges as ordered buttons, not a mouse-only canvas. Selecting a node or edge reveals its detail, strength label, and source count; blocked edges use a visible断线 icon plus text.

- [ ] **Step 7: Implement `MythVerdictArtifact`**

Start with `claim`; reveal `supports`, then `limits`, then `disputes`. Each reveal uses a button and marks the associated observation. The final state shows all three evidence boundaries without presenting the official verdict answer.

- [ ] **Step 8: Add responsive and reduced-motion CSS**

Import `evidence.css` once from `EvidenceArtifact.tsx`. Use no fixed 375px widths. All buttons are at least 44px; primary buttons are 48px. At `prefers-reduced-motion: reduce`, remove paper translation, line drawing, and stamp bounce.

- [ ] **Step 9: Run component and model tests**

Run: `pnpm vitest run src/evidence/components.test.tsx src/evidence/model.test.ts`

Expected: all 32 render, all four templates appear, and no generic placeholder string remains.

- [ ] **Step 10: Commit**

```bash
git add src/evidence
git commit -m "feat(dalisizian): render interactive evidence artifacts"
```

---

### Task 7: Integrate Evidence into Acquisition, Inspection, Deduction, and Ledger

**Files:**

- Modify: `src/App.tsx`
- Modify: `src/App.css`
- Modify: `src/app/viewModel.ts`
- Modify: `src/app/viewModel.test.ts`

**Interfaces:**

- Consumes: `EvidenceArtifact`, `EvidenceThumbnail`, `markEvidenceObserved`, `getAcquiredEvidenceItems`, and `getDeductionEvidenceItems`.
- Produces: a reusable `openEvidence(evidenceId, returnContext)` path and exact context restoration.

- [ ] **Step 1: Add failing view-model tests for acquired evidence and deduction order**

Assert that the first `家` clue node exposes only its newly acquired evidence, and that each deduction tray preserves `focusEvidenceIds` order while marking missing evidence `acquired: false`.

- [ ] **Step 2: Run the view-model test and verify it fails**

Run: `pnpm vitest run src/app/viewModel.test.ts`

Expected: FAIL on missing selectors or wrong order.

- [ ] **Step 3: Replace the evidence-detail placeholder with `EvidenceArtifact`**

Pass the selected evidence, non-fiction source records, current observed IDs, `save.settings.reducedMotion`, and a callback that applies `markEvidenceObserved`. Preserve the existing source details below the artifact.

- [ ] **Step 4: Add precise evidence return context**

Store `{ screen, nodeId, evidenceId? }` before opening inspection. Closing returns to the exact ledger, investigation node, or deduction node. It must not call `enterNode` again, clear feedback, or resubmit a choice.

- [ ] **Step 5: Add acquisition previews**

For clue nodes with `acquireEvidenceIds`, render an `EvidenceThumbnail` above choices with “立即核验” and “收入证据簿”. The animation runs once per node entry and becomes immediate under reduced motion.

- [ ] **Step 6: Upgrade the evidence ledger**

Replace type-only list buttons with thumbnails, type, title, and `已核 X/Y`. Apply the “已核” seal only when all required observation points are marked.

- [ ] **Step 7: Make the deduction tray interactive**

Replace plain `<span>` items in `.focus-evidence` with buttons. Acquired evidence opens the inspector; unacquired evidence remains disabled and says `待核`. Returning preserves the current deduction and any feedback.

- [ ] **Step 8: Remove obsolete placeholder CSS and add integration layout**

Delete `.artifact-placeholder` rules only after no production JSX references them. Keep the detail sheet and boundary copy, now backed by the evidence-specific `fallbackSummary` and source data.

- [ ] **Step 9: Run all unit tests**

Run: `pnpm test`

Expected: all existing and new unit tests pass; no story, storage, collection, or playthrough regression.

- [ ] **Step 10: Commit**

```bash
git add src/App.tsx src/App.css src/app/viewModel.ts src/app/viewModel.test.ts
git commit -m "feat(dalisizian): surface evidence throughout investigations"
```

---

### Task 8: Lock Accessibility, Safe Areas, and Full Browser Flows

**Files:**

- Create: `qa/evidence-browser.mjs`
- Modify: `src/App.tsx`
- Modify: `src/evidence/evidence.css`
- Modify: `VISUAL-QA.md`

**Interfaces:**

- Produces: a deterministic browser QA command using the existing CDP harness pattern.
- Consumes: a running preview URL through `DALISIZIAN_URL` and Chrome CDP through `DALISIZIAN_CDP`.

- [ ] **Step 1: Write the browser QA script before final CSS tuning**

The script must seed a valid `家` case save, open the first case, acquire a证物, open it immediately, mark every observation, return to the same node, open it from the ledger, and open it again from a deduction tray.

For each viewport/safe-area pair, assert:

```js
const cases = [
  { width: 375, height: 667, safeTop: 47 },
  { width: 390, height: 844, safeTop: 24 },
  { width: 430, height: 932, safeTop: 47 },
]

if (document.documentElement.scrollWidth > innerWidth) throw new Error('horizontal overflow')
if (document.querySelector('.evidence-screen .page-header').getBoundingClientRect().top < safeTop) throw new Error('header under status bar')
if ([...document.querySelectorAll('.evidence-artifact button')].some((button) => button.getBoundingClientRect().height < 44)) throw new Error('small target')
if ([...document.images].some((image) => image.getClientRects().length && image.naturalWidth === 0)) throw new Error('broken image')
if (document.body.textContent.includes('人工核验资源位')) throw new Error('placeholder remains')
```

- [ ] **Step 2: Run the browser script and record the initial failures**

Run preview on a fixed local port, attach Chrome/CDP, then run:

```bash
DALISIZIAN_URL=http://127.0.0.1:5177/ DALISIZIAN_CDP=http://127.0.0.1:9222 node qa/evidence-browser.mjs
```

Expected before tuning: at least one explicit layout, focus, or flow assertion fails.

- [ ] **Step 3: Add dialog focus management and keyboard behavior**

When the inspector is modal, focus the first artifact control; trap Tab inside; Escape returns to the exact trigger; restore focus on close. Do not trap focus when the inspector is a full page reached from the ledger.

- [ ] **Step 4: Apply nonzero safe-area rules**

Every fixed acquisition preview, evidence modal header, close button, and scroll target must include `var(--safe-area-inset-top, env(safe-area-inset-top, 0px))`. Add `scroll-margin-top` to evidence observation anchors so programmatic focus does not hide them beneath the native navigation.

- [ ] **Step 5: Verify reduced motion**

Emulate `prefers-reduced-motion: reduce`; assert computed animation names are `none` on acquisition drawer, artifact plate, stage indicator, ink line, and seal.

- [ ] **Step 6: Verify all 32 records render without broken resources**

Use a QA-only loop driven from `content.json`: seed each evidence ID as acquired, navigate to its detail, assert matching `data-evidence-id`, matching `data-template`, at least two observation buttons, no generic placeholder, no console warning/error, and no broken image.

- [ ] **Step 7: Rerun the original collection browser QA**

Run `qa/collection-browser.mjs` after the evidence script. Expected: collection, story, share card, full `家` playthrough, capture, print, and console checks remain green.

- [ ] **Step 8: Update `VISUAL-QA.md` with evidence**

Record exact viewport, safe top, screenshot names, observation counts, broken-image count, console count, and reduced-motion result. Do not write “pass” without the corresponding command output.

- [ ] **Step 9: Commit**

```bash
git add qa/evidence-browser.mjs src/App.tsx src/evidence/evidence.css VISUAL-QA.md
git commit -m "test(dalisizian): verify evidence flows on mobile"
```

---

### Task 9: Final Documentation, Offline Build, and Overwritten Release Package

**Files:**

- Modify: `README.md`
- Modify: `TODO.md`
- Modify: `release-assets/大理寺字案录-小工具包-20260826.zip`

**Interfaces:**

- Consumes: the completed source tree and current `dist`.
- Produces: one upload-ready, unversioned ZIP whose contents exactly match `dist`.

- [ ] **Step 1: Update user-facing project documentation**

Document the four evidence interactions, 32/32 completion, observation progress behavior, source boundaries, storage shape, and browser QA command. Mark the evidence placeholder item complete in `TODO.md`; do not claim unrelated art or content is complete.

- [ ] **Step 2: Run the mandatory project gate**

Run:

```bash
pnpm lint && pnpm test && pnpm build
```

Expected: lint exits 0, all test files and tests pass with zero failures, TypeScript exits 0, and Vite produces `dist/index.html` plus local assets.

- [ ] **Step 3: Perform static package compliance scans**

Verify root `index.html`, classic external script, relative assets, no external runtime references, no forbidden API calls, no `*.map`, and supported file types only. Confirm the production code contains no `人工核验资源位`.

- [ ] **Step 4: Overwrite the original ZIP atomically**

Create a temporary ZIP from the contents of `dist`, verify it, then move it over:

```text
release-assets/大理寺字案录-小工具包-20260826.zip
```

Do not create any `-v4`, `-v5`, or later-numbered sibling.

- [ ] **Step 5: Verify archive parity and size**

Assert exactly one root `index.html`, supported file extensions only, successful `unzip -t`, SHA-256 equality between every ZIP member and its `dist` source, and total ZIP size below 10MB.

- [ ] **Step 6: Inspect the final diff and status**

Run:

```bash
git diff --check -- projects/03-dalisizian
git status --short -- projects/03-dalisizian
```

Confirm no files outside `projects/03-dalisizian` are staged.

- [ ] **Step 7: Commit the release update**

```bash
git add projects/03-dalisizian/README.md projects/03-dalisizian/TODO.md projects/03-dalisizian/release-assets/大理寺字案录-小工具包-20260826.zip
git commit -m "build(dalisizian): ship interactive evidence archive"
```

- [ ] **Step 8: Report evidence, not estimates**

Report the final commit IDs, exact test count, three viewport/safe-area results, ZIP byte size, ZIP SHA-256, and any remaining explicitly out-of-scope item. Do not push unless the user separately authorizes the remote operation.
