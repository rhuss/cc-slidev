---
name: Slide Management
description: This skill should be used when the user wants to "delete slide", "remove slide", "add slide", "insert slide", "create new slide between", "get rid of slide", "fix gaps", "renumber slides", or when they confirm deletion/addition of slides (e.g., answering "yes" to "should I delete slide N"). CRITICAL - Always use this skill instead of manually editing slides.md or renaming slide files, as it handles automatic renumbering, gap detection/fixing, and git-aware operations. Trigger immediately when user wants to modify slide count, order, or numbering.
version: 0.2.0
---

# Slide Management

Manage slide additions and deletions with automatic renumbering. The system handles file renaming, updates slides.md, and uses git-aware operations for tracked files.

## How This Skill Works

This skill provides an interactive workflow for:
- **Adding slides**: Insert new slide at any position with automatic renumbering of subsequent slides
- **Deleting slides**: Remove slide and renumber remaining slides to close gaps
- **Git awareness**: Uses `git mv` for tracked files, regular `mv` for untracked files

## Workflow

### Step 1: Find and Display Current Slides

Use Bash to find slides.md:
```bash
find . -name "slides.md" -type f -not -path "*/node_modules/*" | head -1
```

Then use Read tool on slides.md and parse all slide entries.

**CRITICAL - Gap Detection:**
After parsing slides, check for gaps in slide numbering:
- Extract all slide numbers from the parsed slides
- Look for missing numbers in the sequence (e.g., if you have slides 1, 2, 5, 6, then gaps are [3, 4])
- A gap is when the sequence is not continuous (1, 2, 3, ...)

Display current presentation structure to user:

```
📊 Current Presentation Structure (N slides)

1. Title Slide
   slides/01-title.md

2. Introduction
   slides/02-introduction.md

5. Main Topic
   slides/05-main-topic.md

... (show all slides with numbers, titles, and filenames)
```

If gaps are detected, add a warning:

```
⚠️  Numbering gaps detected: [3, 4]
Slides are not sequentially numbered. You can fix this with the renumber operation.
```

### Step 2: Ask What to Do

Use AskUserQuestion to ask the user what they want to do.

**IMPORTANT**: Dynamically build the options list based on whether gaps exist:

If **gaps detected**, offer 4 options:
```
- question: "What would you like to do with the slides?"
- header: "Action"
- multiSelect: false
- options:
  1. label: "Fix gaps"
     description: "Renumber all slides to be sequential (1, 2, 3, ...) and close gaps"
  2. label: "Add slide"
     description: "Insert a new slide at any position"
  3. label: "Delete slide"
     description: "Remove a slide"
  4. label: "View only"
     description: "Just browsing the current structure"
```

If **no gaps detected**, offer 3 options:
```
- question: "What would you like to do with the slides?"
- header: "Action"
- multiSelect: false
- options:
  1. label: "Add slide"
     description: "Insert a new slide at any position with automatic renumbering"
  2. label: "Delete slide"
     description: "Remove a slide and renumber remaining slides"
  3. label: "View only"
     description: "Just browsing the current structure"
```

If user chooses "View only", end the skill.

If user chooses "Fix gaps", go to Step 2b.

### Step 2b: Fix Gaps Flow (if user chose "Fix gaps")

#### 2b.1: Show Impact and Confirm

Display what will happen:

```
🔧 Fix Numbering Gaps

Current gaps: [3, 4, 7]

This will renumber ALL slides to be sequential:
- Slide 1 → Slide 1 (no change)
- Slide 2 → Slide 2 (no change)
- Slide 5 → Slide 3
- Slide 6 → Slide 4
- Slide 8 → Slide 5
- Slide 9 → Slide 6
... (show all renumbering)

Result: Slides will be numbered 1-N with no gaps
```

Ask for confirmation:

```
- question: "Proceed with renumbering?"
- header: "Confirm"
- multiSelect: false
- options:
  1. label: "Yes, fix gaps"
     description: "Renumber all slides to be sequential"
  2. label: "Cancel"
     description: "Keep current numbering"
```

If user cancels, return to Step 2.

#### 2b.2: Execute Renumber Script

Use Bash to execute:

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/manage-slides.py renumber
```

Capture both stdout and stderr, check exit code.

#### 2b.3: Show Results

If successful:

```
✅ Gaps Fixed Successfully

Renumbered slides:
- Slide 5 → Slide 3 (slides/03-main-topic.md)
- Slide 6 → Slide 4 (slides/04-examples.md)
- Slide 8 → Slide 5 (slides/05-advanced.md)
... (show all renumbered)

Total slides: N (all sequentially numbered 1-N)
```

Then offer next action:

```
- question: "What would you like to do next?"
- header: "Next"
- multiSelect: false
- options:
  1. label: "Add slide"
     description: "Insert a new slide"
  2. label: "Delete slide"
     description: "Remove a slide"
  3. label: "Done"
     description: "Finish managing slides"
```

### Step 3a: Delete Flow (if user chose "Delete slide")

#### 3a.1: Ask Which Slide to Delete

Generate options dynamically from the slide list you parsed. For each slide, create an option:

```
- question: "Which slide number would you like to delete?"
- header: "Slide"
- multiSelect: false
- options:
  [Generate options for each slide with format:]
  label: "1"
  description: "[Title] (slides/0N-slug.md)"

  Example:
  label: "5"
  description: "Architecture Overview (slides/05-architecture-overview.md)"
```

#### 3a.2: Ask About Renumbering

Ask if user wants to renumber after deletion:

```
- question: "Should remaining slides be renumbered to close gaps?"
- header: "Renumber"
- multiSelect: false
- options:
  1. label: "Yes, renumber"
     description: "Make slides sequential (1, 2, 3, ...) with no gaps"
  2. label: "No, leave gaps"
     description: "Keep slide numbers unchanged (may create gaps)"
```

#### 3a.3: Show Impact and Confirm

Calculate and show the impact based on renumber choice:

If **renumbering**:
```
⚠️ Confirm Deletion

Deleting: Slide [N]: [Title]
File: slides/0N-[slug].md

Impact (with renumbering):
- Slides [N+1] through [M] will be renumbered to [N] through [M-1]
- All slides will be sequential (1, 2, 3, ...) with no gaps
- Affects [X] slides total
```

If **not renumbering**:
```
⚠️ Confirm Deletion

Deleting: Slide [N]: [Title]
File: slides/0N-[slug].md

Impact (without renumbering):
- Slide will be removed
- Remaining slides keep their current numbers
- This will create a gap at position [N]
```

Then ask for confirmation:

```
- question: "Proceed with deletion?"
- header: "Confirm"
- multiSelect: false
- options:
  1. label: "Yes, delete"
     description: "Remove slide [with/without renumbering]"
  2. label: "Cancel"
     description: "Keep all slides unchanged"
```

If user cancels, return to Step 2.

#### 3a.4: Execute Delete Script

Use Bash to execute the Python script with or without --renumber flag:

If renumbering:
```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/manage-slides.py delete [N] --renumber
```

If not renumbering:
```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/manage-slides.py delete [N]
```

Capture both stdout and stderr.

Check exit code:
- Exit code 0: Success
- Exit code > 0: Error (show error message from stderr)

#### 3a.5: Show Results

If successful, show summary:

```
✅ Slide Deleted Successfully

Removed:
- Slide [N]: [Title]
- File: slides/0N-[slug].md

Renumbered:
- Slide [N+1] → Slide [N]
- Slide [N+2] → Slide [N+1]
... (show all renumbered slides)

Total slides: [M-1] (was [M])
```

If error, show error message and offer to retry or cancel.

Then offer next action:

```
- question: "What would you like to do next?"
- header: "Next"
- multiSelect: false
- options:
  1. label: "Delete another"
     description: "Remove another slide"
  2. label: "Add slide"
     description: "Insert a new slide"
  3. label: "Done"
     description: "Finish managing slides"
```

### Step 3b: Add Flow (if user chose "Add slide")

#### 3b.1: Ask Position

Generate position options (1 through N+1):

```
- question: "Where should the new slide be inserted?"
- header: "Position"
- multiSelect: false
- options:
  [Generate options for all valid positions:]

  label: "1"
  description: "At beginning (before current Slide 1)"

  label: "2"
  description: "After 'Title Slide' (before current Slide 2: Introduction)"

  ...

  label: "[N+1]"
  description: "At end (after Slide N: [Last Slide Title])"
```

#### 3b.2: Ask Title and Layout

Ask for both title and layout in one question set:

```
Question 1:
- question: "What should the slide title be?"
- header: "Title"
- multiSelect: false
- options:
  1. label: "Enter custom title"
     description: "Type your slide title in the Other field"
```

(User will use "Other" option to enter their custom title)

```
Question 2:
- question: "Which layout should the slide use?"
- header: "Layout"
- multiSelect: false
- options:
  1. label: "default"
     description: "Standard layout"
  2. label: "center"
     description: "Centered content"
  3. label: "two-cols"
     description: "Two columns side by side"
  4. label: "image-right"
     description: "Content on left, image on right"
  5. label: "quote"
     description: "Large quote display"
  6. label: "cover"
     description: "Cover/title slide style"
```

Extract the custom title from the "Other" response.

#### 3b.3: Ask About Renumbering

Ask if user wants to renumber after addition:

```
- question: "Should all slides be renumbered to be sequential?"
- header: "Renumber"
- multiSelect: false
- options:
  1. label: "Yes, renumber"
     description: "Make all slides sequential (1, 2, 3, ...) with no gaps"
  2. label: "No, use gaps"
     description: "Insert at position, may create or use existing gaps"
```

#### 3b.4: Show Preview and Confirm

Generate slug from title (lowercase, hyphens, max 40 chars) and show preview based on renumber choice:

If **renumbering**:
```
📋 New Slide Preview

Position: [N]
Title: [User's title]
Layout: [Selected layout]
Filename: slides/0N-[generated-slug].md

Impact (with renumbering):
- New slide will be inserted at position [N]
- Current slides [N] through [M] will become [N+1] through [M+1]
- All slides will be sequential (1, 2, 3, ...) with no gaps
- Affects [X] slides
```

If **not renumbering**:
```
📋 New Slide Preview

Position: [N]
Title: [User's title]
Layout: [Selected layout]
Filename: slides/0N-[generated-slug].md

Impact (without renumbering):
- New slide will be inserted at position [N]
- Slide number will fit into existing sequence/gaps
- May create or use existing gaps in numbering
```

Ask for confirmation:

```
- question: "Create this slide?"
- header: "Confirm"
- multiSelect: false
- options:
  1. label: "Yes, create"
     description: "Add slide [with/without renumbering]"
  2. label: "Cancel"
     description: "Don't make changes"
```

If cancelled, return to Step 2.

#### 3b.5: Execute Add Script

Use Bash to execute with or without --renumber flag:

If renumbering:
```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/manage-slides.py add [N] \
  --title "[User's title]" \
  --layout [layout] \
  --renumber
```

If not renumbering:
```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/manage-slides.py add [N] \
  --title "[User's title]" \
  --layout [layout]
```

Capture output and check exit code.

#### 3b.6: Show Results and Next Steps

If successful:

```
✅ Slide Created Successfully

Added:
- Slide [N]: [Title]
- File: slides/0N-[slug].md
- Layout: [layout]

Renumbered:
- Old Slide [N] → Slide [N+1]
- Old Slide [N+1] → Slide [N+2]
... (show renumbered slides)

Total slides: [M+1] (was [M])
```

Then offer next actions:

```
- question: "What would you like to do next?"
- header: "Next"
- multiSelect: false
- options:
  1. label: "Edit new slide"
     description: "Open slide [N] for editing with /slidev:edit"
  2. label: "Add another"
     description: "Add another slide"
  3. label: "Done"
     description: "Finish managing slides"
```

If user chooses "Edit new slide", invoke the edit command:
```
Use SlashCommand tool: "/slidev:edit [N]"
```

### Error Handling

When the Python script returns a non-zero exit code:

1. Capture stderr output
2. Extract error message
3. Display user-friendly error:

```
❌ Operation Failed

Error: [Parsed error message]

Details: [Technical details if helpful]
```

Then ask:

```
- question: "How should we proceed?"
- header: "Action"
- multiSelect: false
- options:
  1. label: "Try again"
     description: "Retry the operation"
  2. label: "Cancel"
     description: "Return to main menu"
  3. label: "Show full error"
     description: "Display complete error output for debugging"
```

## Important Notes

- **Git awareness**: The script automatically detects git-tracked files and uses `git mv` for them
- **Rollback on error**: If any operation fails, all changes are automatically rolled back
- **Validation**: Position ranges are validated before execution
- **Atomic operations**: Backup is created before any changes, restored on error
- **No gaps**: Slide numbers are always sequential (1, 2, 3, ...) with no gaps

## Edge Cases

**Deleting slide 1:**
- Warn that all slides will be renumbered
- Show what the new first slide will be

**Adding at end (position N+1):**
- No renumbering needed, just append
- Optimize for this case

**Number overflow (>99):**
- Script enforces max 99 slides
- Error message suggests splitting presentation

## Example Interaction

```
User invokes skill:

📊 Current Presentation Structure (5 slides)

1. Title Slide
   slides/01-title.md
2. Introduction
   slides/02-introduction.md
3. Main Topic
   slides/03-main-topic.md
4. Examples
   slides/04-examples.md
5. Conclusion
   slides/05-conclusion.md

What would you like to do?
> User chooses: "Add slide"

Where should the new slide be inserted?
> User chooses: Position 3 (after "Introduction", before "Main Topic")

What should the slide title be?
> User enters: "Architecture Overview"

Which layout?
> User chooses: "two-cols"

📋 New Slide Preview

Position: 3
Title: Architecture Overview
Layout: two-cols
Filename: slides/03-architecture-overview.md

Impact:
- Current slides 3-5 will become 4-6
- Affects 3 slides

Create this slide?
> User confirms: "Yes, create"

[Script executes...]

✅ Slide Created Successfully

Added:
- Slide 3: Architecture Overview
- File: slides/03-architecture-overview.md
- Layout: two-cols

Renumbered:
- Old Slide 3 (Main Topic) → Slide 4
- Old Slide 4 (Examples) → Slide 5
- Old Slide 5 (Conclusion) → Slide 6

Total slides: 6 (was 5)

What next?
> User chooses: "Edit new slide"

[Invokes /slidev:edit 3]
```

## Tools Available

- **Read**: Read slides.md and slide files
- **Bash**: Execute manage-slides.py script
- **SlashCommand**: Invoke /slidev:edit if user wants to edit new slide
- **AskUserQuestion**: Interactive workflow questions

Use this skill whenever users need to reorganize, add, or remove slides from their presentation. The automatic renumbering ensures the presentation structure remains clean and sequential.
