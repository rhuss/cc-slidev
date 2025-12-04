---
name: slidev:preview
description: Start Slidev dev server to preview presentation
allowed-tools: ["Bash"]
---

# Preview Presentation

Start Slidev development server to preview and interact with presentation.

## Execution

### 1. Find Presentation

Look for slides.md:
- Check current directory
- Check subdirectories
- If multiple found, ask which one

If not found:
- Error: "No slides.md found. Generate slides first with `/slidev:slides`"

### 2. Start Dev Server

Execute preview script:
```bash
cd [presentation-dir]
${CLAUDE_PLUGIN_ROOT}/scripts/preview-slidev.sh slides.md 3030 true
```

Arguments:
- File: slides.md
- Port: 3030 (default)
- Open browser: true

### 3. Inform User

Show server info:
```markdown
## 🚀 Slidev Preview Started

**Server:** http://localhost:3030
**File:** [path]/slides.md

**Features Available:**
- **Presenter Mode:** Press `p`
  - See presenter notes
  - View next slide preview
  - Timer and progress

- **Navigation:**
  - Arrow keys or click
  - Space bar to advance
  - Overview mode: Press `o`

- **Drawing Mode:** Press `d`
  - Annotate slides
  - Drawings persist (if enabled)

- **Recording:** Press `r`
  - Record presentation
  - Export to video

**Hot Reload:**
Changes to slides.md will reload automatically.

**To Stop Server:**
```bash
# Find process
lsof -i :3030

# Kill process
kill [PID]

# Or use Ctrl+C if running in foreground
```

**Edit while previewing:**
Make changes to slides.md and see them live!
```

### 4. Offer Assistance

Ask: "What would you like to do while previewing?"

Options:
- Edit slides while watching: `/slidev:edit [N]`
- Enhance visuals: `/slidev:visuals`
- Export to PDF/PPTX: `/slidev:export`
- Just review and practice

### 5. Background Mode

Server runs in background, so user can continue working.

PID saved to `/tmp/slidev-preview.pid` for reference.

## Preview Tips

**Presenter Mode (Press `p`):**
- Two-window view
- Current slide + next slide
- Presenter notes visible
- Timer shows elapsed time
- Practice with this mode!

**Navigation:**
- Use URL params for specific slides: `http://localhost:3030/5`
- Share local URL with others on same network
- Use overview mode (`o`) to see all slides

**Drawing Mode:**
- Press `d` to enable
- Draw directly on slides
- Clear drawings with `c`
- Useful for live presentations

**Exporting:**
- Don't export from dev server
- Stop server and use `/slidev:export` for production exports

## Troubleshooting

**Port already in use:**
```bash
# Kill existing process
lsof -ti:3030 | xargs kill

# Or try different port
slidev slides.md --port 3031
```

**Browser doesn't open:**
- Manually navigate to http://localhost:3030
- Check firewall settings

**Changes not reloading:**
- Check file is being saved
- Verify terminal for error messages
- Restart server if needed

**Slides don't render:**
- Check markdown syntax errors
- View browser console for errors
- Validate frontmatter YAML

Enjoy the preview!
