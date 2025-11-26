# Presentation Best Practices

Evidence-based guidelines for creating effective scientific and technical presentations.

**Sources**: The Scientist, TED Blog, PLOS Computational Biology, MIT Communication Lab, Last Week in AWS, Prezent.ai

---

## Core Principles

### 1. One Idea Per Slide

**Rule**: Each slide communicates exactly one central idea, finding, or question.

**Rationale**:
- Prevents cognitive overload
- Maintains audience focus
- Enables clear narrative progression

**Implementation**:
- Break complex concepts into multiple slides
- If explaining requires 2+ times the target duration per slide, split it
- Each slide should support one assertion

**Examples**:
- ✅ Good: Three slides for "Background" → "Problem Impact" → "Current Solutions"
- ❌ Bad: One "Background" slide covering problem, impact, and solutions

**Validation Criteria**:
- Slide title states one clear point
- Content supports only that point
- No tangential information
- Can be explained in target time per slide

---

### 2. Timing: Configurable Pace (Default 1.5 Minutes Per Slide)

**Rule**: Aim for consistent speaking time per slide.

**Default**: 90 seconds (1.5 minutes) per slide
**Configurable**: User can set to match their pace (60s for fast, 120s for detailed)

**Rationale**:
- Natural pacing for audience attention
- Prevents slide overload or under-preparation
- Frequent visual changes maintain engagement
- Technical content often needs more than 60s per slide

**Implementation**:
- 20-minute talk at 1.5 min/slide = ~13 slides
- 20-minute talk at 1.0 min/slide = ~20 slides
- During practice, if spending 2-3x target time on one slide → split it
- If rushing through slides → consolidate or cut

**Configuration**:
```yaml
# In presentation settings or outline-validator config
timing:
  seconds_per_slide: 90  # Default: 90 (1.5 minutes)
  tolerance: 0.2          # ±20% variance acceptable
```

**Calculation**:
```
Expected slides = (presentation_duration_minutes * 60) / seconds_per_slide
Acceptable range = expected ± (expected * tolerance)
```

**Examples**:
- 15-min talk at 90s/slide = 10 slides (acceptable: 8-12)
- 30-min talk at 90s/slide = 20 slides (acceptable: 16-24)
- 15-min talk at 60s/slide = 15 slides (acceptable: 12-18)
- 15-min talk at 120s/slide = 7-8 slides (acceptable: 6-10)

**Validation Criteria**:
- Total slides within acceptable range for duration and pace
- No single slide requires >2x target time to explain
- Research suggests 60-120 seconds per slide is effective range

---

### 3. Meaningful Titles (Assertions, Not Labels)

**Rule**: Slide titles should state the takeaway message, not just the topic.

**Rationale**:
- Titles act as "topic sentences" for slides
- Reading titles in sequence should tell the story
- Helps audience follow logic even if momentarily distracted
- Prevents speaker from losing train of thought

**Implementation**:
- Use full sentences that convey conclusions
- Avoid one-word labels: "Results", "Background", "Methods"
- Title = the point you want audience to remember

**Examples**:
- ❌ Weak: "Thermal Images"
- ✅ Strong: "Thermal images show electronics overheating"

- ❌ Weak: "Results"
- ✅ Strong: "Experiment X demonstrates 2x performance gain"

- ❌ Weak: "Background"
- ✅ Strong: "Current solutions fail under high-load conditions"

**Validation Criteria**:
- Title is a complete assertion (subject + verb + finding)
- Conveys what the slide proves or demonstrates
- Audience could understand main point from title alone

---

### 4. Minimal Text (Keywords, Not Sentences)

**Rule**: Use short phrases instead of full sentences. Slides are visual aids, not scripts.

**Rationale**:
- Audience cannot read and listen simultaneously (dual-channel interference)
- Reading text aloud loses engagement
- Text should guide, not duplicate speech

**Implementation**:
- Aside from title, use terse bullet points or labels
- Best case: only full sentence is the title
- Put detailed text in presenter notes, not on slide
- Use visuals to convey information instead of paragraphs

**Examples**:
- ✅ Good: "Key benefits:\n• 40% faster\n• 2x throughput\n• Zero downtime"
- ❌ Bad: "The key benefits of this approach are that it is 40% faster than the previous solution, provides twice the throughput, and enables zero-downtime deployments."

**Validation Criteria**:
- Word count per slide (excluding title): <50 words
- No paragraphs or full sentences in body
- Bullets are phrases, not complete sentences
- Any detailed explanation is in presenter notes

---

### 5. Visual Over Text

**Rule**: Almost never have slides that only contain text. Use graphics, diagrams, charts, and images.

**Rationale**:
- Pictures are processed faster than text
- Dual channels: visual (diagram) + auditory (speech) = better retention
- Images create emotional connection and memorability
- "A picture is worth a thousand words"

**Implementation**:
- Every slide should have a visual element (diagram, chart, image)
- If concept can be visualized, don't use text
- Text-only slides acceptable only for: quotes, definitions, bold statements
- Simplify figures for presentations (vs. paper versions)

**Visual Types by Content**:
- **Processes/Workflows** → Flowcharts
- **Interactions** → Sequence diagrams
- **Comparisons** → Bar/column charts
- **Trends** → Line graphs
- **Relationships** → Network/ER diagrams
- **Lifecycles** → State diagrams
- **Schedules** → Gantt charts
- **Concepts/Metaphors** → Photos or illustrations

**Validation Criteria**:
- <10% of slides are text-only (excluding title/transition slides)
- Each data-driven slide has chart/graph, not tables of numbers
- Complex figures are simplified from publication versions
- Images are high-quality and relevant

---

### 6. Cognitive Load Management

**Rule**: Limit elements on each slide to ~6 items maximum.

**Rationale**:
- Working memory capacity: 7±2 items (Miller's Law)
- David JP Phillips research: >6 objects exponentially increases cognitive load
- Simplicity aids comprehension and retention

**Elements to Count**:
1. Bullet points
2. Images/photos
3. Diagrams
4. Text blocks
5. Charts/graphs
6. Callout boxes

**Implementation**:
- If slide has >6 distinct elements → split or simplify
- For complex diagrams, use progressive builds
- Prefer one large visual over multiple small ones
- White space is valuable

**Examples**:
- ✅ Good: Title + 1 diagram + 3 bullet points = 5 elements
- ❌ Bad: Title + 2 images + 8 bullets + 1 chart = 12 elements

**Validation Criteria**:
- Total distinct visual elements ≤ 6
- Exception: Timeline/gantt may exceed if each bar is one logical unit
- If >6 needed, use builds/animations to reveal progressively

---

### 7. Accessibility Requirements

**Rule**: Design slides to be accessible to all viewers, including those with visual impairments or colorblindness.

**Font Requirements**:
- **Minimum size**: 18-24pt for body text
- **Font family**: Sans-serif for body (Calibri, Arial, Verdana, Helvetica)
- **Serif usage**: Optional for headings only (differentiation)
- **Avoid**: Italics, underlines, ALL CAPS (reduce readability)
- **Common fonts**: Stick to widely available fonts for cross-platform compatibility

**Color Requirements**:
- **High contrast**: Text vs background (minimum 4.5:1 ratio)
- **Colorblind-safe palettes**: Use tools like ColorBrewer
- **Don't rely on color alone**: Use patterns, labels, or shapes too
- **Core scheme**: 2 main colors (one light, one dark) for consistency
- **Accent colors**: 1-2 additional for highlighting

**Layout Requirements**:
- Clear section demarcation
- Consistent layout across slides
- Adequate margins and white space
- Legible over varying backgrounds (add borders/frames if needed)

**Testing**:
- Preview slides at distance (readability check)
- Test with colorblind simulator
- Verify contrast ratios with accessibility tools

**Validation Criteria**:
- All body text ≥18pt
- All headings ≥24pt
- Contrast ratio ≥4.5:1 for normal text, ≥3:1 for large text
- Color palette verified colorblind-safe
- No italics or underlines for body text

---

### 8. Design for the Distracted Viewer

**Rule**: Each slide should convey its main message even if the viewer doesn't hear your narration.

**Rationale**:
- Audience members zone out momentarily (especially long sessions, after lunch)
- Someone glancing at slide mid-explanation should grasp the point
- Slides may be reviewed later without audio

**Implementation**:
- Meaningful title + clear visual = standalone message
- Don't bury the insight in details
- Highlight conclusions, not just raw data
- Use annotations (arrows, labels) to guide attention

**Examples**:
- Graph with finding: Circle or annotate the significant data point
- Comparison: Use color/size to emphasize the winner
- Process: Bold or highlight the key step

**Validation Criteria**:
- Cold viewer test: Show slide to someone without context
- Can they identify the main point in 5 seconds?
- Title + visual tell coherent story without speech

---

### 9. Progressive Disclosure

**Rule**: Reveal complex information gradually, not all at once.

**Rationale**:
- Prevents audience from reading ahead while you explain
- Reduces cognitive overload
- Maintains narrative control
- Builds suspense and engagement

**Implementation Strategies**:

**Multi-Slide Breakdown**:
- Split complex multi-panel figure across slides
- Each slide shows one panel/aspect with explanation
- Example: 4-panel figure → 4 slides, each with one panel highlighted

**Click Animations**:
- Reveal bullet points one at a time
- Build diagram elements sequentially
- Layer data on charts progressively

**Masking Technique**:
- Duplicate full image
- Mask everything except focus area
- Creates spotlight effect without arrows
- Advance to next masked version

**Examples**:
- ✅ Good: Flowchart builds left-to-right as you explain each step
- ❌ Bad: Full 12-step flowchart shown at once while explaining step 1

**Validation Criteria**:
- Complex diagrams (>6 elements) use builds or multi-slide approach
- Bullet lists reveal one item at a time (if >3 bullets)
- Audience cannot skip ahead to slide conclusion

---

### 10. Backup Slides Strategy

**Rule**: Prepare "backup" slides for anticipated questions, but keep them separate from main deck.

**Rationale**:
- Keeps main presentation focused and lean
- Maintains timing discipline
- Provides detailed answers for Q&A
- Shows thoroughness without cluttering talk

**What to Include in Backup**:
- Detailed data tables
- Extended methodology
- Statistical details
- Additional examples
- Alternative approaches considered
- Limitations discussion
- Related work comparison

**Implementation**:
- Place after final slide (often after "Questions?" slide)
- Don't count toward timing
- Reference availability during talk: "I have detailed data if you'd like to see it during Q&A"

**Validation Criteria**:
- Backup slides clearly separated (section break or different styling)
- Main deck stays within time limit without backups
- Backup slides are complete and publication-ready (not sloppy)

---

## Presentation Structure Guidelines

### Recommended Flow

**Opening (2-3 slides)**:
- Title slide: Clear title, presenter info, context
- Hook slide: Compelling story, fact, or problem that grabs attention
- Objective slide: What question/hypothesis drives this work?

**Body (varies)**:
- Methods (1-3 slides): Visual workflow/diagram, not text description
- Results (3-8 slides): One finding per slide, data-driven visuals
- Discussion (2-3 slides): Interpretation, comparison to prior work

**Closing (2 slides)**:
- Conclusion: One clear takeaway statement, broader implications
- Acknowledgments/Questions: Credits, contact info

**Don't**:
- Start with CV/bio (waste of high-attention opening)
- End with generic "Thank you" or "The End"
- Use "Agenda" slides (show, don't tell)

---

## Visual Design Guidelines

### Theme Consistency

**Color Palette**:
- 2 core colors: one light, one dark (high contrast foundation)
- 1-2 accent colors: for emphasis, differentiation
- Consistent across all slides, diagrams, charts

**Typography**:
- 2 font families maximum: sans-serif for body, optional serif for headings
- Consistent sizing hierarchy
- Don't mix too many weights/styles

**Layout Templates**:
- Standard slide: title + content area
- Image-right/left: split content and image
- Full-image: background with overlaid text (30% opacity)
- Two-column: side-by-side comparison
- Title-only: for transitions or big statements

### Diagram Guidelines

**Mermaid Diagrams**:
- Apply theme colors via `%%{init:...}%%`
- Keep simple: max 7-9 nodes recommended
- Use descriptive node labels
- Choose direction (TD vs LR) based on slide layout
- Test rendering before finalizing

**Stock Photos**:
- High quality, professional
- Clear subject, not too busy
- Immediately relevant to point (no generic clip art)
- Proper attribution if required

**AI-Generated Images**:
- Detailed, well-structured prompts
- Specify aspect ratio (16:9 for slides)
- Match visual style of presentation theme
- Test multiple variations

---

## Presenter Notes Best Practice

**Purpose**: Detailed text belongs in notes, not on slides.

**What to Include**:
- Full explanation of slide content
- Exact wording for key points
- Transition phrases to next slide
- Timing cues
- Stories/anecdotes to share
- Anticipated questions

**Script First Few Slides**:
- Word-for-word opening (calms nerves, ensures strong start)
- After first 2-3 slides, bullet points sufficient

**Don't**:
- Don't read slides verbatim to audience
- Don't put all speaking points on slide itself

---

## Common Mistakes to Avoid

### Content Issues
- ❌ Cramming multiple ideas onto one slide
- ❌ Using slides as teleprompter (text-dense)
- ❌ Vague titles: "Background", "Results", "Discussion"
- ❌ Including data you won't explicitly discuss
- ❌ Too much detail for generalist audience
- ❌ Too little detail for expert audience (know your audience!)

### Design Issues
- ❌ Tiny fonts (<18pt)
- ❌ Poor contrast (light text on light background)
- ❌ Color-only coding (no labels/patterns for colorblind)
- ❌ Fancy slide transitions (distracting)
- ❌ Inconsistent styling across slides
- ❌ Complex figures not simplified from paper versions

### Delivery Issues
- ❌ Not practicing with slides (timing off)
- ❌ No backup plan for technical failures
- ❌ Reading bullet points verbatim
- ❌ Talking while audience is reading dense text
- ❌ No PDF backup (relying on one file format)

---

## Configuration Reference

### Timing Configuration

**Default Settings**:
```yaml
timing:
  seconds_per_slide: 90      # Default: 90s (1.5 minutes)
  tolerance: 0.2             # Acceptable variance: ±20%

  # Presets for common scenarios:
  # - fast_paced: 60          # 1 minute per slide
  # - moderate: 90            # 1.5 minutes per slide (default)
  # - detailed: 120           # 2 minutes per slide
  # - deep_dive: 180          # 3 minutes per slide
```

**Usage in Validation**:
```python
expected_slides = (duration_minutes * 60) / seconds_per_slide
min_slides = expected_slides * (1 - tolerance)
max_slides = expected_slides * (1 + tolerance)
```

---

## Validation Checklist

Use this for slide-optimizer and outline-validator:

### Per-Slide Checks
- [ ] One clear idea/finding
- [ ] Meaningful title (assertion, not label)
- [ ] Body text <50 words (excluding title)
- [ ] Element count ≤6
- [ ] At least one visual element (unless quote/transition slide)
- [ ] Font size: body ≥18pt, heading ≥24pt
- [ ] High contrast (4.5:1 minimum)
- [ ] Colorblind-safe colors
- [ ] Can be explained in configured time per slide
- [ ] Standalone comprehension (title + visual convey point)

### Presentation-Level Checks
- [ ] Total slides within acceptable range for duration and pace
- [ ] Logical flow (each slide leads to next)
- [ ] Consistent theme/colors/fonts
- [ ] Opening hook (not CV/agenda)
- [ ] Clear conclusion statement
- [ ] Backup slides separated
- [ ] Contact info provided (title or all slides)
- [ ] All images high-quality and relevant
- [ ] Citations included where needed
- [ ] Presenter notes written for key slides

### Accessibility Checks
- [ ] All text meets minimum size requirements
- [ ] Contrast ratios verified
- [ ] Color palette is colorblind-safe
- [ ] No italics/underlines for body text
- [ ] Sans-serif fonts for readability
- [ ] Legible at distance / small screens

---

## References

1. **The Scientist**: Tips for Making Slide Decks for Scientific Presentations (Nathan Ni, PhD)
   https://www.the-scientist.com/tips-for-making-slide-decks-for-scientific-presentations-72319

2. **TED Blog**: 10 Tips for Better Slide Decks (Aaron Weyenberg, TED UX Lead)
   https://blog.ted.com/10-tips-for-better-slide-decks/

3. **PLOS Computational Biology**: Ten Simple Rules for Effective Presentation Slides (Kristen M. Naegle)
   https://pmc.ncbi.nlm.nih.gov/articles/PMC8638955/

4. **MIT Communication Lab**: Slide Presentation Guide (EECS)
   https://mitcommlab.mit.edu/eecs/commkit/slideshow/

5. **Last Week in AWS**: How to Prepare for a Tech Conference Talk (Corey Quinn)
   https://www.lastweekinaws.com/blog/how-to-prepare-for-a-tech-conference-talk/

6. **Prezent.ai**: Scientific Presentation: 9 Steps to a Compelling Story
   https://www.prezent.ai/blog/scientific-presentation

---

## Quick Reference

**The 10 Essential Rules**:
1. One idea per slide
2. Configurable pace (default: 1.5 min/slide, range: 1-3 min)
3. Meaningful titles (assertions)
4. Minimal text (keywords)
5. Visual over text
6. Max 6 elements per slide
7. Accessibility (fonts, contrast, colors)
8. Design for distracted viewer
9. Progressive disclosure
10. Backup slides for Q&A

**Font Requirements**:
- Body: ≥18pt, sans-serif
- Headings: ≥24pt
- No italics/underlines in body

**Color Requirements**:
- High contrast (4.5:1)
- Colorblind-safe
- 2 core + 1-2 accent colors

**Timing (Configurable)**:
- Default: 90 seconds per slide
- Fast: 60 seconds per slide
- Detailed: 120 seconds per slide
- Deep dive: 180 seconds per slide
- Tolerance: ±20%

**Structure**:
- Strong opening (hook, not CV)
- One finding per slide
- Clear conclusion
- Backup slides separated
