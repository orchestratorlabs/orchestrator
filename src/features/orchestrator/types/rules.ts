import type { RuleResult, RuleStatus } from "./evaluation";

export interface RagRegistryRule {
  id: string;
  name: string;
  sourceReference: string;
}

export const ORDERED_FINDING_STATUS: RuleStatus[] = ["Pass", "Unknown", "Fail"];

export function orderFindingsForMvp(
  findings: RuleResult[],
  sourceRuleOrder: string[]
): RuleResult[] {
  const statusOrder = new Map<RuleStatus, number>(
    ORDERED_FINDING_STATUS.map((status, index) => [status, index])
  );
  const ruleOrder = new Map<string, number>(
    sourceRuleOrder.map((ruleId, index) => [ruleId, index])
  );

  return [...findings].sort((a, b) => {
    const statusDelta =
      (statusOrder.get(a.status) ?? 99) - (statusOrder.get(b.status) ?? 99);
    if (statusDelta !== 0) {
      return statusDelta;
    }
    return (ruleOrder.get(a.ruleId) ?? 9999) - (ruleOrder.get(b.ruleId) ?? 9999);
  });
}
