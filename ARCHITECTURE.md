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
```

### Component Responsibilities

| Component | Purpose |
|-----------|---------|
| **Commands** | Orchestrate workflow phases (brainstorm, outline, generate, etc.) |
| **Skills** | Provide contextual knowledge (design principles, Slidev expertise, diagram conventions) |
| **Agents** | Validate and analyze (outline validation, visual suggestions) |
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
    ├── commands/                   # Slash commands (18 total)
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
    │   └── visual-suggester.md    # Visual enhancement advisor
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
    │   └── translate-diagram.js   # Cross-platform conversion
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

### Commands (Semantic Decisions)

| Concern | Handled By |
|---------|------------|
| Content structure and flow | LLM (commands) |
| Visual design decisions | LLM (commands + skills) |
| Quality enforcement | LLM (skills provide rules) |
| Outline validation | Agent (outline-validator) |
| File operations and rendering | Scripts |

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
├── exports/                     # PDF/PPTX output
└── package.json                 # Slidev dependencies
```

---

- **Research references**: references/presentation-best-practices.md
- **User guide**: README.md
- **Development**: CONTRIBUTING.md
