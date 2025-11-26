---
name: export
description: Export presentation to PDF, PPTX, or other formats
argument-hint: "[format]"
allowed-tools: ["Bash"]
---

# Export Presentation

Export Slidev presentation to various formats (PDF, PPTX, PNG).

## Execution

### 1. Parse Format Argument

Extract from `$ARGUMENTS`:
- Valid formats: pdf, pptx, png
- Default: pdf (if not specified)

If invalid format:
- Error: "Supported formats: pdf, pptx, png"
- Ask which format they want

### 2. Find Presentation

Locate slides.md:
- Check current directory
- Check subdirectories
- If multiple, ask which one

### 3. Check Dependencies

Slidev export requires Playwright browsers:
```bash
# Check if playwright is available
npx playwright --version
```

If not installed:
```markdown
Slidev export requires Playwright browsers for rendering.

**Install:**
```bash
npx playwright install chromium
```

This downloads Chromium browser for PDF/PPTX generation.

Should I install it now? (Y/n)
```

If user approves, install:
```bash
npx playwright install chromium
```

### 4. Export to Format

**PDF Export:**
```bash
cd [presentation-dir]
slidev export slides.md --output exports/slides.pdf
```
- Vector format (best quality)
- Suitable for printing
- Animations become static
- Interactive elements removed

**PPTX Export:**
```bash
cd [presentation-dir]
slidev export slides.md --format pptx --output exports/slides.pptx
```
- PowerPoint format
- Editable in PowerPoint/Keynote
- Some styling may change
- Good for sharing/editing

**PNG Export:**
```bash
cd [presentation-dir]
slidev export slides.md --output exports/slides --format png --per-slide
```
- Creates PNG for each slide
- Numbered files: slide-1.png, slide-2.png, etc.
- Useful for handouts, social media, thumbnails
- High resolution images

### 5. Monitor Progress

Slidev export can take time:
- Show progress if possible
- Inform user it's processing
- Typical time: 30-60 seconds

### 6. Verify Output

Check if export succeeded:
```bash
ls -lh exports/slides.*
```

If successful:
- Show file size
- Show location
- Offer to open

If failed:
- Check error output
- Common issues:
  - Playwright not installed
  - Syntax errors in slides
  - Missing images
  - Memory issues (large presentation)

### 7. Summary

Present completion:
```markdown
## ✅ Export Complete

**Format:** [format]
**Output:** exports/slides.[extension]
**Size:** [X] MB
**Slides:** [Y] slides

**Open:**
```bash
open exports/slides.[format]  # macOS
xdg-open exports/slides.[format]  # Linux
```

**Share:**
File is ready to share, email, or upload.

**Other Formats:**
Export to other formats:
- `/slidedeck:export pdf`
- `/slidedeck:export pptx`
- `/slidedeck:export png`
```

## Format Comparison

Help user choose:

**PDF** - Best for:
- Final distribution
- Printing handouts
- Archiving
- Email attachments
- High quality needed

**PPTX** - Best for:
- Further editing in PowerPoint
- Collaborating with non-technical users
- Corporate environments
- Adding animations in PowerPoint

**PNG** - Best for:
- Social media sharing
- Website thumbnails
- Slide previews
- Email signatures
- Individual slide use

## Export Options

Offer advanced options if user wants:

**PDF Options:**
```bash
slidev export --format pdf \
  --output slides.pdf \
  --range 1-10 \
  --dark  # Dark mode
```

**Quality:**
```bash
--withClicks  # Include click animations as separate pages
--executablePath /path/to/chrome  # Custom browser
```

## Troubleshooting

**Export hangs:**
- Check for infinite animations
- Verify all images load
- Try exporting subset: `--range 1-5`

**Poor quality:**
- PDF is vector (best quality)
- PNG: Check resolution settings
- PPTX: Some fonts may change

**Large file size:**
- Compress images before embedding
- Use PNG instead of high-res photos
- Split large presentations

**Missing content:**
- Verify all slides render in preview first
- Check for mermaid diagram errors
- Ensure external images accessible

Inform user export is ready!
