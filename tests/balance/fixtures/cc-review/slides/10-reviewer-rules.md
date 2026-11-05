---
layout: quote
---

# "Judge what was built, not what was intended."

<div class="mt-10 text-left">

- No praise, no quota: **zero findings is valid**
- Distrust comments and commit messages
- No git log, no plan documents
- Confidence ≥ 70, with file, line, impact, fix

</div>

<!--
**Goal:** the shared preamble, and the failure modes it guards against.

**Say:**

"All prompt reviewers share one preamble, and this sentence is its core: judge what was built, not what was intended."

"Four rules follow from it. One: no praise and no quota. A reviewer that's expected to find something will find something. Zero findings is a valid result, and a good one."

"Two: distrust. Comments, variable names, test names and commit messages can all be wrong. A test called `handles_timeout` proves nothing until you've read its assertions."

"Three: isolation. Reviewers don't see the git log, the plan or the design notes. If they read the intent, they review the intent, and they'll miss where the code doesn't match it."

"Four: every finding needs a confidence of at least 70, a location, the impact and a concrete fix. For Critical findings the bar is 50, because missing a critical bug costs more than one false alarm."

**Background:**

- Each rule targets a known LLM failure: sycophancy (praise, agreeing with the author), anchoring on a plausible story, and filling an implied quota.
- The confidence threshold is configurable; `thorough` raises it to 80.

**If asked:**

- *Isn't isolation throwing away useful context?* Some context is wanted, and it goes through defined channels: Goal Alignment reads the PR description and issues on purpose, and `review-hints.md` gives every reviewer the project knowledge. What's left out is the author's narrative about the change.

**Transition:** "Ten reviewers still produce a lot of findings. Now the panel argues with itself."

*Timing: 90 s*
-->
