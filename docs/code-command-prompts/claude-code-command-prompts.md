# Claude Code Command Prompts for OrchestratoR™

Use this document as a reusable prompt library when asking Claude Code to make controlled product improvements in the OrchestratoR™ VS Code project.

---

## 1. Standard Product Improvement Prompt

```text
I am working on OrchestratoR™, an AI accessibility co-pilot for developers.

Please make the following product improvement:

CHANGE REQUEST:
[Describe exactly what you want changed]

WHY:
[Explain the user/product reason for the change]

AREA TO UPDATE:
[Name the screen, component, file, or UI area if you know it]

VISUAL REFERENCE:
[Optional: add image path]
Example: docs/visual-reference/figma-exports/right-rail-v2.png

CONSTRAINTS:
- Do not change the accessibility evaluator logic.
- Do not change the scoring logic.
- Do not change the RAG rules.
- Do not change the Pass → Unknown → Fail ordering.
- Do not remove existing accessibility behavior.
- Keep changes focused and minimal.
- Use the existing React/CSS structure unless there is a strong reason not to.

BEFORE EDITING:
1. Review the relevant files.
2. Tell me which files you plan to change.
3. Confirm the change is UI/product only.

AFTER EDITING:
1. Summarize what changed.
2. Tell me how to test it locally.
3. Mention any files changed.
```

---

## 2. Short UI Change Prompt

Use this for small visual changes such as text updates, spacing, labels, button styling, or minor layout refinements.

```text
Please make this focused UI change in OrchestratoR™:

[Describe the change]

Keep it limited to React/CSS only.

Do not change evaluator logic, scoring logic, RAG rules, or Pass → Unknown → Fail ordering.

Before editing, tell me which files you plan to change. After editing, summarize what changed and how I should test it.
```

---

## 3. Figma or Screenshot Reference Prompt

Use this when you export a Figma design, sketch, or screenshot into `docs/visual-reference/`.

```text
I am working on OrchestratoR™, an AI accessibility co-pilot for developers.

Please use this visual reference:
docs/visual-reference/figma-exports/[FILE-NAME].png

Update the current UI to better match this reference.

Focus on:
- layout
- spacing
- typography
- visual hierarchy
- labels
- scanability

Do not change:
- evaluator logic
- scoring logic
- RAG rules
- Pass → Unknown → Fail ordering
- accessibility behavior

Before editing, review the relevant files and tell me what you plan to change. Then make the smallest useful React/CSS updates.
```

---

## 4. Right-Rail Findings List Prompt

```text
I am working on OrchestratoR™, an AI accessibility co-pilot for developers.

Please improve the right-rail findings list.

Goal:
Make the findings easier for developers to scan by improving spacing, hierarchy, labels, and visual grouping. The list should feel cleaner, more enterprise-ready, and easier to review during accessibility testing.

Important constraints:
- Do not change the accessibility evaluator logic.
- Do not change the scoring logic.
- Do not change the RAG rules.
- Keep the Pass → Unknown → Fail ordering.
- Do not remove existing accessibility behavior.
- Keep the React + CSS structure simple and maintainable.
- Make the smallest useful code changes needed.

Please:
1. Review the relevant files first.
2. Explain what files you plan to change.
3. Make the UX/UI improvement.
4. Keep changes focused only on this improvement.
5. After editing, summarize what changed and how I should test it locally.
```

---

## 5. Header / Branding Prompt

```text
Please refine the OrchestratoR™ header branding.

Goal:
Make the header feel clean, professional, and aligned with the product brand while preserving the current layout and subtitle.

Do not change:
- evaluator logic
- scoring logic
- RAG rules
- Pass → Unknown → Fail ordering
- accessibility behavior

Keep the update limited to React/CSS. Before editing, tell me which files you plan to change. After editing, summarize what changed and how I should test it.
```

---

## 6. Health Score Card Prompt

```text
Please improve the OrchestratoR™ health score card UI.

Goal:
Make the score easier to understand at a glance and improve the hierarchy between the score, summary, and Pass / Unknown / Fail counts.

Do not change the scoring formula, evaluator logic, RAG rules, or finding order.

Focus only on:
- layout
- spacing
- labels
- typography
- visual hierarchy
- developer scanability

Before editing, review the relevant files and tell me which files you plan to change. After editing, summarize the change and tell me how to test it locally.
```

---

## 7. Code Panel / Preview Prompt

```text
Please improve the OrchestratoR™ code and preview area.

Goal:
Make it easier for a developer to understand which component is being evaluated and how the code connects to the accessibility findings.

Do not change evaluator logic, scoring logic, RAG rules, or Pass → Unknown → Fail ordering.

Focus only on:
- code panel layout
- preview clarity
- labels
- spacing
- visual connection between code and findings

Before editing, tell me which files you plan to change. After editing, summarize what changed and how I should test it.
```

---

## 8. Safe Workflow Reminder

Use this process for each change:

```text
Prompt Claude Code → Review proposed files → Approve edit → Test in browser → Run git diff → Commit the change
```

Helpful terminal commands:

```bash
git status
git diff
npm run dev
```

Example commit message:

```bash
git add .
git commit -m "Refine OrchestratoR UI"
git push
```

---

## 9. Golden Rule

Only ask Claude Code for one focused change at a time.

Good:

```text
Improve the findings list hierarchy.
```

Avoid:

```text
Redesign the whole app and improve all UX issues.
```

Focused prompts make the project easier to test, debug, commit, and explain in interviews.
