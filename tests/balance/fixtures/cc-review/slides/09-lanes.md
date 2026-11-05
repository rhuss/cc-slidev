---
layout: two-cols
---

# Six lanes and four outside voices

<div class="grid grid-cols-2 gap-3 mt-6 pr-6">
  <div class="lane"><carbon-checkmark-outline class="lane-icon" /><span>Correctness</span></div>
  <div class="lane"><carbon-model-alt class="lane-icon" /><span>Architecture</span></div>
  <div class="lane"><carbon-security class="lane-icon" /><span>Security</span></div>
  <div class="lane"><carbon-rocket class="lane-icon" /><span>Production</span></div>
  <div class="lane"><carbon-test-tool class="lane-icon" /><span>Test Quality</span></div>
  <div class="lane"><ph-target class="lane-icon" /><span>Goal Alignment</span></div>
</div>

::right::

<div class="mt-20 p-6 rounded-lg border-2 border-dashed" style="border-color: var(--secondary)">
  <div class="flex items-center gap-2 text-xl font-bold"><carbon-plug /> External</div>
  <div class="mt-3 text-lg">CodeRabbit · Codex</div>
  <div class="text-lg opacity-70">Copilot · Greptile (opt-in)</div>
</div>

<div class="mt-8 text-base opacity-70">Opt-in: Gator, principal-engineer persona from NVIDIA OpenShell</div>

<style>
.lane {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.8rem 1rem;
  border-radius: 0.5rem;
  border: 2px solid var(--primary);
  font-size: 1.2rem;
  font-weight: 600;
}
.lane-icon {
  font-size: 1.6rem;
  color: var(--primary);
  flex-shrink: 0;
}
</style>

<!--
**Goal:** six focused lanes plus external voices; why narrow lanes work better.

**Say:**

"Six built-in reviewers, and each one has exactly one job. Correctness looks for logic errors and edge cases. Architecture checks whether the change fits the code base and the language idioms. Security, Production Readiness, Test Quality. And Goal Alignment reads the PR description and the linked issues and asks: does this change actually deliver what it promises?"

"Each prompt has a section that says: you are not responsible for this, stay in your lane. Sounds trivial, but it keeps the security reviewer from commenting on naming, and it cuts duplicates."

"On the right, the outside voices. CodeRabbit and Codex are on by default. Copilot and Greptile are opt-in, Greptile because every run spends credits. And there's Gator, a principal-engineer reviewer we ported from NVIDIA OpenShell, with a strict evidence rule: a blocking finding has to come with proof."

**Background:**

- A generalist reviewer gravitates to the most visible problems. A narrow brief goes deeper in its area.
- Separate lanes also make quality measurable per reviewer. That's the chart two slides from now.
- Goal Alignment needs a PR. Without one, it's skipped with "requires: pr".

**Transition:** "All of them follow the same rules."

*Timing: 90 s*
-->
