# Later ecology performance baseline

**The calibrated content snapshot in the last section is the final acceptance measurement.** It supersedes the earlier `final` tag. Earlier sections preserve the baseline, intermediate result, diagnostic attribution, and the reasons for the targeted changes.

Run from any working directory while the project preview serves the current assets at http://127.0.0.1:4110:

```powershell
node projects/09-proto-cell/design/late-2026-10-18/performance.cjs after-integration
```

The harness compiles source in memory through installed Vite, runs installed desktop Chrome headless at 390×844 CSS px and DPR2, and saves eight samples plus a Chrome CPU profile. It creates no production bundle or source changes. Each sample has 30 warm frames and 180 measured frames, one fixed 60Hz simulation step per animation frame, with 1× or 4× CDP CPU throttling. Fixed steps isolate update cost; this is not a complete GameCanvas catch-up/React/input benchmark. This desktop emulation does not validate physical mobile GPU behavior or Xiaohongshu host performance.

Tier1/2 fixtures begin at 18 seconds with .65 pressure. A narrowly scoped Vite transform enables journey mode when seeding these later-tier states directly and exposes a population initialization helper; simulation and rendering algorithms remain the actual source. The ordinary fixture is idle and survives. The dense stress adds 179 actors from real environment definitions across the world (187–191 actors retained in this first sample), then draws a separate renderer-only layout with 180 all-visible actors. It intentionally exceeds ordinary ecology density and must not be described as observed production gameplay or evidence that production exceeds its population cap.

The first baseline source was bundled once before all eight cases; other agents edited sources during the measurements. `sourceHashesAtCompletion` in that first JSON is therefore **not** a hash of its measured source snapshot. Future runs record hashes at build start plus the exact bundle SHA256. Rerun both before/after from stable source to compare small changes. A single sample establishes scale, not a statistically reliable small improvement.

| Fixture | CPU throttle | Simulation mean | Render mean / p95 | Frame gap p95 |
| --- | --- | --- | --- | --- |
| Tier1, ordinary 11 actors | 1× | .36ms | 1.01 / 1.40ms | 8.4ms |
| Tier2, ordinary 12–18 actors | 1× | .37ms | 1.46 / 2.30ms | 8.4ms |
| Tier1, ordinary 11 actors | 4× | 1.25ms | 5.61 / 7.60ms | 12.6ms |
| Tier2, ordinary 12–18 actors | 4× | 1.70ms | 8.93 / 13.10ms | 16.8ms |
| Tier1, synthetic dense | 1× | 2.51ms | 14.06 / 17.90ms | 45.8ms |
| Tier2, synthetic dense | 1× | 2.96ms | 12.72 / 16.00ms | 41.8ms |
| Tier1, synthetic dense | 4× | 14.66ms | 90.21 / 127.70ms | 158.7ms |
| Tier2, synthetic dense | 4× | 20.93ms | 111.84 / 165.90ms | 208.8ms |

Ordinary later-tier frame work is within a 16.7ms CPU budget in this fixture. In the dense4× fixture, rendering consumes about85% of update+render CPU time. Candidates to measure separately are fewer expensive detail/blur/gradient passes for small NPCs or dense crowds, while preserving bodies, species recognition, threat/edibility cues, and player detail. Existing viewport/sight culling already avoids offscreen body draws. Broad AI rewrites, general caching, or DOM changes are unsupported by this baseline. CPU profile names are minified; do not assert a specific function hotspot from this profile without source mapping.

First-baseline long-task counts include initialization and warmup, so they cannot support measured-interval startup-free claims. The rerunnable harness now observes long tasks only after warmup. First-baseline dense4× cases had210 long tasks including warmup; ordinary4× cases had2 including initialization. All eight samples ended with an active player at21.5s, and no page errors were reported.

Independent chamber geometry review confirmed the original bug: coordinates were scaled against640×1100 although endpoints reached x1420,y1520; stepping then replaced every wall Y with the same unscaled520+sin(t*.7)*105. Root owns the production fix. Normalized construction, separate per-wall anchors, bounded drift, and a shared section definition for rendering and collision are the narrow fixes to verify.

## After integration — 2026-10-18 14:53–14:54 CST

The same eight-case minified fixture was rerun with stable source. Build began06:53:36UTC and all cases completed06:54:17UTC. Source hashes and the exact in-memory bundle hash are in `performance-after-integration.json`. The source changes include late ecology/art and renderer detail budgeting, so these deltas describe the integrated result and do not isolate one edit. One sample per case still cannot establish small differences reliably.

| Fixture | CPU | Simulation mean | Render mean / p95 | Frame gap p95 | Measured long tasks |
| --- | --- | --- | --- | --- | --- |
| Tier1 ordinary | 1× | .52ms | 1.64 / 2.40ms | 8.4ms | 0 |
| Tier2 ordinary | 1× | .46ms | .95 / 1.30ms | 8.4ms | 0 |
| Tier1 ordinary | 4× | 1.41ms | 4.90 / 6.60ms | 12.5ms | 0 |
| Tier2 ordinary | 4× | 2.43ms | 6.89 / 9.60ms | 16.6ms | 0 |
| Tier1 synthetic dense | 1× | 2.72ms | 7.44 / 10.40ms | 20.9ms | 0 |
| Tier2 synthetic dense | 1× | 2.59ms | 4.77 / 6.10ms | 12.6ms | 0 |
| Tier1 synthetic dense | 4× | 14.64ms | 37.76 / 50.40ms | 75.1ms | 136, maximum90ms |
| Tier2 synthetic dense | 4× | 18.90ms | 34.27 / 43.20ms | 71.0ms | 147, maximum81ms |

Ordinary later tiers remain within the CPU budget in this desktop fixture. The severe synthetic dense4× render mean falls58% in tier1 and69% in tier2; frame-gap p95 falls53% and66%. Dense4× combined update+render mean still exceeds52ms, so this is an improvement with a documented stress limitation, not a claim of smooth population-cap play on phones. All cases retained an active player, ordinary/dense population counts match the baseline, and no page errors occurred. Frame gap uses the desktop display scheduling cadence, which can exceed60Hz; do not convert these measurements directly into phone FPS.

One extra unminified diagnostic, saved as `profile-after-integration-named.json` plus `profile-summary-after-integration.json`, makes function names readable. Run it using:

```powershell
node projects/09-proto-cell/design/late-2026-10-18/performance.cjs after-integration-named profile
```

This diagnostic covers only tier2 dense4× and includes initialization plus30 warm/180 measured frames in its CPU sample totals. It is for attribution, not direct minified before/after comparison. Render mean34.62ms and update mean19.52ms are close to the minified stress case. Inclusive samples overlap and must not be added:

- `drawCell`: ~2814ms,39% of sampled renderer time.
- `drawRelationshipCue`: ~1948ms,27%; its body-point work contributes ~1220ms.
- `geometricRelationship`: ~1506ms,21%; this computes authoritative fit and should preserve correctness.
- `drawBehaviorStateCue`: ~142ms,2%; danger telegraph receives no meaningful samples here.
- `cellToneBands`: ~255ms. It runs before the simplified branch despite its result being unused there.
- `SpatialGrid.query`: ~2579ms, about63% of sampled simulation time, mostly under `movementDecision`.

Scope-contained next experiments: apply the existing simplified/detail decision to relationship outline resolution, using12–16 body samples instead of49 for those NPCs while keeping cue color/dashes and critical entities intact; move `cellToneBands` below the simplified early return. Neither change has been implemented by this QA pass. Measure separately before keeping them. The remaining grid-query cost means cue detail alone cannot guarantee60fps at this intentionally severe density. A separate measured experiment with a tier-appropriate grid cell size could address query-cell walking, but is outside this review's proposed immediate patch.

## Earlier final-tag verification after cue detail and palette-work changes (superseded by calibrated)

Root applied16 outline segments to simplified NPC relationship cues (48 retained for full-detail cues), moved palette tone-band work after the simplified early return, and corrected the protected encounter's relationship cue. The same eight-case minified source fixture was then rerun with tag `final`; source hashes, bundle hash, exact timestamps, and complete distributions are saved in `performance-final.json`. No production source was modified by the performance agent.

| Fixture | CPU | Simulation mean | Render mean / p95 | Frame gap p95 |
| --- | --- | --- | --- | --- |
| Tier1 ordinary,11 actors | 1× | .36ms | .70 / 1.00ms | 4.3ms |
| Tier2 ordinary,12–18 actors | 1× | .68ms | 1.57 / 2.20ms | 8.4ms |
| Tier1 ordinary,11 actors | 4× | 1.34ms | 4.60 / 6.70ms | 12.5ms |
| Tier2 ordinary,12–18 actors | 4× | 2.23ms | 6.19 / 9.70ms | 16.8ms |
| Tier1 synthetic dense | 1× | 1.89ms | 4.15 / 5.30ms | 12.6ms |
| Tier2 synthetic dense | 1× | 2.49ms | 3.91 / 5.80ms | 12.6ms |
| Tier1 synthetic dense | 4× | 14.26ms | 31.39 / 45.10ms | 70.9ms |
| Tier2 synthetic dense | 4× | 17.00ms | 26.30 / 32.70ms | 58.4ms |

Compared with the intermediate integrated bundle, dense4× render means decrease a further17%/23%; compared with the original baseline they decrease65%/76%. This single-run comparison also shows simulation and ordinary-render variability even where the new code should have little impact, so the percentages describe the observed bundle-level samples rather than exact isolated savings from either edit. The final result supports keeping the targeted simplification; it is not evidence for further unmeasured cleanup.

Ordinary later-tier fixtures remain within the16.7ms CPU budget under4× desktop CPU throttling. Severe synthetic density retains187–191 simulated actors and180 all-visible renderer actors; combined mean update+render remains45.65ms/43.30ms under4× throttle. It still has long tasks and misses a60fps budget in this intentionally heavy scenario. Mobile GPU capability, real active-play catch-up behavior, React/HUD updates, and Xiaohongshu host behavior remain outside this source-fixture measurement. Do not label it physical-mobile or host validation.

All eight final cases ended with an active player and no page errors. Runtime source was bundled once before measurements and held fixed in memory; the final CPU profile is `profile-final.json`. The rerunnable benchmark remains unchanged in behavior from the eight-case after-integration run; the separate `profile` CLI option only enables a single unminified diagnostic.


## Calibrated content — final acceptance snapshot

An independent gameplay review found the new hunters too small to threaten entry-stage players. Root corrected seam-lurker size range to49–53 (center51 against entry-player40), razor-ray to102–114 (center108 against entry-player88), and separately verified their prepare/strike/recover and mature-player flee behavior. This performance pass reruns the same eight cases against that corrected content; it does not independently establish those gameplay behaviors. The fixture still begins at .65 pressure, so it measures later-stage performance rather than the entry-player threat test.

Build started 2026-10-18T06:59:03.341Z and measurements completed 2026-10-18T06:59:45.669Z. `performance-calibrated.json` records source hashes, the exact bundle hash, every distribution, actor counts, and errors; `profile-calibrated.json` records the last stress case. This snapshot supersedes the earlier `final` tag.

| Fixture | CPU | Simulation mean | Render mean / p95 | Frame gap p95 | Long tasks |
| --- | --- | --- | --- | --- | --- |
| Tier1 ordinary | 1× | 0.37ms | 1.02 / 1.50ms | 12.4ms | 0, max0ms |
| Tier1 synthetic dense | 1× | 2.31ms | 5.19 / 7.80ms | 20.8ms | 0, max0ms |
| Tier2 ordinary | 1× | 0.58ms | 1.18 / 1.90ms | 8.4ms | 0, max0ms |
| Tier2 synthetic dense | 1× | 2.77ms | 4.23 / 5.40ms | 12.6ms | 0, max0ms |
| Tier1 ordinary | 4× | 1.38ms | 4.41 / 6.70ms | 12.5ms | 0, max0ms |
| Tier1 synthetic dense | 4× | 16.84ms | 38.81 / 53.70ms | 79.4ms | 151, max106ms |
| Tier2 ordinary | 4× | 2.24ms | 5.98 / 8.30ms | 12.6ms | 0, max0ms |
| Tier2 synthetic dense | 4× | 21.96ms | 32.92 / 44.60ms | 79.3ms | 171, max88ms |

Ordinary calibrated later tiers have zero measured long tasks and no page errors, retaining11 /12–18 actors. Ordinary4× combined mean update+render is5.79ms /8.22ms. All eight cases end with an active player; severe synthetic actors remain187–191 plus180 all-visible render clones.

Compared with the original baseline, calibrated dense4× render mean is57% /71% lower. It is higher than the immediately preceding final-tag sample (38.81 vs31.39ms and32.92 vs26.30ms), alongside higher simulation times. These are single samples with desktop load/JIT/GPU variability and changed content, so they do not isolate an exact effect of hunter sizing or support a claim that the calibration caused the increase. Reporting the latest result avoids selecting the most favorable run.

**Severe synthetic-density limitation remains:** calibrated4× combined mean CPU work is55.65ms /54.88ms, with frame-gap p95 at79.4ms /79.3ms. This fixture does not meet a60fps budget at that intentionally severe load. Retained actor counts and code paths are documented; no performance result was obtained by reducing the fixture population. Physical mobile GPU, full active-play catch-up/React/HUD behavior, and Xiaohongshu host validation remain unverified by this desktop source fixture. No additional production optimization is proposed without a separate measured experiment.
