import { useState } from "react";
import type { EvaluationResult } from "../types/evaluation";
import orchestratorLogo from "../../../assets/orchestrator-logo.png";

interface OrchestratorPanelProps {
  isOpen: boolean;
  evaluationStateMessage: string;
  evaluationResult: EvaluationResult | null;
  selectedFindingRuleId: string | null;
  onSelectFinding: (ruleId: string) => void;
  evaluatedMode: "light" | "dark" | null;
}

export function OrchestratorPanel({
  isOpen,
  evaluationStateMessage,
  evaluationResult,
  selectedFindingRuleId,
  onSelectFinding,
  evaluatedMode,
}: OrchestratorPanelProps) {
  const healthScore = evaluationResult?.healthScore ?? 0;
  const scoreRatio = Math.max(0, Math.min(healthScore, 100)) / 100;
  const donutCircumference = 2 * Math.PI * 42;
  const donutOffset = donutCircumference * (1 - scoreRatio);
  const passCount = evaluationResult?.findings.filter((finding) => finding.status === "Pass").length ?? 0;
  const unknownCount =
    evaluationResult?.findings.filter((finding) => finding.status === "Unknown").length ?? 0;
  const failCount = evaluationResult?.findings.filter((finding) => finding.status === "Fail").length ?? 0;

  const [ragQuestion, setRagQuestion] = useState("");
  const [ragAnswer, setRagAnswer] = useState("");
  const [isRagLoading, setIsRagLoading] = useState(false);
  const [ragError, setRagError] = useState("");

  const handleRagSubmit = async () => {
    if (!ragQuestion.trim()) return;

    setIsRagLoading(true);
    setRagError("");

    try {
      const response = await fetch("http://127.0.0.1:5001/rag-query", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: ragQuestion,
          componentContext: evaluationStateMessage,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "RAG request failed.");
      }

      setRagAnswer(data.answer);
    } catch (error) {
      setRagError("OrchestratoR could not load the backend RAG response.");
    } finally {
      setIsRagLoading(false);
    }
  };
  return (
    <aside className={`orchestrator-panel ${isOpen ? "open" : "closed"}`} aria-hidden={!isOpen}>
      <div className="panel-header">
        <img src={orchestratorLogo} alt="" className="panel-logo" aria-hidden="true" />
        <div className="panel-brand-copy">
          <h2>OrchestratoR<sup>™</sup> - Your Accessibility Co-pilot</h2>
          <p>Detect. Fix. Ship.</p>
        </div>
      </div>

      <section className="panel-card">
        <h3>Accessibility Health Score</h3>
        <div className="score-shell">
          <div
            className="score-donut-wrap"
            role="img"
            aria-label={
              evaluationResult
                ? `Accessibility Health Score ${evaluationResult.healthScore} out of 100`
                : "Accessibility Health Score unavailable until evaluation runs"
            }
          >
            <svg className="score-donut" viewBox="0 0 100 100" aria-hidden="true">
              <circle className="score-donut-track" cx="50" cy="50" r="42" />
              <circle
                className="score-donut-progress"
                cx="50"
                cy="50"
                r="42"
                strokeDasharray={donutCircumference}
                strokeDashoffset={evaluationResult ? donutOffset : donutCircumference}
              />
            </svg>
            <div className="score-center">
              <strong className="score-value">
                {evaluationResult ? evaluationResult.healthScore : "--"}
              </strong>
              <span className="score-denominator">/ 100</span>
            </div>
          </div>
          <div className="score-meta">
            <p className="muted score-policy">
              Evaluation method: Button accessibility rules
            </p>
            {evaluatedMode && (
              <p className="muted score-evaluated-mode">
                Evaluated: {evaluatedMode === "dark" ? "Dark mode" : "Light mode"}
              </p>
            )}
            {evaluationResult && (
              <ul className="score-status-legend" aria-label="Rule status distribution">
                <li>
                  <span className="status-dot pass" aria-hidden="true" />
                  Pass: {passCount}
                </li>
                <li>
                  <span className="status-dot unknown" aria-hidden="true" />
                  Unknown: {unknownCount}
                </li>
                <li>
                  <span className="status-dot fail" aria-hidden="true" />
                  Fail: {failCount}
                </li>
              </ul>
            )}
          </div>
        </div>
        {evaluationResult && <p className="muted score-summary">{evaluationResult.summary}</p>}
      </section>

      <section className="panel-card ask-orchestrator-card">
        <h3>Ask OrchestratoR</h3>

        <p className="ask-orchestrator-helper">
          Ask a question. Get an accessibility response.
        </p>

        <label className="sr-only" htmlFor="rag-question">
          Ask OrchestratoR question
        </label>

        <textarea
          id="rag-question"
          className="ask-orchestrator-input"
          value={ragQuestion}
          onChange={(event) => setRagQuestion(event.target.value)}
          placeholder="Ask about this component, rule, or finding..."
          rows={3}
        />

        <button
          type="button"
          className="ask-orchestrator-submit"
          onClick={handleRagSubmit}
          disabled={isRagLoading || !ragQuestion.trim()}
        >
          {isRagLoading ? "Submitting..." : "Submit question"}
        </button>

        {ragError ? (
          <div className="rag-response rag-response--error" role="alert">
            {ragError}
          </div>
        ) : null}

        {ragAnswer ? (
          <div className="rag-response">
            <h4>Response</h4>
            <p>{ragAnswer.replace("OrchestratoR loaded the backend RAG registry and button accessibility rule context.", "").trimStart()}</p>
          </div>
        ) : null}
      </section>

      <section className="panel-card">
        <h3>Findings</h3>
        <p className="muted">Display order for MVP: Pass first, Unknown second, Fail last.</p>
        {evaluationResult ? (
          <ul className="findings-list">
            {evaluationResult.findings.map((finding) => (
              <li
                key={finding.ruleId}
                className={`finding ${finding.status.toLowerCase()} ${
                  finding.ruleId === selectedFindingRuleId ? "selected" : ""
                } ${finding.status === "Fail" || finding.status === "Unknown" ? "inspectable" : ""}`}
                role={finding.status === "Fail" || finding.status === "Unknown" ? "button" : undefined}
                tabIndex={finding.status === "Fail" || finding.status === "Unknown" ? 0 : undefined}
                onClick={() => {
                  if (finding.status === "Fail" || finding.status === "Unknown") {
                    onSelectFinding(finding.ruleId);
                  }
                }}
                onKeyDown={(event) => {
                  if (
                    (event.key === "Enter" || event.key === " ") &&
                    (finding.status === "Fail" || finding.status === "Unknown")
                  ) {
                    event.preventDefault();
                    onSelectFinding(finding.ruleId);
                  }
                }}
              >
                <p>
                  <strong className="finding-status">
                    {finding.status === "Pass" && (
                      <span className="finding-status-icon pass" aria-hidden="true">
                        ✓
                      </span>
                    )}
                    {finding.status === "Unknown" && (
                      <span className="finding-status-icon unknown" aria-hidden="true">
                        ?
                      </span>
                    )}
                    {finding.status === "Fail" && (
                      <span className="finding-status-icon fail" aria-hidden="true">
                        !
                      </span>
                    )}
                    {finding.status}
                  </strong>{" "}
                  - {finding.ruleName}
                </p>
                <p className="muted">{finding.evidence}</p>
                <p className="muted">Severity: {finding.severity}</p>
                <p className="muted">Recommendation: {finding.recommendation}</p>
                <p className="muted">Source: {finding.sourceReference}</p>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="status-legend">
            <li>Pass - verified and compliant</li>
            <li>Unknown - insufficient evidence</li>
            <li>Fail - verified and not compliant</li>
          </ul>
        )}
      </section>

      <section className="panel-card">
        <h3>Fixes</h3>
        {evaluationResult ? (
          <ul className="status-legend">
            {evaluationResult.recommendedFixes.map((fix) => (
              <li key={fix}>{fix}</li>
            ))}
          </ul>
        ) : (
          <p className="muted">
            Recommended fixes will appear after evaluation. No evaluator engine is active in this
            stage.
          </p>
        )}
      </section>

      <section className="panel-actions">
        <button type="button" onClick={() => {}}>
          Push to Figma
        </button>
        <button type="button" onClick={() => {}}>
          Create JIRA Ticket
        </button>
        <button type="button" className="primary-action" onClick={() => {}}>
          Notify Project Manager
        </button>
      </section>
    </aside>
  );
}
