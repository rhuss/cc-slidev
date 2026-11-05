# Contract: `visual-reviewer` agent

**File**: `slidev/agents/visual-reviewer.md`. Tools: `Read` only. Never asks the presenter anything (FR-013).

## Input (prompt from `/slidev:balance`, one slide per call)

- Path to the slide PNG (latest round). No neighbor slides (FR-012); deck-level consistency is the contact sheet's job.
- The slide's `SlideMetrics` JSON and the thresholds JSON.
- The slide source text (frontmatter, body, presenter notes).
- Paths to `references/balance-fixes.md` (fix catalog, rubric) and `references/box-styles.md`.
- Round number.

## Output

Exactly one fenced JSON block matching the Verdict schema in `data-model.md`. No prose outside the block.

## Rules

- Judge from the image first; metrics explain, they don't decide intent.
- `intentional: true` only for statement, big number, section opener, title-only divider, or full-bleed visual slides whose emptiness serves the idea.
- At most 3 fixes, ranked least to most invasive per the catalog; include at least one `auto` fix when one plausibly helps.
- Never propose progressive reveal, decorative images, or anything exceeding hard limits (`projected` must be filled honestly).
- Content fixes must use material from the slide, its notes, the outline or brainstorm, never invented filler.
