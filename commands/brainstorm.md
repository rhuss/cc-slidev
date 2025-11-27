---
name: slidev:brainstorm
description: Interactive brainstorming and research phase for presentation creation
allowed-tools: ["Read", "Write", "WebSearch", "Grep", "Glob", "AskUserQuestion"]
---

# Brainstorming & Information Collection

Conduct interactive brainstorming session to gather ideas, research topic, and establish foundation for evidence-based presentation.

**Note**: This phase gathers raw material. Structure and refinement come later using evidence-based principles (see `references/presentation-best-practices.md`).

## Execution

### 1. Understand Topic

If not already known, ask:
- What is the presentation topic?
- What are the main objectives?
- Who is the target audience?

### 2. Collect CfP Abstract and Guidelines

**If this presentation is for a conference, meetup, or event:**

Ask the user:
- Do you have a Call for Papers (CfP) abstract for this presentation?
- Do you have any initial guidelines or notes about what you want to talk about?

**If CfP abstract provided:**
- Read and analyze the abstract
- Extract key commitments and promises made
- Identify main themes and topics
- Note any specific examples or case studies mentioned
- Use this as the foundation for content development

**If guidelines provided:**
- Review user's initial thoughts and ideas
- Identify preferred focus areas
- Note any specific requirements or constraints
- Understand what the user is excited about covering

**Create initial context file:**
```markdown
## CfP Abstract (if provided)
[Full abstract text]

### Commitments from Abstract
- [Key point 1 promised in abstract]
- [Key point 2 promised in abstract]
- [Topics that must be covered]

## Initial Guidelines (if provided)
[User's notes and guidelines]

### Focus Areas
- [What user wants to emphasize]
- [Specific angles or approaches]
- [Must-include content]
```

Save this to `cfp-and-guidelines.md` if provided.

### 3. Gather Information

**Ask user about information sources:**
- Do you have existing materials I should review?
- Should I research online resources?
- Are there specific aspects to focus on?

**Conduct research based on answers:**

If web research approved:
```
Use WebSearch to find:
- Key concepts and definitions
- Recent developments
- Statistics and data
- Examples and case studies
- Best practices
```

If local files mentioned:
```
Use Read/Grep to analyze:
- Existing documents
- Notes and outlines
- Reference materials
- Code or data files
```

### 4. Interactive Ideation

Ask probing questions to develop ideas:

**Content depth:**
- What level of detail is appropriate?
- Should we cover fundamentals or assume knowledge?
- Are there specific examples you want included?

**Key messages:**
- What are the 3 most important takeaways?
- What should audience remember in 6 months?
- What action should they take?

**Constraints and requirements:**
- Are there topics that must be covered?
- Anything to avoid or handle carefully?
- Time or scope limitations?

### 5. Organize Findings

Create `brainstorm.md` file with structured content:

```markdown
# Brainstorming: [Topic]

## CfP Abstract & Guidelines (if applicable)
See `cfp-and-guidelines.md` for full details

### Key Commitments
- [Points promised in abstract]
- [Must-cover topics]

### User Guidelines
- [Initial directions from user]
- [Focus areas]

## Topic & Objectives
- Main topic: [Topic]
- Primary objective: [What audience should learn/do]
- Secondary objectives: [Supporting goals]

## Audience Analysis
- Who: [Audience description]
- Expertise level: [Beginner/Intermediate/Expert]
- Expectations: [What they want to learn]
- Context: [Where/when/why this presentation]

## Key Points Discovered
1. [Main point 1]
   - Supporting details
   - Examples
   - Data/statistics

2. [Main point 2]
   ...

## Potential Structure Ideas
- Opening hook: [Compelling way to start]
- Main sections: [Rough structure]
- Closing: [How to end]

## Visual Opportunities
- [Concept that needs diagram]
- [Process that needs flowchart]
- [Data that needs visualization]

## References and Sources
- [Source 1]: [URL or file path]
- [Source 2]: ...

## Notes and Ideas
- [Misc notes]
- [Questions to address]
- [Things to research further]
```

### 6. Summarize and Confirm

Present summary to user:
```markdown
## Brainstorming Summary

**Topic:** [Topic]

**Key Themes:**
- [Theme 1]
- [Theme 2]
- [Theme 3]

**Potential Angle:**
[How we might approach this topic]

**Next Steps:**
- Frame presentation scope (duration, slide count)
- Create structured outline
- Generate slides
```

Ask: "Does this capture the right direction? Anything to add or change?"

Make updates based on feedback.

## Tips

- Be conversational and collaborative
- Ask open-ended questions
- Dig deeper on interesting points
- Capture everything (can filter later)
- Look for unique angles or insights
- Identify gaps that need research
- Note visual opportunities as you go

**Don't:**
- Rush through questions
- Accept vague answers without probing
- Skip research if it would help
- Overcomplicate at this stage
- Lock into structure too early

Save brainstorm.md and inform user that framing phase is next.
