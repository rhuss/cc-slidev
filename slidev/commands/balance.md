---
name: balance
description: Render every slide as the audience sees it, measure its visual balance, and fix sparse, crowded or overflowing slides in a review loop with the presenter in control of content changes
argument-hint: "[range] [--palette default|okabe-ito|custom|harvested] [--max-rounds N]"
allowed-tools: ["Read", "Edit", "Write", "Bash", "Task", "AskUserQuestion", "WebSearch"]
---

# Visual Balance Pass

Render each slide in its last reveal state, measure it, flag unbalanced slides, let the `visual-reviewer` agent judge each flagged slide, apply automatic layout and scale fixes, and offer content fixes to the presenter one slide at a time. Every run writes its screenshots, decisions and `report.md` into `exports/balance/<timestamp>/` in the deck.

This command orchestrates. The rules live in the references, read them instead of restating them:

- `${CLAUDE_PLUGIN_ROOT}/references/design-constraints.md`, section "Visual Balance": thresholds, flags, exempt layouts, zoom cap, hard limits.
- `${CLAUDE_PLUGIN_ROOT}/references/balance-fixes.md`: rubric, fix catalog, `change` shapes, the automatic-edit boundary, counting rules, Verdict schema.
- `${CLAUDE_PLUGIN_ROOT}/references/box-styles.md`: box markup, roles, palettes.
- `${CLAUDE_PLUGIN_ROOT}/agents/visual-reviewer.md`: what the reviewer gets and returns.

## Guarantees

These hold for the whole pass, whatever happens:

1. **No silent content edits (SC-005).** Slide text, element count and element order change only after the presenter accepted that exact fix in an AskUserQuestion. Automatic fixes go through `apply-auto-fix.mjs` only, which touches frontmatter `layout`, `zoom`, `class` and column slot markers and refuses anything that changes the body.
2. **No dependency changes (SC-007).** Never run `npm install`, `npm ci` or any package manager in the deck, and never edit the deck's `package.json` or lockfiles. Render tooling lives in the plugin cache (`render-slides.sh ensure`).
3. **Previews never touch slide files (FR-017).** Candidates are written to the run folder and rendered through `render-slides.sh preview`.
4. **No image service calls** unless the presenter chose "Generate now" for that slide.
5. **Overflow is never skipped (FR-015).** Overflow questions have no "Skip" option.
6. **A report always exists.** Run `report.mjs` after every decision and after every round, so an interrupted pass leaves a current `report.md`.

## Conventions

- **Placeholders.** `<DECK>` is the absolute deck directory, `<ENTRY>` the entry file name (normally `slides.md`), `<RUN>` the absolute run folder, `<CONFIG>` the presentation config path, `<S>` a slide's start-of-pass number, `NN` that number with two digits (`02`), `<C>` its current rendered number, `<r>` the round number. Shell state does not persist between Bash calls, so spell out full paths in every call.
- **Script paths.** All balance scripts are in `${CLAUDE_PLUGIN_ROOT}/scripts/balance/`. Every `render-slides.sh` call gets `--deck <DECK> --entry <ENTRY>`.
- **Free text never goes on a command line.** Slide titles, verdict reasons, URLs, model names, pending-image entries and any other text that comes from the deck, the reviewer or the presenter are first written to a file under `<RUN>/tmp/` with the Write tool, then read from that file (`--rawfile`, `--slurpfile`, or `"$(cat <file>)"`). Bash still expands backticks and `$(...)` inside double quotes, and an apostrophe in a title ends a single-quoted string, so pasting such text into a command can break it or run part of it. Only fixed values (fix ids, flags, numbers, paths built from the slide map) are written inline.
- **Long calls.** Run `render-slides.sh ensure`, `server start`, every `render`, every `preview` and `contact-sheet` with the Bash tool's `timeout` set to `600000` (10 minutes). The default of 2 minutes is shorter than a first install or a large deck. A render that is cut short keeps the slides it measured in its `metrics.json`.
- **Slide numbers.** Everything the presenter sees, every file name (`slide-NN.png`, `verdicts/slide-NN.json`) and every `--slides` argument uses start-of-pass numbers (`start_no` in `slide-map.json`). Only manage-slides.py and the reviewer's `merge_with` use current numbers.
- **Line ranges.** Before every edit, take the slide's `source_file`, `start_line` and `end_line` from `<RUN>/slide-map.json`, never from memory: earlier edits in the same file shift lines. After every edit that changes the line count, update the map (see "Edit helpers").
- **Latest metrics.** A round folder contains only the slides rendered in that round. The latest metrics of a slide are its entry in the most recent round that contains it:

  ```bash
  for n in $(seq 1 <last round>); do f="<RUN>/round-$n/metrics.json"; [ -f "$f" ] && cat "$f"; done \
    | jq -s 'add | group_by(.start_no) | map(last)' > <RUN>/tmp/latest.json
  ```

  An entry carries `no` (current number), `start_no`, `png` (relative to `<RUN>`), `source`, `layout`, `fill_ratio`, `vertical_spread`, `overflow`, `min_body_pt`, `min_label_pt`, `words`, `elements`, `columns`, `gap`, `flags` and `render_error`.
- **Progress lines.** After every render, print one line per rendered slide in this format, built from that round's `metrics.json` (not from memory):

  ```bash
  jq -r '.[] | "slide \(if .start_no < 10 then "0" else "" end)\(.start_no)  fill \(if .fill_ratio == null then "n/a" else (.fill_ratio * 100 | round / 100 | tostring) end)  spread \(if .vertical_spread == null then "n/a" else (.vertical_spread * 100 | round / 100 | tostring) end)  flags: \(if .render_error then "render-error" elif (.flags | length) == 0 then "none" else (.flags | join(", ")) end)"' <RUN>/round-<r>/metrics.json
  ```

### Ledger

Keep a ledger in the conversation with one row per slide in scope: start-of-pass number, rounds used (0 to `MAX_ROUNDS`), fix keys already tried, changed-since-last-render (yes/no), and final state (open, balanced, intentional, skipped, pending image, handed back, merged). A fix key is the fix id plus its `change` JSON; a zoom walk counts as tried `zoom` whatever the target. `decisions.jsonl` is the durable record; the ledger only steers the loop.

A **fix round** is a round in which a fix was applied to the slide (automatic or approved), including a fix that was reverted afterwards (FR-020). A pending image, a skip, a recorded verdict or a rejected candidate uses no round.

### Recording a decision

Append one JSON line to `<RUN>/decisions.jsonl` per decision, then run the report. First Write the reason (one sentence, from the verdict, the flags or the counts) to `<RUN>/tmp/reason.txt`; write an empty file when there is none:

```bash
jq -nc \
  --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --argjson start_no <S> --argjson no <C> --argjson round <r> \
  --arg fix_id "<fix id>" --arg kind "<auto|approval>" --arg outcome "<outcome>" \
  --rawfile reason <RUN>/tmp/reason.txt \
  --arg file "<source_file>" --argjson start <start_line> --argjson end <end_line> \
  --rawfile text <RUN>/tmp/before-NN.md \
  '{ts: $ts, start_no: $start_no, no: $no, round: $round, fix_id: $fix_id, kind: $kind, outcome: $outcome}
   + (($reason | rtrimstr("\n")) as $r | if $r == "" then {} else {reason: $r} end)
   + {before: {file: $file, start: $start, end: $end, text: $text}}' >> <RUN>/decisions.jsonl
node ${CLAUDE_PLUGIN_ROOT}/scripts/balance/report.mjs --run <RUN>
```

- `outcome` is one of `applied`, `skipped`, `rejected-limits`, `reverted`, `pending-image`, plus `handed-back` for hand-backs.
- Every applied edit carries `before` with the exact slide text before the edit (the revert record, FR-033). `start` and `end` are the slide's lines before the edit.
- Records without an edit (`skipped`, `rejected-limits`, `pending-image`, `handed-back`, recorded verdicts) drop the `--arg file`, `--argjson start`, `--argjson end`, `--rawfile text` arguments and the `+ {before: ...}` part.
- Special fix ids: `verdict-intentional` (kind `auto`, outcome `skipped`) records an intentional verdict; `handed-back` (kind `auto`, outcome `handed-back`) records a hand-back. Add `--arg after_png "<png>"` and `+ {after_png: $after_png}` to point at the latest render when useful.

### Edit helpers

At the start of the pass, Write this helper to `<RUN>/tmp/slide-text.cjs`. It reads or replaces an exact line range without touching anything else in the file:

```js
// slide-text.cjs get <file> <start> <end>         prints the lines, joined, no trailing newline
// slide-text.cjs put <file> <start> <end> <text>  replaces the lines with the text file's lines
//   (start = end + 1 inserts after line end; an empty text file deletes the range)
const fs = require('fs');
const [mode, file, s, e, textFile] = process.argv.slice(2);
const start = Number(s), end = Number(e);
const raw = fs.readFileSync(file, 'utf8');
const eol = raw.includes('\r\n') ? '\r\n' : '\n';
const lines = raw.split(/\r?\n/);
const trailing = lines.length > 1 && lines[lines.length - 1] === '';
if (trailing) lines.pop();
if (!(start >= 1 && end >= start - 1 && end <= lines.length)) { console.error(`bad range ${start}-${end}`); process.exit(2); }
if (mode === 'get') { process.stdout.write(lines.slice(start - 1, end).join(eol)); process.exit(0); }
if (mode !== 'put') { console.error('mode must be get or put'); process.exit(2); }
const text = fs.readFileSync(textFile, 'utf8');
const repl = text === '' ? [] : text.split(/\r?\n/);
lines.splice(start - 1, end - start + 1, ...repl);
fs.writeFileSync(file, lines.join(eol) + (trailing ? eol : ''));
const delta = repl.length - (end - start + 1);
console.log(`DELTA ${delta} END ${end + delta}`);
```

- **Slide text:** `node <RUN>/tmp/slide-text.cjs get <DECK>/<source_file> <start_line> <end_line>`. Save it as `<RUN>/tmp/before-NN.md` before any edit.
- **After an edit that changed the line count** (`line_delta` from `apply-auto-fix.mjs`, or `DELTA` from `put`), shift the map; this also moves the edited slide's own `end_line` to the new end:

  ```bash
  node ${CLAUDE_PLUGIN_ROOT}/scripts/balance/slide-map.mjs shift-lines --map <RUN>/slide-map.json \
    --file <source_file> --after-line <old end_line> --delta <delta>
  ```

  Check that the slide's `end_line` in the map now equals `end_after` (or the `END` value).
- **Refresh the layouts** after every edit and its shift (automatic fixes, image placements, content fixes, reverts), except inside a split or merge, where 7.4 takes the layouts from the fresh map. The map's `layout` is computed when the map is built, and the zoom previews, candidate files, merge candidates and the renderer's metrics all read it, so it must follow a layout change:

  ```bash
  node ${CLAUDE_PLUGIN_ROOT}/scripts/balance/slide-map.mjs refresh-layout --map <RUN>/slide-map.json --deck <DECK> --entry <ENTRY>
  ```

  It prints `LAYOUT <S> <old> -> <new>` per changed slide and `LAYOUTS changed=<n>`. Exit 1: the map no longer matches the deck (the message names the slide; the map is unchanged); stop the loop, tell the presenter, and go to Step 10.
- **Revert** an edit: `put` the decision's `before-NN.md` back into the range it came from, at its current position (the slide's `start_line` to its current `end_line`, or the current lines of the `frontmatter_overrides` block that was edited), shift the map by the printed `DELTA`, refresh the layouts, and record a decision with the same `fix_id` and outcome `reverted`.

## Step 0: Arguments, deck, run folder

1. **Parse `$ARGUMENTS`.**
   - `range`: the first argument that does not start with `--`: `N`, `N-M` or a comma list such as `2,5-7`. Default: all slides.
   - `--palette <default|okabe-ito|custom|harvested>`: re-choose the box palette in Step 3.
   - `--max-rounds N`: a positive integer. `MAX_ROUNDS` is `N`, capped at `max_rounds` from the thresholds (3); default is `max_rounds`.
   - Anything else: show the usage line from the frontmatter and stop.
2. **Locate the deck** the way `/slidev:continue` does: if `./slides.md` exists, the deck is the current directory; otherwise run `find . -name slides.md -type f -not -path "*/node_modules/*" -not -path "*/exports/*"`. None: say no presentation was found and stop. Several: ask with AskUserQuestion which one. `<DECK>` is its directory (absolute), `<ENTRY>` is `slides.md`.
3. **Create the run folder:** `<RUN>` = `<DECK>/exports/balance/$(date +%Y%m%d-%H%M%S)`; `mkdir -p <RUN>/verdicts <RUN>/previews <RUN>/tmp`. Write the edit helper (above).
4. **Thresholds:**

   ```bash
   node --input-type=module -e "import {loadThresholds} from '${CLAUDE_PLUGIN_ROOT}/scripts/balance/flag.mjs'; console.log(JSON.stringify(loadThresholds(process.argv[1]), null, 2))" \
     ${CLAUDE_PLUGIN_ROOT}/references/design-constraints.md > <RUN>/tmp/thresholds.json
   ```

5. **Slide map:**

   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/scripts/balance/slide-map.mjs build --deck <DECK> --entry <ENTRY> --out <RUN>/slide-map.json
   ```

   Prints `SLIDEMAP <file> slides=<total> hidden=<h>`. Exit 1 (missing or circular `src:` import): show the message and stop.
6. **Scope.** Validate the range against `1-<total>` (start-of-pass numbers, hidden slides included). Out of range: refuse with `valid range 1-<total>` and stop. The scope is the slides in range; hidden ones (`hidden: true`) are not rendered and the report lists them as skipped (FR-001). Add every non-hidden slide in scope to the ledger.

## Step 1: Render tooling

First check without installing:

```bash
bash ${CLAUDE_PLUGIN_ROOT}/scripts/balance/render-slides.sh ensure --check --deck <DECK> --entry <ENTRY>
```

- `INSTALL_NEEDED <what>`: tell the presenter now that a one-time install of `<what>` into the plugin cache starts and can take a few minutes (FR-006), then run the install below.
- `RENDER_READY <cache>`: skip the install and continue with Step 2.
- Exit 3 (node, npm or jq missing): show the setup hint from stderr verbatim and stop. Exit 1 or 2: show stderr and stop.

Install (timeout 600000, see Conventions):

```bash
bash ${CLAUDE_PLUGIN_ROOT}/scripts/balance/render-slides.sh ensure --deck <DECK> --entry <ENTRY>
```

- `NOTICE: installing ...`: the one-time install ran.
- `RENDER_READY <cache>`: continue.
- Exit 3: the render environment is unavailable (offline, install failed). Show the setup hint from stderr verbatim and stop. There is no text-only fallback.
- Exit 1 or 2: show stderr and stop.

## Step 2: Dev server

```bash
bash ${CLAUDE_PLUGIN_ROOT}/scripts/balance/render-slides.sh server start --deck <DECK> --entry <ENTRY>
```

Prints `SERVER main port=<p> owned=<bool>`: the script reuses a running server for this deck or starts one on a free port (research R5). Exit 1: show the last 20 lines of the server log (from stderr, or `tail -n 20 <DECK>/exports/balance/server-main.log`) and stop. Exit 3: the deck cannot be served (Slidev is not installed in the deck, or `curl` or `yq` is missing): show the hint from stderr verbatim and stop. Never run the install command from the hint yourself (Guarantee 2); the presenter installs the deck's dependencies and runs the pass again. Exit 2: show stderr and stop. Stopping here needs no Step 10: no server was started and nothing was rendered.

From here on, every way out of the pass (finished, stopped on an error, ended by the presenter) goes through Step 10, so owned servers are stopped and the report is current.

## Step 3: Deck state at pass start

**Presentation config.** `<CONFIG>` is the first that exists of: `<DECK>/presentation-config.md`; `presentation-config.md` in the directory that holds the deck's `brainstorm.md` (the deck directory or its parent, where `/slidev:frame` saves it). If none exists, `<CONFIG>` is `<DECK>/presentation-config.md` and is created on the first write. Read the stored preferences:

```bash
yq --front-matter=extract -o=json '.balance // {}' <CONFIG>
```

This step first decides which slides change before round 1, renders those slides once as they are (the baseline), and only then changes them, so the report has a genuine before image for each of them (FR-033).

**Box styles (FR-025).** Find the slides that use boxes: `rg -n 'class="[^"]*\bbx\b' <DECK>/<ENTRY> <DECK>/slides` and map each hit to the slide-map entry whose `source_file` matches and whose `start_line` to `end_line` contains the line. Then decide, without writing anything yet:

- `--palette` given: every box slide changes.
- Otherwise, when `balance.boxes` exists, check whether the deck stylesheet would change:

  ```bash
  node ${CLAUDE_PLUGIN_ROOT}/scripts/balance/box-styles.mjs generate --deck <DECK> --config <CONFIG> --check
  ```

  `CHANGED` (the palette was edited since the last pass): every box slide changes. `UNCHANGED`: nothing to do. `--check` writes nothing. Exit 1: the stored palette fails validation; show the failing rules and treat the deck as having no palette (the next accepted box fix asks again).
- Box slides that change and are outside the range are added to the round-1 render (`--slides`), so every slide using the style is re-rendered (FR-020).

**Pending images (FR-031).** Read `<DECK>/exports/balance/pending-images.json` (missing means none). For each entry, find its slide in the map: same `source_file` and the slide's first `# ` heading equal to `slide_title`; failing that, `start_no == no_at_creation` in the same `source_file`. No match: say so and keep the entry. Then:

- The file at `target_file` exists and the slide is in scope: the image is **placed at pass start** (below).
- The file does not exist yet: the slide is **pending**. Remember it for the loop and for Step 9.7; the entry stays.

**Baseline render (round 0).** If any slide changes before round 1 (the box slides that change, the slides whose image is placed at pass start), render exactly those slides before any change (timeout 600000):

```bash
bash ${CLAUDE_PLUGIN_ROOT}/scripts/balance/render-slides.sh render --deck <DECK> --entry <ENTRY> \
  --run <RUN> --round 0 --slides <comma list of start-of-pass numbers>
```

Round 0 writes `<RUN>/round-0/`. It is not a fix round and is never judged: round 1 renders all these slides again, the latest metrics (Conventions) start at round 1, and the report shows round 0 as the before image of these slides. On a non-zero exit, say so in one line and continue; those slides then only get an after image.

**Apply the pass-start changes**, after the baseline:

- Box slides, `--palette` given: run the palette question of Step 8.2 with that palette as the first, recommended option, store and generate as described there, and mark every box slide changed.
- Box slides, `CHANGED` above: regenerate the deck stylesheet and mark every box slide changed:

  ```bash
  node ${CLAUDE_PLUGIN_ROOT}/scripts/balance/box-styles.mjs generate --deck <DECK> --config <CONFIG>
  ```

- Each image placed at pass start: fit and place it (Step 9.6, with the entry's `aspect`, `gap` and `placement`), record the placement (the entry's `fix_id`, kind `approval`, outcome `applied`, round 1, reason "pending image placed"), and remove the entry from `pending-images.json`. Round 1 then verifies the slide.

## Step 4: Round 1 render

```bash
bash ${CLAUDE_PLUGIN_ROOT}/scripts/balance/render-slides.sh render --deck <DECK> --entry <ENTRY> \
  --run <RUN> --round 1 [--slides <range>]
```

- Pass `--slides` only when a range was given (start-of-pass numbers). This writes `<RUN>/round-1/slide-NN.png` and `<RUN>/round-1/metrics.json` with `flags` filled.
- Print the progress lines (see Conventions).
- Clear the changed flag of every slide this render covered. The pass-start changes of Step 3 are verified by this render, so the loop's re-render (item 4) only picks up slides changed inside the loop (FR-020).
- Exit 2: the range is invalid for the renderer; show its message (it names the valid range) and go to Step 10.
- Exit 1: show stderr and go to Step 10.
- A slide with `render_error` failed to render: say which one, keep it out of the loop (it is never judged and never reported as balanced) and continue with the others.
- Run `report.mjs --run <RUN>`.

A slide with no flags is done (FR-010): it is never sent to the reviewer.

## Steps 5 to 7: The fix loop

Steps 5, 6 and 7 form one loop over rounds `r = 1, 2, ...`. Each iteration:

1. Compute the latest metrics (Conventions). For a pending slide (its image file does not exist yet), remove `sparse` and `low-spread` from its flags, and `lopsided` too when its `gap` is the column the image will fill (FR-031); if nothing remains, it is not active and uses no round. The **active slides** are the ledger slides whose state is open, whose latest metrics have no `render_error` and still carry flags. The reviewer gets the filtered flags.
2. If there are no active slides, offer "I placed it" for pending slides (Step 9.7); if nothing was placed, leave the loop.
3. For each active slide, in start-of-pass order:
   - If its rounds used equal `MAX_ROUNDS`, hand it back (see "Hand-back") and continue with the next slide. A slide still marked changed (a fix reverted in the previous iteration, so its last render shows the overflowing state) is not handed back yet: it **waits for hand-back**, gets no per-round step, is re-rendered in item 4 and decided in item 5. The same applies to any other hand-back of a slide still marked changed.
   - Run the **per-round step** (Steps 5, 6 and 7 below).
4. **Re-render** every slide still marked changed (changed in this iteration, or reverted in an earlier one and not rendered since), in one call so the round folder gets one `metrics.json` (FR-020), and clear their changed flags:

   ```bash
   bash ${CLAUDE_PLUGIN_ROOT}/scripts/balance/render-slides.sh render --deck <DECK> --entry <ENTRY> \
     --run <RUN> --round <r+1> --slides <comma list of start-of-pass numbers>
   ```

   Print the progress lines. If no slide was marked changed, leave the loop.
5. **Waiting hand-backs.** For each slide waiting for hand-back, use its new metrics: no flags left means it is done (state balanced); otherwise hand it back now, with the PNG of this render as `after_png`. It is not offered more fixes.
6. **Overflow and render check.** For each slide fixed in this iteration whose previous metrics had no `overflow` and whose new metrics have it, or whose previous render succeeded and whose new metrics have a `render_error` (the edit broke the slide), revert the fix (see Edit helpers), record `reverted` with the reason (`overflow` or the render error), and tell the presenter. The round still counts. Mark the slide changed again so the next render measures the restored source; until then, use its metrics from before the fix (the restored text is identical to it).
7. Run `report.mjs --run <RUN>` and continue with the next round.

### Step 5: Judge the slide

Dispatch the `visual-reviewer` agent with the Task tool, `subagent_type: "slidev:visual-reviewer"`, one call per slide. The calls of one round are independent, so dispatch them in parallel (several Task calls in one message), then process the verdicts one slide at a time.

The prompt contains only these items, nothing from neighbor slides or from this session (FR-012):

````markdown
Judge one rendered slide for /slidev:balance. Round: <r>.

Slide image (Read it first): <RUN>/<png from the latest metrics>
References: ${CLAUDE_PLUGIN_ROOT}/references/balance-fixes.md and ${CLAUDE_PLUGIN_ROOT}/references/box-styles.md

Metrics:
```json
<the slide's latest metrics entry>
```

Thresholds:
```json
<contents of <RUN>/tmp/thresholds.json>
```

Slide source (<source_file>, lines <start_line> to <end_line>):
```markdown
<slide text from slide-text.cjs get>
```

Return exactly one fenced json Verdict block.
````

Parse the single fenced `json` block from the result and Write it to `<RUN>/verdicts/slide-NN.json` (it replaces the verdict of an earlier round; keep the earlier one as `<RUN>/verdicts/slide-NN.round-<r-1>.json` if it exists). If there is no parseable block, or the verdict breaks the schema in `balance-fixes.md`, dispatch once more; if it fails again, hand the slide back with the reason "no valid verdict".

Sanity rules on the verdict before using it:

- `kind: "auto"` is valid only for `layout` and `zoom`; treat any other fix marked `auto` as `approval`.
- Drop a `zoom` fix whose target is not above the current zoom or above `zoom.max` from the thresholds, and any `zoom` fix on a slide flagged `overflow` or `crowded`.
- `intentional: true` counts only when every remaining flag is a density flag (`sparse`, `low-spread`, `lopsided`). Otherwise treat it as `false`.

**Intentional, or balanced with no fixes.** If the verdict is intentional, or it says `balanced` with no fixes and every remaining flag is a density flag, record `verdict-intentional` (kind `auto`, outcome `skipped`, the verdict's reason) and set the slide's state to intentional. Tell the presenter they can make it permanent with `balance: sparse-ok` in the slide frontmatter. No fix, no round.

**No usable fix.** If a hard flag (`overflow`, `small-text`, `small-labels`) remains and the verdict has no fixes, dispatch once more and say in the prompt that this slide needs fixes. Still none: go to Step 7 for overflow (it adds the content fixes itself), otherwise hand the slide back.

### Step 6: Automatic fix

Take the highest-ranked fix with `kind: "auto"` whose fix key is not yet tried for this slide (FR-014). If there is none, go to Step 7.

**Target block.** A key set by an importing `src:` block wins over the imported file in Slidev. If the slide's map entry lists the key in `frontmatter_overrides` (`{layout|zoom|class: {file, start_line, end_line}}`), the `--set` for that key goes to that block: `--file <DECK>/<block.file> --start <block.start_line> --end <block.end_line>`. Keys not listed there go to the slide's own range (`source_file`, `start_line`, `end_line`). Slot markers always go to the slide's own range, so a `layout` fix with `slots` on an overridden slide takes two calls: `--slots` on the slide's range, then `--set layout=` on the importer block (record one decision per call). The current zoom is the one in the block that wins.

**`layout`.** If the target is `image-right`, `image-left` or `image` and the slide's frontmatter has no `image:` key, the fix is outside the automatic boundary: mark it tried and take the next one. Otherwise:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/balance/apply-auto-fix.mjs --file <DECK>/<file> \
  --start <start> --end <end> --set layout=<layout> [--slots <placements and removals, comma-separated>] \
  > <RUN>/tmp/fix-NN.json
```

`slots` `{right: n}` maps to `--slots right=<n>`, `{left: n, right: m}` to `--slots left=<n>,right=<m>`.

**Slot markers the target layout lacks (FR-014, SC-005).** Content after a slot marker that the target layout has no slot for is not rendered, so a layout change must remove those markers in the same call. Find the markers in the slide body (lines that are only `::<name>::`, outside code fences). Slots per layout: `two-cols` has `left` and `right`; `two-cols-header` has `left`, `right` and `bottom`; every other layout has only the default slot (`::default::` is always valid). For each existing `::left::` or `::right::` marker the target lacks, add `remove-<slot>` to `--slots` (comma-separated with any placement, for example `--slots remove-left,remove-right` when switching `two-cols-header` to `default`). If the slide has a marker the target lacks and `apply-auto-fix.mjs` cannot remove (any name other than `left` or `right`, such as `::bottom::`), the fix is outside the automatic boundary: mark it tried and take the next one.

**`zoom`.** Walk up in `zoom.step` steps without touching the slide, using previews, then apply the chosen value once:

1. Start at the current zoom (frontmatter `zoom`, default 1.0) plus `zoom.step` from the thresholds (0.1). Walk up to the reviewer's target; if the fill ratio is still below the band there, continue up to `zoom.max` (1.5).
2. For each step `z`: get the slide text into `<RUN>/previews/slide-NN-zoom-<z>.md`, then on that copy only run `apply-auto-fix.mjs --file <copy> --start 1 --end <copy line count> --set layout=<effective layout> --set zoom=<z>` (the effective layout from the map, so the preview neither falls back to the first-slide layout nor misses a layout set by an importer block). Render it:

   ```bash
   bash ${CLAUDE_PLUGIN_ROOT}/scripts/balance/render-slides.sh preview --deck <DECK> --entry <ENTRY> \
     --run <RUN> --name slide-NN-zoom-<z> --slide-file <RUN>/previews/slide-NN-zoom-<z>.md
   ```

   The preview prints its metrics JSON on stdout (parse the last line that starts with `{`).
3. Stop at the first `z` whose preview fill ratio is inside the band (FR-014). If a step overflows or goes above the band, use the previous step. If there is no previous step, because the first step already overflows or lands above the band, mark `zoom` tried and take the next automatic fix: nothing is applied, no decision with outcome `applied` is recorded and no round is used. Never apply a value equal to the current zoom (a no-op edit).
4. Apply the chosen value to the real slide with `apply-auto-fix.mjs --set zoom=<z>` (same form as `layout`).

**After `apply-auto-fix.mjs`:**

- Exit 0: `<RUN>/tmp/fix-NN.json` holds `{before, after, end_after, line_delta}`. Save `jq -j .before <RUN>/tmp/fix-NN.json > <RUN>/tmp/before-NN.md`, shift the map when `line_delta` is not 0 (`--file` is the edited file, relative to the deck; this also shifts `frontmatter_overrides` blocks), refresh the layouts (Edit helpers), record the decision (kind `auto`, outcome `applied`, `before` with the edited file and its old line range), mark the slide changed and add one round used. A revert puts `before` back into that same file and range.
- Exit 1 (the edit would change body text, or a slot marker would land inside an open HTML or component block such as `<v-clicks>`) or exit 2 (invalid key, zoom or slot spec): nothing was written. Mark the fix tried, mention it in one line, and try the next automatic fix in this same round.

Tell the presenter in one line what was applied, for example `slide 02  zoom 1.3 applied (round 1)`.

### Step 7: Approval fixes

Reached when the slide is still flagged and no untried automatic fix is left. Offer the verdict's approval fixes to the presenter; this step is described in the section "Step 7 in detail" below.

### Hand-back

A slide that used `MAX_ROUNDS` fix rounds and is still flagged, or for which no fix is left, is handed back (FR-019). Never hand back a slide that is still marked changed: its latest render does not show its current source (for example after a reverted fix), so re-render it first (loop item 4, or Step 10 when the pass ends) and decide on the new metrics. Then record `handed-back` with the remaining flags as `reason` and the latest PNG as `after_png`, set its state to handed back, and tell the presenter with the screenshot paths (first and latest round). A slide still flagged `overflow` is listed in the report as `failing: overflow`.

## Step 7 in detail

Approval fixes change what is on the slide, so each one is shown as a rendered preview next to the current rendering and applied only after the presenter picks it (FR-016). One question per slide.

### 7.1 Candidates

1. **From the verdict:** the fixes with `kind: "approval"`, in rank order, minus fix keys already tried for this slide.
2. **Overflow always gets content fixes (FR-015).** For a slide flagged `overflow`, add `split` and `move-to-notes`, and `diagram-resize` when the slide has a diagram (a `mermaid` or `plantuml` fence, `<Excalidraw`, an inline `<svg>`, or an image whose path contains `diagram`), for each one the reviewer did not rank. Compose their `change` yourself from the slide source, following "Change Shapes" in `balance-fixes.md`: split at the idea boundary, move explanation into the notes, resize the diagram while keeping labels at or above 14pt. Use only material already on the slide or in its notes, and never shrink text. Rank them after the reviewer's fixes.
3. **Merge outside the range.** For a `merge`, find the neighbor in the map by `current_no == merge_with`. If its start-of-pass number is outside the scope, first ask with AskUserQuestion: "Merging slide NN also changes slide MM, which is outside the range you asked for. Offer the merge?" (options "Offer it", "Leave it out"). Leave it out: drop the candidate. Also drop a merge that would remove the first slide of `<ENTRY>` (its frontmatter is the deck headmatter); the reverse merge into it is fine.
4. **Candidate file** `<RUN>/previews/slide-NN-<id>.md`, never inside the slide files:
   - `notes-extend`, `move-to-notes`, `diagram-resize`, `boxes`: the slide's frontmatter block with `layout:` set to the effective layout from the map (add the key when missing), an empty line, then `change.markdown`. Box candidates get the preview stylesheet from Step 8.1.
   - `split`: the first resulting slide as above; each further one follows after a `---` line and an empty line, without frontmatter.
   - `merge`: the merged slide, composed by you from the neighbor's source: the neighbor's frontmatter and title, the neighbor's content and the contributed `change.markdown` in slide order (neighbor first when `merge_with` is `C - 1`, contribution first after the title when it is `C + 1`), and one notes block that joins both notes in the same order. Set `layout:` in the candidate's frontmatter to the neighbor's `layout` from the map (its effective layout; add the key when missing, replace it when the neighbor's frontmatter has another value because an importer block overrides it), so the preview, which is always slide 1 of the preview deck, does not fall back to `cover`.
   - `image-ai`, `image-stock`: see Step 9.1.
5. **Hard limits (FR-018).** Count every candidate (for `split`, every resulting slide, each written to its own `<candidate>-<i>.md` for counting):

   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/scripts/balance/count-limits.mjs --file <candidate>
   ```

   It prints `{"elements": <n>, "words": <n>}`. A candidate over `hard_limits.max_elements` or `hard_limits.max_words` is dropped and never shown: record `rejected-limits` (kind `approval`, reason with the counts).
6. **Preview.**

   ```bash
   bash ${CLAUDE_PLUGIN_ROOT}/scripts/balance/render-slides.sh preview --deck <DECK> --entry <ENTRY> \
     --run <RUN> --name slide-NN-<id> --slide-file <RUN>/previews/slide-NN-<id>.md
   ```

   It writes `<RUN>/previews/slide-NN-<id>.png` (for `split`, `slide-NN-split-1.png`, `slide-NN-split-2.png`, ...) and prints the preview metrics as JSON (for `split`, one object per resulting slide; parse every stdout line that starts with `{` or `[`). The slide files stay untouched (FR-017). A preview that fails is dropped with its error in one line. A preview that overflows is dropped too, unless dropping it would leave an overflowing slide without any option; then keep the least overflowing one and say that it still overflows.
7. **Side by side.** For each remaining candidate:

   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/scripts/balance/side-by-side.mjs --left <RUN>/<latest png> \
     --right <RUN>/previews/slide-NN-<id>.png --out <RUN>/previews/slide-NN-<id>-compare.png
   ```

   For `split`, one composite per resulting slide (`-compare-1.png`, ...). Read every composite with the Read tool before asking, so the descriptions match what the images show, and open the first one for the presenter (`open <png>` on macOS, `xdg-open <png>` on Linux when available; otherwise print the path).

If no candidate is left: an overflowing slide is handed back (it stays `failing: overflow`), any other slide is handed back with the reason "no fix within the hard limits".

### 7.2 The question

One AskUserQuestion per slide:

- `header`: `Slide NN`
- `question`: the flags and the verdict's reason in one sentence, then "Which fix?"
- `options`: the candidates in rank order. `label`: a short name ("Extend from notes", "Split in two", "Move detail to notes", "Resize diagram", "Boxes", "Merge with slide MM", "Image"). `description`: the fix summary, the projected counts, the preview's fill ratio, and the composite path.
- Add "Skip" (description "Leave the slide unchanged") as the last option, **except** when the slide is flagged `overflow` (FR-015). AskUserQuestion takes at most 4 options: offer at most 3 candidates plus "Skip", or at most 4 candidates for overflow.
- "Other" answers: "stop" or "end the pass" goes to Step 10. A requested tweak to a candidate ("keep the second bullet") rebuilds that candidate (same source-material rule), re-counts, re-previews and asks again.

Outcomes:

- **Skip:** record `skipped` (fix id of the top candidate, kind `approval`, reason naming the offered fixes) and set the slide's state to skipped. The slide file is byte-for-byte unchanged.
- **A candidate:** apply it (7.3), record `applied` (kind `approval`, `before` with the exact slide text), mark the slide changed and add one round used. It is re-rendered and re-measured with the next round (US2 AS4). Box fixes run Step 8.2 first. Image fixes continue in Step 9 instead of 7.3; only a placed image uses a round, a prompt handover does not.

### 7.3 Applying an accepted fix

**Content fixes** (`notes-extend`, `move-to-notes`, `diagram-resize`, `boxes`):

1. `get` the slide into `<RUN>/tmp/before-NN.md`.
2. Write `<RUN>/tmp/after-NN.md`: the slide's head lines exactly as in the source (from `start_line` through the closing `---` of its frontmatter, or just the bare `---` separator line, or nothing when the slide starts with content on line 1 of its file), an empty line, then `change.markdown`. End with an empty line when another slide follows in the same file. Never add the preview's explicit `layout:` to the real slide.
3. `put` it into `start_line` to `end_line`, shift the map by `DELTA`, refresh the layouts, record the decision.

**Structural fixes** use the plugin's slide management where the deck allows it. The deck is in **manage-slides format** when `<ENTRY>` is `slides.md`, the slide's `source_file` is `slides/<NN>-<slug>.md`, its `src:` block in the entry is followed by a `<!-- Slide N: ... -->` comment, and every `src:` block in the entry has no key other than `src:` (manage-slides.py rewrites those blocks with `src:` only, so other keys such as `hide:` would be lost). `N` in the commands below is the number in that comment, not the start-of-pass number.

**`split`** (the first resulting slide replaces the current one, the others follow it):

1. `get` the slide into `<RUN>/tmp/before-NN.md`; apply the first resulting slide like a content fix.
2. Manage-slides format: for each further slide `i` (1-based), run from the deck directory

   ```bash
   cd <DECK> && python3 ${CLAUDE_PLUGIN_ROOT}/scripts/manage-slides.py add <N + i> --title "$(cat <RUN>/tmp/title-NN-<i>.txt)" --renumber
   ```

   Write the title of slide `i` to `<RUN>/tmp/title-NN-<i>.txt` first (Conventions: free text never goes on a command line).

   Locate the new file after the call; the `File: slides/<name>` line it prints is the name before renumbering (`NN-<slug>.md` with `NN` = `N + i`), and `--renumber` then renames files by position (`02-` for the first imported slide), which can rename the new file too. Use the output: a line `  <name> -> <renamed>` means the new file is now `slides/<renamed>`; without such a line it kept `slides/<name>`. Confirm it in the rebuilt `<ENTRY>`: the `src: ./slides/<file>` block directly above the comment `<!-- Slide <n>: <title of slide i> -->` names that file (renumbering changes `<n>` too, so match the title). If the two disagree, trust the entry file. Write that file with the slide's markdown only (it replaces the template, no frontmatter).
   Otherwise (single-file deck, or another import style): insert the further slides into the same source file directly after the slide, with `put` at `start = end_line + 1`, `end = end_line` and a text file holding, per slide, a `---` line, an empty line, the markdown and an empty line.
3. Update the map (7.4) with `k` = number of further slides. Record the decision on the split slide. The new slides join the scope (ledger rows with the split slide's rounds used, marked changed) and are rendered with the next round.

**`merge`** (the neighbor keeps the merged content, this slide is removed):

1. `get` both slides into `before-NN.md` and `before-MM.md`.
2. `put` the merged slide (the neighbor's own head lines, never the candidate's explicit `layout:`, an empty line, the merged body) into the neighbor's range.
3. Remove this slide. Manage-slides format: `cd <DECK> && python3 ${CLAUDE_PLUGIN_ROOT}/scripts/manage-slides.py delete <N> --renumber`. Otherwise:
   - **The slide is the only slide its `src:` block imports**: the slide's `source_file` is not the entry file, no other map entry (merged ones excluded) has the same `source_file`, and the importing block (`rg -n 'src:' <DECK>/<ENTRY> <DECK>/slides` finds the block naming that file) imports nothing else. Remove that `src:` block from the importing file with `put` of an empty text file into the block's lines (its opening `---` through the line before the next separator), and leave the imported file in place. Shift the map for the importing file.
   - **Otherwise** (the slide is in the entry file, or its file holds further slides): delete only this slide's lines with `put` of an empty text file into its range, and keep the `src:` block, which still imports the other slides. When the slide starts at line 1 of its file and the next slide in that file opens with a bare `---` separator (followed by a blank line or content, not by frontmatter keys), delete that separator line too, so the file does not start with an empty slide. Shift the map for that file.
4. Update the map (7.4). Record two decisions: on this slide (`merge`, applied, its `before`, reason "merged into slide MM") and on the neighbor (`merge`, applied, its `before`, reason "received slide NN"). This slide's state becomes merged. The neighbor joins the scope if it was outside it, and is marked changed.

### 7.4 Slide map after a split or merge

Structural edits rename files (manage-slides.py renumbers `slides/NN-*.md`) and move lines, so refresh the map from the deck and keep the start-of-pass numbers:

1. Renumber the current numbers:
   - split: `slide-map.mjs renumber --map <RUN>/slide-map.json --after <C> --delta +<k>`
   - merge: `slide-map.mjs renumber --map <RUN>/slide-map.json --after <C> --delta -1`, then mark the removed slide: `jq 'map(if .start_no == <S> then . + {current_no: null, merged_into: <neighbor S>} else . end)'` (write via a temp file).
2. Build a fresh map: `slide-map.mjs build --deck <DECK> --entry <ENTRY> --out <RUN>/tmp/slide-map.fresh.json`.
3. Reconcile: the live entries of the old map (all without `merged_into`) match the fresh entries in order, with `k` new entries after the split slide. Paths and lines come from the fresh map; new slides get start-of-pass numbers above the highest existing one:

   ```bash
   jq --slurpfile f <RUN>/tmp/slide-map.fresh.json --argjson s <split slide S, or neighbor S for a merge> --argjson k <k, or 0 for a merge> '
     . as $old | $f[0] as $fresh
     | ($old | map(.start_no) | max) as $max
     | [ $old[] | select(.merged_into == null) ] as $live
     | ($live | map(.start_no) | index($s)) as $a
     | [ $live | to_entries[] | .key as $i
         | ($fresh[if $i <= $a then $i else $i + $k end]) as $m
         | .value + ($m | {source_file, start_line, end_line, layout, frontmatter_overrides}) + {fresh_no: $m.current_no} ] as $upd
     | [ range(1; $k + 1) as $j | $fresh[$a + $j] + {start_no: ($max + $j), split_from: $s} ] as $new
     | $upd[0:$a + 1] + $new + $upd[$a + 1:] + [ $old[] | select(.merged_into != null) ]
   ' <RUN>/slide-map.json > <RUN>/tmp/slide-map.next.json
   jq '[.[] | select(has("fresh_no") and .fresh_no != .current_no)] | length' <RUN>/tmp/slide-map.next.json
   ```

   The check must print `0` (the renumbered current numbers agree with the deck). Then `jq 'del(.[].fresh_no)' <RUN>/tmp/slide-map.next.json > <RUN>/slide-map.json`. If the check is not `0`, stop the loop, tell the presenter the slide map no longer matches the deck, and go to Step 10.

Slides created by a split are reported under their new start-of-pass numbers, with `split_from` naming the original slide.

## Step 8: Box fixes

Boxes are always an approval fix (FR-021), offered through Step 7. The markup, roles and palette rules are in `references/box-styles.md`.

### 8.1 Box candidates and previews

- **Markup check.** The candidate may use only the classes from `box-styles.md`: `bx-grid`, `bx`, `bx--main`, `bx--risk`, `bx--context`, `bx--takeaway`, `bx-label`, `bx-body`, `bx-badge`, `bx-punchline`. Check with `rg -o 'class="[^"]*"' <candidate>`: every `.bx` has exactly one role modifier, there are two or three boxes, at most one `bx--takeaway`, no `style=` attribute and no other class on box elements, and the box text is the slide's existing text. Fix class names yourself when only they are wrong; otherwise drop the candidate.
- **Preview stylesheet.** With a valid stored palette, the deck already has `styles/balance-boxes.css`, which the preview server loads through `styles/index.css`. Without one, generate a transient stylesheet from the `default` preset into the run folder (once per pass), never into the deck:

  ```bash
  node ${CLAUDE_PLUGIN_ROOT}/scripts/balance/box-styles.mjs generate --deck <DECK> --palette default \
    --out <RUN>/previews/boxes-default.css --scoped-safe
  ```

  Append it to the end of the candidate preview file only: an empty line, `<style>`, the file's CSS, `</style>`. The real slide never gets this inline style. `--scoped-safe` is required: Slidev turns every `<style>` in a slide into `<style scoped>`, and Vue's scoped transform rewrites plain `:root` and `html.dark` rules so they never match, which leaves the `--bx-*` variables undefined and the boxes untinted. The flag wraps every selector in `:global(...)`, which the transform unwraps without a scope attribute. Never pass it for the deck stylesheet.
- **Counting.** Bullets inside a box count as elements, a box without bullets as one, words inside boxes count (FR-026); `count-limits.mjs` applies these rules.

### 8.2 Palette on the first accepted box fix

When the presenter accepts a box fix and `<CONFIG>` has no valid `balance.boxes`, ask once for the deck (FR-022; with a stored palette, never ask again, US3 AS2):

- `header`: `Box palette`
- `question`: "Which palette should boxes in this deck use? It is stored in presentation-config.md and applies to every box."
- `options`: "Plugin default" (blue main, orange risk, slate context, purple takeaway), "Okabe-Ito" (colorblind-safe), "My brand colors" (four hex values), "Colors in the deck" (harvested from existing `bg-<color>-500/10` classes).

Per answer:

- **Plugin default / Okabe-Ito:** palette `default` / `okabe-ito`, no roles needed.
- **My brand colors:** ask for the values (the presenter types them through "Other") as `main=#hex,risk=#hex,context=#hex,takeaway=#hex`. Palette `custom`.
- **Colors in the deck:** `node ${CLAUDE_PLUGIN_ROOT}/scripts/balance/box-styles.mjs harvest --deck <DECK>` prints `{"colors": [{"name", "hex", "count"}]}`. With fewer than four colors, say so and ask again without this option. Otherwise propose a mapping (a gray or slate for `context`, an orange, amber or red for `risk`, the most used remaining color for `main`, the next for `takeaway`) and confirm it with AskUserQuestion ("Use this mapping", or a correction through "Other"). Palette `harvested`.

Store and generate:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/balance/box-styles.mjs set --deck <DECK> --config <CONFIG> \
  --palette <default|okabe-ito|custom|harvested> [--roles main=#hex,risk=#hex,context=#hex,takeaway=#hex]
node ${CLAUDE_PLUGIN_ROOT}/scripts/balance/box-styles.mjs generate --deck <DECK> --config <CONFIG>
```

- `set` validates the palette (four roles, distinct hues, no red/green pair, label contrast at least 4.5:1 in light and dark) and writes `balance.boxes` into the frontmatter of `<CONFIG>`, creating the file or its frontmatter when missing. It prints `WROTE <path>`. Exit 1: nothing was stored; show the failing rules and ask again.
- `generate` writes `<DECK>/styles/balance-boxes.css` and imports it once from `styles/index.css`.
- Then apply the box fix as a content fix (7.3) and mark every box slide changed, so the next round re-renders all of them with the stored palette (FR-020, FR-025).

The same question, with the `--palette` value as the first option, runs at pass start when `--palette` is given (Step 3).

## Step 9: Image fixes

Image fixes (`image-ai`, `image-stock`) are offered only when the reviewer judged that the picture carries the slide's one idea (FR-032); never add one yourself. The default is a prompt handover: no external service is called unless the presenter picks "Generate now" (FR-027, FR-029).

### 9.1 Placement mode and preview

Decide the placement from the slide's latest metrics:

- **Column:** the slide uses `two-cols` or `two-cols-header` and its `gap` is the empty column, or the slide uses the `default` layout. The image fills a column with `layout: image-right` (`image-left` when the empty column is the left one).
- **Inline:** every other layout. The image goes into the body as an `<img>` sized to `gap`.

The candidate preview file (Step 7.1) shows the result without an image file: for a column placement, the slide with `layout: image-right` (or `image-left`), no `image:` key and its slot markers removed, so the image half stays empty; for an inline placement, the body with a dashed placeholder `<div style="width:<w>px;height:<h>px;border:2px dashed currentColor;opacity:.5"></div>` where the image goes (sizes as in 9.6). For counting, an image adds one element and no words: count an inline candidate with the `<img>` in place of the placeholder, and add one element to a column candidate's count.

### 9.2 Which route

After the presenter picks an image fix, ask (AskUserQuestion, `header`: `Image`):

- After `image-ai`: "How should the image for slide NN be made?" with "Write the prompt (Recommended)" (the prompt goes to `ai-image-prompts.md`, any tool can make it), "Generate now" (an image tool or API you choose, asked once per deck), "Stock photo instead".
- After `image-stock`: show the search terms from `change.image.prompt`, then ask with "Show up to 3 candidates", "Write an AI prompt instead"; a URL the presenter types through "Other" is used directly (9.4).

Targets: `<slug>` comes from the reviewer's `change.image.file` (`public/images/<slug>.png`, lowercase kebab-case; derive it from the slide title when it does not match). The aspect is `change.image.aspect`; check it against the metrics `gap` with the rounding rule in `balance-fixes.md` and use the gap's value when they disagree. If the target file already exists, go straight to 9.6.

### 9.3 Prompt handover (default and fallback)

1. Append one section to `<DECK>/ai-image-prompts.md` (create it with a `# AI Image Prompts` heading when missing):

   ````markdown
   ## Slide NN: <slide title> (balance pass <run folder name>)

   - Target file: `public/images/<slug>.png` (the slide uses `/images/<slug>.png`)
   - Aspect ratio: <w:h>, empty area <gap.w>x<gap.h> px at x=<gap.x>, y=<gap.y>
   - Placement: <change.image.placement>
   - No text in the image.

   ```text
   <tool-neutral prompt; it must contain the aspect ratio and the sentence "No text in the image.">
   ```
   ````

   After an `image-stock` fallback there is no generation prompt yet: write one from the slide's idea in the same style (subject, style, calm area where text overlaps, aspect ratio, "No text in the image."), using only what the slide and its notes say.
2. Add the pending entry (FR-031). Write the entry as JSON to `<RUN>/tmp/pending-NN.json` with the Write tool (never inline: a title such as "What's next" would end a quoted string), then append it:

   ```bash
   P=<DECK>/exports/balance/pending-images.json; [ -f "$P" ] || echo '[]' > "$P"
   jq --slurpfile e <RUN>/tmp/pending-NN.json '. + $e' "$P" > "$P.tmp" && mv "$P.tmp" "$P"
   ```

   The entry: `{"no_at_creation": <S>, "source_file": "<source_file>", "slide_title": "<title>", "target_file": "public/images/<slug>.png", "aspect": "<w:h>", "prompt_ref": "ai-image-prompts.md", "created": "<ISO time>", "run": "<run folder name>", "fix_id": "<image-ai|image-stock>", "gap": <gap>, "placement": "<column-right|column-left|inline>"}`.
3. Record `pending-image` (kind `approval`, no `before`; the reason says why when this is a fallback). The slide file stays unchanged, no round is used, and the slide's state becomes pending image: it is not re-flagged for sparseness until the file exists.
4. Tell the presenter the target path, and that the slide gets the image either now ("I placed it", 9.7) or at the start of the next pass.

### 9.4 Stock photo

1. **Candidates** (on request): WebSearch for the search terms on Unsplash and on Pexels (for example `<terms> site:unsplash.com/photos` and `<terms> site:pexels.com/photo`), both licensed for reuse with attribution. Pick up to 3 photo pages whose description shows the slide's idea, and ask with one option per candidate (`label`: a short description, `description`: source, photographer when known, page URL) plus "None of these" (which goes to 9.3).
2. **Download URL:** an Unsplash page `https://unsplash.com/photos/<slug>-<id>` downloads from `https://unsplash.com/photos/<id>/download?force=true`; a Pexels page `https://www.pexels.com/photo/<slug>-<id>/` from `https://images.pexels.com/photos/<id>/pexels-photo-<id>.jpeg`. A URL the presenter typed is used as given.
3. **Fetch** into the deck's image folder:

   ```bash
   bash ${CLAUDE_PLUGIN_ROOT}/scripts/download-image.sh "$(cat <RUN>/tmp/url-NN.txt)" "<DECK>/public/images" "<slug>.jpg"
   ```

   Write the download URL to `<RUN>/tmp/url-NN.txt` first.

   Success means exit 0 and `file --mime-type -b <DECK>/public/images/<slug>.jpg` starts with `image/`. Otherwise delete any partial file and fall back to 9.3 with the reason (the script's error line) (FR-030).
4. **Attribution** goes into the slide's presenter notes as part of the placement edit (9.6): `Image: photo by <photographer> on Unsplash, <page URL> (Unsplash License)`, or the same for Pexels (Pexels License). Without a known name: `Image: photo on Unsplash, <page URL> (Unsplash License)`.

### 9.5 Generate now (opt-in)

1. **Route, once per deck.** If `<CONFIG>` has `balance.images`, ask "Generate with <route> (<model>)?" with "Use <route>" and "Change route". Otherwise, or on "Change route", ask for the route: `codex` (Codex CLI), `gemini-cli` (Gemini CLI with the nanobanana extension), `openai-api` (needs `OPENAI_API_KEY`), `gemini-api` (needs `GEMINI_API_KEY`). Then the model where it applies: `openai-api` default `gpt-image-1`, `gemini-api` default `gemini-2.5-flash-image`, `gemini-cli` optional (the extension's default), `codex` none. Offer the default as the recommended option; another model comes through "Other".
2. **Store the answer** (FR-029). If `<CONFIG>` is missing, create it with `---`, `balance: {}`, `---`; if it has no frontmatter, prepend that block. Then:

   ```bash
   ROUTE="<route>" MODEL="$(cat <RUN>/tmp/model.txt)" yq --front-matter=process -i \
     '.balance.images.route = strenv(ROUTE) | .balance.images.model = strenv(MODEL)' <CONFIG>
   ```

   `<route>` is one of the four fixed route names; Write the model name to `<RUN>/tmp/model.txt` first, since it can come from "Other".

   For `codex` (no model) use `'.balance.images.route = strenv(ROUTE) | del(.balance.images.model)'`.
3. **Check availability:** `bash ${CLAUDE_PLUGIN_ROOT}/scripts/balance/generate-image.sh --route <route> --check`. Exit 0 prints `AVAILABLE <route>`. Exit 3 prints `UNAVAILABLE <reason>`: fall back to 9.3 and tell the presenter the reason (FR-030).
4. **Generate:** Write the prompt to `<RUN>/tmp/prompt-NN.txt`, then (allow up to 10 minutes):

   ```bash
   bash ${CLAUDE_PLUGIN_ROOT}/scripts/balance/generate-image.sh --route <route> [--model "$(cat <RUN>/tmp/model.txt)"] \
     --prompt-file <RUN>/tmp/prompt-NN.txt --aspect <w:h> --out <DECK>/public/images/<slug>.png
   ```

   Exit 0 prints `IMAGE <file>`: continue with 9.6. Exit 1 (`FAILED <reason>`), 3 (`UNAVAILABLE <reason>`) or 2: fall back to 9.3 with the reason. The script never prints API keys; never echo them yourself.

### 9.6 Placement

1. **Fit** the file to the gap:

   ```bash
   bash ${CLAUDE_PLUGIN_ROOT}/scripts/balance/fit-image.sh --in <DECK>/public/images/<file> --aspect <w:h>
   ```

   `FITTED magick`: the file was cropped to the aspect. `FITTED css`: the file is unchanged and the slide crops it with `object-fit: cover`. Exit 1: treat it as `FITTED css`.
2. `get` the slide into `<RUN>/tmp/before-NN.md` (the revert record covers every edit of this placement).
3. **Column placement:** switch the layout and set the image with the approved flag, removing slot markers the new layout does not have:

   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/scripts/balance/apply-auto-fix.mjs --approved --file <DECK>/<source_file> \
     --start <start_line> --end <end_line> --set layout=<image-right|image-left> --set image=/images/<file> \
     [--slots remove-right[,remove-left]] > <RUN>/tmp/fix-NN.json
   ```

   Pass `--approved` only here, after the presenter accepted this image fix; without it the script rejects `image` (exit 2). The body check still applies. When `layout` is listed in the slide's `frontmatter_overrides`, set `layout` in that importer block with a second call (Step 6, "Target block"), and `image` in the slide's own frontmatter. Add `--set backgroundSize=contain` only for a screenshot or diagram that must not be cropped; the layout covers by default.
4. **Inline placement:** a body edit, done with `put` like a content fix (7.3). Insert, after the last content line and before the notes block, an empty line and `<img src="/images/<file>" alt="<a few words naming what the image shows>" style="width:<w>px;height:<h>px">`, adding `;object-fit:cover` to the style after `FITTED css`. Size: `w` = `gap.w - 16`, `h` = `round(w / aspect)`; if `h > gap.h - 16`, then `h` = `gap.h - 16` and `w` = `round(h * aspect)`.
5. **Attribution** for a stock photo: add the line from 9.4 to the notes block (create one at the end of the slide when missing) with `put`.
6. Shift the map and refresh the layouts after each edit (Edit helpers), record one decision (`image-ai` or `image-stock`, kind `approval`, outcome `applied`, `before` from step 2 with the slide's line range before the placement), mark the slide changed, add one round used, and remove its pending entry if it had one. The next round verifies the slide.

### 9.7 "I placed it"

When the loop has no active slides left and there are pending slides in scope, ask once per loop exit (AskUserQuestion, `multiSelect: true`, `header`: `Pending images`): "These slides wait for an image file. Did you place any of them?", one option per pending slide (`Slide NN: public/images/<slug>.png`, at most 3; mention the rest in the question) plus "Not yet". The presenter can also say so at any other question through "Other". For each chosen slide whose file now exists, run 9.6 and set its state back to open, so the loop re-verifies it in the next round; for one whose file is still missing, say where it is expected. "Not yet": the slides stay pending and are listed in the report.

## Step 10: Finish

Run this step at the end of the loop, and also whenever the pass stops early (an error after Step 2, or the presenter ends the pass):

1. **Catch-up render (FR-019, FR-020, FR-033).** If any ledger slide that is not merged is still marked changed (a fix applied or reverted after the last render, for example because the presenter ended the pass mid-round), render those slides first, so the report, contact sheet and rhythm show the slides as they are now:

   ```bash
   bash ${CLAUDE_PLUGIN_ROOT}/scripts/balance/render-slides.sh render --deck <DECK> --entry <ENTRY> \
     --run <RUN> --round <last round + 1> --slides <comma list of start-of-pass numbers>
   ```

   Print the progress lines and clear the flags. A slide waiting for hand-back is then handed back or set to balanced as in loop item 5; a slide that now overflows stays `failing: overflow`. Skip this when the render step itself is what failed (Step 4 exit 1 or 2, or the server is gone).
2. **Contact sheet and rhythm** (US5, FR-034), from the latest render per slide, before the final report so the report can link the sheet:

   ```bash
   bash ${CLAUDE_PLUGIN_ROOT}/scripts/balance/render-slides.sh contact-sheet --deck <DECK> --entry <ENTRY> --run <RUN> --round <last round>
   bash ${CLAUDE_PLUGIN_ROOT}/scripts/balance/render-slides.sh rhythm --deck <DECK> --entry <ENTRY> --run <RUN> > <RUN>/rhythm.json
   ```

   The first writes `<RUN>/contact-sheet.png`; the second keeps the raw rhythm observations next to the report. If either fails, say so in one line and continue: the report notes a missing contact sheet. Skip both when nothing was rendered.
3. **Final report:** `node ${CLAUDE_PLUGIN_ROOT}/scripts/balance/report.mjs --run <RUN>`. It writes the "Contact sheet" section (linking `contact-sheet.png`) and the "Deck rhythm" section itself, computed with the thresholds' `rhythm` values from the latest metrics per slide: runs of 4 or more consecutive slides with the same layout, and fill swings of more than 0.40 between neighbors, named by start-of-pass slide numbers. Rhythm is reported only, never fixed; with a range, it covers the rendered slides only. Show the presenter the section as written: `sed -n '/^## Deck rhythm/,/^## /p' <RUN>/report.md`.
4. **Stop owned servers** and remove the preview entry:

   ```bash
   bash ${CLAUDE_PLUGIN_ROOT}/scripts/balance/render-slides.sh server stop --deck <DECK> --entry <ENTRY>
   ```

   This stops only servers the pass started (`owned=true`, `SERVER <role> stopped`), forgets a reused presenter server without stopping it (`SERVER <role> released`; the next pass checks again that it serves this deck), and deletes `<DECK>/.balance-preview.md`. Then `rm -rf <RUN>/tmp`.
5. **Summary** for the presenter, from the "Summary" table in `<RUN>/report.md`: one line each for balanced, fixed (auto), fixed (approved), skipped, pending image, handed back and failing overflow (plus flagged unresolved, merged, render failed and hidden when not zero), then the path to `<RUN>/report.md` and `<RUN>/contact-sheet.png`. List handed-back and failing slides by number.

## Interruptions

If the presenter interrupts or ends the pass (for example by answering a question with "stop" through "Other"), applied fixes stay applied. Go to Step 10: the report covers what was done so far, and any slide that still overflows is listed as `failing: overflow` (FR-015).
