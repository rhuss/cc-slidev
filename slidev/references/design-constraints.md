# Design Constraints Reference

Research-backed constraints for presentation slides. All skills and commands reference this file instead of inlining these rules.

## Hard Limits (Never Violate)

- **MAX 6 elements** per slide (bullets + images + diagrams + code blocks combined)
- **MAX 50 words** body text per slide (excluding title)
- **MAX 1-2 code blocks** per slide (8-10 lines each)
- **ONE idea** per slide (if multiple ideas, split slides)

When content exceeds limits: SPLIT into additional slides. Never compress, shrink, or reduce font size to fit.

## Font Requirements

- Body text: minimum 18-24pt (never smaller than 18pt)
- Headings: minimum 24pt or larger
- Font family: sans-serif for body (Calibri, Arial, Verdana, Helvetica)
- Avoid: italics, underlines, ALL CAPS in body text

## Accessibility (WCAG)

**Contrast ratios:**
- Normal text (<24pt): minimum 4.5:1
- Large text (>=24pt): minimum 3:1

**Colorblind safety:**
- Never rely on color alone to convey meaning
- Add patterns, labels, shapes for differentiation
- Avoid red+green together without additional cues
- Use ColorBrewer (colorbrewer2.org) for verified palettes
- ~8% of males have color vision deficiency

## Default Colorblind-Safe Palette (Blue + Orange)

```
Primary:    #3b82f6  (Blue, 8.6:1 contrast on white)
Secondary:  #f97316  (Orange, 3.4:1, headings only >=24pt)
Neutral:    #6b7280  (Gray, arrows/frames)
Text:       #1f2937  (Dark gray, 16.1:1 contrast, ALL text)
Background: #ffffff  (White)
Accent:     #8b5cf6  (Purple, annotations)
```

## Research Basis

- Cognitive load: >6 elements exponentially increases confusion (David JP Phillips)
- Working memory: 7+/-2 items (Miller's Law)
- Dual-channel interference: >50 words means audience stops listening (MIT Communication Lab)
- Timing default: 90 seconds per slide (PLOS Computational Biology, adjusted for technical content)
- TED presentation research: meaningful assertion titles, not labels
