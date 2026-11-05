# Contract: `/slidev:balance`

```
/slidev:balance [range] [--palette default|okabe-ito|custom|harvested] [--max-rounds N]
```

- `range`: `N`, `N-M`, or comma list (`2,5-7`). Default: all slides. Out-of-range → refuse with the valid range `1-<total>`.
- Run from the deck directory (the one containing the entry `slides.md`), or the command locates the deck the same way `/slidev:continue` does.
- `--palette`: re-choose the box palette for this deck (regenerates styles, re-renders every slide using boxes).

## Flow (normative order)

1. `render-slides.sh ensure` (first-run install, FR-006).
2. `render-slides.sh server start` (reuse or start, R5).
3. Load pending images; fit and mark slides whose files now exist.
4. `render-slides.sh render --run <dir> --round 1 [--slides …]` → PNGs + `metrics.json`.
5. For each flagged slide: dispatch `visual-reviewer` (one agent call per slide, fresh context).
6. Apply the highest-ranked `auto` fix; re-render that slide; repeat to round 3 (FR-014, FR-019).
7. Still flagged and approval fixes exist → interactive question per slide: current PNG + preview PNG, options = ranked approval fixes + "Skip" (no "Skip" for overflow).
8. Box fixes: first acceptance asks for the palette, writes `balance.boxes`, generates stylesheet.
9. Image fixes: default prompt handover → `ai-image-prompts.md` + pending; "generate now" asks the route once per deck.
10. Contact sheet + rhythm observations; `report.md`; stop owned servers; delete `.balance-preview.md`.

## Presenter-visible outputs

- One line per slide while rendering: `slide 02  fill 0.22  spread 0.41  flags: sparse, low-spread`.
- Final summary: counts of balanced, fixed (auto), fixed (approved), skipped, pending image, handed back, failing overflow; path to `report.md`.

## Guarantees

- Never edits a slide's text or element order without an accepted question (SC-005).
- Never modifies `package.json` / lockfiles of the deck (SC-007).
- Never calls an image service unless the presenter chose "generate now".
