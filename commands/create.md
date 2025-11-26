---
name: create
description: Create a complete presentation from brainstorming to handout generation
argument-hint: "[optional-topic]"
allowed-tools: ["Read", "Write", "Edit", "Bash", "WebSearch", "Grep", "Glob", "Task", "AskUserQuestion", "TodoWrite"]
---

# Slidedeck Creation - Complete Workflow

Execute the full presentation creation workflow from initial brainstorming through final handout generation using evidence-based best practices.

**Evidence Base**: This workflow applies research-based principles for presentation design, cognitive load management, accessibility, and effective communication. See `references/presentation-best-practices.md` for detailed guidelines.

## Overview

Guide the user through all phases of presentation creation:
1. Brainstorming & Information Collection
2. Framing (scope, duration, slide count)
3. Outline Creation & Validation
4. Slide Generation
5. Visual Enhancement
6. Presenter Notes
7. Handout Generation

## Execution Steps

### 1. Parse Arguments and Initial Setup

Extract topic from command argument if provided:
- `$ARGUMENTS` contains optional topic
- If topic provided: Use as starting point
- If no topic: Begin with brainstorming questions

Create TODO list for workflow tracking:
```
- Brainstorming and research
- Framing presentation scope
- Creating outline
- Generating slides
- Enhancing visuals
- Adding presenter notes
- Creating handout
```

### 2. Check Slidev Installation

Execute script to check if Slidev is available:
```bash
${CLAUDE_PLUGIN_ROOT}/scripts/check-slidev.sh
```

Handle exit codes:
- **0**: Slidev installed, up to date → Proceed
- **1**: Not installed → Offer to install
- **2**: Outdated version → Offer to update

If installation/update needed:
```bash
${CLAUDE_PLUGIN_ROOT}/scripts/install-slidev.sh install
# or
${CLAUDE_PLUGIN_ROOT}/scripts/install-slidev.sh update
```

### 3. Create Project Directory

**Determine if current directory is empty:**
```bash
# Check if current directory has any files (excluding hidden files starting with .)
if [ -z "$(ls -A | grep -v '^\.')" ]; then
  # Directory is empty
fi
```

**Propose directory name:**
- If topic provided in `$ARGUMENTS`: Convert to kebab-case (lowercase, spaces to hyphens, no special chars)
  - Example: "Introduction to Kubernetes" → "introduction-to-kubernetes"
- If no topic: Suggest "slides" as default

**Ask user for directory choice:**

Use AskUserQuestion tool:
```
question: "Where should I create the presentation project?"
options:
  - label: "Create in current directory"
    description: "Use the current directory for all presentation files"
  - label: "Create new directory: [proposed-name]"
    description: "Create a new directory named '[proposed-name]' and work there"
  - label: "Custom directory name"
    description: "Specify a different directory name"
```

**If current directory chosen:**
- Verify it's empty or ask for confirmation if not empty
- Set `PROJECT_DIR` to current directory (`.`)
- Initialize git: `git init`

**If new directory chosen:**
- Validate directory name (no spaces, valid characters)
- Create directory: `mkdir -p [directory-name]`
- Change to directory: `cd [directory-name]`
- Set `PROJECT_DIR` to directory name
- Initialize git: `git init`

**If custom name provided:**
- Validate name (no spaces, convert to kebab-case if needed)
- Create directory: `mkdir -p [custom-name]`
- Change to directory: `cd [custom-name]`
- Set `PROJECT_DIR` to custom name
- Initialize git: `git init`

**Create initial git commit:**
```bash
# Create .gitignore
cat > .gitignore << 'EOF'
node_modules/
dist/
.slidev/
*.log
.DS_Store
EOF

git add .gitignore
git commit -m "Initial commit: Slidev presentation project

Assisted-By: 🤖 Claude Code"
```

**Track project directory:**
Store `PROJECT_DIR` for all subsequent file operations. All files (`brainstorm.md`, `outline.md`, `slides.md`, etc.) should be created in this directory.

### 4. Phase 1: Brainstorming & Information Collection

**This phase MUST be highly interactive.**

Ask comprehensive questions to understand scope:

**Topic & Objectives:**
- What is the presentation about?
- What are the main objectives?
- What should the audience learn or do?

**CfP Abstract & Guidelines:**
- Do you have a Call for Papers (CfP) abstract for this presentation?
- Do you have any initial guidelines or notes about what you want to talk about?

**If CfP abstract provided:**
- Read and analyze the abstract
- Extract key commitments and promises made
- Identify main themes and topics
- Note any specific examples or case studies mentioned
- Use this as the foundation for content development

**If guidelines provided:**
- Review user's initial thoughts and ideas
- Identify preferred focus areas
- Note any specific requirements or constraints
- Understand what the user is excited about covering

**Audience:**
- Who is the target audience?
- What is their expertise level (beginner/intermediate/expert)?
- What are their expectations?

**Context:**
- What's the setting? (conference, meeting, class, pitch)
- What prompted this presentation?
- Are there specific requirements or constraints?

**Research needs:**
- What information do you already have?
- Should I research additional information? (web search)
- Are there local files I should review?

Based on answers:
- Use WebSearch for online research if approved
- Use Read/Grep for local file analysis if paths provided
- Gather key points, statistics, examples
- Identify potential visual opportunities

Create files:

**`cfp-and-guidelines.md` (if CfP or guidelines provided):**
```markdown
## CfP Abstract (if provided)
[Full abstract text]

### Commitments from Abstract
- [Key point 1 promised in abstract]
- [Key point 2 promised in abstract]
- [Topics that must be covered]

## Initial Guidelines (if provided)
[User's notes and guidelines]

### Focus Areas
- [What user wants to emphasize]
- [Specific angles or approaches]
- [Must-include content]
```

**`brainstorm.md`:**
- CfP abstract summary and key commitments (if applicable)
- User guidelines (if applicable)
- Topic and objectives
- Audience analysis
- Key points discovered
- References and sources
- Potential structure ideas

Commit progress:
```bash
cd $PROJECT_DIR
git add brainstorm.md cfp-and-guidelines.md presentation-config.md
git commit -m "Add brainstorming and research

Assisted-By: 🤖 Claude Code"
```

Mark brainstorming TODO as complete.

### 5. Phase 2: Framing

**Define presentation scope through interactive questions.**

Use AskUserQuestion tool for efficient gathering:

**Duration & Scope:**
```
question: "How long should the presentation be?"
options:
  - "5-10 minutes (Lightning talk)"
  - "15-20 minutes (Standard)"
  - "30-45 minutes (Deep dive)"
  - "60+ minutes (Workshop/Tutorial)"
```

**Slide Count (Evidence-Based - 90s/slide default):**
Calculate recommendation based on duration using formula:
```
Expected slides = (duration_minutes × 60) / 90
Acceptable range = expected ± 20%
```

**Recommendations:**
- 5-10 min: 3-7 slides (at 90s each)
- 15-20 min: 10-16 slides
- 30-45 min: 20-30 slides
- 60+ min: 40-50 slides

**Research basis**: 90 seconds (1.5 minutes) per slide allows for technical content explanation without rushing.

Ask if they want different count or accept recommendation.

**Style & Tone:**
```
question: "What style should the presentation have?"
options:
  - "Professional/Corporate"
  - "Academic/Formal"
  - "Technical/Developer-focused"
  - "Creative/Casual"
```

**Visual preferences:**
```
question: "Should we include visual elements?"
options:
  - "Yes, diagrams and images"
  - "Diagrams only"
  - "Minimal visuals"
```

Document decisions in `presentation-config.md`:
```markdown
---
topic: [Topic]
duration_minutes: [X]
target_slide_count: [Y]
audience: [Description]
style: [Style choice]
visuals: [Yes/No/Minimal]
---
```

Mark framing TODO as complete.

### 6. Phase 3: Outline Creation

**Auto-generate outline based on brainstorming and framing.**

Create structured outline following presentation-design skill principles:
- Three-act structure (Setup 15-20%, Confrontation 60-70%, Resolution 15-20%)
- 3-5 main sections (Rule of Three)
- Clear narrative arc
- Specific slide allocations

**Outline structure:**
```markdown
# [Presentation Title]

## Introduction (X slides, Y minutes)
1. Hook - [Compelling opening]
2. Problem - [Why this matters]
3. Agenda - [What to expect]

## Section 1: [Topic] (X slides, Y minutes)
1. Slide topic
2. Slide topic
...

## Section 2: [Topic] (X slides, Y minutes)
...

## Section 3: [Topic] (X slides, Y minutes)
...

## Conclusion (X slides, Y minutes)
1. Summary - [Key takeaways]
2. Next Steps - [Call to action]
3. Q&A
```

Save to `outline.md` in the `PROJECT_DIR`.

Commit progress:
```bash
cd $PROJECT_DIR
git add outline.md
git commit -m "Add presentation outline

Assisted-By: 🤖 Claude Code"
```

### 7. Phase 4: Outline Validation

**Use outline-validator agent to check quality.**

Call the agent:
```
Use the outline-validator agent to analyze the outline and provide validation report.
```

Review validation report:
- If score >75: Proceed to slides
- If score 60-75: Ask user if they want to revise or proceed
- If score <60: Recommend revision, offer to help fix issues

If revision needed:
- Address high-priority issues
- Update outline.md
- Re-validate if major changes

Mark outline TODO as complete once validated.

### 8. Phase 5: Slide Generation

**Auto-generate Slidev slides from validated outline.**

Create subdirectories in `PROJECT_DIR`:
```bash
mkdir -p public/images exports
```

Generate `slides.md` using Slidev syntax and slidev-mastery skill:

**Frontmatter:**
```yaml
---
theme: [based on style choice]
background: [if applicable]
class: text-center
highlighter: shiki
lineNumbers: false
drawings:
  persist: false
transition: slide-left
title: [Presentation Title]
---
```

**For each section in outline:**
- Choose appropriate layout (cover, center, two-cols, image-right, etc.)
- **ENFORCE HARD LIMITS:**
  - MAX 6 elements per slide (bullets + visuals + code combined)
  - MAX 50 words body text (excluding title)
  - MAX 1-2 code blocks per slide (8-10 lines each)
  - ONE idea per slide
- **If content exceeds limits → SPLIT into multiple slides**
- Create concise content (phrases not sentences: max 6 words per bullet)
- Add presenter notes with `<!-- -->` comments
- Mark visual placeholders where diagrams/images would enhance

**Visual placeholders format:**
```markdown
<!-- TODO: Visual opportunity
Type: [mermaid diagram / stock photo / AI image]
Suggestion: [What would work here]
-->
```

Write to `slides.md` in `PROJECT_DIR`.

Commit progress:
```bash
cd $PROJECT_DIR
git add slides.md public/ exports/
git commit -m "Generate Slidev presentation slides

Assisted-By: 🤖 Claude Code"
```

Mark slides TODO as complete.

Ask user: "Would you like to preview the slides now or continue with visual enhancement?"

If preview requested:
```bash
cd $PROJECT_DIR
${CLAUDE_PLUGIN_ROOT}/scripts/preview-slidev.sh slides.md
```

### 9. Phase 6: Visual Enhancement (Optional)

**Offer visual enhancement - user can skip.**

Ask: "Should we enhance slides with diagrams and images?"

If yes, proceed with `/slidedeck:enhance-visuals` logic:

1. Use visual-suggester agent to analyze slides
2. Identify slides with visual opportunities
3. For each opportunity, present options:
   - Mermaid diagram variations
   - Stock photo suggestions
   - AI image prompts

4. Interactive selection:
   - Show options for slide
   - User chooses preferred option
   - Implement chosen option (add mermaid code, download image, or save AI prompt)

5. Maintain visual theme consistency:
   - Apply color palette to all diagrams
   - Suggest matching image filters
   - Ensure icon style consistency

Save AI prompts to `ai-image-prompts.md` in `PROJECT_DIR` if generated.

Commit progress:
```bash
cd $PROJECT_DIR
git add slides.md public/images/ ai-image-prompts.md
git commit -m "Enhance slides with visual elements

Assisted-By: 🤖 Claude Code"
```

Mark visual enhancement TODO as complete.

### 10. Phase 7: Presenter Notes

**Auto-generate comprehensive presenter notes.**

For each slide in slides.md:
- If notes already exist: Enhance them
- If no notes: Generate based on slide content

**Notes should include:**
- Key points to emphasize
- Timing guidance ("Spend 2 minutes here")
- Transitions to next slide
- Examples or anecdotes to share
- Answers to likely questions

Add/update presenter notes in slides.md:
```markdown
# Slide Title

Slide content

<!--
PRESENTER NOTES:
- [Detailed notes for this slide]
- Timing: [X] minutes
- Transition: [How to move to next slide]
-->
```

Commit progress:
```bash
cd $PROJECT_DIR
git add slides.md
git commit -m "Add comprehensive presenter notes

Assisted-By: 🤖 Claude Code"
```

Mark presenter notes TODO as complete.

### 11. Phase 8: Handout Generation

**Create comprehensive LaTeX handout if user wants it.**

Ask: "Would you like to generate a comprehensive handout (requires LaTeX)?"

If yes:

Check LaTeX availability:
```bash
command -v pdflatex
```

If not available:
- Explain LaTeX installation needed
- Provide install instructions
- Skip handout generation

If available, follow these steps:

**Step 1: Export slides to individual PNGs**
```bash
cd $PROJECT_DIR
${CLAUDE_PLUGIN_ROOT}/scripts/export-slides.sh slides.md png exports
```

This creates `exports/slide-001.png`, `exports/slide-002.png`, etc.

**Step 2: Research further reading resources**

For each major section of the presentation, use WebSearch to find:
- Official documentation
- Authoritative articles and papers
- Tutorial resources
- Best practices guides
- Community resources (forums, discussions)

Find 3-5 high-quality URLs per section that provide deeper technical details, real-world examples, and current best practices.

**Step 3: Create comprehensive handout.tex**

Using latex-handouts skill, create `handout.tex` in `PROJECT_DIR`:

**Handout structure:**
```latex
\documentclass[11pt,a4paper]{article}
\usepackage[utf8]{inputenc}
\usepackage[margin=1in]{geometry}
\usepackage{graphicx}
\usepackage{hyperref}
\usepackage{fancyhdr}
\usepackage{float}
\usepackage{parskip}

\hypersetup{
    pdftitle={[Title] - Handout},
    colorlinks=true,
    linkcolor=blue,
    urlcolor=cyan
}

\title{[Presentation Title]\\[0.5em]\large Comprehensive Handout}
\author{[Author name or default]}
\date{\today}

\pagestyle{fancy}
\fancyhead[L]{[Presentation Title]}
\fancyhead[R]{\thepage}

\begin{document}
\maketitle
\tableofcontents
\newpage

% For each section:
\section{[Section Name]}

% For each slide in section:
\subsubsection{[Slide Title]}

\begin{figure}[H]
  \centering
  \includegraphics[width=0.75\textwidth]{exports/slide-[NNN].png}
  \caption{[Slide Title]}
\end{figure}

\paragraph{Overview:}
[Write 2-4 complete sentences in prose expanding on the slide content.
Transform bullet points into flowing narrative that explains the concept,
provides context, and connects to the broader topic.]

\paragraph{Key Considerations:}
[Write prose discussing implications, trade-offs, or important details.
Explain WHY things matter, provide examples, discuss real-world applications.
Add value beyond what's visible on the slide.]

\paragraph{Technical Details:}
[If applicable: Explain code, architecture decisions, implementation.
Write in prose, not bullets. Explain HOW things work, not just WHAT.]

\paragraph{Further Reading:}
\begin{itemize}
  \item \href{https://...}{[Resource Title]} - [What reader will learn]
  \item \href{https://...}{[Resource Title]} - [What it covers]
  \item \href{https://...}{[Resource Title]} - [Why it's useful]
\end{itemize}

\vspace{0.5cm}

% Section summary
\paragraph{Section Summary:}
[2-3 sentences tying together all slides in this section]

\newpage

\section{Additional Resources}

\subsection{Further Reading by Topic}

% Organized by sections
\subsubsection{[Section 1 Topic]}
\begin{itemize}
  \item \href{https://...}{[Title]} - [Description]
  \item \href{https://...}{[Title]} - [Description]
\end{itemize}

\subsection{Official Documentation}
\begin{itemize}
  \item \href{https://...}{[Official Docs]} - [Coverage]
\end{itemize}

\subsection{Community Resources}
\begin{itemize}
  \item \href{https://...}{[Forum/Tutorial]} - [What it is]
\end{itemize}

\end{document}
```

**Critical handout requirements:**
- ✅ **Write in prose** - Complete sentences and paragraphs, NOT bullet points
- ✅ **Expand on slides** - Explain concepts in detail that slides only hint at
- ✅ **Add researched URLs** - Include 3-5 quality resources per section
- ✅ **Make standalone** - Reader understands content without attending presentation
- ❌ **Don't copy bullets** - Transform slide bullets into flowing explanations

**Step 4: Compile handout**

Compile handout:
```bash
cd $PROJECT_DIR
${CLAUDE_PLUGIN_ROOT}/scripts/compile-handout.sh handout.tex
```

Commit progress:
```bash
cd $PROJECT_DIR
git add handout.tex handout.pdf exports/
git commit -m "Generate comprehensive handout

Assisted-By: 🤖 Claude Code"
```

Mark handout TODO as complete.

### 12. Completion Summary

Present completion summary:

```markdown
## ✅ Presentation Created Successfully!

**Project Directory:** $PROJECT_DIR

**Files Created:**
- `slides.md` - Main Slidev presentation ([X] slides)
- `outline.md` - Presentation structure
- `brainstorm.md` - Research and ideas
- `cfp-and-guidelines.md` - CfP abstract and guidelines (if provided)
- `handout.tex` - LaTeX handout source
- `handout.pdf` - Compiled handout
- `ai-image-prompts.md` - AI image generation prompts (if applicable)
- `exports/slides.pdf` - Exported slides

**Next Steps:**

1. **Preview slides:**
   ```bash
   cd $PROJECT_DIR
   slidev slides.md
   ```

2. **Export to other formats:**
   ```bash
   cd $PROJECT_DIR
   # PDF
   slidev export slides.md --output presentation.pdf

   # PowerPoint
   slidev export slides.md --format pptx
   ```

3. **Edit specific slides:**
   `/slidedeck:edit-slide [number]`

4. **Enhance visuals:**
   `/slidedeck:enhance-visuals` (if not done yet)

**Presentation Stats:**
- Duration: [X] minutes
- Slides: [Y] total
- Sections: [Z] main sections
- Visuals: [N] diagrams/images
```

## Error Handling

**Slidev not installed:**
- Offer installation
- Provide manual install instructions if automated fails

**LaTeX not available:**
- Skip handout generation gracefully
- Provide installation guide for user's OS

**Web search fails:**
- Continue with user-provided information
- Note limitation in brainstorm.md

**File write errors:**
- Check permissions
- Suggest alternative location
- Provide error details

## Best Practices

**User Experience:**
- Keep user informed of progress (update TODOs)
- Ask for confirmation at key decision points
- Offer to skip optional phases
- Provide clear next steps

**Content Quality (Evidence-Based):**
- **Follow presentation-design skill principles** (one idea per slide, meaningful titles, cognitive load limits)
- **Apply slidev-mastery skill** for Slidev syntax and accessibility defaults
- **Use visual-design skill** for colorblind-safe visuals and diagram design
- **Validate with agents** before proceeding (outline-validator, slide-optimizer)
- **Apply research standards**:
  - One idea per slide (CRITICAL)
  - ≤6 elements per slide (cognitive load)
  - <50 words body text per slide
  - Meaningful assertion titles (not generic labels)
  - 90s timing default (configurable)
  - Accessibility defaults (fonts ≥18pt, contrast 4.5:1+, colorblind-safe)

**File Organization:**
- Keep all files in `PROJECT_DIR` (established in Phase 3)
- Use consistent naming conventions
- Track progress with git commits after each major phase
- Use the commit tagline: "Assisted-By: 🤖 Claude Code"

**Time Management:**
- Don't spend excessive time on research
- Auto-generate where possible
- Interactive only where necessary (brainstorming, framing)

## Tips

- If user provides topic in argument, use it to propose directory name but still ask framing questions
- Always work within `PROJECT_DIR` - use absolute paths or cd into it
- Commit to git after each major phase (with "Assisted-By: 🤖 Claude Code" tagline)
- Directory names must not contain spaces (use kebab-case)
- Default to current directory if it's empty
- Always check for existing files before overwriting
- Provide preview opportunities throughout
- Make each phase skippable if user wants

Execute this workflow systematically, keeping the user informed and involved at key decision points.
