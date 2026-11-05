---
layout: default
---

# Backup: most review tools are one vendor's single opinion

| Tool | Delivery | Multi-pass | Local |
|---|---|---|---|
| CodeRabbit | PR bot, CLI | review + verify | yes |
| Copilot review | PR bot, IDE | single | IDE |
| Greptile | PR bot, CLI | n/a | committed |
| Codex | CLI, cloud | single | yes |
| Claude Code Review | GitHub App | team + verify | no |
| Cursor Bugbot | PR bot | passes + validator | yes |

<!--
**Use when:** someone asks how cc-review compares with existing tools.

**Say:**

"Most tools are one vendor's opinion, delivered as a PR bot. Some do several passes and verify their own findings, like CodeRabbit, Claude Code Review and Bugbot. What none of them does is combine reviewers from different vendors under one dedup and one meta-review, locally, before you push. That's the gap cc-review fills."

**Background:**

- As of November 2026, from vendor documentation. Pricing is left out because the sources disagree.
- cc-review doesn't replace these tools: CodeRabbit, Codex, Copilot and Greptile are members of its panel.
-->
