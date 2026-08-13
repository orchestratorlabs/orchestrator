import { TopBar } from "./features/orchestrator/components/TopBar";
import { OrchestratorPanel } from "./features/orchestrator/components/OrchestratorPanel";
import { useOrchestratorState } from "./features/orchestrator/state/orchestratorState";
import { SAMPLE_BUTTON_CSS, SAMPLE_BUTTON_CSS_DARK, SAMPLE_BUTTON_TSX, WorkspacePane } from "./features/workspace/WorkspacePane";
import { useState } from "react";
import { evaluateButtonAccessibility } from "./features/orchestrator/evaluator/buttonEvaluator";
import { BACKEND_ORIGIN, IS_BACKEND_REACHABLE } from "./features/orchestrator/backend";
import type { A11yDoubleCheckResult, EvaluationResult } from "./features/orchestrator/types/evaluation";

function parseA11yDoubleCheckXml(xmlString: string): A11yDoubleCheckResult | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, "text/xml");
    const root = doc.querySelector("a11y_doublecheck_result");
    if (!root) return null;

    const getText = (tag: string) => root.querySelector(tag)?.textContent?.trim() ?? "";

    const sourcesChecked = Array.from(root.querySelectorAll("sources_checked > source"))
      .map((el) => el.textContent?.trim() ?? "")
      .filter(Boolean);

    const verifiedItems = Array.from(root.querySelectorAll("verified_items > item")).map((item) => ({
      criterion: item.querySelector("criterion")?.textContent?.trim() ?? "",
      result: item.querySelector("result")?.textContent?.trim() ?? "",
      detail: item.querySelector("detail")?.textContent?.trim() ?? "",
    }));

    const remainingRisks = Array.from(root.querySelectorAll("remaining_risks > risk"))
      .map((el) => el.textContent?.trim() ?? "")
      .filter(Boolean);

    const rawStatus = getText("status");
    const status =
      rawStatus === "PASS" || rawStatus === "PARTIAL" || rawStatus === "FAIL"
        ? rawStatus
        : "FAIL";

    return {
      status,
      confidenceScore: getText("confidence_score"),
      shipReadiness: getText("ship_readiness"),
      summary: getText("summary"),
      sourcesChecked,
      evidenceSummary: getText("evidence_summary"),
      verifiedItems,
      remainingRisks,
      recommendedNextStep: getText("recommended_next_step"),
    };
  } catch {
    return null;
  }
}

export function App() {
  const { isPanelOpen, togglePanel } = useOrchestratorState();
  const [hasLoadedComponentCode, setHasLoadedComponentCode] = useState(false);
  const [loadedComponentName, setLoadedComponentName] = useState<string | null>(null);
  const [reactCode, setReactCode] = useState("");
  const [cssCode, setCssCode] = useState("");
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluationStateMessage, setEvaluationStateMessage] = useState(
    "Load component code to begin."
  );
  const [evaluationResult, setEvaluationResult] = useState<EvaluationResult | null>(null);
  const [lightResult, setLightResult] = useState<EvaluationResult | null>(null);
  const [darkResult, setDarkResult] = useState<EvaluationResult | null>(null);
  const [selectedFindingRuleId, setSelectedFindingRuleId] = useState<string | null>(null);
  const [previewTheme, setPreviewTheme] = useState<"light" | "dark">("light");
  const [evaluatedMode, setEvaluatedMode] = useState<"light" | "dark" | null>(null);
  const [isDoubleChecking, setIsDoubleChecking] = useState(false);
  const [a11yDoubleCheckResult, setA11yDoubleCheckResult] = useState<A11yDoubleCheckResult | null>(null);
  const [a11yDoubleCheckError, setA11yDoubleCheckError] = useState<string | null>(null);
  const [evaluationSignature, setEvaluationSignature] = useState<string | null>(null);
  const [doubleCheckEvaluationSignature, setDoubleCheckEvaluationSignature] = useState<string | null>(null);
  const [claudeSummary, setClaudeSummary] = useState<string | null>(null);
  const [isClaudeSummaryLoading, setIsClaudeSummaryLoading] = useState(false);

  const handlePreviewThemeChange = (theme: "light" | "dark") => {
    setPreviewTheme(theme);
    setEvaluationResult(null);
    setSelectedFindingRuleId(null);
    setEvaluatedMode(null);
    setEvaluationSignature(null);
    setClaudeSummary(null);
    setIsClaudeSummaryLoading(false);
    if (hasLoadedComponentCode) {
      setEvaluationStateMessage(
        "Preview mode changed. Run accessibility check to evaluate the current token set."
      );
    }
  };

  const handleLoadSample = async () => {
  setReactCode(SAMPLE_BUTTON_TSX);
  setCssCode(SAMPLE_BUTTON_CSS);
  setHasLoadedComponentCode(true);
  setLoadedComponentName("Button");
  setSelectedFindingRuleId(null);
  setEvaluationResult(null);
  setLightResult(null);
  setDarkResult(null);
  setEvaluationSignature(null);
  setClaudeSummary(null);
  setIsClaudeSummaryLoading(false);
  setEvaluationStateMessage(
    "Component code loaded. Select a button state and run the accessibility check."
  );

  // Hosted demos have no Flask service to confirm against; skip rather than
  // firing a request that cannot succeed.
  if (!IS_BACKEND_REACHABLE) {
    return;
  }

  try {
    const response = await fetch(`${BACKEND_ORIGIN}/echo`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        componentCode: SAMPLE_BUTTON_TSX,
      }),
    });

    const data = await response.json();

    setEvaluationStateMessage(data.message);
  } catch (error) {
    setEvaluationStateMessage(
      "Component code loaded. Flask echo confirmation failed."
    );
  }
};

 const handleEvaluate = async () => {
  if (!hasLoadedComponentCode) return;

  const currentReactCode = reactCode;
  const currentMode = previewTheme;
  const currentCssCode = currentMode === "dark" ? SAMPLE_BUTTON_CSS_DARK : cssCode;
  const newSignature = Date.now().toString();

  setIsEvaluating(true);
  setSelectedFindingRuleId(null);
  setEvaluationResult(null);
  setEvaluatedMode(null);
  setEvaluationSignature(null);
  setClaudeSummary(null);
  setIsClaudeSummaryLoading(false);
  setEvaluationStateMessage("Running accessibility evaluation...");

  const result = evaluateButtonAccessibility(currentReactCode, currentCssCode);
  const passCount = result.findings.filter((f) => f.status === "Pass").length;
  const failCount = result.findings.filter((f) => f.status === "Fail").length;
  const unknownCount = result.unknownCount;
  const scoreValue = result.healthScore;

  setEvaluationResult(result);
  if (currentMode === "dark") {
    setDarkResult(result);
  } else {
    setLightResult(result);
  }
  setEvaluatedMode(currentMode);
  setEvaluationSignature(newSignature);
  setEvaluationStateMessage(
    `Complete: ${scoreValue}/100 — ${passCount} pass, ${unknownCount} unknown, ${failCount} fail.`
  );
  setIsEvaluating(false);

  // The score and findings above are already rendered. The Claude summary is
  // additive and needs the local service, so skip it when hosted.
  if (!IS_BACKEND_REACHABLE) {
    return;
  }

  setIsClaudeSummaryLoading(true);
  try {
    const response = await fetch(`${BACKEND_ORIGIN}/rag-query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: "Summarize the accessibility health result for this component.",
        useClaude: true,
        componentContext: `Score: ${scoreValue}/100 — ${passCount} pass, ${unknownCount} unknown, ${failCount} fail.`,
        evaluationContext: {
          evaluatedMode: currentMode,
          score: scoreValue,
          passCount,
          unknownCount,
          failCount,
          findings: result.findings,
        },
      }),
    });
    const data = await response.json();
    const summary = data?.outputFormat?.summary;
    if (summary) setClaudeSummary(summary);
  } catch {
    // silently fail — local summary remains
  } finally {
    setIsClaudeSummaryLoading(false);
  }
};

  const handleA11yDoubleCheck = async () => {
    if (!evaluationResult) return;

    const currentCssCode = previewTheme === "dark" ? SAMPLE_BUTTON_CSS_DARK : cssCode;

    const selectedFinding = selectedFindingRuleId
      ? evaluationResult.findings.find((f) => f.ruleId === selectedFindingRuleId) ?? null
      : null;
    const findingsPayload = selectedFinding
      ? JSON.stringify([selectedFinding])
      : JSON.stringify(evaluationResult.findings);

    // Defensive: the control is rendered as unavailable when the backend cannot
    // be reached, so this should not be callable. State the limitation plainly
    // rather than reporting a failure if it somehow is.
    if (!IS_BACKEND_REACHABLE) {
      setA11yDoubleCheckError(
        "A11Y DoubleCheck runs against the local Python service and is not available in this hosted demo."
      );
      return;
    }

    setIsDoubleChecking(true);
    setA11yDoubleCheckError(null);

    try {
      const response = await fetch(`${BACKEND_ORIGIN}/a11y-doublecheck`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          componentCode: reactCode,
          cssCode: currentCssCode,
          selectedThemeMode: previewTheme,
          selectedFindingRuleId: selectedFindingRuleId ?? null,
          accessibilityFindings: findingsPayload,
          recommendedFix: evaluationResult.recommendedFixes.join("; ") || "no_fix",
        }),
      });

      const data = await response.json();
      console.log("A11Y DoubleCheck response:", data);
      const parsedResult = data.xmlResult ? parseA11yDoubleCheckXml(data.xmlResult) : null;
      console.log("Parsed A11Y DoubleCheck result:", parsedResult);
      setA11yDoubleCheckResult(parsedResult);
      setDoubleCheckEvaluationSignature(evaluationSignature);
    } catch (error) {
      console.error("A11Y DoubleCheck error:", error);
      setA11yDoubleCheckError(
        "Could not reach the A11Y DoubleCheck service on port 5001. Check that app.py is running."
      );
    } finally {
      setIsDoubleChecking(false);
    }
  };

  return (
    <div className="app-root">
      <TopBar />
      <main className="main-layout">
        <nav className="utility-rail" aria-label="Utility navigation">
          <button type="button">Files</button>
          <button type="button">Git</button>
        </nav>
        <WorkspacePane
          reactCode={reactCode}
          cssCode={cssCode}
          hasLoadedComponentCode={hasLoadedComponentCode}
          evaluationResult={evaluationResult}
          selectedFindingRuleId={selectedFindingRuleId}
          isEvaluating={isEvaluating}
          onReactCodeChange={setReactCode}
          onCssCodeChange={setCssCode}
          loadedComponentName={loadedComponentName}
          onLoadSample={handleLoadSample}
          onEvaluate={handleEvaluate}
          previewTheme={previewTheme}
          onPreviewThemeChange={handlePreviewThemeChange}
          isPanelOpen={isPanelOpen}
          onTogglePanel={togglePanel}
          onA11yDoubleCheck={handleA11yDoubleCheck}
          isDoubleChecking={isDoubleChecking}
          a11yDoubleCheckError={a11yDoubleCheckError}
          isBackendReachable={IS_BACKEND_REACHABLE}
        />
        <OrchestratorPanel
          isOpen={isPanelOpen}
          evaluationStateMessage={evaluationStateMessage}
          evaluationResult={evaluationResult}
          lightResult={lightResult}
          darkResult={darkResult}
          loadedComponentName={loadedComponentName}
          selectedFindingRuleId={selectedFindingRuleId}
          onSelectFinding={setSelectedFindingRuleId}
          evaluatedMode={evaluatedMode}
          a11yDoubleCheckResult={a11yDoubleCheckResult}
          evaluationSignature={evaluationSignature}
          doubleCheckEvaluationSignature={doubleCheckEvaluationSignature}
          claudeSummary={claudeSummary}
          isClaudeSummaryLoading={isClaudeSummaryLoading}
        />
      </main>
      <footer className="app-footer">
        <p className="app-footer__notice">
          All contents, designs &amp; strategies are the proprietary materials of Craig
          Maher and orchestratorlabs © 2026. All rights reserved.
        </p>
        {/*
          Separators are their own aria-hidden spans rather than CSS ::before
          content, which some screen readers announce as part of the link name.
          Links are underlined at rest so they are not signalled by colour alone.
        */}
        <nav className="app-footer__links" aria-label="About OrchestratoR">
          <a href="https://craigmaherportfolio.com/case-studies/" target="_blank" rel="noopener noreferrer">
            Case study
          </a>
          <span aria-hidden="true">·</span>
          <a href="https://github.com/orchestratorlabs/orchestrator" target="_blank" rel="noopener noreferrer">
            Source
          </a>
          <span aria-hidden="true">·</span>
          <a href="https://craigmaherportfolio.com/contact" target="_blank" rel="noopener noreferrer">
            Contact
          </a>
          <span aria-hidden="true">·</span>
          <a
            href="https://github.com/orchestratorlabs/orchestrator/blob/main/LICENSE"
            target="_blank"
            rel="noopener noreferrer"
          >
            Licence
          </a>
        </nav>
      </footer>
    </div>
  );
}
