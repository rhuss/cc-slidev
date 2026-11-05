---
layout: default
---

# Wrapping an external tool takes a frontmatter block

```yaml {3|5-7|8|9-12|13-15}
name: greptile
display_name: "Greptile"
kind: command
enabled: false
detect: "command -v greptile"
auth_check: "greptile whoami >/dev/null && greptile init --json >/dev/null"
invoke: "greptile review --json --agent -b {base_branch}"
timeout_seconds: 540
severity_map:
  P0: Critical
  P1: Important
  P2: Minor
output:
  format: parser
  parser: parse.sh
```

<!--
**Goal:** an external tool becomes a reviewer with a frontmatter block and a small parser.

**Say:**

"Greptile was added last week. This is all of it, plus a small parser script."

*(click)* "`kind: command`: this reviewer runs a program instead of a prompt."

*(click)* "Three commands. `detect` checks the tool is installed, `auth_check` that you're logged in, `invoke` runs the review. If detect or auth fail, the reviewer is skipped with a reason, and the review goes on."

*(click)* "A timeout, because all external tools start at the same time and you don't want one to hold up the rest."

*(click)* "`severity_map` translates Greptile's P0 to P2 into cc-review's severities."

*(click)* "And the output section: if a tool prints JSON in the right shape, you're done. If not, a parser. Greptile's is about 25 lines of `jq`."

**Background:**

- `invoke` is a template with placeholders such as `{base_branch}`, `{files}` and `{pr_number}`.
- Output formats: `json`, `delimited` for text blocks, `parser` for everything else.
- `enabled: false` because every Greptile run spends credits.

**Transition:** "One question is left: who gets to add reviewers to your review?"

*Timing: 100 s*
-->
