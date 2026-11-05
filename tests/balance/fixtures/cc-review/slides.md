---
theme: seriph
highlighter: shiki
lineNumbers: false
transition: fade
title: "cc-review: many reviewers, one verdict (frozen test fixture)"
mdc: true
layout: cover
background: ''
class: text-center
---

# cc-review

## Many reviewers, one verdict

Multi-agent code review for Claude Code, Codex and OpenCode

Roland Huß

<!-- TODO: Add AI-generated cover image
See ai-image-prompts.md for prompts
Filename: public/images/cover-convergence.png, then set `background:` above
-->

<!--
PRESENTER NOTES:
- Session format: kick off a live review now, slides while it runs, results and more commands afterwards.
-->

<style>
/* Accessibility overrides for seriph theme: 18pt+ body, 24pt+ headings */
h1 { font-size: 3rem; }
h2 { font-size: 2rem; }
h3 { font-size: 1.5rem; }
p, li { font-size: 1.25rem; }
td, th { font-size: 1.1rem; }

/* Colorblind-safe palette: Blue + Orange */
:root {
  --primary: #3b82f6;
  --secondary: #f97316;
  --neutral: #6b7280;
  --text: #1f2937;
}
</style>


---
src: ./slides/02-review-kickoff.md
---
<!-- Slide 2: A review starts now and finishes during the talk -->

---
src: ./slides/03-ignored-comments.md
---
<!-- Slide 3: Most AI review comments get ignored -->

---
src: ./slides/04-panel-argues.md
---
<!-- Slide 4: cc-review runs a panel, then makes it argue -->

---
src: ./slides/05-five-commands.md
---
<!-- Slide 5: Five commands cover a PR's whole life -->

---
src: ./slides/06-install.md
---
<!-- Slide 6: Two commands to install -->

---
src: ./slides/07-first-review.md
---
<!-- Slide 7: Three ways to run your first review -->

---
src: ./slides/08-pipeline.md
---
<!-- Slide 8: What is running right now -->

---
src: ./slides/09-lanes.md
---
<!-- Slide 9: Six lanes and four outside voices -->

---
src: ./slides/10-reviewer-rules.md
---
<!-- Slide 10: Judge what was built, not what was intended. -->

---
src: ./slides/11-two-critics.md
---
<!-- Slide 11: Two critics check every finding -->

---
src: ./slides/12-agent-precision.md
---
<!-- Slide 12: The panel grades itself on every run -->

---
src: ./slides/13-fix-loop.md
---
<!-- Slide 13: On your own code: fix, test, re-review -->

---
src: ./slides/14-real-prs.md
---
<!-- Slide 14: On real PRs, two thirds of the findings get fixed -->

---
src: ./slides/15-triage-inbox-issue.md
---
<!-- Slide 15: Triage, inbox and issue handle the rest -->

---
src: ./slides/16-bulk-followups.md
---
<!-- Slide 16: Review many PRs at once, and only what changed -->

---
src: ./slides/17-core-and-layers.md
---
<!-- Slide 17: One core, three agents, reviewers found at run time -->

---
src: ./slides/18-reviewer-file.md
---
<!-- Slide 18: A reviewer is one Markdown file -->

---
src: ./slides/19-command-reviewer.md
---
<!-- Slide 19: Wrapping an external tool takes a frontmatter block -->

---
src: ./slides/20-trust.md
---
<!-- Slide 20: Project reviewers run only after you trust them -->

---
src: ./slides/21-takeaways.md
---
<!-- Slide 21: Three takeaways -->

---
src: ./slides/22-try-it.md
---
<!-- Slide 22: Try it this week -->

<!-- ===== Backup slides ===== -->

---
src: ./slides/23-backup-landscape.md
---
<!-- Slide 23: Backup: most review tools are one vendor's single opinion -->

---
src: ./slides/24-backup-research.md
---
<!-- Slide 24: Backup: multi-pass review with verification is the industry pattern -->

---
src: ./slides/25-backup-finding-schema.md
---
<!-- Slide 25: Backup: every finding follows one schema -->

---
src: ./slides/26-backup-config-flags.md
---
<!-- Slide 26: Backup: config resolution and key flags -->

---
src: ./slides/27-backup-cost.md
---
<!-- Slide 27: Backup: cost scales with the panel you choose -->
