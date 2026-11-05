---
layout: default
---

# Two commands to install

```bash
/plugin marketplace add rhuss/cc-rhuss-marketplace
/plugin install cc-review@cc-rhuss-marketplace
```

- **Codex**: `codex plugin install` from a clone
- **OpenCode**: `review/opencode/install.sh`
- Needs `jq`, `yq`, `gh`, Python 3.9+

<!--
**Goal:** installing takes a minute; external tools are optional.

**Say:**

"In Claude Code it's two commands: add the marketplace, install the plugin. For Codex and OpenCode, you clone the repository and run one install step."

"You need `jq`, `yq`, `gh` and Python 3.9 or newer. That's it."

"CodeRabbit, Codex, Copilot, Greptile are all optional. If a tool is installed and logged in, it joins the panel. If not, it's skipped with a reason. You can start with no external tools at all and still get six reviewers."

**Background:**

- One plugin directory carries native manifests for all three agents; each reads its own and ignores the others. They all use the same core, so a reviewer you write works everywhere.
- Codex: `codex plugin marketplace add /path/to/cc-review`, then `codex plugin install cc-review@cc-review-plugin-development`.
- OpenCode: `review/opencode/install.sh --project-dir .` copies the commands into `.opencode/plugins/cc-review/`.
- `/cc-review:init` writes a config file and lists the discovered reviewers. Optional, but a good first step.

**Transition:** "Once it's installed, there are three ways to start."

*Timing: 90 s*
-->
