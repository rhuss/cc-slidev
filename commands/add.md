---
name: slidev:add
description: Insert new slide at specified slide number with automatic renumbering
argument-hint: "<slide-number>"
allowed-tools: ["Bash", "AskUserQuestion"]
---

# Add Slide Command

Insert a new slide at the specified slide number (from `<!-- Slide N: ... -->` comment). Existing slides at that number and higher shift forward.

**IMPORTANT: Argument is SLIDE NUMBER (e.g., 6 for new Slide 6), NOT list position**

**IMPORTANT: Go DIRECTLY to asking for title and running script - do NOT read slides.md or display structure first**

## Execution

### 1. Parse Slide Number

Extract slide number from `$ARGUMENTS`. If missing, show: `"Usage: /slidev:add <slide-number>"`

### 2. Ask for Slide Title

```json
{
  "questions": [
    {
      "question": "Title for the new slide?",
      "header": "Title",
      "multiSelect": false,
      "options": [
        {
          "label": "Enter custom title",
          "description": "Provide a meaningful title"
        },
        {
          "label": "Untitled Slide",
          "description": "Add title later"
        }
      ]
    }
  ]
}
```

If "Enter custom title", use the "Other" text provided. If "Untitled Slide", use that as title.

### 3. Execute Script

**IMMEDIATELY run the script - NO exploration before this:**

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/manage-slides.py add [SLIDE_NUMBER] --title "[TITLE]" --renumber
```

The script handles everything:
- Validation (position >= 2)
- Creating the slide file
- Renumbering subsequent slides
- Updating slides.md
- Git operations

### 4. Show Results

Display the script output:
```
✅ Slide added at position [N]

[Script output]
```

## Examples

**Insert new Slide 2:**
```
Current: Slide 2, 3, 4, 5
/slidev:add 2
→ NEW Slide 2 (file 02-xxx.md)
→ Shifts: old 2→3, old 3→4, old 4→5, old 5→6
→ Result: Slide 2 (NEW), 3, 4, 5, 6
```

**Insert new Slide 4:**
```
Current: Slide 2, 3, 4, 5
/slidev:add 4
→ NEW Slide 4 (file 04-xxx.md)
→ Shifts: old 4→5, old 5→6
→ Result: Slide 2, 3, 4 (NEW), 5, 6
```

**Insert new Slide 6:**
```
Current: Slide 2, 3, 4, 5
/slidev:add 6
→ NEW Slide 6 (file 06-xxx.md, becomes last)
→ No shifts needed
→ Result: Slide 2, 3, 4, 5, 6 (NEW)
```

## Slide Numbering Convention

**Important:**
- **Slide 1** = Title from `slides.md` frontmatter (no file in `slides/`)
- **Slide 2+** = Files in `slides/` directory starting at `02-xxx.md`
- When you insert at position 2, it creates/becomes the first slide file: `slides/02-xxx.md`
- Cannot insert at position 1 (title is always position 1)

## Notes

- **Slide 1 is special**: Title from frontmatter, not a file in `slides/`
- **Files start at 02**: First slide file is always `slides/02-xxx.md`
- **Always renumbers**: This command always uses `--renumber` for consistency
- **Empty slide**: Creates minimal slide with title only
- **Git-aware**: Uses `git mv` for tracked files, regular `mv` for untracked
- **Insert semantics**: New slide BECOMES the specified position, shifting others back

## Related Commands

- `/slidev:delete <N>` - Delete slide at position N
- `/slidev:edit <N>` - Edit slide at position N
- `/slidev:preview` - Preview presentation

---

Add new slides with automatic renumbering!
