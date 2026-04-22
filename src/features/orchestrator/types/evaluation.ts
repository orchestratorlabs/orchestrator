export type RuleStatus = "Pass" | "Unknown" | "Fail";

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
