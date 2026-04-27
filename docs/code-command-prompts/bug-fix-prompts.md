# Bug Fix Prompt — OrchestratoR™

Use this when asking Claude Code to fix a bug without changing unrelated product logic or UI behavior.

```text
Please fix this bug in OrchestratoR™:

BUG:
[Describe what is broken]

EXPECTED BEHAVIOR:
[Describe what should happen]

CURRENT BEHAVIOR:
[Describe what is happening instead]

WHERE I SEE IT:
[Optional: screen, component, file, browser state, or screenshot path]
Example: docs/visual-reference/screenshots/focus-ring-issue.png

CONSTRAINTS:
- Do not change evaluator logic unless the bug is directly inside the evaluator.
- Do not change scoring logic unless the bug is directly related to scoring.
- Do not change RAG rules.
- Do not change the Pass → Unknown → Fail ordering.
- Do not redesign unrelated UI.
- Keep the fix small and focused.

BEFORE EDITING:
1. Review the relevant files.
2. Tell me which files you plan to change.
3. Explain the likely cause of the bug.

AFTER EDITING:
1. Summarize what changed.
2. Tell me how to test the fix locally.
3. Mention any files changed.
```
