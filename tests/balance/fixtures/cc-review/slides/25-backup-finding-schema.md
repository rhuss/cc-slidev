---
layout: default
---

# Backup: every finding follows one schema

```json
{
  "id": "FINDING-8", "severity": "Important", "confidence": 95,
  "file": "review/core/scripts/inbox.py", "line_start": 290,
  "category": "correctness", "source_agent": "correctness",
  "also_reported_by": [], "verdict": "confirmed"
}
```

- Severities: Critical · Important · Minor · Notable
- `severity_map` applied once, at merge

<!--
**Use when:** someone asks how findings from different tools can be merged.

**Say:**

"Every finding, whether it comes from a prompt reviewer or from CodeRabbit, ends up in this one shape: severity, confidence, file and line, category, who reported it, and the critics' verdict. That's what makes dedup and meta-review possible across vendors."

**Background:**

- Schema: `core/schemas/finding.schema.json`. Prompt reviewer output is normalized; command reviewer output is parsed according to its declared format.
- A native severity that's missing from `severity_map` is dropped with a warning that names the reviewer, so a misconfigured tool can't sneak findings in with the wrong severity.
-->
