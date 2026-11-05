---
layout: default
---

# A reviewer is one Markdown file

```markdown {2-5|7-9}
---
name: team-rules
display_name: "Team Rules"
kind: prompt
category: conventions
---
You are the TEAM RULES REVIEW AGENT.
YOUR SCOPE: our API error format, logging fields,
feature flags. Stay in your lane.
```

- Save as `.cc-review/reviewers/team-rules.md`
- Next run: in the status table; `--only team-rules`

<!--
**Goal:** writing a reviewer is easy enough to do this week.

**Say:**

"This is a complete reviewer."

*(click: frontmatter highlighted)* "A few lines of frontmatter: a name that matches the file name, a display name, `kind: prompt`, and a category that's written into every finding."

*(click: body highlighted)* "Then the prompt: who you are, what your scope is, and to stay in your lane. The shared preamble with all the rules from earlier is added automatically."

"Save it as `.cc-review/reviewers/team-rules.md`. On the next run it's discovered, runs with the others, shows up in the table, and you can run it alone with `--only team-rules`."

"My suggestion: take the comment your team keeps writing on pull requests. That's your first reviewer."

**Background:**

- A real reviewer body also has a "you are not responsible for" section and a checklist; the slide shortens it.
- Turn it on or off with `reviewers.team-rules` in the config, or `--no-team-rules`.
- Directory form: `team-rules/reviewer.md` plus reference files that get inlined. Gator uses that for its evidence rules.
- Put it in `~/.cc-review/reviewers/` instead to use it in every project.

**Transition:** "External tools are reviewers too, and they're just as short."

*Timing: 100 s*
-->
