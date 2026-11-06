# Idea Inbox

Ideas captured from code reviews for future brainstorming.

### single-authoritative-counts

- **Source**: deep-review
- **Date**: 2026-11-05
- **Reference**: 001-visual-feedback-loop
- **Summary**: Words and elements are counted twice: from the rendered DOM in the metrics, and from the source by count-limits.mjs, which is the gate.

> The reviewer's projected counts and the hard-limit gate can disagree; attach count-limits results to the metrics or document which one is authoritative.

### balance-run-folder-growth

- **Source**: deep-review
- **Date**: 2026-11-05
- **Reference**: 001-visual-feedback-loop
- **Summary**: Every pass keeps a run folder of 2x PNGs under exports/balance/, and nothing prunes old runs or ignores the folder in the deck's .gitignore.

> Over time this grows the disk and risks committing large images; consider an ignore entry and a cleanup hint.

### orphaned-dev-servers

- **Source**: deep-review
- **Date**: 2026-11-05
- **Reference**: 001-visual-feedback-loop
- **Summary**: Owned Slidev dev servers run detached and only Step 10 stops them.

> A crashed session leaves Vite servers running; an idle watchdog or a visible stop hint would help.

### faster-slide-navigation

- **Source**: deep-review
- **Date**: 2026-11-05
- **Reference**: 001-visual-feedback-loop
- **Summary**: Each slide is a full page load against the dev server, rendered one at a time.

> Fine for 25 slides today (16 s for cc-review), but in-app navigation or two parallel pages would keep SC-004 headroom for larger decks.

### render-tests-in-ci

- **Source**: deep-review
- **Date**: 2026-11-05
- **Reference**: 001-visual-feedback-loop
- **Summary**: All end-to-end success criteria live behind RUN_RENDER_TESTS=1 with no CI wiring.

> A plain make test says nothing about measurement correctness; add a test-all target or CI job.

### unocss-theme-palette

- **Source**: brainstorm on global-styles-scoped-to-slide-one
- **Date**: 2026-11-05
- **Reference**: slidev/commands/generate.md, cc-review/docs/presentation/slides (inline `style="color: var(--primary)"`)
- **Summary**: Generated slides color accents with inline `style="color: var(--primary)"`, a plugin convention rather than a Slidev one.

> Slidev is UnoCSS-first: defining `primary`/`secondary` as theme colors in `uno.config.ts` would let slides use `text-primary`, `border-primary`, `bg-primary`, and some themes (seriph) also accept `themeConfig.primary`. Changes what generate writes into every slide and how balance box styles relate to the palette, so it needs its own decision.

### balance-vertical-centering

- **Source**: user request during brainstorm #02
- **Date**: 2026-11-06
- **Reference**: slidev/commands/balance.md (Step 6 automatic fixes), slidev/references/design-constraints.md (`low-spread`), slidev/scripts/balance/apply-auto-fix.mjs (`class` key)
- **Summary**: Add a balance fix that vertically centers a slide's main element while the headline stays at the top.

> Targets `low-spread` (content ends in the top half) without zoom or content edits. Could be an automatic `class` fix (e.g. `class: balance-center`) with its CSS in a balance-owned file under `styles/`, like `balance-boxes.css`. Centering spreads content but adds no fill, so for sparse slides it would run before zoom rather than replace it. Open: which layouts it applies to (two-cols, default), and how the reviewer ranks it against zoom.
