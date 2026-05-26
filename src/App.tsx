import { TopBar } from "./features/orchestrator/components/TopBar";
import { OrchestratorPanel } from "./features/orchestrator/components/OrchestratorPanel";
import { useOrchestratorState } from "./features/orchestrator/state/orchestratorState";
import { SAMPLE_BUTTON_CSS, SAMPLE_BUTTON_CSS_DARK, SAMPLE_BUTTON_TSX, WorkspacePane } from "./features/workspace/WorkspacePane";
import { useState } from "react";
import { evaluateButtonAccessibility } from "./features/orchestrator/evaluator/buttonEvaluator";
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
  const [selectedFindingRuleId, setSelectedFindingRuleId] = useState<string | null>(null);
  const [previewTheme, setPreviewTheme] = useState<"light" | "dark">("light");
  const [evaluatedMode, setEvaluatedMode] = useState<"light" | "dark" | null>(null);
  const [isDoubleChecking, setIsDoubleChecking] = useState(false);
  const [a11yDoubleCheckResult, setA11yDoubleCheckResult] = useState<A11yDoubleCheckResult | null>(null);
  const [a11yDoubleCheckError, setA11yDoubleCheckError] = useState<string | null>(null);
  const [evaluationSignature, setEvaluationSignature] = useState<string | null>(null);
  const [doubleCheckEvaluationSignature, setDoubleCheckEvaluationSignature] = useState<string | null>(null);
  const [claudeAnalysis, setClaudeAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handlePreviewThemeChange = (theme: "light" | "dark") => {
    setPreviewTheme(theme);
    setEvaluationResult(null);
    setSelectedFindingRuleId(null);
    setEvaluatedMode(null);
    setEvaluationSignature(null);
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
  setEvaluationSignature(null);
  setEvaluationStateMessage(
    "Component code loaded. Select a button state and run the accessibility check."
  );

  try {
    const response = await fetch("http://127.0.0.1:5001/echo", {
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
  setClaudeAnalysis(null);
  setEvaluationStateMessage("Running accessibility evaluation...");

  const result = evaluateButtonAccessibility(currentReactCode, currentCssCode);
  const passCount = result.findings.filter((f) => f.status === "Pass").length;
  const failCount = result.findings.filter((f) => f.status === "Fail").length;
  const unknownCount = result.unknownCount;
  const scoreValue = result.healthScore;

  setEvaluationResult(result);
  setEvaluatedMode(currentMode);
  setEvaluationSignature(newSignature);
  setEvaluationStateMessage(
    `Complete: ${scoreValue}/100 — ${passCount} pass, ${unknownCount} unknown, ${failCount} fail.`
  );
  setIsEvaluating(false);

  setIsAnalyzing(true);
  try {
    const question = failCount > 0
      ? "Explain the accessibility failures found in this component and how to fix them."
      : "Explain why this component passed all accessibility checks.";

    const response = await fetch("http://127.0.0.1:5001/rag-query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question,
        useClaude: true,
        componentContext: `Score: ${scoreValue}/100. Pass: ${passCount}, Unknown: ${unknownCount}, Fail: ${failCount}.`,
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
    if (response.ok && data.answer) {
      setClaudeAnalysis(data.answer);
    }
  } catch {
    // analysis is best-effort, don't surface error
  } finally {
    setIsAnalyzing(false);
  }
};

  const handleA11yDoubleCheck = async () => {
    if (!evaluationResult) return;

    const currentCssCode = previewTheme === "dark" ? SAMPLE_BUTTON_CSS_DARK : cssCode;

    setIsDoubleChecking(true);
    setA11yDoubleCheckError(null);

    try {
      const response = await fetch("http://localhost:5001/a11y-doublecheck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          componentCode: reactCode,
          cssCode: currentCssCode,
          selectedThemeMode: previewTheme,
          accessibilityFindings: JSON.stringify(evaluationResult.findings),
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
      setA11yDoubleCheckError("A11Y DoubleCheck request failed.");
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
          onTogglePanel={togglePanel}
          onA11yDoubleCheck={handleA11yDoubleCheck}
          isDoubleChecking={isDoubleChecking}
          a11yDoubleCheckError={a11yDoubleCheckError}
        />
        <OrchestratorPanel
          isOpen={isPanelOpen}
          evaluationStateMessage={evaluationStateMessage}
          evaluationResult={evaluationResult}
          selectedFindingRuleId={selectedFindingRuleId}
          onSelectFinding={setSelectedFindingRuleId}
          evaluatedMode={evaluatedMode}
          a11yDoubleCheckResult={a11yDoubleCheckResult}
          evaluationSignature={evaluationSignature}
          doubleCheckEvaluationSignature={doubleCheckEvaluationSignature}
          claudeAnalysis={claudeAnalysis}
          isAnalyzing={isAnalyzing}
        />
      </main>
    </div>
  );
}
