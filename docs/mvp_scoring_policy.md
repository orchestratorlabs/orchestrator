# mvp_scoring_policy.md

## Purpose
Define explicit, transparent MVP scoring logic before evaluator implementation.

## Source-of-Truth Policy
- If RAG/registry defines scoring weights, use those exact weights.
- If RAG/registry does not define weights, use the fallback below and label it clearly as MVP scoring logic.

## MVP Fallback Scoring Logic (Transparent)
- Label: **MVP Simple Transparent Scoring**
- Formula: `score = round((passCount / (passCount + failCount)) * 100)`
- Unknown handling: Unknown is surfaced separately and excluded from pass/fail denominator.
- Edge case: if `passCount + failCount = 0`, return score `0` and mark evaluation as evidence-limited.
- Not Applicable handling: Not Applicable is excluded from both the numerator and the denominator, and carries no RAG deduction. It never raises or lowers the score. It is surfaced separately, like Unknown.

## ARIA Scoring
ARIA scoring behavior is defined in [ARIA-Score/ARIA_Score.md](ARIA-Score/ARIA_Score.md), which is the current source of truth for it. In short: ARIA not applicable is N/A with 0 points deducted, ARIA applies and passes is Pass with 0 deducted, and ARIA applies and fails is Fail with -10. The -10 is **PROVISIONAL** until Accessibility SME approval.

## Not Applicable vs Unknown
- **Not Applicable** = the rule verifiably does not apply to this component (for example, the ARIA role rule on a native `<button>`).
- **Unknown** = there is not enough evidence to decide.
- Not Applicable may only be returned when the evaluator has positively checked for the thing that would make the rule apply and found none. If it finds a candidate it cannot classify, it returns Unknown.
- Not Applicable is determined by predefined evaluator logic only. The AI layer must not assign it and must not override it.

## Findings Ordering Policy (MVP)
This is the canonical findings ordering across all Orchestrator documentation.

Required display order:
1. Pass
2. Not Applicable
3. Unknown
4. Fail

Not Applicable sits after Pass because it is informational, and before Unknown and Fail so that Fail stays last.

Within each status group, preserve source rule order from RAG/registry when possible.

## Guardrails
- Do not invent hidden or complex weights.
- Do not treat Unknown as Pass or Fail.
- Do not mark Pass without evidence.
