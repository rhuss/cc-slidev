---
name: slidev:brainstorm
description: Interactive brainstorming and research phase for presentation creation
allowed-tools: ["Read", "Write", "WebSearch", "Grep", "Glob", "AskUserQuestion", "WebFetch"]
---

# Brainstorming & Information Collection

Conduct interactive brainstorming session to gather ideas, research topic, and establish foundation for evidence-based presentation.

**Approach**: Gather all context upfront in a structured way, then conduct focused research and ideation.

**Note**: This phase gathers raw material. Structure and refinement come later using evidence-based principles (see `references/presentation-best-practices.md`).

## Execution

### 1. Gather Context Upfront

**Use AskUserQuestion to collect all parameters systematically:**

#### Question 1: Title & Abstract
Ask user:
- **Rough title idea**: One-liner working title (can be revised later)
- **Abstract** (optional): CfP abstract, initial description, or main message
  - If submitting to conference: paste full abstract
  - If internal talk: brief description of what you want to cover
  - If exploring: leave blank, we'll develop together

#### Question 2: Research Materials
Ask user what materials to review:
- **Local materials**:
  - Directory path to review (e.g., `./docs`, `./research`)
  - Specific files (e.g., `notes.md`, `outline.txt`)
  - Or: "none" if starting fresh
- **Web resources**:
  - URLs to documentation, articles, or videos
  - Or: "none" if no specific URLs
- **Keywords for research**:
  - Topics or concepts to research online
  - Or: "none" to skip web research

#### Question 3: Presentation Parameters
Ask user:
- **Total length**: Duration in minutes (e.g., 20, 30, 45, 60)
- **Time per slide**: Average time per slide, or "use default"
  - **Default recommendations**:
    - **Lightning talks** (5-10 min): 30-45 seconds per slide → ~12-15 slides
    - **Standard talks** (20-30 min): 1-2 minutes per slide → ~15-20 slides
    - **Conference talks** (40-50 min): 2 minutes per slide → ~20-25 slides
    - **Deep dives** (60+ min): 2-3 minutes per slide → ~25-30 slides
  - Note: These are guidelines; actual timing varies by content

#### Question 4: Audience & Level
Ask user:
- **Target audience**: Who will watch this?
  - Examples: developers, architects, DevOps engineers, managers, students, mixed technical
- **Skill level**:
  - Beginner (new to topic)
  - Intermediate (some experience)
  - Expert (deep knowledge)
  - Mixed (varied backgrounds)
- **Context**: Where/when will this be presented?
  - Examples: conference, meetup, training session, internal presentation, webinar, university lecture

**Format interaction as single multi-question prompt for efficiency.**

### 2. Calculate Presentation Metrics

Based on gathered parameters, calculate and display:

```markdown
## Presentation Framework

**Working Title**: [Title from user]

**Duration & Pacing**:
- Total time: [X] minutes
- Time per slide: [Y] minutes (or default: [calculated])
- **Target slide count**: ~[Z] slides
  - Calculation: [X] min ÷ [Y] min/slide ≈ [Z] slides
  - Flexibility: ±3 slides (some slides faster, some slower)

**Audience Profile**:
- Who: [Audience description]
- Level: [Skill level]
- Context: [Presentation setting]

**Research Sources**:
- Local: [Directory/files or "none"]
- Web: [URLs or "none"]
- Keywords: [Topics to research or "none"]

**Abstract Status**: [Provided / To be developed]
```

**Show time-per-slide default reasoning**:
```
Example: 30-minute talk
- Opening (slide 1): ~1 min
- Content (slides 2-18): ~1.5 min average
- Closing (slide 19-20): ~1 min
- Total: ~20 slides for 30 minutes
```

**Inform user**: "These are planning targets. Actual slide count and timing will emerge during outline development."

### 3. Review Abstract and Extract Commitments

**If abstract was provided in Step 1:**

Analyze abstract and extract commitments:

1. **Read abstract carefully**
2. **Identify promises**: What did we commit to covering?
3. **Extract topics**: Specific subjects mentioned
4. **Note examples**: Any case studies, demos, or scenarios promised
5. **Determine tone**: Formal, practical, hands-on, theoretical, etc.

**Document in structured format:**
```markdown
## Abstract Analysis

**Original Abstract**:
[Full text as provided by user]

**Key Commitments** (must deliver on these):
1. [Promise 1]: We said we'd show/explain/demonstrate X
2. [Promise 2]: Specific topic we committed to cover
3. [Promise 3]: Outcome or takeaway we promised

**Required Topics**:
- [Topic 1 from abstract]
- [Topic 2 from abstract]
- [Topic 3 from abstract]

**Tone/Approach**: [Inferred style - e.g., "hands-on with live demos", "conceptual overview", "deep technical dive"]

**Examples/Demos Mentioned**:
- [Specific example 1]
- [Case study 2]
```

**If no abstract provided**:
```markdown
## Abstract Development

**Status**: Will develop abstract during/after outline creation

**Initial angle**: [Based on title and discussion]
```

### 4. Research from Local Materials

**If user provided local directory or files in Step 1:**

1. **Scan directory structure** (if directory provided):
   ```bash
   Use Glob to find relevant files:
   - Markdown files: **/*.md
   - Text files: **/*.txt
   - Documentation: **/README*, **/docs/*
   ```

2. **Read provided files**:
   - Use Read tool to review each file
   - Extract key points, concepts, examples
   - Note technical details or data

3. **Search for specific content** (if keywords provided):
   ```bash
   Use Grep to find:
   - Technical terms across files
   - Code examples
   - Configuration patterns
   ```

4. **Summarize findings**:
   ```markdown
   ## Local Materials Review

   **Files reviewed**: [N] files from [directory/paths]

   **Key findings**:
   - [Finding 1]: [From file X]
   - [Finding 2]: [From file Y]

   **Technical details captured**:
   - [Technical point 1]
   - [Data/metrics found]

   **Examples available**:
   - [Example 1 source]
   - [Example 2 source]
   ```

**If no local materials**: Skip to web research.

### 5. Research from Web Resources

**If user provided URLs in Step 1:**

1. **Fetch provided URLs**:
   ```bash
   Use WebFetch for each URL:
   - Extract main concepts
   - Capture key points
   - Note examples and data
   ```

2. **Summarize per URL**:
   ```markdown
   **[URL 1 title]**: [URL]
   - Key point 1
   - Key point 2
   - Useful example: [description]
   ```

**If user provided keywords for research:**

1. **Search for each keyword**:
   ```bash
   Use WebSearch to find:
   - Recent articles and blog posts
   - Official documentation
   - Conference talks or videos
   - Statistics and data
   - Real-world examples
   ```

2. **Limit to top 3-5 results per keyword** (avoid information overload)

3. **Summarize findings**:
   ```markdown
   ## Web Research Summary

   **Keywords researched**: [keyword 1], [keyword 2], [keyword 3]

   **Key findings**:
   - **[Keyword 1]**:
     - [Finding 1]: [Source]
     - [Finding 2]: [Source]
     - Statistics: [Data point]

   - **[Keyword 2]**:
     - [Finding 1]: [Source]
     - Real-world example: [Description]

   **Best sources discovered**:
   - [Title]: [URL] - [Why useful]
   - [Title]: [URL] - [Why useful]
   ```

**If no web research requested**: Skip this step.

### 6. Identify Key Themes and Messages

Based on all gathered information (abstract, local files, web research), synthesize:

**Extract main themes**:
```markdown
## Core Themes Identified

1. **[Theme 1]**: [Description]
   - From: [Abstract/Research/Files]
   - Supporting points: [Key points]

2. **[Theme 2]**: [Description]
   - From: [Source]
   - Supporting points: [Key points]

3. **[Theme 3]**: [Description]
   - From: [Source]
   - Supporting points: [Key points]
```

**Define key messages** (3-5 maximum):
```markdown
## Key Messages (What Audience Should Remember)

**Primary message**: [The ONE thing they must remember]

**Supporting messages**:
1. [Message 1]: [Why it matters]
2. [Message 2]: [Why it matters]
3. [Message 3]: [Why it matters]

**Call to action** (if applicable): [What should they do after this talk?]
```

### 7. Brainstorm Visual Opportunities

Based on content gathered, identify where diagrams/images would help:

```markdown
## Visual Opportunities

**Diagrams needed**:
- [Concept 1]: Architecture diagram showing [what]
  - Type: Excalidraw/Mermaid/PlantUML
  - Why: Spatial relationships / flow / structure

- [Process 2]: Flowchart for [what]
  - Type: Mermaid flowchart
  - Why: Sequential steps

**Images/screenshots**:
- [Topic 3]: Screenshot of [what]
- [Example 4]: Photo/illustration of [what]

**Data visualizations**:
- [Data point]: Chart/graph showing [what]
```

### 8. Note Potential Structure

**Don't create full outline yet** - just note potential flow:

```markdown
## Rough Structure Ideas

**Opening** (~10% of slides):
- Hook: [Compelling way to start - problem, question, story]
- Context: [Why this matters now]

**Main content** (~80% of slides):
- Section 1: [Theme/topic]
- Section 2: [Theme/topic]
- Section 3: [Theme/topic]
[Rough grouping, NOT detailed]

**Closing** (~10% of slides):
- Summary: [Key takeaways]
- Call to action: [What's next]
- Q&A

**Note**: This is exploratory - actual structure will be refined in outline phase.
```

### 9. Organize Findings into Brainstorm Document

Create `brainstorm.md` with all collected information:

```markdown
# Brainstorming: [Title]

**Date**: [Today's date]
**Status**: Research complete, ready for outline

---

## Presentation Framework

[Copy from Step 2 - metrics and parameters]

---

## Abstract & Commitments

[Copy from Step 3 - abstract analysis or development status]

---

## Research Summary

### Local Materials
[Copy from Step 4 - if applicable]

### Web Research
[Copy from Step 5 - if applicable]

---

## Key Themes & Messages

[Copy from Step 6 - themes and messages]

---

## Visual Opportunities

[Copy from Step 7 - diagrams and images needed]

---

## Rough Structure Ideas

[Copy from Step 8 - potential flow]

---

## Raw Notes & Ideas

[Any additional notes captured during research]
- [Interesting point to explore]
- [Question to answer]
- [Alternative angle to consider]

---

## References

**Local sources**:
- [File path 1]
- [File path 2]

**Web sources**:
- [Title]: [URL]
- [Title]: [URL]

**Keywords researched**: [list]

---

## Next Steps

1. Review this brainstorm document
2. Run `/slidev:outline` to create structured outline
3. Develop slides from outline
```

**Save to `brainstorm.md`**

### 10. Present Summary and Confirm

Show user a concise summary:

```markdown
## ✅ Brainstorming Complete!

**Presentation**: [Title]

**Framework**:
- Duration: [X] minutes → ~[Z] slides target
- Audience: [Who/level]
- Context: [Where]

**Research conducted**:
- ✓ Abstract analyzed (if provided)
- ✓ [N] local files reviewed
- ✓ [M] web resources researched
- ✓ [K] key themes identified

**Key themes**:
1. [Theme 1]
2. [Theme 2]
3. [Theme 3]

**Visual opportunities**: [N] diagrams/images identified

**Next step**: Create structured outline

**Files created**:
- `brainstorm.md` - Full research and findings
```

Ask: **"Does this capture the direction you want? Anything to add or adjust before we create the outline?"**

Allow user to:
- Add more research
- Adjust themes/messages
- Clarify approach
- Request changes

**Once confirmed**:
```
Great! Your brainstorm is saved to `brainstorm.md`.

Next: Run `/slidev:outline` to create a structured presentation outline
based on these findings.
```

## Tips for Execution

**Do:**
- ✅ Gather ALL parameters upfront (don't ask incrementally)
- ✅ Calculate slide count from time constraints
- ✅ Research efficiently (don't over-research)
- ✅ Extract clear themes from research
- ✅ Identify visual opportunities early
- ✅ Save all findings to brainstorm.md

**Don't:**
- ❌ Ask follow-up questions during research (you have all context)
- ❌ Create detailed outline yet (that's next phase)
- ❌ Lock into rigid structure (keep it exploratory)
- ❌ Research everything (focus on user's keywords/materials)
- ❌ Skip calculation of slide count target

**Pacing recommendations reference**:
```
Quick talks (5-10 min):   30-45 sec/slide → 10-15 slides
Standard talks (20-30):   1-2 min/slide   → 15-20 slides
Conference (40-50 min):   2 min/slide     → 20-25 slides
Deep dives (60+ min):     2-3 min/slide   → 25-30 slides
Workshops (90+ min):      Variable        → 30-40 slides + exercises
```

**Remember**: These are targets, not limits. Quality over quantity.

---

Save `brainstorm.md` and inform user that outline phase is next!
