# Quickstart: Validating the Balance Pass

## Prerequisites

- Node 20+ and npm; network access on first run (or Chromium revision 1248 already in the shared Playwright cache).
- Plugin installed from this branch: `make install`.
- Optional: ImageMagick (`magick`) for image cropping; Codex CLI, Gemini CLI + nanobanana, `OPENAI_API_KEY` or `GEMINI_API_KEY` for opt-in generation.

## 1. Unit tests (no browser)

```bash
make test
```

Expected: all `node --test` suites pass (thresholds parsing, flagging, union area, palette contrast, limit counting, report rendering).

## 2. Render tests (browser)

```bash
RUN_RENDER_TESTS=1 make test
```

Expected:
- `tests/balance/fixtures/synthetic-deck`: slides `sparse`, `crowded`, `overflow`, `lopsided`, `tiny-labels` carry their flag; the `clean` control slide has no flags (SC-009).
- Rendering the deck twice yields byte-identical `metrics.json` after removing paths (SC-003).
- `package.json` and `package-lock.json` of the fixture are unchanged (SC-007).
- First-run timing for the 25+ slide cc-review fixture printed; under 120 s excluding install (SC-004).

## 3. Manual pass on the frozen cc-review deck

```bash
cd tests/balance/fixtures/cc-review && npm ci
# in Claude Code, from that directory:
/slidev:balance
```

Expected:
- Slide 2 is flagged `sparse`/`low-spread`; an automatic layout or zoom fix is applied, or an approval question appears with a preview (SC-001).
- No slide text changes unless you accepted a question (SC-005).
- `exports/balance/<timestamp>/report.md` lists before/after images, verdicts, decisions and the contact sheet.

## 4. Boxes

On a sparse bullet slide, choose "Restructure into boxes". Expected: palette question once; `presentation-config.md` gains `balance.boxes`; `styles/balance-boxes.css` exists; a second box fix does not ask again; labels share one style.

## 5. Images

Choose an image fix and keep the default. Expected: a prompt with aspect ratio and target file is appended to `ai-image-prompts.md`, the slide is listed as pending. Place a file at the target path and re-run `/slidev:balance 2`: the image is fitted and the slide re-verified. Choose "Generate now" with a route whose key is unset: the pass falls back to the prompt and says why.

## 6. Cleanup check

After the pass: no `.balance-preview.md` in the deck, no dev server left running that the pass started.
