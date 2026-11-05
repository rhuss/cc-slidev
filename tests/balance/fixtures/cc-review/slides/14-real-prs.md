---
layout: default
---

# On real PRs, two thirds of the findings get fixed

<div class="grid grid-cols-3 gap-6 mt-6 text-center">
<div><div class="text-5xl font-bold" style="color: var(--primary)">208</div>findings, 20 PRs</div>
<div><div class="text-5xl font-bold" style="color: var(--primary)">64%</div>addressed</div>
<div><div class="text-5xl font-bold" style="color: var(--secondary)">2%</div>withdrawn or rejected</div>
</div>

- Double percent-decoding of headers (Codex, #5082)
- Credentials in startup log (security, #5083)
- Trace ID mismatch CodeRabbit missed (gator, #4789)

<div class="text-sm opacity-70 mt-4">NVIDIA/OpenShell, 30 cc-review reviews · Important findings: 87% addressed</div>

<!--
**Goal:** real-world evidence from an active open-source project.

**Say:**

"For the last weeks I used cc-review for my reviews on NVIDIA OpenShell. 30 reviews on 20 pull requests, 208 inline findings."

"64% of them were addressed: fixed and verified, fixed according to the author, or the code under the comment changed. For Important findings, it's 87%. Only 2% were withdrawn by me or rejected by the author."

"Three examples. Codex found headers that were percent-decoded twice. The security reviewer found a startup log line that could print a credential. And Gator found a trace ID mismatch that CodeRabbit didn't report in the same run."

**Background:**

- Most of the unanswered findings are from last week's reviews. Leaving those out: 73% addressed, 82% addressed or moved to a follow-up issue.
- Not directly comparable with the 56% rejection rate from slide 3: different method, one reviewer, one project. "Outdated" threads were counted as addressed.
- Details: #5082 OTLP headers decoded twice (regression test with `abc%252F`); #5083 a malformed `headers_file` line would print the credential to the gateway log; #4789 a deny event and its paired finding got different trace IDs.

**If asked:**

- *Selection bias, since you're a maintainer?* Partly, authors listen to maintainers. That's why the rejected and withdrawn number matters more than the addressed one.

**Transition:** "A review is one moment in a PR's life. Here's what comes before and after."

*Timing: 100 s*
-->
