import { TopBar } from "./features/orchestrator/components/TopBar";
import { OrchestratorPanel } from "./features/orchestrator/components/OrchestratorPanel";
import { useOrchestratorState } from "./features/orchestrator/state/orchestratorState";
import { SAMPLE_BUTTON_CSS, SAMPLE_BUTTON_TSX, WorkspacePane } from "./features/workspace/WorkspacePane";
import { useState } from "react";
import { evaluateButtonAccessibility } from "./features/orchestrator/evaluator/buttonEvaluator";
import type { EvaluationResult } from "./features/orchestrator/types/evaluation";

export function App() {
  const { isPanelOpen, togglePanel } = useOrchestratorState();
  const [reactCode, setReactCode] = useState(SAMPLE_BUTTON_TSX);
  const [cssCode, setCssCode] = useState(SAMPLE_BUTTON_CSS);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluationStateMessage, setEvaluationStateMessage] = useState(
    "Sample button loaded. Ready to evaluate."
  );
  const [evaluationResult, setEvaluationResult] = useState<EvaluationResult | null>(null);
  const [selectedFindingRuleId, setSelectedFindingRuleId] = useState<string | null>(null);

  const handleLoadSample = () => {
    setReactCode(SAMPLE_BUTTON_TSX);
    setCssCode(SAMPLE_BUTTON_CSS);
    setSelectedFindingRuleId(null);
    setEvaluationStateMessage("Sample button loaded. Ready to evaluate.");
  };

  const handleEvaluate = () => {
    const currentReactCode = reactCode;
    const currentCssCode = cssCode;
    setIsEvaluating(true);
    setSelectedFindingRuleId(null);
    setEvaluationResult(null);
    setEvaluationStateMessage("Running accessibility check on current workspace code...");

    window.setTimeout(() => {
      const result = evaluateButtonAccessibility(currentReactCode, currentCssCode);
      setEvaluationResult(result);
      setEvaluationStateMessage(
        `Evaluation complete: ${result.findings.filter((f) => f.status === "Pass").length} pass, ${result.unknownCount} unknown, ${result.findings.filter((f) => f.status === "Fail").length} fail.`
      );
      setIsEvaluating(false);
    }, 0);
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
          evaluationResult={evaluationResult}
          selectedFindingRuleId={selectedFindingRuleId}
          isEvaluating={isEvaluating}
          onReactCodeChange={setReactCode}
          onCssCodeChange={setCssCode}
          onLoadSample={handleLoadSample}
          onEvaluate={handleEvaluate}
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
