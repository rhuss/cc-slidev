# Implementation Plan: Visual Balance Pass for Rendered Slides

**Branch**: `001-visual-feedback-loop` | **Date**: 2026-11-05 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-visual-feedback-loop/spec.md`

## Summary

Add `/slidev:balance`, a standalone pass that renders every slide of a finished deck in its last click state, measures it in the DOM, flags unbalanced slides against thresholds kept in `references/design-constraints.md`, has a new `visual-reviewer` agent judge each flagged slide from its screenshot, applies frontmatter-only fixes automatically and offers content, box and image fixes interactively with rendered previews, and writes a timestamped report. Rendering is done by a plugin-owned Node script on `playwright-core@1.64.1` installed once into a plugin cache, reusing the shared Chromium. Boxes use a deck-wide generated stylesheet driven by a palette stored in `presentation-config.md`; images default to prompt handover with opt-in generation through four routes.

## Technical Context

**Language/Version**: Node.js ≥ 20 (ES modules, `.mjs`) for render, measure, flag, palette and report logic; Bash (macOS/Linux) for wrappers; Markdown for the command, agent and references.

**Primary Dependencies**: `playwright-core` 1.64.1 (plugin cache only); the deck's own `@slidev/cli` (via `npx`); `jq`, `yq` (already used by the plugin); optional `magick`, `codex`, `gemini`, `curl`.

**Storage**: Files in the deck: `exports/balance/**`, `presentation-config.md` frontmatter, `styles/balance-boxes.css`, `ai-image-prompts.md`.

**Testing**: `node --test` for pure modules; Bash integration test rendering fixture decks (opt-in `RUN_RENDER_TESTS=1`); `make test` target.

**Target Platform**: Claude Code plugin on macOS and Linux developer machines.

**Project Type**: Claude Code plugin (commands, agents, references, scripts).

**Performance Goals**: Round-1 render+measure of 25 slides < 120 s including dev server start (SC-004); single-slide re-render < 10 s with the server running.

**Constraints**: No changes to deck dependencies; no MCP server; frontmatter-only automatic edits; deterministic metrics; no image service calls without opt-in.

**Scale/Scope**: Decks up to ~60 slides; 1 new command, 1 agent, 2 references, ~8 scripts, fixtures.

## Constitution Check

`.specify/memory/constitution.md` is the unfilled template, so there are no ratified gates. Checked against the project's working conventions instead (CLAUDE.md, ARCHITECTURE.md): shared rules live in `slidev/references/`, scripts in `slidev/scripts/`, commands stay orchestration-focused. **Pass.** Re-checked after Phase 1 design: **Pass** (no new top-level structure; references extended, not duplicated).

## Global Constraints

- FR-004: never modify the deck's dependency manifest or lockfile; no MCP server.
- FR-014: automatic edits only touch frontmatter `layout`, `zoom`, `class` and column slot markers; zoom stays within 1.0 to 1.5.
- FR-018: no applied fix exceeds 6 elements or 50 words of body text.
- No em or en dashes in any new prose.

## Project Structure

### Documentation (this feature)

```text
specs/001-visual-feedback-loop/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── balance-command.md
│   ├── render-cli.md
│   └── visual-reviewer-agent.md
└── tasks.md            # next stage
```

### Source Code (repository root)

```text
slidev/
├── commands/
│   └── balance.md                      # NEW: orchestrates the loop (contracts/balance-command.md)
├── agents/
│   └── visual-reviewer.md              # NEW: judges one slide (contracts/visual-reviewer-agent.md)
├── references/
│   ├── design-constraints.md           # EXTEND: "Visual Balance" section + balance-thresholds JSON
│   ├── balance-fixes.md                # NEW: fix catalog, rubric, automatic-edit boundary
│   └── box-styles.md                   # NEW: box pattern, roles, palettes, rules
└── scripts/
    └── balance/
        ├── render-slides.sh            # NEW: ensure | server | render | preview | contact-sheet | rhythm
        ├── render.mjs                  # NEW: Playwright driver (navigation, waits, screenshots)
        ├── measure.js                  # NEW: in-page measurement (injected)
        ├── measure-core.mjs            # NEW: pure helpers (union area, units) shared with tests
        ├── flag.mjs                    # NEW: thresholds parsing + flag computation + rhythm
        ├── count-limits.mjs            # NEW: element/word counting incl. boxes
        ├── box-styles.mjs              # NEW: palette validation, CSS generation, harvest
        ├── palette.mjs                 # NEW: contrast math, shade search, hue checks
        ├── apply-auto-fix.mjs          # NEW: frontmatter/slot-only edits with body-unchanged assertion
        ├── side-by-side.mjs            # NEW: current vs preview composite
        ├── report.mjs                  # NEW: report.md builder
        ├── generate-image.sh           # NEW: opt-in generation routes
        ├── fit-image.sh                # NEW: crop/fit
        └── package.json                # NEW: pins playwright-core 1.64.1 (installed into cache, not here)

tests/
└── balance/
    ├── unit/*.test.mjs                 # node --test suites
    ├── render.test.sh                  # integration (RUN_RENDER_TESTS=1)
    └── fixtures/
        ├── synthetic-deck/             # one slide per failure type + clean control
        └── cc-review/                  # frozen copy of the cc-review talk (no node_modules)

Makefile                                # EXTEND: test target
README.md, ARCHITECTURE.md              # EXTEND: document /slidev:balance
```

**Structure Decision**: Follow the existing plugin layout. All balance scripts live under one `slidev/scripts/balance/` folder so the cache install, tests and future generate/edit hooks share one entry point (`render-slides.sh`). Rules the agent and command both need go to `references/` (the refactor just committed established that pattern).

## Phase Notes

- **Phase 0** (research.md): R1-R10 resolve every unknown (version pin, click state, units, measurement, server lifecycle, preview, box CSS, image routes, thresholds, tests).
- **Phase 1** (data-model.md, contracts/, quickstart.md): entities, file layout, CLI and agent contracts, validation guide.

## Implementation Order (for tasks)

1. Thresholds in design-constraints + `flag.mjs`/`measure-core.mjs` with unit tests (pure, fast).
2. Render tooling: `package.json` pin, `render-slides.sh ensure|server|render`, `render.mjs`, `measure.js`; synthetic fixture; integration test. **MVP checkpoint (US1 measuring).**
3. `visual-reviewer` agent + `balance-fixes.md`; `/slidev:balance` with automatic fixes, round loop, report, contact sheet. **US1 complete.**
4. Preview rendering + interactive approval flow + `count-limits.mjs` + decisions/revert log. **US2.**
5. `palette.mjs`, `box-styles.mjs`, `box-styles.md`, box fix in command. **US3.**
6. Image prompt handover, pending images, stock flow, `generate-image.sh`, `fit-image.sh`. **US4.**
7. Rhythm observations in report. **US5.**
8. Docs (README, ARCHITECTURE, command list), frozen cc-review fixture, `make test`.

## Risks

- **Slidev internals** (`__slidev__`, `data-slidev-no`, print mode) can change between Slidev majors. Mitigation: all selectors in `render.mjs` constants; integration test against fixture decks pinned to the Slidev version in their `package.json`.
- **Agent verdict variance**: metrics decide flagging; the agent only judges intent and ranks fixes.
- **Image routes** rely on third-party CLIs whose headless behavior is under-documented; availability checks and fallback to prompt handover contain the damage.

## Complexity Tracking

No constitution violations to justify.
