---
layout: default
---

# Backup: config resolution and key flags

**CLI** › `--config` › `--profile` › project › user › defaults

```bash
--pr <n>  --full  --spec <file>  --profile <name>
--only a,b  --no-<name>  --no-external  --no-fix
--max-rounds <n>  --no-meta-review  --bulk  --resume
```

<!--
**Use when:** someone asks about configuration or a specific flag.

**Say:**

"Settings resolve from most specific to least: command-line flags, then an explicit config file, then the profile, then the project config, then your user config, then the defaults."

**Background:**

- Project config: `.cc-review/config.yml`; user config: `~/.cc-review/config.yml`.
- `--only` never overrides preconditions or tool detection: a reviewer that needs a PR still won't run without one.
- Full reference: README sections "All review flags" and "All triage flags".
-->
