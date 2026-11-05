# Slidev Plugin - Architecture

## Overview

The Slidev Plugin is a Claude Code plugin for creating evidence-based technical presentations using [Slidev](https://sli.dev). It provides slash commands for the full presentation workflow, from brainstorming and framing to slide generation, diagram creation, and LaTeX handout export. Design guardrails based on cognitive science research are enforced automatically.

## System Components

### Component Overview

```
User -> /slidev:init
         |
    init.md (orchestrator)
         |
    /slidev:frame -> /slidev:brainstorm -> /slidev:outline -> /slidev:generate
         |
    outline-validator agent (validation)
         |
    /slidev:visuals -> /slidev:notes -> /slidev:handout

User -> /slidev:balance (standalone, on a finished deck)
         |
    render + measure -> flag -> visual-reviewer agent -> fixes -> report
```

### Component Responsibilities

| Component | Purpose |
|-----------|---------|
| **Commands** | Orchestrate workflow phases (brainstorm, outline, generate, etc.) |
| **Skills** | Provide contextual knowledge (design principles, Slidev expertise, diagram conventions) |
| **Agents** | Validate and analyze (outline validation, visual suggestions, rendered slide review) |
| **Scripts** | Handle deterministic operations (slide management, diagram rendering, Slidev setup) |

## Directory Structure

```
cc-slidev/                         # Repository root
├── .claude/                       # Project-level Claude config
├── .claude-plugin/
│   └── marketplace.json           # Development marketplace
├── ARCHITECTURE.md                # This file
├── CONTRIBUTING.md                # Development workflow
├── README.md                      # User guide
├── Makefile                       # Build/install targets
├── LICENSE                        # MIT license
├── references/                    # Research documentation
│   └── presentation-best-practices.md
├── tests/                         # Test files
└── slidev/                        # Plugin (installed to ~/.claude/plugins/)
    ├── .claude-plugin/
    │   └── plugin.json            # Plugin manifest
    ├── commands/                   # Slash commands (19 total)
    │   ├── init.md                # Orchestrator (full workflow)
    │   ├── frame.md               # Scope and timing
    │   ├── brainstorm.md          # Research and ideation
    │   ├── outline.md             # Outline creation
    │   ├── generate.md            # Slide generation with guardrails
    │   ├── edit.md                # Edit specific slide
    │   ├── add.md                 # Insert slide with renumbering
    │   ├── delete.md              # Remove slide with renumbering
    │   ├── move.md                # Reorder slides
    │   ├── diagram.md             # Multi-platform diagram creation
    │   ├── visuals.md             # Bulk visual enhancement
    │   ├── notes.md               # Presenter notes
    │   ├── handout.md             # LaTeX handout generation
    │   ├── export.md              # PDF/PPTX/PNG export
    │   ├── preview.md             # Slidev dev server
    │   ├── continue.md            # Resume existing work
    │   ├── balance.md             # Visual balance pass on rendered slides
    │   ├── extract-outline.md     # Reverse engineer outline
    │   └── redraw-diagrams.md     # Regenerate all diagrams
    ├── skills/                    # Contextual knowledge (8 skills)
    │   ├── presentation-design/   # Core design principles
    │   ├── slidev-mastery/        # Slidev framework expertise
    │   ├── visual-design/         # Multi-platform diagrams
    │   ├── latex-handouts/        # LaTeX generation
    │   ├── slide-quality/         # Quality assessment checklist
    │   ├── slide-management/      # Add/delete/move operations
    │   ├── excalidraw-generation/ # Hand-drawn diagram JSON
    │   └── diagram-design/        # Platform selection philosophy
    ├── agents/                    # Validation agents
    │   ├── outline-validator.md   # Structure and timing validation
    │   ├── visual-suggester.md    # Visual enhancement advisor
    │   └── visual-reviewer.md     # Judges one rendered slide for /slidev:balance
    ├── references/                # Shared rules for commands and agents
    │   ├── design-constraints.md  # Hard limits, accessibility, Visual Balance thresholds
    │   ├── balance-fixes.md       # Balance rubric, fix catalog, automatic-edit boundary
    │   ├── box-styles.md          # Box pattern, color roles, palettes
    │   └── excalidraw-factories.js # Excalidraw element factories
    ├── scripts/                   # Utility scripts
    │   ├── manage-slides.py       # Slide CRUD with renumbering
    │   ├── check-slidev.sh        # Verify Slidev installation
    │   ├── install-slidev.sh      # Install/update Slidev
    │   ├── preview-slidev.sh      # Start dev server
    │   ├── check-handout-deps.sh  # Verify LaTeX dependencies
    │   ├── compile-handout.sh     # Compile LaTeX handout
    │   ├── generate-multi-platform-diagram.sh
    │   ├── create-diagram-slug.sh
    │   ├── download-image.sh      # Fetch stock photos
    │   ├── render-excalidraw.sh   # Excalidraw to SVG
    │   ├── render-mermaid.sh      # Mermaid to SVG
    │   ├── render-plantuml.sh     # PlantUML to SVG
    │   ├── read-diagram-config.sh # Parse diagram settings
    │   ├── translate-diagram.js   # Cross-platform conversion
    │   └── balance/               # Render, measure and fix tooling for /slidev:balance
    │       ├── render-slides.sh   # Entry point: ensure, server, render, preview, contact-sheet, rhythm
    │       ├── render.mjs         # Playwright driver: navigation, waits, screenshots, metrics.json
    │       ├── measure.js         # In-page measurement, injected into each rendered slide
    │       ├── measure-core.mjs   # Pure geometry and unit helpers shared with the tests
    │       ├── slide-map.mjs      # Slides in rendered order with source file and lines
    │       ├── flag.mjs           # Threshold parsing, flag computation, deck rhythm
    │       ├── count-limits.mjs   # Element and word counting, boxes included
    │       ├── apply-auto-fix.mjs # Frontmatter and slot-marker edits, body text unchanged
    │       ├── side-by-side.mjs   # Current rendering next to a fix preview
    │       ├── palette.mjs        # Contrast math, label shade search, hue checks
    │       ├── box-styles.mjs     # Palette validation, box CSS generation, color harvest
    │       ├── generate-image.sh  # Opt-in image generation routes
    │       ├── fit-image.sh       # Crop an image to the gap (ImageMagick or CSS)
    │       ├── report.mjs         # Builds report.md for a run
    │       └── package.json       # Pins playwright-core 1.64.1 (installed into the plugin cache)
    └── default.json               # Default diagram configuration
```

### Understanding Plugin vs. Project Files

**Project-Level** (root, `.claude/`):
- Files affecting development ON this repo
- Used by developers working on the plugin

**Plugin-Level** (`slidev/`):
- Files users get when they install the plugin
- Installed to `~/.claude/plugins/`

**When adding features**: Modify plugin-level files in `slidev/`, NOT project-level files.

## Command Architecture

### Workflow Commands

The plugin implements a modular, orchestrated workflow:

```
/slidev:init (orchestrator)
  ├── Setup (project directory + git)
  ├── /slidev:frame (scope parameters)
  ├── /slidev:brainstorm (research + ideation)
  ├── /slidev:outline (structure creation)
  │     └── outline-validator agent
  ├── /slidev:generate (slide creation with limits)
  ├── /slidev:visuals (diagrams + images)
  ├── /slidev:notes (presenter notes)
  └── /slidev:handout (LaTeX output)
```

### Refinement Commands

| Command | Purpose |
|---------|---------|
| edit | Edit specific slide with context |
| add | Insert new slide with automatic renumbering |
| delete | Remove slide with automatic renumbering |
| move | Reorder slides with automatic renumbering |
| diagram | Create multi-platform diagram for a slide |
| continue | Resume work on existing presentation |
| redraw-diagrams | Regenerate all diagrams |
| balance | Render, measure and fix unbalanced slides |

### Export Commands

| Command | Purpose |
|---------|---------|
| export | PDF, PPTX, PNG via Slidev exporters |
| preview | Start Slidev dev server |

## Design Guardrails (Enforced)

These are hard limits enforced during slide generation, not suggestions:

| Guardrail | Limit | Research Basis |
|-----------|-------|----------------|
| Elements per slide | ≤ 6 | Miller's Law (7 +/- 2 working memory) |
| Body text words | < 50 | Reading vs listening interference |
| Ideas per slide | 1 | Cognitive load theory |
| Font size | ≥ 18pt body, ≥ 24pt headings | Readability research |
| Contrast ratio | ≥ 4.5:1 | WCAG AA accessibility |
| Color safety | Colorblind-safe | Blue + Orange default palette |

**When content exceeds limits**: The plugin creates additional slides instead of cramming.

## Script-LLM Division

### Scripts (Deterministic Operations)

| Script | Purpose |
|--------|---------|
| manage-slides.py | Slide CRUD with automatic file renumbering |
| check-slidev.sh | Verify Slidev installation status |
| install-slidev.sh | Install/update Slidev |
| render-*.sh | Render diagrams to SVG (Mermaid, PlantUML, Excalidraw) |
| compile-handout.sh | Compile LaTeX handout to PDF |
| translate-diagram.js | Convert diagrams between platforms |
| balance/*.mjs, balance/*.sh | Render slides, measure, flag, apply automatic fixes, build the balance report |

### Commands (Semantic Decisions)

| Concern | Handled By |
|---------|------------|
| Content structure and flow | LLM (commands) |
| Visual design decisions | LLM (commands + skills) |
| Quality enforcement | LLM (skills provide rules) |
| Outline validation | Agent (outline-validator) |
| Judging rendered slides | Agent (visual-reviewer) |
| File operations and rendering | Scripts |

## Visual Balance Pass

`/slidev:balance` renders a finished deck, measures each slide and fixes unbalanced ones. Measuring and flagging are deterministic scripts; only the judgment of a flagged slide goes to an agent.

### Data Flow

```
/slidev:balance (commands/balance.md)
  |
  render-slides.sh ensure          # first run: playwright-core into the plugin cache
  render-slides.sh server start    # reuse or start the deck's dev server
  |
  render-slides.sh render
    ├── render.mjs                 # one Chromium session, last click state, screenshots
    └── measure.js                 # injected per slide: fill, spread, overflow, sizes, columns
  |
  round-<n>/metrics.json
  |
  flag.mjs                         # thresholds from references/design-constraints.md
  |
  visual-reviewer agent            # one fresh call per flagged slide -> verdict + ranked fixes
  |
  ├── apply-auto-fix.mjs           # layout/zoom/class + slot markers, applied without asking
  └── approval with preview        # render-slides.sh preview + side-by-side.mjs, presenter decides
  |
  re-render changed slides (at most 3 rounds per slide)
  |
  report.mjs                       # exports/balance/<timestamp>/report.md
```

### Design Notes

- **Render tooling lives outside the deck.** `render-slides.sh ensure` installs `playwright-core` 1.64.1 into `${XDG_CACHE_HOME:-~/.cache}/cc-slidev/render` and reuses the shared Playwright Chromium. The deck's `package.json` and lockfile are never changed, and no MCP server is involved.
- **Thresholds are data.** `flag.mjs` reads the `balance-thresholds` JSON block in `references/design-constraints.md`. The same numbers are what a human reads.
- **Automatic edits have a hard boundary.** `apply-auto-fix.mjs` only edits frontmatter `layout`, `zoom` and `class` plus column slot markers, and aborts if the body text or its order would change. Every edit is logged in `decisions.jsonl` with the slide's previous source.
- **Previews never touch slide files.** A preview is rendered from a temporary `.balance-preview.md` on a second dev server, which is deleted at the end of the pass.
- **Per-deck preferences** go into the `balance:` key of `presentation-config.md` frontmatter: `balance.boxes` (palette and color roles, compiled into `styles/balance-boxes.css` by `box-styles.mjs`) and `balance.images` (image generation route and model).
- **Run data** stays in the deck under `exports/balance/`: one folder per run with renders per round, metrics, verdicts, decisions, previews, the contact sheet and `report.md`.

## Multi-Platform Diagram System

The plugin generates diagrams in three platforms simultaneously:

| Platform | Best For | Format |
|----------|----------|--------|
| Mermaid | Flowcharts, sequences, state diagrams | Inline in slides (.mmd source) |
| PlantUML | Architecture, component, deployment | SVG via server (.puml source) |
| Excalidraw | Hand-drawn sketches, spatial layouts | SVG via CLI (.excalidraw source) |

### Diagram Storage

```
presentation/
├── diagrams/                    # Source files (version controlled)
│   ├── architecture.mmd
│   ├── architecture.puml
│   └── architecture.excalidraw
└── public/images/               # Rendered output (can be regenerated)
    └── architecture/
        ├── diagram.svg
        ├── diagram-plantuml.svg
        └── diagram-excalidraw.svg
```

Configuration is stored in `default.json` with theme colors, rendering options, and storage paths.

## Presentation Output Structure

Generated presentations follow this layout:

```
my-presentation/
├── slides.md                    # Master file (slide 1 = title from frontmatter)
├── slides/
│   ├── 02-hook.md              # Individual slide files
│   ├── 03-problem.md
│   └── ...
├── diagrams/                    # Diagram sources
├── public/images/               # Rendered diagrams
├── presentation-config.md       # Framing parameters
├── brainstorm.md                # Research notes
├── outline.md                   # Validated outline
├── handout.tex                  # LaTeX handout source
├── exports/                     # PDF/PPTX output, balance runs in exports/balance/
└── package.json                 # Slidev dependencies
```

---

- **Research references**: references/presentation-best-practices.md
- **User guide**: README.md
- **Development**: CONTRIBUTING.md
