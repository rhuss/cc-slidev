---
name: slidev:manage-slides
description: Add or delete slides with automatic renumbering (invokes Slide Management skill)
argument-hint: ""
allowed-tools: ["Skill"]
---

# Manage Slides Command

Direct command to invoke the Slide Management skill for adding or deleting slides.

**IMPORTANT**: This command simply invokes the Slide Management skill. The skill handles all the interactive workflow for managing slides.

## Execution

Invoke the Slide Management skill:

```
Use Skill tool with: skill: "slidev:slide-management"
```

The skill will:
1. Display current slide structure
2. Ask what to do (add/delete/view)
3. Guide through the operation
4. Execute with automatic renumbering
5. Show results

## Why Use This Command

You should invoke the Slide Management skill (either via this command or directly) whenever:
- User wants to delete/remove a slide
- User wants to add/insert a new slide
- User confirms slide deletion (answers "yes" to "should I delete slide N?")
- User wants to reorganize slide order

**CRITICAL**: Always use the skill instead of manually:
- Editing slides.md
- Renaming slide files
- Using git mv on slide files

The skill ensures:
- Automatic renumbering (no gaps)
- Git-aware operations
- slides.md stays in sync
- Rollback on errors

## Examples

```
User: "Delete slide 5"
→ Invoke Slide Management skill

User: "Add a new slide after slide 3"
→ Invoke Slide Management skill

User: "Should I delete slide 24?" / "yes"
→ Invoke Slide Management skill

User: "I want to remove the architecture slide"
→ Invoke Slide Management skill
```
