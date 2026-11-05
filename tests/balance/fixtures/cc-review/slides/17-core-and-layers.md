---
layout: default
---

# One core, three agents, reviewers found at run time

<img src="/images/core-and-layers/diagram-excalidraw.svg" alt="Claude Code, Codex and OpenCode shims delegate to one core; the core discovers reviewers in three layers: project, user, bundled; the higher layer wins by name" class="w-full mt-10" />

<!--
**Goal:** the architecture in one picture: one core, thin shims, reviewers as discovered files.

**Say:**

"How does this run in three different agents without three copies? Each agent gets a thin shim, under 50 lines. It finds the core directory and passes the arguments on, nothing more. All the review logic lives in one place."

"And on the right, where reviewers come from. There's no list in the code. Every run, the core looks in three places: your project, your home directory, and the reviewers that ship with the plugin. If a project has a reviewer called `security`, it replaces the bundled one. Higher layer wins, by name."

**Background:**

- The core holds the commands, the reviewer plugins, the meta-review prompts, the JSON schemas and the scripts.
- Every finding uses one JSON schema, and `severity_map` translates a tool's own severities exactly once, at merge.
- Use the layers like this: project for team rules (checked in), user for personal preferences you want everywhere, bundled as the default.

**If asked:**

- *Why not separate plugins per agent?* Three copies would drift within a week. The shim rule (no logic, under 50 lines) keeps the agent-specific part small enough to review at a glance.

**Transition:** "So adding a reviewer means adding a file."

*Timing: 100 s*
-->
