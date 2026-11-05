---
layout: default
---

# Three ways to run your first review

```bash
/review                   # your branch vs main
/review --pr 42           # a PR, in its own worktree
/review --profile quick   # cheap: 2 reviewers, 1 round
```

- Profiles: `quick` · `thorough` · `ci`
- Project config: `.cc-review/config.yml`
- Project knowledge: `.cc-review/review-hints.md`

<!--
**Goal:** the three invocations, and the two files that make reviews better.

**Say:**

"Plain `/review` compares your branch with main. That's the one I use most: before I push, not after."

"With `--pr`, cc-review checks the pull request out into its own worktree, so your working tree stays untouched. That's what's running in the background right now."

"And `--profile quick` is the cheap check: correctness and security only, no external tools, one fix round."

"Two files are worth knowing. `config.yml` switches reviewers on and off for the project. And `review-hints.md` is the most underrated file in the whole tool. Write down what every reviewer should know about your code base: framework quirks, decisions you made on purpose. It's the cheapest way to cut false positives."

**Background:**

- Profiles: `quick` (2 reviewers, 1 round), `thorough` (everything including Greptile, stricter thresholds, more rounds), `ci` (no Gator and Greptile, no prompts, no PR posting).
- Example hint: "We use errgroup for all fan-out; don't flag missing WaitGroups." Without that line, a reviewer may flag it on every PR.
- Each prompt reviewer is a subagent, so a full panel spends real tokens. `quick` is what you run on every push.

**If asked:**

- *All the flags?* Backup slide.

**Transition:** "So what happens after you press enter? Exactly what's running in my terminal right now."

*Timing: 90 s*
-->
