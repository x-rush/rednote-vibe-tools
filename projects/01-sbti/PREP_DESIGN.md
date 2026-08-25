# SHBTI Foundation Design

## Goal

Prepare a complete, deterministic, local-only foundation for SHBTI 山海兽格: validated launch content, pure quiz logic, recoverable state and storage, a semantic React shell, and automated verification. Final visual design and assets remain out of scope.

## Boundaries

- Only `projects/01-sbti/**` may change.
- The app is a static React + TypeScript + Vite build with no backend, runtime API, remote font, user upload, Service Worker, or new dependency.
- All business copy and mappings live in `src/content/content.json`.
- User persistence contains stable IDs, scores, settings, and bounded results only; it never contains media or a copy of the content package.
- The result describes behavioral tendencies for entertainment and never claims psychological or medical validity.

## Content package

The runtime package follows the newer common contract used by docs/31 and the existing scaffold:

```text
schemaVersion, contentVersion, projectId, meta, sources, content
```

`content` contains experience copy, four dimensions, four chapters, all 48 questions, 16 mapped creatures, 16 result types, and four tie-breaker references. Questions use semantic stable IDs and semantic option IDs; display order remains a separate number. Option scoring explicitly names a legal pole and weight, so position never implies meaning.

The 16 mappings remain exactly as frozen in docs/15 and docs/30. Classical facts and product interpretation stay in separate fields. Asset IDs are stable future references, not paths to missing files.

## Validation

The content validator accepts unknown input and returns a fully typed `ShbtiContentPackage` or throws `ContentValidationError` containing JSON paths. It checks the envelope, exact production counts, allowed IDs and enums, uniqueness, chapter/dimension cell coverage, two valid options per question, symmetric scoring, tie-breaker references, complete 16-code coverage, one unique creature per type, asset ID shape, required result/share copy, source references, and dangling neighbor references.

Validation runs during application startup and directly in content tests. Production errors render a recoverable error screen; development errors retain readable paths without silently repairing the package.

## Quiz logic

A seeded PRNG and deterministic selection function create a 24-question run. Selection always includes one frozen tie-breaker question per dimension, produces six questions per chapter and dimension, avoids adjacent equal primary dimensions, and limits repeated scene tags. The saved question ID order is reused after refresh.

Answers are keyed by question ID. Recording an answer replaces the prior option rather than accumulating score. Scoring always recomputes from the answer map and selected question IDs. Each pole score is explicit, while the display strength is normalized by maximum answered points:

```text
strength = abs(leftScore - rightScore) / (leftScore + rightScore)
```

An exact tie is resolved by that dimension's frozen tie-breaker question. Since all four tie-breakers are guaranteed into each run, resolution is deterministic and never needs time, `Math.random`, or an arbitrary global fallback.

The selected poles form one of the 16 codes. The result includes the mapped beast, normalized dimension summaries, the weakest-dimension neighbor, and a complete share-card view model. Formal result generation rejects incomplete or invalid answer sets.

## State model

A pure reducer represents `landing`, `intro`, `quiz`, `calculating`, `result`, `history`, and `error`. It handles starting, continuing, moving back, replacing an answer, refusing incomplete submission, completing calculation, opening the bounded recent result, returning home, restarting with an explicit seed, and resetting after invalid data.

React is limited to orchestration and rendering view models. Scoring and persistence are never embedded in click handlers.

## Storage

The adapter owns `xhs-tool:shbti:state:v1`. Its envelope contains `schemaVersion: 1`, `quizVersion`, and a bounded data object with the active run, at most one recent result, and settings. Loading performs parse, schema/version, field, and current-content reference checks. Corrupt JSON, missing fields, future versions, stale question/option IDs, and invalid results return a typed recovery outcome and safely remove only this project's key when requested.

## Semantic UI shell

Page components cover landing, intro, quiz/progress/options, calculating, result/result details/share structure, recent-result history/empty state, and error recovery. Controls use semantic buttons, accessible labels, focusable native elements, and minimum mobile touch targets. CSS is deliberately neutral structural styling with no final brand palette, illustration, gradient, glass treatment, network font, or decorative asset.

## Testing and verification

Tests cover content counts and references, deterministic selection and scoring, tie resolution, answer replacement, invalid/incomplete input rejection, all 16 types, three full end-to-end answer simulations, repeatability, reducer transitions, storage corruption/version recovery, and share view-model completeness.

Final verification runs only in this project: `pnpm lint`, `pnpm test`, and `pnpm build`. Browser checks at 375, 390, and 430 CSS px verify no horizontal overflow and usable main controls. A read-only Git diff check confirms every changed file is inside `projects/01-sbti/**`.

## Resolved documentation conflicts

- Envelope and key naming use docs/31 because it is newer and matches the scaffold; the discrepancy with docs/11 is reported.
- Preference strength uses maximum possible scored points instead of raw question count, because each answer awards `+2`; this makes docs/30 thresholds meaningful.
- Tie-breakers are guaranteed in every run, reconciling docs/13's deterministic requirement with docs/30's frozen tie-breaker IDs while preserving a single formal 16-type result.
- The shared asset manifest freezes counts but not individual IDs; this foundation defines stable IDs and reports the exact future Windows asset handoff.
