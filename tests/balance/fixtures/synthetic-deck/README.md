# Synthetic balance deck

Fixture deck for the `/slidev:balance` render test (`tests/balance/render.test.sh`).
Each slide triggers one known measurement result, and its first heading is its fixture name.

## Files

- `slides.md`: the deck. Headmatter pins the canvas (`canvasWidth: 980`, `aspectRatio: 16/9`), `colorSchema: light` and `transition: none`, so renders are deterministic.
- `styles/index.css`: raises body text to the plugin default of 1.25rem (20px). The default theme uses 1.1rem (17.6px), which would put every slide below the 18pt body text minimum.
- `expected.json`: slide title to expected flags. `[]` means balanced. `"hidden"` means the slide is recorded with `hidden: true` and is not rendered, so it has no flags.
- `package.json` and `package-lock.json`: exact pins of `@slidev/cli` 53.0.0 (the version in the cc-review deck lockfile) and `@slidev/theme-default` 0.25.0. The test runs `npm ci` when `node_modules` is missing; `node_modules/` and `exports/` are gitignored. The test asserts both files are unchanged after a run.

## Slides

| Title | Expected | How |
|---|---|---|
| `clean` | `[]` | lead paragraph and six near full-width bullets; explicit `layout: default`, because the first slide would otherwise use the density-exempt `cover` layout |
| `sparse` | `sparse`, `low-spread` | title and two short bullets |
| `crowded` | `crowded` | six-row table filling most of the content area, without overflow or small text |
| `overflow` | `overflow` | 41-line code block in a half-width column that runs past the canvas bottom; the half width keeps the fill ratio inside the band |
| `lopsided` | `lopsided` | `two-cols`: one bullet and a six-line code block left, six wrapping bullets right after `::right::` |
| `small-text` | `small-text` | scoped `<style>` sets `p, li` to 14px; ten long bullets keep the fill ratio in the band |
| `tiny-labels` | `small-labels` | inline Mermaid flowchart with `themeVariables.fontSize` 10px; the diagram renders inside an open shadow root |
| `statement` | `[]` | `layout: statement`, exempt from density checks |
| `opt-out` | `[]` | sparse, but `balance: sparse-ok` |
| `reveal` | `[]` | five `v-clicks` bullets that fill the slide only in the last click state |
| `hidden` | `"hidden"` | `hide: true` |

## Status of `expected.json`

The expected flags are the design intent, checked against an approximate pre-measurement while the fixture was written (fill ratio, spread, text and label sizes with margins of at least 0.05 from each threshold).
Text counts by its rendered line boxes, not by the full-width block box, so text slides need wide lines or enough of them to reach the 35% fill minimum.
They become authoritative only once the render test (`RUN_RENDER_TESTS=1 make test`) confirms them with the real `measure.js`.
If the test disagrees, fix the measurement or the slide, not the expectation, unless the slide genuinely measures differently than intended.
