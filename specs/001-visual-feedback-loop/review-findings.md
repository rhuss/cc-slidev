# Deep Review Findings

**Date:** 2026-11-05
**Branch:** 001-visual-feedback-loop
**Rounds:** 2
**Gate Outcome:** PASS
**Invocation:** quality-gate (ship pipeline, oversight smart)

## Summary

| Severity | Found | Fixed | Remaining |
|----------|-------|-------|-----------|
| Critical | 0 | 0 | 0 |
| Important | 16 | 16 | 0 |
| Minor | 30 | 8 | 22 |
| Notable | 5 | - | 5 |
| **Total** | **51** | **24** | **27** |

**Agents completed:** 5/5 internal agents (goal alignment skipped: no PR), plus CodeRabbit (3 runs) and Codex. Copilot was disabled in config.
**Agents failed:** none. The first CodeRabbit and Codex attempts failed on the `origin/main` merge base (no common history with this worktree). They were re-run against the local merge base f6436b6 and completed.

Fix commits: 9ac92e8 (round 1), 5319243 (round 2).

## Findings

### FINDING-1 (security, Important, fixed round 1)
- **File:** slidev/commands/balance.md (decision recording, manage-slides `--title`, `download-image.sh` URL, yq route/model)
- **Source:** security agent, confidence 80
- **What is wrong:** The shell templates put free text into double-quoted or unquoted command arguments: slide titles, verdict reasons, URLs and model names. Bash expands backticks and `$(...)` inside double quotes.
- **Why it matters:** Some decks put inline code in titles (``# The `kubectl apply` trick``). If the orchestrating LLM fills the template literally, it runs that code. A cloned deck could do the same on purpose.
- **Resolution:** A new Conventions rule says that free text is always written to `<RUN>/tmp/` with the Write tool and read back with `--rawfile`, `--slurpfile` or `"$(cat file)"`. Every affected template now follows that rule. A review run confirmed that the jq snippets accept quotes, backticks and `$(...)` without expanding them.

### FINDING-2 (security, Important, fixed round 1)
- **File:** slidev/commands/balance.md 9.3 (pending-image entry)
- **Source:** security agent, confidence 80
- **What is wrong:** The template ran `jq --argjson e '<entry>'` with a hand-built JSON object inside single quotes. A title like "What's next" ends the quoted string early.
- **Why it matters:** That breaks the command, or runs the rest of the title as shell code. It also loses the FR-031 pending state.
- **Resolution:** The entry is now written to `<RUN>/tmp/pending-NN.json` and appended with `jq --slurpfile e ... '. + $e'`.

### FINDING-3 (production-readiness, Important, fixed round 1)
- **File:** slidev/commands/balance.md Step 1, Conventions; slidev/scripts/balance/render.mjs cmdRender
- **Source:** production agent, confidence 80
- **What is wrong:** Three problems:
  - `ensure` (npm install plus the Chromium download) and `render` ran under the default 2-minute Bash tool timeout.
  - `metrics.json` was written only after the last slide, so a render that was cut short lost every measurement.
  - The presenter heard about the one-time install only after it had finished.
- **Why it matters:** A first install or a large deck could be killed halfway. The FR-006 notice also came too late to be useful.
- **Resolution:**
  - A Conventions rule sets `timeout: 600000` for long calls.
  - `render-slides.sh ensure --check` reports `INSTALL_NEEDED` before anything is installed, and Step 1 announces the install.
  - render.mjs writes `metrics.json` atomically after every slide.

### FINDING-4 (production-readiness, Important, fixed round 1)
- **File:** slidev/scripts/balance/render.mjs goToSlide
- **Source:** production agent, confidence 75
- **What is wrong:** The final `page.evaluate` waited for `document.fonts.ready` and every incomplete `<img>` with no timeout.
- **Why it matters:** A lazy image that is never rendered, or a stalled remote image, hangs the whole render with the browser left open.
- **Resolution:** The wait now races a 10 s timeout and prints a `WARNING` line when that timeout fires.

### FINDING-5 (architecture, Important, fixed round 1)
- **File:** slidev/scripts/balance/apply-auto-fix.mjs; balance.md zoom walk; balance-fixes.md; visual-reviewer.md; design-constraints.md
- **Source:** architecture agent, confidence 90
- **What is wrong:** The zoom bounds and step, the hard limits and the fill band were hard-coded outside the `balance-thresholds` block. design-constraints.md still claimed that nothing hard-coded them.
- **Why it matters:** FR-008 and FR-014 require the values to be tunable in one place. Raising `zoom.max` in the block had no effect.
- **Resolution:**
  - apply-auto-fix.mjs reads the zoom bounds from the thresholds through the new `zoomBounds` function and `--thresholds` option. The lower bound is always clamped to 1.0.
  - balance.md uses `zoom.step` and `zoom.max` from the thresholds.
  - The reviewer docs say that the thresholds JSON wins over the default numbers quoted in them.
  - flag.mjs now requires the `zoom`, `max_rounds` and `hard_limits` keys.
  - Tests cover a tuned thresholds file.

### FINDING-6 (architecture, Important, fixed round 1 and 2)
- **File:** slidev/scripts/balance/report.mjs collectSlides and the Pending images section
- **Source:** architecture agent, confidence 80 (also reported by the correctness agent as a Minor finding, and refined in the round-1 re-review)
- **What is wrong:** The report matched pending images to slides by `no_at_creation` only. The command matches by title first.
- **Why it matters:** Once slides are added or removed in a single-file deck, the report marks the wrong slide as pending and hides its real status.
- **Resolution:**
  - The new exported `matchPendingSlide` matches by title first and falls back to the creation number in the same source file. It skips merged slides.
  - Metrics now carry `source_title` (the source heading, as the command compares it), so titles with inline markup still match.
  - The report prints the slide number it matched.
  - Tests cover these cases.

### FINDING-7 (correctness, Important, fixed round 1 and 2)
- **File:** slidev/scripts/balance/apply-auto-fix.mjs applySlots; balance.md loop item 6
- **Source:** correctness agent, confidence 75 (round 2 refinement from CodeRabbit)
- **What is wrong:** A slot marker could be inserted inside `<v-clicks>` or an open `<div>`, which breaks compilation. A fix whose re-render failed with `render_error` was never reverted.
- **Why it matters:** An automatic fix could leave a slide that no longer renders (FR-014, SC-005).
- **Resolution:**
  - The new `htmlDepths` function refuses (exit 1) a marker inside an open HTML or component block. It skips code fences, comments, inline code and autolinks, and it handles tags whose attributes span several lines.
  - Loop item 6 now also reverts a fix whose re-render has a new `render_error`.

### FINDING-8 (correctness, Important, fixed round 1)
- **File:** slidev/scripts/balance/palette.mjs redGreenPair
- **Source:** correctness agent, confidence 80
- **What is wrong:** A red and green pair was accepted when their lightness differed by 40 points or more. Lime (about 84 degrees) was not counted as green.
- **Why it matters:** FR-024 allows no red and green pair at all. Custom and harvested palettes could slip through.
- **Resolution:** The lightness exemption is removed and the green range widened to 75-170 degrees. Both presets still pass.

### FINDING-9 to FINDING-13 (test-quality, Important, fixed round 1)
- **Source:** test-quality agent, confidence 75 to 85
- **FINDING-9:** The `handed-back` status was never reached (US1 AS5). Direct `slideStatus` tests added.
- **FINDING-10:** SC-001 overflow was checked by membership only. render.test.sh now asserts that the set of overflow-flagged slides equals expected.json.
- **FINDING-11:** SC-003 determinism ran only on the synthetic deck. cc-review is now rendered twice and the metrics compared. This check found FINDING-14.
- **FINDING-12:** `parseSlideRange` and the out-of-range refusal (FR-001 edge case) were untested. New slide-range.test.mjs covers them, including the CLI exit 2.
- **FINDING-13:** The contact sheet (FR-034) and the side-by-side composite (FR-016) never ran in a test. render.test.sh now checks that both write a valid PNG.

### FINDING-14 (regression, Important, fixed round 1)
- **File:** slidev/scripts/balance/measure.js overflow `describe`
- **Source:** test suite (new cc-review determinism check)
- **What is wrong:** Overflow element descriptions included `svg#<id>`. Excalidraw and Mermaid assign random svg ids on every render.
- **Why it matters:** Two renders of an unchanged slide differed, which breaks FR-005 and SC-003.
- **Resolution:** Ids of svg elements are left out of the descriptions. The cc-review determinism check passes.

### FINDING-15 and FINDING-16 (external, Important, fixed round 2)
- **Source:** CodeRabbit (major), on fix commit 9ac92e8
- **FINDING-15:** `validateSets` accepted a lower zoom bound below 1.0 from direct API callers. The lower bound is now clamped to 1.0, with a test.
- **FINDING-16:** The `htmlDepths` tag scan missed tags spanning lines and treated autolinks as elements. Fixed with carry-over across lines and an autolink and email skip, with tests.

### Minor findings fixed
- correctness: `stripFrontmatter` treated a bare separator as frontmatter and swallowed text up to a `---` line inside a later code fence, undercounting for FR-018. It now follows the slide-map rule.
- architecture: flag.mjs `REQUIRED_KEYS` lacked `zoom`, `max_rounds` and `hard_limits` (fixed; the unused-CLI part of the same finding remains).
- architecture: the Step 10 summary omitted the `merged` and `unresolved` rows.
- production: the Chromium check now requires the `INSTALLATION_COMPLETE` marker, and a failed revision lookup no longer aborts under `set -e`.
- re-review: balance.md now handles the `ensure --check` exit codes. Two more re-review Minors were fixed in round 2: the `htmlDepths` autolink and multi-line tag gaps (same fix as FINDING-16) and matching titles that contain inline markup (`source_title`, see FINDING-6).

### Remaining Minor findings (not fixed, no gate impact)
- correctness:
  - slide-map fence handling differs from Slidev 53 for `~~~` fences and indented closers.
  - `MARKER_RE` accepts indented markers and rejects `:: right ::`, and a layout switch does not check that the remaining markers are supported by the new layout.
  - The revert scratch files are keyed per slide, not per edit. This matters only for importer-block overrides.
- architecture:
  - The pending-image state machine differs between this run and the next.
  - The latest-metrics and progress-line logic is duplicated in jq.
  - measure-core.mjs has no production importer.
  - Markdown parsing is duplicated across scripts.
  - The flag.mjs CLI has no production caller (the `REQUIRED_KEYS` part of that finding was fixed).
  - data-model.md has drifted: `handed-back`, `start_no`, `reason`, and the PendingImage `run`, `fix_id`, `gap` and `placement` fields are missing. This is a spec artifact update.
  - balance-fixes.md claims that the command uses `class` for image placement, which it does not.
  - `preview --split` is unused.
- security:
  - PID reuse guard is a substring match on `slidev`.
  - gemini-cli runs with `-y`.
  - Image target paths are not validated by the scripts.
  - The stock download allows http redirects and runs `convert` before the mime check.
- production:
  - Server wait counts iterations, not seconds.
  - No timeouts on the image generation calls.
  - Infinite CSS animations are not frozen before measurement.
  - Only the exact pinned Chromium revision is reused.
- test-quality:
  - The `.gitignore` append path is untested.
  - The owned-server stop loop can pass vacuously.
  - The codex and gemini generation paths are untested.
  - Temp dirs are not cleaned up, and the contact-sheet test is order dependent.

## Notable Observations

### NOTABLE-1
- **File:** slidev/scripts/balance/measure.js, count-limits.mjs
- **Source:** architecture agent
- **Description:** `words` and `elements` are counted twice: from the DOM in the metrics, and from the source by count-limits, the authoritative gate.
- **Rationale:** The reviewer's `projected` counts and the gate can disagree.

### NOTABLE-2
- **File:** slidev/scripts/balance/render-slides.sh
- **Source:** production agent
- **Description:** Run folders with 2x PNGs pile up in `exports/balance/`, and nothing adds that folder to the deck's `.gitignore`.
- **Rationale:** Disk growth, and accidental commits of the run folders.

### NOTABLE-3
- **File:** slidev/scripts/balance/render-slides.sh
- **Source:** production agent
- **Description:** Owned dev servers run detached and are stopped only by Step 10.
- **Rationale:** If a session crashes, the server is orphaned.

### NOTABLE-4
- **File:** slidev/scripts/balance/render.mjs
- **Source:** production agent
- **Description:** Every slide pays a full SPA navigation, and slides are rendered one at a time.
- **Rationale:** This is the main SC-004 cost. Measured: 16 s for cc-review, well inside the 2-minute budget.

### NOTABLE-5
- **File:** Makefile
- **Source:** test-quality agent
- **Description:** All end-to-end success criteria live behind `RUN_RENDER_TESTS=1`, and nothing wires them into CI.
- **Rationale:** A plain `make test` says nothing about the measurement code.

## Post-Fix Spec Coverage

The fix loop replaced code but removed no requirement. A re-check after round 2 found every requirement still implemented:
- FR-001 to FR-034:
  - render, measure and flags: render.mjs, measure.js, flag.mjs
  - automatic edits: apply-auto-fix.mjs
  - boxes: box-styles.mjs, palette.mjs
  - limits: count-limits.mjs
  - report: report.mjs
  - images: generate-image.sh, fit-image.sh, download-image.sh
  - orchestration: balance.md
- SC-001, SC-003 and SC-009: verified by the render tests.

All spec requirements verified after the fix loop.

## Test Suite Results

| Round | Test Command | Exit Code | Failures | Status |
|-------|-------------|-----------|----------|--------|
| 1 | make test | 0 | 0 | passed (241 tests) |
| 1 | RUN_RENDER_TESTS=1 make test | 2, then 0 | 1, then 0 | the cc-review determinism check failed (FINDING-14), fixed, passed |
| 2 | make test | 0 | 0 | passed (244 tests) |
| 2 | RUN_RENDER_TESTS=1 make test | 0 | 0 | passed (synthetic 8 s, cc-review 16 s) |

`make validate` passed (with the existing plugin-directory warnings).
