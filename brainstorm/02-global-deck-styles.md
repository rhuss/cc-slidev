# Brainstorm: Global Deck Styles

**Date:** 2026-11-06
**Status:** active
**Issue:** -

## Problem Framing

`/slidev:generate` puts the deck's "global" CSS (18pt body size, heading sizes, the `--primary`/`--secondary`/`--neutral`/`--text` palette) into a `<style>` block right after the headmatter. Slidev documents that a `<style>` in slide Markdown is always scoped to that slide, and that deck-wide overrides belong in `style.css` or `styles/index.css`. Worse than "slide 1 only": Slidev turns the block into `<style scoped>`, and Vue's scoped transform rewrites `:root`, so the palette never matches anywhere, not even on slide 1 (`slidev/commands/balance.md:490` documents the same trap for box styles).

Observed on the cc-review deck (2026-11-05): most slides were flagged `small-text` by `/slidev:balance`, and every `style="color: var(--primary)"` accent rendered black. The deck was fixed by hand by moving the rules into `styles/index.css` (palette on `:root`, body sizes under `.slidev-layout`, heading sizes scoped to `.slidev-layout.cover`). That file is the reference for the target shape.

This is a generate bug that exists independently of balance. Balance measured the real consequence, which the audience also sees. Changing balance to tolerate the block would hide a visible defect.

Where the wrong pattern lives today:

- `slidev/commands/generate.md`: three theme templates (default, seriph, academic, lines ~59, 90, 108) and the master `slides.md` template (~466)
- `slidev/skills/slidev-mastery/SKILL.md`: "Custom Styling" (~475) and the accessibility section (~604), which teach the same pattern
- No other command or skill writes a slide `<style>` block

**Success:** a freshly generated deck shows 18pt+ body text and the palette on every slide with no balance fixes; an existing deck with the misplaced block gets it moved in one approved step at the start of a balance pass.

**Anti-goals:**

- Overwriting anything the presenter or balance put into `styles/index.css`
- Moving rules that really are meant for slide 1 only
- Moving the CSS silently: it changes the look of every slide at once, so it needs one approval
- Working around the block inside balance instead of fixing where it comes from

## Approaches Considered

### A: Generate owns `styles/deck.css`, a script does writing and migration (chosen)

Generate writes the deck-wide rules to `styles/deck.css` and adds one `@import './deck.css';` line to `styles/index.css`, the same pattern balance uses for `balance-boxes.css` (import handling in `box-styles.mjs` can be shared). `index.css` stays a collector of imports plus whatever the presenter writes by hand. A small script splits an existing slide-1 `<style>` into global rules (moved to `deck.css`) and slide-only rules (kept on slide 1); balance shows the result and asks for approval.

- Pros: clear ownership per file, nothing overwritten, idempotent, mirrors the box-styles structure, deterministic and testable like the other balance scripts
- Cons: one more file and one more script; the split needs a small CSS parser

### B: Instructions only, rules written into `index.css` between markers

Generate's template writes the CSS into `index.css` inside marker comments; balance Step 3 tells the model how to classify and move rules with Edit.

- Pros: no new code
- Cons: classification and the merge with balance's import are model judgment on every run, untested. Balance moved its own edits into scripts (`apply-auto-fix.mjs`) for exactly this reason.

### Dropped: balance tolerates or compensates for the slide-1 block

Would hide a defect the audience actually sees. Rejected.

### Dropped for now: UnoCSS theme palette

Defining `primary`/`secondary` in `uno.config.ts` (or `themeConfig.primary` where the theme supports it) is more Slidev-native than inline `var(--primary)`, but it changes what generate writes into every slide. Captured in the idea inbox as `unocss-theme-palette`.

## Decision

Approach A. Generate writes `styles/deck.css` and imports it from `styles/index.css`. A shared script handles writing, importing and splitting a misplaced slide-1 block. Balance detects the block in Step 3 (deck state at pass start, before round 1 renders, so no slide is measured with the wrong styles) and asks once before moving it.

## Key Requirements

**New decks (generate)**

- No `<style>` block after the headmatter in any template; the master `slides.md` template and all three theme variants change
- `styles/deck.css` holds the deck-wide rules per theme variant: palette on `:root`, body sizes (`p, li`, plus `td, th`) under `.slidev-layout`
- Heading sizes (3rem / 2rem / 1.5rem) are scoped to `.slidev-layout.cover` *(my call: on content slides they would fight the theme's own heading scale; matches the cc-review hand fix)*
- `styles/index.css` gets one `@import` line for `deck.css`, created if missing, never duplicated

**Shared file rules**

- Generate and balance each own their own imported file; neither rewrites the other's file or hand-written rules in `index.css`
- Running either command again changes nothing (idempotent)

**Existing decks (balance)**

- Step 3 checks slide 1 for a `<style>` with global-looking rules: `:root`, `body`, bare element selectors such as `p`, `li`, `h1` to `h6`, `td`, `th`
- On a hit, balance asks once at deck level, showing which rules move and which stay on slide 1
- Accepted: global rules move to `deck.css` (import ensured), slide-only rules stay on slide 1, the decision is recorded in `decisions.jsonl`
- Declined: the pass continues, and the report says that small-text and palette problems may come from the misplaced block *(my call, so the presenter can read the flags correctly)*

**Guidance**

- `slidev-mastery` stops teaching the slide-1 `<style>` pattern in both places and explains the scoping trap (scoped transform, `:root` rewrite), pointing to `styles/` for deck-wide CSS

**Out of scope**

- Reverting zooms applied to compensate for missing styles (nobody has run balance on such a deck yet)
- Detecting misplaced global rules on slides other than the first
- Moving the palette to UnoCSS theme colors (inbox: `unocss-theme-palette`)

## Open Questions

- Rule classification: how are mixed selectors handled (for example `h1, .my-title`), and what about rules that look global but target cover-only elements?
- Should the split keep heading-size rules from the old block as `.cover`-scoped, or drop them in favor of the theme's sizes?
- Should `/slidev:continue` also run the source-level detection, since it needs no render?
- Does `deck.css` need a regeneration path (for example after switching theme variant), or is it written once and then owned by the presenter?
