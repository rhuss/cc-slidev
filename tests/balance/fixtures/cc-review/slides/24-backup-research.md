---
layout: default
---

# Backup: multi-pass review with verification is the industry pattern

- Bugbot: resolution rate 52% → 70%+ (vendor)
- Anthropic: <1% findings marked incorrect (vendor)
- Cubic: 51% fewer false positives (vendor)
- CodeRabbit field study: 56% rejected (independent)

<!--
**Use when:** someone asks whether multi-pass review really helps.

**Say:**

"The vendors that measured it report big gains from multiple passes plus verification. Bugbot's resolution rate went from 52 to over 70 percent, Anthropic reports under 1 percent of findings marked incorrect. But those are vendor numbers. The independent study we have mostly documents the noise problem: 56% rejected."

**Background:**

- Cursor Bugbot: 8 parallel passes with shuffled diff order, majority vote, then a validator (cursor.com/blog/building-bugbot).
- Anthropic Code Review: agent team plus verification; PRs with substantive comments went from 16% to 54% (claude.com/resources/articles/code-review).
- Cubic: specialized micro-agents, 51% fewer false positives at the same recall (cubic.dev/blog/learnings-from-building-ai-agents).
- Be explicit that vendor numbers are self-reported.
-->
