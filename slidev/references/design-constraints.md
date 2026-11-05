# Design Constraints Reference

Research-backed constraints for presentation slides. All skills and commands reference this file instead of inlining these rules.

## Hard Limits (Never Violate)

- **MAX 6 elements** per slide (bullets + images + diagrams + code blocks combined)
- **MAX 50 words** body text per slide (excluding title)
- **MAX 1-2 code blocks** per slide (8-10 lines each)
- **ONE idea** per slide (if multiple ideas, split slides)

When content exceeds limits: SPLIT into additional slides. Never compress, shrink, or reduce font size to fit.

## Font Requirements

- Body text: minimum 18-24pt (never smaller than 18pt)
- Headings: minimum 24pt or larger
- Font family: sans-serif for body (Calibri, Arial, Verdana, Helvetica)
- Avoid: italics, underlines, ALL CAPS in body text

## Accessibility (WCAG)

**Contrast ratios:**
- Normal text (<24pt): minimum 4.5:1
- Large text (>=24pt): minimum 3:1

**Colorblind safety:**
- Never rely on color alone to convey meaning
- Add patterns, labels, shapes for differentiation
- Avoid red+green together without additional cues
- Use ColorBrewer (colorbrewer2.org) for verified palettes
- ~8% of males have color vision deficiency

## Default Colorblind-Safe Palette (Blue + Orange)

```
Primary:    #3b82f6  (Blue, 8.6:1 contrast on white)
Secondary:  #f97316  (Orange, 3.4:1, headings only >=24pt)
Neutral:    #6b7280  (Gray, arrows/frames)
Text:       #1f2937  (Dark gray, 16.1:1 contrast, ALL text)
Background: #ffffff  (White)
Accent:     #8b5cf6  (Purple, annotations)
```

## Visual Balance

Thresholds for `/slidev:balance`, which renders each slide and measures what the audience sees. The pass reads the `balance-thresholds` block below; change the numbers there to tune it. The scripts read this block (zoom bounds included), and the command and the reviewer get it as JSON; numbers quoted in the other balance references are the defaults and give way to this block.

**Units.** Sizes are measured in CSS pixels at the native canvas scale and converted to points relative to a standard 16:9 slide: canvas width 980px = 960pt, so `pt = px * 960 / canvasWidth`. That makes 18pt about 18.4px and 14pt about 14.3px. The plugin's 1.25rem (20px) body default passes.

**Flags.** A rendered slide is flagged when:

- `sparse`: fill ratio below 35% of the theme's content area (fill ratio is the area of the union of the visible content boxes divided by the content area).
- `crowded`: fill ratio above 75%.
- `low-spread`: the lowest content edge sits above 55% of the canvas height (content ends in the top half).
- `overflow`: content is clipped or extends past the canvas edge. Overflow is always fixed, never a judgment call.
- `small-text`: the smallest body text is below 18pt. Body text covers `p, li, td, th, blockquote, .bx-body`. Headings (`h1` to `h6`), `pre`, `code`, `footer` and `.slidev-page-number` are excluded.
- `small-labels`: the smallest label in an inline vector diagram (SVG `<text>` and `<foreignObject>` content, at its rendered size) is below 14pt. Diagrams embedded as image files are recorded as "unmeasured" and never raise this flag.
- `lopsided`: on a `two-cols` or `two-cols-header` slide, the shorter column is less than 75% of the taller column's height.
- `render-error`: the slide failed to render. It is never reported as balanced.

**Intentionally sparse slides.** A slide whose frontmatter contains `balance: sparse-ok` is exempt from `sparse`, `low-spread` and `lopsided`. Overflow, text size and diagram label checks still apply.

**Exempt layouts.** Slides using `cover`, `image`, `section`, `statement`, `fact`, `quote` or `end` skip `sparse`, `low-spread` and `crowded`. Overflow and text size checks still apply.

**Automatic scaling.** Automatic zoom only scales up: from 1.0 to at most 1.5, in steps of 0.1, and it stops once the fill ratio is inside the balanced band. It never shrinks a slide to fit.

**Rounds.** Each slide gets at most 3 fix rounds. A slide still flagged after that is handed back to the presenter.

**Deck rhythm** (reported only): a run is 4 or more consecutive slides with the same layout; a density swing is a fill ratio change of more than 40 percentage points between neighboring slides.

**Boxes.** Tinted boxes use a background tint at 10% opacity and a border at 30% opacity by default. Words and bullets inside boxes count toward the hard limits above. See `references/box-styles.md`.

```json balance-thresholds
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

## Research Basis

- Cognitive load: >6 elements exponentially increases confusion (David JP Phillips)
- Working memory: 7+/-2 items (Miller's Law)
- Dual-channel interference: >50 words means audience stops listening (MIT Communication Lab)
- Timing default: 90 seconds per slide (PLOS Computational Biology, adjusted for technical content)
- TED presentation research: meaningful assertion titles, not labels
