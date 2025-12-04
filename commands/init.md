---
name: slidev:init
description: Initialize new presentation project with full workflow orchestration
argument-hint: "[optional-topic]"
allowed-tools: ["Bash", "AskUserQuestion", "SlashCommand", "TodoWrite", "Skill"]
---

# Initialize Presentation Project

Complete end-to-end workflow orchestrator that sets up a new presentation project and guides through all phases from brainstorming to final handout.

**This is the "easy button" for new presentations** - fully automated workflow with interactive decision points.

**What it does**:
1. Creates project directory structure
2. Initializes git repository
3. Checks/installs Slidev dependencies
4. Orchestrates full creation workflow by calling specialized commands

**Use when**: Starting a brand new presentation from scratch

**Difference from individual commands**: This orchestrates the entire workflow, while individual commands handle specific tasks.

## Execution

### 1. Parse Arguments and Setup TODO Tracking

Extract topic from `$ARGUMENTS` if provided:
```bash
# User can invoke as:
# /slidev:init
# /slidev:init "Introduction to Kubernetes"
```

**Create workflow TODO list:**

Use TodoWrite tool:
```json
{
  "todos": [
    {
      "content": "Set up project directory and git",
      "activeForm": "Setting up project directory and git",
      "status": "pending"
    },
    {
      "content": "Check Slidev installation",
      "activeForm": "Checking Slidev installation",
      "status": "pending"
    },
    {
      "content": "Frame presentation scope",
      "activeForm": "Framing presentation scope",
      "status": "pending"
    },
    {
      "content": "Brainstorm and research",
      "activeForm": "Brainstorming and researching",
      "status": "pending"
    },
    {
      "content": "Create outline",
      "activeForm": "Creating outline",
      "status": "pending"
    },
    {
      "content": "Generate slides",
      "activeForm": "Generating slides",
      "status": "pending"
    },
    {
      "content": "Enhance visuals (optional)",
      "activeForm": "Enhancing visuals",
      "status": "pending"
    },
    {
      "content": "Add presenter notes (optional)",
      "activeForm": "Adding presenter notes",
      "status": "pending"
    },
    {
      "content": "Generate handout (optional)",
      "activeForm": "Generating handout",
      "status": "pending"
    }
  ]
}
```

### 2. Check Slidev Installation

Mark "Check Slidev installation" as in_progress.

Execute dependency check:
```bash
${CLAUDE_PLUGIN_ROOT}/scripts/check-slidev.sh
```

**Handle exit codes:**

**Exit code 0**: Slidev installed, up to date
- Inform user: "✓ Slidev is installed and up to date"
- Proceed

**Exit code 1**: Not installed
- Inform user: "Slidev is not installed"
- Ask: "Would you like me to install Slidev now?"
- If yes: Run installation script
  ```bash
  ${CLAUDE_PLUGIN_ROOT}/scripts/install-slidev.sh install
  ```
- If no: Exit with message "Slidev is required. Install manually: `npm install -g @slidev/cli`"

**Exit code 2**: Outdated version
- Inform user: "Slidev is outdated"
- Ask: "Would you like me to update Slidev?"
- If yes: Run update script
  ```bash
  ${CLAUDE_PLUGIN_ROOT}/scripts/install-slidev.sh update
  ```
- If no: Proceed with warning "Outdated Slidev may have compatibility issues"

Mark "Check Slidev installation" as completed.

### 3. Create Project Directory

Mark "Set up project directory and git" as in_progress.

**Determine if current directory is empty:**
```bash
# Check if current directory has any non-hidden files
if [ -z "$(ls -A | grep -v '^\.')" ]; then
  echo "empty"
else
  echo "not-empty"
fi
```

**Propose directory name:**

If topic provided in `$ARGUMENTS`:
- Convert to kebab-case: lowercase, spaces→hyphens, remove special chars
- Example: "Introduction to Kubernetes" → "introduction-to-kubernetes"

If no topic:
- Suggest: "slides"

**Ask user for directory choice:**

Use AskUserQuestion tool:
```json
{
  "questions": [
    {
      "question": "Where should I create the presentation project?",
      "header": "Location",
      "multiSelect": false,
      "options": [
        {
          "label": "Current directory",
          "description": "Use this directory for all files (only if empty)"
        },
        {
          "label": "Create: [proposed-name]",
          "description": "New directory named '[proposed-name]'"
        },
        {
          "label": "Custom name",
          "description": "Specify a different directory name"
        }
      ]
    }
  ]
}
```

**Handle choice:**

**If "Current directory" chosen:**
- If directory not empty: Ask for confirmation "Directory is not empty. Continue anyway?"
- If confirmed or empty: Set `PROJECT_DIR="."` (current directory)
- Initialize git: `git init`

**If "Create: [proposed-name]" chosen:**
- Validate name (no spaces, valid characters)
- Create directory: `mkdir -p [proposed-name]`
- Change to directory: `cd [proposed-name]`
- Set `PROJECT_DIR=[proposed-name]`
- Initialize git: `git init`

**If "Custom name" provided:**
- Validate name (convert to kebab-case if needed)
- Create directory: `mkdir -p [custom-name]`
- Change to directory: `cd [custom-name]`
- Set `PROJECT_DIR=[custom-name]`
- Initialize git: `git init`

**Create .gitignore:**
```bash
cd $PROJECT_DIR
cat > .gitignore << 'EOF'
node_modules/
dist/
.slidev/
*.log
.DS_Store
EOF
```

**Initial git commit:**
```bash
cd $PROJECT_DIR
git add .gitignore
git commit -m "Initial commit: Slidev presentation project

Assisted-By: 🤖 Claude Code"
```

**Store PROJECT_DIR** for all subsequent operations. All files will be created in this directory.

Inform user: "✓ Project initialized at: $PROJECT_DIR"

Mark "Set up project directory and git" as completed.

### 4. Phase: Framing

Mark "Frame presentation scope" as in_progress.

**Invoke frame command:**

Use SlashCommand tool:
```json
{
  "command": "/slidev:frame"
}
```

**What happens:**
- Command asks user for duration, pacing, audience, style
- Calculates target slide count
- Saves `presentation-config.md` in PROJECT_DIR

**Wait for framing completion.**

Mark "Frame presentation scope" as completed.

### 5. Phase: Brainstorming

Mark "Brainstorm and research" as in_progress.

**Invoke brainstorm command:**

Use SlashCommand tool:
```json
{
  "command": "/slidev:brainstorm"
}
```

**What happens:**
- Command reads presentation-config.md for constraints
- Prompts user for context (title, abstract, materials)
- Conducts research from local files and/or web
- Extracts themes and key messages
- Saves `brainstorm.md` in PROJECT_DIR

**Wait for brainstorm completion.**

Mark "Brainstorm and research" as completed.

### 6. Phase: Outline Creation

Mark "Create outline" as in_progress.

**Invoke outline command:**

Use SlashCommand tool:
```json
{
  "command": "/slidev:outline"
}
```

**What happens:**
- Command reads brainstorm.md and presentation-config.md
- Creates structured outline with section allocations
- Saves `outline.md` in PROJECT_DIR

**Wait for outline completion.**

**Then invoke outline validator agent:**

Use Task tool with outline-validator agent:
```
Analyze the outline at $PROJECT_DIR/outline.md and provide validation report.

Check:
- Structure quality (3-act structure, sections)
- Timing (matches presentation-config.md targets)
- Completeness (all topics from brainstorm covered)
- Slide allocation (reasonable distribution)

Provide score and specific recommendations.
```

**Review validation score:**
- If score ≥75: Inform user "✓ Outline validated, score: [X]/100" and proceed
- If score 60-74: Ask "Outline score is [X]/100. Continue or revise?"
- If score <60: Strongly recommend revision "Outline needs improvement (score: [X]/100)"

Mark "Create outline" as completed.

### 7. Phase: Slide Generation

Mark "Generate slides" as in_progress.

**Invoke generate command:**

Use SlashCommand tool:
```json
{
  "command": "/slidev:generate"
}
```

**What happens:**
- Command reads outline.md and presentation-config.md
- Generates master slides.md with includes
- Generates individual slide files in slides/ directory
- Enforces design limits (≤6 elements, <50 words, meaningful titles)
- Adds presenter notes and visual placeholders
- Creates backup slides

**Wait for generation completion.**

Inform user: "✓ Slides generated at: $PROJECT_DIR/slides.md"

Mark "Generate slides" as completed.

**Ask about preview:**
```
Would you like to preview the slides now?
```

If yes:
```bash
cd $PROJECT_DIR
${CLAUDE_PLUGIN_ROOT}/scripts/preview-slidev.sh slides.md
```

### 8. Phase: Visual Enhancement (Optional)

**Ask user:**
```
Would you like to add diagrams and images to slides now?

Options:
- Yes, enhance visuals now
- Skip for now (can run /slidev:visuals later)
```

If yes, mark "Enhance visuals (optional)" as in_progress:

**Invoke visuals command:**

Use SlashCommand tool:
```json
{
  "command": "/slidev:visuals"
}
```

**What happens:**
- Command scans slides for visual opportunities
- Presents diagram/image options for each slide
- Interactive selection
- Adds chosen visuals to slides

**Wait for completion.**

Mark "Enhance visuals (optional)" as completed.

If no, mark as completed with note "(skipped)".

### 9. Phase: Presenter Notes (Optional)

**Ask user:**
```
Would you like to generate comprehensive presenter notes?

Notes include:
- Key points to emphasize
- Timing guidance
- Transition phrases
- Examples and anecdotes

Options:
- Yes, generate notes now
- Skip (can run /slidev:notes later)
```

If yes, mark "Add presenter notes (optional)" as in_progress:

**Invoke notes command:**

Use SlashCommand tool:
```json
{
  "command": "/slidev:notes"
}
```

**What happens:**
- Command reads all slides
- Generates/enhances presenter notes
- Adds timing guidance
- Updates slides.md

**Wait for completion.**

Mark "Add presenter notes (optional)" as completed.

If no, mark as completed with note "(skipped)".

### 10. Phase: Handout Generation (Optional)

**Ask user:**
```
Would you like to generate a comprehensive LaTeX handout?

Handout includes:
- Slide images (exported as PNGs)
- Prose explanations (expands on slide content)
- Further reading links (researched URLs)
- Standalone document for attendees

Requires: pdflatex (LaTeX)

Options:
- Yes, generate handout now
- Skip (can run /slidev:handout later)
```

If yes, mark "Generate handout (optional)" as in_progress:

**Invoke handout command:**

Use SlashCommand tool:
```json
{
  "command": "/slidev:handout"
}
```

**What happens:**
- Command exports slides to PNGs
- Researches further reading URLs
- Creates handout.tex with prose
- Compiles to handout.pdf

**Wait for completion.**

Mark "Generate handout (optional)" as completed.

If no, mark as completed with note "(skipped)".

### 11. Completion Summary

**Present final summary:**

```markdown
## ✅ Presentation Initialized Successfully!

**Project Directory**: $PROJECT_DIR

**Files Created**:
- `slides.md` - Master Slidev presentation ([X] slides)
- `slides/` - Individual slide files (modular structure)
- `outline.md` - Presentation structure
- `brainstorm.md` - Research and ideas
- `presentation-config.md` - Framing parameters
- `handout.tex` + `handout.pdf` (if generated)
- `public/images/` - Visual assets
- `exports/` - Exported files
- `.gitignore` - Git configuration

**Git Repository**:
- Initialized at: $PROJECT_DIR
- Initial commit created
- Commits made at each phase (brainstorm, outline, slides, etc.)

**Presentation Stats**:
- Duration: [X] minutes
- Slides: [Y] main + [Z] backup
- Sections: [N] sections
- Visuals: [M] diagrams/images (if enhanced)

**Next Steps**:

1. **Preview presentation**:
   ```bash
   cd $PROJECT_DIR
   slidev slides.md
   ```
   Press 'p' for presenter mode with notes

2. **Edit specific slide**:
   - Edit files in `slides/` directory directly
   - Or use: `/slidev:edit [number]`

3. **Add/improve visuals** (if not done):
   `/slidev:visuals`

4. **Generate handout** (if not done):
   `/slidev:handout`

5. **Export to PDF**:
   ```bash
   cd $PROJECT_DIR
   slidev export slides.md --output presentation.pdf
   ```

6. **Export to PowerPoint**:
   ```bash
   cd $PROJECT_DIR
   slidev export slides.md --format pptx
   ```

**Project initialized with research-based defaults**:
- ✓ Meaningful assertion titles (not generic labels)
- ✓ One idea per slide enforced
- ✓ ≤6 elements per slide (cognitive load limit)
- ✓ <50 words body text per slide
- ✓ Accessibility defaults (18pt+ fonts, 4.5:1 contrast)
- ✓ Colorblind-safe color palette
- ✓ Comprehensive presenter notes
- ✓ Backup slides for Q&A
- ✓ Modular structure for easy editing

**Workflow commands used**:
1. `/slidev:frame` - Scope and parameters
2. `/slidev:brainstorm` - Research and ideation
3. `/slidev:outline` - Structure creation
4. `/slidev:generate` - Slide generation
5. `/slidev:visuals` - Visual enhancement (optional)
6. `/slidev:notes` - Presenter notes (optional)
7. `/slidev:handout` - LaTeX handout (optional)

**Individual commands available for refinement**:
- `/slidev:edit [N]` - Edit specific slide
- `/slidev:diagram [N]` - Create/improve diagram
- `/slidev:extract-outline` - Re-extract outline from slides
- `/slidev:continue` - Resume work on presentation
- `/slidev:preview` - Preview in browser
- `/slidev:export` - Export to various formats

Ready to present! 🎉
```

## Workflow Overview

This command orchestrates the full workflow:

```
/slidev:init "Topic"
    ↓
1. Setup (unique to init)
    ├─ Create project directory
    ├─ Initialize git
    └─ Check Slidev dependencies
    ↓
2. Frame (calls /slidev:frame)
    ├─ Set duration
    ├─ Calculate slide count
    └─ Define audience/style
    ↓
3. Brainstorm (calls /slidev:brainstorm)
    ├─ Gather context
    ├─ Research materials
    └─ Extract themes
    ↓
4. Outline (calls /slidev:outline)
    ├─ Create structure
    └─ Validate with agent
    ↓
5. Generate (calls /slidev:generate)
    ├─ Create slides.md
    ├─ Generate individual slides
    └─ Add notes/placeholders
    ↓
6. Enhance (calls /slidev:visuals) [optional]
    ├─ Suggest diagrams
    ├─ Add images
    └─ Interactive selection
    ↓
7. Notes (calls /slidev:notes) [optional]
    └─ Enhance presenter notes
    ↓
8. Handout (calls /slidev:handout) [optional]
    ├─ Export slides
    ├─ Research URLs
    └─ Generate PDF
    ↓
Done! ✅
```

## Design Principles

**Modularity**: Each phase handled by specialized command
**Orchestration**: Init coordinates the workflow
**Optionality**: User chooses optional phases
**Tracking**: TODO list shows progress
**Git commits**: Snapshots at each phase
**Research-based**: Evidence-based defaults throughout

## Error Handling

**Slidev not installed:**
- Offer to install automatically
- Provide manual instructions if declined

**Directory already exists:**
- Ask for confirmation
- Offer alternative name

**Command fails:**
- Show error from command
- Ask: "Continue with next phase or exit?"
- Allow skipping failed phase

**User cancels:**
- Save progress (TODOs show what's complete)
- Inform how to resume: `/slidev:continue`

## Tips

**For best results:**
- Have topic idea ready (or use brainstorm to explore)
- Know approximate duration target
- Have research materials prepared (optional)
- Allow time for full workflow (~30-60 minutes)

**What makes init different:**
- **Full automation**: One command, complete presentation
- **Guided workflow**: Interactive at decision points
- **Project setup**: Handles directory and git
- **Orchestration**: Calls specialized commands
- **Progress tracking**: TODO list shows status

**When to use init vs individual commands:**
- **Use init**: Starting from scratch, want automation
- **Use individual**: Working on existing presentation, targeted changes

---

Initialize complete presentation project with one command!
