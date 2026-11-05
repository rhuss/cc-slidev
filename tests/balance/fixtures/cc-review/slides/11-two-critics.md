---
layout: two-cols
---

# Two critics check every finding

<img src="/images/two-critics/diagram-excalidraw.svg" alt="Merged findings go to the Skeptic and the Calibrator in parallel; their results merge into one verdict, and the conservative verdict wins on disagreement" class="h-96 mt-4" />

::right::

<div class="mt-20 text-center">
<div class="text-6xl font-bold" style="color: var(--primary)">13%</div>
<div class="mt-2">of findings downgraded<br/>(6 runs, 128 findings)</div>
</div>

<!--
**Goal:** how the critics work, and an honest account of what they do in practice.

**Say:**

"Before anything reaches you, two critics go over every finding, in parallel."

"The Skeptic tries to prove the finding wrong. It reads the code around the cited lines, 20 lines above and below, and starts from the assumption that the reviewer made a mistake. Every finding comes out as confirmed, weak, or false positive."

"The Calibrator asks a different question: is the severity proportional to the evidence? And do two reviewers contradict each other? When the two critics disagree, the more careful verdict wins, and everything is logged with a reason."

"Now the honest part. Over six runs with 128 findings, the Calibrator downgraded 13%, almost never upgraded anything. The Skeptic removed nothing outright. It marked ten findings as weak, and that's it. So in practice you're still the last filter. On OpenShell I held back 29 findings before posting. Making the Skeptic sharper is the next thing I'm working on."

**Background:**

- Meta-review only runs from 5 findings on; below that it's cheaper to read them yourself.
- Why the Skeptic finds so little, most likely: it sees the reviewer's reasoning first and tends to agree with a plausible story. Ideas for fixing that (blind refutation, proof of reachability, a second model from another vendor) are in brainstorm #13.
- The 13% is mostly test-coverage findings going from Important to Minor.

**If asked:**

- *Then why have a Skeptic at all?* The "weak" marks are useful when deciding what to post, and an empty false-positive count is a measurement too. It tells us where the next improvement is.

**Transition:** "The Calibrator does one more thing: it grades the panel."

*Timing: 100 s*
-->
