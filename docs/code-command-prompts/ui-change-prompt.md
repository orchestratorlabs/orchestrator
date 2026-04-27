# OrchestratoR™ UI Change Prompt

Use this shorter prompt when asking Claude Code to make a focused UI-only change.

```text
Please make this focused UI change in OrchestratoR™:

[Describe the change]

Keep it limited to React/CSS only.

Do not change evaluator logic, scoring logic, RAG rules, or Pass → Unknown → Fail ordering.

Before editing, tell me which files you plan to change. After editing, summarize what changed and how I should test it.
```

## Example

```text
Please make this focused UI change in OrchestratoR™:

Improve the spacing and visual hierarchy in the right-rail findings list so developers can scan Pass, Unknown, and Fail items more easily.

Keep it limited to React/CSS only.

Do not change evaluator logic, scoring logic, RAG rules, or Pass → Unknown → Fail ordering.

Before editing, tell me which files you plan to change. After editing, summarize what changed and how I should test it.
```
