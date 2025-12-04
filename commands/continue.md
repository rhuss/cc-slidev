---
name: slidev:continue
description: Resume work on an existing presentation with context and next steps
allowed-tools: ["Read", "Grep", "Glob", "Task", "AskUserQuestion", "Skill"]
skills: ["slidev:presentation-design"]
---

# Continue Working on Presentation

Resume work on an existing slide deck by analyzing current state and providing contextual next steps.

## Execution

### 1. Locate Presentation Files

Search for presentation files in current directory and subdirectories:

```bash
# Look for slides.md files
find . -name "slides.md" -type f
```

**If no slides.md found:**
- Inform user no presentation found
- Ask if they want to create a new one: `/slides:create`
- Exit

**If multiple slides.md found:**
- List all found with paths
- Ask user which one to work on
- Use selected path

**If one slides.md found:**
- Proceed with that file

### 2. Analyze Current State

Read the presentation files to understand status:

**Read master slides.md directly:**

Read the master slides.md file to extract slide information from comments:

The file contains comments like:
```markdown
---
src: ./slides/01-title.md
---
<!-- Slide 1: Title -->
```

Analyze the content:
- Count total slides (count `<!-- Slide \d+:` comments)
- Extract presentation title (from first slide comment)
- Read individual slide files to identify visual placeholders (`<!-- TODO: Visual`)
- Count slides with existing diagrams/images (mermaid blocks, image references)
- Extract section structure from slide comment descriptions

**Check for related files:**
- `outline.md` - Outline exists?
- `brainstorm.md` - Research notes?
- `cfp-and-guidelines.md` - CfP abstract?
- `presentation-config.md` - Configuration?
- `handout.tex` or `handout.pdf` - Handout generated?
- `ai-image-prompts.md` - AI prompts saved?
- `public/images/` - Images present?

### 3. Quality Assessment

Use presentation-design skill to assess current quality:

**Quick analysis:**
- Are titles meaningful assertions or generic labels?
- Do slides exceed 50 words body text?
- Do slides exceed 6 elements?
- How many slides need visuals?
- Are presenter notes present?

### 4. Present Status Summary

Show comprehensive status to user:

```markdown
## 📊 Presentation Status

**Title:** [Presentation Title]
**Location:** [path/to/slides.md]
**Slides:** [X] total ([Y] content + [Z] backup)

### Current State

**Structure:**
- ✓ Outline exists ([sections count] sections)
- ✓ Brainstorm notes present
- ✓/✗ Handout generated

**Content Quality:**
- [X]/[Total] slides have meaningful assertion titles
- [Y] slides need visual enhancement
- [Z] slides exceed 50 word limit
- [W] slides missing presenter notes

**Visual Elements:**
- [N] diagrams/images included
- [M] visual placeholders remaining
- [P] AI image prompts saved

**Files Present:**
✓ slides.md
✓/✗ outline.md
✓/✗ brainstorm.md
✓/✗ handout.pdf
✓/✗ ai-image-prompts.md
```

### 5. Identify Priority Actions

Based on current state, prioritize next steps:

**High Priority (Critical Issues):**
- Slides exceeding hard limits (>6 elements, >50 words)
- Missing meaningful titles (generic labels)
- Missing visual elements on key slides

**Medium Priority (Quality Improvements):**
- Visual placeholders to fill
- Missing presenter notes
- Handout not generated

**Low Priority (Polish):**
- AI image prompts to generate
- Export to final formats
- Preview and rehearse

### 6. Offer Contextual Next Steps

Present actionable options based on status:

```markdown
## 🎯 Suggested Next Steps

Based on the current state, here are recommended actions:

### Option 1: Fix Critical Issues [RECOMMENDED]
- [X] slides need to be split (exceed 6 elements or 50 words)
- [Y] slides need meaningful assertion titles
**Action:** Let me review and fix these automatically?

### Option 2: Complete Visual Enhancement
- [N] slides marked for visual enhancement
- [M] visual placeholders to fill
**Action:** Run `/slidev:visuals` to add diagrams and images

### Option 3: Add Presenter Notes
- [Z] slides missing comprehensive notes
**Action:** Run `/slides:notes` to generate notes for all slides

### Option 4: Generate Handout
- Handout not yet created
**Action:** Run `/slides:handout` to create comprehensive PDF handout

### Option 5: Edit Specific Slide
**Action:** `/slidev:edit <number>` to focus on individual slide

### Option 6: Preview Presentation
**Action:** `/slides:preview` to see current state in browser

### Option 7: Export Final Version
**Action:** `/slides:export pdf` or `/slides:export pptx`

---

**What would you like to work on?**
```

### 7. Interactive Mode

Ask user what they want to do:

Use AskUserQuestion tool to present options:

```
question: "What would you like to work on?"
options:
  - label: "Fix critical issues automatically"
    description: "Split oversized slides, fix titles, enforce hard limits"
  - label: "Enhance visuals"
    description: "Add diagrams, images, and visual elements"
  - label: "Add presenter notes"
    description: "Generate comprehensive notes for all slides"
  - label: "Generate handout"
    description: "Create LaTeX handout with supplementary content"
  - label: "Edit specific slide"
    description: "Focus on improving individual slide (I'll ask which one)"
  - label: "Preview presentation"
    description: "Open in browser to review current state"
  - label: "Export to PDF/PPTX"
    description: "Generate final deliverable files"
```

Based on user choice:
- **Fix critical issues**: Use Task tool to systematically fix violations
- **Enhance visuals**: Invoke `/slidev:visuals` command
- **Add notes**: Invoke `/slides:notes` command
- **Generate handout**: Invoke `/slides:handout` command
- **Edit slide**: Ask for slide number, then invoke `/slidev:edit [N]`
- **Preview**: Invoke `/slides:preview` command
- **Export**: Invoke `/slides:export` command

### 8. Handle Edge Cases

**No slides.md but outline.md exists:**
- Status: "Outline created, slides not yet generated"
- Suggest: `/slides:generate` to create slides from outline

**No slides.md and no outline.md but brainstorm.md exists:**
- Status: "Brainstorming done, outline needed"
- Suggest: `/slides:outline` to create outline from brainstorm

**Only slides.md exists (orphaned):**
- Status: "Slides exist without supporting files"
- Suggest: Continue with slides, or regenerate outline for reference

**Multiple presentation directories:**
- List all found presentations with summaries
- Let user choose which to work on
- Store choice for session

## Tips

**Be Contextual:**
- Tailor recommendations based on actual state
- Don't suggest completed actions
- Prioritize critical quality issues

**Be Informative:**
- Show clear status summary
- Explain why certain actions are recommended
- Provide file locations and stats

**Be Actionable:**
- Offer specific next commands
- Provide slide numbers for issues
- Make it easy to jump into work

**Activate Skills:**
- Presentation-design skill is activated
- User can immediately start working with best practices

## Example Interaction

```
User: /slides:continue