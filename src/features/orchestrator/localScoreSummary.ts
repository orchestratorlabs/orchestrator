import type { RuleResult } from "./types/evaluation";

/**
 * Builds a Score Summary from the evaluation findings, without calling Claude.
 *
 * Used when the local Flask service is unreachable — on a hosted deployment, or
 * locally when `app.py` is not running. The text is *derived from the real
 * findings*, so it is a genuine summary of a genuine result; it simply is not
 * written by a model. The panel labels it as locally generated, so it is never
 * mistaken for the agentic double-check.
 *
 * Kept deliberately narrow: a specific, useful message for the seeded sample's
 * known state, and an accurate generic one for anything else. It must not
 * recommend a value it has not verified.
 */

/** Passes 4.79:1 against the sample's #BDBDBD disabled background. */
const RECOMMENDED_DISABLED_TEXT = "#494949";

/** The seeded sample's disabled-state colours, as they appear in rule evidence. */
const SAMPLE_DISABLED_TEXT = "#8C8C8C";
const SAMPLE_DISABLED_BG = "#BDBDBD";

export interface NeedsVerificationItem {
  ruleId: string;
  ruleName: string;
  detail: string;
}

/**
 * Derives the Score Summary's "Needs Verification" list: one entry per Unknown
 * finding — a rule the evaluator could not decide because the submitted
 * component did not carry the evidence it needs (e.g. no `:focus-visible` block,
 * so focus visibility, focus-indicator contrast and state coverage all return
 * Unknown).
 *
 * Derived straight from the findings the evaluator already produced, so it:
 *   - is independent of whether the prose summary came from Claude or the local
 *     fallback — the section appears either way when evidence is missing;
 *   - changes no evaluation or scoring logic — it only re-presents existing
 *     Unknown results;
 *   - never implies a WCAG failure. An Unknown is a missing-evidence gap.
 *
 * Returns an empty array when there are no Unknown findings, so the caller shows
 * the section only when it has something to say.
 */
/**
 * Shorter, plain-language wording for specific rules in the Needs Verification
 * list, where the raw evidence + recommendation reads too long. Presentation
 * only — the underlying finding (and the Findings list) is untouched.
 */
const NEEDS_VERIFICATION_DETAIL_OVERRIDES: Record<string, string> = {
  "rule-9-state-coverage":
    "Focus state cannot be verified from the submitted CSS. Restore or verify the focus-state definition.",
};

export function buildNeedsVerification(findings: RuleResult[]): NeedsVerificationItem[] {
  return findings
    .filter((f) => f.status === "Unknown")
    .map((f) => ({
      ruleId: f.ruleId,
      ruleName: f.ruleName,
      detail:
        NEEDS_VERIFICATION_DETAIL_OVERRIDES[f.ruleId] ??
        [f.evidence, f.recommendation]
          .map((part) => part.trim())
          .filter(Boolean)
          .join(" "),
    }));
}

export function buildLocalScoreSummary(
  findings: RuleResult[],
  evaluatedMode: "light" | "dark" | null
): string | null {
  if (!findings.length) {
    return null;
  }

  const failing = findings.filter((f) => f.status === "Fail");
  const unverified = findings.filter((f) => f.status === "Unknown");
  const modeLabel = evaluatedMode === "dark" ? "Dark mode" : "Light mode";

  if (!failing.length && !unverified.length) {
    return `${modeLabel} button passes all ${findings.length} accessibility rules with a perfect score.`;
  }

  // The seeded sample's single failure. WCAG 1.4.3 exempts disabled controls
  // from the contrast minimum, so the honest framing is a design-system
  // recommendation rather than a violation. Matched on the sample's actual
  // colour values so the suggested token is never offered for CSS it does not
  // apply to.
  const sampleDisabledContrast =
    failing.length === 1 &&
    !unverified.length &&
    failing[0].ruleId === "rule-5-text-contrast" &&
    failing[0].evidence.includes(SAMPLE_DISABLED_TEXT) &&
    failing[0].evidence.includes(SAMPLE_DISABLED_BG);

  if (sampleDisabledContrast) {
    return (
      "Not a WCAG failure — disabled controls are exempt. OrchestratoR flags this " +
      "as a design-system readability recommendation. Recommended token: " +
      `${RECOMMENDED_DISABLED_TEXT}.`
    );
  }

  const passing = findings.length - failing.length - unverified.length;
  const parts = [`${modeLabel} button passes ${passing} of ${findings.length} accessibility rules.`];

  if (failing.length) {
    parts.push(
      `${failing.length} ${failing.length === 1 ? "rule needs" : "rules need"} attention: ` +
        `${failing.map((f) => f.ruleName).join(", ")}.`
    );
  }
  if (unverified.length) {
    parts.push(
      `${unverified.length} ${unverified.length === 1 ? "rule could" : "rules could"} not be verified from the snippet.`
    );
  }

  return parts.join(" ");
}
