# Balance Fixes Reference

Rubric, fix catalog and output schema for `/slidev:balance`. The `visual-reviewer` agent judges one flagged slide against this file and returns a Verdict; the command applies or offers the fixes. Thresholds and flag definitions live in `references/design-constraints.md` ("Visual Balance" section); box markup lives in `references/box-styles.md`. Numbers quoted here (fill band, zoom range and step, hard limits) are the defaults: when the thresholds JSON in the prompt has other values, the JSON wins.

## Rubric

Judge the rendered image first. Metrics explain what the image shows; they do not decide intent.

| Criterion | Balanced | Problem |
|---|---|---|
| **Density** | Content fills a comfortable share of the content area (fill ratio 0.35 to 0.75) and reaches below the middle of the canvas | Content huddles in the top third with white below (sparse), or fills edge to edge with no breathing room (crowded) |
| **Hierarchy** | The title states the idea, one element is clearly the focus, supporting elements are visibly secondary | Everything has the same weight, or the focal element is smaller than its annotations |
| **Visual weight** | Mass is spread over the canvas; on two-column slides both columns carry comparable height (shorter at least 75% of taller) | All mass on one side or at the top; one column nearly empty |
| **Readability** | Body text at 18pt or more, diagram labels at 14pt or more, nothing clipped | Text below 18pt, labels below 14pt, content cut off at the canvas edge |
| **Intent** | Emptiness serves the idea (a statement, a big number, a pause) | Emptiness is left over from cutting content, or crowding comes from cramming two ideas |

Map the slide to one `density` value:

- `sparse`: too little content or content concentrated in a small area (typical flags: `sparse`, `low-spread`, `lopsided`).
- `crowded`: too much content for the area, or content past the canvas edge (typical flags: `crowded`, `overflow`).
- `balanced`: the slide reads well as rendered. Use it when a density flag is a measuring artifact. A slide that still carries `overflow`, `small-text` or `small-labels` always gets fixes, whatever its density.

## Intentional Emptiness

Set `intentional: true` only for these slide kinds, and only when the emptiness serves the idea:

- **Statement**: one sentence or claim, nothing else.
- **Big number**: one figure with a short caption.
- **Section opener**: a section title, maybe a subtitle.
- **Title-only divider**: a title and nothing else. This is the default verdict for title-only slides.
- **Full-bleed visual**: one image or diagram that fills the canvas on purpose.

Rules:

- `intentional` applies to the density flags only (`sparse`, `low-spread`, `lopsided`). If the slide also carries `overflow`, `small-text` or `small-labels`, set `intentional: false` and propose fixes for those flags.
- With `intentional: true`, `fixes` is empty. Say in `reason` which slide kind it is. The presenter can make the verdict permanent with `balance: sparse-ok` in the slide frontmatter.
- A slide with three short bullets at the top is never intentional, even if it is short on purpose. Short bullets that look unfinished are the main problem this pass exists for.

## Automatic-Edit Boundary (FR-014)

Layout changes and scale-up changes are applied automatically. An automatic fix is limited to the slide's frontmatter (`layout`, `zoom`, `class`) plus column slot markers (`::left::`, `::right::`), and MUST leave the text and order of all content unchanged; any edit to text, element count or element order needs presenter approval.

Consequences:

- Only `layout` and `zoom` are `kind: "auto"`. Every other fix is `kind: "approval"`.
- When the ranked fixes include an automatic one, the command applies the highest-ranked automatic fix first and offers approval fixes only if the slide is still flagged.
- Automatic scaling never reduces a slide below its default scale (no shrinking to fit), never exceeds a zoom of 1.5, and stops once the fill ratio is inside the balanced band (0.35 to 0.75).
- Inserting a slot marker is allowed only where it does not reorder content: the marker goes between two existing lines, it never moves a line.
- A `layout` change never hides content. Content after a slot marker the target layout has no slot for is not rendered at all, so the command removes every such marker in the same edit and the content flows into the default slot. Slots per Slidev layout: `two-cols` has `left` and `right`, `two-cols-header` has `left`, `right` and `bottom`, every other layout (`default`, `center`, `statement`, `fact`, `image-right`, ...) has only the default slot. Switching a two-column slide to `default` therefore drops its `::left::` and `::right::` markers. A marker the command cannot remove automatically (anything but `::left::` and `::right::`, for example `::bottom::`) makes the layout change non-automatic.
- A `layout` change that needs a new frontmatter key other than `layout`, `zoom` or `class` (for example `image:` for `image-right`) is not automatic. It is valid as an automatic fix only when the slide already has that key.
- The `class` key is inside the boundary, but the reviewer does not propose class changes in this version; the command uses it when placing an accepted image.
- A fix that introduces `overflow` is reverted by the command, and the round still counts.

## Fix Catalog

Ten fix ids. `kind` is fixed per id.

| id | kind | What it does | `change` shape |
|---|---|---|---|
| `layout` | auto | Switch to another Slidev layout and, for column layouts, insert slot markers | `{layout, slots?}` |
| `zoom` | auto | Scale the whole slide up (frontmatter `zoom`, 1.0 to 1.5) | `{zoom}` |
| `notes-extend` | approval | Bring detail from the presenter notes onto the slide (an example, a number, a second line) | `{markdown}` |
| `merge` | approval | Fold this slide into a sparse neighbor | `{markdown, merge_with}` |
| `split` | approval | Split the slide into two (at most three) slides, one idea each | `{slides: [markdown, ...]}` |
| `move-to-notes` | approval | Move detail from the slide into the presenter notes | `{markdown}` |
| `diagram-resize` | approval | Resize or rescale a diagram so it fits, keeping labels at or above 14pt | `{markdown}` |
| `boxes` | approval | Restructure two or three parallel bullets into tinted boxes | `{markdown}` |
| `image-ai` | approval | Hand over an image prompt sized to the empty area | `{image: {aspect, placement, prompt, file}}` |
| `image-stock` | approval | Suggest stock image search terms for the empty area | `{image: {aspect, placement, prompt, file}}` |

### Ranking (least to most invasive)

Return at most 3 fixes, ranked least to most invasive using the order below for the slide's main problem. Include at least one `auto` fix when one plausibly helps. Leave out fixes that do not address a flag on this slide.

**Sparse** (`sparse`, `low-spread`):

1. `zoom`: content is well arranged but small; scaling up fills the area. Fill grows with the square of the zoom (1.3 gives about 1.7 times the area).
2. `layout`: content sits in the wrong place (`center` for a short slide ending high, `statement` or `fact` when the slide really is one sentence or one number). Rank `layout` above `zoom` when the flag is only `low-spread`, since zoom keeps the content at the top.
3. `notes-extend`: the notes hold a concrete example or detail that was cut to stay under the limits.
4. `boxes`: two or three short, parallel bullets (options, steps, risk versus mitigation).
5. `image-ai`, then `image-stock`: a picture would carry the slide's one idea (see Image Fixes).
6. `merge`: the slide is a fragment of its neighbor's idea.

**Lopsided** (`lopsided`, two-column slides):

1. `layout`: move the slot marker so both columns carry comparable content, switch to `two-cols-header` so the title spans both columns, or switch to `default` when one column has almost nothing.
2. `notes-extend`, `boxes`, `image-ai`, `image-stock` to fill the empty column (`gap` is that column).

**Crowded** (`crowded`, no overflow):

1. `layout`: `two-cols` or `two-cols-header` when the content splits naturally into two parallel groups and stacking them makes it look packed.
2. `diagram-resize`: a diagram takes more room than its labels need.
3. `move-to-notes`: explanatory detail the presenter can say instead of show.
4. `split`: the slide carries two ideas.

`zoom` never helps a crowded slide (it only scales up).

**Overflow** (`overflow`):

Overflow is always fixed, never a judgment call. Try the automatic layout change first; if it does not resolve the overflow, the presenter chooses one of `split`, `move-to-notes` or `diagram-resize`. Skipping is never allowed for overflow, and the command adds those three options when the reviewer did not rank them (`diagram-resize` only when the slide has a diagram).

1. `layout`: a column layout gives wide but short content more room, or `default` removes a layout's extra padding.
2. `diagram-resize`: the diagram is what runs past the edge; keep its labels at or above 14pt. If the labels would drop below 14pt, use `split` or `move-to-notes` instead.
3. `move-to-notes`: some of the text is explanation.
4. `split`: the slide holds more than one idea, or a long code block that needs its own slide.

`zoom` never helps overflow (it only scales up). Never shrink fonts, line height or spacing to make content fit.

**Small text** (`small-text`):

1. `zoom`: only when the slide has room left (fill well below 0.75) and the larger text would not overflow.
2. `move-to-notes` or `split`, with the replacement body dropping the size override (for example a `text-sm` class or an inline `font-size`), so the text renders at the default size.

**Small labels** (`small-labels`):

1. `layout`: give the diagram the full width (for example `two-cols` to `default`).
2. `diagram-resize`: render the diagram larger or with fewer nodes so labels reach 14pt.
3. `split`: diagram and explanation on separate slides.

## Change Shapes

All `markdown` values are complete Slidev Markdown. "Body" means everything after the slide's frontmatter: content plus the presenter notes (the trailing `<!-- ... -->` comment). Frontmatter is never part of a `markdown` value.

### `layout`: `{layout, slots?}`

```json
{ "layout": "two-cols-header", "slots": { "left": 3, "right": 6 } }
```

- `layout`: one of the Slidev default layouts below.
- `slots`: required for `two-cols` and `two-cols-header`, omitted otherwise. Each value is the 1-based line number in the current slide body (as given in the source text, frontmatter excluded) where that column starts; the command inserts the marker on its own line directly before that line. An existing marker for the same slot is moved, never duplicated.
  - `two-cols`: `{ "right": <line> }`. Everything before `::right::`, including the title, goes into the left column.
  - `two-cols-header`: `{ "left": <line>, "right": <line> }`. Lines before `::left::` span both columns (usually the title).

| Layout | When it helps |
|---|---|
| `default` | Undo a column or centered layout when one column is nearly empty, or when a diagram needs the full width |
| `center` | Short content that ends high (`low-spread`): centers it vertically and horizontally. It does not raise the fill ratio |
| `two-cols` | Two parallel groups of content stacked vertically (crowded or overflow); the title lands in the left column |
| `two-cols-header` | Same as `two-cols`, but the title spans both columns; usually the better choice for slides with a title |
| `image-right`, `image-left` | Text plus one image side by side. Needs the `image:` frontmatter key, so it is an automatic fix only when the slide already has it; otherwise it is the placement of an accepted image fix |
| `statement` | The slide is one claim; the layout presents it large and centered (density-exempt) |
| `fact` | The slide is one number or figure with a caption (density-exempt) |
| `quote` | The slide is a quotation with attribution (density-exempt) |
| `section` | The slide opens a section: title and maybe a subtitle (density-exempt) |

Switching to a density-exempt layout (`statement`, `fact`, `quote`, `section`) is only right when the slide already is that kind of slide. Never use it to hide a slide that looks unfinished.

### `zoom`: `{zoom}`

```json
{ "zoom": 1.3 }
```

- A target between the current zoom (default 1.0) plus 0.1 and 1.5, in steps of 0.1. Estimate it as `sqrt(0.5 / fill_ratio)` rounded down to one decimal and capped at 1.5.
- The command walks up in 0.1 steps toward the target and stops as soon as the fill ratio is inside the band. Never propose a zoom below the current value or below 1.0.

### `notes-extend`, `move-to-notes`, `diagram-resize`, `boxes`: `{markdown}`

```json
{ "markdown": "# Reviews catch what tests miss\n\n- Wrong assumptions in the spec\n- Missing error paths\n- One concrete case: the retry loop that never backs off\n\n<!--\nPresenter notes...\n-->" }
```

The complete replacement slide body. Rules per fix:

- `notes-extend`: move or copy material that is already in the notes onto the slide. Keep the notes; trim them only where the text now appears on the slide.
- `move-to-notes`: remove detail from the slide and append it to the notes block (create the block if missing). Nothing is deleted outright.
- `diagram-resize`: change only the diagram's size (wrapper width or height, `scale` of a Mermaid block, or the `<img>` dimensions), or simplify node text already present. Labels must stay at or above 14pt.
- `boxes`: use only the markup and classes from `references/box-styles.md`; the text inside the boxes is the slide's existing text.

### `split`: `{slides: [markdown, ...]}`

```json
{ "slides": ["# Part one\n\n- ...\n\n<!--\n...\n-->", "# Part two\n\n- ...\n\n<!--\n...\n-->"] }
```

Two or three slide bodies in order. The first replaces the current slide and keeps its frontmatter; the others become new slides directly after it, with no frontmatter of their own. Each one gets an assertion title, one idea, and the notes that belong to it.

### `merge`: `{markdown, merge_with}`

```json
{ "markdown": "- The detail this slide contributes", "merge_with": 4 }
```

- `merge_with`: the current number of the neighbor (`no - 1` or `no + 1`).
- `markdown`: the part of this slide's body to fold into the neighbor (content and its notes). The reviewer never sees the neighbor, so the command composes the merged slide from the neighbor's source, checks the limits again, and drops the option if the result exceeds them.
- Propose `merge` only when the slide reads as a fragment of the neighboring idea (a "part 2" title, notes that continue the previous slide), and rank it last.

### `image-ai`, `image-stock`: `{image: {aspect, placement, prompt, file}}`

```json
{
  "image": {
    "aspect": "5:4",
    "placement": "Right column (gap 460x370 at x=490, y=120); no text overlaps the image.",
    "prompt": "A single reviewer's magnifying glass resting on a printed pull request, warm desk light, flat illustration style, calm background on the left third. No text in the image. Aspect ratio 5:4.",
    "file": "public/images/reviews-catch-what-tests-miss.png"
  }
}
```

- `aspect`: from the metrics `gap` (`w:h`). Reduce it when it reduces to small integers, otherwise round to the nearest common ratio: `1:1`, `5:4`, `4:5`, `4:3`, `3:4`, `3:2`, `2:3`, `16:9`, `9:16`, `21:9`. Example: a gap of 460x370 is 1.24, so `5:4`.
- `placement`: one sentence naming where the image sits (column, area below the bullets, background) with the gap rectangle, and where text overlaps it, if anywhere.
- `prompt`: for `image-ai`, a tool-neutral generation prompt: subject that carries the slide's idea, style, composition (calm area where text overlaps), the aspect ratio, and always the sentence "No text in the image." For `image-stock`, the stock search terms, comma-separated.
- `file`: `public/images/<slug>.png`, where `<slug>` is the slide title in lowercase kebab-case (ASCII letters, digits and hyphens). The slide references it as `/images/<slug>.png`.

### Image Fixes

Propose `image-ai` or `image-stock` only when the image carries the slide's one idea: a metaphor the presenter talks about, the object or scene the slide describes, a screenshot of the thing itself. Never propose a decorative image (generic technology backgrounds, people at laptops, abstract shapes) to fill space.

## What Is Not a Fix

- **Progressive reveal** (`v-click`, `v-clicks`, splitting into click steps) is not a fix. Slides are measured in their last reveal state, so reveals never change the measurement.
- **Shrinking**: smaller fonts, tighter spacing, zoom below 1.0 or `transform: scale` below 1. Content that does not fit is split or moved to the notes.
- **Invented filler**: content fixes use material from the slide, its presenter notes, the outline or the brainstorm notes. Never write new claims, statistics, quotes or examples.
- **Decorative images**: see Image Fixes.
- **Deck-level changes**: theme, global fonts or palette changes are out of scope for a per-slide fix.

## Hard Limits and Counting

No fix may push a slide past **6 elements** or **50 words** of body text (`hard_limits` in the thresholds). Every fix carries `projected: {elements, words}` for the slide after the fix, and the command rejects (`rejected-limits`) any fix over the limits before offering it. Fill `projected` honestly with these rules (the same ones `count-limits.mjs` uses):

- **Elements** = bullets + images + diagrams + code blocks.
  - Every list item counts, nested items included.
  - Bullets inside a `.bx` box count individually.
  - A box without bullets counts as one element.
  - A Mermaid, PlantUML or Excalidraw diagram counts as one element, as does each `<img>` or Markdown image.
- **Words** = body words, excluding the title, headings, presenter notes, HTML tags and frontmatter.
  - Words inside boxes count, labels and badges included.
  - When in doubt (text in code blocks, diagram source), count the words, so `projected` never understates. The command re-counts every candidate with `count-limits.mjs` before offering it.
- `layout` and `zoom` do not change content, so their `projected` equals the current counts.
- Image fixes add one element and no words.
- For `split`, `projected` is the largest element count and the largest word count of any resulting slide; every resulting slide must be within the limits.
- For `merge`, `projected` counts only the contributed `markdown`; the command re-counts the merged slide.

## Verdict Schema

The reviewer returns exactly one fenced `json` block with this structure (the `outcome` field of a fix is added later by the command and never set by the reviewer):

```json
{
  "no": 2,
  "density": "sparse",
  "intentional": false,
  "reason": "Two short bullets sit in the top third and the lower half of the canvas is empty; the notes hold a concrete example.",
  "fixes": [
    {
      "id": "zoom",
      "kind": "auto",
      "summary": "Scale the slide up to 1.3 so the bullets fill the content area.",
      "change": { "zoom": 1.3 },
      "projected": { "elements": 2, "words": 14 }
    },
    {
      "id": "notes-extend",
      "kind": "approval",
      "summary": "Add the retry-loop example from the notes as a third bullet.",
      "change": { "markdown": "# Reviews catch what tests miss\n\n- Wrong assumptions in the spec\n- Missing error paths\n- Example: the retry loop that never backs off\n\n<!--\nThe retry loop story...\n-->" },
      "projected": { "elements": 3, "words": 20 }
    }
  ]
}
```

| Field | Type | Rules |
|---|---|---|
| `no` | integer | The slide's current number, copied from the metrics |
| `density` | `"sparse"` \| `"balanced"` \| `"crowded"` | From the rubric |
| `intentional` | boolean | See Intentional Emptiness |
| `reason` | string | One or two sentences, naming what the image shows and why it is or is not a problem |
| `fixes` | array, 0 to 3 items | Ranked least to most invasive; empty when `intentional` is true |
| `fixes[].id` | string | One of the ten catalog ids |
| `fixes[].kind` | `"auto"` \| `"approval"` | `"auto"` only for `layout` and `zoom` |
| `fixes[].summary` | string | One line shown to the presenter |
| `fixes[].change` | object | The shape for that id (see Change Shapes) |
| `fixes[].projected` | `{elements, words}` | Integers for the slide after the fix |

Constraints:

- A slide flagged `overflow` gets `intentional: false` and at least one fix.
- Each id appears at most once per verdict.
- No fix may have `projected.elements > 6` or `projected.words > 50`.
