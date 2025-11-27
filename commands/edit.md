---
name: slidev:edit
description: Edit a specific slide with table of contents context
argument-hint: "[slide-number]"
allowed-tools: ["Read", "Edit", "Grep", "Task", "Skill"]
skills: ["slidev:presentation-design"]
---

# Edit Specific Slide

Focus on editing a specific slide with full context of presentation structure, applying evidence-based quality standards.

**Evidence Base**: Slide editing follows research-based principles for clarity, cognitive load, and accessibility. See `references/presentation-best-practices.md` for guidelines.

## Execution

### 1. Parse Slide Number

Extract from `$ARGUMENTS`:
- Must be a valid number
- If missing or invalid: Ask user "Which slide number should we edit?"

**IMPORTANT**: The slide number provided by the user is the EXACT slide to edit. Do NOT increment or modify it.

### 2. Read Master slides.md and Locate Slide File

Find the presentation:
- Look for `slides.md` in current directory
- Look in subdirectories (presentation folders)
- If multiple found: Ask user which one

**Read slides.md directly** to find slide file path:

The master slides.md contains comments with slide numbers:
```markdown
---
src: ./slides/01-title.md
---
<!-- Slide 1: Title -->

---
src: ./slides/05-microservices-benefits.md
---
<!-- Slide 5: Microservices Benefits -->
```

**To find a specific slide:**
1. Read the master slides.md file using the Read tool
2. Search for the comment pattern `<!-- Slide N: ... -->` where N is the EXACT number requested
3. Extract the description after the colon (this is the slide title)
4. Find the `src:` line immediately preceding (in the frontmatter block above)
5. Extract the file path
6. Read the individual slide file to get full content

**To build table of contents:**
- Extract all comments matching `<!-- Slide \d+: .* -->`
- Parse slide number and description
- Count total slides

If slide number > total slides:
- Error: "Only [X] slides exist. Choose 1-[X]."

If comment for requested slide N not found:
- Error: "Slide [N] not found. Use slide numbers from table of contents."

### 3. Gather Comprehensive Context

**Read contextual files to understand slide purpose:**

1. **Check for brainstorm.md** in presentation directory:
   - If exists: Search for mentions of slide topic/keywords
   - Extract relevant research, objectives, or key points
   - Note if this slide relates to CfP commitments

2. **Check for outline.md** in presentation directory:
   - If exists: Find section where this slide appears
   - Extract outline context (section goals, flow)
   - Note slide's role in presentation structure

3. **Read slide's presenter notes**:
   - Extract any `<!-- PRESENTER NOTES: -->` sections from slide file
   - Parse key points, timing, delivery tips
   - Note transition guidance

### 4. Display Context

Show user comprehensive context:

```markdown
# Editing Slide [N]: [Slide Title]

**Position:** Slide [N] of [X]

---

## 📋 Table of Contents

1. [Slide 1 title]
2. [Slide 2 title]
3. [Slide 3 title]
...
**→ [N]. [Current slide title]** ← You are here
...
[X]. [Last slide title]

---

## 🎯 Slide Context

**From outline.md:**
[If outline.md exists and mentions this slide:
- Section: [Section name]
- Purpose: [Why this slide is here]
- Flow: [How it fits in narrative]
]
[If not found: "No outline context available"]

**From brainstorm.md:**
[If brainstorm.md exists and has relevant info:
- Related key points: [List]
- Research/sources: [Relevant findings]
- CfP commitments: [If applicable]
]
[If not found: "No brainstorming context available"]

**Presenter notes:**
[If slide has presenter notes:
- Key points to emphasize
- Timing guidance
- Delivery tips
- Transitions
]
[If not found: "No presenter notes yet"]

---

## 📄 Current Slide Content

### Frontmatter
```yaml
[Slide frontmatter - layout, image, etc.]
```

### Slide Body
[Slide content - heading, bullets, diagrams]

---
```

### 5. Analyze Slide (Evidence-Based Quality Check)

**Automatically** use slide-optimizer agent to check against 12-point quality criteria:
```
Analyze slide [N] using slide-optimizer agent to identify improvement opportunities.
```

Present analysis with evidence-based scoring:
```markdown
## 📊 Evidence-Based Quality Analysis

**Slide [N]: [Slide Title]**

**Quality Score: [X/12]**

**Current state:**
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

**Critical violations:** [List or "None"]

**Recommendations:**
1. [Priority order: CRITICAL → HIGH → MEDIUM → LOW]
```

### 6. Interactive Editing

Ask user: "What would you like to change on this slide?"

Options to offer:
- **Content**: Revise text, bullets, heading
- **Visual**: Add/modify diagram or image
- **Layout**: Change Slidev layout
- **Notes**: Update presenter notes
- **Apply suggestions**: Use optimizer recommendations

Based on user choice:

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

### 7. Preview Changes

After edits, show updated slide:
```markdown
## Updated Slide [N]

[New slide content]

---

**Changes Made:**
- [Change 1]
- [Change 2]
```

Ask: "Does this look good? Any other changes needed?"

Allow iteration until satisfied.

### 8. Optimization Check

After user-requested changes, ask:
"Should I run the optimizer to check if there are other improvements?"

If yes:
- Run slide-optimizer agent again
- Show if any new issues found
- Offer to apply suggestions

### 9. Navigation

Ask: "What would you like to do next?"

Options:
- Edit another slide
- Preview presentation
- Continue with next workflow step
- Done editing

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