import { MVP_SCORING_POLICY, type EvaluationResult, type RuleResult } from "../types/evaluation";
import { orderFindingsForMvp } from "../types/rules";

type Severity = RuleResult["severity"];

interface RuleDefinition {
  ruleId: string;
  ruleName: string;
  sourceReference: string;
  defaultSeverity: Severity;
  deduction?: number;
}

const RULES: RuleDefinition[] = [
  {
    ruleId: "rule-1-semantic-button",
    ruleName: "Semantic Button Markup",
    sourceReference: "orchestrator_button_health_score_rag.txt Rule 1",
    defaultSeverity: "Critical",
    deduction: 25
  },
  {
    ruleId: "rule-2-accessible-name",
    ruleName: "Accessible Name",
    sourceReference: "orchestrator_button_health_score_rag.txt Rule 2",
    defaultSeverity: "Critical",
    deduction: 25
  },
  {
    ruleId: "rule-3-keyboard-operability",
    ruleName: "Keyboard Operability",
    sourceReference: "orchestrator_button_health_score_rag.txt Rule 3",
    defaultSeverity: "Critical",
    deduction: 25
  },
  {
    ruleId: "rule-4-focus-visible",
    ruleName: "Focus Visibility",
    sourceReference: "orchestrator_button_health_score_rag.txt Rule 4",
    defaultSeverity: "High",
    deduction: 20
  },
  {
    ruleId: "rule-5-text-contrast",
    ruleName: "Text Contrast",
    sourceReference: "orchestrator_button_health_score_rag.txt Rule 5",
    defaultSeverity: "High",
    deduction: 15
  },
  {
    ruleId: "rule-6-non-text-contrast",
    ruleName: "Focus Indicator Contrast",
    sourceReference:
      "WCAG 1.4.11 Non-text Contrast (AA) · orchestrator_button_health_score_rag.txt Rule 6",
    defaultSeverity: "Medium",
    deduction: 10
  },
  {
    ruleId: "rule-7-target-size",
    ruleName: "Target Size",
    sourceReference: "orchestrator_button_health_score_rag.txt Rule 7",
    defaultSeverity: "Medium",
    deduction: 10
  },
  {
    ruleId: "rule-8-disabled-state",
    ruleName: "Disabled State Behavior",
    sourceReference: "orchestrator_button_health_score_rag.txt Rule 8",
    defaultSeverity: "Medium",
    deduction: 5
  },
  {
    ruleId: "rule-9-state-coverage",
    ruleName: "State Coverage",
    sourceReference: "orchestrator_button_health_score_rag.txt Rule 9",
    defaultSeverity: "Medium",
    deduction: 5
  }
];

function createPass(rule: RuleDefinition, evidence: string, recommendation = "No change needed."): RuleResult {
  return {
    ruleId: rule.ruleId,
    ruleName: rule.ruleName,
    status: "Pass",
    evidence,
    severity: "Low",
    recommendation,
    sourceReference: rule.sourceReference
  };
}

function createFail(rule: RuleDefinition, evidence: string, recommendation: string): RuleResult {
  return {
    ruleId: rule.ruleId,
    ruleName: rule.ruleName,
    status: "Fail",
    evidence,
    severity: rule.defaultSeverity,
    recommendation,
    sourceReference: rule.sourceReference
  };
}

function createUnknown(rule: RuleDefinition, evidence: string, recommendation: string): RuleResult {
  return {
    ruleId: rule.ruleId,
    ruleName: rule.ruleName,
    status: "Unknown",
    evidence,
    severity: rule.defaultSeverity === "Critical" ? "High" : rule.defaultSeverity,
    recommendation,
    sourceReference: rule.sourceReference
  };
}

function extractHexColor(input: string): string | null {
  const match = input.match(/#[0-9a-fA-F]{6}\b/);
  return match ? match[0] : null;
}

function relativeLuminance(hex: string): number {
  const rgb = [1, 3, 5].map((idx) => parseInt(hex.slice(idx, idx + 2), 16) / 255);
  const channel = rgb.map((value) =>
    value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4)
  );
  return 0.2126 * channel[0] + 0.7152 * channel[1] + 0.0722 * channel[2];
}

function contrastRatio(foregroundHex: string, backgroundHex: string): number {
  const l1 = relativeLuminance(foregroundHex);
  const l2 = relativeLuminance(backgroundHex);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function findCssBlock(cssCode: string, selector: string): string | null {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\}`, "m");
  const match = cssCode.match(pattern);
  return match ? match[1] : null;
}

function hasVisibleTextLabel(buttonMarkup: string): boolean {
  const cleaned = buttonMarkup.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return cleaned.length > 0;
}

function clampScore(score: number): number {
  if (score < 0) return 0;
  if (score > 100) return 100;
  return score;
}

function calculateMvpFallbackScore(findings: RuleResult[]): number {
  const passCount = findings.filter((finding) => finding.status === "Pass").length;
  const failCount = findings.filter((finding) => finding.status === "Fail").length;
  if (passCount + failCount === 0) {
    return 0;
  }
  return Math.round((passCount / (passCount + failCount)) * 100);
}

function buildSummary(findings: RuleResult[], score: number): string {
  const passCount = findings.filter((f) => f.status === "Pass").length;
  const failCount = findings.filter((f) => f.status === "Fail").length;
  const unknownCount = findings.filter((f) => f.status === "Unknown").length;
  if (failCount === 0 && unknownCount === 0) {
    return `Strong accessibility baseline. ${passCount} rules passed with no known failures.`;
  }
  return `Score ${score}/100 with ${passCount} pass, ${unknownCount} unknown, and ${failCount} fail findings. Unknown results indicate evidence gaps that require manual verification.`;
}

function buildFixes(findings: RuleResult[]): string[] {
  const actionable = findings
    .filter((f) => f.status !== "Pass")
    .map((f) => f.recommendation)
    .filter((value, index, array) => array.indexOf(value) === index);

  if (actionable.length === 0) {
    return ["No remediation required for the evaluated evidence set."];
  }

  return actionable;
}

export function evaluateButtonAccessibility(reactCode: string, cssCode: string): EvaluationResult {
  const findings: RuleResult[] = [];
  const buttonTagMatch = reactCode.match(/<button\b[\s\S]*?>[\s\S]*?<\/button>/m);
  const buttonMarkup = buttonTagMatch?.[0] ?? "";

  // Rule 1: semantic button markup
  if (buttonTagMatch) {
    findings.push(
      createPass(RULES[0], "Detected native <button> element in the submitted React component.")
    );
  } else if (reactCode.match(/<(div|span)\b[\s\S]*onClick=/m)) {
    findings.push(
      createFail(
        RULES[0],
        "Detected clickable non-semantic element (div/span with onClick).",
        "Use a native <button type=\"button\"> for button interactions."
      )
    );
  } else {
    findings.push(
      createUnknown(
        RULES[0],
        "No verifiable button element was found in the provided code snippet.",
        "Confirm the interaction uses native <button> markup."
      )
    );
  }

  // Rule 2: accessible name
  if (!buttonTagMatch) {
    findings.push(
      createUnknown(
        RULES[1],
        "Accessible name cannot be verified because a concrete button element was not found.",
        "Ensure the button has visible text, aria-label, or aria-labelledby."
      )
    );
  } else {
    const hasAriaName = /aria-label\s*=\s*["'][^"']+["']/.test(buttonMarkup);
    const hasAriaLabelledBy = /aria-labelledby\s*=/.test(buttonMarkup);
    const hasLabelText = hasVisibleTextLabel(buttonMarkup);
    if (hasAriaName || hasAriaLabelledBy || hasLabelText) {
      findings.push(
        createPass(
          RULES[1],
          hasAriaName || hasAriaLabelledBy
            ? "Detected aria-label/aria-labelledby on button."
            : "Detected visible button label text within the button content."
        )
      );
    } else {
      findings.push(
        createFail(
          RULES[1],
          "Button content appears icon-only without detectable accessible labeling attributes.",
          "Add descriptive visible text or provide aria-label/aria-labelledby."
        )
      );
    }
  }

  // Rule 3: keyboard operability
  if (buttonTagMatch) {
    findings.push(
      createPass(
        RULES[2],
        "Native button semantics provide keyboard focus and Enter/Space activation behavior by default."
      )
    );
  } else if (reactCode.match(/<(div|span)\b[\s\S]*onClick=/m)) {
    findings.push(
      createFail(
        RULES[2],
        "Detected clickable non-semantic element (div/span with onClick). Keyboard operability is not guaranteed without native button semantics.",
        "Use a native <button type=\"button\"> to ensure keyboard focus and Enter/Space activation."
      )
    );
  } else {
    findings.push(
      createUnknown(
        RULES[2],
        "Keyboard operability cannot be confirmed without native button semantics or explicit keyboard handlers.",
        "Use native button semantics or verify keyboard activation handlers."
      )
    );
  }

  // Rule 4: focus visibility
  const focusBlock = findCssBlock(cssCode, ".icon-btn:focus-visible") ?? findCssBlock(cssCode, "button:focus-visible");
  if (!focusBlock) {
    findings.push(
      createUnknown(
        RULES[3],
        "No focus-visible CSS rule found for the evaluated selector.",
        "Add a visible focus ring or outline in the focus-visible state."
      )
    );
  } else if (/outline\s*:\s*none/.test(focusBlock)) {
    findings.push(
      createFail(
        RULES[3],
        "Focus outline is removed without a clear replacement indicator.",
        "Provide a clearly visible focus ring (outline or equivalent)."
      )
    );
  } else if (/outline|box-shadow|border/.test(focusBlock)) {
    findings.push(
      createPass(
        RULES[3],
        "Focus-visible styling includes an explicit visual indicator."
      )
    );
  } else {
    findings.push(
      createUnknown(
        RULES[3],
        "Focus style block exists but no clear indicator property was detected.",
        "Ensure focus state visibly changes via outline, border, or box-shadow."
      )
    );
  }

  // Rule 5: text contrast
  const baseBlock = findCssBlock(cssCode, ".icon-btn") ?? findCssBlock(cssCode, "button");
  if (!baseBlock) {
    findings.push(
      createUnknown(
        RULES[4],
        "Base button CSS block was not found to verify text and background colors.",
        "Provide button text and background color values to verify contrast."
      )
    );
  } else {
    const colorHex = extractHexColor((baseBlock.match(/color\s*:\s*([^;]+);/) ?? [])[1] ?? "");
    const backgroundHex = extractHexColor((baseBlock.match(/background(?:-color)?\s*:\s*([^;]+);/) ?? [])[1] ?? "");
    if (!colorHex || !backgroundHex) {
      findings.push(
        createUnknown(
          RULES[4],
          "Text contrast could not be computed from token/variable-driven color declarations.",
          "Provide resolved text and background colors for contrast verification."
        )
      );
    } else {
      const ratio = contrastRatio(colorHex, backgroundHex);
      if (ratio >= 4.5) {
        findings.push(
          createPass(RULES[4], `Computed text contrast ratio ${ratio.toFixed(2)}:1 (>= 4.5:1).`)
        );
      } else {
        findings.push(
          createFail(
            RULES[4],
            `Computed text contrast ratio ${ratio.toFixed(2)}:1 (< 4.5:1).`,
            "Adjust text/background colors to meet at least 4.5:1 contrast for normal text."
          )
        );
      }
    }
  }

  // Rule 6: non-text contrast
  if (!focusBlock) {
    findings.push(
      createUnknown(
        RULES[5],
        "Non-text contrast cannot be verified without visible boundary or focus indicator styling.",
        "Provide focus ring/boundary colors and adjacent background colors for 3:1 verification."
      )
    );
  } else {
    const outlineHex = extractHexColor((focusBlock.match(/outline\s*:\s*[^#]*(#[0-9a-fA-F]{6})/) ?? [])[1] ?? "");
    const baseBackgroundHex = extractHexColor((baseBlock?.match(/background(?:-color)?\s*:\s*([^;]+);/) ?? [])[1] ?? "");
    if (outlineHex && baseBackgroundHex) {
      const ratio = contrastRatio(outlineHex, baseBackgroundHex);
      if (ratio >= 3) {
        findings.push(
          createPass(
            RULES[5],
            `Computed non-text contrast ratio ${ratio.toFixed(2)}:1 for focus indicator (>= 3:1).`
          )
        );
      } else {
        findings.push(
          createFail(
            RULES[5],
            `Computed non-text contrast ratio ${ratio.toFixed(2)}:1 for focus indicator (< 3:1).`,
            "Increase contrast between focus indicator/component boundary and adjacent colors to at least 3:1."
          )
        );
      }
    } else {
      findings.push(
        createUnknown(
          RULES[5],
          "Focus indicator or adjacent color resolves through variables, so non-text contrast cannot be confidently computed.",
          "Provide resolved color values for focus ring and adjacent surfaces."
        )
      );
    }
  }

  // Rule 7: target size
  if (!baseBlock) {
    findings.push(
      createUnknown(
        RULES[6],
        "Target dimensions cannot be verified without a base button style block.",
        "Provide explicit width/height/min-width/min-height values."
      )
    );
  } else {
    const minWidth = Number((baseBlock.match(/min-width\s*:\s*(\d+)px/) ?? [])[1] ?? 0);
    const minHeight = Number((baseBlock.match(/min-height\s*:\s*(\d+)px/) ?? [])[1] ?? 0);
    if (!minWidth || !minHeight) {
      findings.push(
        createUnknown(
          RULES[6],
          "Target size requires rendered dimensions; explicit min-width/min-height values were not both detected.",
          "Set or verify rendered target dimensions are at least 44x44 CSS pixels."
        )
      );
    } else if (minWidth >= 44 && minHeight >= 44) {
      findings.push(
        createPass(RULES[6], `Detected min-width ${minWidth}px and min-height ${minHeight}px (>= 44x44).`)
      );
    } else {
      findings.push(
        createFail(
          RULES[6],
          `Detected min-width ${minWidth}px and min-height ${minHeight}px, which is below 44x44 minimum.`,
          "Increase the interactive target size to at least 44x44 CSS pixels."
        )
      );
    }
  }

  // Rule 8: disabled state behavior
  const hasDisabledAttribute = /disabled\s*=/.test(buttonMarkup);
  const hasDisabledCss = Boolean(findCssBlock(cssCode, ".icon-btn:disabled") || findCssBlock(cssCode, "button:disabled"));
  if (hasDisabledAttribute && hasDisabledCss) {
    findings.push(
      createPass(
        RULES[7],
        "Detected disabled attribute handling in React markup and dedicated disabled styling in CSS."
      )
    );
  } else if (hasDisabledAttribute && !hasDisabledCss) {
    findings.push(
      createUnknown(
        RULES[7],
        "Disabled behavior is present in markup but visual disabled styling was not detected.",
        "Add distinct disabled styles so disabled controls do not appear interactive."
      )
    );
  } else {
    findings.push(
      createUnknown(
        RULES[7],
        "Disabled behavior could not be fully verified from the provided snippet.",
        "Include disabled state handling and visible styling differentiation."
      )
    );
  }

  // Rule 9: state coverage
  const hasBase = Boolean(baseBlock);
  const hasHover = Boolean(findCssBlock(cssCode, ".icon-btn:hover") || findCssBlock(cssCode, "button:hover"));
  const hasFocus = Boolean(focusBlock);
  const hasActive = Boolean(findCssBlock(cssCode, ".icon-btn:active") || findCssBlock(cssCode, "button:active"));
  const hasDisabled = hasDisabledCss;
  if (hasBase && hasHover && hasFocus && hasActive && hasDisabled) {
    findings.push(
      createPass(
        RULES[8],
        "Detected default, hover, focus, active, and disabled state coverage in the provided CSS."
      )
    );
  } else {
    const missing = [
      hasBase ? null : "default",
      hasHover ? null : "hover",
      hasFocus ? null : "focus",
      hasActive ? null : "active",
      hasDisabled ? null : "disabled"
    ].filter(Boolean);
    findings.push(
      createUnknown(
        RULES[8],
        `State coverage is only partially evidenced from static CSS. Missing or unverifiable states: ${missing.join(", ")}.`,
        "Verify rendered default, hover, focus, active, and disabled states and add missing definitions."
      )
    );
  }

  const hasRagWeightsForAllFailRules = findings
    .filter((finding) => finding.status === "Fail")
    .every((finding) => {
      const matchedRule = RULES.find((candidate) => candidate.ruleId === finding.ruleId);
      return typeof matchedRule?.deduction === "number";
    });

  const scoreFromRagDeductions = clampScore(
    100 -
      findings
        .filter((finding) => finding.status === "Fail")
        .reduce((sum, finding) => {
          const rule = RULES.find((candidate) => candidate.ruleId === finding.ruleId);
          return sum + (rule?.deduction ?? 0);
        }, 0)
  );

  const fallbackScore = calculateMvpFallbackScore(findings);
  const finalScore = hasRagWeightsForAllFailRules ? scoreFromRagDeductions : fallbackScore;

  const sourceRuleOrder = RULES.map((rule) => rule.ruleId);
  const orderedFindings = orderFindingsForMvp(findings, sourceRuleOrder);

  return {
    healthScore: finalScore,
    summary: buildSummary(orderedFindings, finalScore),
    findings: orderedFindings,
    recommendedFixes: buildFixes(orderedFindings),
    scoringPolicyLabel: hasRagWeightsForAllFailRules
      ? "RAG Deduction Scoring (v3)"
      : MVP_SCORING_POLICY.name,
    unknownCount: orderedFindings.filter((finding) => finding.status === "Unknown").length
  };
}

export function getScoringPolicyDetails() {
  return {
    policy: MVP_SCORING_POLICY,
    note: "RAG v3 deductions are used when explicit deduction weights exist in source rules."
  };
}
