---
layout: center
class: text-center
---

# Most AI review comments get ignored

<div class="grid grid-cols-2 gap-12 mt-10">
<div>
<div class="text-6xl font-bold" style="color: var(--secondary)">56%</div>
<div class="mt-2">of CodeRabbit suggestions rejected</div>
</div>
<div>
<div class="text-6xl font-bold" style="color: var(--primary)">1-19%</div>
<div class="mt-2">of AI comments addressed<br/>(humans: ~60%)</div>
</div>
</div>

<div class="mt-12 text-sm opacity-70">
arXiv 2607.03316 (31k reviews, 239 repos) · arXiv 2508.18771 (16 tools, 178 repos, ~22k comments)
</div>

<!--
**Goal:** the problem is trust, not capability. AI review findings get ignored because too many are wrong.

**Say:**

"Let's start with two numbers. A field study looked at 31,000 CodeRabbit reviews in 239 repositories. 56% of the suggestions were rejected, and the main reason was false positives."

"A second study compared 16 AI review GitHub Actions. Depending on the tool, between 1 and 19 percent of the AI comments led to a change. For comments written by humans, it's around 60%."

"So the models can find bugs. The problem is that every finding costs attention, and when half of them are wrong, people stop reading all of them, also the good ones."

**Background:**

- This is alarm fatigue, the same effect as with noisy monitoring: once the false alarm rate is high, real alarms get ignored too.
- The second study also found that more comments per PR means lower relevance per comment. Volume is not quality.
- Consequence for the design of cc-review: the number that matters is precision, the share of findings worth acting on. Everything in this talk is about raising that number.
- Sources: arXiv 2607.03316 (CodeRabbit field study, 31,073 reviews), arXiv 2508.18771 (16 tools, 178 repositories, about 22,000 comments).
- The 0.9% to 19.2% range counts only comments the authors judged valid. Low end: code-review-gpt (file-level); high end: CodeRabbit's ai-pr-reviewer (hunk-level). Hunk-level tools 6.5% to 19.2%, file-level tools 0.9% to 4.2%. Human comments: about 60%.

**If asked:**

- *So CodeRabbit is bad?* No, it's one of the reviewers in the panel. It's simply the most used tool, so it's the best studied. These numbers describe any single tool used alone.

**Transition:** "So the question is not whether AI can review. It's how to make its findings worth reading."

*Timing: 90 s*
-->
