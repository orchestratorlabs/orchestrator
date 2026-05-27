import { useState, useEffect, useMemo } from "react";
import type { A11yDoubleCheckResult, EvaluationResult } from "../types/evaluation";
import orchestratorLogo from "../../../assets/orchestrator-logo.png";

interface OrchestratorPanelProps {
  isOpen: boolean;
  evaluationStateMessage: string;
  evaluationResult: EvaluationResult | null;
  selectedFindingRuleId: string | null;
  onSelectFinding: (ruleId: string) => void;
  evaluatedMode: "light" | "dark" | null;
  a11yDoubleCheckResult: A11yDoubleCheckResult | null;
  evaluationSignature: string | null;
  doubleCheckEvaluationSignature: string | null;
  claudeSummary: string | null;
  isClaudeSummaryLoading: boolean;
}

const STATUS_LABEL: Record<A11yDoubleCheckResult["status"], string> = {
  PASS: "Passed",
  PARTIAL: "Needs Review",
  FAIL: "Failed",
};

const STATUS_CLASS: Record<A11yDoubleCheckResult["status"], string> = {
  PASS: "doublecheck-status--pass",
  PARTIAL: "doublecheck-status--partial",
  FAIL: "doublecheck-status--fail",
};

export function OrchestratorPanel({
  isOpen,
  evaluationStateMessage,
  evaluationResult,
  selectedFindingRuleId,
  onSelectFinding,
  evaluatedMode,
  a11yDoubleCheckResult,
  evaluationSignature,
  doubleCheckEvaluationSignature,
  claudeSummary,
  isClaudeSummaryLoading,
}: OrchestratorPanelProps) {
  const healthScore = evaluationResult?.healthScore ?? 0;
  const scoreRatio = Math.max(0, Math.min(healthScore, 100)) / 100;
  const donutCircumference = 2 * Math.PI * 42;
  const donutOffset = donutCircumference * (1 - scoreRatio);
  const passCount = evaluationResult?.findings.filter((finding) => finding.status === "Pass").length ?? 0;
  const unknownCount =
    evaluationResult?.findings.filter((finding) => finding.status === "Unknown").length ?? 0;
  const failCount = evaluationResult?.findings.filter((finding) => finding.status === "Fail").length ?? 0;

  const isDoubleCheckStale =
    a11yDoubleCheckResult !== null &&
    doubleCheckEvaluationSignature !== evaluationSignature;

  const [approvedAt, setApprovedAt] = useState<string | null>(null);

  useEffect(() => {
    setApprovedAt(null);
  }, [a11yDoubleCheckResult]);

  const canApproveForShip =
    a11yDoubleCheckResult?.status === "PASS" &&
    a11yDoubleCheckResult.shipReadiness.toLowerCase().includes("ship ready") &&
    a11yDoubleCheckResult.remainingRisks.length === 0;

  const STATUS_SORT_ORDER: Record<string, number> = { Fail: 0, Unknown: 1, Pass: 2 };
  const sortedFindings = useMemo(() => {
    if (!evaluationResult) return [];
    return [...evaluationResult.findings].sort(
      (a, b) => (STATUS_SORT_ORDER[a.status] ?? 3) - (STATUS_SORT_ORDER[b.status] ?? 3)
    );
  }, [evaluationResult]);

  const [copiedHex, setCopiedHex] = useState<string | null>(null);

  const renderWithCopyableHex = (text: string) => {
    const parts = text.split(/(#[0-9a-fA-F]{6})/g);
    return parts.map((part, i) => {
      if (!/^#[0-9a-fA-F]{6}$/.test(part)) return part;
      const isCopied = copiedHex === part + i;
      return (
        <button
          key={i}
          type="button"
          className="hex-copy-btn"
          onClick={() => {
            navigator.clipboard.writeText(part);
            setCopiedHex(part + i);
            setTimeout(() => setCopiedHex(null), 1500);
          }}
          title="Click to copy"
        >
          {isCopied ? "Copied!" : part}
        </button>
      );
    });
  };

  const [scoreInterpTooltipOpen, setScoreInterpTooltipOpen] = useState(false);
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
          useClaude: true,
          componentContext: evaluationStateMessage,
          evaluationContext: {
            evaluatedMode,
            score: healthScore,
            passCount,
            unknownCount,
            failCount,
            findings: evaluationResult?.findings ?? [],
          },
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

      {a11yDoubleCheckResult && isDoubleCheckStale && (
        <section className="panel-card doublecheck-card doublecheck-card--stale">
          <h3>A11Y DoubleCheck</h3>

          <div className="doublecheck-meta">
            <span className="doublecheck-status doublecheck-status--stale">
              Status: Needs Re-run
            </span>
            <span className="doublecheck-confidence">
              Confidence: Previous result is out of date
            </span>
            <span className="doublecheck-ship">
              Ship Readiness: Pending DoubleCheck
            </span>
          </div>

          <div className="doublecheck-section">
            <p className="doublecheck-label">Summary</p>
            <p className="doublecheck-body">
              The component has changed since the last A11Y DoubleCheck. Run DoubleCheck again to validate the updated accessibility result before approving for ship.
            </p>
          </div>

          <div className="doublecheck-section">
            <p className="doublecheck-label">Recommended Next Step</p>
            <p className="doublecheck-body">Run A11Y DoubleCheck again.</p>
          </div>
        </section>
      )}

      {a11yDoubleCheckResult && !isDoubleCheckStale && (
        <section className={`panel-card doublecheck-card doublecheck-card--${a11yDoubleCheckResult.status.toLowerCase()}`}>
          <h3>A11Y DoubleCheck</h3>

          <div className="doublecheck-meta">
            <span className={`doublecheck-status ${STATUS_CLASS[a11yDoubleCheckResult.status]}`}>
              Status: {STATUS_LABEL[a11yDoubleCheckResult.status]}
            </span>
            {a11yDoubleCheckResult.confidenceScore && (
              <span className="doublecheck-confidence">
                Confidence: {a11yDoubleCheckResult.confidenceScore}%
              </span>
            )}
            {a11yDoubleCheckResult.shipReadiness && (
              <span className={`doublecheck-ship doublecheck-ship--${a11yDoubleCheckResult.status.toLowerCase()}`}>
                Ship Readiness: {a11yDoubleCheckResult.shipReadiness}
              </span>
            )}
          </div>

          {a11yDoubleCheckResult.summary && (
            <div className="doublecheck-section">
              <p className="doublecheck-label">Summary</p>
              <p className="doublecheck-body">{a11yDoubleCheckResult.summary}</p>
            </div>
          )}

          {a11yDoubleCheckResult.sourcesChecked.length > 0 && (
            <div className="doublecheck-section">
              <p className="doublecheck-label">Sources Checked</p>
              <ul className="doublecheck-list">
                {a11yDoubleCheckResult.sourcesChecked.map((src) => (
                  <li key={src} className="doublecheck-list-item doublecheck-list-item--source">{src}</li>
                ))}
              </ul>
            </div>
          )}

          {a11yDoubleCheckResult.evidenceSummary && (
            <div className="doublecheck-section">
              <p className="doublecheck-label">Evidence</p>
              <p className="doublecheck-body">{a11yDoubleCheckResult.evidenceSummary}</p>
            </div>
          )}

          {a11yDoubleCheckResult.verifiedItems.length > 0 && (
            <div className="doublecheck-section">
              <p className="doublecheck-label">Verified</p>
              <ul className="doublecheck-list">
                {a11yDoubleCheckResult.verifiedItems.slice(0, 2).map((item) => (
                  <li key={item.criterion} className="doublecheck-verified-item">
                    <span className={`doublecheck-verified-result doublecheck-verified-result--${item.result.toLowerCase()}`}>
                      {item.result}
                    </span>
                    <span className="doublecheck-verified-criterion">{item.criterion}</span>
                    {item.detail && <span className="doublecheck-verified-detail muted">{item.detail}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="doublecheck-section">
            <p className="doublecheck-label">Remaining Risks</p>
            {a11yDoubleCheckResult.remainingRisks.length > 0 ? (
              <ul className="doublecheck-list">
                {a11yDoubleCheckResult.remainingRisks.map((risk) => (
                  <li key={risk} className="doublecheck-list-item">{risk}</li>
                ))}
              </ul>
            ) : (
              <p className="doublecheck-body doublecheck-body--no-risks">No blocking risks detected.</p>
            )}
          </div>

          {a11yDoubleCheckResult.recommendedNextStep && (
            <div className="doublecheck-section">
              <p className="doublecheck-label">Recommended Next Step</p>
              <p className="doublecheck-body">{a11yDoubleCheckResult.recommendedNextStep}</p>
            </div>
          )}

          {canApproveForShip && (
            <div className="doublecheck-section doublecheck-approve-section">
              {approvedAt ? (
                <div className="doublecheck-approved">
                  <p className="doublecheck-approved-title">Component approved</p>
                  <p className="doublecheck-approved-meta">
                    by John Doe · Developer · {approvedAt}
                  </p>
                </div>
              ) : (
                <button
                  type="button"
                  className="doublecheck-approve-btn"
                  onClick={() => {
                    const now = new Date();
                    const mm = String(now.getMonth() + 1).padStart(2, "0");
                    const dd = String(now.getDate()).padStart(2, "0");
                    const yyyy = now.getFullYear();
                    const time = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
                    setApprovedAt(`${mm}/${dd}/${yyyy} at ${time}`);
                  }}
                >
                  Approve Component
                </button>
              )}
            </div>
          )}
        </section>
      )}

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
        {evaluationResult && (
          <p className="muted score-summary">
            {evaluationResult.summary}
          </p>
        )}
      </section>

      {evaluationResult && (isClaudeSummaryLoading || claudeSummary) && (
        <section className="panel-card">
          <div className="score-interp-heading">
            <h3>Score Summary</h3>
            <div className={`score-interp-info-wrap${scoreInterpTooltipOpen ? " score-interp-info-wrap--open" : ""}`}>
              <button
                type="button"
                className="score-interp-info-btn"
                aria-label="Explain Score Summary"
                aria-describedby="score-interp-tooltip-text"
                onClick={() => setScoreInterpTooltipOpen((prev) => !prev)}
              >
                i
              </button>
              <div
                id="score-interp-tooltip-text"
                role="tooltip"
                className="score-interp-tooltip"
                aria-hidden={!scoreInterpTooltipOpen}
              >
                The Score Summary is calculated by OrchestratoR's accessibility checks. Claude helps explain what the score means and what to fix.
              </div>
            </div>
          </div>
          {isClaudeSummaryLoading ? (
            <p className="muted score-interpretation-body score-interpretation-body--loading">
              Analyzing score
              <span className="a11y-btn-loading-dots" aria-hidden="true">
                <span className="a11y-btn-dot" />
                <span className="a11y-btn-dot" />
                <span className="a11y-btn-dot" />
              </span>
            </p>
          ) : (
            <p className="muted score-interpretation-body">{claudeSummary && renderWithCopyableHex(claudeSummary)}</p>
          )}
        </section>
      )}

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

        {evaluationResult ? (
          <ul className="findings-list">
            {sortedFindings.map((finding) => (
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
                <p className="muted">Recommendation: {renderWithCopyableHex(finding.recommendation)}</p>
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
        <button type="button" onClick={() => {}}>
          Notify Project Manager
        </button>
        <button type="button" onClick={() => {}}>
          Notify DevOps Team
        </button>
      </section>
    </aside>
  );
}
