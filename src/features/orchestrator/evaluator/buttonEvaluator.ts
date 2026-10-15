import { MVP_SCORING_POLICY, type EvaluationResult, type RuleResult } from "../types/evaluation";
import { orderFindingsForMvp } from "../types/rules";
import { resolveCssCustomProperties } from "../cssVariables";
import {
  FALLBACK_SELECTOR,
  TARGET_DISABLED_MODIFIER,
  TARGET_SELECTOR,
  escapeForRegExp
} from "./targetSelector";

type Severity = RuleResult["severity"];

// The preview canvas background used for light-mode component inspection.
// WCAG 1.4.11: an `outline` focus ring sits outside the button boundary, so the
// relevant adjacent color for non-text contrast is this surrounding surface, not the button fill.
const PREVIEW_CANVAS_HEX = "#E6E6E6";

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
  },
  {
    // PROVISIONAL: the -10 deduction is pending Accessibility SME review. See
    // docs/ARIA-Score/ARIA_Score.md. Kept separate from Rule 2, whose -25 is unchanged.
    ruleId: "rule-10-aria-semantics",
    ruleName: "ARIA Semantics",
    sourceReference:
      "WCAG 4.1.2 Name, Role, Value · orchestrator_button_health_score_rag.txt Rule 10 · docs/ARIA-Score/ARIA_Score.md",
    defaultSeverity: "Critical",
    deduction: 10
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

/**
 * Not Applicable: the rule verifiably does not apply to this component. Callers
 * must have positively established that, "nothing found" is Unknown, not N/A.
 */
function createNotApplicable(
  rule: RuleDefinition,
  evidence: string,
  recommendation = "No change needed."
): RuleResult {
  return {
    ruleId: rule.ruleId,
    ruleName: rule.ruleName,
    status: "N/A",
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
  const pattern = new RegExp(`${escapeForRegExp(selector)}\\s*\\{([\\s\\S]*?)\\}`, "m");
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

  const notApplicableCount = findings.filter((f) => f.status === "N/A").length;

  if (failCount === 0 && unknownCount === 0) {
    return notApplicableCount > 0
      ? `All ${passCount} applicable rules passed (${notApplicableCount} not applicable). Ready to ship.`
      : `All ${passCount} rules passed. Ready to ship.`;
  }

  if (unknownCount > 0) {
    return `Score ${score}/100 with ${passCount} pass, ${unknownCount} unknown, and ${failCount} fail findings. Unknown results indicate evidence gaps that require manual verification.`;
  }

  return `1 issue to resolve — fix the failing rule and rerun.`;
}

function buildFixes(findings: RuleResult[]): string[] {
  const actionable = findings
    .filter((f) => f.status === "Fail" || f.status === "Unknown")
    .map((f) => f.recommendation)
    .filter((value, index, array) => array.indexOf(value) === index);

  if (actionable.length === 0) {
    return ["No remediation required for the evaluated evidence set."];
  }

  return actionable;
}

/**
 * Returns the opening tag that starts at `start` (the index of its "<"). Quote- and
 * brace-aware, so the ">" in an arrow function or a JSX expression does not end
 * the tag early.
 */
function readOpeningTag(code: string, start: number): string {
  let depth = 0;
  let quote: string | null = null;
  for (let i = start; i < code.length; i += 1) {
    const ch = code[i];
    if (quote) {
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
    } else if (ch === "{") {
      depth += 1;
    } else if (ch === "}") {
      depth = Math.max(0, depth - 1);
    } else if (ch === ">" && depth === 0) {
      return code.slice(start, i + 1);
    }
  }
  return code.slice(start);
}

type RoleAttribute =
  | { kind: "absent" }
  | { kind: "literal"; value: string }
  | { kind: "dynamic" };

/** Reads an explicit `role` attribute from an opening tag. An empty role is ignored by browsers, so it counts as absent. */
function readRoleAttribute(openingTag: string): RoleAttribute {
  const match = openingTag.match(
    /(?:^|\s)role\s*=\s*(?:"([^"]*)"|'([^']*)'|\{\s*(?:"([^"]*)"|'([^']*)')\s*\}|(\{))/
  );
  if (!match) return { kind: "absent" };
  if (match[5]) return { kind: "dynamic" };
  const value = (match[1] ?? match[2] ?? match[3] ?? match[4] ?? "").trim().toLowerCase();
  return value === "" ? { kind: "absent" } : { kind: "literal", value };
}

/** The first <div>/<span> opening tag that carries an onClick handler, i.e. the element used as a button. */
function findClickableNonNativeTag(code: string): { name: string; tag: string } | null {
  const pattern = /<(div|span)\b/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(code)) !== null) {
    const tag = readOpeningTag(code, match.index);
    if (/\bonClick\s*=/.test(tag)) {
      return { name: match[1], tag };
    }
  }
  return null;
}

/**
 * Whether the button markup or CSS contains something that could be an icon: an
 * <svg>, <img>, <i>, an Icon-named component, or a CSS-generated icon. Used only
 * to word Rule 2's evidence. It never changes Rule 2's status.
 */
function hasIconCandidate(buttonMarkup: string, cssCode: string): boolean {
  if (/<(?:svg|img|i)\b/.test(buttonMarkup)) return true;
  if (/<[A-Za-z0-9_.]*Icon\b/.test(buttonMarkup)) return true;
  return /::?(?:before|after)\s*\{[^}]*\bcontent\s*:\s*(?!["']{2}\s*[;}]|none)/.test(cssCode);
}

export function evaluateButtonAccessibility(reactCode: string, rawCssCode: string): EvaluationResult {
  // Substitute custom properties before any rule inspects the CSS, so colours are
  // read the way a browser resolves them: the declared token wins, and a var()
  // fallback applies only when the token is undefined. Without this, a declaration
  // like `color: var(--Text-Disabled, #8C8C8C)` was scanned for a literal hex and
  // matched the fallback — so editing the design token changed nothing.
  //
  // Selectors are untouched, so every existing block-matching rule is unaffected.
  const cssCode = resolveCssCustomProperties(rawCssCode);

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
      // Evidence wording only: the icon sub-check is Not Applicable when no icon
      // exists. Rule 2's own status and deduction come from the branches above.
      const iconNote = hasIconCandidate(buttonMarkup, cssCode)
        ? ""
        : " Icon-specific check: N/A — no icon-only state exists (no icon detected).";
      findings.push(
        createPass(
          RULES[1],
          (hasAriaName || hasAriaLabelledBy
            ? "Detected aria-label/aria-labelledby on button."
            : "Detected visible button label text within the button content.") + iconNote
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
  const focusBlock =
    findCssBlock(cssCode, `${TARGET_SELECTOR}:focus-visible`) ??
    findCssBlock(cssCode, `${FALLBACK_SELECTOR}:focus-visible`);
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
  const baseBlock = findCssBlock(cssCode, TARGET_SELECTOR) ?? findCssBlock(cssCode, FALLBACK_SELECTOR);
  const disabledBlock =
    findCssBlock(cssCode, `${TARGET_SELECTOR}:disabled`) ??
    findCssBlock(cssCode, TARGET_DISABLED_MODIFIER) ??
    findCssBlock(cssCode, `${FALLBACK_SELECTOR}:disabled`);

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
    const backgroundHex = extractHexColor(
      (baseBlock.match(/background(?:-color)?\s*:\s*([^;]+);/) ?? [])[1] ?? ""
    );

    const disabledColorHex = disabledBlock
      ? extractHexColor((disabledBlock.match(/color\s*:\s*([^;]+);/) ?? [])[1] ?? "")
      : null;

    const disabledBackgroundHex = disabledBlock
      ? extractHexColor(
          (disabledBlock.match(/background(?:-color)?\s*:\s*([^;]+);/) ?? [])[1] ?? ""
        )
      : null;

    if (!colorHex || !backgroundHex) {
      findings.push(
        createUnknown(
          RULES[4],
          "Text contrast could not be computed from token/variable-driven default color declarations.",
          "Provide resolved text and background colors for contrast verification."
        )
      );
    } else {
      const ratio = contrastRatio(colorHex, backgroundHex);

      if (disabledBlock && disabledColorHex && disabledBackgroundHex) {
        const disabledRatio = contrastRatio(disabledColorHex, disabledBackgroundHex);

        if (disabledRatio < 4.5) {
          findings.push(
            createFail(
              RULES[4],
              `Computed disabled-state text contrast ratio ${disabledRatio.toFixed(
                2
              )}:1 (< 4.5:1) using ${disabledColorHex} text on ${disabledBackgroundHex} background.`,
              "Adjust the disabled button label color or disabled background color to meet at least 4.5:1 contrast for normal text. Change it at the source — the custom property this declaration resolves to, not the var() fallback."
            )
          );
        } else if (ratio >= 4.5) {
          findings.push(
            createPass(
              RULES[4],
              `Computed default text contrast ratio ${ratio.toFixed(
                2
              )}:1 and disabled-state text contrast ratio ${disabledRatio.toFixed(2)}:1 (both >= 4.5:1).`
            )
          );
        } else {
          findings.push(
            createFail(
              RULES[4],
              `Computed default text contrast ratio ${ratio.toFixed(2)}:1 (< 4.5:1).`,
              "Adjust text/background colors to meet at least 4.5:1 contrast for normal text."
            )
          );
        }
      } else if (ratio >= 4.5) {
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
    if (outlineHex) {
      const ratio = contrastRatio(outlineHex, PREVIEW_CANVAS_HEX);
      if (ratio >= 3) {
        findings.push(
          createPass(
            RULES[5],
            `Computed non-text contrast ratio ${ratio.toFixed(2)}:1 for focus indicator against canvas background (>= 3:1).`
          )
        );
      } else {
        findings.push(
          createFail(
            RULES[5],
            `Computed non-text contrast ratio ${ratio.toFixed(2)}:1 for focus indicator against canvas background (< 3:1).`,
            "Increase contrast between the focus ring color and the surrounding background to at least 3:1 (WCAG 1.4.11)."
          )
        );
      }
    } else {
      findings.push(
        createUnknown(
          RULES[5],
          "Focus indicator color resolves through a variable with no extractable hex fallback; non-text contrast cannot be computed.",
          "Provide a resolved hex color for the focus ring to enable 3:1 contrast verification."
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
  const hasDisabledCss = Boolean(
    findCssBlock(cssCode, `${TARGET_SELECTOR}:disabled`) || findCssBlock(cssCode, `${FALLBACK_SELECTOR}:disabled`)
  );
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
  const hasHover = Boolean(
    findCssBlock(cssCode, `${TARGET_SELECTOR}:hover`) || findCssBlock(cssCode, `${FALLBACK_SELECTOR}:hover`)
  );
  const hasFocus = Boolean(focusBlock);
  const hasActive = Boolean(
    findCssBlock(cssCode, `${TARGET_SELECTOR}:active`) || findCssBlock(cssCode, `${FALLBACK_SELECTOR}:active`)
  );
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

  // Rule 10: ARIA semantics (provisional, pending Accessibility SME review).
  //
  // Native HTML first. "Is ARIA required?" is decided before anything is scored:
  // a native <button> already exposes the button role, so the rule is Not
  // Applicable. That is NOT the same as "no ARIA attribute was found". Only a
  // non-native element used as a button needs role="button".
  if (buttonTagMatch) {
    const nativeTag = readOpeningTag(reactCode, buttonTagMatch.index ?? 0);
    const role = readRoleAttribute(nativeTag);
    if (role.kind === "literal" && role.value !== "button") {
      findings.push(
        createFail(
          RULES[9],
          `Native <button> has role="${role.value}", which contradicts its implicit button role.`,
          "Remove the role attribute so the native button role applies, or use an element that matches the intended role."
        )
      );
    } else if (role.kind === "dynamic") {
      findings.push(
        createUnknown(
          RULES[9],
          "Native <button> has a role set from an expression, so whether it contradicts the button role cannot be verified from the code.",
          "Use a literal role value, or remove the role so the native button role applies."
        )
      );
    } else {
      findings.push(
        createNotApplicable(
          RULES[9],
          role.kind === "literal"
            ? 'Native button semantics already provide the required role. Additional ARIA semantics are not required for this use case. The explicit role="button" is redundant.'
            : "Native button semantics already provide the required role. Additional ARIA semantics are not required for this use case."
        )
      );
    }
  } else {
    const clickable = findClickableNonNativeTag(reactCode);
    if (!clickable) {
      findings.push(
        createUnknown(
          RULES[9],
          "Whether ARIA is required cannot be determined because no button element was found in the provided code snippet.",
          "Provide the button markup so ARIA applicability can be determined."
        )
      );
    } else {
      const role = readRoleAttribute(clickable.tag);
      const hasSpread = /\{\s*\.\.\./.test(clickable.tag);
      const label = `<${clickable.name}>`;
      if (role.kind === "literal" && role.value === "button") {
        findings.push(
          createPass(
            RULES[9],
            `Non-native ${label} element used as a button carries role="button", so assistive technology can identify it. Native markup and keyboard operability are evaluated separately by Rules 1 and 3.`
          )
        );
      } else if (role.kind === "dynamic" || (role.kind === "absent" && hasSpread)) {
        findings.push(
          createUnknown(
            RULES[9],
            `Non-native ${label} element used as a button sets its role from an expression or spread props, so role="button" cannot be verified from the code.`,
            'Set a literal role="button", or use a native <button type="button"> element.'
          )
        );
      } else {
        findings.push(
          createFail(
            RULES[9],
            role.kind === "literal"
              ? `Non-native ${label} element used as a button has role="${role.value}" instead of role="button", so assistive technology cannot identify it as a button.`
              : `Non-native ${label} element used as a button is missing role="button", so assistive technology has no way to identify it as an interactive control.`,
            'Add role="button" to the element, or use a native <button type="button"> instead.'
          )
        );
      }
    }
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
