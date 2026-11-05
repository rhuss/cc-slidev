---
layout: default
---

# Review many PRs at once, and only what changed

```bash
/review --bulk                          # every PR waiting for you
/review --bulk --resume --unattended    # scheduled runs
```

| PR | Findings | Your decision |
|---|---|---|
| #101 | 2 Important | post review |
| #104 | none | post "no findings" |

- Follow-ups: **only the delta**, earlier findings verified

<!--
**Goal:** review at maintainer scale. Optional slide, cut it if time is short.

**Say:**

"If you're a maintainer with a queue of pull requests, `--bulk` reviews all of them in one go. Every PR that asks for your review, plus the ones you reviewed before that got new commits."

"Each PR gets its own worktree and a fresh worker, so one review never influences the next. At the end you get one table and decide per PR: post the review, apply fixes on your own PRs, post a short no-findings note, or skip."

"And follow-up reviews only look at what changed since your last review, and check your earlier findings explicitly. On OpenShell, three follow-ups on the same day ended with 'no outstanding concerns', which is exactly what you want to tell an author quickly."

**Background:**

- `--resume --unattended` is for scheduled runs: it picks up where the last run stopped and doesn't ask questions.
- Follow-up reviews are anchored on your last review that cc-review can verify, never on a guess.

**Transition:** "Every reviewer you saw today was found at run time. One of the places it looks is yours."

*Timing: 80 s*
-->
