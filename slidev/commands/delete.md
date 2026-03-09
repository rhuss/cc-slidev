---
name: slidev:delete
description: Delete slide by slide number with automatic renumbering
argument-hint: "<slide-number>"
allowed-tools: ["Bash", "AskUserQuestion"]
---

# Delete Slide Command

Delete a slide by its slide number (from `<!-- Slide N: ... -->` comment). All subsequent slides are automatically renumbered to close gaps.

**IMPORTANT: Argument is SLIDE NUMBER (e.g., 6 for Slide 6), NOT list position**

**IMPORTANT: Go DIRECTLY to the script - do NOT read slides.md or display structure first**

## Execution

### 1. Parse Slide Number

Extract slide number from `$ARGUMENTS`. If missing, show: `"Usage: /slidev:delete <slide-number>"`

### 2. Confirm Deletion

Ask for simple confirmation:

```json
{
  "questions": [
    {
      "question": "Delete Slide [N] and renumber subsequent slides?",
      "header": "Confirm",
      "multiSelect": false,
      "options": [
        {
          "label": "Yes, delete",
          "description": "Remove slide and renumber"
        },
        {
          "label": "Cancel",
          "description": "Keep unchanged"
        }
      ]
    }
  ]
}
```

If cancelled, exit with: "Cancelled."

### 3. Execute Script

**IMMEDIATELY run the script - NO exploration before this:**

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/manage-slides.py delete [SLIDE_NUMBER] --renumber
```

The script handles everything:
- Validation (position >= 2, cannot delete title)
- Deleting the file
- Renumbering subsequent slides
- Updating slides.md
- Git operations

### 4. Show Results

Display the script output:
```
✅ Slide deleted

[Script output]
```

## Examples

**Delete Slide 2 (first content slide):**
```
Current: Slide 2, 3, 4, 5
/slidev:delete 2
→ Deletes Slide 2 (file 02-xxx.md)
→ Result: Slide 2, 3, 4 (renumbered from old 3, 4, 5)
```

**Delete Slide 4:**
```
Current: Slide 2, 3, 4, 5, 6
/slidev:delete 4
→ Deletes Slide 4 (file 04-xxx.md)
→ Result: Slide 2, 3, 4, 5 (renumbered from old 5, 6)
```

**Delete Slide 5:**
```
Current: Slide 2, 3, 4, 5
/slidev:delete 5
→ Deletes Slide 5 (file 05-xxx.md)
→ Result: Slide 2, 3, 4
```

## Slide Numbering Convention

**Important:**
- **Slide 1** = Title from `slides.md` frontmatter (no file in `slides/`)
- **Slide 2+** = Files in `slides/` directory starting at `02-xxx.md`
- **Cannot delete slide 1**: It's the title, always present
- First deletable slide is position 2 (`slides/02-xxx.md`)

## Safety Features

- **Confirmation required**: Always asks for confirmation before deleting
- **Preview impact**: Shows exactly which slides will be affected
- **Git-aware**: Uses `git rm` for tracked files, regular `rm` for untracked
- **Automatic renumbering**: Ensures no gaps in slide numbering
- **Rollback on error**: Script aborts if any operation fails

## Notes

- **Slide 1 is special**: Title from frontmatter, cannot be deleted
- **Files start at 02**: First deletable slide file is `slides/02-xxx.md` (position 2)
- **Always renumbers**: This command always uses `--renumber` for consistency
- **Cannot undo**: Once deleted, slide content is lost (unless in git history)
- **Position-based**: Uses position in slide order, not slide number
- **Updates slides.md**: Automatically removes slide reference from master file

## Related Commands

- `/slidev:add <N>` - Add new slide after position N
- `/slidev:edit <N>` - Edit slide at position N
- `/slidev:preview` - Preview presentation

---

Delete slides with automatic renumbering!
