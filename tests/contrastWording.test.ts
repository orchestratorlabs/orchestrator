// Run with: npm test
//
// Pins the wording of the Text Contrast rule's evidence. WCAG 2.1 SC 1.4.3 exempts
// inactive (disabled) controls, so only the ACTIVE button's contrast is a WCAG
// assessment; the disabled label's measured contrast is "OrchestratoR readability
// check". The evaluator's rules, thresholds and Health Score are unchanged — this
// file checks wording only, plus the two places that depend on it:
//   - the editor annotation matches "disabled-state" in a Fail's evidence, and the
//     local score summary matches the two disabled colours;
//   - the backend's rule-based fallback reads the word "fail" in the findings as a
//     failure signal, so Pass evidence must not contain it.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateButtonAccessibility } from "../src/features/orchestrator/evaluator/buttonEvaluator";
import {
  SAMPLE_BUTTON_CSS,
  SAMPLE_BUTTON_CSS_DARK,
  SAMPLE_BUTTON_TSX,
} from "../src/features/workspace/WorkspacePane";

const rule5 = (css: string) =>
  evaluateButtonAccessibility(SAMPLE_BUTTON_TSX, css).findings.find((f) => f.ruleId === "rule-5-text-contrast")!;

const READABILITY = "OrchestratoR readability check";

describe("Text Contrast evidence wording", () => {
  it("dark sample: WCAG statement covers the active button only, disabled is a readability check", () => {
    const finding = rule5(SAMPLE_BUTTON_CSS_DARK);
    assert.equal(finding.status, "Pass");
    const [wcagPart, readabilityPart] = finding.evidence.split(READABILITY);
    assert.ok(readabilityPart, "evidence has a readability-check sentence");
    // measured ratios, kept in separate statements
    assert.match(wcagPart, /WCAG 2\.1 SC 1\.4\.3 \(active button\): default text contrast 8\.51:1/);
    assert.doesNotMatch(wcagPart, /4\.77/);
    assert.match(readabilityPart, /4\.77:1/);
    assert.match(readabilityPart, /SC 1\.4\.3 exempts inactive controls/);
    assert.match(readabilityPart, /not a WCAG measurement/);
  });

  it("never says disabled text meets or satisfies the WCAG threshold", () => {
    const evidence = rule5(SAMPLE_BUTTON_CSS_DARK).evidence;
    assert.doesNotMatch(evidence, /both >= 4\.5:1/);
    assert.doesNotMatch(evidence, /disabled[^.]*WCAG[^.]*(meets|satisfies|passes)/i);
  });

  it("light sample: the disabled figure is a readability check and not a WCAG failure", () => {
    const finding = rule5(SAMPLE_BUTTON_CSS);
    assert.equal(finding.status, "Fail"); // the rule itself is unchanged
    assert.equal(finding.severity, "High");
    assert.match(finding.evidence, new RegExp(`${READABILITY} \\(disabled-state;`));
    assert.match(finding.evidence, /1\.79:1 \(< 4\.5:1\)/);
    assert.match(finding.evidence, /WCAG 2\.1 SC 1\.4\.3 \(active button\): default text contrast 9\.02:1 \(>= 4\.5:1\)/);
    assert.match(finding.recommendation, /OrchestratoR's readability check/);
    assert.match(finding.recommendation, /does not require this for inactive controls, but your design system may/);
    assert.match(finding.recommendation, /Check your design system's disabled-state contrast requirement before deciding/);
    // A check to make, not a verdict: never says the design system does require it.
    assert.doesNotMatch(finding.recommendation, /design system (does|requires|mandates)/i);
  });

  it("keeps what the editor annotation and the local score summary match on", () => {
    const evidence = rule5(SAMPLE_BUTTON_CSS).evidence;
    assert.ok(evidence.includes("disabled-state"));
    assert.ok(evidence.includes("#8C8C8C"));
    assert.ok(evidence.includes("#BDBDBD"));
  });

  it('keeps the word "fail" out of Pass evidence, which the backend fallback would read as a failure', () => {
    assert.doesNotMatch(rule5(SAMPLE_BUTTON_CSS_DARK).evidence.toLowerCase(), /fail/);
  });

  it("a failing ACTIVE button does not mention the disabled state, so it is annotated at the base block", () => {
    const css = SAMPLE_BUTTON_CSS.replace("--Text-On-Brand: #FFFFFF", "--Text-On-Brand: #0540AB").replace(
      "--Text-Disabled: #8C8C8C",
      "--Text-Disabled: #494949"
    );
    const finding = rule5(css);
    assert.equal(finding.status, "Fail");
    assert.match(finding.evidence, /WCAG 2\.1 SC 1\.4\.3 \(active button\)/);
    assert.ok(!finding.evidence.includes("disabled-state"));
  });

  it("leaves the score and the deduction untouched", () => {
    const light = evaluateButtonAccessibility(SAMPLE_BUTTON_TSX, SAMPLE_BUTTON_CSS);
    const dark = evaluateButtonAccessibility(SAMPLE_BUTTON_TSX, SAMPLE_BUTTON_CSS_DARK);
    assert.equal(light.healthScore, 85);
    assert.equal(dark.healthScore, 100);
  });
});
