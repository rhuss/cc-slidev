# Feature Specification: Visual Balance Pass for Rendered Slides

**Feature Branch**: `001-visual-feedback-loop`

**Created**: 2026-11-05

**Status**: Draft

**Input**: User description: "Visual balance pass for rendered Slidev slides", based on `brainstorm/01-visual-feedback-loop.md` (decision and requirements from the 2026-11-05 revisit).

## Context

Every quality check in the plugin today reads Markdown source and only enforces upper limits (6 elements, 50 words). Nothing sees the slide the audience sees. A slide can pass every check and still look unfinished (content in the top third, the rest white), overflow the canvas, or show a diagram too small to read. Layout, theme, font size and diagram aspect ratio decide how full a slide looks, and none of them are visible to source-level checks.

This feature adds a standalone balance pass that the presenter runs on a finished deck. It renders each slide as the audience sees it, measures it, flags unbalanced slides, judges them, and fixes them in a loop with the presenter in control of anything beyond layout and scale.

## Clarifications

### Session 2026-11-05

Answers selected autonomously by the ship pipeline (oversight: smart), using the recommended option for each question.

- Q: What height difference between the two columns of a two-column slide counts as lopsided? → A: The shorter column is less than 75% of the taller column's height.
- Q: What is the command called? → A: `/slidev:balance`.
- Q: How are point sizes compared with rendered sizes on the canvas? → A: Relative to a standard 16:9 slide, where the 980px canvas width equals 960pt (18pt ≈ 18.4px, 14pt ≈ 14.3px). Revised after spec review, so decks using the plugin's 20px body default pass.
- Q: Can an automatic scale fix shrink a crowded or overflowing slide? → A: No. Automatic zoom only scales up (never below 1.0), following the "never shrink to fit" rule; overflow is resolved by layout change first, then by a presenter-chosen content fix (split, move to notes, diagram resize), and skipping is not offered for overflow.
- Q: What minimum size applies to text inside diagrams? → A: Diagram labels are measured separately and flagged below 14pt (body text stays at 18pt).

### Session 2026-11-05 (verify gate, decided by the presenter)

- Q: May the pass fix a defect in a helper script shared with existing commands, and add a pointer to `/slidev:balance` in generate and continue? → A: Yes, both are allowed exceptions to FR-002; existing commands otherwise keep their behavior.
- Q: Do slide numbers follow Slidev's rendered order or the existing slide commands? → A: The existing slide commands (source order, hidden slides included and listed as skipped).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Find and auto-fix unbalanced slides (Priority: P1)

A presenter has finished a deck and runs the balance pass on it (whole deck or a slide range). The pass renders every slide in its final click state, measures each one, and flags slides that are sparse, crowded, overflowing, using text that is too small, or have lopsided columns. For each flagged slide, a reviewer looks at the rendered image and decides whether the emptiness is intentional (a statement, a big number, a section opener) or a problem. Layout and scale-up fixes are applied automatically, re-rendered and re-measured, up to three rounds per slide. Overflow is always resolved: by an automatic layout change where possible, otherwise by a content fix the presenter chooses. At the end, the presenter gets a report with before and after images for every slide that changed and every slide handed back unresolved.

**Why this priority**: This is the core gap. Without rendering and measuring, nothing else in this feature works, and the automatic fixes alone already resolve the most common problems (sparse short slides, overflow).

**Independent Test**: Run the pass on the cc-review talk. Slide 2 is flagged as sparse, gets a layout or scale fix applied, and the report shows it before and after with the measured values.

**Acceptance Scenarios**:

1. **Given** a deck where one slide fills only the top third of the canvas, **When** the presenter runs the balance pass, **Then** that slide is flagged as sparse with its measured values, and the report explains why.
2. **Given** a slide whose content runs past the canvas edge, **When** the pass runs, **Then** the overflow is always fixed (never reported as a judgment call), and the final render shows no overflow.
3. **Given** a slide marked as intentionally sparse in its frontmatter, **When** the pass runs, **Then** the slide is not flagged for sparseness and no fix is proposed for density.
4. **Given** a flagged slide where the reviewer judges the emptiness intentional (for example a single big statement), **When** the pass runs, **Then** no fix is applied and the report notes the verdict and reason.
5. **Given** a slide that is still unbalanced after three fix rounds, **When** the pass ends, **Then** the slide is handed back to the presenter with its screenshots and the remaining problem.
6. **Given** any deck, **When** the pass runs, **Then** the deck's dependency manifest is unchanged afterwards.
7. **Given** a slide that uses step-by-step reveals, **When** it is rendered, **Then** it is measured in its last reveal state, not its initial state.

---

### User Story 2 - Review proposed content fixes interactively (Priority: P2)

For flagged slides where a layout or scale change is not enough, the pass proposes fixes that change what is on the slide: pulling detail from the presenter notes, merging with a sparse neighbor, splitting a crowded slide, or moving detail to the notes. The pass stops at each such slide during the run and shows the current rendering next to a rendered preview of the proposed fix. The presenter accepts it, picks one of the other ranked options, or skips the slide. Nothing that changes content is applied without that yes.

**Why this priority**: Many sparse slides need more than layout (the notes often hold the detail that was cut to stay under 50 words). Presenter approval is a hard anti-goal boundary: no silent content rewrites.

**Independent Test**: On a sparse slide whose notes describe a richer example, the pass offers "extend from notes" with a preview; accepting applies it, skipping leaves the slide untouched.

**Acceptance Scenarios**:

1. **Given** a flagged slide with a proposed content fix, **When** the pass reaches it, **Then** the presenter sees the current rendering, a rendered preview of the proposal, and the other ranked options, before anything changes in the slide file.
2. **Given** the presenter skips a proposal, **When** the pass continues, **Then** the slide file is byte-for-byte unchanged and the report records the skip.
3. **Given** a proposed fix that would push the slide past 6 elements or 50 words, **When** fixes are ranked, **Then** that fix is rejected and never shown as an option.
4. **Given** the presenter accepts a fix, **When** it is applied, **Then** the slide is re-rendered and re-measured in the next round.

---

### User Story 3 - Restructure sparse slides into colored boxes with a consistent deck style (Priority: P3)

For a sparse slide with a few bullets, the pass can offer to restructure the bullets into two or three tinted boxes (the card pattern used in the presenter's recent talks). This is always an offered option, never automatic. The first time the presenter accepts a box fix in a deck, the pass asks which palette to use (plugin default, Okabe-Ito, the presenter's own brand colors, or the colors already used in the deck) and stores the choice with the deck. From then on, every box in the deck uses the same semantic color roles (one meaning per color across all slides), the same label style, the same numbered-badge style and the same punchline style.

**Why this priority**: Boxes fill a sparse slide without adding words, and they look professional only if they are consistent across the deck. It builds on the interactive review from Story 2.

**Independent Test**: Accept box fixes on two different slides; both use the same label style, and a color used for "risk" on one slide is never used for a different meaning on the other.

**Acceptance Scenarios**:

1. **Given** a deck with no stored box style, **When** the presenter accepts the first box fix, **Then** the pass asks for the palette once and stores the answer with the deck.
2. **Given** a stored box style, **When** later box fixes are proposed, **Then** they are not asked about the palette again and use the stored roles.
3. **Given** a box fix, **When** it is rendered, **Then** label text meets at least 4.5:1 contrast against the box tint, body text uses the normal text color, color is never the only cue for meaning, and red and green are never paired.
4. **Given** a box fix, **When** words and elements are counted, **Then** words inside boxes count toward the 50-word limit and bullets inside a box count as elements.
5. **Given** the presenter later changes the palette, **When** the deck is re-rendered, **Then** all boxes in the deck change together without editing each slide.

---

### User Story 4 - Fill space with a supporting image (Priority: P4)

For a sparse slide where a picture would carry the slide's one idea, the pass can offer an image fix. By default it writes a ready-to-use image prompt sized to the measured empty area (aspect ratio, where text may overlap, no text inside the image), with the target file name and slide, into the deck's image prompt file, so the presenter can hand it to an image tool of their choice. Alternatively it suggests stock image search terms and, on request, a few candidates; the presenter picks one, the image is fetched, and attribution goes into the presenter notes. As an opt-in, the presenter can ask the pass to generate the image now: the pass asks which tool or service to use (an installed agent CLI or a direct image API call, and the model when relevant), remembers the answer for the deck, checks it is available, and falls back to prompt handover with a reason if it is not. Once the image file exists, it is fitted to the gap and the next round verifies the slide.

**Why this priority**: Images are a strong fix for sparse slides but depend on external tools and taste. The default path needs no keys or installs; generation is opt-in.

**Independent Test**: On a sparse `image-right` candidate slide, the pass writes a prompt whose aspect ratio matches the measured empty column; after the presenter places a matching file, the next round shows the slide balanced.

**Acceptance Scenarios**:

1. **Given** the presenter accepts an image fix without opting into generation, **When** the pass continues, **Then** a prompt is written to the deck's image prompt file with aspect ratio, placement notes, target file name and slide, and no external service is called.
2. **Given** the presenter opts into generation for the first time in a deck, **When** the pass generates, **Then** it first asks which route to use and stores the answer with the deck.
3. **Given** the chosen route is unavailable (tool missing or key not set), **When** generation is requested, **Then** the pass falls back to prompt handover and states why.
4. **Given** the presenter chooses a stock image, **When** it is placed, **Then** attribution is added to the slide's presenter notes.
5. **Given** an image that does not support the slide's one idea, **When** fixes are ranked, **Then** the reviewer does not propose it (no decorative filler).

---

### User Story 5 - See deck-level rhythm problems (Priority: P5)

After the per-slide work, the pass shows a contact sheet of all slides and reports deck-level rhythm problems: long runs of the same layout, abrupt density swings, a "wall of bullets" section. In this version these are reported, not fixed.

**Why this priority**: Useful polish once individual slides are balanced; no fixes needed to deliver value.

**Independent Test**: On a deck with five consecutive bullet slides, the report names that run.

**Acceptance Scenarios**:

1. **Given** a finished pass, **When** the report is written, **Then** it contains a contact sheet image of all rendered slides and a list of rhythm observations with slide numbers.

---

### Edge Cases

- The deck's dev server cannot start, or a slide fails to render: the pass reports which slide failed and continues with the others; it never reports a failed slide as balanced.
- A slide range outside the deck: the pass refuses with the valid range.
- The render environment (browser runtime) is missing: the pass stops before rendering with a setup hint; there is no degraded text-only mode.
- Two-column slides where one column is a tall diagram: column balance is measured and reported separately from overall fill.
- Slides using the `cover`, `image`, `section`, `statement`, `fact`, `quote` or `end` layouts skip the fill-ratio and vertical-spread flags; overflow and text-size checks still apply.
- Slides that contain only a title (section dividers) are flagged like any other slide, but the reviewer's default verdict for them is "intentional".
- Slide numbers are the source-order numbers used by the existing slide commands (`/slidev:edit`, move, delete), fixed at the start of the pass. Hidden slides keep their number and are listed as skipped, so in a deck with hidden slides a number can differ from the slide's number in the Slidev URL. Fixes edit the source file that defines the slide (including slides imported from separate files). Split and merge reuse the plugin's existing slide-management renumbering; slides created by a split join the pass, and a merge with a slide outside the requested range is offered only after the presenter confirms. A merge that would remove the first slide of the deck's entry file (which holds the deck headmatter) is not offered.
- The presenter already has a dev server running for the deck, or the default port is busy: the pass reuses a running server for the same deck, otherwise starts one on a free port, and stops only a server it started itself.
- The presenter interrupts the pass midway: fixes already accepted stay applied, and the report covers what was done so far.
- A fix makes another metric worse (for example zoom fixes sparseness but causes overflow): the overflow takes precedence and the fix is reverted or replaced in the next round.
- Theme differences (different paddings, font sizes): measurements are taken against the theme's content area, not the raw canvas.

## Requirements *(mandatory)*

### Functional Requirements

**Pass and rendering**

- **FR-001**: The plugin MUST provide a standalone balance pass, invoked as `/slidev:balance`, that runs over a whole deck or a given slide range (`N`, `N-M`, or a comma-separated list, matching the existing slide commands). Hidden or disabled slides are skipped and listed as skipped in the report.
- **FR-002**: The pass MUST NOT change the behavior of the existing generate, visuals or edit commands. Two exceptions are allowed: fixing a defect in a helper script those commands share with the pass (for example an image download that always reported failure), and a one-line pointer to `/slidev:balance` in the output of generate and continue.
- **FR-003**: The pass MUST render every slide in scope as the audience sees it, in the slide's last reveal state, at a fixed canvas size and scale, waiting until fonts, diagrams and images have finished loading.
- **FR-004**: Rendering MUST use the plugin's own render tooling. It MUST NOT modify the deck's dependency manifest, MUST NOT require a browser automation server to be configured, and MUST reuse an already installed browser runtime when one is present.
- **FR-005**: Two renders of an unchanged slide MUST produce exactly equal measurements.
- **FR-006**: On first use, the pass MUST install its pinned render dependencies into the plugin-level cache automatically and tell the presenter it is doing so. If that install is impossible (for example offline), the pass MUST stop before rendering and print the setup command.

**Measuring and flagging**

- **FR-007**: For each rendered slide, the pass MUST measure: fill ratio (area of the union of the visible content, as a share of the theme's content area; text counts as its rendered line boxes, while code blocks, tables, images, diagrams, boxes and other elements with a visible background or border count with their whole box, so a short line of text does not count the empty width beside it), vertical spread (lowest content edge as a share of the canvas height), overflow (content clipped or past the canvas edge), smallest rendered body text size, smallest rendered diagram label size, rendered word count (without markup, headings or code blocks), and height difference between columns for two-column layouts. Sizes are measured in CSS pixels at the native canvas scale and converted to points relative to a standard 16:9 slide (canvas width 980px = 960pt). "Body text" covers paragraphs, list items, table cells, block quotes and box bodies; headings, code blocks, footers and slide numbers are excluded. Diagram label size is measured for diagrams rendered inline as vector graphics, using their rendered (transformed) size; for diagrams embedded as image files, label size is recorded as "unmeasured" and left to the reviewer's visual judgment.
- **FR-008**: The pass MUST flag a slide when its fill ratio is below 35% or above 75%, its content ends above 55% of the canvas height, it overflows, its smallest body text is below 18pt, its smallest measured diagram label is below 14pt, or, on a two-column slide, the shorter column is less than 75% of the taller column's height. These thresholds, the deck-rhythm thresholds (FR-034) and the intentionally-sparse exception (FR-009) MUST be documented in the shared design-constraints reference so they can be tuned without changing the pass.
- **FR-009**: A slide MUST be able to opt out of sparseness flagging through a frontmatter marker (`balance: sparse-ok`). The marker suppresses only the low-fill, vertical-spread and lopsided-column flags; overflow, text size and diagram label checks still apply.
- **FR-010**: Unflagged slides MUST NOT be sent for visual judgment.

**Judging**

- **FR-011**: A dedicated reviewer MUST judge each flagged slide from its rendered image, metrics and source, and return a verdict (sparse, balanced, crowded), a reason, whether emptiness is intentional, and up to three ranked fixes from the fix catalog. A `balanced` verdict without fixes on a slide that carries only density flags is treated like an intentional verdict: no fix is made and the report lists the slide as balanced (intentional).
- **FR-012**: The reviewer MUST judge each slide in a context that contains only the rubric, the slide's rendering, metrics, source and fix catalog (not the editing history of the session).
- **FR-013**: The reviewer MUST NOT interact with the presenter; all questions go through the pass.

**Fixing and the loop**

- **FR-014**: Layout changes and scale-up changes MUST be applied automatically. An automatic fix is limited to the slide's frontmatter (`layout`, `zoom`, `class`) plus column slot markers, and MUST leave the text and order of all content unchanged; any edit to text, element count or element order needs presenter approval. When the reviewer's ranked fixes include an automatic one, the highest-ranked automatic fix is applied first, and approval fixes are offered only if the slide is still flagged. Automatic scaling MUST never reduce a slide below its default scale (no shrinking to fit), MUST NOT exceed a zoom of 1.5, and stops once the slide's fill ratio is inside the balanced band. The zoom cap is documented in the design-constraints reference.
- **FR-015**: Overflow MUST always be fixed, never left as a judgment call. The pass MUST try automatic layout changes first; if those do not resolve it, the presenter MUST choose one of the content fixes (split, move detail to notes, resize a diagram while keeping its labels at or above the minimum), and skipping MUST NOT be offered for overflow. If the presenter ends the pass without resolving an overflow, the report MUST list the slide as failing.
- **FR-016**: All other fixes (content from presenter notes, merge, split, move detail to notes, boxes, images; progressive reveal is not offered as a fix in this version, because slides are measured in their last reveal state) MUST be proposed one slide at a time during the pass, showing the current rendering next to a rendered preview of the proposed fix, and applied only after the presenter accepts. The presenter MUST be able to accept, pick another ranked option, or skip.
- **FR-017**: Producing a preview MUST NOT change the slide file. The preview file the pass writes in the deck root is added to the deck's `.gitignore` when one exists, and removed at the end of the pass.
- **FR-018**: No fix MAY push a slide beyond 6 elements or 50 words of body text. Such fixes MUST be rejected before they are offered.
- **FR-019**: Each slide MUST get at most 3 fix rounds (the presenter can lower this for one run with `--max-rounds N`). A slide still unbalanced after that MUST be handed back to the presenter with its screenshots; a slide that still overflows is handed back and listed in the report as "failing: overflow".
- **FR-020**: After a fix, only changed slides MUST be re-rendered and re-measured. A deck-level change (box palette or box style) marks every slide that uses it as changed, and a split or merge marks every affected slide as changed. A round whose fix is reverted still counts toward the 3-round limit.

**Boxes**

- **FR-021**: The pass MUST be able to offer restructuring a sparse slide's bullets into two or three tinted boxes. This MUST NOT be applied automatically.
- **FR-022**: On the first accepted box fix in a deck, the pass MUST ask the presenter for a palette (plugin default, Okabe-Ito, presenter-supplied colors, or colors already used in the deck) and store the choice with the deck's presentation configuration.
- **FR-023**: Boxes MUST use fixed semantic color roles per deck, with one meaning per color across all slides, and a fixed treatment for box labels, numbered badges and the punchline line under a box grid.
- **FR-024**: Box styles MUST follow these rules: at most 4 hues per slide; color never the only cue for meaning; body text in the normal text color; label text meeting at least 4.5:1 contrast against the box tint; background tint at 10% and border at 30% opacity by default (defaults documented in the design-constraints reference); no red and green pairs; identical padding, corner radius and gap.
- **FR-025**: Box styles MUST be defined once per deck so that changing the palette changes every box without editing individual slides. The palette choice stored in the deck's presentation configuration is the source; the pass generates a single deck-level stylesheet from it. The presenter changes the palette by editing that configuration or choosing a new palette in a later pass, after which every slide with boxes is re-rendered.
- **FR-026**: Words and bullets inside boxes MUST count toward the slide's word and element limits.

**Images**

- **FR-027**: For an accepted image fix, the default action MUST be writing one tool-neutral image prompt to the deck's image prompt file, sized to the measured empty area (aspect ratio, placement of overlapping text, no text in the image), with target file name and slide.
- **FR-028**: The pass MUST be able to suggest stock image search terms and, on request, up to 3 candidates from sources whose license allows reuse with attribution; the chosen image MUST be fetched into the deck's image folder and its attribution added to the presenter notes.
- **FR-029**: Automatic image generation MUST be opt-in. When the presenter opts in, the pass MUST ask which route to use (an installed agent CLI or a direct image API, plus the model where relevant), store the answer with the deck, allow overriding it, and verify the route is available before generating.
- **FR-030**: If the chosen generation route is unavailable, or generation or a stock image fetch fails at runtime, the pass MUST fall back to prompt handover, leave the slide unchanged, and tell the presenter why (including the error reason).
- **FR-031**: After a prompt handover, the slide MUST enter a "pending image" state: it is listed in the report with the target file name, does not use up fix rounds, and is not re-flagged for sparseness until the file exists. When the file is found at the target path (on a later run, or when the presenter says during the pass that it is placed), the image MUST be fitted to the empty area and the slide re-verified in the next round.
- **FR-032**: Image fixes MUST only be proposed when the image supports the slide's one idea.

**Reporting**

- **FR-033**: The pass MUST write its screenshots and a report into `exports/balance/<timestamp>/` in the deck, one subfolder per run, so earlier runs are kept. The report MUST contain, per changed or flagged slide, the before and after images, the measured values, the verdict and the presenter's decision. Every automatic edit MUST be listed with the slide's state before the edit, so it can be reverted.
- **FR-034**: The report MUST include a contact sheet of all rendered slides and a list of deck-level rhythm observations. By default, a run is 4 or more consecutive slides with the same layout, and a density swing is a fill-ratio change of more than 40 percentage points between neighboring slides. These are reported only.

### Key Entities

- **Slide rendering**: one image per slide in scope, in its last reveal state, tied to a render round.
- **Slide metrics**: the measured values for one slide in one round (fill ratio, vertical spread, overflow, smallest body text size, smallest diagram label size, word count, column difference) plus whether it is flagged and why.
- **Verdict**: the reviewer's judgment for one flagged slide: density class, reason, intentional-emptiness flag, ranked fixes.
- **Fix proposal**: one entry from the catalog applied to a slide, with its category (automatic or needs approval), preview rendering, and outcome (applied, skipped, rejected for limits).
- **Deck box style**: palette choice, semantic color roles, and label/badge/punchline treatment, stored once per deck.
- **Image generation preference**: the chosen route and model, stored once per deck, overridable.
- **Balance report**: the per-slide history of renders, metrics, verdicts and decisions, plus the contact sheet and rhythm observations.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On a frozen copy of the cc-review talk kept under `tests/`, slide 2 is flagged as sparse, and every slide with content past the canvas edge is flagged as overflowing.
- **SC-002**: After a completed pass (every in-scope slide reached a final state without the presenter ending the pass early), zero slides in scope overflow the canvas, or every remaining overflow is listed as "failing: overflow" in the report.
- **SC-003**: Rendering an unchanged slide twice yields exactly equal measurements (100% of slides in the test decks).
- **SC-004**: Initial rendering and measuring of a 25-slide deck completes in under 2 minutes on the presenter's machine, including dev server start and excluding the one-time first install.
- **SC-005**: Zero slide files change content without explicit presenter approval; automatic edits touch only frontmatter (`layout`, `zoom`, `class`) and column slot markers, with text and content order unchanged.
- **SC-006**: Zero applied fixes exceed 6 elements or 50 words of body text.
- **SC-007**: The deck's dependency manifest is unchanged after every pass (100% of runs).
- **SC-008**: In a deck with boxes on multiple slides, every color maps to exactly one meaning and every box label uses the same style.
- **SC-009**: On the synthetic test deck (one slide per failure type: sparse, crowded, overflow, lopsided two-column, tiny labels in an inline vector diagram), every failure slide is flagged and the clean control slide is not.

## Assumptions

- The presenter's machine has Node and the deck already runs with the Slidev dev server; the existing preview script starts it.
- Per the presenter's decision, rendering uses a plugin-owned render-and-measure script with a pinned browser automation library installed once into a plugin-level cache and reusing the shared browser cache, rather than the Playwright MCP server or Slidev's PNG export.
- The judging reviewer is a new plugin agent next to the existing visual suggester; the pass itself handles all presenter interaction.
- Starting thresholds (35-75% fill, 55% vertical spread, 18pt) are initial values, tuned against the cc-review deck; calibration from presenter-rated slides is out of scope.
- Canvas size is the Slidev default (980x552) unless the deck configures a different one; measurements use the theme's content area.
- The deck's presentation configuration file stores per-deck preferences (box palette, image generation route).
- The image prompt file and image-download helper already used by the visuals command are reused.
- Out of scope for this version: hooks into generate, visuals and edit; contrast checking (covered by the planned contrast addon); calibration from presenter ratings; fixing deck-level rhythm problems; calling image services without presenter opt-in.
- Test material: the cc-review talk (`cc-review/docs/presentation`) and a small synthetic deck added under `tests/`.
