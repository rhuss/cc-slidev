---
name: slidev:frame
description: Define presentation scope, duration, and slide count targets
allowed-tools: ["Read", "Write", "AskUserQuestion"]
---

# Frame Presentation Scope

Define presentation parameters: duration, slide count targets, audience, and style preferences.

**Use when**:
- After brainstorming, before creating outline
- Want to establish scope constraints
- Need to calculate target slide count from duration
- Setting presentation parameters

**Inputs**: Brainstorm findings (optional), user preferences
**Outputs**: `presentation-config.md` with framing parameters

## Execution

### 1. Check for Brainstorm Context

**If `brainstorm.md` exists:**
- Read it to extract:
  - Presentation title
  - Audience (if specified)
  - Duration (if specified in brainstorm)
  - Context (conference, meetup, etc.)

**If no brainstorm.md:**
- Start fresh
- Will ask for all parameters

### 2. Gather Presentation Parameters

**Use AskUserQuestion for efficient gathering:**

#### Question 1: Duration

Ask user:
```
question: "How long should the presentation be?"
header: "Duration"
options:
  - label: "5-10 minutes (Lightning talk)"
    description: "Quick talks: ~10-15 slides at 30-45 sec/slide"
  - label: "15-20 minutes (Standard)"
    description: "Standard talks: ~15-20 slides at 1-2 min/slide"
  - label: "30-45 minutes (Conference talk)"
    description: "Conference talks: ~20-25 slides at 2 min/slide"
  - label: "60+ minutes (Deep dive)"
    description: "Deep dives: ~25-30 slides at 2-3 min/slide"
  - label: "Custom duration"
    description: "Specify exact duration in minutes"
```

**If "Custom duration" selected:**
- Ask: "What is the exact duration in minutes?"
- Validate: Must be positive integer

**Extract duration value:**
```
"5-10 minutes" → 7.5 minutes (midpoint)
"15-20 minutes" → 17.5 minutes
"30-45 minutes" → 37.5 minutes
"60+ minutes" → 60 minutes
"Custom: 25" → 25 minutes
```

#### Question 2: Time Per Slide (Optional)

Ask user:
```
question: "How much time per slide?"
header: "Pacing"
options:
  - label: "Use recommended (based on duration)"
    description: "Auto-calculate from research-based defaults"
  - label: "30-45 seconds (Lightning pace)"
    description: "Very fast, minimal explanation per slide"
  - label: "60-90 seconds (Standard pace)"
    description: "Comfortable pace for technical content"
  - label: "2-3 minutes (Detailed pace)"
    description: "Deep explanations, complex content"
  - label: "Custom timing"
    description: "Specify exact seconds per slide"
```

**If "Use recommended":**
Apply research-based defaults:
```
Duration 5-10 min: 40 sec/slide
Duration 15-20 min: 75 sec/slide (1.25 min)
Duration 30-45 min: 120 sec/slide (2 min)
Duration 60+ min: 150 sec/slide (2.5 min)
```

**Research basis**: 90 seconds (1.5 minutes) is optimal for technical content. Lightning talks need faster pacing, deep dives allow more time.

#### Question 3: Audience & Level

Ask user:
```
question: "Who is the target audience?"
header: "Audience"
options:
  - label: "Developers"
    description: "Technical audience, coding examples expected"
  - label: "Architects"
    description: "System design focus, architecture diagrams"
  - label: "DevOps/SRE"
    description: "Operations focus, infrastructure, monitoring"
  - label: "Managers/Leadership"
    description: "Business value, high-level concepts, ROI"
  - label: "Students/Beginners"
    description: "Learning fundamentals, needs more explanation"
  - label: "Mixed technical"
    description: "Varied backgrounds, balance detail and clarity"
```

**Then ask skill level:**
```
question: "What skill level?"
header: "Expertise"
options:
  - label: "Beginner (new to topic)"
    description: "Assume no prior knowledge, explain fundamentals"
  - label: "Intermediate (some experience)"
    description: "Build on existing knowledge, focus on patterns"
  - label: "Expert (deep knowledge)"
    description: "Advanced concepts, skip basics, dive deep"
  - label: "Mixed (varied backgrounds)"
    description: "Layer content, basics + advanced sections"
```

#### Question 4: Context

Ask user:
```
question: "Where will this be presented?"
header: "Context"
options:
  - label: "Conference talk"
    description: "Formal presentation, large audience, Q&A"
  - label: "Meetup"
    description: "Informal, community setting, interactive"
  - label: "Training session"
    description: "Educational, hands-on, exercises"
  - label: "Internal presentation"
    description: "Company/team meeting, specific context"
  - label: "Webinar"
    description: "Remote audience, screen sharing, chat Q&A"
  - label: "University lecture"
    description: "Academic setting, students, structured"
```

#### Question 5: Style & Tone

Ask user:
```
question: "What presentation style?"
header: "Style"
options:
  - label: "Professional/Corporate"
    description: "Clean, business-appropriate, default theme"
  - label: "Technical/Developer"
    description: "Code-focused, syntax highlighting, Seriph theme"
  - label: "Academic/Formal"
    description: "Research-oriented, citations, formal layout"
  - label: "Creative/Casual"
    description: "Engaging, colorful, relaxed tone"
```

#### Question 6: Visual Preferences

Ask user:
```
question: "Should we include visual elements?"
header: "Visuals"
options:
  - label: "Yes, diagrams and images"
    description: "Rich visuals: Mermaid diagrams, stock photos, AI images"
  - label: "Diagrams only (no photos)"
    description: "Technical diagrams, flowcharts, architecture visuals"
  - label: "Minimal visuals"
    description: "Text-focused, occasional diagram for key concepts"
  - label: "Text only"
    description: "No visuals, pure content (not recommended)"
```

### 3. Calculate Target Slide Count

**Formula:**
```
target_slides = (duration_minutes × 60) / time_per_slide_seconds
```

**Example calculations:**
```
20 minutes at 90 sec/slide:
  (20 × 60) / 90 = 13.3 → ~13-14 slides

45 minutes at 120 sec/slide:
  (45 × 60) / 120 = 22.5 → ~22-23 slides

60 minutes at 150 sec/slide:
  (60 × 60) / 150 = 24 → ~24 slides
```

**Apply flexibility range:**
```
target = calculated value
acceptable_range = target ± 20%

Example: 20 slides ± 20% = 16-24 slides acceptable
```

### 4. Show Calculated Parameters

Present summary to user:

```markdown
## ✅ Presentation Framing Complete

**Duration & Pacing**:
- Total time: [X] minutes
- Time per slide: [Y] seconds ([Y/60] minutes)
- **Target slide count**: ~[Z] slides
  - Calculation: ([X] min × 60) / [Y] sec = [Z] slides
  - Acceptable range: [Z-20%] to [Z+20%] slides

**Example pacing**:
- Opening (slide 1): ~[Y] seconds
- Content (slides 2-[Z-2]): ~[Y] seconds each
- Closing (slide [Z-1]-[Z]): ~[Y] seconds
- Total: ~[X] minutes

**Audience Profile**:
- Who: [Audience type]
- Level: [Skill level]
- Context: [Presentation setting]

**Style & Visuals**:
- Style: [Style choice]
- Theme: [Recommended Slidev theme based on style]
- Visuals: [Visual preference]

**Notes**:
- These are planning targets, not rigid limits
- Some slides may take 30 seconds, others 3 minutes
- Backup slides not counted in target (add 3-5 extra)
- Quality over quantity - split dense content rather than rush
```

Ask: **"Does this framing look right? Anything to adjust?"**

**Allow adjustments:**
- Change duration
- Adjust pacing
- Modify target slide count
- Update audience/style

### 5. Save Framing Configuration

Write to `presentation-config.md`:

```markdown
---
# Presentation Framing Configuration
# Generated: [date]

# Core Parameters
duration_minutes: [X]
time_per_slide_seconds: [Y]
target_slide_count: [Z]
slide_count_range: [[Z-20%], [Z+20%]]

# Audience
audience: "[Audience type]"
skill_level: "[beginner|intermediate|expert|mixed]"
context: "[conference|meetup|training|etc.]"

# Style
style: "[professional|technical|academic|creative]"
theme: "[default|seriph|etc.]"
visuals: "[full|diagrams|minimal|none]"

# Timing Details
opening_slides: 1
opening_time_seconds: [Y]
content_slides: [Z-2]
content_time_seconds: [Y]
closing_slides: 1
closing_time_seconds: [Y]
backup_slides_recommended: 3-5

# Calculation Notes
# Formula: (duration × 60) / time_per_slide = target_slides
# ([X] × 60) / [Y] = [Z] slides
# Flexibility: ±20% = [range]
---

# Presentation Scope

**Working Title**: [Title from brainstorm or TBD]

## Duration & Pacing

- **Total time**: [X] minutes
- **Time per slide**: [Y] seconds (recommended for [context])
- **Target slides**: ~[Z] slides
- **Acceptable range**: [Z-20%] to [Z+20%] slides

## Audience

- **Who**: [Audience type]
- **Skill level**: [Level]
- **Context**: [Where presented]
- **Expectations**: [What they want to learn]

## Style Preferences

- **Style**: [Style choice]
- **Slidev theme**: [Theme]
- **Visual richness**: [Visual preference]

## Structure Guidance

**Recommended distribution** (based on 3-act structure):
- **Opening** (15%): [~N] slides - Hook, problem, context
- **Main content** (70%): [~N] slides - Core material in 2-3 sections
- **Closing** (15%): [~N] slides - Summary, next steps, Q&A
- **Backup** (not counted): 3-5 slides - Details, alternatives, methodology

## Research Basis

- **Timing default**: 90 seconds per slide (MIT CommLab, TED research)
- **Cognitive load**: Max 6 elements per slide (Miller's Law)
- **One idea per slide**: Single clear message (presentation research)
- **Accessibility**: 18pt+ fonts, 4.5:1 contrast (WCAG AA)

## Next Steps

1. Review this framing
2. Create outline with `/slidev:outline`
3. Generate slides with `/slidev:generate`
```

Save to `presentation-config.md` in current directory or brainstorm directory.

### 6. Summary

Inform user:

```markdown
✅ Presentation framed and saved to `presentation-config.md`

**Next steps**:

1. **Create outline**: `/slidev:outline`
   - Will read presentation-config.md for constraints
   - Allocates slides to sections based on target count

2. **Generate slides**: `/slidev:generate`
   - Will read outline.md and presentation-config.md
   - Applies style/theme from framing
   - Enforces slide count targets

3. **Or use full workflow**: Part of `/slidev:init` orchestration
```

## Framing Recommendations

### Quick Reference

**Lightning Talks (5-10 min)**:
- Time per slide: 30-45 seconds
- Target: 10-15 slides
- Style: Fast-paced, high-impact visuals
- One big idea, clear takeaway

**Standard Talks (15-20 min)**:
- Time per slide: 60-90 seconds
- Target: 15-20 slides
- Style: Balanced content + visuals
- 2-3 main sections

**Conference Talks (30-45 min)**:
- Time per slide: 2 minutes
- Target: 20-25 slides
- Style: Deep content, diagrams
- 3-4 main sections, backup slides

**Deep Dives (60+ min)**:
- Time per slide: 2-3 minutes
- Target: 25-30 slides
- Style: Detailed, code examples
- Multiple sections, exercises

**Workshops (90+ min)**:
- Time per slide: Variable
- Target: 30-40 slides + exercises
- Style: Interactive, hands-on
- Many breaks for activities

### Evidence-Based Defaults

These defaults are based on research:

**Timing**:
- 90 seconds = optimal for technical content (MIT CommLab)
- Faster for lightning talks (attention span)
- Slower for deep dives (complexity)

**Slide count**:
- Quality over quantity
- Better to have 15 excellent slides than 30 rushed slides
- Backup slides handle detail overflow

**Structure**:
- 3-act structure: 15% opening, 70% main, 15% closing
- Proven narrative arc (TED, presentation research)

**Accessibility**:
- ≥18pt fonts (WCAG AA)
- 4.5:1 contrast ratio minimum
- Colorblind-safe palettes

## Tips

**Do**:
- ✅ Calculate slide count from duration (not guess)
- ✅ Use research-based timing defaults
- ✅ Allow ±20% flexibility range
- ✅ Plan backup slides separately (not in count)
- ✅ Consider audience expertise level

**Don't**:
- ❌ Assume 1 minute per slide (too fast for technical)
- ❌ Lock into exact slide count (flexibility needed)
- ❌ Include backup slides in timing (they're optional)
- ❌ Ignore audience level (affects pace)
- ❌ Skip framing (scope creep risk)

**Remember**: Framing is a planning guide, not a constraint. Actual slide count emerges during outline/generation based on content needs.

---

Frame your presentation with research-based parameters!
