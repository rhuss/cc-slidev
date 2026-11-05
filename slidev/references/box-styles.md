# Box Styles Reference

Tinted boxes (cards) for `/slidev:balance`. The `boxes` fix restructures a sparse slide's bullets into two or three tinted boxes. This file defines the pattern, the color roles, the markup and the palette options. All boxes in a deck share one generated stylesheet, so they look the same on every slide.

## The Box Pattern

A box grid is a row of two or three equal boxes, each with a short label and one or two lines of body text, optionally followed by one punchline sentence under the grid.

**When boxes help:**

- A sparse slide with two or three short bullets that are parallel: options, steps, before and after, problem and mitigation, three properties of one thing.
- Each bullet splits naturally into a label (one to three words) and a body (one short line).
- The slide needs more visual weight without more words.

**When boxes do not help:**

- One idea in one sentence: use the `statement` layout, or leave it intentional.
- More than three items, or items that are not parallel.
- A sequence where the connections matter: a diagram shows that better.
- Code, tables or diagrams on the slide.
- Crowded or overflowing slides: boxes add padding and make them worse.

Boxes are always an approval fix, never automatic, and the box text is the slide's existing text. Never invent a label or body to fill a third box.

## Semantic Roles

Every box has exactly one role. Each role has one color per deck, and each color has one meaning across every slide (one meaning per color).

| Role | Class | Meaning | Typical label |
|---|---|---|---|
| `main` | `.bx--main` | The primary items, the normal case | "Spec", "Step 1", "Option A" |
| `risk` | `.bx--risk` | A danger, cost, failure mode or warning | "Risk", "Cost", "Breaks when" |
| `context` | `.bx--context` | Background, constraints, neutral facts | "Today", "Given", "Constraint" |
| `takeaway` | `.bx--takeaway` | The conclusion or recommendation | "So", "Do this", "Result" |

Rules:

- Use `main` for parallel items of equal standing; give them all the same role. Three options are three `main` boxes, not three colors.
- Use `risk` only for something that can go wrong. Never use it for emphasis.
- Use `takeaway` for at most one box per slide, and not together with a punchline that says the same thing.
- At most four hues per slide, which the four roles guarantee. Never add a fifth color through inline styles or utility classes.

## Label, Badge and Punchline

The stylesheet fixes these treatments for the whole deck. Never restyle them per slide (no inline `style`, no extra utility classes on box elements).

- **Label** (`.bx-label`): one to three words naming the box, in the role's label shade (a darker shade of the role color on light backgrounds, a lighter one on dark), with the same size and weight in every box. The label carries the meaning in words, so color is never the only cue.
- **Body** (`.bx-body`): one or two short lines, or two or three bullets, in the normal text color. Never color body text.
- **Badge** (`.bx-badge`): a small numbered marker, for steps or ranked items only. Number boxes 1, 2, 3 in reading order. Leave badges out when order does not matter.
- **Punchline** (`.bx-punchline`): one sentence under the grid that states what the boxes add up to. At most one per slide, in the normal text color.

## Markup

Classes (generated into `styles/balance-boxes.css` by `scripts/balance/box-styles.mjs`):

| Class | Element |
|---|---|
| `.bx-grid` | Container; lays out its boxes in equal columns (two or three) with a fixed gap |
| `.bx` | One box; always combined with exactly one role modifier |
| `.bx--main`, `.bx--risk`, `.bx--context`, `.bx--takeaway` | Role modifier: tint, border and label shade |
| `.bx-label` | The box label |
| `.bx-body` | The box body text or list |
| `.bx-badge` | Optional numbered badge |
| `.bx-punchline` | Optional sentence under the grid |

Use only these classes for boxes. Example slide body with three boxes and a punchline:

```html
# Reviews catch what tests miss

<div class="bx-grid">
  <div class="bx bx--main">
    <span class="bx-badge">1</span>
    <div class="bx-label">Spec</div>
    <div class="bx-body">Wrong assumptions surface before any code exists.</div>
  </div>
  <div class="bx bx--main">
    <span class="bx-badge">2</span>
    <div class="bx-label">Code</div>
    <div class="bx-body">Missing error paths show up in the diff.</div>
  </div>
  <div class="bx bx--risk">
    <span class="bx-badge">3</span>
    <div class="bx-label">Risk</div>
    <div class="bx-body">Rubber-stamp approvals let both slip through.</div>
  </div>
</div>

<div class="bx-punchline">A review is a second pair of eyes on intent, not syntax.</div>

<!--
Presenter notes stay here, unchanged.
-->
```

A box body with bullets uses plain HTML lists:

```html
<div class="bx bx--context">
  <div class="bx-label">Given</div>
  <div class="bx-body">
    <ul>
      <li>One reviewer per PR</li>
      <li>No CI on drafts</li>
    </ul>
  </div>
</div>
```

**Markdown inside HTML.** Slidev parses Markdown inside an HTML block only when the Markdown is separated from the tags by blank lines. Prefer plain HTML text and `<ul><li>` inside boxes; use `<code>` and `<strong>` instead of backticks and asterisks. Keep the slide title as a Markdown heading outside the grid, with a blank line before the grid.

**Counting.** Bullets inside a box count as elements, a box without bullets counts as one element, and every word inside a box (label and badge included) counts toward the 50-word limit. The example above is 3 elements.

## Color Rules

- **At most 4 hues per slide**: the four role colors, nothing else.
- **Color is never the only cue**: every box has a label that names its meaning; badges and position carry order.
- **Body text in the normal text color**: only labels, badges, borders and tints use the role color.
- **Label contrast at least 4.5:1** against the box tint composited over the slide background, in light and dark mode. The generator picks the label shade per role and fails loudly if no shade reaches 4.5:1.
- **Tint and border defaults**: background tint at 10% opacity and border at 30% opacity of the role color (documented in `references/design-constraints.md`).
- **No red and green pair**: no two roles may form a red/green pair. The presets avoid green entirely; custom and harvested palettes are checked.
- **Identical geometry**: every box has the same padding, corner radius and gap, set once in the stylesheet.

## Palettes

The palette is chosen once per deck, on the first accepted box fix, and stored in the YAML frontmatter of `presentation-config.md`:

```yaml
balance:
  boxes:
    palette: default
    roles:
      main: "#3b82f6"
      risk: "#f97316"
      context: "#64748b"
      takeaway: "#8b5cf6"
```

| Palette | main | risk | context | takeaway | Notes |
|---|---|---|---|---|---|
| `default` | `#3b82f6` blue | `#f97316` orange | `#64748b` slate | `#8b5cf6` purple | Plugin default, matches the blue and orange palette in `design-constraints.md` |
| `okabe-ito` | `#0072B2` blue | `#D55E00` vermillion | `#6B7280` gray | `#CC79A7` reddish purple | Colorblind-safe set; bluish green is left out because it would pair with vermillion |
| `custom` | presenter hex | presenter hex | presenter hex | presenter hex | The presenter's brand colors, one hex value per role |
| `harvested` | from deck | from deck | from deck | from deck | Colors of existing `bg-<color>-500/10` classes in the slide files (Tailwind 500 values), assigned to roles by the presenter |

Every palette is validated before use: four roles, distinct hues, no red/green pair, and a label shade with at least 4.5:1 contrast in light and dark mode. A palette that fails is not stored; the pass explains which rule failed and asks again.

From the palette, `box-styles.mjs generate` writes `styles/balance-boxes.css` (CSS variables per role, light and `html.dark` variants) and imports it once from `styles/index.css`. Changing the palette (editing `balance.boxes`, or `/slidev:balance --palette`) regenerates the stylesheet, and every slide with boxes changes together without editing any slide.
