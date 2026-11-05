# Data Model: Visual Balance Pass

All runtime data lives in the deck under `exports/balance/`. Per-deck preferences live in the `balance:` key of the YAML frontmatter of `presentation-config.md`.

```
<deck>/
├── presentation-config.md            # frontmatter: balance.boxes, balance.images
├── styles/index.css                  # @import './balance-boxes.css' (added once)
├── styles/balance-boxes.css          # generated from balance.boxes
├── ai-image-prompts.md               # image prompt handovers (appended per prompt)
├── .balance-preview.md               # transient, deleted at end of pass (added to an existing .gitignore)
└── exports/balance/
    ├── server.json                   # dev server registry (main + preview)
    ├── server-<role>.log             # log of a dev server the pass started (main, preview)
    ├── pending-images.json           # survives runs
    └── <YYYYMMDD-HHMMSS>/            # one folder per run
        ├── round-0/slide-NN.png ...  # baseline of slides changed at pass start (box palette, placed images), only when there are any
        ├── round-0/metrics.json
        ├── round-<r>/slide-NN.png    # renders per round (only the slides rendered in that round)
        ├── round-<r>/metrics.json
        ├── previews/slide-NN-<id>.md           # candidate file
        ├── previews/slide-NN-<id>.png          # split: slide-NN-split-1.png, slide-NN-split-2.png, ...
        ├── previews/slide-NN-<id>-compare.png  # current next to candidate; split: -compare-1.png, ...
        ├── previews/slide-NN-zoom-<z>.md/.png  # zoom walk previews
        ├── previews/boxes-default.css          # transient box stylesheet when the deck has no palette
        ├── verdicts/slide-NN.json              # latest verdict
        ├── verdicts/slide-NN.round-<r>.json    # earlier round's verdict, kept when replaced
        ├── slide-map.json            # start-of-pass no -> current no, source file + lines
        ├── decisions.jsonl
        ├── contact-sheet.png
        ├── rhythm.json               # raw output of render-slides.sh rhythm
        ├── report.md
        └── tmp/                      # helper, thresholds, before/after texts, free text; removed at end of pass
```

`NN` is always the start-of-pass number with two digits.

## Thresholds (from `references/design-constraints.md`)

```json
{
  "fill_ratio": { "min": 0.35, "max": 0.75 },
  "vertical_spread_min": 0.55,
  "body_text_min_pt": 18,
  "diagram_label_min_pt": 14,
  "column_ratio_min": 0.75,
  "zoom": { "min": 1.0, "max": 1.5, "step": 0.1 },
  "max_rounds": 3,
  "density_exempt_layouts": ["cover", "image", "section", "statement", "fact", "quote", "end"],
  "rhythm": { "same_layout_run": 4, "fill_swing": 0.40 },
  "hard_limits": { "max_elements": 6, "max_words": 50 }
}
```

## SlideMetrics (one entry in `round-N/metrics.json`)

| Field | Type | Notes |
|---|---|---|
| `no` | int\|null | current rendered order (`current_no` from `slide-map.json`); null for hidden slides |
| `start_no` | int | start-of-pass number; file names, `--slides` and the report use it |
| `title` | string\|null | first rendered heading, else the slide's `title` meta |
| `source_title` | string\|null | first Markdown heading in the slide source (outside code fences) |
| `source` | `{file, start, end}` | defining file and line range |
| `layout` | string | effective layout |
| `balance` | string\|null | frontmatter `balance` value (`sparse-ok`) |
| `hidden` | bool | `hide`/`disabled` slides: recorded, not rendered |
| `png` | string\|null | path relative to run folder (`round-<r>/slide-NN.png`); null when hidden or not rendered |
| `fill_ratio` | number 0..1 | union of content rects / content area |
| `vertical_spread` | number 0..1 | lowest content edge / canvas height |
| `overflow` | `{any: bool, elements: [selector]}` | |
| `min_body_pt` | number\|null | null when no body text |
| `min_label_pt` | number\|"unmeasured"\|null | null when no diagram |
| `words` | int | rendered, excluding headings |
| `elements` | int | bullets + images + diagrams + code blocks + boxes' bullets |
| `columns` | `{left_px, right_px, ratio}`\|null | two-column layouts only |
| `gap` | `{x, y, w, h}`\|null | largest empty rectangle in the content area (canvas px), or the empty column on two-column layouts; sizes image prompts (FR-027) |
| `flags` | string[] | subset of `sparse`, `crowded`, `low-spread`, `overflow`, `small-text`, `small-labels`, `lopsided`; exactly `["render-error"]` when the slide failed to render; `[]` when hidden |
| `render_error` | string\|null | slide failed to render; never flagged as balanced |

Measured fields (`fill_ratio` through `gap`) are null when the slide is hidden or failed to render.

**Preview metrics** (one JSON line per candidate slide on the stdout of `render-slides.sh preview`, not written to a round folder) have the same fields, with `no` = position in the preview deck (1-based), `start_no`, `source_title` and `source` null, `png` = `previews/<name>.png` (or `previews/<name>-<i>.png` for a split), plus `preview: {name, index, count}` (the `--name`, the 1-based slide index and the number of slides in the candidate).

Validation: `flags` is computed only by `flag.mjs`; `sparse-ok` removes `sparse`, `low-spread`, `lopsided`; exempt layouts remove `sparse`, `low-spread`, `crowded`.

## Verdict (`verdicts/slide-NN.json`, returned by `visual-reviewer`)

| Field | Type |
|---|---|
| `no` | int |
| `density` | `sparse` \| `balanced` \| `crowded` |
| `intentional` | bool |
| `reason` | string (one or two sentences) |
| `fixes` | array (max 3) of `FixProposal` without `outcome` |

## FixProposal

| Field | Type | Notes |
|---|---|---|
| `id` | string | `layout`, `zoom`, `notes-extend`, `merge`, `split`, `move-to-notes`, `diagram-resize`, `boxes`, `image-ai`, `image-stock` (decisions add the special ids `verdict-intentional` and `handed-back`, see Decision) |
| `kind` | `auto` \| `approval` | `auto` only for `layout`, `zoom` |
| `summary` | string | one line shown to the presenter |
| `change` | object | `layout`: `{layout, slots?}`; `zoom`: `{zoom}`; content fixes: `{markdown}` (full replacement slide body); `split`: `{slides: [markdown, ...]}`; `merge`: `{markdown, merge_with}` (`merge_with` is the neighbor's current number); `image-ai`, `image-stock`: `{image: {aspect, placement, prompt, file}}` |
| `projected` | `{elements, words}` | checked against hard limits before offering |
| `outcome` | `applied` \| `skipped` \| `rejected-limits` \| `reverted` \| `pending-image` \| `handed-back` | set by the command in `decisions.jsonl` |

State transitions per slide:

```
unflagged ──────────────────────────────▶ done
flagged ─▶ judged ─┬─ intentional ──────▶ done (verdict recorded)
                   ├─ auto fix ─▶ re-render ─▶ flagged? ─▶ (round+1 ≤ 3) judged | handed-back
                   ├─ approval fix ─▶ accepted ─▶ re-render ─▶ …
                   │                 └ skipped ─▶ done (not allowed for overflow)
                   └─ image prompt ─▶ pending-image ─▶ (file appears) ─▶ re-render ─▶ …
round 3 still flagged ─▶ handed-back ("failing: overflow" if overflow)
```

## Decision (`decisions.jsonl`, one JSON object per line)

`{ts, start_no, no, round, fix_id, kind, outcome, reason?, before?: {file, start, end, text}, after_png?}`

| Field | Type | Notes |
|---|---|---|
| `ts` | string | UTC ISO time |
| `start_no` | int | start-of-pass number; the report keys decisions on it |
| `no` | int | current rendered number at the time of the decision |
| `round` | int | round of the decision (an image placed at pass start is recorded as round 1) |
| `fix_id` | string | a FixProposal `id`, or a special id: `verdict-intentional` (kind `auto`, outcome `skipped`) records an intentional verdict; `handed-back` (kind `auto`, outcome `handed-back`) records a hand-back |
| `kind` | `auto` \| `approval` | |
| `outcome` | `applied` \| `skipped` \| `rejected-limits` \| `reverted` \| `pending-image` \| `handed-back` | |
| `reason` | string | omitted when empty; one sentence from the verdict, the flags or the counts (hand-backs: the remaining flags) |
| `before` | `{file, start, end, text}` | only on records with an edit (`applied`, `reverted`): the edited file, the slide's lines before the edit, and `text`, the exact slide source before the edit (revert record, FR-033) |
| `after_png` | string | optional, path to the latest render (set on hand-backs) |

A merge writes two `applied` records: one on the removed slide (reason "merged into slide MM") and one on the neighbor (reason "received slide NN").

## PendingImage (`pending-images.json`)

`[{no_at_creation, source_file, slide_title, target_file, aspect, prompt_ref, created, run, fix_id, gap, placement}]`

| Field | Notes |
|---|---|
| `no_at_creation` | start-of-pass number of the slide in the run that created the entry |
| `source_file`, `slide_title` | used with the slide's first `# ` heading to find the slide in a later run (fallback: `no_at_creation` in the same file) |
| `target_file` | `public/images/<slug>.png`, relative to the deck |
| `aspect` | `w:h` |
| `prompt_ref` | `ai-image-prompts.md` |
| `created` | ISO time |
| `run` | run folder name that created the entry |
| `fix_id` | `image-ai` or `image-stock`; reused for the placement decision |
| `gap` | the slide's `gap` from its metrics at creation, `{x, y, w, h}` |
| `placement` | `column-right` \| `column-left` \| `inline` |

On each run, entries whose `target_file` exists and whose slide is in scope are fitted and placed at pass start (after the round-0 baseline), the placement is recorded, and the entry is removed; round 1 re-verifies the slide. Entries placed during a pass ("I placed it", or a later image fix) are removed the same way.

## DeckBoxStyle (`presentation-config.md` frontmatter)

```yaml
balance:
  boxes:
    palette: default | okabe-ito | custom | harvested
    roles: { main: "#3b82f6", risk: "#f97316", context: "#64748b", takeaway: "#8b5cf6" }
  images:
    route: codex | gemini-cli | openai-api | gemini-api
    model: gpt-image-1
```

Validation: four roles, distinct hues, no red/green pair (hue distance check), each role must yield a label shade with ≥4.5:1 contrast in light and dark.

## SlideMap (`slide-map.json`)

`[{start_no, current_no, source_file, start_line, end_line, layout, balance, hidden, frontmatter_overrides, merged_into?, split_from?}]`

| Field | Notes |
|---|---|
| `start_no` | source order at pass start, hidden and disabled slides included (1-based); never changes |
| `current_no` | position among the non-hidden slides (the dev server URL `/<no>`); null for hidden slides and for a slide merged into a neighbor |
| `source_file`, `start_line`, `end_line` | defining file (relative to the deck) and 1-based inclusive line range |
| `layout` | effective layout: the slide's own `layout`, overridden by its importing `src:` block, else headmatter `defaults.layout`, else `cover` for the first rendered slide and `default` otherwise |
| `balance` | frontmatter `balance` value or null |
| `hidden` | `hide: true` or `disabled: true` on the slide or its importing block |
| `frontmatter_overrides` | `{layout\|zoom\|class: {file, start_line, end_line}}` for each of these keys an importing `src:` block sets (that block wins, so automatic fixes edit it); `{}` when none |
| `merged_into` | only on a slide removed by a merge: the neighbor's `start_no` |
| `split_from` | only on a slide created by a split: the original slide's `start_no` (new slides get start-of-pass numbers above the highest existing one) |

Built by `slide-map.mjs build` from the source at pass start (hidden and disabled slides included, since Slidev navigation omits them). The command keeps it current: `slide-map.mjs shift-lines` after every edit that changes the line count (also shifts `frontmatter_overrides` blocks), `slide-map.mjs refresh-layout` after every edit that can change a layout (automatic fixes, image placements, content fixes, reverts), and `renumber` plus a reconcile against a fresh build after every split or merge. Rendering uses `current_no` and skips merged entries; the report uses `start_no`.

## ServerRegistry (`server.json`)

`{main: {pid, port, entry, owned, deck} | null, preview: {pid, port, entry, owned, deck} | null}`. `pid` is null for a reused presenter server (`owned: false`); `deck` is the absolute deck directory. `server stop` sets both entries to null.
