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

## Findings Ordering Policy (MVP)
Required display order:
1. Pass
2. Unknown
3. Fail

Within each status group, preserve source rule order from RAG/registry when possible.

## Guardrails
- Do not invent hidden or complex weights.
- Do not treat Unknown as Pass or Fail.
- Do not mark Pass without evidence.
