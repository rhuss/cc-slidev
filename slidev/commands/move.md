---
name: slidev:move
description: Move slide to new position with automatic renumbering
argument-hint: "<from-slide-number> --after <to-slide-number>"
allowed-tools: ["Bash", "AskUserQuestion"]
---

# Move Slide Command

Move a slide to a new position by specifying which slide to move and which slide it should come after. All slides are automatically renumbered sequentially.

**IMPORTANT: Arguments are SLIDE NUMBERS (e.g., 6 for Slide 6), NOT list positions**

**IMPORTANT: Go DIRECTLY to the script - do NOT read slides.md or display structure first**

## Execution

### 1. Parse Arguments

Extract FROM and AFTER from `$ARGUMENTS`. Expected format: `<from> --after <to>`

If missing, show: `"Usage: /slidev:move <from-slide-number> --after <to-slide-number>"`

### 2. Confirm Move

Ask for simple confirmation:

```json
{
  "questions": [
    {
      "question": "Move Slide [FROM] to position after Slide [AFTER]?",
      "header": "Confirm",
      "multiSelect": false,
      "options": [
        {
          "label": "Yes, move",
          "description": "Move slide and renumber all slides"
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
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/manage-slides.py move [FROM] --after [AFTER]
```

The script handles everything:
- Validation (can't move slide 1, both slides must exist)
- Moving the slide to new position
- Renumbering all slides sequentially
- Updating slides.md
- Git operations

### 4. Show Results

Display the script output:
```
✅ Slide moved

[Script output]
```

## Examples

**Move slide 6 to after slide 3 (becomes slide 4):**
```
Current: Slide 2, 3, 4, 5, 6, 7
/slidev:move 6 --after 3
→ Moves Slide 6 to position 4
→ Result: Slide 2, 3, 4 (was 6), 5 (was 4), 6 (was 5), 7
```

**Move slide 3 to after slide 6 (becomes slide 7):**
```
Current: Slide 2, 3, 4, 5, 6, 7
/slidev:move 3 --after 6
→ Moves Slide 3 to position 7
→ Result: Slide 2, 3 (was 4), 4 (was 5), 5 (was 6), 6 (was 7), 7 (was 3)
```

**Move slide 5 to beginning (after title):**
```
Current: Slide 2, 3, 4, 5, 6
/slidev:move 5 --after 1
→ Moves Slide 5 to position 2 (first content slide)
→ Result: Slide 2 (was 5), 3 (was 2), 4 (was 3), 5 (was 4), 6
```

**Move slide 3 to end:**
```
Current: Slide 2, 3, 4, 5
/slidev:move 3 --after 5
→ Moves Slide 3 to after last slide
→ Result: Slide 2, 3 (was 4), 4 (was 5), 5 (was 3)
```

## Slide Numbering Convention

**Important:**
- **Slide 1** = Title from `slides.md` frontmatter (no file in `slides/`)
- **Slide 2+** = Files in `slides/` directory starting at `02-xxx.md`
- **Cannot move slide 1**: It's the title, always in position 1
- **Move semantics**: "move X --after Y" means X goes immediately after Y

## Behavior

**Always renumbers:** The move command always renumbers all slides to ensure sequential numbering (2, 3, 4, ...) with no gaps.

**Example flow:**
1. Parse slide numbers from arguments
2. Confirm with user
3. Script removes slide from current position
4. Script inserts slide at new position
5. Script renumbers all slides sequentially
6. Script updates slides.md
7. Show results

## Edge Cases

**Already in position:**
```
/slidev:move 4 --after 3
→ Slide 4 is already after slide 3
→ No changes needed
```

**Cannot move slide 1:**
```
/slidev:move 1 --after 5
→ Error: Cannot move slide 1 (title from frontmatter)
```

**Slide not found:**
```
/slidev:move 99 --after 3
→ Error: Slide 99 not found
→ Available slides: [2, 3, 4, 5, 6]
```

**Cannot move after itself:**
```
/slidev:move 5 --after 5
→ Error: Cannot move slide 5 after itself
```

## Safety Features

- **Confirmation required**: Always asks for confirmation before moving
- **Preview impact**: Shows which slide is moving and where
- **Git-aware**: Uses `git mv` for tracked files, regular `mv` for untracked
- **Automatic renumbering**: Ensures no gaps in slide numbering
- **Rollback on error**: Script aborts and rolls back if any operation fails

## Notes

- **Slide 1 is special**: Title from frontmatter, cannot be moved
- **Always renumbers**: Ensures sequential numbering (2, 3, 4, ...)
- **Git-aware operations**: Uses git commands when appropriate
- **Position vs number**: Uses slide numbers (from comments), not list positions
- **Updates slides.md**: Automatically updates master file with new order

## Related Commands

- `/slidev:add <N>` - Add new slide at position N
- `/slidev:delete <N>` - Delete slide at position N
- `/slidev:edit <N>` - Edit slide at position N
- `/slidev:preview` - Preview presentation

---

Move slides to reorganize your presentation!
