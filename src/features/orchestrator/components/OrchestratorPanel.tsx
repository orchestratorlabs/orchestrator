import { useState, useEffect, useMemo, useRef } from "react";
import type { A11yDoubleCheckResult, EvaluationResult } from "../types/evaluation";
import orchestratorLogo from "../../../assets/orchestrator-logo.png";
import { BACKEND_ORIGIN, IS_BACKEND_REACHABLE } from "../backend";
import { buildLocalScoreSummary, buildNeedsVerification } from "../localScoreSummary";
import { DEMO_REVIEWER_LABEL } from "../demoReviewer";
import {
  THEME_LABEL,
  buildDoubleCheckDisplay,
  isDoubleCheckCurrent,
  type DoubleCheckSnapshot,
  type EvaluationInputs,
  type ThemeMode,
} from "../doubleCheckReadiness";
import {
  createObservationState,
  formatStamp,
  interactionChipText,
  setNote,
  setOutcome,
  type CheckId,
  type CheckOutcome,
} from "../interactionObservations";
import { buildAccessibilityReport, sortFindingsForPanel } from "../report/accessibilityReport";
import { renderPdf } from "../report/pdfReport";
import { renderMarkdown } from "../report/reportModel";
import { InteractionPreviewDialog } from "./InteractionPreviewDialog";

interface OrchestratorPanelProps {
  isOpen: boolean;
  evaluationStateMessage: string;
  evaluationResult: EvaluationResult | null;
  lightResult: EvaluationResult | null;
  darkResult: EvaluationResult | null;
  loadedComponentName: string | null;
  selectedFindingRuleId: string | null;
  onSelectFinding: (ruleId: string) => void;
  evaluatedMode: "light" | "dark" | null;
  a11yDoubleCheckResult: A11yDoubleCheckResult | null;
  evaluationSignature: string | null;
  doubleCheckEvaluationSignature: string | null;
  claudeSummary: string | null;
  isClaudeSummaryLoading: boolean;
  previewTheme: ThemeMode;
  /** Live inputs for each theme, used to tell a current cached result from a previous one. */
  currentInputsByTheme: Record<ThemeMode, EvaluationInputs>;
  doubleCheckSnapshot: DoubleCheckSnapshot | null;
  lightResultInputs: EvaluationInputs | null;
  darkResultInputs: EvaluationInputs | null;
  isDoubleChecking: boolean;
  onRunDoubleCheckAll: () => void;
}

/**
 * Section heading inside the Score Summary, prefixed with the same colour-coded
 * status dot used in the Health Score legend and the Findings list. The text
 * label is always rendered, so the status is never conveyed by colour alone.
 */
function ScoreSummaryHeading({
  status,
  label,
}: {
  status: "pass" | "unknown" | "fail";
  label: string;
}) {
  return (
    <p className="score-summary-section-label">
      <span className={`status-dot ${status}`} aria-hidden="true" />
      {label}
    </p>
  );
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

/**
 * Shown when Submit is pressed with an empty question. The button stays enabled
 * so this can be explained: a disabled control cannot be focused and gives
 * keyboard and screen reader users no reason for being unavailable.
 */
const EMPTY_QUESTION_MESSAGE = "You need to first ask a question, then Submit";

/** CSS-safe class name for a status ("N/A" is not a valid class name to select on). */
function statusClassName(status: EvaluationResult["findings"][number]["status"]) {
  return status === "N/A" ? "not-applicable" : status.toLowerCase();
}

/** The text shown for a status. Not Applicable is spelled out so "N/A" is never ambiguous. */
function statusLabel(status: EvaluationResult["findings"][number]["status"]) {
  return status === "N/A" ? "N/A — Not Applicable" : status;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function OrchestratorPanel({
  isOpen,
  evaluationStateMessage,
  evaluationResult,
  lightResult,
  darkResult,
  loadedComponentName,
  selectedFindingRuleId,
  onSelectFinding,
  evaluatedMode,
  a11yDoubleCheckResult,
  evaluationSignature,
  doubleCheckEvaluationSignature,
  claudeSummary,
  isClaudeSummaryLoading,
  previewTheme,
  currentInputsByTheme,
  doubleCheckSnapshot,
  lightResultInputs,
  darkResultInputs,
  isDoubleChecking,
  onRunDoubleCheckAll,
}: OrchestratorPanelProps) {
  const healthScore = evaluationResult?.healthScore ?? 0;
  const scoreRatio = Math.max(0, Math.min(healthScore, 100)) / 100;
  const donutCircumference = 2 * Math.PI * 42;
  const donutOffset = donutCircumference * (1 - scoreRatio);
  const passCount = evaluationResult?.findings.filter((finding) => finding.status === "Pass").length ?? 0;
  const unknownCount =
    evaluationResult?.findings.filter((finding) => finding.status === "Unknown").length ?? 0;
  const failCount = evaluationResult?.findings.filter((finding) => finding.status === "Fail").length ?? 0;
  const notApplicableCount =
    evaluationResult?.findings.filter((finding) => finding.status === "N/A").length ?? 0;

  /**
   * Stands in for the Claude-written summary when the local Flask service is
   * unreachable — always on a hosted deployment, and locally when app.py is not
   * running. Derived from the real findings, and labelled as locally generated
   * so it is not mistaken for the agentic double-check.
   */
  const localScoreSummary = useMemo(
    () =>
      evaluationResult && !claudeSummary && !isClaudeSummaryLoading
        ? buildLocalScoreSummary(evaluationResult.findings, evaluatedMode)
        : null,
    [evaluationResult, claudeSummary, isClaudeSummaryLoading, evaluatedMode]
  );

  /**
   * The Score Summary's "Needs Verification" section. Populated only when the
   * evaluator returned Unknown findings — i.e. the submitted component lacked the
   * evidence to check a rule. Kept distinct from the Fail prose above it and
   * derived from the same findings regardless of the prose's source.
   */
  const needsVerification = useMemo(
    () => (evaluationResult ? buildNeedsVerification(evaluationResult.findings) : []),
    [evaluationResult]
  );

  // A DoubleCheck result is current only if no Evaluate rerun or theme switch has
  // happened AND the inputs it ran against still equal the live inputs (no edit).
  const isDoubleCheckStale =
    a11yDoubleCheckResult !== null &&
    !isDoubleCheckCurrent({
      evaluationSignature,
      doubleCheckEvaluationSignature,
      snapshot: doubleCheckSnapshot,
      currentInputs: currentInputsByTheme[previewTheme],
    });

  /**
   * What the card claims, derived from the snapshot of what was actually sent to
   * DoubleCheck. The raw model response (including its own summary and "ship
   * readiness") stays untouched in `a11yDoubleCheckResult` for debugging; it is not
   * what the reviewer reads.
   */
  const display = useMemo(
    () =>
      a11yDoubleCheckResult && doubleCheckSnapshot && !isDoubleCheckStale
        ? buildDoubleCheckDisplay(a11yDoubleCheckResult, doubleCheckSnapshot)
        : null,
    [a11yDoubleCheckResult, doubleCheckSnapshot, isDoubleCheckStale]
  );

  const [approval, setApproval] = useState<{
    at: string;
    theme: ThemeMode;
    findingTotal: number;
  } | null>(null);
  const approvalRef = useRef(approval);
  approvalRef.current = approval;
  const [approvalCleared, setApprovalCleared] = useState(false);
  const [observations, setObservations] = useState(createObservationState);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  // Markdown stays the default, so a plain click on Export behaves as it always has.
  const [exportFormat, setExportFormat] = useState<"markdown" | "pdf">("markdown");
  const previewTriggerRef = useRef<HTMLButtonElement>(null);
  const approveSectionRef = useRef<HTMLDivElement>(null);

  // A new DoubleCheck result starts clean: no approval, no observations.
  useEffect(() => {
    setApproval(null);
    setApprovalCleared(false);
    setObservations(createObservationState());
    setIsPreviewOpen(false);
  }, [a11yDoubleCheckResult]);

  // Going stale clears the approval and observations for good. Reverting an edit
  // does not bring them back: an old observation must never read as evidence about
  // a different version of the component.
  useEffect(() => {
    if (!isDoubleCheckStale) return;
    if (approvalRef.current) setApprovalCleared(true);
    setApproval(null);
    setObservations(createObservationState());
    setIsPreviewOpen(false);
  }, [isDoubleCheckStale]);

  useEffect(() => {
    if (!approval) return;
    // The panel footer (Push to Figma etc.) is position:sticky, so it visually
    // covers the bottom of the scroll area without shrinking it — scrollIntoView
    // alone doesn't know that and leaves the newly revealed button underneath it.
    const raf = requestAnimationFrame(() => {
      const section = approveSectionRef.current;
      const panel = section?.closest(".orchestrator-panel") as HTMLElement | null;
      const footer = panel?.querySelector(".panel-actions") as HTMLElement | null;
      if (!section || !panel) return;
      const sectionBottom = section.getBoundingClientRect().bottom;
      const footerTop = footer?.getBoundingClientRect().top ?? panel.getBoundingClientRect().bottom;
      const overlap = sectionBottom - footerTop;
      if (overlap > 0) {
        panel.scrollTo({ top: panel.scrollTop + overlap + 12, behavior: "smooth" });
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [approval]);

  /** Sign-off and export are only ever possible against a current, fully passing result. */
  const canSignOff = display?.canApprove === true && !isDoubleCheckStale;
  const canExport = canSignOff && approval !== null;

  const handleApprove = () => {
    if (!canSignOff || !doubleCheckSnapshot) return;
    setApproval({
      at: formatStamp(new Date()),
      theme: doubleCheckSnapshot.inputs.theme,
      findingTotal: doubleCheckSnapshot.counts.total,
    });
  };

  const handleOutcomeChange = (id: CheckId, outcome: CheckOutcome) =>
    setObservations((prev) => setOutcome(prev, id, outcome, new Date()));
  const handleNoteChange = (id: CheckId, note: string) =>
    setObservations((prev) => setNote(prev, id, note, new Date()));

  const closeInteractionPreview = () => {
    setIsPreviewOpen(false);
    // Native <dialog> restores focus itself; set it explicitly too so the return
    // target is guaranteed to be the control that opened the preview.
    requestAnimationFrame(() => previewTriggerRef.current?.focus());
  };

  const handleExportReport = () => {
    // Defence in depth: the button is only rendered for a valid approval, but the
    // handler refuses to run against a stale or unapproved result regardless.
    if (!canExport || !approval) return;

    const now = new Date();
    const componentName = loadedComponentName ?? "Component";

    // One report model feeds both formats, so they always agree.
    const report = buildAccessibilityReport({
      componentName,
      reviewerLabel: DEMO_REVIEWER_LABEL,
      approval,
      generatedAt: formatStamp(now),
      lightResult,
      darkResult,
      lightResultInputs,
      darkResultInputs,
      currentInputsByTheme,
      observations,
    });

    const fileStamp = now.toISOString().slice(0, 16).replace(/[-:T]/g, "");
    const baseName = `orchestrator-report-${componentName.toLowerCase()}-${fileStamp}`;

    if (exportFormat === "pdf") {
      const { bytes } = renderPdf(report, { now });
      downloadBlob(new Blob([bytes], { type: "application/pdf" }), `${baseName}.pdf`);
    } else {
      downloadBlob(
        new Blob([renderMarkdown(report.blocks)], { type: "text/markdown;charset=utf-8" }),
        `${baseName}.md`
      );
    }
  };

  const sortedFindings = useMemo(() => {
    if (!evaluationResult) return [];
    return sortFindingsForPanel(evaluationResult.findings);
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
  const ragQuestionRef = useRef<HTMLTextAreaElement>(null);
  const isEmptyQuestionError = ragError === EMPTY_QUESTION_MESSAGE;

  const handleRagSubmit = async () => {
    if (!ragQuestion.trim()) {
      setRagError(EMPTY_QUESTION_MESSAGE);
      // Put focus where the fix is. The message is announced by its alert role
      // and is also tied to the field through aria-describedby.
      ragQuestionRef.current?.focus();
      return;
    }

    // State the limitation rather than reporting a load failure on hosted demos,
    // where the local Flask service cannot be reached.
    if (!IS_BACKEND_REACHABLE) {
      setRagError(
        "Ask OrchestratoR runs against the local Python service and is not available in this hosted demo."
      );
      return;
    }

    setIsRagLoading(true);
    setRagError("");

    try {
      const response = await fetch(`${BACKEND_ORIGIN}/rag-query`, {
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
    <aside
      id="orchestrator-panel"
      className={`orchestrator-panel ${isOpen ? "open" : "closed"}`}
      aria-hidden={!isOpen}
    >
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
            <span className="doublecheck-status doublecheck-status--stale">Needs re-run</span>
            <span className="doublecheck-confidence">
              Confidence: Previous result is out of date
            </span>
          </div>

          <div className="doublecheck-section">
            <p className="doublecheck-label">Summary</p>
            <p className="doublecheck-body">
              The component code, CSS, or theme has changed since the last A11Y DoubleCheck. Run DoubleCheck again to validate the updated accessibility result before approving the component.
            </p>
            {approvalCleared && (
              <p className="doublecheck-body doublecheck-body--note">
                Previous approval was cleared. Interaction preview notes and outcomes were cleared too.
              </p>
            )}
          </div>

          <div className="doublecheck-section">
            <p className="doublecheck-label">Recommended Next Step</p>
            <p className="doublecheck-body">Run A11Y DoubleCheck again.</p>
          </div>
        </section>
      )}

      {a11yDoubleCheckResult && display && doubleCheckSnapshot && !isDoubleCheckStale && (
        <section className={`panel-card doublecheck-card doublecheck-card--${a11yDoubleCheckResult.status.toLowerCase()}`}>
          <h3>A11Y DoubleCheck</h3>

          <div className="doublecheck-meta">
            {display.headlineKind === "default" ? (
              <span className={`doublecheck-status ${STATUS_CLASS[a11yDoubleCheckResult.status]}`}>
                Status: {STATUS_LABEL[a11yDoubleCheckResult.status]}
              </span>
            ) : (
              <span
                className={`doublecheck-status ${
                  display.headlineKind === "review-incomplete"
                    ? "doublecheck-status--partial"
                    : "doublecheck-status--pass"
                }`}
              >
                {display.headline}
              </span>
            )}
            {display.extraChip && (
              <span className="doublecheck-status doublecheck-status--partial">{display.extraChip}</span>
            )}
            {a11yDoubleCheckResult.confidenceScore && (
              <span className="doublecheck-confidence">
                Confidence: {a11yDoubleCheckResult.confidenceScore}%
              </span>
            )}
            {display.headlineKind === "default" && a11yDoubleCheckResult.shipReadiness && (
              <span className={`doublecheck-ship doublecheck-ship--${a11yDoubleCheckResult.status.toLowerCase()}`}>
                Ship Readiness: {a11yDoubleCheckResult.shipReadiness}
              </span>
            )}
            <span className="doublecheck-interaction-chip">{interactionChipText(observations)}</span>
          </div>
          {display.caption && <p className="doublecheck-scope-caption">{display.caption}</p>}

          <div className="doublecheck-section">
            <p className="doublecheck-label">Summary</p>
            <p className="doublecheck-body">{display.summary}</p>
          </div>

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

          {display.showNextStep && (display.nextStep ?? a11yDoubleCheckResult.recommendedNextStep) && (
            <div className="doublecheck-section">
              <p className="doublecheck-label">Recommended Next Step</p>
              <p className="doublecheck-body">
                {display.nextStep ?? a11yDoubleCheckResult.recommendedNextStep}
              </p>
              {display.showRunAll && (
                <button
                  type="button"
                  className="doublecheck-runall-btn"
                  onClick={onRunDoubleCheckAll}
                  disabled={isDoubleChecking}
                  aria-busy={isDoubleChecking}
                >
                  Run DoubleCheck on all findings
                </button>
              )}
            </div>
          )}

          <div className="doublecheck-section doublecheck-interaction">
            <p className="doublecheck-label">Interaction preview (optional)</p>
            <p className="doublecheck-body doublecheck-body--secondary">
              Opens a local simulated save with a stand-in Button. Notes and outcomes are separate from the Health Score and component approval.
            </p>
            <button
              ref={previewTriggerRef}
              type="button"
              className="doublecheck-preview-btn"
              onClick={() => setIsPreviewOpen(true)}
            >
              Open interaction preview
            </button>
          </div>

          {display.approvalNotice && display.approve === "hidden" && (
            <div className="doublecheck-section">
              <p className="doublecheck-body doublecheck-body--secondary">{display.approvalNotice}</p>
            </div>
          )}

          {display.approve !== "hidden" && (
            <div className="doublecheck-section doublecheck-approve-section" ref={approveSectionRef}>
              {approval && canSignOff ? (
                <div className="doublecheck-approved">
                  <p className="doublecheck-approved-title">Component approved</p>
                  <p className="doublecheck-approved-meta">
                    by {DEMO_REVIEWER_LABEL} · {approval.at}
                  </p>
                  <p className="doublecheck-approved-meta">
                    {THEME_LABEL[approval.theme]} · all {approval.findingTotal} evaluated findings
                  </p>
                  <fieldset className="export-format">
                    <legend className="export-format__legend">Export format</legend>
                    <label className="export-format__option">
                      <input
                        type="radio"
                        name="export-format"
                        value="markdown"
                        checked={exportFormat === "markdown"}
                        onChange={() => setExportFormat("markdown")}
                      />
                      Markdown (.md)
                    </label>
                    <label className="export-format__option">
                      <input
                        type="radio"
                        name="export-format"
                        value="pdf"
                        checked={exportFormat === "pdf"}
                        onChange={() => setExportFormat("pdf")}
                      />
                      PDF (.pdf)
                    </label>
                  </fieldset>
                  <button
                    type="button"
                    className="doublecheck-approve-btn export-report-btn"
                    aria-describedby="export-report-hint"
                    onClick={handleExportReport}
                  >
                    Export Accessibility Report
                  </button>
                  <p id="export-report-hint" className="export-report-hint">
                    Share your observations with your team.
                  </p>
                </div>
              ) : (
                <>
                  {display.approve === "enabled" ? (
                    <p className="doublecheck-body doublecheck-body--secondary doublecheck-approve-scope">
                      {display.approvalScopeLine}
                    </p>
                  ) : (
                    <p
                      id="doublecheck-approve-notice"
                      className="doublecheck-body doublecheck-body--secondary doublecheck-approve-scope"
                    >
                      {display.approvalNotice}
                    </p>
                  )}
                  <button
                    type="button"
                    className="doublecheck-approve-btn"
                    aria-disabled={display.approve === "unavailable"}
                    aria-describedby={display.approve === "unavailable" ? "doublecheck-approve-notice" : undefined}
                    onClick={() => {
                      if (display.approve !== "enabled") return;
                      handleApprove();
                    }}
                  >
                    Approve Component
                  </button>
                </>
              )}
            </div>
          )}

          <InteractionPreviewDialog
            isOpen={isPreviewOpen}
            onClose={closeInteractionPreview}
            theme={doubleCheckSnapshot.inputs.theme}
            effectiveCss={doubleCheckSnapshot.inputs.effectiveCss}
            observations={observations}
            onOutcomeChange={handleOutcomeChange}
            onNoteChange={handleNoteChange}
          />
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
                {notApplicableCount > 0 && (
                  <li>
                    <span className="status-dot not-applicable" aria-hidden="true" />
                    N/A: {notApplicableCount}
                  </li>
                )}
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

      {evaluationResult &&
        (isClaudeSummaryLoading || claudeSummary || localScoreSummary || needsVerification.length > 0) && (
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
                {claudeSummary || isClaudeSummaryLoading
                  ? "The Score Summary is calculated by OrchestratoR's accessibility checks. Claude helps explain what the score means and what to fix."
                  : "The Score Summary is calculated by OrchestratoR's accessibility checks. This summary is generated locally from those results; Claude's explanation requires the local Python service."}
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
            <>
              {(claudeSummary || localScoreSummary) && (
                <>
                  {failCount > 0 && (
                    <ScoreSummaryHeading status="fail" label="Fail" />
                  )}
                  {failCount === 0 && unknownCount === 0 && (
                    <ScoreSummaryHeading status="pass" label="Pass" />
                  )}
                  <p className="muted score-interpretation-body">
                    {renderWithCopyableHex(claudeSummary ?? localScoreSummary ?? "")}
                  </p>
                </>
              )}
              {needsVerification.length > 0 && (
                <div className="needs-verification">
                  <ScoreSummaryHeading status="unknown" label="Unknown: Needs Verification" />
                  <ul className="needs-verification-list">
                    {needsVerification.map((item) => (
                      <li key={item.ruleId}>
                        <strong>{item.ruleName}</strong> — {item.detail}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {!claudeSummary && localScoreSummary && (
                <p className="muted score-interpretation-note">
                  Demo version — agentic double-check not included.
                </p>
              )}
            </>
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
          ref={ragQuestionRef}
          className="ask-orchestrator-input"
          value={ragQuestion}
          aria-invalid={isEmptyQuestionError ? true : undefined}
          aria-describedby={isEmptyQuestionError ? "rag-question-error" : undefined}
          onChange={(event) => {
            setRagQuestion(event.target.value);
            // The prompt has done its job once they start typing.
            if (isEmptyQuestionError) setRagError("");
          }}
          placeholder="Ask about this component, rule, or finding..."
          rows={3}
        />

        <button
          type="button"
          className="ask-orchestrator-submit"
          onClick={handleRagSubmit}
          disabled={isRagLoading}
        >
          {isRagLoading ? "Submitting..." : "Submit question"}
        </button>

        {ragError ? (
          <div
            id={isEmptyQuestionError ? "rag-question-error" : undefined}
            className="rag-response rag-response--error"
            role="alert"
          >
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
            {sortedFindings.map((finding, index) => (
              <li
                key={finding.ruleId}
                className={`finding ${statusClassName(finding.status)} ${
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
                <div className="finding-header">
                  <p className="finding-title">
                    <span className="finding-number" aria-hidden="true">
                      {index + 1}.
                    </span>
                    {finding.ruleName}
                  </p>
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
                    {finding.status === "N/A" && (
                      <span className="finding-status-icon not-applicable" aria-hidden="true">
                        –
                      </span>
                    )}
                    {statusLabel(finding.status)}
                  </strong>
                </div>
                <p className="muted">{finding.evidence}</p>
                <p className="muted finding-severity">Severity: {finding.severity}</p>
                <p className="muted">Recommendation: {renderWithCopyableHex(finding.recommendation)}</p>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="status-legend">
            <li>
              <span className="finding-status-icon pass" aria-hidden="true">
                ✓
              </span>
              Pass - verified and compliant
            </li>
            <li>
              <span className="finding-status-icon unknown" aria-hidden="true">
                ?
              </span>
              Unknown - insufficient evidence
            </li>
            <li>
              <span className="finding-status-icon fail" aria-hidden="true">
                !
              </span>
              Fail - verified and not compliant
            </li>
            <li>
              <span className="finding-status-icon not-applicable" aria-hidden="true">
                –
              </span>
              N/A - does not apply to this component
            </li>
          </ul>
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
