# OrchestratoR Documentation Index

This folder contains the product, evaluation, and interface specifications for the Orchestrator MVP.

## Recommended Reading Order

1. [orchestrator_rag_registry.txt](orchestrator_rag_registry.txt) — Registry/index that maps component types to their RAG files. Start here to understand how evaluation is routed.
2. [orchestrator_button_health_score_rag.txt](orchestrator_button_health_score_rag.txt) — Component-specific rule source of truth for React button accessibility evaluation. The primary grounding document for the MVP evaluator.
3. [mvp_scoring_policy.md](mvp_scoring_policy.md) — Defines the scoring formula, Unknown handling, and canonical findings ordering.
4. [orchestrator_prompt_template.md](orchestrator_prompt_template.md) — System and user prompt templates for the accessibility evaluator, including output structure and guardrails.
5. [orchestrator_wireframe_spec.md](orchestrator_wireframe_spec.md) — UI wireframe specification for the right-side copilot panel and overall application layout.

## RAG Files

| File | Role |
|---|---|
| `orchestrator_rag_registry.txt` | Registry that routes component type to the correct RAG file |
| `orchestrator_button_health_score_rag.txt` | Accessibility rules for React button evaluation |

## Canonical Findings Ordering

Across all Orchestrator documentation, findings are ordered:

1. **Pass** — verified and compliant
2. **Unknown** — not enough evidence to verify
3. **Fail** — verified and not compliant
