// Run with: npm test
//
// Covers the Button evaluator's Rule 10 (ARIA Semantics) and Not Applicable
// handling, and pins the existing Rule 2 behaviour and the known-good baseline
// so neither moves by accident. Rule 10's -10 is PROVISIONAL (pending
// Accessibility SME review); see docs/ARIA-Score/ARIA_Score.md.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateButtonAccessibility } from "../src/features/orchestrator/evaluator/buttonEvaluator";
import {
  SAMPLE_BUTTON_CSS,
  SAMPLE_BUTTON_CSS_DARK,
  SAMPLE_BUTTON_TSX
} from "../src/features/workspace/WorkspacePane";
import type { EvaluationResult } from "../src/features/orchestrator/types/evaluation";

const RULE_2 = "rule-2-accessible-name";
const RULE_10 = "rule-10-aria-semantics";

/** Stylesheet used for the markup-only cases. Its contrast result is irrelevant to them. */
const CSS = SAMPLE_BUTTON_CSS_DARK;

function finding(result: EvaluationResult, ruleId: string) {
  const found = result.findings.find((f) => f.ruleId === ruleId);
  assert.ok(found, `expected a finding for ${ruleId}`);
  return found;
}

const evaluate = (markup: string, css = CSS) => evaluateButtonAccessibility(markup, css);

describe("known-good baseline is unchanged", () => {
  it("light sample scores 85 with one Fail and no Unknown", () => {
    const result = evaluate(SAMPLE_BUTTON_TSX, SAMPLE_BUTTON_CSS);
    assert.equal(result.healthScore, 85);
    assert.equal(result.unknownCount, 0);
    assert.deepEqual(
      result.findings.filter((f) => f.status === "Fail").map((f) => f.ruleId),
      ["rule-5-text-contrast"]
    );
  });

  it("dark sample scores 100 with no Fail and no Unknown", () => {
    const result = evaluate(SAMPLE_BUTTON_TSX, SAMPLE_BUTTON_CSS_DARK);
    assert.equal(result.healthScore, 100);
    assert.equal(result.unknownCount, 0);
    assert.equal(result.findings.filter((f) => f.status === "Fail").length, 0);
  });

  it("Rule 10 is Not Applicable on the sample, and does not count as a pass", () => {
    const result = evaluate(SAMPLE_BUTTON_TSX, SAMPLE_BUTTON_CSS_DARK);
    assert.equal(result.findings.length, 10);
    assert.equal(finding(result, RULE_10).status, "N/A");
    assert.equal(result.findings.filter((f) => f.status === "Pass").length, 9);
    assert.match(result.summary, /9 applicable rules passed \(1 not applicable\)/);
  });
});

describe("Case 1: native visible-text button", () => {
  const result = evaluate("<button>Submit</button>");

  it("Rule 2 passes on the visible text, with the icon check noted as N/A", () => {
    const rule2 = finding(result, RULE_2);
    assert.equal(rule2.status, "Pass");
    assert.match(rule2.evidence, /visible button label text/);
    assert.match(rule2.evidence, /Icon-specific check: N\/A/);
  });

  it("Rule 10 is N/A with the documented supporting copy", () => {
    const rule10 = finding(result, RULE_10);
    assert.equal(rule10.status, "N/A");
    assert.equal(
      rule10.evidence,
      "Native button semantics already provide the required role. Additional ARIA semantics are not required for this use case."
    );
  });

  it("does not require a redundant aria-label", () => {
    assert.equal(finding(result, RULE_2).status, "Pass");
    assert.ok(!result.recommendedFixes.some((fix) => /aria-label/.test(fix)));
  });
});

describe("Case 2: icon-only button with an accessible name", () => {
  const result = evaluate('<button aria-label="Delete"><TrashIcon /></button>');

  it("Rule 2 passes and Rule 10 is N/A", () => {
    assert.equal(finding(result, RULE_2).status, "Pass");
    assert.equal(finding(result, RULE_10).status, "N/A");
  });

  it("does not say there is no icon", () => {
    assert.doesNotMatch(finding(result, RULE_2).evidence, /no icon-only state/);
  });
});

describe("Case 3: icon-only button with no accessible name", () => {
  const named = evaluate('<button aria-label="Delete"><TrashIcon /></button>');
  const unnamed = evaluate("<button><TrashIcon /></button>");

  it("Rule 2 fails at Critical severity", () => {
    const rule2 = finding(unnamed, RULE_2);
    assert.equal(rule2.status, "Fail");
    assert.equal(rule2.severity, "Critical");
  });

  it("costs exactly 25 points, not 10", () => {
    assert.equal(named.healthScore - unnamed.healthScore, 25);
  });

  it("is not turned into a Rule 10 failure", () => {
    assert.equal(finding(unnamed, RULE_10).status, "N/A");
  });
});

describe("Case 4: non-native button with role=button", () => {
  it("passes Rule 10 for a div", () => {
    const result = evaluate('<div role="button" tabIndex={0} onClick={save}>Save</div>');
    assert.equal(finding(result, RULE_10).status, "Pass");
  });

  it("passes Rule 10 for a span with a single-quoted role", () => {
    const result = evaluate("<span role='button' onClick={save}>Save</span>");
    assert.equal(finding(result, RULE_10).status, "Pass");
  });

  it("still lets Rules 1 and 3 fail the non-native element independently", () => {
    const result = evaluate('<div role="button" onClick={save}>Save</div>');
    assert.equal(finding(result, "rule-1-semantic-button").status, "Fail");
    assert.equal(finding(result, "rule-3-keyboard-operability").status, "Fail");
  });

  it("reads the tag correctly when onClick contains an arrow function", () => {
    const result = evaluate('<div role="button" onClick={() => save(1)}>Save</div>');
    assert.equal(finding(result, RULE_10).status, "Pass");
  });
});

describe("Case 5: non-native button with the required role missing or invalid", () => {
  const withRole = evaluate('<div role="button" onClick={save}>Save</div>');

  it("fails Rule 10 at Critical severity when role is missing", () => {
    const result = evaluate("<div onClick={save}>Save</div>");
    const rule10 = finding(result, RULE_10);
    assert.equal(rule10.status, "Fail");
    assert.equal(rule10.severity, "Critical");
    assert.match(rule10.evidence, /missing role="button"/);
  });

  it("deducts exactly 10 points (provisional)", () => {
    const withoutRole = evaluate("<div onClick={save}>Save</div>");
    assert.equal(withRole.healthScore - withoutRole.healthScore, 10);
  });

  it("fails Rule 10 when the role is not button", () => {
    const result = evaluate('<div role="link" onClick={save}>Save</div>');
    assert.equal(finding(result, RULE_10).status, "Fail");
  });
});

describe("Case 6: applicability cannot be determined", () => {
  it("is Unknown when there is no button element", () => {
    const result = evaluate("const label = 'Submit';");
    assert.equal(finding(result, RULE_10).status, "Unknown");
  });

  it("is Unknown, not Fail, when a non-native role comes from an expression", () => {
    const result = evaluate("<div role={roleName} onClick={save}>Save</div>");
    assert.equal(finding(result, RULE_10).status, "Unknown");
  });

  it("is Unknown when a non-native element may get its role from spread props", () => {
    const result = evaluate("<div {...props} onClick={save}>Save</div>");
    assert.equal(finding(result, RULE_10).status, "Unknown");
  });

  it("counts as an Unknown finding, not an N/A", () => {
    const result = evaluate("const label = 'Submit';");
    assert.ok(result.unknownCount >= 1);
    assert.equal(result.findings.filter((f) => f.status === "N/A").length, 0);
  });
});

describe("native button edge cases", () => {
  it("is Fail when a native button carries a contradicting role", () => {
    const result = evaluate('<button role="link">Go</button>');
    assert.equal(finding(result, RULE_10).status, "Fail");
  });

  it("stays N/A, without a penalty, for a redundant role=button", () => {
    const plain = evaluate("<button>Go</button>");
    const redundant = evaluate('<button role="button">Go</button>');
    assert.equal(finding(redundant, RULE_10).status, "N/A");
    assert.match(finding(redundant, RULE_10).evidence, /redundant/);
    assert.equal(redundant.healthScore, plain.healthScore);
  });

  it("is Unknown when a native button's role comes from an expression", () => {
    const result = evaluate("<button role={r}>Go</button>");
    assert.equal(finding(result, RULE_10).status, "Unknown");
  });

  it("ignores attributes that merely end in role", () => {
    const result = evaluate('<button data-role="x">Go</button>');
    assert.equal(finding(result, RULE_10).status, "N/A");
  });
});

describe("N/A scoring", () => {
  it("never changes the score", () => {
    const naPlus = evaluate(SAMPLE_BUTTON_TSX, SAMPLE_BUTTON_CSS_DARK);
    assert.equal(naPlus.healthScore, 100);
    assert.equal(finding(naPlus, RULE_10).status, "N/A");
  });

  it("is excluded from the recommended fixes", () => {
    const result = evaluate(SAMPLE_BUTTON_TSX, SAMPLE_BUTTON_CSS_DARK);
    assert.deepEqual(result.recommendedFixes, ["No remediation required for the evaluated evidence set."]);
  });

  it("sorts after Pass and before Unknown and Fail", () => {
    const result = evaluate(SAMPLE_BUTTON_TSX, SAMPLE_BUTTON_CSS);
    const order = result.findings.map((f) => f.status);
    assert.ok(order.lastIndexOf("Pass") < order.indexOf("N/A"));
    assert.ok(order.indexOf("N/A") < order.indexOf("Fail"));
  });
});
