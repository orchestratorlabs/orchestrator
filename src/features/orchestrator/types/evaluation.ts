/**
 * "N/A" (Not Applicable) means the rule verifiably does not apply to this
 * component, for example the ARIA role rule on a native <button>. It is set only
 * by the evaluator's own logic, deducts nothing, and is never counted as a Pass,
 * Fail, or Unknown. See docs/mvp_scoring_policy.md.
 */
export type RuleStatus = "Pass" | "N/A" | "Unknown" | "Fail";

export interface A11yVerifiedItem {
  criterion: string;
  result: string;
  detail: string;
}

export interface A11yDoubleCheckResult {
  status: "PASS" | "PARTIAL" | "FAIL";
  confidenceScore: string;
  shipReadiness: string;
  summary: string;
  sourcesChecked: string[];
  evidenceSummary: string;
  verifiedItems: A11yVerifiedItem[];
  remainingRisks: string[];
  recommendedNextStep: string;
}

export interface RuleResult {
  ruleId: string;
  ruleName: string;
  status: RuleStatus;
  evidence: string;
  severity: "Low" | "Medium" | "High" | "Critical" | "Unknown";
  recommendation: string;
  sourceReference: string;
}

export interface EvaluationResult {
  healthScore: number;
  summary: string;
  findings: RuleResult[];
  recommendedFixes: string[];
  scoringPolicyLabel: string;
  unknownCount: number;
}

export interface MvpScoringPolicy {
  name: "MVP Simple Transparent Scoring";
  sourceOfWeights: "RAG" | "MVP_Fallback_No_RAG_Weights";
  formula: "score = round((passCount / (passCount + failCount)) * 100)";
  unknownHandling: "Unknown is surfaced separately and excluded from score denominator";
  notes: string;
}

export const MVP_SCORING_POLICY: MvpScoringPolicy = {
  name: "MVP Simple Transparent Scoring",
  sourceOfWeights: "MVP_Fallback_No_RAG_Weights",
  formula: "score = round((passCount / (passCount + failCount)) * 100)",
  unknownHandling: "Unknown is surfaced separately and excluded from score denominator",
  notes:
    "This is explicit MVP scoring logic used only when RAG/registry does not define weighting. No hidden weights are used."
};
