---
name: slidev:notes
description: Generate or enhance presenter notes for all slides
allowed-tools: ["Read", "Edit"]
---

# Presenter Notes Generation

Generate comprehensive presenter notes for all slides or enhance existing notes, applying the evidence-based principle that detailed explanations belong in notes, not on slides.

**Evidence Base**: MIT Communication Lab research shows audiences cannot read and listen simultaneously. Detailed text, full explanations, and supporting data should be in presenter notes, not on slides. See `references/presentation-best-practices.md` for guidelines.

## Execution

### 1. Read Current Slides

Find and read slides.md:
- Parse all slides
- Check which slides already have notes
- Identify slides missing notes

### 2. Generate/Enhance Notes

For each slide, create presenter notes with:

**Structure:**
```markdown
<!--
PRESENTER NOTES:
[Slide title/number for reference]

KEY POINTS:
- [Main point to emphasize]
- [Supporting detail]
- [Example or analogy to share]

TIMING: [X] seconds (default: 90s per slide, adjust for complexity)

DELIVERY TIPS:
- [How to present this slide]
- [Voice, pace, emphasis guidance]

TRANSITIONS:
- FROM previous: [How you arrived here]
- TO next: [How to transition out]

LIKELY QUESTIONS:
- Q: [Question audience might ask]
  A: [How to answer]

ADDITIONAL CONTEXT:
- [Background information]
- [Technical details not on slide]
- [References or sources]
-->
```

**Content Guidelines:**

**Key Points (MIT CommLab Principle - Detail Goes Here):**
- **Expand terse slide bullets** into full explanations (slide has phrases, notes have sentences)
- **Add details NOT shown on slide** (slide is minimal, notes are comprehensive)
- **Include specific numbers, dates, names** (slide has trends, notes have data)
- **Provide examples and stories** (slide has assertion, notes have supporting narrative)
- **Full context and background** (slide is concise, notes have depth)

**Research basis**: Audiences cannot read and listen simultaneously. Slide shows key point (visual channel), notes contain what you say (auditory channel).

**Timing (Evidence-Based - Default 90s/slide):**
- **Default**: 90 seconds (1.5 minutes) per slide (configurable)
- Title slides: 30 seconds
- Simple content slides: 60-90 seconds
- Complex/data slides: 90-120 seconds
- Deep technical slides: 120-180 seconds
- Transition slides: 15-30 seconds

**Calculation verification:**
Total presentation time = Sum of all slide timings + transitions + Q&A buffer

**Delivery Tips:**
- Pacing suggestions ("Pause after this point")
- Emphasis cues ("Stress the word 'critical'")
- Interaction prompts ("Ask audience if they've experienced this")

**Transitions:**
- How this slide connects to previous
- How to move to next slide smoothly
- Bridging statements to use

**Likely Questions:**
- Anticipate audience questions
- Prepare concise answers
- Note if answer is covered later

### 3. Handle Different Slide Types

**Title Slide:**
```markdown
<!--
NOTES:
- Wait for audience to settle
- Make eye contact
- Speak clearly and confidently
- Set positive tone
TIMING: 30 seconds
-->
```

**Data Slide:**
```markdown
<!--
NOTES:
KEY POINTS:
- Main insight from data: [Specific finding]
- Don't read numbers aloud - highlight trend
- Point to specific parts of chart

TIMING: 90 seconds

DELIVERY:
- Give audience 10 seconds to read chart
- Then explain the key takeaway
- Use laser pointer or cursor to highlight

CONTEXT:
- Data source: [Source]
- Collection period: [Dates]
- Sample size: [N]
-->
```

**Technical/Code Slide:**
```markdown
<!--
NOTES:
KEY POINTS:
- Focus on line [X]: [Why it matters]
- Don't explain every line
- Highlight the key pattern or technique

TIMING: 2 minutes

DELIVERY:
- Walk through code top to bottom
- Pause at important lines
- Use Monaco editor if live demo

LIKELY QUESTIONS:
- Q: Why not use [alternative]?
  A: [Reason]
-->
```

**Transition Slide:**
```markdown
<!--
NOTES:
- Brief pause (5 seconds)
- Signal section change: "Now let's look at..."
- Give audience mental reset

TIMING: 15 seconds
-->
```

### 4. Enhance Existing Notes

If notes already exist:
- Read current notes
- Identify gaps (missing timing, transitions, etc.)
- Add missing elements
- Expand thin notes
- Keep good existing content

### 5. Apply Notes to Slides

Use Edit tool to add/update notes in slides.md:
- Place notes at end of each slide
- Before next `---` separator
- Maintain proper markdown comment format

### 6. Summary

Present summary:
```markdown
## ✅ Presenter Notes Updated

**Slides with notes:** [X] of [Y]

**Notes Include:**
- Key points to emphasize
- Timing estimates (Total: [Z] minutes)
- Delivery tips
- Transition guidance
- Likely questions and answers
- Additional context

**Review:**
Preview the presentation and check if notes are helpful:
```bash
cd [presentation-dir]
slidev slides.md
```
Press 'p' to enter presenter mode and see notes.

**Estimated Total Duration:** [X] minutes (at 90s/slide default)
- Slide timings: [Y] minutes
- Transitions: [Z] minutes (15-30s between sections)
- Q&A buffer: [W] minutes (typically 15-20% of total)
- **Total**: [X] minutes

**Evidence-Based Timing Validation:**
- Calculated slides: (duration_minutes × 60) / 90 = [N] expected slides
- Actual slides: [M] slides
- Variance: [±X]% (acceptable: ±20%)
- Status: ✓ On track / ⚠️ Adjust timing / ❌ Revise slide count
```

## Best Practices

**Notes Quality (Evidence-Based Principle):**
- **Be specific, not generic** (detailed examples, not "e.g., X")
- **Include numbers and facts** (actual data that's NOT on slide)
- **Provide actual examples** (full stories, not bullet points)
- **Write full sentences** (notes are your speaking script, slides are visual)
- **Expand slide's terse bullets** (slide: "Scale independently", notes: "Each microservice can be scaled independently based on its specific load patterns, allowing you to allocate resources efficiently")
- **Add context missing from slide** (background, rationale, alternative approaches considered)

**MIT CommLab principle**: Slides show the WHAT (assertion), notes explain the WHY and HOW (detailed narrative).

**Timing Accuracy (Evidence-Based - 90s Default):**
- **Default per slide**: 90 seconds (1.5 minutes) - configurable
- **Account for transitions**: 15-30 seconds between sections
- **Add buffer time**: 10% overhead for audience engagement
- **Include Q&A time**: Typically 15-20% of total duration
- **Validation formula**: Expected slides = (duration_minutes × 60) / 90
- **Total should match target**: ±20% variance acceptable

**Example (20-minute presentation):**
- Expected slides: (20 × 60) / 90 = 13.3 → 10-16 slides acceptable
- Actual: 13 main slides + 3-5 backup slides ✓

**Delivery Guidance:**
- Note where to pause
- Indicate emphasis points
- Suggest interactions
- Mark complex explanations

**Context:**
- Add background not on slide
- Include sources and references
- Note any caveats or limitations
- Provide deeper technical details

## Evidence-Based Notes Quality Standards

**Dual-Channel Processing (CRITICAL):**
- ✓ **Slides are visual channel** (minimal text, assertions, diagrams)
- ✓ **Notes are auditory channel** (what you say, full explanations)
- ✓ **No duplication**: Don't read slide text verbatim from notes
- ✓ **Expand, don't repeat**: Notes elaborate on slide's terse points

**Content Distribution:**
- ✓ **Slide (<50 words)**: "Microservices enable independent scaling"
- ✓ **Notes (detailed)**: "Each microservice can be scaled independently based on its specific load. For example, Netflix scales their recommendation engine separately from their video streaming service, allowing them to allocate resources where needed most during peak hours."

**Timing Standards:**
- ✓ Default 90s per slide (configurable: 60s-180s based on pace)
- ✓ Total timing validation using formula: (duration × 60) / 90
- ✓ ±20% variance acceptable
- ✓ Include transition time (15-30s between sections)

## Tips

- **Read notes aloud** to check flow and timing (should feel conversational)
- **Time yourself** presenting with notes (verify 90s average)
- **Add personal anecdotes** (mark as optional if tight on time)
- **Define technical jargon** (first mention gets explanation in notes)
- **Include pronunciation guides** for difficult terms
- **Mark interactive moments** (slides where demos or videos play)
- **Test dual-channel principle**: Can someone understand from audio alone?
- **Expand slide phrases**: Turn 3-word bullets into full explanatory sentences

Inform user notes are complete and ready for practice.
