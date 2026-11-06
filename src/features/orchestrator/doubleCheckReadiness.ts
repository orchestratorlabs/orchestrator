/**
 * Pure logic that decides what the A11Y DoubleCheck card claims, and when a
 * component may be approved. Kept free of React and the DOM so every gate can be
 * unit tested (`npm test`).
 *
 * Two principles run through this file:
 *
 *  1. The reviewer-facing wording is derived from what was actually *sent* to
 *     DoubleCheck (the snapshot), never from what the model says about itself. The
 *     backend prompt can tell the model "all findings are passing" about a
 *     one-finding payload, so the model's own summary can overstate its scope.
 *     The raw model response is preserved untouched in state for debugging.
 *
 *  2. Approval fails closed. Anything not positively matched — an unrecognised
 *     readiness value, a partial scope, an Unknown finding, stale inputs — leaves
 *     Approve Component unavailable.
 */
import type { A11yDoubleCheckResult, RuleResult } from "./types/evaluation";

export type ThemeMode = "light" | "dark";

/** Everything the evaluator and DoubleCheck actually read for one theme. */
export interface EvaluationInputs {
  reactCode: string;
  /** The CSS the evaluator really used: the editor CSS in light mode, the built-in sample in dark mode. */
  effectiveCss: string;
  theme: ThemeMode;
}

export type DoubleCheckScope =
  | { kind: "all" }
  | { kind: "finding"; ruleId: string; ruleName: string; status: RuleResult["status"] };

export interface FindingCounts {
  total: number;
  pass: number;
  fail: number;
  unknown: number;
  notApplicable: number;
}

/** A record of exactly what a DoubleCheck run was given. */
export interface DoubleCheckSnapshot {
  inputs: EvaluationInputs;
  scope: DoubleCheckScope;
  /** Counts over the findings that were sent, not over the whole evaluation. */
  counts: FindingCounts;
}

export const THEME_LABEL: Record<ThemeMode, string> = {
  light: "Light mode",
  dark: "Dark mode",
};

/**
 * Dark mode never evaluates the CSS in the editor: the editor is read-only and the
 * evaluator is handed the built-in sample dark stylesheet. Anything that shows or
 * reports "the CSS" has to say which one it was.
 */
export function describeCssSource(theme: ThemeMode): string {
  return theme === "dark"
    ? "built-in sample dark CSS (the CSS editor is read-only and not used in Dark mode)"
    : "the CSS in the editor";
}

/** The CSS the evaluator and DoubleCheck use for a theme. */
export function getEffectiveCss(theme: ThemeMode, editorCss: string, sampleDarkCss: string): string {
  return theme === "dark" ? sampleDarkCss : editorCss;
}

export function buildEvaluationInputs(
  reactCode: string,
  editorCss: string,
  theme: ThemeMode,
  sampleDarkCss: string
): EvaluationInputs {
  return { reactCode, effectiveCss: getEffectiveCss(theme, editorCss, sampleDarkCss), theme };
}

/** Strict equality, so a whitespace-only edit counts as a change. */
export function inputsEqual(a: EvaluationInputs | null, b: EvaluationInputs | null): boolean {
  if (!a || !b) return false;
  return a.theme === b.theme && a.reactCode === b.reactCode && a.effectiveCss === b.effectiveCss;
}

export const EVALUATION_OUTDATED_MESSAGE =
  "The component code, CSS, or theme has changed since the last Accessibility Check. Run Accessibility Check again, then run A11Y DoubleCheck.";

/**
 * Gate run before DoubleCheck is sent. The findings DoubleCheck receives come from
 * the last evaluation, so they only describe the component on screen if the inputs
 * still match. Otherwise the developer is asked to rerun Evaluate.
 */
export function checkDoubleCheckPreconditions(
  evaluatedInputs: EvaluationInputs | null,
  currentInputs: EvaluationInputs
): { ok: true } | { ok: false; message: string } {
  if (!inputsEqual(evaluatedInputs, currentInputs)) {
    return { ok: false, message: EVALUATION_OUTDATED_MESSAGE };
  }
  return { ok: true };
}

export function countFindings(findings: RuleResult[]): FindingCounts {
  const count = (status: RuleResult["status"]) => findings.filter((f) => f.status === status).length;
  return {
    total: findings.length,
    pass: count("Pass"),
    fail: count("Fail"),
    unknown: count("Unknown"),
    notApplicable: count("N/A"),
  };
}

export function buildDoubleCheckSnapshot(
  inputs: EvaluationInputs,
  scope: DoubleCheckScope,
  sentFindings: RuleResult[]
): DoubleCheckSnapshot {
  return { inputs, scope, counts: countFindings(sentFindings) };
}

/**
 * A result is current only if the evaluation signature still matches (no Evaluate
 * rerun, no theme switch) AND the inputs it was run against equal the live inputs
 * (no edit since).
 */
export function isDoubleCheckCurrent(args: {
  evaluationSignature: string | null;
  doubleCheckEvaluationSignature: string | null;
  snapshot: DoubleCheckSnapshot | null;
  currentInputs: EvaluationInputs;
}): boolean {
  const { evaluationSignature, doubleCheckEvaluationSignature, snapshot, currentInputs } = args;
  return (
    doubleCheckEvaluationSignature === evaluationSignature &&
    snapshot !== null &&
    inputsEqual(snapshot.inputs, currentInputs)
  );
}

/**
 * The backend defines exactly three readiness values: "Ship Ready",
 * "Ship With Caution" and "Do Not Ship". The Claude path does not validate the tag,
 * so any text can arrive. Require equality after normalising whitespace and case;
 * "Not Ship Ready", "Ship Ready." and "" all fail.
 */
export function isShipReadyVerdict(value: string): boolean {
  return value.trim().replace(/\s+/g, " ").toLowerCase() === "ship ready";
}

/** The model's own verdict: PASS, a ship-ready value, and no remaining risks. */
export function verdictPasses(result: A11yDoubleCheckResult): boolean {
  return (
    result.status === "PASS" &&
    isShipReadyVerdict(result.shipReadiness) &&
    result.remainingRisks.length === 0
  );
}

export type DoubleCheckHeadlineKind =
  | "component-passed"
  | "finding-passed"
  | "review-incomplete"
  | "default";

export interface DoubleCheckDisplay {
  /** True when the model's verdict is PASS, ship-ready and risk-free. */
  verdictPasses: boolean;
  /** True only when Approve Component may be enabled (before freshness, checked by the caller). */
  canApprove: boolean;
  /** "default" means: show the existing Status / Confidence / Ship Readiness chips. */
  headlineKind: DoubleCheckHeadlineKind;
  headline: string | null;
  /** Shown alongside the default chips when Unknown findings remain. */
  extraChip: string | null;
  caption: string | null;
  /** The only summary shown to the reviewer. Derived from the snapshot, not the model. */
  summary: string;
  /** Replaces the backend's next step when set; null means show the backend's text. */
  nextStep: string | null;
  /**
   * False when the card has nothing left to recommend: both "Open interaction preview"
   * and "Approve Component" are on offer, so a next-step heading and sentence would
   * only repeat the buttons.
   */
  showNextStep: boolean;
  /** The one line above Approve Component, generated from the reviewed snapshot. */
  approvalScopeLine: string | null;
  showRunAll: boolean;
  /** Whether Approve Component is rendered, and if so whether it is enabled. */
  approve: "enabled" | "unavailable" | "hidden";
  approvalNotice: string | null;
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/**
 * "Approval covers the 10 light-mode findings. Preview observations are reported
 * separately." Count and theme come from the reviewed snapshot, never from the
 * model, so the line says exactly what the DoubleCheck run was given.
 */
export function approvalScopeLine(findingCount: number, theme: ThemeMode): string {
  return `Approval covers the ${findingCount} ${theme}-mode ${plural(findingCount, "finding", "findings")}. Preview observations are reported separately.`;
}

function unverifiedText(unknown: number): string {
  return `Review incomplete — ${unknown} unverified`;
}

export function buildDoubleCheckDisplay(
  result: A11yDoubleCheckResult,
  snapshot: DoubleCheckSnapshot
): DoubleCheckDisplay {
  const { scope, counts, inputs } = snapshot;
  const themeLabel = THEME_LABEL[inputs.theme];
  const passes = verdictPasses(result);
  const statusPassButNotClear =
    result.status === "PASS" && result.remainingRisks.length === 0 && !isShipReadyVerdict(result.shipReadiness);

  const base: DoubleCheckDisplay = {
    verdictPasses: passes,
    canApprove: false,
    headlineKind: "default",
    headline: null,
    extraChip: null,
    caption: null,
    summary: "",
    nextStep: null,
    showNextStep: true,
    approvalScopeLine: null,
    showRunAll: scope.kind === "finding",
    approve: "hidden",
    approvalNotice: statusPassButNotClear
      ? "Approval unavailable — the DoubleCheck verdict was not a clear pass."
      : null,
  };

  if (scope.kind === "finding") {
    const summary = `DoubleCheck reviewed one finding — ${scope.ruleName} — for ${themeLabel}. Other findings were not reviewed by this run.`;
    // A finding can only be selected for DoubleCheck while it is Unknown (Fail
    // findings block DoubleCheck entirely), so a pass here usually means DoubleCheck
    // resolved a finding the evaluator could not verify. Either way the reviewer is
    // told it covers one finding only, and component approval stays unavailable.
    if (passes && (scope.status === "Pass" || scope.status === "Unknown")) {
      return {
        ...base,
        headlineKind: "finding-passed",
        headline: "Selected finding passed",
        caption: `${scope.ruleName} only · not a component sign-off`,
        summary,
        nextStep: "Run DoubleCheck on all findings to enable component approval.",
        approve: "unavailable",
        approvalNotice: "Approval requires DoubleCheck on all findings.",
      };
    }
    return { ...base, summary };
  }

  // scope: all findings
  const applicable = counts.pass + counts.fail + counts.unknown;
  const breakdown = [
    `${counts.pass} Pass`,
    `${counts.unknown} Unknown`,
    `${counts.notApplicable} N/A`,
    ...(counts.fail > 0 ? [`${counts.fail} Fail`] : []),
  ].join(", ");
  const summary =
    `DoubleCheck reviewed all ${counts.total} evaluated ${plural(counts.total, "finding", "findings")} for ${themeLabel} (${breakdown}).` +
    (counts.unknown > 0 ? ` ${counts.unknown} could not be verified.` : "");
  const caption = `All ${counts.total} evaluated ${plural(counts.total, "finding", "findings")} · ${themeLabel}`;

  const everyApplicablePassed = applicable > 0 && counts.pass === applicable;
  if (passes && everyApplicablePassed) {
    return {
      ...base,
      canApprove: true,
      headlineKind: "component-passed",
      headline: "Component checks passed",
      caption,
      summary,
      nextStep: null,
      showNextStep: false,
      approvalScopeLine: approvalScopeLine(counts.total, inputs.theme),
      approve: "enabled",
      approvalNotice: null,
    };
  }

  if (passes && counts.unknown > 0 && counts.fail === 0) {
    return {
      ...base,
      headlineKind: "review-incomplete",
      headline: unverifiedText(counts.unknown),
      caption,
      summary,
      nextStep: `Verify the ${counts.unknown} unverified ${plural(counts.unknown, "finding", "findings")}, run Accessibility Check again, then run A11Y DoubleCheck.`,
      approve: "unavailable",
      approvalNotice: `Approval requires every applicable finding to pass. ${counts.unknown} ${plural(counts.unknown, "finding is", "findings are")} unverified.`,
    };
  }

  return {
    ...base,
    caption,
    summary,
    extraChip: counts.unknown > 0 ? unverifiedText(counts.unknown) : null,
    approvalNotice:
      passes && applicable === 0
        ? "Approval unavailable — no applicable findings were evaluated."
        : base.approvalNotice,
    approve: passes && applicable === 0 ? "unavailable" : "hidden",
  };
}

/** Section tag for a theme in the exported report. */
export type ThemeSectionTag =
  | "Approved result"
  | "Previous result — re-run to update"
  | "Not covered by this approval"
  | null;

/**
 * Labels one theme's section in the export. A cached result is "previous" when the
 * inputs it was evaluated with differ from the inputs for that theme now.
 */
export function themeSectionTag(args: {
  theme: ThemeMode;
  hasResult: boolean;
  resultInputs: EvaluationInputs | null;
  currentInputs: EvaluationInputs;
  approvedTheme: ThemeMode | null;
}): ThemeSectionTag {
  const { theme, hasResult, resultInputs, currentInputs, approvedTheme } = args;
  if (!hasResult) return null;
  if (!inputsEqual(resultInputs, currentInputs)) return "Previous result — re-run to update";
  return theme === approvedTheme ? "Approved result" : "Not covered by this approval";
}
