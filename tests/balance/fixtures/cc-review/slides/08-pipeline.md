---
layout: default
---

# What is running right now

```mermaid
flowchart LR
  D[Discover<br/>reviewers] --> P[Dispatch<br/>in parallel]
  P --> M[Merge &<br/>dedup]
  M --> V[Meta-review]
  V --> G[Gate &<br/>fix loop]
  G --> R[Report]
```

<v-clicks>

- **Discover**: no hard-coded list
- **Dispatch**: subagents and CLIs together
- **Merge**: same spot, same category, one finding

</v-clicks>

<!--
**Goal:** the centerpiece. Everyone understands the six steps.

**Say:**

"This is the pipeline behind the review that's running right now. Six steps, and I'll go through the first three."

*(click)* "Discover. There is no hard-coded list of reviewers. Every run, cc-review looks for reviewer files and then filters them: by your config, by your flags, and by whether the tools are installed and logged in."

*(click)* "Dispatch. All reviewers start at the same time. The prompt reviewers run as subagents, each with a fresh context. The external tools run as command-line processes with a timeout. Since everything runs in parallel, you wait for the slowest reviewer, not for the sum of all."

*(click)* "Merge. Different reviewers often find the same problem. When two findings point to the same file, overlapping lines and the same category, they become one finding. The stronger one stays, and the other reviewers are noted as also reporting it. Three reviewers agreeing on one line is worth more than one."

"Meta-review, the gate and the fix loop are the next section."

**Background:**

- Fresh context per subagent: no reviewer sees what another one found. Independence is the whole point of a panel; a reviewer that has read the others' findings tends to agree with them.
- Every finding is normalized into one schema (backup slide), so findings from a prompt and from CodeRabbit can be compared and merged.
- Take your time here: 2 to 3 minutes.

**Transition:** "Let's meet the panel."

*Timing: 150 s*
-->
