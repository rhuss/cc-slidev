# Design: Ship the contrast addon with every generated deck

Date: 2026-09-11
Status: Approved, not yet implemented
Scope: cc-slidev plugin, plus one external prerequisite

## Problem

Decks are built on a good laptop screen and presented on a tired projector in
a room where the blinds do not close. Tinted callout boxes built from
`bg-<hue>-500/10` turn into white rectangles, and dimmed secondary text set
with `opacity-70` disappears. There is nothing the presenter can do from the
stage except apologise.

cc-slidev already addresses the design-time half of this in
`slidev/references/design-constraints.md`, which specifies minimum contrast
ratios for the palette. That guidance is correct and stays. It is also not
sufficient, because it cannot account for the room. A deck can satisfy every
ratio in that file and still be unreadable on a specific projector.

`slidev-addon-contrast` is the runtime half. It re-implements the utility
classes decks actually use in terms of a single CSS variable `--hc`, exposed
as a slider on Shift+C. At `--hc: 0` the output is byte-identical to stock
Tailwind, so the addon is inert until someone turns the knob.

This design covers folding that addon into cc-slidev so every generated deck
has the knob without anyone having to know it exists beforehand.

## Decisions

Four decisions were settled during brainstorming. They are recorded here
because each one closes off an alternative that will otherwise look tempting
again later.

**Always on, silently.** Every scaffolded deck gets the addon with no
question asked and no flag to pass. This is only defensible because of the
byte-identical property: an addon that cannot change a deck's appearance
until deliberately engaged does not need consent at scaffold time. The cost
is one extra npm dependency per deck.

**Published to npm.** The addon ships as a normal semver dependency rather
than being vendored into the plugin or pulled from git. This keeps one source
of truth, lets fixes reach existing decks through an ordinary `npm update`,
and leaves the addon independently useful to the wider Slidev community.

**Retrofit folds into `/slidev:visuals`** rather than becoming its own
command. The existing visual-enhancement command already claims this
territory, and the work is a two-line edit that does not justify new command
surface.

**The hooked utility set becomes a documented contract.** The knob only
affects classes the addon overrides. Without guidance pushing generated
slides toward that vocabulary, coverage is accidental. A deck where the knob
moves 90% of the boxes is worse than one where it moves none, because the
presenter cannot tell from the stage which boxes are stuck.

## Prerequisite

`slidev-addon-contrast` must be published to npm before any of this ships.
The package is ready: `publishConfig.access` is set to public and the `files`
list is correct. Current local version is 0.2.0, which added the `gray` hue
and the `opacity-50` / `opacity-75` rules.

cc-slidev depends on `^0.2.0`, so additional hues and utilities arrive as
minor bumps with no cc-slidev change required.

## Components

### 1. Scaffolding: `slidev/commands/generate.md`

Two edits, which must be applied together.

Headmatter gains an addons entry in all three variants (Professional at
roughly line 48, Technical at 80, Academic at 98):

```yaml
addons:
  - contrast
```

Slidev expands the bare name to `slidev-addon-contrast` automatically.

The `package.json` template (roughly lines 570-589) gains the dependency:

```json
"slidev-addon-contrast": "^0.2.0"
```

**The coupling is the main correctness constraint in this design.**
`addons: [contrast]` in headmatter without the package installed is not
graceful degradation. Slidev fails to resolve the addon and the dev server
does not start. Either both edits land or neither does.

### 2. Design contract: `slidev/references/design-constraints.md`

The existing contrast-ratio section stays untouched. A new adjacent section
declares the canonical vocabulary for tinted callout boxes:

```
bg-<hue>-500/10      tinted box background
border-<hue>-500/30  box border
text-<hue>-400       accent text
opacity-50|60|70|75|80|90   dimmed secondary text

hues: red, orange, amber, yellow, green, blue, purple, slate, gray
```

Frame the two sections as complementary rather than overlapping: the ratios
are the design-time floor, the knob is the runtime escape hatch for when the
room defeats the floor anyway.

### 3. Quality check: `slidev/skills/slide-quality/SKILL.md`

One item added to the existing checklist: flag tinted boxes built from
off-contract colors, since those are exactly the ones that stay flat when the
knob turns.

### 4. Retrofit: `slidev/commands/visuals.md`

A step that detects a deck lacking the addon, installs the dependency, and
patches the headmatter. Subject to the same both-or-neither constraint as
scaffolding.

## Data flow

There is none worth diagramming. Scaffold time writes two files. Run time is
a pure CSS custom-property cascade inside the addon, with the chosen level
kept in `localStorage`. cc-slidev has no runtime role once the deck is
generated.

### Rejected: a config block

An earlier option was a `contrast` section in `default.json`, overridable per
deck through `slidev.config.json`, mirroring how diagram platforms are
configured by `read-diagram-config.sh`.

Rejected. That mechanism earns its keep for diagrams because diagram
generation has genuine per-deck knobs (platforms, formats, themes, storage
paths). Contrast has exactly one scaffold-time decision, present or absent,
and that decision is already settled as always-present. A config surface here
would be a setting nobody ever flips.

## Error handling

| Failure | Handling |
| --- | --- |
| npm install fails during scaffold | Do not write `addons:` into headmatter. A deck without the knob beats a deck that will not boot. |
| Registry unreachable or offline | As above. Scaffold succeeds without contrast, warn once. |
| Retrofit onto a deck with an existing `addons:` list | Append, never overwrite. |
| Deck already has the addon | No-op. Do not duplicate the dependency or the headmatter entry. |

Every row is the same underlying rule: headmatter and dependency move
together, and when in doubt the deck ships without the feature rather than
broken.

## Testing

The repo tests manually through markdown checklists (`tests/test-slides.md`,
`tests/workflow-verification.md`) with no automated runner. Follow that
pattern. Add a verification section covering:

1. Generate a deck. It boots, and Shift+C mounts the slider panel.
2. At `--hc: 0`, computed styles match stock Tailwind exactly. The entire
   always-on decision rests on this property, so it is the one check that
   must not be skipped.
3. At `--hc: 1`, tint alpha, border alpha, accent-text lightness and the
   opacity utilities all move.
4. Retrofit through `/slidev:visuals` on a deck generated before this change.
5. Negative case: headmatter written without the dependency is caught by the
   scaffolder, not by a failed dev server.

## Out of scope

Setting a permanent `--hc` default for PDF exports. The slider is
runtime-only and `slidev export` does not see it, so a contrastier PDF
requires `:root { --hc: 0.4 }` in the deck's own `style.css`. That is a
per-talk, per-venue judgement and does not belong in a generator default.
The addon README documents it for anyone who wants it.

## Prior art in this repo

Two decks were wired up by hand on 2026-09-11 and can serve as reference
implementations:

- `codeeurope-agent-security-2026/securing-ai-agents`
- `codeeurope-sdd-2026/spec-driven-development`

Both use a `file:` dependency onto a local checkout, which is the thing this
design replaces with a published package. Note the two traps documented in
the addon README: relative addon paths resolve against the deck's *parent*
directory, and a `file:` dependency is symlinked unless installed with
`--install-links`, which breaks bare `vue` imports. Neither applies once the
package comes from npm.
