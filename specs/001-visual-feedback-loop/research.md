# Research: Visual Balance Pass

**Feature**: 001-visual-feedback-loop | **Date**: 2026-11-05

## R1: Rendering engine and version pin

- **Decision**: A plugin-owned Node script driving `playwright-core` pinned to **1.64.1**, installed once into a plugin-level cache (`${XDG_CACHE_HOME:-$HOME/.cache}/cc-slidev/render/`), launching the full Chromium build already present in the shared Playwright browser cache with `channel: 'chromium'` (new headless mode), because the default headless mode would need the separate `chromium-headless-shell` build that is not cached.
- **Rationale**: 1.64.1 expects Chromium revision 1248, which is present in `~/Library/Caches/ms-playwright/chromium-1248` on the presenter's machine (installed by the Playwright MCP server), so no browser download is needed there. `playwright-core` does not download browsers on install, which keeps the first install small; if the matching revision is missing, the script runs `npx playwright-core@1.64.1 install chromium` (one-time, with a notice). One process renders the whole deck, which gives identical viewport, waits and click state on every run (FR-003, FR-005).
- **Alternatives considered**: Playwright MCP server (rejected by the presenter: per-slide tool calls, drift between rounds, varying server configs); `slidev export --format png` (needs `playwright-chromium` in every deck, full export per round, no DOM metrics); installing into the deck (violates FR-004).

## R2: Reaching a slide in its last click state

- **Decision**: Navigate to `http://localhost:<port>/<no>?print=true` (or `?print=true#<no>` when the deck uses hash router mode), wait for `[data-slidev-no="<no>"]`, then repeat the waits Slidev's own exporter uses: `.slidev-slide-loading` detached, `[data-waitfor]` targets visible, all frames loaded, `#mermaid-rendering-container` children detached, `document.fonts.ready`, and every `<img>` `complete`.
- **Rationale**: This is exactly what `@slidev/cli` 52.x does in `export-*.mjs` (`go(no, clicks)`); print mode without `clicks` renders all `v-click` content revealed, which is the last click state (FR-003, US1 AS7).
- **Alternatives considered**: pressing ArrowRight until the URL stops changing (slower, timing-sensitive); `?clicks=999` in presenter mode (not supported uniformly across versions).

## R3: Viewport, scale and units

- **Decision**: Viewport = deck canvas size (default 980x552, read from `canvasWidth` and `aspectRatio` headmatter), `deviceScaleFactor: 2` for screenshots. Element screenshot of `[data-slidev-no="<no>"]` (the slide container), so the PNG is exactly the canvas. Sizes are read with `getBoundingClientRect` and `getComputedStyle`, corrected by the container's CSS scale (rendered width / canvas width). Points: `pt = px * 960 / canvasWidth` (980px = 960pt, so 18pt ≈ 18.4px).
- **Rationale**: Matches the clarified convention. Decks using the plugin's `1.25rem` (20px) body default pass the 18pt rule.

## R4: Measuring in the page

- **Decision**: One injected `measure.js` function, run via `page.evaluate`, returns per slide:
  - **content area**: the bounding box of the layout root (`.slidev-layout`) minus its computed padding (theme-aware, FR-007).
  - **content elements**: visible leaf blocks (`p, li, h1-h6, pre, table, img, svg, blockquote, .bx`, Mermaid/Excalidraw containers); invisible (`display:none`, `opacity:0`, zero size) excluded. Fill ratio = area of the union of their rectangles (computed by sweep over a 4px grid) / content-area area.
  - **content rectangles** (what the union is taken over): visually filled blocks count with their border box (`pre`, `table`, `img`, `svg` and diagram hosts, `video`, `iframe`, `canvas`, `.bx`, `.katex-display`, and any non-inline element with a visible background or border). Text counts as its rendered line boxes, not as its block box, because a `p`, `li` or heading spans the full content width even when its text is short: the `Range.getClientRects()` rects of every visible text node, widened vertically to the computed line height, plus the marker gutter beside a list item's first line. Fill ratio, vertical spread and the largest empty rectangle all use these rectangles; the overflow check also keeps the leaf-block boxes.
  - **vertical spread**: max bottom edge / canvas height.
  - **overflow**: any element with `scrollHeight > clientHeight + 1` and `overflow` not visible, or any content rectangle outside the canvas by more than 1px.
  - **body text**: min font size over text nodes whose nearest block ancestor is `p, li, td, th, blockquote` or `.bx-body`; excludes `h1-h6, pre, code, footer, .slidev-page-number`.
  - **diagram labels**: min rendered size of `text`/`foreignObject` text inside inline `<svg>` (Mermaid), using `getBoundingClientRect().height` of the glyph run scaled; `<img>` diagrams → `"unmeasured"`.
  - **word count**: words in `innerText` of the content area, excluding headings.
  - **columns**: for `two-cols`/`two-cols-header`, height of the content in `.col-left`/`.col-right` (Slidev layout slot classes), ratio shorter/taller.
  - **gap**: largest empty axis-aligned rectangle inside the content area (on the same 4px grid), or the empty column on two-column layouts.
  - **labels inside `foreignObject`**: Mermaid flowcharts put labels in HTML inside `<foreignObject>`; label size = computed font-size times the SVG's current transform scale, for both `<text>` and `<foreignObject>` content.
  - **scale correction**: all rects and sizes are divided by the container scale (rendered width / canvas width) before comparison.
  - **source**: `__slidev__.nav.slides[no-1].meta.slide` gives `filepath`, `start`, `end`, `frontmatter.layout`, `frontmatter.balance` (dev server only, which is what we run).
- **Rationale**: Deterministic DOM math; the union over a coarse grid is exact enough and stable across runs (FR-005).
- **Alternatives considered**: pixel non-background ratio (dropped in the brainstorm); per-element sum (double counts nested boxes).

## R5: Dev server lifecycle

- **Decision**: The wrapper reads `exports/balance/server.json` (`pid`, `port`, `entry`, deck path). If that pid is alive and `http://localhost:<port>/` answers, reuse it. Otherwise probe 3030 for a Slidev server serving this deck (`/@slidev/` responds and the page title matches the headmatter `title`); else pick a free port and start `npx slidev <entry> --port <p> --open false --remote false` from the deck directory, recording `owned: true`. `stop` only kills servers with `owned: true` (FR edge case: dev server).
- **Rationale**: `preview-slidev.sh` requires a global `slidev` binary and opens a browser; decks install Slidev locally, so the wrapper uses `npx` from the deck.

## R6: Rendering a preview without touching the slide file

- **Decision**: A second, lazily started dev server on a hidden preview entry `<deck>/.balance-preview.md` containing a single frontmatter block (deck-level headmatter keys merged with the candidate slide's own frontmatter; slide-level keys of the first slide such as `layout`, `background`, `class` dropped) followed by the candidate body, so the candidate is slide 1. Box previews use the stored palette, or the default palette when none is stored yet. A side-by-side image (current next to preview) is composed with the contact-sheet code and opened before each question. It lives in the deck root so `styles/`, `components/`, `public/`, `uno.config.*` and addons resolve identically. The file is rewritten for each preview (hot reload) and deleted at the end of the pass; `.balance-preview.md` is added to the deck's `.gitignore` if one exists (FR-017).
- **Alternatives considered**: copying the deck to a temp dir (node_modules too large); editing then reverting the real file (violates FR-017 if interrupted).

## R7: Box styles

- **Decision**: Generated stylesheet `<deck>/styles/balance-boxes.css`, imported from `styles/index.css` (created if missing; Slidev auto-loads `styles/index.css`). Classes: `.bx-grid` (2 or 3 columns), `.bx` plus role modifier `.bx--main | --risk | --context | --takeaway`, `.bx-label`, `.bx-body`, `.bx-badge`, `.bx-punchline`. CSS custom properties per role (`--bx-main-hue`, tint 10%, border 30%), light and dark variants under `html.dark`. A small `palette.mjs` computes, per role, the label shade that reaches ≥4.5:1 against the tint composited over the theme background, walking a lightness scale (700 → 900 on light, 300 → 100 on dark) and failing loudly if none passes.
- **Palettes**: plugin default (blue `#3b82f6`, orange `#f97316`, purple `#8b5cf6`, slate `#64748b`); Okabe-Ito (main `#0072B2` blue, risk `#D55E00` vermillion, takeaway `#CC79A7` reddish purple, context neutral gray `#6B7280`; bluish green is left out because it would form a red/green pair with vermillion), user hex list, or colors harvested from existing `bg-<color>-500/10` classes in the deck.
- **Storage**: `balance.boxes` in the YAML frontmatter of `presentation-config.md` (the file already uses frontmatter): `palette`, `roles: {main, risk, context, takeaway}` → hex.
- **Rationale**: One source, one stylesheet: palette change = regenerate CSS, all boxes follow (FR-025).

## R8: Image routes

- **Decision**: `generate-image.sh --route <codex|gemini-cli|openai-api|gemini-api> --model <m> --prompt-file <f> --aspect <w:h> --out <path>`.
  - `codex`: `codex exec --skip-git-repo-check "<prompt> Save the image as <out>"`, then fall back to the newest file in `$CODEX_HOME/generated_images/` if `<out>` is missing.
  - `gemini-cli`: requires the nanobanana extension (`gemini extensions list` contains `nanobanana`); `gemini -y -p "/generate <prompt>"`, newest file in `./nanobanana-output/`.
  - `openai-api`: `curl https://api.openai.com/v1/images/generations` with `model` (default `gpt-image-1`), `size` closest supported to the aspect, base64 decoded with `jq` + `base64 -d`.
  - `gemini-api`: `generateContent` on `gemini-2.5-flash-image` with `imageConfig.aspectRatio`, inline data decoded.
  - Availability check per route (`command -v`, key env var set) runs before generating (FR-029, FR-030).
- **Fitting**: `fit-image.sh` crops to the gap aspect with `magick -gravity center -crop` when ImageMagick exists; otherwise the slide uses `object-fit: cover` with explicit width/height (FR-031).
- **Storage**: `balance.images: {route, model}` in `presentation-config.md` frontmatter.

## R9: Thresholds as data

- **Decision**: `references/design-constraints.md` gets a "Visual Balance" section with a fenced block tagged `json balance-thresholds`. `flag.mjs` extracts and parses that block; missing block = hard error naming the file.
- **Rationale**: One place for humans and the script (FR-008).

## R10: Testing

- **Decision**: `node --test` unit tests for pure modules (`flag.mjs`, `palette.mjs`, `union-area` in `measure-core.mjs`, `report.mjs`, threshold parsing), plus an integration test script that renders `tests/balance/fixtures/synthetic-deck` and asserts flags via `jq` on `metrics.json`, and checks determinism by rendering twice. Fixture decks get their `node_modules` on first test run (`npm ci`, gitignored). `make test` runs unit tests always and the integration test when `RUN_RENDER_TESTS=1`.
- **Frozen cc-review copy**: `tests/balance/fixtures/cc-review/` holds `slides.md`, `slides/`, `public/`, `package.json` copied from `cc-review/docs/presentation` (no `node_modules`, no exports).
