# Code Review: Visual Balance Pass for Rendered Slides

**Spec:** specs/001-visual-feedback-loop/spec.md
**Date:** 2026-11-05
**Reviewer:** Claude (speckit-spex-gates-review-code, ship pipeline stage 7, oversight smart)
**Scope:** branch 001-visual-feedback-loop against main (merge base f6436b6). The review was against spec.md only; plan.md and tasks.md were not read.

## Compliance Summary

**Overall Score: 100%** (after the fix loop; 98% before it)

- Functional Requirements: 34/34 (100%)
- Edge Cases: 11/11 (100%)
- Success Criteria: 9/9 (100%)
- Spec-declared constants: none (the spec has no `## Constants` section)

Before the fix loop there were two deviations, both fixed in code:

- FR-024: palette.mjs accepted red and green pairs of different lightness, but the spec allows none.
- FR-005: overflow descriptions carried random svg ids, so two renders of the cc-review talk differed.

## Code Review Guide

| Area | Files | What to look at |
|------|-------|-----------------|
| Orchestration | slidev/commands/balance.md | ledger and round accounting, overflow never skippable, free-text-through-files rule, Step 10 always runs |
| Render and measure | slidev/scripts/balance/render-slides.sh, render.mjs, measure.js | `?print=true` last reveal state, bounded waits, server reuse and stop, plugin-level cache |
| Flags and thresholds | flag.mjs, references/design-constraints.md | single `balance-thresholds` block, boundary rounding |
| Automatic edit boundary | apply-auto-fix.mjs | frontmatter `layout`/`zoom`/`class` and slot markers only, body check, zoom clamp, HTML-block guard |
| Limits | count-limits.mjs | 6 elements, 50 words, box contents counted |
| Boxes | box-styles.mjs, palette.mjs, references/box-styles.md | roles, contrast 4.5:1, no red/green, deck stylesheet |
| Report | report.mjs | statuses, revert records, contact sheet, rhythm, pending images |
| Reviewer | agents/visual-reviewer.md, references/balance-fixes.md | isolated inputs, Verdict schema, ranked fixes |

## Functional Requirements

| FR | Implementation | Status |
|----|----------------|--------|
| FR-001 command, ranges, hidden/disabled skipped | balance.md Step 0; render.mjs `parseSlideRange`; slide-map.mjs `isHiddenFm` (hide, disabled) | Compliant |
| FR-002 other commands unchanged | generate.md and continue.md only mention the command; nothing calls it | Compliant |
| FR-003 last reveal state, fixed canvas, wait for assets | render.mjs `goToSlide` (`?print=true`, fixed viewport and scale factor, font, image, mermaid and iframe waits) | Compliant |
| FR-004 own tooling, no manifest change, reuse browser | render-slides.sh plugin cache, shared ms-playwright cache; balance.md Guarantee 2 | Compliant |
| FR-005 equal measurements | measure.js fixed rounding; the svg-id fix; render tests on both decks | Compliant (after fix) |
| FR-006 first-use install with notice, setup hint on failure | render-slides.sh `ensure` / `ensure --check`, exit 3 with `manual_setup_hint` | Compliant |
| FR-007 metrics | measure.js (fill union over the content area, spread, overflow, body pt, label pt or "unmeasured", words, columns, 980px = 960pt) | Compliant |
| FR-008 thresholds, documented | flag.mjs `computeFlags`; design-constraints.md "Visual Balance" | Compliant |
| FR-009 `balance: sparse-ok` | flag.mjs `SPARSE_OK_REMOVES` | Compliant |
| FR-010 unflagged slides not judged | balance.md Step 4 and loop item 1 | Compliant |
| FR-011 to FR-013 reviewer verdict, isolated context, no presenter contact | agents/visual-reviewer.md (tools: Read); balance.md Step 5 prompt | Compliant |
| FR-014 automatic boundary, zoom 1.0 to 1.5, stop in band | apply-auto-fix.mjs; balance.md Step 6 zoom walk with previews | Compliant |
| FR-015 overflow always fixed, no Skip | balance.md 7.1 item 2 and 7.2; hand-back as `failing: overflow` | Compliant |
| FR-016, FR-017 approval fixes with side-by-side preview, previews do not touch files | balance.md 7.1 and 7.2; render-slides.sh `preview` (`.balance-preview.md`); side-by-side.mjs | Compliant |
| FR-018 hard limits rejected before offering | count-limits.mjs; balance.md 7.1 item 5 | Compliant |
| FR-019, FR-020 3 rounds, hand-back, re-render only changed slides, reverted rounds count | balance.md loop and Hand-back; `--max-rounds` capped at `max_rounds` | Compliant |
| FR-021 to FR-026 boxes | box-styles.mjs (`set`, `generate`, `harvest`); palette.mjs; balance.md Step 8 | Compliant (after FR-024 fix) |
| FR-027 to FR-032 images | balance.md Step 9; generate-image.sh; fit-image.sh; download-image.sh; pending-images.json | Compliant |
| FR-033 run folder, before/after, revert records | balance.md Step 0 and Recording a decision; report.mjs | Compliant |
| FR-034 contact sheet and rhythm (4-slide runs, swings over 0.40) | render.mjs `cmdContactSheet`; flag.mjs `rhythm`; report.mjs | Compliant |

## Edge Cases

| Edge case | Where | Status |
|-----------|-------|--------|
| Render failure: continue, never reported as balanced | render.mjs `render_error`; report.mjs `render-failed` | Compliant |
| Range outside the deck | `parseSlideRange` exit 2 with "valid range 1-N" | Compliant |
| Missing browser runtime: stop with a setup hint | `ensure` exit 3 | Compliant |
| Two-column slide with a tall diagram: columns reported separately | measure.js `columns`; `lopsided` flag | Compliant |
| Exempt layouts | flag.mjs `EXEMPT_LAYOUT_REMOVES` | Compliant |
| Title-only slides judged, default verdict "intentional" | balance-fixes.md Intentional Emptiness | Compliant |
| Source-file edits, imports, split and merge renumbering | slide-map.mjs; balance.md 7.3 and 7.4 | Compliant |
| Running server or busy port | render-slides.sh server reuse, free port, stop only owned servers | Compliant |
| Interruption | balance.md Interruptions and Step 10 | Compliant |
| Fix worsens another metric | loop item 6 revert (now also on `render_error`) | Compliant |
| Theme content area | measure.js uses the padding of `.slidev-layout` | Compliant |

## Extra Features (Not in Spec)

- `ensure --check`: supports the FR-006 notice. Helpful, small.
- `--palette` and `--max-rounds` arguments: tuning knobs consistent with FR-022 and FR-019. Helpful.
- `preview --split` option: unused by the command (architecture Minor). Candidate for removal.

## Recommendations

### Critical (Must Fix)
- None.

### Spec Evolution Candidates
- data-model.md drifted from what the scripts write:
  - `handed-back` outcome
  - `start_no`, `reason` and `after_png` on decisions
  - `run`, `fix_id`, `gap` and `placement` on pending entries
  - `source_title` on metrics

  This is a spec-artifact update, not a code change.
- The red/green rule is now strict per FR-024. If the presenter wants to allow red and green pairs with very different lightness, the spec must say so first.

### Optional Improvements
- See the remaining Minor findings in review-findings.md.

## Deep Review Report

**Gate: PASS** (after fix round 2)

### Summary

| Severity | Found | Fixed | Remaining |
|----------|-------|-------|-----------|
| Critical | 0 | 0 | 0 |
| Important | 16 | 16 | 0 |
| Minor | 30 | 8 | 22 |
| Notable | 5 | - | 5 |
| **Total** | **51** | **24** | **27** |

### Review Agents

| Agent | Found | Fixed | Remaining | Status |
|-------|-------|-------|-----------|--------|
| Correctness | 7 | 4 | 3 | completed |
| Architecture & Idioms | 12 | 4 | 7 (+1 Notable) | completed |
| Security | 6 | 2 | 4 | completed |
| Production Readiness | 10 | 3 | 4 (+3 Notable) | completed |
| Test Quality | 10 | 5 | 4 (+1 Notable) | completed |
| Goal Alignment | 0 | 0 | 0 | skipped (no PR) |
| CodeRabbit (external) | 2 | 2 | 0 | completed (3 runs: branch 0, round-1 fix 2 major, round-2 fix 0) |
| Copilot (external) | 0 | 0 | 0 | skipped (disabled in config) |
| Codex (external) | 0 | 0 | 0 | completed |
| Round-1 re-review | 3 | 3 | 0 | completed |
| Test Suite (regression) | 1 | 1 | 0 | passed after fix |

MVP: Architecture & Idioms (12 findings).

### Key fixes applied
1. Free text from the deck, the reviewer or the presenter never goes on a command line in balance.md (security).
2. Pending-image entries are appended through a file, so apostrophes in titles are safe (security).
3. Long calls get a 10-minute timeout, `ensure --check` announces the install, and metrics are written per slide (production).
4. The font and image wait is bounded at 10 s (production).
5. Zoom bounds come from the thresholds block, clamped at 1.0; the reference docs defer to the thresholds JSON (architecture, CodeRabbit).
6. Report and command match pending images the same way, title first (architecture, correctness).
7. Slot markers are refused inside open HTML or component blocks, and a fix that breaks rendering is reverted (correctness, CodeRabbit).
8. Strict red/green rule per FR-024 (correctness).
9. Overflow descriptions no longer change between renders, which restores FR-005 on cc-review (test suite).
10. New tests:
    - unit: slide ranges, hand-back status, pending matching, HTML depth, zoom bounds, the count-limits separator
    - render: cc-review overflow set equality and determinism, contact sheet and side-by-side PNGs

### Post-fix spec coverage
34/34 requirements verified. All covered.

### Tests after fixes
- `make test`: 244 passed, 0 failed.
- `RUN_RENDER_TESTS=1 make test`: all assertions passed (synthetic deck 8 s, cc-review 16 s including server start).
- `make validate`: passed, with warnings.

### Notable observations
5 captured in review-findings.md and brainstorm/idea-inbox.md.

Details: specs/001-visual-feedback-loop/review-findings.md
