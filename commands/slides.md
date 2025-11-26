---
name: slides
description: Generate Slidev slides from outline
allowed-tools: ["Read", "Write", "Bash", "Grep"]
---

# Slide Generation

Generate evidence-based, accessible Slidev slides from validated outline.

**Evidence Base**: Slides generated following research from The Scientist, TED, PLOS Computational Biology, MIT Communication Lab. See `references/presentation-best-practices.md` for full guidelines.

**Default Timing**: 90 seconds (1.5 minutes) per slide (configurable: 60s-180s)

## Execution

### 1. Prerequisites

Check for required files:
- `outline.md` - Must exist
- `presentation-config.md` - For style/theme preferences (optional)
- `brainstorm.md` - For additional context (optional)

If outline.md missing:
- Inform user outline is needed first
- Offer to run `/slidedeck:outline`
- Exit

### 2. Determine Project Directory

Extract topic from outline title and create directory name:
```
Title: "Introduction to Kubernetes"
→ Directory: "introduction-to-kubernetes"
```

Create project structure:
```bash
mkdir -p [topic-slug]/{public/images,exports}
```

### 3. Generate Slidev Frontmatter (Accessibility-First)

Using slidev-mastery skill, create frontmatter with accessibility defaults:

**Professional/Corporate (Default):**
```yaml
---
theme: default
background: '#ffffff'
class: text-center
highlighter: shiki
lineNumbers: false
transition: slide-left
title: [Title]
---

<style>
/* Evidence-based accessibility defaults */
h1 { font-size: 3rem; }      /* ~48pt - headings ≥24pt required */
h2 { font-size: 2rem; }      /* ~32pt */
h3 { font-size: 1.5rem; }    /* ~24pt */
p, li { font-size: 1.25rem; } /* ~20pt - body ≥18pt required */

body {
  font-family: 'Helvetica Neue', Arial, sans-serif; /* Sans-serif for body */
}

/* Colorblind-safe default palette: Blue + Orange */
:root {
  --primary: #3b82f6;    /* Blue - 8.6:1 contrast on white */
  --secondary: #f97316;  /* Orange - 3.4:1 (headings only) */
  --neutral: #6b7280;    /* Gray */
  --text: #1f2937;       /* Dark gray - 16.1:1 contrast */
}
</style>
```

**Technical/Developer:**
```yaml
---
theme: seriph
highlighter: shiki
lineNumbers: true
transition: fade
title: [Title]
---

<style>
/* Accessibility overrides for seriph theme */
h1 { font-size: 3rem; }
h2 { font-size: 2rem; }
p, li { font-size: 1.25rem; }
</style>
```

**Academic:**
```yaml
---
theme: default
class: text-left
highlighter: prism
transition: none
title: [Title]
---

<style>
h1 { font-size: 3rem; }
h2 { font-size: 2rem; }
p, li { font-size: 1.25rem; }
</style>
```

### 4. Generate Slides from Outline (Evidence-Based Rules)

For each slide in outline, apply these critical principles:

**1. Meaningful Titles (Assertions, Not Labels)**
- Convert generic labels to specific assertions
- Format: subject + verb + finding/outcome
- ❌ Bad: "Results", "Background", "Benefits"
- ✅ Good: "System handles 10K req/sec", "Current solutions fail at scale", "Microservices improve deployment speed"

**2. One Idea Per Slide**
- Each slide communicates exactly ONE central point
- If outline section has multiple concepts → generate multiple slides
- Slide content must support only the title's assertion

**3. Cognitive Load Limit (Max 6 Elements Total)**
- COUNT: bullets + images + diagrams + charts + text blocks
- If >6 elements → use progressive disclosure (v-click) or split into slides
- Research basis: Working memory 7±2 items

**4. Minimal Text (<50 Words Excluding Title)**
- Use phrases, not full sentences
- Bullets: 3-6 words each maximum
- If outline has paragraphs → convert to terse bullet points
- Detailed text → move to presenter notes

**5. Visual Element Requirement**
- Almost every slide needs a visual (diagram, chart, image, or code)
- Add visual placeholder TODOs during generation
- Exceptions: quotes, definitions, bold statements

**Choose appropriate layout:**
- Title slide → `layout: cover`
- Section headers → `layout: center`
- Content with visuals → `layout: image-right` or `two-cols`
- Quotes → `layout: quote`
- Standard content → `layout: default`

**Example slide generation (Evidence-Based):**

From outline:
```markdown
### Slide 5: Microservices Benefits
- Scalability: Each service scales independently
- Deployment: Deploy services without full system restart
- Technology: Use best tool for each service
- Teams: Autonomous ownership
```

Generate with MEANINGFUL TITLE:
```markdown
---
layout: image-right
image: '' # Placeholder for visual
---

# Microservices enable independent scaling and deployment

- **Scale** each service separately
- **Deploy** without downtime
- **Choose** optimal technology
- **Own** service autonomously

<!-- TODO: Visual opportunity - HIGH PRIORITY
Type: mermaid diagram
Suggestion: Flowchart showing monolith vs microservices deployment
Why: Visualizes main benefit (one idea: deployment independence)
Element count: 4 bullets + 1 diagram = 5 total ✓
-->

<!--
PRESENTER NOTES:
Opening: "Imagine deploying a single feature without restarting your entire application."

Key points:
- Scalability example: Netflix scales recommendation service independently
- Deployment benefit: Update checkout without touching inventory
- Technology choice: Use Go for API, Python for ML, Node for real-time
- Team autonomy: Each team owns their service end-to-end

Transition: "This deployment independence is why companies like Uber chose microservices."

Timing: 90 seconds
Word count: ~35 words (excluding title) ✓
-->
```

**Quality checks applied:**
- ✓ Meaningful title (assertion: "enable independent scaling and deployment")
- ✓ One idea (deployment independence)
- ✓ 5 elements (4 bullets + 1 planned diagram ≤6)
- ✓ ~35 words (< 50)
- ✓ Visual planned (diagram)
- ✓ Phrases not sentences
- ✓ Detailed text in presenter notes

**Add visual placeholders:**
```markdown
<!-- TODO: Visual opportunity
Type: [mermaid diagram / stock photo / AI image]
Suggestion: [What would enhance this slide]
Priority: [High/Medium/Low]
-->
```

### 5. Generate Complete slides.md (With Backup Slides)

Structure:
```markdown
---
[frontmatter with accessibility CSS]
---

# [Title Slide - Assertion format]

## Subtitle

Presenter · Date

---

# [Hook Slide - Compelling opening]

[Question, statistic, or story that grabs attention]

---

# [Problem Slide - Why this matters as assertion]

[Evidence of problem]

---

[Continue for all main content slides from outline...]
[Each with meaningful assertion title, <50 words, ≤6 elements, visual]

---

# [Conclusion - Key insight as assertion]

**Main takeaways:**
- [Point 1]
- [Point 2]
- [Point 3]

**Next steps:** [Call to action]

---

# Questions?

Contact: [email/twitter]

---
layout: center
---

# Backup Slides

Detailed data for Q&A

---

# [Detailed Topic 1 - for Q&A]

[Extended methodology, data tables, etc.]

---

# [Detailed Topic 2 - for Q&A]

[Alternative approaches, limitations, etc.]

```

**Backup slides inclusion:**
- Add 3-5 backup slides with detailed data
- Methodology details
- Extended statistics
- Alternative approaches considered
- Limitations discussion
- Research: Keeps main deck lean while showing thoroughness

Write to `[topic-slug]/slides.md`.

### 6. Create package.json (Optional)

For project-specific Slidev installation:
```json
{
  "name": "[topic-slug]",
  "private": true,
  "scripts": {
    "dev": "slidev",
    "build": "slidev build",
    "export": "slidev export"
  },
  "dependencies": {
    "@slidev/cli": "^0.48.0",
    "@slidev/theme-default": "latest"
  }
}
```

Write to `[topic-slug]/package.json`.

### 7. Summary

Present summary to user:
```markdown
## ✅ Evidence-Based Slides Generated!

**Location:** `[topic-slug]/slides.md`
**Slide Count:** [X] main slides + [Y] backup slides
**Estimated Duration:** [Z] minutes (at 90s/slide)

**Evidence-Based Features Applied:**
- ✓ Meaningful assertion titles (not generic labels)
- ✓ One idea per slide enforced
- ✓ ≤6 elements per slide (cognitive load limit)
- ✓ <50 words body text per slide
- ✓ Visual placeholders for [N] slides
- ✓ Accessibility defaults (18pt+ fonts, 4.5:1 contrast, colorblind-safe colors)
- ✓ Comprehensive presenter notes
- ✓ Backup slides for Q&A

**Quality Validation:**
Run slide-optimizer to verify all slides meet research standards:
```bash
# (Agent will check 12-point quality criteria)
```

**Next Steps:**

1. **Preview:**
   ```bash
   cd [topic-slug]
   slidev slides.md
   ```
   Press 'p' for presenter mode with notes

2. **Enhance visuals:**
   `/slidedeck:enhance-visuals` - Add diagrams, photos, AI image prompts

3. **Edit specific slide:**
   `/slidedeck:edit-slide [number]` - Focus on individual slide

4. **Export:**
   `/slidedeck:export pdf` - Generate final PDF
```

Ask: "Would you like to preview the slides now?"

If yes:
```bash
cd [topic-slug]
${CLAUDE_PLUGIN_ROOT}/scripts/preview-slidev.sh slides.md
```

## Evidence-Based Slide Generation Checklist

**Critical Requirements (Every Slide):**
- ✓ **Meaningful title** (assertion: "X demonstrates Y", not label: "Results")
- ✓ **One idea** per slide (single central finding)
- ✓ **≤6 elements** total (bullets + visuals + charts combined)
- ✓ **<50 words** body text (excluding title)
- ✓ **Visual element** planned or included (except quotes/definitions)
- ✓ **Phrases not sentences** in bullets
- ✓ **Detailed text in presenter notes** (not on slide)

**Accessibility Defaults (Built-in):**
- ✓ Font sizes: h1=48pt, h2=32pt, h3=24pt, body=20pt (meets ≥18pt requirement)
- ✓ Sans-serif fonts for body text
- ✓ Colorblind-safe palette: Blue + Orange (verified contrast ratios)
- ✓ High contrast: 4.5:1+ for all text

**Structure:**
- Opening: Hook slide (compelling question/fact, not bio)
- Main: Content slides (each with meaningful assertion title)
- Closing: Conclusion with key takeaways (not generic "Thank you")
- Backup: 3-5 detailed slides for Q&A

**Visual Placeholders:**
- Mark every slide needing visual with TODO comment
- Specify type (mermaid diagram preferred, then stock photo, then AI image)
- Note priority (HIGH for key concept slides)
- Include element count in comment

**Presenter Notes (MIT CommLab guidance):**
- Add comprehensive notes during generation
- Include opening line, key points, transition phrases
- Note timing (default 90s per slide)
- Include word count validation

**Layouts (Evidence-Based Distribution):**
Use variety to maintain visual interest:
- 30% standard/default (with visual placeholders)
- 20% center (section breaks, transition slides)
- 20% image-right/image-left (visual + content balance)
- 15% two-cols (comparisons, before/after)
- 10% quote/fact (bold statements, key statistics)
- 5% cover/special (title, conclusions)

## Error Handling

**Outline too long:**
- Warn if >50 slides
- Suggest splitting or condensing
- Proceed if user confirms

**Missing context:**
- Generate slides with placeholders
- Note what information is needed
- User can fill in later

**Style not specified:**
- Default to professional/default theme
- Can change later in frontmatter

Inform user slides are ready and guide to next steps.
