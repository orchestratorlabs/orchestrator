# Claude Code Prompt Library — OrchestratoR™

This folder contains reusable Claude Code prompt templates for the OrchestratoR™ project.

The goal is to make AI-assisted coding more controlled, repeatable, and product-focused. These prompts help Product, UX, and Engineering make focused requests while protecting the core accessibility evaluation logic that powers OrchestratoR™.

## Why this prompt library exists

These templates help the team:

- Make focused change requests
- Avoid accidental changes to evaluator logic
- Protect the RAG rules and scoring logic
- Keep UI changes separate from bug fixes
- Create cleaner Git commits
- Make Claude Code easier to control, review, and approve

Instead of asking Claude Code open-ended questions, these templates give it clear boundaries, product goals, and review steps.

## How to use these prompts

1. Open the prompt template that matches the type of work you want to do.
2. Copy the template into Claude Code.
3. Replace the bracketed placeholders with your specific request.
4. Add any relevant file paths, screenshots, or Figma exports.
5. Review Claude Code’s proposed files before approving edits.
6. Test locally.
7. Review the diff.
8. Commit the change with a clear message.

Recommended workflow:

```text
Prompt Claude Code → Review proposed files → Approve edit → Test locally → Run git diff → Commit → Push
```

## Current prompt templates

### `claude-code-command-prompts.md`

A general-purpose product improvement prompt for OrchestratoR™.

Use this when the request involves a broader product improvement and you want Claude Code to review context before editing.

Best for:

- Product refinements
- UX improvements
- Larger UI changes
- Controlled feature iteration

---

### `ui-change-prompt.md`

A shorter prompt for focused UI changes.

Use this when you know the change is small and should stay limited to React/CSS.

Best for:

- Header updates
- Label changes
- Spacing adjustments
- Visual polish
- Right-rail UI tweaks

---

### `bug-fix-prompts.md`

A prompt for fixing bugs without redesigning unrelated areas.

Use this when something is broken and you want Claude Code to identify the likely cause, propose changed files, and keep the fix focused.

Best for:

- Broken UI behavior
- Incorrect labels
- Preview issues
- Focus state bugs
- Styling bugs
- Unexpected component behavior

---

### `git-commit-prompts.md`

A prompt for reviewing current changes and preparing a clean Git commit.

Use this after a change is complete and tested.

Best for:

- Reviewing changed files
- Summarizing what changed
- Catching unrelated edits
- Writing clear commit messages
- Getting the correct Git commands

## Recommended future prompt templates

The following templates can be added as the project grows.

### `accessibility-review-prompt.md`

Use this when asking Claude Code to review a component or UI state for accessibility concerns.

Suggested purpose:

- Check keyboard access
- Review focus states
- Review text and non-text contrast
- Check accessible names
- Confirm ARIA usage
- Identify likely WCAG issues

Important constraint:

```text
Do not invent accessibility rules. Use only the project RAG, registry, and existing evaluator scope.
```

---

### `figma-to-code-prompt.md`

Use this when translating a Figma export, screenshot, or sketch into a UI update.

Suggested purpose:

- Compare a visual reference against the current implementation
- Update layout, spacing, typography, and hierarchy
- Keep React/CSS changes focused
- Preserve accessibility behavior and evaluator logic

Example visual reference path:

```text
docs/visual-reference/figma-exports/right-rail-v2.png
```

---

### `right-rail-ui-prompt.md`

Use this for improvements specifically related to the OrchestratoR™ right-side copilot rail.

Suggested purpose:

- Improve scanability
- Refine the findings list
- Improve the Health Score area
- Clarify Pass / Unknown / Fail states
- Improve developer review flow
- Improve tab, card, or panel hierarchy

Core constraint:

```text
Do not change the Pass → Unknown → Fail ordering.
```

---

### `component-expansion-prompt.md`

Use this when expanding OrchestratoR™ beyond the current MVP button scope.

Suggested purpose:

- Plan support for a new component type
- Identify needed RAG updates
- Identify needed registry updates
- Define evaluator requirements
- Keep the new component scope separate from existing button logic

Example future components:

- Card
- Modal
- Form input
- Checkbox
- Navigation item
- Data table

Important constraint:

```text
Do not mix new component rules into the button evaluator unless explicitly requested.
```

---

### `research-feedback-to-ui-prompt.md`

Use this after user research, SME feedback, or developer feedback sessions.

Suggested purpose:

- Convert feedback into prioritized UI changes
- Separate observations from recommendations
- Identify quick wins versus larger design changes
- Update the UI without overreacting to one participant comment

Helpful structure:

```text
Research insight → Product implication → Suggested UI change → Files likely affected
```

---

### `release-notes-prompt.md`

Use this when documenting what changed after a set of commits or feature updates.

Suggested purpose:

- Summarize product improvements
- Explain bug fixes
- Document known limitations
- Prepare stakeholder updates
- Create short release notes for the README or project updates

Best for:

- Portfolio documentation
- Product team updates
- Sprint summaries
- GitHub release notes

## Suggested folder structure

```text
docs/
  code-command-prompts/
    README.md
    claude-code-command-prompts.md
    ui-change-prompt.md
    bug-fix-prompts.md
    git-commit-prompts.md
    accessibility-review-prompt.md
    figma-to-code-prompt.md
    right-rail-ui-prompt.md
    component-expansion-prompt.md
    research-feedback-to-ui-prompt.md
    release-notes-prompt.md
```

## Guardrails for all OrchestratoR™ Claude Code prompts

Use these guardrails when writing any new prompt template:

```text
- Do not change evaluator logic unless explicitly requested.
- Do not change scoring logic unless explicitly requested.
- Do not change RAG rules unless explicitly requested.
- Do not change the Pass → Unknown → Fail ordering.
- Do not remove existing accessibility behavior.
- Keep changes focused and reviewable.
- Explain which files will change before editing.
- Summarize what changed after editing.
- Explain how to test locally.
```

## Why this matters

OrchestratoR™ is not just a UI prototype. It is an AI accessibility product with rules, scoring, evidence, and trust boundaries.

This prompt library helps keep AI-assisted coding aligned with the product strategy:

```text
Focused prompts → safer edits → cleaner diffs → easier reviews → stronger product quality
```

It also gives the team a shared language for working with Claude Code, making the workflow easier to teach, repeat, and scale.
