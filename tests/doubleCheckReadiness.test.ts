// Run with: npm test
//
// Covers what the A11Y DoubleCheck card is allowed to claim and when a component
// may be approved: the explicit "ship ready" match, scope (all findings vs one
// finding), Unknown handling, freshness, per-theme cached results, and the
// Evaluate -> edit -> DoubleCheck regression.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateButtonAccessibility } from "../src/features/orchestrator/evaluator/buttonEvaluator";
import {
  EVALUATION_OUTDATED_MESSAGE,
  buildDoubleCheckDisplay,
  buildDoubleCheckSnapshot,
  buildEvaluationInputs,
  checkDoubleCheckPreconditions,
  describeCssSource,
  isDoubleCheckCurrent,
  isShipReadyVerdict,
  themeSectionTag,
  verdictPasses,
  type DoubleCheckScope,
  type DoubleCheckSnapshot,
} from "../src/features/orchestrator/doubleCheckReadiness";
import {
  SAMPLE_BUTTON_CSS,
  SAMPLE_BUTTON_CSS_DARK,
  SAMPLE_BUTTON_TSX,
} from "../src/features/workspace/WorkspacePane";
import type {
  A11yDoubleCheckResult,
  RuleResult,
} from "../src/features/orchestrator/types/evaluation";

const RAW_MODEL_SUMMARY = "Everything is fine. This component is ready to ship.";

function modelResult(overrides: Partial<A11yDoubleCheckResult> = {}): A11yDoubleCheckResult {
  return {
    status: "PASS",
    confidenceScore: "97",
    shipReadiness: "Ship Ready",
    summary: RAW_MODEL_SUMMARY,
    sourcesChecked: [],
    evidenceSummary: "",
    verifiedItems: [],
    remainingRisks: [],
    recommendedNextStep: "All checks pass. This component is ready to ship.",
    ...overrides,
  };
}

function finding(status: RuleResult["status"], n: number): RuleResult {
  return {
    ruleId: `rule-${n}`,
    ruleName: `Rule ${n}`,
    status,
    evidence: "",
    severity: "Low",
    recommendation: "",
    sourceReference: "",
  };
}

const darkInputs = () =>
  buildEvaluationInputs(SAMPLE_BUTTON_TSX, SAMPLE_BUTTON_CSS, "dark", SAMPLE_BUTTON_CSS_DARK);
const lightInputs = () =>
  buildEvaluationInputs(SAMPLE_BUTTON_TSX, SAMPLE_BUTTON_CSS, "light", SAMPLE_BUTTON_CSS_DARK);

function snapshotFor(findings: RuleResult[], scope: DoubleCheckScope = { kind: "all" }): DoubleCheckSnapshot {
  return buildDoubleCheckSnapshot(darkInputs(), scope, findings);
}

describe("isShipReadyVerdict", () => {
  const cases: Array<[string, boolean]> = [
    ["Ship Ready", true],
    [" ship  ready ", true],
    ["SHIP READY", true],
    ["Not Ship Ready", false],
    ["Ship Ready with caveats", false],
    ["Ship Ready.", false],
    ["Ship With Caution", false],
    ["Do Not Ship", false],
    ["", false],
  ];
  for (const [value, expected] of cases) {
    it(`${JSON.stringify(value)} -> ${expected}`, () => {
      assert.equal(isShipReadyVerdict(value), expected);
    });
  }

  it("verdictPasses keeps the PASS and zero-remaining-risks requirements", () => {
    assert.equal(verdictPasses(modelResult()), true);
    assert.equal(verdictPasses(modelResult({ status: "PARTIAL" })), false);
    assert.equal(verdictPasses(modelResult({ remainingRisks: ["something"] })), false);
    assert.equal(verdictPasses(modelResult({ shipReadiness: "Not Ship Ready" })), false);
  });
});

describe("buildDoubleCheckDisplay — all findings", () => {
  it("passes a component when every applicable finding passed, excluding N/A", () => {
    const findings = [...Array.from({ length: 9 }, (_, i) => finding("Pass", i)), finding("N/A", 9)];
    const display = buildDoubleCheckDisplay(modelResult(), snapshotFor(findings));
    assert.equal(display.canApprove, true);
    assert.equal(display.headline, "Component checks passed");
    assert.equal(display.approve, "enabled");
    // Both buttons are on offer, so there is no next-step heading or sentence to show.
    assert.equal(display.showNextStep, false);
    assert.equal(display.nextStep, null);
    assert.equal(
      display.approvalScopeLine,
      "Approval covers the 10 dark-mode findings. Preview observations are reported separately."
    );
    assert.match(display.summary, /all 10 evaluated findings for Dark mode \(9 Pass, 0 Unknown, 1 N\/A\)/);
  });

  it('shows "Component checks passed" exactly once across the visible copy', () => {
    const findings = [finding("Pass", 1), finding("Pass", 2)];
    const display = buildDoubleCheckDisplay(modelResult(), snapshotFor(findings));
    const visible = [
      display.headline,
      display.extraChip,
      display.caption,
      display.summary,
      display.nextStep,
      display.approvalNotice,
    ]
      .filter(Boolean)
      .join("\n");
    assert.equal(visible.split("Component checks passed").length - 1, 1);
  });

  it("is not approvable when no applicable finding was evaluated", () => {
    const display = buildDoubleCheckDisplay(modelResult(), snapshotFor([finding("N/A", 1), finding("N/A", 2)]));
    assert.equal(display.canApprove, false);
    assert.notEqual(display.headline, "Component checks passed");
    assert.equal(display.approve, "unavailable");
  });

  it('shows "Review incomplete" with the unverified count when any finding is Unknown', () => {
    const findings = [finding("Pass", 1), finding("Unknown", 2), finding("Unknown", 3), finding("N/A", 4)];
    const display = buildDoubleCheckDisplay(modelResult(), snapshotFor(findings));
    assert.equal(display.canApprove, false);
    assert.equal(display.headlineKind, "review-incomplete");
    assert.equal(display.headline, "Review incomplete — 2 unverified");
    assert.equal(display.approve, "unavailable");
    assert.match(display.approvalNotice ?? "", /2 findings are unverified/);
    assert.match(display.summary, /2 could not be verified/);
  });

  it("uses the singular for one unverified finding", () => {
    const display = buildDoubleCheckDisplay(modelResult(), snapshotFor([finding("Pass", 1), finding("Unknown", 2)]));
    assert.equal(display.headline, "Review incomplete — 1 unverified");
    assert.match(display.approvalNotice ?? "", /1 finding is unverified/);
  });

  it("keeps the existing chips and adds an unverified chip when the verdict does not pass", () => {
    const display = buildDoubleCheckDisplay(
      modelResult({ status: "PARTIAL", shipReadiness: "Ship With Caution", remainingRisks: ["x"] }),
      snapshotFor([finding("Pass", 1), finding("Unknown", 2)])
    );
    assert.equal(display.headlineKind, "default");
    assert.equal(display.extraChip, "Review incomplete — 1 unverified");
    assert.equal(display.canApprove, false);
  });

  it("is not approvable when a finding failed", () => {
    const display = buildDoubleCheckDisplay(modelResult(), snapshotFor([finding("Pass", 1), finding("Fail", 2)]));
    assert.equal(display.canApprove, false);
    assert.equal(display.approve, "hidden");
  });

  it('never lets "Not Ship Ready" qualify, and explains why', () => {
    const display = buildDoubleCheckDisplay(
      modelResult({ shipReadiness: "Not Ship Ready" }),
      snapshotFor([finding("Pass", 1)])
    );
    assert.equal(display.canApprove, false);
    assert.equal(display.approve, "hidden");
    assert.match(display.approvalNotice ?? "", /not a clear pass/);
  });

  it("keeps the PASS and zero-remaining-risks requirements", () => {
    const findings = [finding("Pass", 1)];
    assert.equal(
      buildDoubleCheckDisplay(modelResult({ status: "PARTIAL" }), snapshotFor(findings)).canApprove,
      false
    );
    assert.equal(
      buildDoubleCheckDisplay(modelResult({ remainingRisks: ["a risk"] }), snapshotFor(findings)).canApprove,
      false
    );
  });
});

describe("approval scope line", () => {
  it("is generated from the reviewed snapshot: its finding count and theme", () => {
    const light = buildDoubleCheckSnapshot(lightInputs(), { kind: "all" }, [finding("Pass", 1), finding("Pass", 2), finding("N/A", 3)]);
    const display = buildDoubleCheckDisplay(modelResult(), light);
    assert.equal(
      display.approvalScopeLine,
      "Approval covers the 3 light-mode findings. Preview observations are reported separately."
    );
  });

  it("uses the singular for one finding", () => {
    assert.equal(
      buildDoubleCheckDisplay(modelResult(), snapshotFor([finding("Pass", 1)])).approvalScopeLine,
      "Approval covers the 1 dark-mode finding. Preview observations are reported separately."
    );
  });

  it("is only present when approval is enabled", () => {
    const states = [
      buildDoubleCheckDisplay(modelResult(), snapshotFor([finding("Pass", 1), finding("Unknown", 2)])), // incomplete
      buildDoubleCheckDisplay(modelResult(), snapshotFor([finding("Pass", 1)], { kind: "finding", ruleId: "rule-1", ruleName: "Rule 1", status: "Pass" })), // selected finding
      buildDoubleCheckDisplay(modelResult({ status: "FAIL", shipReadiness: "Do Not Ship", remainingRisks: ["x"] }), snapshotFor([finding("Pass", 1)])),
    ];
    for (const display of states) {
      assert.equal(display.approvalScopeLine, null);
      assert.notEqual(display.approve, "enabled");
    }
  });
});

describe("next-step guidance outside the approvable state", () => {
  it("keeps actionable guidance for the selected-finding state", () => {
    const display = buildDoubleCheckDisplay(
      modelResult(),
      snapshotFor([finding("Pass", 1)], { kind: "finding", ruleId: "rule-1", ruleName: "Rule 1", status: "Pass" })
    );
    assert.equal(display.showNextStep, true);
    assert.equal(display.nextStep, "Run DoubleCheck on all findings to enable component approval.");
  });

  it("keeps actionable guidance for the incomplete state", () => {
    const display = buildDoubleCheckDisplay(modelResult(), snapshotFor([finding("Pass", 1), finding("Unknown", 2)]));
    assert.equal(display.showNextStep, true);
    assert.match(display.nextStep ?? "", /Verify the 1 unverified finding/);
  });

  it("keeps the backend's next step when the verdict does not pass", () => {
    const display = buildDoubleCheckDisplay(
      modelResult({ status: "FAIL", shipReadiness: "Do Not Ship", remainingRisks: ["x"] }),
      snapshotFor([finding("Pass", 1)])
    );
    assert.equal(display.showNextStep, true);
    assert.equal(display.nextStep, null); // null = show the backend's own text
  });
});

describe("buildDoubleCheckDisplay — selected finding", () => {
  const scope: DoubleCheckScope = { kind: "finding", ruleId: "rule-1", ruleName: "Rule 1", status: "Pass" };

  it('shows "Selected finding passed", never approves, and offers the all-findings run', () => {
    const display = buildDoubleCheckDisplay(modelResult(), snapshotFor([finding("Pass", 1)], scope));
    assert.equal(display.headline, "Selected finding passed");
    assert.notEqual(display.headline, "Component checks passed");
    assert.equal(display.canApprove, false);
    assert.equal(display.approve, "unavailable");
    assert.equal(display.showRunAll, true);
    assert.equal(display.approvalNotice, "Approval requires DoubleCheck on all findings.");
    assert.equal(display.nextStep, "Run DoubleCheck on all findings to enable component approval.");
  });

  it("reports a DoubleCheck pass on a selected Unknown finding as one finding only", () => {
    const unknownScope: DoubleCheckScope = { kind: "finding", ruleId: "rule-4", ruleName: "Rule 4", status: "Unknown" };
    const display = buildDoubleCheckDisplay(modelResult(), snapshotFor([finding("Unknown", 4)], unknownScope));
    assert.equal(display.headline, "Selected finding passed");
    assert.equal(display.canApprove, false);
    assert.equal(display.approve, "unavailable");
    assert.equal(display.showRunAll, true);
  });

  it("does not report a pass for a selected finding when the verdict does not pass", () => {
    const display = buildDoubleCheckDisplay(
      modelResult({ status: "PARTIAL", shipReadiness: "Ship With Caution", remainingRisks: ["x"] }),
      snapshotFor([finding("Unknown", 4)], { kind: "finding", ruleId: "rule-4", ruleName: "Rule 4", status: "Unknown" })
    );
    assert.equal(display.headlineKind, "default");
  });

  it("offers the all-findings run for any single-finding result, passing or not", () => {
    const display = buildDoubleCheckDisplay(
      modelResult({ status: "FAIL", shipReadiness: "Do Not Ship", remainingRisks: ["x"] }),
      snapshotFor([finding("Pass", 1)], scope)
    );
    assert.equal(display.showRunAll, true);
    assert.equal(display.canApprove, false);
  });

  it("does not offer the all-findings run after an all-findings run", () => {
    assert.equal(buildDoubleCheckDisplay(modelResult(), snapshotFor([finding("Pass", 1)])).showRunAll, false);
  });
});

describe("reviewer-facing summary", () => {
  it('describes the scope actually reviewed, even when the raw model says "ready to ship"', () => {
    const result = modelResult();
    const single = buildDoubleCheckDisplay(
      result,
      snapshotFor([finding("Pass", 1)], { kind: "finding", ruleId: "rule-1", ruleName: "Rule 1", status: "Pass" })
    );
    const all = buildDoubleCheckDisplay(result, snapshotFor([finding("Pass", 1), finding("Pass", 2)]));

    assert.match(single.summary, /reviewed one finding — Rule 1 — for Dark mode/);
    assert.match(single.summary, /Other findings were not reviewed by this run/);
    assert.match(all.summary, /reviewed all 2 evaluated findings for Dark mode/);
    for (const summary of [single.summary, all.summary]) {
      assert.doesNotMatch(summary, /ready to ship/i);
      assert.doesNotMatch(summary, /everything is fine/i);
    }
  });

  it("preserves the raw model response unchanged", () => {
    const result = modelResult();
    buildDoubleCheckDisplay(result, snapshotFor([finding("Pass", 1)]));
    assert.equal(result.summary, RAW_MODEL_SUMMARY);
    assert.equal(result.shipReadiness, "Ship Ready");
    assert.equal(result.recommendedNextStep, "All checks pass. This component is ready to ship.");
  });
});

describe("real evaluator on the sample Button", () => {
  it("dark sample: every applicable finding passes, N/A excluded, so it is approvable", () => {
    const evaluation = evaluateButtonAccessibility(SAMPLE_BUTTON_TSX, SAMPLE_BUTTON_CSS_DARK);
    assert.equal(evaluation.healthScore, 100);
    const display = buildDoubleCheckDisplay(modelResult(), snapshotFor(evaluation.findings));
    assert.equal(display.canApprove, true);
    assert.equal(display.headline, "Component checks passed");
  });

  it("light sample: the disabled-contrast Fail keeps it from being approvable", () => {
    const evaluation = evaluateButtonAccessibility(SAMPLE_BUTTON_TSX, SAMPLE_BUTTON_CSS);
    assert.equal(evaluation.healthScore, 85);
    const snapshot = buildDoubleCheckSnapshot(lightInputs(), { kind: "all" }, evaluation.findings);
    assert.equal(buildDoubleCheckDisplay(modelResult(), snapshot).canApprove, false);
  });
});

describe("freshness", () => {
  const snapshot = (inputs = darkInputs()) => buildDoubleCheckSnapshot(inputs, { kind: "all" }, []);

  it("is current only when signatures and inputs both match", () => {
    const base = {
      evaluationSignature: "1",
      doubleCheckEvaluationSignature: "1",
      snapshot: snapshot(),
      currentInputs: darkInputs(),
    };
    assert.equal(isDoubleCheckCurrent(base), true);
    assert.equal(isDoubleCheckCurrent({ ...base, doubleCheckEvaluationSignature: "0" }), false);
    assert.equal(isDoubleCheckCurrent({ ...base, snapshot: null }), false);
  });

  it("treats any React edit, even whitespace, as a change", () => {
    const edited = buildEvaluationInputs(SAMPLE_BUTTON_TSX + " ", SAMPLE_BUTTON_CSS, "dark", SAMPLE_BUTTON_CSS_DARK);
    assert.equal(
      isDoubleCheckCurrent({
        evaluationSignature: "1",
        doubleCheckEvaluationSignature: "1",
        snapshot: snapshot(),
        currentInputs: edited,
      }),
      false
    );
  });

  it("treats a theme switch as a change", () => {
    assert.equal(
      isDoubleCheckCurrent({
        evaluationSignature: "1",
        doubleCheckEvaluationSignature: "1",
        snapshot: snapshot(),
        currentInputs: lightInputs(),
      }),
      false
    );
  });
});

describe("regression: Evaluate -> edit -> DoubleCheck", () => {
  it("allows DoubleCheck when nothing changed since Evaluate", () => {
    const evaluated = lightInputs();
    evaluateButtonAccessibility(evaluated.reactCode, evaluated.effectiveCss);
    assert.deepEqual(checkDoubleCheckPreconditions(evaluated, lightInputs()), { ok: true });
  });

  it("blocks DoubleCheck after the React code is edited, and asks for a re-run", () => {
    const evaluated = lightInputs();
    evaluateButtonAccessibility(evaluated.reactCode, evaluated.effectiveCss);
    const edited = buildEvaluationInputs(
      SAMPLE_BUTTON_TSX.replace("Button large", "Button huge"),
      SAMPLE_BUTTON_CSS,
      "light",
      SAMPLE_BUTTON_CSS_DARK
    );
    const gate = checkDoubleCheckPreconditions(evaluated, edited);
    assert.equal(gate.ok, false);
    assert.equal(gate.ok === false && gate.message, EVALUATION_OUTDATED_MESSAGE);
    assert.match(EVALUATION_OUTDATED_MESSAGE, /Run Accessibility Check again/);
  });

  it("blocks DoubleCheck after the CSS is edited in light mode", () => {
    const evaluated = lightInputs();
    const edited = buildEvaluationInputs(
      SAMPLE_BUTTON_TSX,
      SAMPLE_BUTTON_CSS + "\n/* edit */",
      "light",
      SAMPLE_BUTTON_CSS_DARK
    );
    assert.equal(checkDoubleCheckPreconditions(evaluated, edited).ok, false);
  });

  it("blocks DoubleCheck after a theme switch without re-evaluating", () => {
    assert.equal(checkDoubleCheckPreconditions(lightInputs(), darkInputs()).ok, false);
  });

  it("blocks DoubleCheck when nothing has been evaluated", () => {
    assert.equal(checkDoubleCheckPreconditions(null, lightInputs()).ok, false);
  });

  it("dark mode evaluates the built-in sample CSS, so editor CSS edits do not matter there", () => {
    const evaluated = darkInputs();
    const editorCssEdited = buildEvaluationInputs(
      SAMPLE_BUTTON_TSX,
      SAMPLE_BUTTON_CSS + "\n/* edit */",
      "dark",
      SAMPLE_BUTTON_CSS_DARK
    );
    assert.equal(evaluated.effectiveCss, SAMPLE_BUTTON_CSS_DARK);
    assert.deepEqual(checkDoubleCheckPreconditions(evaluated, editorCssEdited), { ok: true });
  });
});

describe("CSS source labelling", () => {
  it("names the built-in dark sample in dark mode and the editor CSS in light mode", () => {
    assert.match(describeCssSource("dark"), /built-in sample dark CSS/);
    assert.match(describeCssSource("dark"), /read-only/);
    assert.equal(describeCssSource("light"), "the CSS in the editor");
  });
});

describe("themeSectionTag (cached per-theme results)", () => {
  const current = lightInputs();

  it("marks the approved theme's current result as the approved result", () => {
    assert.equal(
      themeSectionTag({ theme: "light", hasResult: true, resultInputs: current, currentInputs: current, approvedTheme: "light" }),
      "Approved result"
    );
  });

  it("marks a current but non-approved theme as not covered", () => {
    assert.equal(
      themeSectionTag({ theme: "dark", hasResult: true, resultInputs: darkInputs(), currentInputs: darkInputs(), approvedTheme: "light" }),
      "Not covered by this approval"
    );
  });

  it("marks a dark result cached before a React edit as a previous result", () => {
    const cachedBeforeEdit = darkInputs();
    const afterEdit = buildEvaluationInputs(SAMPLE_BUTTON_TSX + "\n", SAMPLE_BUTTON_CSS, "dark", SAMPLE_BUTTON_CSS_DARK);
    assert.equal(
      themeSectionTag({ theme: "dark", hasResult: true, resultInputs: cachedBeforeEdit, currentInputs: afterEdit, approvedTheme: "light" }),
      "Previous result — re-run to update"
    );
  });

  it("returns no tag for a theme that was never evaluated", () => {
    assert.equal(
      themeSectionTag({ theme: "dark", hasResult: false, resultInputs: null, currentInputs: darkInputs(), approvedTheme: "light" }),
      null
    );
  });
});
