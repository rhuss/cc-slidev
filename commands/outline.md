---
name: outline
description: Create or revise presentation outline from brainstorming notes
allowed-tools: ["Read", "Write", "Edit", "Task"]
---

# Outline Creation & Revision

Create evidence-based, timed presentation outline or revise existing outline based on feedback.

**Evidence Base**: Outlines validated using research-based timing (default 90s/slide) from PLOS Computational Biology. See `references/presentation-best-practices.md`.

## Execution

### 1. Check for Existing Materials

Look for:
- `brainstorm.md` - Source material
- `outline.md` - Existing outline to revise
- `presentation-config.md` - Framing decisions

If creating new outline without brainstorming:
- Ask user for topic and key points
- Gather framing information (duration, audience, style)

### 2. Calculate Target Slide Count (Evidence-Based)

**Default timing:** 90 seconds (1.5 minutes) per slide

**Formula:**
```
Expected slides = (duration_minutes × 60) / seconds_per_slide
Acceptable range = expected ± 20%
```

**Pacing options (configurable):**
- Fast (60s/slide): Brief updates, high-level overviews
- **Moderate (90s/slide): DEFAULT** - technical content, balanced detail
- Detailed (120s/slide): Complex topics, deep dives
- Deep dive (180s/slide): Research talks, comprehensive analysis

**Examples:**
- 15-min talk @ 90s/slide = 10 slides (acceptable: 8-12)
- 20-min talk @ 90s/slide = 13 slides (acceptable: 10-16)
- 30-min talk @ 90s/slide = 20 slides (acceptable: 16-24)
- 45-min talk @ 90s/slide = 30 slides (acceptable: 24-36)

Include Q&A time if needed (typically 15-20% of total).

### 3. Apply Presentation Structure Principles

Use presentation-design skill principles:

**Three-Act Structure:**
- Act 1 (Setup): 15-20% of slides
  - Hook to grab attention
  - Problem/opportunity statement
  - Agenda preview

- Act 2 (Confrontation): 60-70% of slides
  - Main content sections
  - Build complexity progressively
  - Evidence and examples

- Act 3 (Resolution): 15-20% of slides
  - Synthesize key points
  - Clear takeaways
  - Call to action

**Rule of Three:**
- 3-5 main sections (ideally 3)
- 3 key takeaways
- 3 supporting points per section

### 3. Generate Outline Structure

Create `outline.md` with this format:

```markdown
# [Presentation Title]

**Duration:** [X] minutes
**Target Slides:** [Y] slides
**Audience:** [Description]

---

## Introduction ([N] slides, [M] minutes)

### Slide 1: Title/Cover
- Presentation title
- Subtitle/context
- Speaker info

### Slide 2: Hook
- [Compelling question/statistic/story]
- Why this matters now

### Slide 3: Problem/Opportunity
- [What challenge or opportunity]
- Current state
- Why change needed

### Slide 4: Agenda
- Overview of what's coming
- Set expectations

---

## Section 1: [Topic Name] ([N] slides, [M] minutes)

### Slide 5: [Slide topic]
- Main point
- Supporting details
- Visual: [Type of visual needed]

### Slide 6: [Slide topic]
...

---

## Section 2: [Topic Name] ([N] slides, [M] minutes)

### Slide X: [Slide topic]
...

---

## Section 3: [Topic Name] ([N] slides, [M] minutes)

### Slide Y: [Slide topic]
...

---

## Conclusion ([N] slides, [M] minutes)

### Slide Z-2: Summary
- Key takeaway 1
- Key takeaway 2
- Key takeaway 3

### Slide Z-1: Next Steps
- Call to action
- Resources
- Contact info

### Slide Z: Q&A
- Questions and answers

---

## Notes

**Transition Points:**
- Intro → Section 1: [How to transition]
- Section 1 → Section 2: [How to transition]
- ...

**Visual Opportunities:**
- Slide X: [Diagram type needed]
- Slide Y: [Image type needed]
- ...

**Time Allocation:**
- Introduction: [M] min
- Section 1: [M] min
- Section 2: [M] min
- Section 3: [M] min
- Conclusion: [M] min
- **Total: [X] minutes**
```

### 4. Validate Outline

Use the outline-validator agent:
```
Validate outline structure, flow, and time feasibility using outline-validator agent.
```

Review validation report and address issues:
- **Score 90-100:** Excellent, proceed
- **Score 75-89:** Good, minor tweaks
- **Score 60-74:** Needs revision
- **Score <60:** Major rework required

If revisions needed:
- Show user the validation report
- Ask: "Should I fix the issues or would you like to guide the changes?"
- Apply fixes based on recommendations

### 5. Iterate Based on Feedback

Ask user: "Does this outline cover the right topics in the right order?"

If user wants changes:
- Listen to feedback
- Update outline.md
- Re-validate if major changes
- Confirm final version

### 6. Finalize

Once approved:
- Save final outline.md
- Note any special requirements for slide generation
- Inform user that slide generation is next step

## Tips for Good Outlines

**Do:**
- Balance section lengths
- Include slide count estimates
- Note transition points
- Identify visual needs
- Plan timing realistically
- Build complexity gradually

**Don't:**
- Have too many main sections (>5)
- Create unbalanced sections
- Skip transitions
- Forget introduction or conclusion
- Exceed time constraints
- Leave outline too abstract

## Revision Mode

If revising existing outline:

1. Read current outline.md
2. Ask what needs to change:
   - Reorder sections?
   - Add/remove content?
   - Adjust depth?
   - Fix flow issues?

3. Show diff of changes
4. Re-validate after updates

## Next Steps

After outline is finalized:
- "Your outline is ready! Next, I can generate the actual slides. Proceed?"
- Offer to explain any part of the outline
- Suggest running `/slidedeck:slides` to generate slides
