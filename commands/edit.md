---
name: slidev:edit
description: Edit a specific slide with table of contents context
argument-hint: "[slide-number]"
allowed-tools: ["Read", "Edit", "Grep", "Bash"]
---

# Edit Specific Slide

**CRITICAL ENFORCEMENT RULES - READ FIRST:**

1. **MANDATORY FILE READING**: You MUST use the Read tool to read actual files BEFORE generating ANY output
2. **NO HALLUCINATION**: DO NOT generate slide titles, content, or examples from patterns - only show content from actual files you've read
3. **VALIDATION REQUIRED**: Before displaying context, verify you have actual file content in your context
4. **FAIL FAST**: If files don't exist or slide number is invalid, error immediately - don't generate placeholder content

**Evidence Base**: Slide editing follows research-based principles for clarity, cognitive load, and accessibility. See `references/presentation-best-practices.md` for guidelines.

## Execution

### 1. Parse Slide Number

Extract from `$ARGUMENTS`:
- Must be a valid number
- If missing or invalid: Ask user "Which slide number should we edit?"

**IMPORTANT**: The slide number provided by the user is the EXACT slide to edit. Do NOT increment or modify it.

### 2. Find and Read slides.md (MANDATORY - Use Read Tool Now)

**ACTION REQUIRED - Use Read tool to find slides.md:**

```bash
# Use Bash to locate slides.md if not in current directory
find . -name "slides.md" -type f -not -path "*/node_modules/*"
```

Then **USE Read TOOL** on the slides.md file you found.

**VALIDATION CHECKPOINT**: Do you have the actual slides.md content? If NO, STOP and find the file.

### 3. Parse Actual Slide Data (From File Content You Just Read)

The master slides.md contains comments with slide numbers like:
```markdown
---
src: ./slides/01-title.md
---
<!-- Slide 1: Title -->
```

**PROCESS THE ACTUAL FILE CONTENT:**

1. **USE Read TOOL** to read slides.md (if you haven't already)
2. Extract ALL slide comments matching `<!-- Slide (\d+): (.+) -->`
3. Count total slides from ACTUAL file
4. Find the requested slide number N in ACTUAL comments
5. Extract the ACTUAL title after the colon
6. Find the `src:` line IMMEDIATELY BEFORE that comment
7. Extract the file path

**VALIDATION CHECKPOINT**:
- If slide number > total slides: Error "Only [X] slides exist. Choose 1-[X]."
- If slide N comment not found: Error "Slide [N] not found."
- Do you have an actual file path? If NO, something went wrong - re-read the file.

### 4. Read Individual Slide File (MANDATORY - Use Read Tool Now)

**USE Read TOOL** on the slide file path you extracted (e.g., `./slides/07-nfd-detects-general-hardware-features.md`)

**VALIDATION CHECKPOINT**: Do you have the actual slide content including frontmatter and body? If NO, STOP.

### 5. Gather Optional Context Files

**Optionally read contextual files** (use Read tool only if files exist):

1. **brainstorm.md** - presentation research/goals (if exists)
2. **outline.md** - section structure/flow (if exists)
3. **notes.md** or **speaker-notes.md** - presenter notes organized by slide (if exists)
   - Look for sections mentioning slide N or the slide title
   - Extract relevant timing, delivery tips, transitions
4. **Inline presenter notes** - already in slide file you read in step 4 (HTML comments)

### 6. Display Context (VALIDATION: Must Use Actual File Content)

**FINAL VALIDATION BEFORE DISPLAY:**
- ✓ Have you read slides.md?
- ✓ Have you read the individual slide file?
- ✓ Are you using ACTUAL titles/content from files (not examples)?

**If any validation fails, STOP and use Read tool.**

Show user CONCISE context (CLI-friendly format):

```markdown
Editing Slide N: [ACTUAL TITLE]
Position: N of [TOTAL] | Layout: [layout] | File: [path]

Tagline: [Create a single-sentence prose summary that blends information from:
- outline.md section purpose and key message
- speaker-notes.md timing, delivery points, and limitations to emphasize
- inline slide notes
- the slide title itself
Capture the CORE MESSAGE this slide is trying to convey in one clear sentence.]

Context: [2-3 sentence prose summary combining relevant details from outline, speaker notes, and brainstorm that help understand the slide's role in the presentation flow and what points to emphasize during editing]
```

**Then use AskUserQuestion tool to present menu:**

```
AskUserQuestion with:
- question: "What would you like to do with this slide?"
- header: "Action"
- options:
  1. label: "Run quality assessment"
     description: "Analyze against quality criteria (references/presentation-best-practices.md)"
  2. label: "Edit content"
     description: "Modify text, bullets, or heading"
  3. label: "Change layout"
     description: "Switch Slidev layout (two-cols, default, center, etc.)"
  4. label: "Add/edit visuals"
     description: "Add diagrams, images, or improve existing visuals"
  5. label: "Update notes"
     description: "Edit presenter notes and timing guidance"
  6. label: "Done"
     description: "Finish editing this slide"
```

**IMPORTANT**: Do NOT display full slide content - user has it open. Focus on synthesized context.

### 7. Interactive Editing

When user chooses "Run quality assessment":

Use slide-optimizer agent to analyze the slide and present DETAILED results:

```markdown
Quality Score: [X/12]

Current State:
- ✓/✗ One idea per slide
- ✓/✗ Meaningful title (assertion vs label)
- ✓/✗ Element count: [X] elements (target ≤6)
- ✓/✗ Word count: [Y] words (target <50)
- ✓/✗ Visual element present
- ✓/✗ Font sizes (body ≥18pt, heading ≥24pt)
- ✓/✗ Contrast ratio (≥4.5:1)
- ✓/✗ Colorblind-safe
- ✓/✗ Standalone comprehension
- ✓/✗ Phrases not sentences
- ✓/✗ White space (≥10% margins)
- ✓/✗ Explainable in ~90 seconds

Critical violations: [List or "None"]

Recommendations (priority order):
1. [CRITICAL/HIGH/MEDIUM/LOW] - [Specific issue]
   Current: [What exists now]
   Suggested: [Concrete improvement]
   Why: [Research basis]
   Impact: [What changes]

2. [Next recommendation with same detail...]
```

**Then offer to apply improvements:**

Use AskUserQuestion:
- question: "Would you like to apply these improvements?"
- header: "Next Step"
- options:
  1. label: "Apply all recommendations"
     description: "Implement all suggested changes"
  2. label: "Apply specific ones"
     description: "Choose which recommendations to apply"
  3. label: "Make other changes"
     description: "Edit something else on this slide"
  4. label: "Done with this slide"
     description: "Return to slide selection"

If user chooses "Apply specific ones", show another menu with each recommendation as an option (multiSelect: true).

When user chooses to edit content/layout/notes/visuals:

**Content changes (Evidence-Based Rules):**
- Use Edit tool to update the **individual slide file** (e.g., `slides/05-microservices-benefits.md`)
- Changes automatically reflected in presentation
- **One idea per slide** (single central message)
- **Meaningful title** (assertion format: "X demonstrates Y", not label: "Results")
- **Cognitive load limit** (≤6 total elements: bullets + images + diagrams)
- **Minimal text** (<50 words excluding title, use phrases not sentences)
- **Detailed text → presenter notes** (MIT CommLab principle)
- Maintain Slidev syntax

**Visual changes:**
- Add mermaid diagram (use visual-design skill)
- Add image placeholder
- Reference visual-suggester agent for options

**Layout changes:**
- Change frontmatter layout
- Suggest appropriate layouts:
  - `default` - Standard
  - `image-right` - Content + image
  - `two-cols` - Side by side
  - `center` - Centered
  - `quote` - Large quote

**Notes changes:**
- Add or update presenter notes
- Include timing, transitions, examples

### 8. After Edits

Confirm changes made:
```
Updated: [brief description of what changed]
```

Then offer:
- Make more changes
- Run quality assessment (if not done yet)
- Edit another slide
- Done

## Evidence-Based Editing Checklist

Before finalizing slide edits, verify:
- [ ] **One idea**: Slide communicates exactly one central point
- [ ] **Meaningful title**: Assertion (subject + verb + finding), not label
- [ ] **Element count**: ≤6 total (bullets + images + diagrams + charts)
- [ ] **Word count**: <50 words body text (excluding title)
- [ ] **Visual element**: Diagram, image, or code present (unless quote/definition)
- [ ] **Phrases**: Bullets are phrases (3-6 words), not full sentences
- [ ] **Notes**: Detailed explanations in presenter notes, not on slide
- [ ] **Explainable**: Can be presented in ~90 seconds

## Tips

**Context is Key:**
- Always show ToC so user knows where slide fits
- Show surrounding slides if helpful
- Note transitions to/from this slide

**Be Proactive (Evidence-Based):**
- **Automatically** run slide-optimizer (not optional)
- Suggest improvements based on 12-point quality criteria
- Offer visual enhancements if slide is text-heavy (>50 words)
- Check consistency with evidence-based standards
- Convert generic labels to meaningful assertions

**Iteration:**
- Allow multiple rounds of edits
- Re-run optimizer after major changes
- Don't finalize prematurely
- Ask for confirmation before moving on

**Visual Opportunities:**
- If slide lacks visuals and >50 words, strongly suggest diagram
- Use visual-suggester for specific recommendations
- Offer to add mermaid diagram with colorblind-safe theme
- Ensure visual + content ≤6 total elements

## Example Interaction

```
User: /slidev:edit 7