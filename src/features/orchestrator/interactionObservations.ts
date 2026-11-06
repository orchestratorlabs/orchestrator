/**
 * State and report formatting for the optional interaction preview.
 *
 * The preview is a *simulated* save on a stand-in Button, so everything recorded
 * here is a reviewer's manual observation about that simulation. It is kept apart
 * from the component's findings, the Health Score and component approval, and none
 * of it is sent to DoubleCheck or Claude.
 *
 * Outcomes and notes are independent. A reviewer can leave a check Untested and
 * still save a note ("Screen reader unavailable"). The untested count falls only
 * when the reviewer explicitly selects an outcome.
 */
import { DEMO_REVIEWER_LABEL } from "./demoReviewer";
import { THEME_LABEL, describeCssSource, type ThemeMode } from "./doubleCheckReadiness";
import { line, renderMarkdown, type ReportBlock, type ReportLine } from "./report/reportModel";

export type CheckId = "focus" | "announcement";
export type CheckOutcome = "untested" | "no-issue" | "problem";

export interface CheckDefinition {
  id: CheckId;
  /** The radio-group heading, matching the Untested / No issue / Problem options beneath it. */
  heading: string;
  /** Label for the optional free-text note; it asks what the reviewer saw or heard. */
  noteLabel: string;
}

export const INTERACTION_CHECKS: readonly CheckDefinition[] = [
  {
    id: "focus",
    heading: "Keyboard focus after activation",
    noteLabel: "Where did focus go? (optional)",
  },
  {
    id: "announcement",
    heading: "Screen-reader announcement after saving",
    noteLabel: "What did you hear? (optional)",
  },
];

export const OUTCOME_LABEL: Record<CheckOutcome, string> = {
  untested: "Untested",
  "no-issue": "No issue observed",
  problem: "Problem observed",
};

export interface CheckState {
  outcome: CheckOutcome;
  note: string;
  /** Set only when the reviewer explicitly selected an outcome other than Untested. */
  outcomeRecordedAt: string | null;
  /** Set only when a non-empty note exists. */
  noteRecordedAt: string | null;
}

export type ObservationState = Record<CheckId, CheckState>;

const emptyCheck = (): CheckState => ({
  outcome: "untested",
  note: "",
  outcomeRecordedAt: null,
  noteRecordedAt: null,
});

export function createObservationState(): ObservationState {
  return { focus: emptyCheck(), announcement: emptyCheck() };
}

/** "MM/DD/YYYY at h:mm AM" — the same shape the approval stamp uses. */
export function formatStamp(date: Date): string {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const time = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return `${mm}/${dd}/${date.getFullYear()} at ${time}`;
}

/** Records an explicit outcome. Choosing "untested" again clears the outcome stamp. */
export function setOutcome(
  state: ObservationState,
  id: CheckId,
  outcome: CheckOutcome,
  now: Date
): ObservationState {
  return {
    ...state,
    [id]: {
      ...state[id],
      outcome,
      outcomeRecordedAt: outcome === "untested" ? null : formatStamp(now),
    },
  };
}

/** Saves a note without touching the outcome. An empty note clears its stamp. */
export function setNote(
  state: ObservationState,
  id: CheckId,
  note: string,
  now: Date
): ObservationState {
  return {
    ...state,
    [id]: {
      ...state[id],
      note,
      noteRecordedAt: note.trim() === "" ? null : formatStamp(now),
    },
  };
}

/** Counts checks whose outcome is Untested. Notes never change this. */
export function untestedCount(state: ObservationState): number {
  return INTERACTION_CHECKS.filter((check) => state[check.id].outcome === "untested").length;
}

export function interactionChipText(state: ObservationState): string {
  const untested = untestedCount(state);
  if (untested === 0) {
    return `Interaction preview: ${INTERACTION_CHECKS.length} checks recorded`;
  }
  return `Interaction preview: ${untested} ${untested === 1 ? "check" : "checks"} untested`;
}

/** What the stand-in does, shown in the dialog and summarised in the export. */
export const SIMULATION_BEHAVIOR_LINES: readonly string[] = [
  'The stand-in is a native <button type="button"> styled with the CSS source shown above.',
  "The label changes in place: Save changes → Saving… (about 1.5 seconds) → Changes saved.",
  'While saving it uses aria-disabled="true", not disabled, and ignores activation.',
  "This demo never moves keyboard focus.",
  'This demo adds no live region (no role="status" and no aria-live). Any announcement comes only from the label text changing.',
  "Reset simulation returns the button to Save changes.",
  "Every behavior listed here comes from the demo, not from your component.",
];

export const SIMULATION_BEHAVIOR_SUMMARY =
  "native button; the label changes in place (Save changes → Saving… → Changes saved); aria-disabled while saving; the demo never moves focus; no live region is added.";

/**
 * The export's interaction section, as report blocks. Always present, so an untested
 * check reads as Untested rather than going missing. Stamps appear only where
 * something was actually recorded. Both export formats render these same blocks.
 */
export function buildObservationBlocks(args: {
  state: ObservationState;
  theme: ThemeMode;
}): ReportBlock[] {
  const { state, theme } = args;
  const blocks: ReportBlock[] = [
    { kind: "heading", level: 2, text: "Interaction observations (manual, simulated)" },
    { kind: "gap" },
    {
      kind: "lines",
      lines: [
        line(
          "Source: stand-in Button, simulated save. Observations apply to this simulated save, not to the submitted component.",
          "secondary"
        ),
        line(`Stand-in styling (${THEME_LABEL[theme]}): ${describeCssSource(theme)}.`, "secondary"),
        line(`Demo behavior: ${SIMULATION_BEHAVIOR_SUMMARY}`, "secondary"),
        line("Not included in the Health Score or component approval.", "secondary"),
      ],
    },
    { kind: "gap" },
  ];

  INTERACTION_CHECKS.forEach((check, index) => {
    const entry = state[check.id];
    const lines: ReportLine[] = [line(`Status: ${OUTCOME_LABEL[entry.outcome]}`)];
    if (entry.note.trim() !== "") {
      // Labelled with the prompt the reviewer saw, so a bare note stays readable.
      lines.push(line(`Note (${check.noteLabel.replace(/ \(optional\)$/, "")}): ${entry.note.trim()}`));
    }
    if (entry.outcomeRecordedAt) {
      lines.push(line(`Outcome recorded by ${DEMO_REVIEWER_LABEL} · ${entry.outcomeRecordedAt}`, "secondary"));
    }
    if (entry.noteRecordedAt) {
      lines.push(line(`Note added by ${DEMO_REVIEWER_LABEL} · ${entry.noteRecordedAt}`, "secondary"));
    }
    if (index > 0) blocks.push({ kind: "gap" });
    blocks.push({ kind: "check", marker: `${index + 1}. `, title: check.heading, lines });
  });

  return blocks;
}

/** The same section as Markdown text. */
export function formatObservationsSection(args: {
  state: ObservationState;
  theme: ThemeMode;
}): string {
  return renderMarkdown(buildObservationBlocks(args));
}
