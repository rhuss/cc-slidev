# Slidedeck Plugin for Claude Code

> Professional presentation creation using Slidev - from brainstorming to handout generation

## Overview

**Create clean, professional presentations that audiences can actually read.** The Slidedeck plugin enforces hard limits to prevent overcrowded slides, ensures accessibility by default, and guides you through every phase of presentation development:

1. **Brainstorming & Research** - Interactive ideation with web research, CfP analysis, and local file analysis
2. **Framing** - Define scope, audience, and constraints
3. **Outline Creation** - Structured narrative with validation
4. **Slide Generation** - Clean, accessible Slidev markdown with enforced limits
5. **Visual Enhancement** - Mermaid diagrams, stock photos, AI image prompts
6. **Presenter Notes** - Comprehensive speaker notes for each slide
7. **Handout Generation** - Professional LaTeX handout with slides, prose explanations, and research links

## Features

### 🎯 Design Enforcement

**Prevents common presentation mistakes through automatic hard limits:**
- **≤6 elements per slide** - Prevents information overload (based on cognitive load research)
- **<50 words per slide** - Ensures slides remain scannable, not readable
- **One idea per slide** - Automatically splits dense content into multiple focused slides
- **Meaningful titles** - "System handles 10K req/sec" not "Results"
- **Accessibility defaults** - 18pt+ fonts, 4.5:1+ contrast, colorblind-safe colors
- **90-second timing** - Default pacing prevents rushing (configurable: 60s-180s)

**If your content exceeds limits, the plugin splits it into additional slides instead of cramming.**

### 🔄 Complete Workflow
- **Interactive brainstorming** with CfP analysis and web research
- **Automated outline** generation and validation
- **Clean slide creation** with enforced limits and accessibility
- **Visual enhancement** with diagrams and images
- **Comprehensive handouts** with prose explanations and research links

### 🎨 Visual Enhancement
- **Mermaid diagrams** - Multiple options per slide, inline or high-quality rendering
- **Stock photos** - Unsplash integration with smart search suggestions
- **AI image prompts** - DALL-E, Midjourney-ready prompts
- **Theme consistency** - Color palette and style coordination

### 🛠️ Developer-Friendly
- **Slidev integration** - Preview, export, live development
- **Global installation** - Automatic version checking and updates
- **LaTeX support** - Optional handout generation with pdflatex

## Prerequisites

### Required
- **Node.js** (v18 or later)
- **npm** (comes with Node.js)

### Optional
- **Slidev** (plugin will install/update automatically)
- **mermaid-cli** for offline diagram rendering

### For Handout Generation
- **LaTeX** (pdflatex) - Core compiler required
  - macOS: `brew install --cask mactex-no-gui`
  - Ubuntu: `sudo apt-get install texlive-latex-base texlive-latex-extra`
- **LaTeX Packages** - For enhanced formatting (optional)
  - tcolorbox - Colored boxes and callouts
  - enumitem - Enhanced list formatting
  - macOS with MacTeX: `sudo tlmgr install tcolorbox enumitem`
  - Ubuntu: Included in `texlive-latex-extra`
- **Playwright Chromium** - For slide PNG export (optional)
  - `npx playwright install chromium`

## Installation

### From Local Directory (Development)

```bash
cc --plugin-dir /path/to/slidedeck
```

### Copy to Project

```bash
cp -r slidedeck ~/.claude-plugins/
```

## Usage

### Quick Start

Create a complete presentation with one command:

```
/slidedeck:create Introduction to Kubernetes
```

This will:
1. Guide you through interactive brainstorming
2. Research the topic (web + local files)
3. Generate a structured outline
4. Create Slidev slides with placeholders for visuals
5. Offer visual enhancement (diagrams, images)
6. Generate presenter notes
7. Create comprehensive handout (if LaTeX installed)

### Individual Commands

Work on specific phases independently:

```bash
# Brainstorming phase only
/slidedeck:brainstorm

# Create or revise outline
/slidedeck:outline

# Generate slides from outline
/slidedeck:slides

# Edit a specific slide with context
/slidedeck:edit-slide 5

# Add presenter notes
/slidedeck:notes

# Enhance all visuals
/slidedeck:enhance-visuals

# Create diagram for specific slide
/slidedeck:diagram 7

# Generate LaTeX handout
/slidedeck:handout
```

### Utilities

```bash
# Preview slides with Slidev dev server
/slidedeck:preview

# Export to PDF, PPTX, etc.
/slidedeck:export pdf
/slidedeck:export pptx
```

## Project Structure

When you create a presentation, the plugin creates this structure:

```
introduction-to-kubernetes/
├── slides.md              # Main Slidev presentation
├── outline.md            # Presentation outline
├── brainstorm.md         # Research and ideas
├── handout.tex           # LaTeX handout source
├── handout.pdf           # Compiled handout
├── package.json          # Slidev dependencies
├── public/
│   └── images/           # Downloaded/generated images
└── exports/
    ├── slides.pdf
    └── slides.pptx
```

## Configuration

Create `.claude/slidedeck.local.md` in your project for custom preferences:

```yaml
---
# Slidev settings
theme: default                    # seriph, apple-basic, etc.
export_format: pdf                # pdf, pptx, png

# LaTeX settings
latex_template: article           # article, report
presenter_notes: true             # Include notes by default
handout_research: true            # Include extra research

# Visual theme
visual_theme:
  primary_color: "#3b82f6"        # Blue
  secondary_color: "#8b5cf6"      # Purple
  accent_color: "#f59e0b"         # Amber
  style: "modern-minimal"         # modern-minimal, professional, creative, technical

# Rendering preferences
mermaid_rendering: inline         # inline, offline, online
stock_photo_source: unsplash      # unsplash, pexels, none
ai_image_service: dalle           # dalle, midjourney, stable-diffusion

# Presentation defaults
default_slide_count: 10
default_duration_minutes: 15
slides_per_minute: 1.5
---
```

All fields are optional with sensible defaults.

## Visual Enhancement Workflow

The plugin provides multiple ways to add visuals:

### Mermaid Diagrams

Generate multiple diagram options for any slide:

```
/slidedeck:diagram 5
```

Generates 2-3 variations with different diagram types:
- Flowcharts for processes
- Sequence diagrams for interactions
- Class diagrams for architecture
- Component diagrams for systems

**Rendering options:**
- **Inline** (default) - Rendered by Slidev, fast and integrated
- **Offline** - High-quality SVG via mermaid-cli
- **Online** - Manual rendering at mermaid.live

### Stock Photos

Interactive stock photo suggestions:
- Search terms generated from slide content
- Direct Unsplash links provided
- Automatic download and optimization
- Proper attribution included

### AI Image Prompts

Ready-to-use prompts for:
- **DALL-E 3** - Detailed scene descriptions
- **Midjourney v6** - Parameter-optimized prompts
- **Stable Diffusion** - Negative prompts included

Prompts saved to `ai-image-prompts.md` for easy reference.

## Agents

The plugin includes specialized agents that work autonomously:

### slide-optimizer
Reviews slides for clarity, visual balance, and effectiveness. Triggers automatically after slide generation or manually via `/slidedeck:edit-slide`.

### outline-validator
Validates presentation outline for logical flow, completeness, and time constraints. Ensures presentation fits target duration.

### visual-suggester
Analyzes slides and suggests appropriate visuals (diagrams, photos, illustrations). Generates multiple options per slide.

## Skills

The plugin provides domain expertise through four specialized skills:

- **slidev-mastery** - Slidev syntax, themes, components, and best practices
- **presentation-design** - Storytelling, visual hierarchy, audience engagement
- **latex-handouts** - LaTeX document structure, formatting, compilation
- **visual-design** - Mermaid diagrams, color theory, AI prompting, stock photos

These skills activate automatically when relevant to your task.

## Examples

### Academic Presentation

```
/slidedeck:create Machine Learning Fundamentals
```

Interactive questions:
- Target audience: Graduate students
- Duration: 45 minutes
- Slide count: 30-35 slides
- Style: Academic formal

Result: Detailed slides with mathematical diagrams, references, comprehensive handout.

### Business Pitch

```
/slidedeck:create Product Launch Pitch
```

Interactive questions:
- Target audience: Investors
- Duration: 10 minutes
- Slide count: 10 slides
- Style: Professional modern

Result: Concise slides with data visualization, stock photos, executive summary.

### Technical Tutorial

```
/slidedeck:create Docker for Beginners
```

Interactive questions:
- Target audience: Developers
- Duration: 30 minutes
- Slide count: 20 slides
- Style: Technical developer-friendly

Result: Code examples, architecture diagrams, hands-on exercises.

## Troubleshooting

### Slidev not found

Plugin will offer to install automatically. Or install manually:

```bash
npm install -g @slidev/cli
```

### Handout Dependencies

The plugin automatically checks handout dependencies and offers to install missing components.

**LaTeX (required):**

macOS:
```bash
brew install --cask mactex-no-gui
```

Ubuntu/Debian:
```bash
sudo apt-get install texlive-latex-base texlive-latex-extra
```

Fedora/RHEL:
```bash
sudo dnf install texlive-scheme-basic texlive-latex
```

**Playwright Chromium (optional - for slide PNG export):**
```bash
npx playwright install chromium
```

Without Playwright: Handout will be text-only without embedded slide images.

**LaTeX Packages (optional - for enhanced formatting):**

macOS with MacTeX:
```bash
sudo tlmgr install tcolorbox enumitem
```

Ubuntu: Already included in `texlive-latex-extra`

Without these packages: Handout will use basic LaTeX formatting without colored boxes and enhanced lists.

**Check all dependencies:**
```bash
./scripts/check-handout-deps.sh
```

The plugin offers automatic installation with user confirmation when dependencies are missing.

### Mermaid rendering quality

For highest quality diagrams, install mermaid-cli:

```bash
npm install -g @mermaid-js/mermaid-cli
```

Plugin will automatically use it for offline rendering.

## Development

### Testing

```bash
# Run with plugin in development
cc --plugin-dir /path/to/slidedeck

# Test specific command
/slidedeck:create Test Presentation
```

### Validation

Validate plugin structure:

```bash
# From plugin-dev plugin
Use plugin-validator agent
```

## License

MIT © Roland Huss

## Contributing

This is a personal plugin, but feedback and suggestions are welcome!

## Changelog

### 0.1.0 (Initial Release)
- Complete presentation workflow
- Slidev integration with preview and export
- Visual enhancement with mermaid, stock photos, AI prompts
- LaTeX handout generation
- Interactive brainstorming and framing
- Autonomous agents for optimization and validation
