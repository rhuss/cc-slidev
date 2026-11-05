# Brainstorm: Visual Feedback Loop for Balanced Slides

**Date:** 2026-11-05
**Status:** active (revisited 2026-11-05, approach chosen)
**Issue:** -

## Problem Framing

Every quality check in the plugin today works on Markdown source, never on the rendered slide. The checks only enforce upper limits (6 elements, 50 words, 9 diagram nodes). Nothing catches a slide that is too empty, and nothing sees what the audience will see.

Observed in the cc-review talk (`cc-review/docs/presentation`, 2026-11-05):

- Slide 2 ("A review starts now and finishes during the talk") passes every check: one code line, three short bullets, 20 words. Rendered, the content fills the top third of the canvas and leaves the rest white. It looks unfinished.
- The opposite fails silently too: a two-cols slide with a tall Mermaid diagram can overflow the 980x552 canvas and get clipped, and word counts include markup, so they over- or under-count.
- Diagrams created as Excalidraw SVGs were checked on the canvas, but never on the slide. Size and placement were left to the user ("please look at slides 5, 11, 17").

The core gap: **source-level limits do not predict visual balance.** Layout, font size, diagram aspect ratio and the theme decide how full a slide looks.

**Goal (draft):** a loop that renders every slide, measures and looks at it, classifies it as sparse, balanced or crowded, applies a fix, and re-renders until the deck is balanced or a round limit is hit.

**Anti-goals (draft):**

- Padding slides with filler to hit a density number. Added content must come from the outline, brainstorm or presenter notes and support the slide's one idea.
- Breaking the existing hard limits (6 elements, 50 words) to fill space.
- Uniform density everywhere: a statement slide or a big number is meant to be sparse. Intentional emptiness must be possible.
- Silent rewrites of content. Content changes need user approval; pure layout and scale fixes can be automatic.

## The Loop

```
render ──> measure ──> judge ──> fix ──> re-render
  ^                                  |
  └──────────── max N rounds ────────┘
```

### 1. Render

Options to get one PNG per slide:

| Option | How | Pros | Cons |
|---|---|---|---|
| **Slidev export** (preferred) | `slidev export --format png --output exports/render` (needs `playwright-chromium` as dev dependency) | Official, per-slide PNGs, reproducible, works headless in CI | Extra dependency (~150 MB Chromium); full export per round is slow on large decks; `--range` helps |
| Dev server + Playwright script | Open `http://localhost:3030/<n>?print`, screenshot `#slide-content` | Fast re-render of single slides with hot reload; DOM access for metrics in the same pass | Own script to maintain |
| Claude in Chrome | Browser extension screenshots | No install | Not headless, not scriptable in CI, user's browser |

The Playwright route can collect DOM metrics and the screenshot in the same pass, which makes it the strongest candidate for the measuring step.

Also render with clicks expanded (the last click state). A `v-click` slide looks empty at click 0.

### 2. Measure (deterministic)

Cheap numbers first, so the model only looks at slides that need it.

**DOM metrics** (from the rendered page, canvas 980x552):

- **Fill ratio**: union of the bounding boxes of visible content elements divided by the content area. Rough bands: < 35% sparse, 35-75% balanced, > 75% crowded (to be calibrated).
- **Vertical spread**: the lowest content edge as a share of canvas height. Slide 2 ends at about 45%.
- **Overflow**: any element with `scrollHeight > clientHeight`, or content past the canvas edge. Hard failure.
- **Computed font sizes**: smallest rendered body text, checked against the 18pt rule after scaling.
- **Rendered word count**: text from the DOM, without markup.
- **Column balance** for two-cols: height difference between left and right.

**Pixel metrics** (from the PNG, no DOM needed):

- Non-background pixel ratio, overall and per quadrant (detects one-sided or top-heavy slides).
- Largest empty rectangle as a share of the canvas.

### 3. Judge (vision model)

The model reads each PNG with a short rubric, for flagged slides only, or for all slides in a final pass:

- Density: sparse, balanced, crowded
- Hierarchy: is the title the strongest element, does the eye know where to go
- Visual weight: centered or deliberately asymmetric, or accidentally lopsided
- Readability from the back row (text size, diagram labels)
- Consistency with neighboring slides (same layout family, same diagram style)
- Intent: is the emptiness deliberate (statement, big number, section opener)?

Output per slide: verdict, reason, and one or two concrete fix proposals from the catalog below.

A deck-level pass looks at a contact sheet (all thumbnails in one grid) for rhythm: runs of identical layouts, density swings, a "wall of bullets" section.

### 4. Fix Catalog

**Sparse slide** (ordered from least to most invasive):

1. **Layout**: switch `default` to `center` for short content, or to `image-right` / `two-cols` when a visual exists.
2. **Scale**: Slidev `zoom: 1.2` frontmatter, or larger text classes for big statements.
3. **Promote the visual**: fill a pending `TODO: Visual` placeholder (diagram, screenshot, icon tiles).
4. **Extend content from the presenter notes**: the notes often hold the detail that was cut to stay under 50 words. Slide 2 example: show a mock of the reviewer status table (the notes describe it) instead of three bullets about it.
5. **Merge** with a neighboring slide that is also sparse and shares the idea.

**Crowded slide**:

1. Scale down the diagram or switch to `two-cols`.
2. Move detail to the presenter notes.
3. Split into two slides (existing rule).
4. Progressive disclosure with `v-click` (does not reduce the element count, but spreads the load over time).

**Overflow**: always a fix, never a judgment call.

### 5. Loop Control

- Max rounds per slide (3), then hand back to the user with the screenshots.
- Re-render only the changed slides (`--range`).
- Before/after screenshots side by side in a report (`exports/balance-report.md` with image links).
- Layout and scale fixes apply automatically; content additions are proposed and need approval.
- Hard limits stay hard: a fix that would break 6 elements / 50 words is rejected.

## Integration Ideas

- **New script**: `scripts/render-slides.sh` (export PNGs plus a JSON file of DOM metrics per slide).
- **New agent**: `visual-reviewer` (reads PNGs plus metrics, returns verdicts and fix proposals). Fits next to `visual-suggester`, which works only on Markdown today.
- **New command**: `/slidev:balance` (or `/slidev:polish`) runs the loop over the deck or a range.
- **Hooks into existing commands**:
  - `/slidev:generate` ends with one render-and-judge pass instead of only the text checklist.
  - `/slidev:visuals` checks every new diagram in place on the slide, not only on the drawing canvas.
  - `/slidev:edit N` re-renders slide N after the edit.
- **Design constraints**: add minimum density rules and the "intentionally sparse" exception to `references/design-constraints.md`.
- **Slide-level opt-out**: frontmatter such as `balance: sparse-ok` for statement slides.

## Test Material

- The cc-review talk (`cc-review/docs/presentation`): 22 main slides with known cases (slide 2 sparse, slides 5/11/17 with new Excalidraw diagrams, two-cols slides, Mermaid charts).
- A small synthetic deck in `tests/` with one slide per failure type: sparse, crowded, overflow, lopsided two-cols, tiny diagram labels.

## Open Questions

- Where do the density bands come from? Calibrate on a set of slides the user rates as good, or start with fixed numbers and tune?
- Is the vision judgment stable enough across runs, or do the deterministic metrics have to decide and the model only explain?
- Theme dependence: seriph vs default have different paddings and font sizes. Measure against the theme's content area, not the raw canvas?
- Cost: one image per slide per round. Contact sheet first, single slides only when flagged?
- Should the loop also catch contrast problems (links to the contrast addon spec in `docs/superpowers/specs/2026-09-11-slidev-contrast-addon-design.md`)?
- ~~Should the Playwright dependency be optional, with a degraded text-only mode when it is missing?~~ Resolved 2026-11-05: no text-only mode; own render script with pinned Playwright.

---

## Revisit: 2026-11-05

### Updated Problem Framing

The goal is unchanged: catch slides that look unbalanced once rendered (too sparse, too crowded, overflowing, diagrams too small), and fix them in a loop. The first version is a **standalone balance pass** that you run on a finished deck (whole deck or a range). Hooks into `/slidev:generate`, `/slidev:visuals` and `/slidev:edit` come later and must not change in this version.

Two new fix families came up during the session, and both must look professional across the whole deck, not just slide by slide:

- **Colored boxes** (the tinted card pattern from `~/Documents/Talks/codeeurope-sdd-2026` and `codeeurope-agent-security-2026`): turning bullets into two or three cards fills a sparse slide without adding words.
- **Images** (stock or AI-generated) that support the slide's one idea and are sized to the empty area.

Additional anti-goals:

- Boxes that change color meaning from slide to slide, or label styles that drift.
- Images as decoration. A picture that does not support the slide's idea is filler, same as padded text.
- An image pipeline that needs API keys by default.

### New Approaches Considered

**Rendering:**

| Option | Verdict |
|---|---|
| Playwright MCP server as prerequisite, model drives the browser | Dropped. Four to five tool calls per slide (navigate, resize, wait, evaluate, screenshot), more than 100 per pass on a 25-slide deck. Viewport, waits and click state depend on the model doing every step the same way, so metrics drift between rounds. MCP server versions and settings differ between users. |
| Standalone render-and-measure script with pinned Playwright | **Chosen.** One call renders the deck and writes PNGs plus `metrics.json`. Identical viewport (980x552 at 2x), font/Mermaid/image waits and click state on every run, so before/after numbers are comparable. Chromium is reused from the shared `~/Library/Caches/ms-playwright` cache (already present on this machine from the MCP server). Playwright installs once in a plugin-level cache, never into the deck. |
| `slidev export --format png` | Dropped. Needs `playwright-chromium` in every deck, full export per round, no DOM metrics. |

**Structure:**

- **A: Single command, everything in the main session.** Fewest parts, but every screenshot of every round stays in the main conversation, and the judge sees the whole editing history.
- **B: Command runs the loop, new `visual-reviewer` agent judges.** Screenshots stay out of the main context, each verdict comes from a fresh rubric-only context (more stable), and the later generate/edit hooks can call the same agent. Costs: two files to keep in sync, handoff overhead, and the agent cannot ask the user, so all questions route through the command.
- **C: Fold into `/slidev:visuals`.** No new command, but mixes "add pictures to Markdown" with balance, overflow, boxes and deck color system.

**Image generation routes** (researched; all available locally without new installs: Codex CLI 0.166.0 with `image_generation` stable, Gemini CLI 0.64.0, `OPENAI_API_KEY`, `GEMINI_API_KEY`, ImageMagick):

| Route | Size control | Notes |
|---|---|---|
| Codex CLI (`codex exec`, gpt-image-2) | Prompt only (3:1 to 1:3) | Uses ChatGPT plan quota (image turns about 3-5x), output lands in `~/.codex/generated_images/` first, headless use documented only by third parties |
| Gemini CLI + nanobanana extension | No aspect ratio flag documented | Needs `gemini extensions install https://github.com/gemini-cli-extensions/nanobanana`, output in `./nanobanana-output/`, headless use undocumented |
| Direct API (OpenAI Images or Gemini image models via `curl` + `jq`) | Explicit size and aspect ratio | Per-image cost, roughly $0.02 to $0.20 |

### Updated Decision

**Approach B with a standalone render script:**

- `/slidev:balance` (name to confirm in spec) runs the loop: starts the dev server, calls the render-and-measure script, flags slides, dispatches the `visual-reviewer` agent per flagged slide, runs the interactive review with the user, applies fixes, re-renders changed slides.
- `visual-reviewer` agent (next to `visual-suggester`) gets screenshot, metrics, slide source and fix catalog, returns verdict plus ranked fixes. It never talks to the user.
- Render script: pinned Playwright, plugin-level cache, reuses shared Chromium, outputs one PNG per slide (last click state) plus `metrics.json`.

### Key Requirements

**Pass and loop**

- Standalone pass over a deck or a slide range. No behavior changes in generate, visuals or edit in this version.
- Rendering through the plugin's own render script, not the Playwright MCP server and not `slidev export`. The deck's `package.json` is never modified.
- Every slide is rendered in its last click state.
- DOM metrics per slide: fill ratio, vertical spread, overflow, smallest rendered font size, rendered word count, two-column height balance. *(The pixel metrics from the original idea are dropped: DOM metrics plus the vision judgment cover the same ground. My call.)*
- Metrics flag, model decides. Starting bands *(my call, tuned on the cc-review deck)*: fill ratio outside 35-75%, content ends above about 55% of canvas height, any overflow, smallest text below 18pt, large column height difference. Thresholds live in `references/design-constraints.md`.
- Unflagged slides get no screenshot review.
- The agent decides whether emptiness is intentional (statement, big number, section opener). Frontmatter `balance: sparse-ok` opts a slide out.
- Overflow is always fixed, never a judgment call.
- Max 3 rounds per slide, then hand back to the user with screenshots. Only changed slides are re-rendered; the dev server stays running across rounds.
- Deck-level contact sheet at the end: the agent reports rhythm problems (runs of the same layout, density swings). Report only, no fixes in this version.
- Output under `exports/balance/`: screenshots, `report.md` with before/after images and every decision.
- Hard limits stay hard: no fix may exceed 6 elements or 50 words. Words inside boxes count toward the 50, bullets inside a box count as elements.

**Interactive review**

- Layout and scale fixes (layout switch, `zoom`) apply automatically.
- Everything else is proposed one slide at a time during the pass: current screenshot next to a rendered preview of the proposal, with accept, pick another option, or skip. This covers boxes, images, content pulled from the presenter notes, and merges.

**Fix catalog additions**

- *Restructure into boxes* (sparse slides): offered, never automatic. Sits between "layout" and "content from notes".
- *Image fill* (sparse slides): stock or AI image that supports the slide's one idea.

**Box style system (deck-wide)**

- Asked once per deck on the first accepted box fix: palette choice from plugin default (blue, orange, purple, slate), Okabe-Ito, user-supplied brand hex values, or the colors already used in the deck. Stored in `presentation-config.md`.
- Fixed semantic roles per deck (for example main point, contrast/risk, neutral context, takeaway). One meaning per color across all slides.
- Fixed treatment per element type: box label (same size, weight, role color), numbered badges, punchline line below a box grid.
- Best practices *(my proposal, from research)*: at most 3-4 hues per slide; color never the only cue (the label carries meaning, optionally a left border or icon); body text in boxes uses the normal text color, only the label uses the hue, in a shade that meets 4.5:1 on the tint (darker shade on light themes, lighter on dark themes); about 10% tint background, about 30% border; no red/green pairs; same padding, radius and gap everywhere.
- Box styles are defined once at deck level, not copied as utility classes onto each slide *(my call: consistency by construction, palette change is a one-line edit)*.

**Images**

- Default: the pass writes one tool-neutral prompt per image into the existing `ai-image-prompts.md`, sized to the measured gap (aspect ratio, where text may overlap, no text in the image), with target file name and slide. The user hands it to nano-banana, ChatGPT or similar.
- Stock option: search terms, optionally a few Unsplash/Pexels candidates via web search; the user picks, `download-image.sh` fetches it, attribution goes into the notes.
- Opt-in automatic generation: when the user chooses "generate it now", the pass asks which route to use (Codex CLI, Gemini CLI with nanobanana, direct OpenAI or Gemini API, plus the model for API calls). *(My call: the answer is remembered in `presentation-config.md` and can be overridden.)* Before generating, the pass checks the tool or key is available and falls back to prompt handover with a reason if not.
- After the image is placed (generated or dropped into `public/images/`), it is cropped to the gap and the next round verifies the slide.

**Scope**

- In: standalone pass, render script, `visual-reviewer` agent, fix catalog with boxes and images, deck box style system, report, density rules in `design-constraints.md`, `balance: sparse-ok` opt-out.
- Out: hooks into generate/visuals/edit, contrast checking (contrast addon spec), calibrating bands from user ratings, fixing deck-level rhythm problems, the plugin calling image models without the user opting in.

**Test material**

- cc-review talk (`cc-review/docs/presentation`): slide 2 sparse, slides 5/11/17 with Excalidraw diagrams, two-cols and Mermaid slides.
- A small synthetic deck in `tests/` with one slide per failure type.

### Open Threads

- Command name: `/slidev:balance` or `/slidev:polish`.
- Playwright version pinning: match the version already in the shared browser cache, or pin independently and accept a one-time Chromium download.
- Where the deck-level box styles live (theme override, global stylesheet, UnoCSS shortcuts) and how they behave across seriph and default themes, light and dark.
- How the rendered preview of a proposed fix is produced without changing the slide file (temporary copy, separate render target).
- Theme dependence of the density bands: measure against the theme's content area, not the raw canvas.
- Whether the uncommitted `design-constraints.md` refactor lands before this spec, since the density rules go there.
