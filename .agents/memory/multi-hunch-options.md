---
name: Multi-hunch option preservation
description: Why admin PATCH must upsert questions by ID and not do a full delete+recreate
---

## The rule
When an admin edits a multi-prediction hunch via PATCH `/admin/hunches/:id`, the `questions` update path MUST upsert by existing question ID rather than delete-all + recreate.

**Why:** User predictions create option records in `optionsTable` with `questionId` set. A full delete of `optionsTable WHERE questionId IS NOT NULL` wipes all prediction distribution data. After full replace, `buildHunch()` returns `questions[].options = []` → the `DistributionChart` conditions (`questions.some(q => q.options.length > 0)`) evaluate to false → charts disappear for closed/resolved hunches.

**How to apply:**
- On PATCH, fetch existing `hunchQuestionsTable` rows for the hunch.
- Questions with a matching `id` in the request body → UPDATE in place (preserves `questionId` on existing options).
- For `answerType === "option"` questions being updated → safe to delete+recreate only their predefined options.
- For non-option types (time, integer, decimal, free-text) → NEVER delete question-linked options (they are user-generated prediction data).
- Questions absent from the new list → delete them and their options.
- Questions with no `id` in body → INSERT as new.

The hunch-form.tsx ALWAYS sends `questions` in the PATCH body when `isMulti=true`, so this path runs on every admin save (including resolving a hunch).
