# Frozen cc-review talk

Frozen copy of the cc-review talk (`cc-review/docs/presentation`), taken on 2026-11-05 for the render test checks of SC-001 (slide 2 flagged `sparse`, every slide with content past the canvas edge flagged `overflow`) and SC-004 (round 1 including server start under 2 minutes).

Do not edit these files. The test compares the render against `expected.json`, so any change to the slides changes what is being measured.

## Contents

- `slides.md`, `slides/`, `public/`, `diagrams/`: copied unchanged, except the headmatter `title` and the body of slide 2 (see below).
- `package.json` and `package-lock.json`: copied unchanged. The lockfile pins `@slidev/cli` 53.0.0 and `@slidev/theme-seriph` 0.25.0. The test runs `npm ci` when `node_modules` is missing and asserts both files are unchanged after the run (SC-007).
- `expected.json`: `sparse` and `overflow` list start-of-pass slide numbers that must carry that flag. Other flags are not checked.

## Change 1: the headmatter `title`

The `title` reads `cc-review: many reviewers, one verdict (frozen test fixture)` instead of the original title.
`render-slides.sh server start` reuses a dev server on port 3030 when its page title equals the deck title.
With the original title, the test would render the original talk whenever the presenter has it open on 3030, not this frozen copy.
The title only sets the browser tab title; no slide displays it.

## Change 2: slide 2 restored to its sparse version

SC-001 and the brainstorm (`brainstorm/01-visual-feedback-loop.md`) refer to slide 2 as it was when the problem was found: one code line, three short bullets, about 20 words, filling only the top third of the canvas.
By 2026-11-05 the presenter had already applied the "extend from notes" fix to the live talk (a mock reviewer status table), so a plain copy no longer has a sparse slide 2.
`slides/02-review-kickoff.md` here keeps the original frontmatter, title, code line and presenter notes, and replaces the table with three short bullets taken from the notes, which reproduces the measured case.
