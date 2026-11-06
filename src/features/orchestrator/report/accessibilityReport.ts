/**
 * Builds the exported Accessibility Report as report blocks (see reportModel.ts).
 * The Markdown and PDF exports both render the result, so they always carry the
 * same findings, approval scope, reviewer notes and timestamps.
 */
import {
  THEME_LABEL,
  describeCssSource,
  themeSectionTag,
  type EvaluationInputs,
  type ThemeMode,
} from "../doubleCheckReadiness";
import { buildObservationBlocks, type ObservationState } from "../interactionObservations";
import type { EvaluationResult } from "../types/evaluation";
import { line, type ReportBlock, type ReportModel } from "./reportModel";

const FINDING_PANEL_SORT_ORDER: Record<string, number> = { Fail: 0, Unknown: 1, Pass: 2, "N/A": 3 };

/**
 * The order findings are shown in the panel. Shared with the exported report so
 * the number on a finding card ("3.") refers to the same finding in both places.
 * The sort is stable, so rules keep their source order within a status.
 */
export function sortFindingsForPanel(findings: EvaluationResult["findings"]) {
  return [...findings].sort(
    (a, b) =>
      (FINDING_PANEL_SORT_ORDER[a.status] ?? 3) - (FINDING_PANEL_SORT_ORDER[b.status] ?? 3)
  );
}

export interface ReportApproval {
  at: string;
  theme: ThemeMode;
  findingTotal: number;
}

export interface BuildReportArgs {
  componentName: string;
  reviewerLabel: string;
  approval: ReportApproval;
  /** Already formatted, e.g. "11/06/2026 at 2:15 PM". */
  generatedAt: string;
  lightResult: EvaluationResult | null;
  darkResult: EvaluationResult | null;
  lightResultInputs: EvaluationInputs | null;
  darkResultInputs: EvaluationInputs | null;
  currentInputsByTheme: Record<ThemeMode, EvaluationInputs>;
  observations: ObservationState;
}

function buildThemeSection(
  theme: ThemeMode,
  result: EvaluationResult | null,
  resultInputs: EvaluationInputs | null,
  args: BuildReportArgs
): ReportBlock[] {
  const label = THEME_LABEL[theme];
  const tag = themeSectionTag({
    theme,
    hasResult: result !== null,
    resultInputs,
    currentInputs: args.currentInputsByTheme[theme],
    approvedTheme: args.approval.theme,
  });
  const heading: ReportBlock = {
    kind: "heading",
    level: 2,
    text: tag ? `${label} — ${tag}` : label,
  };

  if (!result) {
    return [
      heading,
      { kind: "gap" },
      {
        kind: "lines",
        lines: [
          line(
            `Not yet evaluated — switch to ${label.toLowerCase()} and run the accessibility check to include it.`
          ),
        ],
      },
    ];
  }

  const count = (status: string) => result.findings.filter((f) => f.status === status).length;
  const notApplicableCount = count("N/A");

  const findingItems: ReportBlock[] = sortFindingsForPanel(result.findings).map((f, index) => ({
    kind: "item",
    marker: `${index + 1}. `,
    text: `[${f.status}] ${f.ruleName} (${f.severity}) — ${f.evidence}`,
    detail: f.recommendation ? line(`Recommendation: ${f.recommendation}`, "secondary") : undefined,
  }));
  const fixItems: ReportBlock[] = result.recommendedFixes.map((fix) => ({
    kind: "item",
    marker: "- ",
    text: fix,
  }));

  return [
    heading,
    { kind: "gap" },
    {
      kind: "lines",
      lines: [
        line(`CSS source: ${describeCssSource(theme)}.`, "secondary"),
        line(
          `Score: ${result.healthScore}/100 (${count("Pass")} pass, ${count("Unknown")} unknown, ${count("Fail")} fail${
            notApplicableCount > 0 ? `, ${notApplicableCount} N/A` : ""
          })`
        ),
      ],
    },
    { kind: "gap" },
    { kind: "heading", level: 3, text: "Findings" },
    ...(findingItems.length
      ? findingItems
      : [{ kind: "item", marker: "- ", text: "No findings recorded." } as ReportBlock]),
    { kind: "gap" },
    { kind: "heading", level: 3, text: "Recommended fixes" },
    ...(fixItems.length ? fixItems : [{ kind: "item", marker: "- ", text: "None." } as ReportBlock]),
  ];
}

export function buildAccessibilityReport(args: BuildReportArgs): ReportModel {
  const { componentName, reviewerLabel, approval, generatedAt } = args;
  return {
    blocks: [
      { kind: "title", text: "OrchestratoR Accessibility Report" },
      { kind: "gap" },
      {
        kind: "lines",
        lines: [
          line(`Component: ${componentName}`),
          line(`Approved by ${reviewerLabel} · ${approval.at}`),
          line(
            `Approved scope: ${THEME_LABEL[approval.theme]} · all ${approval.findingTotal} evaluated findings`
          ),
          line(`Report generated: ${generatedAt}`, "secondary"),
        ],
      },
      { kind: "gap" },
      ...buildThemeSection("light", args.lightResult, args.lightResultInputs, args),
      { kind: "gap" },
      ...buildThemeSection("dark", args.darkResult, args.darkResultInputs, args),
      { kind: "gap" },
      ...buildObservationBlocks({ state: args.observations, theme: approval.theme }),
      { kind: "gap" },
      { kind: "rule" },
      { kind: "lines", lines: [line("Generated by OrchestratoR", "secondary")] },
    ],
  };
}
