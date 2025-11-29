---
name: slidev:extract-outline
description: Extract structured outline from existing slides
allowed-tools: ["Read", "Write", "Grep", "Glob", "Bash"]
---

# Extract Outline from Existing Slides

Reverse engineer a structured outline from an existing Slidev presentation by analyzing slide structure, titles, and content.

**Use cases**:
- Legacy presentations needing structure documentation
- Received slides from collaborators, need outline for context
- Made extensive slide edits, want updated outline
- Creating handout outline from presentation
- Refactoring presentation structure

## Execution

### 1. Locate Presentation

**Search for slides.md files:**
```bash
# Find all slides.md in current directory and subdirectories
find . -name "slides.md" -type f -not -path "*/node_modules/*"
```

**If no slides.md found**:
- Inform user: "No presentation found in current directory"
- Suggest: "Create a new presentation with `/slidev:create` or `/slidev:generate`"
- Exit

**If multiple slides.md found**:
- List all with paths and brief descriptions
- Ask user which one to analyze
- Use selected path

**If exactly one found**:
- Proceed with that file
- Show path to user: "Analyzing presentation at: [path]"

### 2. Read Master Slides File

**Read slides.md to extract structure:**

The master file contains slide includes with comments:
```markdown
---
src: ./slides/01-title.md
---
<!-- Slide 1: Title -->

---
src: ./slides/02-hook.md
---
<!-- Slide 2: Hook - Opening question -->
```

**Parse master file:**
1. Extract all `src:` paths to individual slide files
2. Extract slide numbers and descriptions from comments (format: `<!-- Slide N: Description -->`)
3. Build slide mapping: slide number → file path → description

**Expected data structure:**
```
Slides:
  1: ./slides/01-title.md → "Title"
  2: ./slides/02-hook.md → "Hook - Opening question"
  3: ./slides/03-problem.md → "Problem Statement"
  ...
  18: ./slides/18-conclusion.md → "Conclusion - Key Takeaways"
  19: ./slides/19-questions.md → "Questions"
  20: ./slides/20-backup-methodology.md → "Backup - Detailed Methodology"
```

### 3. Read Individual Slide Files

**For each slide file, extract:**

1. **Slide title** (first H1 heading):
   ```markdown
   # Microservices enable independent scaling and deployment
   ```
   Extract: "Microservices enable independent scaling and deployment"

2. **Layout type** (from frontmatter):
   ```yaml
   ---
   layout: center
   ---
   ```
   Detect section headers: `layout: center`, `layout: cover`, `layout: section-header`

3. **Content summary**:
   - Count bullets
   - Note if code block present
   - Note if diagram/image present
   - Extract first few words if no bullets

4. **Presenter notes timing** (if present):
   ```markdown
   <!--
   PRESENTER NOTES:
   Timing: 90 seconds
   -->
   ```
   Extract timing if specified

**Build enriched slide data:**
```
Slide 5:
  File: ./slides/05-microservices-benefits.md
  Title: "Microservices enable independent scaling and deployment"
  Layout: image-right
  Content: 4 bullets + diagram
  Timing: 90 seconds (or default)
  IsBackup: false
```

### 4. Detect Section Boundaries

**Identify sections by analyzing slide patterns:**

**Section header indicators:**
- Slide with `layout: center` (section break slide)
- Slide with `layout: section-header`
- Slide title that's a topic name (e.g., "Introduction", "Architecture Overview")
- Significant topic shift detected in consecutive titles

**Section detection algorithm:**

1. **Explicit section headers**: Slides with center/section-header layout
2. **Topic clustering**: Group consecutive slides with related content
3. **Special slides**: Identify Introduction, Conclusion, Q&A, Backup sections

**Rules:**
- Slides 1-3: Usually "Introduction" section (title, hook, problem/context)
- Center layout slides: Section boundaries (each starts a new section)
- Last 2-3 slides before backup: "Conclusion" section
- Slides with "Backup" in comment: "Backup Slides" section
- Everything else: Group by topic similarity

**Example detection:**
```
Slide 1 (layout: cover) → Start "Introduction"
Slides 2-3 (default) → Continue "Introduction"
Slide 4 (layout: center, title: "Architecture Overview") → Start "Architecture" section
Slides 5-10 (default) → Continue "Architecture"
Slide 11 (layout: center, title: "Implementation") → Start "Implementation" section
Slides 12-16 (default) → Continue "Implementation"
Slide 17 (layout: center, title: "Conclusion") → Start "Conclusion"
Slides 18-19 (default) → Continue "Conclusion"
Slide 20+ (comment contains "Backup") → Start "Backup Slides"
```

### 5. Calculate Section Timing

**For each section:**

1. Count slides in section
2. Calculate total time:
   - If slides have timing in presenter notes: sum those
   - Otherwise: slide_count × default_timing (90 seconds)
3. Convert to minutes

**Example:**
```
Section "Architecture": 6 slides × 90s = 540s = 9 minutes
```

### 6. Generate Structured Outline

**Create outline.md following standard format:**

```markdown
# [Presentation Title]

**Extracted from**: [path/to/slides.md]
**Extraction date**: [today's date]
**Total slides**: [N] main slides + [M] backup slides
**Estimated duration**: [X] minutes

---

## Introduction ([N] slides, ~[X] minutes)

1. **Slide 1**: [Title extracted from slide]
   - [Brief content summary if helpful]

2. **Slide 2**: [Title]
   - [Content summary]

3. **Slide 3**: [Title]

---

## [Section 1 Name] ([N] slides, ~[X] minutes)

4. **Slide 4**: [Title]

5. **Slide 5**: [Title]
   - [Content note if significant: "Includes diagram", "Code example", etc.]

6. **Slide 6**: [Title]

...

---

## [Section 2 Name] ([N] slides, ~[X] minutes)

...

---

## Conclusion ([N] slides, ~[X] minutes)

17. **Slide 17**: [Title]

18. **Slide 18**: [Title]

19. **Slide 19**: [Title] (Q&A)

---

## Backup Slides ([N] slides)

20. **Slide 20**: [Title]
   - [Purpose: "Detailed methodology for reference"]

21. **Slide 21**: [Title]
   - [Purpose: "Alternative approaches discussed"]

---

## Notes

**Section structure**: [N] main sections
**Visual elements**: [M] slides with diagrams/images
**Code examples**: [K] slides with code blocks

**Timing assumptions**:
- Default: 90 seconds per slide
- Actual timing may vary based on content complexity

**Detected patterns**:
- Section headers: [List center layout slides]
- Main narrative: Slides [N-M]
- Supporting material: Backup slides [K+]
```

**Key outline features:**

1. **Slide numbers preserved**: Each line shows which slide it came from
2. **Titles extracted**: Actual slide titles (assertions)
3. **Sections auto-detected**: Based on layout and content patterns
4. **Timing calculated**: Per section and total
5. **Content notes**: Significant elements noted (diagrams, code)
6. **Metadata**: Extraction date, source path, statistics

### 7. Save Outline

**Write to outline.md:**

Save in same directory as slides.md:
```bash
# If slides.md is at ./presentation/slides.md
# Save outline.md at ./presentation/outline.md
```

**Inform user:**
```markdown
✅ Outline extracted from presentation!

**Source**: [path/to/slides.md]
**Output**: [path/to/outline.md]

**Extracted structure**:
- Total slides: [N] main + [M] backup
- Sections detected: [K]
- Estimated duration: [X] minutes

**Sections**:
1. Introduction ([N] slides, ~[X] min)
2. [Section 1] ([N] slides, ~[X] min)
3. [Section 2] ([N] slides, ~[X] min)
4. Conclusion ([N] slides, ~[X] min)
5. Backup Slides ([N] slides)

**Next steps**:
- Review `outline.md` to verify section organization
- Edit section names if needed
- Use outline for handout creation or planning
- Update outline as you modify slides
```

### 8. Offer Review and Refinement

**Ask user:**
```
The outline has been extracted and saved to `outline.md`.

Would you like me to:
1. Show the full outline for review
2. Adjust section groupings
3. Continue with other tasks
```

**If user wants adjustments:**

**Common refinements:**
- Rename sections (detected names might be generic)
- Merge sections (if auto-detection split too much)
- Split sections (if clustering missed boundaries)
- Adjust backup slide classification
- Add section descriptions

**Interactive refinement:**
```
Current sections detected:
1. Introduction (3 slides)
2. Architecture Overview (6 slides)
3. Implementation (5 slides)
4. Conclusion (3 slides)
5. Backup Slides (4 slides)

Do these sections look correct?
- Change section names?
- Merge/split sections?
- Looks good?
```

Apply refinements and re-save outline.md.

## Section Detection Patterns

### Pattern 1: Explicit Section Headers

**Indicators:**
- `layout: center` or `layout: section-header`
- Title is a topic/section name (short, 1-3 words)
- No bullets or minimal content (just title)

**Example:**
```markdown
---
layout: center
---

# Architecture Overview
```

**Action**: Start new section with this title

### Pattern 2: Standard Introduction

**Indicators:**
- Slide 1: `layout: cover` (title slide)
- Slide 2: Hook/opening (question, problem, statistic)
- Slide 3: Context or agenda

**Action**: Group slides 1-3 as "Introduction" section

### Pattern 3: Standard Conclusion

**Indicators:**
- Last 2-3 slides before backup
- Titles contain: "takeaways", "summary", "conclusion", "next steps", "Q&A"
- Follow main content slides

**Action**: Group last few slides as "Conclusion" section

### Pattern 4: Backup Slides

**Indicators:**
- Comment contains "Backup" or "backup"
- After conclusion slides
- Typically numbered 20+

**Action**: Group all remaining slides as "Backup Slides" section

### Pattern 5: Topic Clustering

**For remaining slides without explicit markers:**

1. Extract keywords from slide titles
2. Group consecutive slides with similar keywords
3. Use most common keyword as section name
4. Default section size: 4-7 slides

**Example:**
```
Slide 5: "GPU scheduling enables resource sharing"
Slide 6: "GPU partitioning with MIG technology"
Slide 7: "Time-slicing allows multiple workloads"
Slide 8: "Scheduling policies affect performance"

→ Group as section: "GPU Scheduling" (4 slides)
```

## Edge Cases and Handling

### Edge Case 1: No Section Headers

**Problem**: Presentation has no `layout: center` slides

**Solution**:
- Use topic clustering for all content slides
- Create sections of ~5 slides each
- Infer section names from slide title keywords
- Note in outline: "Sections inferred from content patterns"

### Edge Case 2: Very Short Presentation

**Problem**: <10 slides total

**Solution**:
- Don't force sections
- Simple linear outline:
  - Introduction (slides 1-2)
  - Main Content (slides 3-7)
  - Conclusion (slides 8-9)

### Edge Case 3: Non-Standard Structure

**Problem**: Presentation doesn't follow intro/main/conclusion pattern

**Solution**:
- Detect actual structure (e.g., all section headers, no intro)
- Extract as-is without forcing standard pattern
- Add note in outline: "Custom structure detected"

### Edge Case 4: Missing Slide Files

**Problem**: `src:` path points to non-existent file

**Solution**:
- Note missing slide: `4. **Slide 4**: [File missing: ./slides/04-missing.md]`
- Continue extraction with available slides
- Warn user about missing files

### Edge Case 5: Inline Slides (No Separate Files)

**Problem**: Some/all slides are inline in master slides.md (not using `src:`)

**Solution**:
- Parse inline slides directly from master file
- Extract titles and content from inline markdown
- Include in outline with note: "(inline)"

## Quality Checks

Before saving outline, validate:

1. **All slides accounted for**: Outline slide count = actual slide count
2. **Section names meaningful**: Not just "Section 1", "Section 2"
3. **Timing reasonable**: Total time matches expectations
4. **Backup slides separated**: Clearly marked in separate section
5. **Titles extracted**: Each outline entry has actual slide title

**Validation report:**
```
✓ All [N] slides included in outline
✓ [K] sections detected with meaningful names
✓ Total timing: [X] minutes (reasonable)
✓ Backup slides: [M] identified
✓ Slide titles: [N] extracted successfully
```

## Tips

**For best results:**
- Presentations with clear section headers (`layout: center`) extract perfectly
- Meaningful assertion titles extract better than generic labels
- Presenter notes with timing info improve timing estimates
- Backup slide comments help identify supporting material

**Limitations:**
- Section detection is heuristic-based (may need manual refinement)
- Timing estimates assume 90s/slide default
- Topic clustering works best with consistent title patterns

**After extraction:**
- Review section groupings
- Rename sections if needed
- Use outline for handout creation
- Keep outline updated as slides change

---

Extract outline and provide structured view of presentation!
