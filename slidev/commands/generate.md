---
name: generate
description: Generate Slidev slides from outline
allowed-tools: ["Read", "Write", "Bash", "Grep", "Skill"]
skills: ["slidev:presentation-design"]
---

# Slide Generation

Generate clean, accessible Slidev slides from validated outline with enforced design limits.

**Design constraints**: Apply hard limits from `${CLAUDE_PLUGIN_ROOT}/references/design-constraints.md`. Default timing: 90s per slide (configurable 60s-180s).

## Execution

### 1. Prerequisites

Check for required files:
- `outline.md` - Must exist
- `presentation-config.md` - For style/theme preferences (optional)
- `brainstorm.md` - For additional context (optional)

If outline.md missing:
- Inform user outline is needed first
- Offer to run `/slidev:outline`
- Exit

### 2. Determine Project Directory

Extract topic from outline title and create directory name:
```
Title: "Introduction to Kubernetes"
→ Directory: "introduction-to-kubernetes"
```

Create project structure:
```bash
mkdir -p [topic-slug]/{slides,public/images,exports}
```

**Note:** The `slides/` subdirectory will contain individual markdown files for each slide.

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
/* Accessibility defaults: 18pt+ fonts, 4.5:1+ contrast */
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

### 4. Generate Slides from Outline (Hard Limits - Never Violate)

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

**3. Cognitive Load Limit (Max 6 Elements Total) - HARD LIMIT**
- COUNT: bullets + images + diagrams + charts + text blocks + code snippets
- **CRITICAL: If >6 elements → SPLIT into multiple slides**
- **NEVER** exceed 6 elements - split content instead
- Research basis: Working memory 7±2 items
- Progressive disclosure (v-click) does NOT exempt from 6-element limit

**4. Minimal Text (<50 Words Excluding Title) - HARD LIMIT**
- Use phrases, not full sentences
- Bullets: 3-6 words each maximum
- **CRITICAL: If content exceeds 50 words → SPLIT into multiple slides**
- **NEVER** try to compress information - create additional slides instead
- If outline has paragraphs → convert to terse bullet points OR split
- Detailed text → move to presenter notes

**5. Code Examples - Special Handling**
- **Code blocks count as MULTIPLE elements** (1 block ≈ 3-4 elements depending on length)
- **NEVER** show more than 1-2 code examples per slide
- **Keep code snippets short:** Max 8-10 lines
- **Highlight key lines** only (use `{2,5}` line highlighting syntax)
- **Full examples** → Move to backup slides or presenter notes with GitHub link
- **Multiple examples** → SPLIT across multiple slides (1 example per slide)

**6. Visual Element Requirement**
- Almost every slide needs a visual (diagram, chart, image, or code)
- Add visual placeholder TODOs during generation
- Exceptions: quotes, definitions, bold statements

**Choose appropriate layout:**
- Title slide → `layout: cover`
- Section headers → `layout: center`
- Content with visuals → `layout: image-right` or `two-cols`
- Quotes → `layout: quote`
- Standard content → `layout: default`

**CRITICAL: How to Handle Dense Content**

When outline has too much content for one slide, **SPLIT into multiple slides**:

❌ **WRONG** (Violates limits):
```markdown
# GPU Cluster Operational Requirements

**What's Needed:**
- Drivers: Kernel modules, CUDA libraries (must match GPU and kernel)
- Container Runtime: GPU device injection into containers
- Health Monitoring: ECC errors, temperature throttling, GPU resets
- Metrics: Utilization, memory usage, power consumption
- Configuration Sync: Drivers + runtime + plugin versions aligned

**The Problem:**
- Manual setup: SSH into each node, install drivers, configure runtime
- Error-prone: Driver/kernel mismatches, missing libraries
- Not declarative: Configuration drift across nodes
- Doesn't scale: Adding new GPU nodes requires manual work
```
**Issues:** >100 words, >10 elements, 2 ideas (what's needed + problems)

✅ **CORRECT** (Split into 3 slides):

Slide 1:
```markdown
# GPU clusters require five operational components

- **Drivers** - Kernel + CUDA libraries
- **Runtime** - Container GPU injection
- **Monitoring** - Health + temperature
- **Metrics** - Usage tracking
- **Config sync** - Version alignment

<!-- Visual: Simple architecture diagram showing 5 components -->
```
**Valid:** 31 words, 5 bullets + 1 diagram = 6 elements, 1 idea ✓

Slide 2:
```markdown
# Manual GPU setup creates configuration drift

- **SSH** each node individually
- **Mismatches** between driver/kernel
- **Missing** libraries across fleet
- **Manual** work blocks scaling

<!-- Visual: Before diagram showing manual chaos -->
```
**Valid:** 27 words, 4 bullets + 1 diagram = 5 elements, 1 idea ✓

Slide 3:
```markdown
# Traditional approaches don't scale

**Challenge:** Adding 100 GPU nodes

- Manual: **Days of SSH work**
- Drift: **Inconsistent configs**
- Errors: **Production failures**

**Need:** Declarative automation

<!-- Visual: Timeline showing manual vs automated -->
```
**Valid:** 32 words, 5 elements, 1 idea (scaling problem) ✓

**Code Example Slides:**

❌ **WRONG** (Too many code blocks):
```markdown
# Label-Based Scheduling

**nodeSelector:**
[code block 1 - 8 lines of YAML]

**Node Affinity:**
[code block 2 - 12 lines of YAML]

**Taints/Tolerations:**
[code block 3 - 10 lines of YAML]
```
**Issues:** 3 code blocks ≈ 9-10 elements, >50 words, 3 different concepts

✅ **CORRECT** (One concept, one code snippet):
```markdown
# nodeSelector provides simple label matching

```yaml {3-4}
spec:
  containers:
  - name: gpu-app
    image: tensorflow:latest
  nodeSelector:
    gpu: "tesla-t4"
```

**Direct match:** All-or-nothing

<!-- Backup: Full examples at github.com/user/repo -->
```
**Valid:** 22 words, 1 code block + 1 text line = ~4-5 elements, 1 idea ✓

Then create separate slides for Node Affinity and Taints.

**Example slide generation with enforced limits:**

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

### 5. Generate Individual Slide Files and Master slides.md

**Structure Overview:**
- Each slide is a separate markdown file in `[topic-slug]/slides/`
- Individual files use **meaningful, content-based names** (stable identity when reordering)
- Master `slides.md` includes all individual files using `src` frontmatter
- Comments in master file indicate slide numbers for easy reference

**Step 5.1: Generate Individual Slide Files**

For each slide in the outline, create a separate markdown file in `[topic-slug]/slides/` with a **descriptive filename** based on the slide content.

**File Naming Convention:**
- **IMPORTANT:** Slide 1 (title) comes from frontmatter in `slides.md`, NOT a file
- First slide file starts at `02-` (second slide)
- Use numeric prefix + descriptive name (e.g., `02-hook.md`, `05-microservices-benefits.md`)
- Format: `NN-descriptive-name.md` where NN is zero-padded slide number
- Use lowercase with hyphens (kebab-case) for descriptive part
- Examples:
  - `02-hook.md` or `02-opening.md` - Opening hook (first slide file)
  - `03-problem-statement.md` - Problem introduction
  - `04-kubernetes-architecture.md` - K8s architecture slide
  - `05-microservices-benefits.md` - Benefits of microservices
  - `06-gpu-cluster-requirements.md` - GPU cluster requirements
  - `18-conclusion.md` - Conclusion slide
  - `19-questions.md` - Q&A slide
  - `20-backup-methodology.md` - Backup slide about methodology
  - `21-backup-alternatives.md` - Backup slide about alternatives

**Why numeric prefixes?**
- Files appear in presentation order in directory listings
- Easy to see sequence at a glance
- Still have meaningful, descriptive names
- Better version control (meaningful diffs)

**When reordering slides:**
- Update numeric prefixes to match new order (e.g., rename `05-*.md` to `04-*.md`)
- Update `src:` paths in master slides.md
- Update slide number comments
- Git will track the rename with the descriptive name

**Important:** Title slide comes from `slides.md` frontmatter, NOT a separate file.

**Example: `[topic-slug]/slides/02-hook.md` (First Content Slide)**
```markdown
---
layout: default
---

# [Hook - Assertion format]

Content for opening hook

Presenter · Date
```

**Example: `[topic-slug]/slides/03-problem.md` (Problem Statement Slide)**
```markdown
# [Hook Slide - Compelling opening]

[Question, statistic, or story that grabs attention]

<!--
PRESENTER NOTES:
[Opening line, key points, transition]
Timing: 90 seconds
-->
```

**Example: `[topic-slug]/slides/05-microservices-benefits.md` (Content Slide)**
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
Word count: ~35 words ✓
-->
```

**Continue for all slides:**
- Main content slides (each in separate file: `03-*.md`, `04-*.md`, etc.)
- Conclusion slide (e.g., `18-conclusion.md`)
- Questions slide (e.g., `19-questions.md`)
- Backup slides (e.g., `20-backup-methodology.md`, `21-backup-alternatives.md`, 3-5 total)

**Step 5.2: Generate Master slides.md**

Create the master file at `[topic-slug]/slides.md` that includes all individual slides with **slide number comments** for easy reference:

```markdown
---
# Global frontmatter with accessibility CSS
theme: default
background: '#ffffff'
class: text-center
highlighter: shiki
lineNumbers: false
transition: slide-left
title: [Title]
---

<style>
/* Accessibility defaults: 18pt+ fonts, 4.5:1+ contrast */
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

<!-- Slide 1: Title (from frontmatter above, no file) -->

---
src: ./slides/02-hook.md
---
<!-- Slide 2: Hook - Opening question -->

---
src: ./slides/03-problem-statement.md
---
<!-- Slide 3: Problem Statement -->

---
src: ./slides/04-kubernetes-architecture.md
---
<!-- Slide 4: Kubernetes Architecture Overview -->

---
src: ./slides/05-microservices-benefits.md
---
<!-- Slide 5: Microservices Benefits -->

<!-- Continue for all main content slides... -->

---
src: ./slides/18-conclusion.md
---
<!-- Slide 18: Conclusion - Key Takeaways -->

---
src: ./slides/19-questions.md
---
<!-- Slide 19: Questions -->

---
src: ./slides/20-backup-methodology.md
---
<!-- Slide 20: Backup - Detailed Methodology -->

---
src: ./slides/21-backup-alternatives.md
---
<!-- Slide 21: Backup - Alternative Approaches -->

<!-- Continue for all backup slides... -->
```

**Master file requirements:**
- Global frontmatter with theme and accessibility CSS at the top
- Each slide inclusion uses frontmatter block with `src:` directive
- Comment AFTER closing `---` with format: `<!-- Slide X: Brief description -->`
- Sequential slide numbering in comments (updates when reordering)
- Descriptive file names in `src:` paths (stable, never change)
- Clear section markers (main content vs backup slides)

**Correct syntax (per Slidev docs):**
```markdown
---
src: ./slides/filename.md
---
<!-- Slide X: Description -->
```

**Why comments go after `---`:**
- Frontmatter block (between `---` separators) contains only YAML
- Comments after closing `---` are ignored by Slidev
- This matches Slidev's official importing slides syntax

**Benefits of this structure:**
- **Reordering slides:** Just move the `src` includes, update slide numbers in comments
- **Finding slides:** Look for descriptive filename, not a number
- **Version control:** Meaningful file names show what changed
- **Collaboration:** Team members know what each file contains

**Backup slides inclusion:**
- Add 3-5 backup slides with detailed data
- Methodology details
- Extended statistics
- Alternative approaches considered
- Limitations discussion
- Research: Keeps main deck lean while showing thoroughness

Write individual slide files to `[topic-slug]/slides/NN-descriptive-name.md` and master file to `[topic-slug]/slides.md`.

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
    "@slidev/cli": "latest",
    "@slidev/theme-default": "latest"
  }
}
```

Write to `[topic-slug]/package.json`.

### 7. Summary

Present summary to user:
```markdown
## ✅ Clean, Accessible Slides Generated!

**Structure:**
- Master file: `[topic-slug]/slides.md`
- Individual slides: `[topic-slug]/slides/NN-descriptive-name.md`
- Slide Count: [X] main slides + [Y] backup slides
- Estimated Duration: [Z] minutes (at 90s/slide)

**File Organization:**
```
[topic-slug]/
├── slides.md                          # Master file (slide 1 = title from frontmatter)
├── slides/
│   ├── 02-hook.md                     # Slide 2: Opening hook (first file)
│   ├── 03-problem-statement.md        # Slide 3: Problem
│   ├── 04-[descriptive-name].md       # Content slides...
│   ├── 18-conclusion.md               # Conclusion
│   ├── 19-questions.md                # Q&A
│   └── 20-backup-*.md                 # Backup slides
├── public/images/
└── exports/
```

**Important:** Slide 1 (title) is defined in `slides.md` frontmatter, not as a separate file.

**Design Limits Enforced:**
- ✓ Meaningful assertion titles (not generic labels)
- ✓ One idea per slide enforced
- ✓ ≤6 elements per slide (cognitive load limit)
- ✓ <50 words body text per slide
- ✓ Visual placeholders for [N] slides
- ✓ Accessibility defaults (18pt+ fonts, 4.5:1 contrast, colorblind-safe colors)
- ✓ Comprehensive presenter notes
- ✓ Backup slides for Q&A
- ✓ Modular structure with meaningful filenames

**Benefits of Modular Structure:**
- Edit individual slides independently
- Reorder slides by moving `src` includes in master file
- Easy to find slides by descriptive filename
- Better version control and collaboration

**Quality Validation:**
Use the "Slide Quality Assessment" skill to verify all slides meet evidence-based quality standards:
- Apply the 12-point quality checklist to each slide
- Flag any critical violations (>6 elements, >50 words, missing visuals, etc.)
- Provide specific recommendations for improvement

**Next Steps:**

1. **Preview:**
   ```bash
   cd [topic-slug]
   slidev slides.md
   ```
   Press 'p' for presenter mode with notes

2. **Edit specific slide:**
   - Edit the individual `.md` file in `slides/` directory
   - Changes automatically reflected in presentation
   - Example: `vim slides/05-microservices-benefits.md`

3. **Enhance visuals:**
   `/slidev:visuals` - Add diagrams, photos, AI image prompts

4. **Export:**
   `/slidev:export pdf` - Generate final PDF
```

Ask: "Would you like to preview the slides now?"

If yes:
```bash
cd [topic-slug]
${CLAUDE_PLUGIN_ROOT}/scripts/preview-slidev.sh slides.md
```

## Slide Generation Checklist

Apply all hard limits and accessibility defaults from `${CLAUDE_PLUGIN_ROOT}/references/design-constraints.md`.

**Per-slide checks:**
- Meaningful assertion title (not a label)
- One idea per slide
- <=6 elements total (split if exceeded)
- <50 words body text (split if exceeded)
- Visual element planned or included
- Phrases not sentences in bullets
- Detailed text in presenter notes
- Code: 1 snippet per slide, highlight key lines

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

**Layouts (Recommended Distribution):**
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
