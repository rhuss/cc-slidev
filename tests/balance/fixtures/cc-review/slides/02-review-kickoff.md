---
layout: default
---

# A review starts now and finishes during the talk

```bash
/review --pr <n> --profile thorough
```

- Every reviewer is listed, skipped ones too
- One row per reviewer: found, fixed, open
- Results arrive in about 30 minutes

<!--
**Goal:** the review is running, and everyone knows when the results come.

**Say:**

"Before I explain anything, let me give the panel some work. This is a real pull request, and I'm starting a thorough review on it right now."

*(switch to the terminal, run the command, wait until the reviewer list appears)*

"You see every reviewer cc-review found for this run, also the ones that won't run, each with a reason. Nothing is left out silently. If a tool isn't logged in, you see that here, instead of wondering later why it was so quiet."

"At the end you'll get a table like the one on the slide: one row per reviewer, what it found, what got fixed, what's still open. These numbers are made up. The real ones come in about 30 minutes."

**Background:**

- `thorough` is the biggest profile: all six built-in reviewers plus CodeRabbit, Codex, Copilot and Greptile, a confidence threshold of 80 instead of 70, and more fix rounds. Good for a demo, too expensive for every push.
- Gate PASS means no finding at a blocking severity is left. In `thorough`, Minor findings also block, so what remains is Notable observations.
- The review runs on its own in that terminal. I don't touch it until minute 35.

**If asked:**

- *Why not wait for it?* A thorough run with fix rounds takes 15 to 30 minutes. That's the honest cost of a full panel, and the reason `quick` exists.

**Transition:** "While the panel works, let's look at why we need a panel at all."

*Timing: part of the 5 minute kickoff*
-->
