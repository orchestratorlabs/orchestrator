# ARIA Score Reference

## Purpose

This file documents the current proposed ARIA scoring logic for OrchestratoR.

It is intended as a reference for:
- Accessibility SME review
- Claude Code implementation
- OrchestratoR deterministic scoring decisions
- Future Design System component expansion

---

## Proposed ARIA Scoring Rule

Outcomes apply the same way to every rule:

| Result | Score Impact | Meaning |
|---|---:|---|
| **N/A — Not Applicable** | **0 points** | The check is not required for this specific component or use case. |
| **Pass** | **0 points** | The check applies and the required implementation is correct. |
| **Fail** | **The deduction of the rule that failed** | The check applies, but the required implementation is missing, incorrect, or invalid. |

The deduction on a Fail belongs to the **rule**, not to the word "ARIA". Two rules are involved for the Button:

| Rule | Question it answers | Fail deduction | Severity | Status |
|---|---|---:|---|---|
| **Rule 2 — Accessible Name** | Does the button have a programmatically determinable name (visible text, `aria-label`, `aria-labelledby`)? | **-25** | Critical | Established in RAG v3 and the evaluator. Unchanged. |
| **Rule 10 — ARIA Semantics** | Is the button role exposed to assistive technology on a non-native element (`role="button"`)? | **-10** | Critical | **PROVISIONAL** — pending Accessibility SME review. Not yet implemented in the evaluator. |

Rule 2 and Rule 10 are kept separate. A missing accessible name is a Rule 2 failure at -25. It is **not** reclassified as a -10 ARIA failure.

---

## Important Distinction

**N/A does not mean “no ARIA was found.”**

N/A means:

> ARIA is not required for this specific component, behavior, or use case.

The evaluator must first determine whether ARIA is actually applicable before assigning Pass, Fail, or N/A.

---

## Current Button Thin-Slice Example

The current OrchestratoR Button POC uses a native button with visible text and does not contain an icon-only state.

Example:

```html
<button>Submit</button>
```

Because native HTML semantics and visible text already provide the required button role and accessible name:

- Do not add redundant ARIA.
- Do not penalize the Button for not having an `aria-label`.
- Rule 2 (Accessible Name) stays **Pass**. Rule 2 itself is not changed to N/A.
- The icon-specific sub-check is recorded **in Rule 2's evidence** as **N/A — Not Applicable**, because this Button has no icon-only state. It does not create a separate rule card.
- **N/A causes no score deduction.**
- Rule 10 (ARIA Semantics) is **N/A** for a native `<button>`, because its role is implicit.

```text
Visible-text Button
→ Rule 2 Accessible Name = PASS
→ Icon-specific evidence = N/A
→ No score deduction
```

For a future icon-only Button, the accessible-name outcome belongs to **Rule 2**:

```text
Icon-only Button + valid accessible name
→ Rule 2 = PASS
→ 0 deduction

Icon-only Button + no accessible name
→ Rule 2 = FAIL
→ -25 deduction (Critical)
```

A missing accessible name is never scored at -10. The -10 applies only to Rule 10 (a non-native element used as a button without `role="button"`).

---

## Deterministic Logic

The ARIA score must be determined by predefined rules, not by an LLM guessing whether the component is accessible.

Conceptually:

```text
Does this component/use case require the check?
        |
        +-- No  → N/A  → 0 deduction
        |
        +-- Yes
             |
             +-- Correct implementation → Pass → 0 deduction
             |
             +-- Missing/incorrect implementation → Fail → that rule's deduction
                    Rule 2 (Accessible Name)  → -25
                    Rule 10 (ARIA Semantics)  → -10 (PROVISIONAL)

If the evaluator cannot determine whether the check applies → Unknown
(not N/A, and not Pass).
```

---

## Component-Specific Rule Principle

ARIA requirements must be determined separately for each Design System component based on:

**Component Type → Semantic Role → Behavior → Interaction States → Accessibility Requirements → Deterministic Rules**

Examples:

### Button
Potential considerations:
- Native button semantics
- Accessible name
- Icon-only accessible name
- Keyboard activation
- Disabled behavior
- State coverage

### Card
ARIA requirements depend on the Card's actual behavior.

A presentational Card may require no ARIA.

An interactive Card may require additional semantic and accessible-name checks depending on its links, buttons, headings, selection behavior, or other controls.

### Modal / Dialog
Potential considerations:
- Dialog semantics
- Accessible dialog name
- `aria-modal`, when appropriate
- Focus entry
- Focus containment
- Escape behavior
- Focus restoration
- Background interaction handling
- Relationships between title, description, and dialog

---

## SME Review Status

**Current proposed Rule 10 (ARIA Semantics) Fail deduction: -10 points**

Status:

**PROVISIONAL — Requires Accessibility SME review/approval before being treated as the final production scoring weight.**

The Rule 2 (Accessible Name) deduction of **-25** is established in RAG v3 and is not part of this provisional value.

The SME team should confirm:

1. Whether -10 is an appropriate severity weighting for Rule 10.
2. Whether some ARIA failures should carry different deductions based on severity.
3. Which ARIA requirements apply to each Design System component.
4. Which conditions should produce Pass, Fail, Unknown, or N/A.

---

## OrchestratoR Principle

OrchestratoR should not assume every component requires ARIA.

Use native HTML semantics first.

ARIA should be evaluated only when it is required to supplement or communicate semantics, state, relationships, or behavior that native HTML does not already provide.

The deterministic evaluator should therefore distinguish between:

**ARIA not required** → N/A

and

**ARIA required but incorrect/missing** → Fail (at the failing rule's own deduction)

This distinction protects the accuracy of the OrchestratoR Health Score and prevents unnecessary ARIA from being rewarded.
