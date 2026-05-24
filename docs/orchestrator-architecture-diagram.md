# OrchestratoR™ — MVP Architecture Diagram

```mermaid
%%{init: {'theme': 'default', 'themeVariables': {'fontSize': '16px'}}}%%
flowchart TD

  subgraph FE["① Frontend Experience — React · TypeScript · Vite"]
    FE_UI["Live Component Preview<br/>Light / Dark · Button State Selector"]
    FE_CHECK["Run Accessibility Check"]
    FE_DC["Run A11Y DoubleCheck"]
    FE_UI --> FE_CHECK --> FE_DC
  end

  subgraph EVAL["② Accessibility Evaluation"]
    EVAL_ENGINE["Button Evaluator Logic"]
    EVAL_CHECKS["Design Token Checks<br/>WCAG · Contrast · State Validation"]
    EVAL_SCORE["Accessibility Health Score"]
    EVAL_ENGINE --> EVAL_CHECKS --> EVAL_SCORE
  end

  subgraph BE["③ Backend + RAG — Flask"]
    BE_API["Flask /rag-query"]
    BE_RAG["Prompt Template<br/>RAG Registry · Component RAG Files"]
    BE_API --> BE_RAG
  end

  subgraph SOT["④ Source-of-Truth References"]
    SOT_REFS["WCAG 2.1 · W3C / WAI · DOJ ADA Web Rule"]
  end

  subgraph DC["⑤ A11Y DoubleCheck Agent"]
    DC_PASS["Second-Pass Validation"]
    DC_OUT["Evidence Summary<br/>Confidence Score · Ship Readiness"]
    DC_PASS --> DC_OUT
  end

  subgraph HR["⑥ Human Review + Ship Decision"]
    HR_APPR["Approve for Ship"]
  end

  FE_CHECK --> EVAL_ENGINE
  EVAL_ENGINE --> BE_API
  SOT_REFS --> BE_RAG
  BE_RAG --> EVAL_CHECKS
  EVAL_SCORE --> DC_PASS
  FE_DC --> DC_PASS
  DC_OUT --> HR_APPR
```

## How it works

OrchestratoR™ lets a designer or engineer load a UI component into a live workspace, then instantly evaluate it against real accessibility standards.

**Frontend Experience** renders the component in configurable states — light/dark mode, button state variants — and triggers the accessibility pipeline with a single action.

**Accessibility Evaluation** runs the Button Evaluator Logic against design token checks, WCAG rules, contrast ratios, and component state validation, combining all results into an Accessibility Health Score.

**Backend + RAG** powers the evaluation with a Flask `/rag-query` endpoint that builds a prompt from a RAG registry of component-specific files and returns grounded, standards-backed findings.

**Source-of-Truth References** — WCAG 2.1, W3C/WAI guidance, and the DOJ ADA Web Rule — anchor the RAG registry so every finding is traceable to a published standard.

**A11Y DoubleCheck Agent** performs a second-pass review after the first-pass score is produced, generating an evidence summary, confidence score, and ship-readiness verdict.

**Human Review + Ship Decision** surfaces the agent's verdict to a human reviewer, who makes the final call to Approve for Ship.
