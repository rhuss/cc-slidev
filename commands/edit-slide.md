---
name: slides:edit-slide
description: Edit a specific slide with table of contents context
argument-hint: "<slide-number>"
allowed-tools: ["Read", "Edit", "Grep", "Task", "Skill"]
skills: ["slidedeck:presentation-design"]
---

# Edit Specific Slide

Focus on editing a specific slide with full context of presentation structure, applying evidence-based quality standards.

**Evidence Base**: Slide editing follows research-based principles for clarity, cognitive load, and accessibility. See `references/presentation-best-practices.md` for guidelines.

## Execution

### 1. Parse Slide Number

Extract from `$ARGUMENTS`:
- Must be a valid number
- If missing or invalid: Ask user "Which slide number should we edit?"

### 2. Read Master slides.md and Locate Slide File

Find the presentation:
- Look for `slides.md` in current directory
- Look in subdirectories (presentation folders)
- If multiple found: Ask user which one

**Read slides.md directly** to find slide file path:

The master slides.md contains comments with slide numbers:
```markdown
<!-- Slide 1: Title -->
src: ./slides/title.md
---

<!-- Slide 5: Microservices Benefits -->
src: ./slides/microservices-benefits.md
---
```

**To find a specific slide:**
1. Read the master slides.md file using the Read tool
2. Search for the comment pattern `<!-- Slide N: ... -->`
3. Extract the description after the colon
4. Find the `src:` line immediately following
5. Extract the file path

**To build table of contents:**
- Extract all comments matching `<!-- Slide \d+: .* -->`
- Parse slide number and description
- Count total slides

If slide number > total slides:
- Error: "Only [X] slides exist. Choose 1-[X]."

### 3. Display Context

Show user the context:

```markdown
## Table of Contents

1. [Slide 1 title]
2. [Slide 2 title]
3. [Slide 3 title]
...
**→ SLIDE [N]: [Current slide title]** ← We're here
...
[X]. [Last slide title]

---

## Current Slide ([N] of [X])

[Full slide content including frontmatter, content, and notes]

---
```

### 4. Analyze Slide (Evidence-Based Quality Check)

**Automatically** use slide-optimizer agent to check against 12-point quality criteria:
```
Analyze slide [N] using slide-optimizer agent to identify improvement opportunities.
```

Present analysis with evidence-based scoring:
```markdown
**Evidence-Based Quality Score: [X/12]**

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

### 5. Interactive Editing

Ask user: "What would you like to change on this slide?"

Options to offer:
- **Content**: Revise text, bullets, heading
- **Visual**: Add/modify diagram or image
- **Layout**: Change Slidev layout
- **Notes**: Update presenter notes
- **Apply suggestions**: Use optimizer recommendations

Based on user choice:

**Content changes (Evidence-Based Rules):**
- Use Edit tool to update the **individual slide file** (e.g., `slides/microservices-benefits.md`)
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

### 6. Preview Changes

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

### 7. Optimization Check

After user-requested changes, ask:
"Should I run the optimizer to check if there are other improvements?"

If yes:
- Run slide-optimizer agent again
- Show if any new issues found
- Offer to apply suggestions

### 8. Navigation

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
User: /slidedeck:edit-slide 7