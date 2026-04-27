# Git Commit Prompt — OrchestratoR™

Use this when asking Claude Code to help review changes and prepare a clean commit message.

```text
Please review my current OrchestratoR™ changes and help me prepare a clean Git commit.

TASK:
Review the current changes and summarize what was updated.

PLEASE DO:
1. Check the changed files.
2. Summarize the changes in plain English.
3. Flag anything risky or unrelated.
4. Suggest a clear commit message.
5. Give me the exact Git commands to run.

CONSTRAINTS:
- Do not edit files unless I explicitly ask.
- Do not change evaluator logic.
- Do not change scoring logic.
- Do not change RAG rules.
- Do not change the Pass → Unknown → Fail ordering.
- Keep the commit message short and specific.

PREFERRED COMMIT MESSAGE STYLE:
Use an action-based message, for example:
- Refine OrchestratoR header branding
- Improve right-rail findings layout
- Fix focus indicator contrast label
- Add visual reference folder structure
- Document Claude Code prompt workflow

GIT COMMANDS FORMAT:
Please give commands like this:

git status
git diff
git add .
git commit -m "[Suggested commit message]"
git push
```
