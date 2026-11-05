---
runbook_version: 1
feature: 001-visual-feedback-loop
status: drafted
mode: light
steps_total: 10
step_results: pending,pending,pending,pending,pending,pending,pending,pending,pending,pending
drafted_at: 5d37564
drafted_fingerprint: ed44947bd64bf79ee34e2f9acc13abdf04f2ca84cf99021d2cd34cdb7dea1c56
tested_at:
tested_fingerprint:
updated: 2026-11-05
---

# Try it: Visual balance pass for rendered slides

<!-- runbook-status -->
> **Status:** drafted · 0 of 10 steps · Mode: light · Drafted at 5d37564 · 2026-11-05
<!-- /runbook-status -->

## What you're testing

`/slidev:balance` renders every slide of a finished deck in its last click state, measures it, flags sparse, crowded, overflowing, lopsided or small-text slides, has the `visual-reviewer` agent judge each flagged slide from its screenshot, applies frontmatter-only fixes on its own and asks you about content, box and image fixes with a rendered preview.

The journey goes in the order a presenter would meet it:

1. Confirm the automated checks pass (unit and render tests).
2. Make a throwaway copy of the frozen cc-review talk, so nothing in the repo changes.
3. Render and measure the copy from the command line and see slide 2 flagged sparse.
4. Run the full interactive pass in Claude Code with this branch's plugin: automatic fixes, an approval question with a preview, a box fix and an image prompt.
5. Read the report, then check that the pass cleaned up after itself and only changed what you accepted.

## Test environment

No fixtures are started by the agent. Step 3 creates a throwaway deck copy at `specs/001-visual-feedback-loop/.walkthrough/deck` (the `.walkthrough` folder ignores itself in git). The render tooling installs once into `~/.cache/cc-slidev/render` if it is missing. The Slidev dev servers are started and stopped by the scripts themselves.

## Steps

### Step 1 of 10: Run the unit tests (US1)

**Why this step:** The pure logic (threshold parsing, flagging, union area, palette contrast, limit counting, slide map, auto-fix boundary, report) is covered by `node --test` suites. If these fail, nothing later is meaningful.

**Needs:** Node 20 or newer.

**Run:**

```
make test
```

**What you should see:** A `node --test` summary with `ℹ pass 244` and `ℹ fail 0`, followed by `Skipping render tests (set RUN_RENDER_TESTS=1 to run them)`.

**If you see something else:** A failing suite names the module; a `Cannot find module` error usually means Node is older than 20.

**Result:**

### Step 2 of 10: Run the render integration tests (US1)

**Why this step:** This renders the synthetic deck (one slide per failure type plus a clean control) and the frozen cc-review talk in a real browser, and checks flags, determinism, cleanup and that the deck's dependencies stay untouched.

**Needs:** Step 1. Network on the very first run (render tooling and fixture `npm ci`).

**Run:**

```
RUN_RENDER_TESTS=1 make test
```

**What you should see:** Lines starting with `ok`, `ok   cc-review slide 2: carries sparse`, `ok   cc-review slide 12: carries overflow`, a `TIMING cc-review ... total` line well under 120 s, and finally `== render test: all assertions passed`.

**If you see something else:** `NOTICE: installing render tooling (one-time)` followed by exit 3 means the install could not reach npm; the stderr hint names the manual command. A `fail` line names the slide and the metrics that did not match.

**Result:**

### Step 3 of 10: Make a throwaway copy of the cc-review talk (US1)

**Why this step:** The pass edits the deck it runs on. A copy keeps the frozen fixture and the repo unchanged, so you can try every fix freely.

**Needs:** Step 2 (it installed the fixture's `node_modules`, which the copy reuses).

**Run:**

```
rm -rf specs/001-visual-feedback-loop/.walkthrough/deck && mkdir -p specs/001-visual-feedback-loop/.walkthrough && rsync -a --exclude exports tests/balance/fixtures/cc-review/ specs/001-visual-feedback-loop/.walkthrough/deck/ && ls specs/001-visual-feedback-loop/.walkthrough/deck
```

**What you should see:** The listing shows `slides.md`, `slides`, `public`, `diagrams`, `package.json`, `package-lock.json` and `node_modules`, with no `exports` folder.

**If you see something else:** No `node_modules` means step 2 did not install them; run `npm ci` inside the copy.

**Result:**

### Step 4 of 10: Measure slide 2 from the command line (US1)

**Why this step:** Shows the measuring half of the loop on its own: the last click state is rendered, metrics are computed from the DOM, and slide 2 (title, one code line, three short bullets) is flagged before any agent is involved.

**Needs:** Step 3.

**Run:**

```
D="$PWD/specs/001-visual-feedback-loop/.walkthrough/deck" && bash slidev/scripts/balance/render-slides.sh server start --deck "$D" && bash slidev/scripts/balance/render-slides.sh render --deck "$D" --run "$D/exports/balance/manual" --round 1 --slides 1-3; bash slidev/scripts/balance/render-slides.sh server stop --deck "$D"
```

**What you should see:** `SERVER main port=<p> owned=true`, then three `SLIDE` lines. `SLIDE 02` reads about `fill 0.22 spread 0.41 flags: sparse, low-spread, small-text`. Then `SERVER main stopped`. The file `exports/balance/manual/round-1/slide-02.png` exists in the copy.

**If you see something else:** `owned=false` means another dev server for a deck with the same title was reused; stop it and retry. Exit 3 means the render environment is missing (see step 2).

**Result:**

### Step 5 of 10: Open Claude Code on the copy with this branch's plugin (US1)

**Why this step:** The interactive pass is a Claude Code command. Loading the plugin from this branch makes sure you test the new command and agent, not an installed release.

**Needs:** Step 3. If a released `slidev` plugin is installed, disable it for this session so the two do not clash.

**Do:**

1. In a new terminal, `cd` into `specs/001-visual-feedback-loop/.walkthrough/deck` of this worktree.
2. Start `claude --plugin-dir <absolute path of this worktree>/slidev`.
3. Type `/slidev:` and check that `balance` is offered.

**What you should see:** `/slidev:balance` appears in the command list with a description about balancing rendered slides.

**If you see something else:** No `balance` entry means the plugin was loaded from another location; check `/plugin` for which `slidev` is active.

**Result:**

### Step 6 of 10: Run the pass, take the automatic fixes and answer one approval question (US1, US2)

**Why this step:** This is the core loop: render, flag, agent verdict, automatic frontmatter fixes, re-render, and interactive content fixes shown with a before and after preview.

**Needs:** Step 5.

**Do:**

1. Run `/slidev:balance`.
2. Watch the first round: it reports how many slides were flagged and which automatic fixes (layout, zoom, class) it applied.
3. When an approval question comes up, look at the side-by-side image it opens (current slide next to the preview), then accept one fix.
4. For the overflowing slide 12, note that the options are content fixes (for example split or move to notes) and that there is no Skip option.

**What you should see:** Slide 2 is flagged sparse; an automatic layout or zoom fix is applied, or a question with a preview appears. Every question names the slide, the problem and up to three fixes ranked least to most invasive. No question offers progressive reveal or decorative filler. The pass ends after at most 3 rounds per slide.

**If you see something else:** A question without a preview image, or a fix that changed slide text you did not accept, is a defect (FR-017, SC-005).

**Result:**

### Step 7 of 10: Try a box fix (US3)

**Why this step:** Boxes are opt-in. The first box fix asks for a deck-wide palette once, stores it, and generates one stylesheet so every box in the deck uses the same role colors.

**Needs:** Step 6 (the pass is still running, or rerun it with `/slidev:balance 2-9`).

**Do:**

1. On a sparse bullet slide, choose "Restructure into boxes".
2. Answer the palette question (default, Okabe-Ito, your own colors, or harvested).
3. Accept a second box fix on another slide if one is offered.
4. After the pass, run `rg -n -A6 '^balance:' presentation-config.md; ls styles/` in the deck copy.

**What you should see:** The palette question appears once only. `presentation-config.md` has a `balance:` block with `boxes:` and the four roles `main`, `risk`, `context`, `takeaway`; `styles/` contains `balance-boxes.css`, imported from `styles/index.css`. Labels of the same role look the same on both slides.

**If you see something else:** A second palette question, or box labels in different colors for the same role, breaks FR-025.

**Result:**

### Step 8 of 10: Try an image fix with the default prompt handover (US4)

**Why this step:** Image generation is opt-in. By default the pass writes a ready-to-use prompt and marks the slide as pending, so no image service is called without your say.

**Needs:** Step 6.

**Do:**

1. On a slide with a large empty area, choose the image fix and keep the default (prompt handover).
2. After the pass, run `tail -n 20 ai-image-prompts.md` in the deck copy.

**What you should see:** A new entry with the slide title, an aspect ratio matching the empty area, the target file path under `public/`, and the prompt text. The pass summary lists the slide as "pending image".

**If you see something else:** Any call to Codex, Gemini or an image API without you choosing "Generate now" breaks FR-029.

**Result:**

### Step 9 of 10: Read the report and the rhythm observations (US1, US5)

**Why this step:** The report is the record of the pass: before and after images, verdicts, every decision with its revert data, the contact sheet, and deck rhythm notes that are reported but never fixed.

**Needs:** Step 6.

**Run:**

```
cd specs/001-visual-feedback-loop/.walkthrough/deck && R=$(ls -d exports/balance/*/ | rg -v manual | tail -n 1) && ls "$R" && rg -n '^## ' "$R/report.md"
```

**What you should see:** The run folder holds `report.md`, `decisions.jsonl`, `slide-map.json`, `contact-sheet.png` and `round-<n>` folders. The headings include `## Contact sheet` and `## Deck rhythm`.

**If you see something else:** A missing `decisions.jsonl` after you accepted a fix means the revert record was not written.

**Result:**

### Step 10 of 10: Check cleanup and that only accepted changes landed (US1, US2)

**Why this step:** The pass must leave no preview file or owned dev server behind, must not touch the deck's dependencies, and must change slide content only where you said yes.

**Needs:** Steps 6 to 9 finished, the Claude Code session from step 5 closed.

**Run:**

```
D=specs/001-visual-feedback-loop/.walkthrough/deck; ls -a "$D" | rg 'balance-preview' || echo "no preview file"; pgrep -fl "slidev.*walkthrough" || echo "no dev server left"; diff -rq --exclude node_modules --exclude exports tests/balance/fixtures/cc-review "$D"
```

**What you should see:** `no preview file`, `no dev server left`, and a `diff` listing only the files you expect: `slides.md` or files under `slides/` for the fixes you accepted or that were applied automatically, plus `presentation-config.md`, `styles/` and `ai-image-prompts.md` if you tried steps 7 and 8. `package.json` and `package-lock.json` are not listed.

**If you see something else:** A leftover `.balance-preview.md` or a running server breaks the cleanup requirement; `package.json` in the list breaks FR-004.

**Result:**

## Not covered here

- **Opt-in image generation through Codex, Gemini CLI, the OpenAI API or the Gemini API.** These need third-party accounts and may cost money; the unit tests cover route selection and the fallback to prompt handover. Try it yourself by choosing "Generate now" in step 8 if you have a route set up.
- **Stock image search and fitting with ImageMagick.** Depends on network and an installed `magick`; `fit-image.sh` falls back to CSS `object-fit` and is unit tested.

## Coverage

- **US1 (automatic fixes and measuring):** steps 1, 2, 4, 6, 9, 10.
- **US2 (interactive content fixes with preview):** steps 6 and 10.
- **US3 (boxes with a deck-wide palette):** step 7.
- **US4 (images, prompt handover default):** step 8; generation routes are listed under "Not covered here".
- **US5 (deck rhythm):** step 9 (reported only, by design).

## Results
