---
name: slidev:edit
description: Edit a specific slide with table of contents context
argument-hint: "[slide-number]"
allowed-tools: ["Read", "Edit", "Grep", "Bash", "Skill", "AskUserQuestion"]
---

# Edit Slide Command

This command helps you edit a specific slide by providing context and quality analysis.

## Task

You are editing a specific slide in a Slidev presentation. Your job is to:
1. Locate and read the slide file
2. Show the user context about the slide
3. Ask what they want to do
4. Help them make improvements

## Step 1: Get the Slide Number

The slide number is in `$ARGUMENTS`. If it's missing or not a number, ask the user: "Which slide number would you like to edit?"

**CRITICAL**: Use the EXACT slide number provided. Do NOT add 1 or modify it in any way.

## Step 2: Find and Read slides.md

Use Bash to find slides.md:
```bash
find . -name "slides.md" -type f -not -path "*/node_modules/*" | head -1
```

Then use the Read tool on that file.

The slides.md file contains slide entries like:
```markdown
---
src: ./slides/06-example-slide.md
---
<!-- Slide 6: Example Slide Title -->
```

## Step 3: Extract the Slide Information

From the slides.md content you just read:

1. Find the comment that matches: `<!-- Slide {N}: {TITLE} -->` where N is the EXACT slide number from $ARGUMENTS
2. Look at the `src:` line IMMEDIATELY BEFORE that comment - that's your slide file path
3. Count how many slide comments exist total

If the slide number is greater than the total slides, error: "Only {X} slides exist. Choose 1-{X}."

## Step 4: Read the Slide File

Use the Read tool on the slide file path you extracted from the `src:` line.

## Step 5: Read Context Files (Optional)

If these files exist, read them to gather context:
- `outline.md` - presentation structure
- `speaker-notes.md` or `notes.md` - presenter notes
- `brainstorm.md` - presentation goals

## Step 6: Show Context and Menu

Display a concise summary:

```
Editing Slide {N}: {TITLE}
Position: {N} of {TOTAL} | Layout: {layout} | File: {path}

Context: {2-3 sentence summary combining info from outline, speaker notes, and slide position}
```

Then use AskUserQuestion with:
- question: "What would you like to do with this slide?"
- header: "Action"
- multiSelect: false
- options:
  1. label: "Analyze quality"
     description: "Run evidence-based quality assessment and get improvement suggestions"
  2. label: "Edit content"
     description: "Modify text, bullets, or heading directly"
  3. label: "Change layout"
     description: "Switch Slidev layout (two-cols, image-right, center, etc.)"
  4. label: "Add visuals"
     description: "Add or improve diagrams, images, or code examples"
  5. label: "Update notes"
     description: "Edit presenter notes and timing guidance"

## Step 7: Handle User Choice

### If user chooses "Analyze quality":

Invoke the "Slide Quality Assessment" skill to load the 12-point quality framework, then:
1. Read the slide file
2. Apply each of the 12 quality criteria systematically
3. Calculate quality score (X/12)
4. Identify critical violations
5. Provide prioritized recommendations with specific examples

Present results in the skill's standard format (see skill for template).

After providing the quality analysis, use AskUserQuestion:
- question: "How would you like to proceed?"
- header: "Next Step"
- multiSelect: false
- options:
  1. label: "Apply all recommendations"
     description: "Implement all suggested improvements"
  2. label: "Apply some"
     description: "Choose which recommendations to implement"
  3. label: "Make other changes"
     description: "Do something else with this slide"
  4. label: "Done"
     description: "Finish editing this slide"

If they choose "Apply all" or "Apply some":
- Use Edit tool to implement the improvements to the slide file
- Show confirmation of changes made
- Ask if they want to do anything else with this slide

### If user chooses "Edit content":

Ask them what they want to change, then use the Edit tool on the slide file.

Remember to follow evidence-based principles:
- One idea per slide
- Meaningful title (assertion, not label)
- ≤6 total elements (bullets + visuals)
- <50 words body text
- Phrases not sentences in bullets
- Visual element present

### If user chooses "Change layout":

Show available layouts and ask which one, then use Edit tool to change the frontmatter `layout:` field.

Common layouts: default, two-cols, image-right, center, quote, cover

### If user chooses "Add visuals":

Offer to:
- Add a mermaid diagram (ask what type)
- Add an image (provide placeholder)
- Add code example (ask for language and content)

Use Edit tool to add the visual element to the slide file.

### If user chooses "Update notes":

Use Edit tool to add or modify HTML comments in the slide file for presenter notes.

## Evidence-Based Quality Criteria

When making any changes, ensure slides meet these standards:
- ✓ One idea per slide
- ✓ Meaningful title (assertion: "X demonstrates Y", not label: "Results")
- ✓ ≤6 total elements (bullets + images + diagrams)
- ✓ <50 words body text (excluding title)
- ✓ Visual element present
- ✓ Phrases not sentences in bullets
- ✓ High contrast (≥4.5:1)
- ✓ Colorblind-safe
- ✓ Explainable in ~90 seconds

See `references/presentation-best-practices.md` for detailed guidelines.

## Important Notes

- DO NOT show full slide content - user has it open
- Focus on concise, CLI-friendly output
- Actually READ files - don't hallucinate content
- Use the EXACT slide number provided (don't add or subtract)
- Always offer to do more after each action
- Make improvements based on evidence-based principles
