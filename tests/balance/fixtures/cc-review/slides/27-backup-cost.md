---
layout: default
---

# Backup: cost scales with the panel you choose

- Prompt reviewers: one subagent each
- Meta-review: two more subagents (≥5 findings)
- External tools: their own credits
- `quick`: 2 reviewers, 1 round

<!--
**Use when:** someone asks what a run costs.

**Say:**

"Cost scales with the panel you choose. Each prompt reviewer is one subagent, the meta-review adds two more when there are at least five findings, and external tools spend their own credits. The `quick` profile is two reviewers and one round, cheap enough for every push."

**Background:**

- Greptile spends a credit per run, which is why it's off by default.
- Reduce cost with profiles, with `--only`, or by switching off lanes that score low for your project (slide 12).
- Measure the token cost of a real run before quoting numbers.
-->
