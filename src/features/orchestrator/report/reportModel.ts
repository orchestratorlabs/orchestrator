/**
 * The accessibility report as data.
 *
 * The report is built once, as a list of blocks, and every export format is a
 * renderer over that same list. That is what keeps the Markdown and PDF exports
 * consistent: findings, approval scope, reviewer notes and timestamps are written
 * in exactly one place (`accessibilityReport.ts` and `interactionObservations.ts`)
 * and neither renderer can drift from the other.
 *
 * Pure and free of React and the DOM, so it is unit tested (`npm test`).
 */

/** "body" prints black in the PDF; "secondary" prints gray. Markdown ignores tone. */
export type Tone = "body" | "secondary";

export interface ReportLine {
  text: string;
  tone: Tone;
}

export type ReportBlock =
  /** "# Title" */
  | { kind: "title"; text: string }
  /** "## …" (level 2) or "### …" (level 3). */
  | { kind: "heading"; level: 2 | 3; text: string }
  /** Plain lines with no list marker. */
  | { kind: "lines"; lines: ReportLine[] }
  /**
   * A list entry: `marker` + `text`, then an optional `detail` line indented under
   * it. Used for findings (detail = the recommendation) and for fix bullets.
   */
  | { kind: "item"; marker: string; text: string; detail?: ReportLine }
  /**
   * One interaction check: a numbered title and the lines recorded under it. The
   * PDF keeps the whole block (outcome, note and attribution) on one page.
   */
  | { kind: "check"; marker: string; title: string; lines: ReportLine[] }
  /** "---" */
  | { kind: "rule" }
  /**
   * A blank line in the Markdown. The PDF does its own spacing and ignores these;
   * they exist so the Markdown output stays byte-for-byte what it has always been.
   */
  | { kind: "gap" };

export interface ReportModel {
  blocks: ReportBlock[];
}

export const line = (text: string, tone: Tone = "body"): ReportLine => ({ text, tone });

/** Continuation lines are indented to the width of the list marker. */
const indentFor = (marker: string) => " ".repeat(marker.length);

/** Renders blocks to Markdown. The output format here is the existing .md export. */
export function renderMarkdown(blocks: readonly ReportBlock[]): string {
  const out: string[] = [];
  for (const block of blocks) {
    switch (block.kind) {
      case "title":
        out.push(`# ${block.text}`);
        break;
      case "heading":
        out.push(`${block.level === 2 ? "##" : "###"} ${block.text}`);
        break;
      case "lines":
        for (const l of block.lines) out.push(l.text);
        break;
      case "item": {
        const detail = block.detail ? `\n${indentFor(block.marker)}${block.detail.text}` : "";
        out.push(`${block.marker}${block.text}${detail}`);
        break;
      }
      case "check":
        out.push(`${block.marker}${block.title}`);
        for (const l of block.lines) out.push(`${indentFor(block.marker)}${l.text}`);
        break;
      case "rule":
        out.push("---");
        break;
      case "gap":
        out.push("");
        break;
    }
  }
  return out.join("\n");
}
