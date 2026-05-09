import { TopBar } from "./features/orchestrator/components/TopBar";
import { OrchestratorPanel } from "./features/orchestrator/components/OrchestratorPanel";
import { useOrchestratorState } from "./features/orchestrator/state/orchestratorState";
import { SAMPLE_BUTTON_CSS, SAMPLE_BUTTON_TSX, WorkspacePane } from "./features/workspace/WorkspacePane";
import { useState } from "react";
import { evaluateButtonAccessibility } from "./features/orchestrator/evaluator/buttonEvaluator";
import type { EvaluationResult } from "./features/orchestrator/types/evaluation";

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

  const handleLoadSample = async () => {
  setReactCode(SAMPLE_BUTTON_TSX);
  setCssCode(SAMPLE_BUTTON_CSS);
  setHasLoadedComponentCode(true);
  setLoadedComponentName("Button");
  setSelectedFindingRuleId(null);
  setEvaluationResult(null);
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
  const currentCssCode = cssCode;

  setIsEvaluating(true);
  setSelectedFindingRuleId(null);
  setEvaluationResult(null);
  setEvaluationStateMessage("Sending component code to mock LLM accessibility reviewer...");

  try {
    const response = await fetch("http://127.0.0.1:5001/mock-llm", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        componentCode: currentReactCode,
        cssCode: currentCssCode,
      }),
    });

    await response.json();

    const result = evaluateButtonAccessibility(currentReactCode, currentCssCode);
    setEvaluationResult(result);

 const passCount = result.findings.filter((f) => f.status === "Pass").length;
 const failCount = result.findings.filter((f) => f.status === "Fail").length;
 const unknownCount = result.unknownCount;
 const scoreValue = result.healthScore;

setEvaluationStateMessage(
  `Mock LLM complete: ${scoreValue}/100 — Score ${scoreValue}/100 with ${passCount} pass, ${unknownCount} unknown, and ${failCount} fail findings.`
);
  } catch (error) {
    setEvaluationStateMessage(
      "Mock LLM request failed. Running local accessibility check instead."
    );

    const result = evaluateButtonAccessibility(currentReactCode, currentCssCode);
    setEvaluationResult(result);
  } finally {
    setIsEvaluating(false);
  }
};

  return (
    <div className="app-root">
      <TopBar onTogglePanel={togglePanel} />
      <main className="main-layout">
        <nav className="utility-rail" aria-label="Utility navigation">
          <button type="button">Files</button>
          <button type="button">Search</button>
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
          onPreviewThemeChange={setPreviewTheme}
        />
        <OrchestratorPanel
          isOpen={isPanelOpen}
          evaluationStateMessage={evaluationStateMessage}
          evaluationResult={evaluationResult}
          selectedFindingRuleId={selectedFindingRuleId}
          onSelectFinding={setSelectedFindingRuleId}
        />
      </main>
    </div>
  );
}
