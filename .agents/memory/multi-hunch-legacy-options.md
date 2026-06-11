---
name: Multi-hunch legacy options
description: Why multi-prediction hunches may have options with questionId=null and how to handle them.
---

Before the per-question multi-predict endpoint was finalized, some participants submitted
predictions via the single-question path. Those submissions created option rows in the
`options` table with `questionId = null` (hunch-level, not per-question).

`buildHunch()` originally returned `options: isMulti ? [] : allOptions.map(...)` — this
silently discarded all null-questionId options for multi hunches, making charts invisible.

**Fix applied:** Change to `allOptions.filter(o => o.questionId === null).map(...)` so
null-questionId options are returned in the top-level `options` field for multi hunches.

**Frontend fallback:** When `isMulti && !questions.some(q => q.options.length > 0) && hunch.options.length > 0`,
render a single combined DistributionChart with `answerType="text"` using `hunch.options`.
This covers legacy combined predictions (e.g. "5 | 40%") while the per-question path
handles new submissions correctly.

**Why:** Deleting null-questionId options or breaking the FK constraint would lose historical
distribution data. The fallback chart preserves visibility into what the community predicted.

**How to apply:** Any query on options for multi hunches should account for both:
- `questionId = q.id` → new per-question predictions
- `questionId = null` → legacy combined predictions at hunch level
