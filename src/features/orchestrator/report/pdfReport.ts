/**
 * Renders a report model (reportModel.ts) to a PDF, with no dependency.
 *
 *  - US Letter (8.5 × 11 in), white page, black body text, gray secondary text.
 *  - Real text operators in Helvetica / Helvetica-Bold, so the text is selectable
 *    and searchable.
 *  - Headings stay with the content that follows them, and each list entry and each
 *    interaction check (outcome, note and attribution) is kept together on one page.
 *
 * The file is untagged (no PDF structure tree): it sets the document language and
 * title, but is not a tagged, accessible PDF. The Markdown export is the
 * screen-reader-friendly format.
 */
import { textWidth, toWinAnsi, type PdfFont } from "./pdfFonts";
import type { ReportBlock, ReportModel, Tone } from "./reportModel";

export const PAGE_WIDTH = 612; // 8.5 in × 72
export const PAGE_HEIGHT = 792; // 11 in × 72
const MARGIN_X = 54;
const MARGIN_TOP = 54;
const MARGIN_BOTTOM = 66; // leaves room for the footer
const FOOTER_BASELINE = 36;
const BODY_WIDTH = PAGE_WIDTH - 2 * MARGIN_X;
const BODY_HEIGHT = PAGE_HEIGHT - MARGIN_TOP - MARGIN_BOTTOM;

const COLOR: Record<Tone, string> = {
  body: "0 0 0", // black
  secondary: "0.35 0.35 0.35", // gray (#595959, 7:1 on white)
};

export interface PlacedLine {
  /** WinAnsi text for the line (marker excluded). */
  text: string;
  /** Hanging list marker drawn at the left margin on the first line of an entry. */
  marker?: string;
  x: number;
  font: PdfFont;
  size: number;
  tone: Tone;
  /** Distance from the top of the page to the top of the line box. */
  top: number;
  leading: number;
}

export interface PdfPage {
  lines: PlacedLine[];
  /** y (from page top) of horizontal rules on this page. */
  rules: number[];
}

interface RawLine {
  text: string;
  marker?: string;
  x: number;
  font: PdfFont;
  size: number;
  tone: Tone;
  leading: number;
}

export interface Element {
  lines: RawLine[];
  spaceBefore: number;
  spaceAfter: number;
  keepTogether: boolean;
  keepWithNext: boolean;
  rule?: boolean;
}

/** Wraps WinAnsi text to `width`, honoring explicit newlines and breaking over-long words. */
function wrap(text: string, font: PdfFont, size: number, width: number): string[] {
  const out: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    const words = paragraph.split(" ");
    let current = "";
    const push = () => {
      out.push(current);
      current = "";
    };
    for (const word of words) {
      const candidate = current === "" ? word : `${current} ${word}`;
      if (textWidth(candidate, font, size) <= width) {
        current = candidate;
        continue;
      }
      if (current !== "") push();
      // A single word wider than the line (a long path or hash) is broken by character.
      let rest = word;
      while (textWidth(rest, font, size) > width) {
        let cut = rest.length - 1;
        while (cut > 1 && textWidth(rest.slice(0, cut), font, size) > width) cut -= 1;
        out.push(rest.slice(0, cut));
        rest = rest.slice(cut);
      }
      current = rest;
    }
    push();
  }
  return out;
}

const BODY_SIZE = 10;
const BODY_LEADING = 14;
const SMALL_SIZE = 9.5;
const SMALL_LEADING = 13;
const LIST_INDENT = 20;

function textLines(
  text: string,
  opts: { font: PdfFont; size: number; leading: number; tone: Tone; x: number; marker?: string }
): RawLine[] {
  const width = BODY_WIDTH - (opts.x - MARGIN_X);
  const wrapped = wrap(text, opts.font, opts.size, width);
  return wrapped.map((t, i) => ({
    text: t,
    marker: i === 0 ? opts.marker : undefined,
    x: opts.x,
    font: opts.font,
    size: opts.size,
    tone: opts.tone,
    leading: opts.leading,
  }));
}

function toElements(blocks: readonly ReportBlock[], replacedRef: { count: number }): Element[] {
  const conv = (s: string) => {
    const { text, replaced } = toWinAnsi(s);
    replacedRef.count += replaced;
    return text;
  };
  const elements: Element[] = [];

  for (const block of blocks) {
    switch (block.kind) {
      case "gap":
        break; // the PDF spaces blocks itself
      case "title":
        elements.push({
          lines: textLines(conv(block.text), { font: "bold", size: 18, leading: 24, tone: "body", x: MARGIN_X }),
          spaceBefore: 0, spaceAfter: 8, keepTogether: true, keepWithNext: true,
        });
        break;
      case "heading": {
        const h2 = block.level === 2;
        elements.push({
          lines: textLines(conv(block.text), {
            font: "bold", size: h2 ? 13 : 11, leading: h2 ? 18 : 15, tone: "body", x: MARGIN_X,
          }),
          spaceBefore: h2 ? 16 : 9, spaceAfter: h2 ? 5 : 3, keepTogether: true, keepWithNext: true,
        });
        break;
      }
      case "lines": {
        const lines = block.lines.flatMap((l) =>
          textLines(conv(l.text), { font: "regular", size: BODY_SIZE, leading: BODY_LEADING, tone: l.tone, x: MARGIN_X })
        );
        elements.push({ lines, spaceBefore: 0, spaceAfter: 6, keepTogether: false, keepWithNext: false });
        break;
      }
      case "item": {
        const lines = textLines(conv(block.text), {
          font: "regular", size: BODY_SIZE, leading: BODY_LEADING, tone: "body",
          x: MARGIN_X + LIST_INDENT, marker: conv(block.marker.trim()),
        });
        if (block.detail) {
          lines.push(
            ...textLines(conv(block.detail.text), {
              font: "regular", size: SMALL_SIZE, leading: SMALL_LEADING, tone: block.detail.tone,
              x: MARGIN_X + LIST_INDENT,
            })
          );
        }
        elements.push({ lines, spaceBefore: 0, spaceAfter: 5, keepTogether: true, keepWithNext: false });
        break;
      }
      case "check": {
        const lines: RawLine[] = [
          ...textLines(conv(block.title), {
            font: "bold", size: 10.5, leading: 15, tone: "body",
            x: MARGIN_X + LIST_INDENT, marker: conv(block.marker.trim()),
          }),
          ...block.lines.flatMap((l) =>
            textLines(conv(l.text), {
              font: "regular", size: BODY_SIZE, leading: BODY_LEADING, tone: l.tone, x: MARGIN_X + LIST_INDENT,
            })
          ),
        ];
        elements.push({ lines, spaceBefore: 4, spaceAfter: 8, keepTogether: true, keepWithNext: false });
        break;
      }
      case "rule":
        elements.push({ lines: [], spaceBefore: 8, spaceAfter: 8, keepTogether: true, keepWithNext: true, rule: true });
        break;
    }
  }
  return elements;
}

const heightOf = (lines: RawLine[]) => lines.reduce((sum, l) => sum + l.leading, 0);

/** Lays elements out onto pages. Pure; exported so page breaks can be tested. */
export function layoutElements(elements: Element[]): PdfPage[] {
  const pages: PdfPage[] = [{ lines: [], rules: [] }];
  let cursor = MARGIN_TOP;

  const newPage = () => {
    pages.push({ lines: [], rules: [] });
    cursor = MARGIN_TOP;
  };
  const atTop = () => cursor === MARGIN_TOP;
  const remaining = () => PAGE_HEIGHT - MARGIN_BOTTOM - cursor;

  /** Height that must fit to start `el` here without stranding it. */
  const startNeed = (el: Element): number => {
    if (el.rule) return el.spaceBefore + 1;
    if (el.keepTogether) return Math.min(heightOf(el.lines), BODY_HEIGHT);
    return heightOf(el.lines.slice(0, 2)); // avoid a lone first line at the page foot
  };

  elements.forEach((el, index) => {
    const next = elements[index + 1];
    let need = (atTop() ? 0 : el.spaceBefore) + startNeed(el);
    if (el.keepWithNext && next) need += el.spaceAfter + startNeed(next);
    if (!atTop() && need > remaining()) newPage();
    if (!atTop()) cursor += el.spaceBefore;

    if (el.rule) {
      pages[pages.length - 1].rules.push(cursor);
      cursor += 1 + el.spaceAfter;
      return;
    }
    for (const raw of el.lines) {
      if (cursor + raw.leading > PAGE_HEIGHT - MARGIN_BOTTOM && !atTop()) newPage();
      pages[pages.length - 1].lines.push({ ...raw, top: cursor });
      cursor += raw.leading;
    }
    cursor += el.spaceAfter;
  });

  return pages;
}

// ── PDF serialisation ────────────────────────────────────────────────────────

/** A PDF literal string for WinAnsi text: parentheses, backslashes and high bytes escaped. */
function pdfString(text: string): string {
  let out = "";
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    const ch = text[i];
    if (ch === "(" || ch === ")" || ch === "\\") out += `\\${ch}`;
    else if (code < 32 || code > 126) out += `\\${code.toString(8).padStart(3, "0")}`;
    else out += ch;
  }
  return `(${out})`;
}

const num = (n: number) => (Math.round(n * 100) / 100).toString();

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function pdfDate(d: Date) {
  return `D:${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`;
}

function pageContent(page: PdfPage, pageNumber: number, pageCount: number, footerText: string): string {
  const ops: string[] = [];
  ops.push("1 1 1 rg", `0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT} re`, "f"); // white page
  for (const y of page.rules) {
    const pdfY = PAGE_HEIGHT - y;
    ops.push("0.75 G", "0.75 w", `${MARGIN_X} ${num(pdfY)} m`, `${PAGE_WIDTH - MARGIN_X} ${num(pdfY)} l`, "S");
  }
  const show = (text: string, x: number, baseline: number, font: PdfFont, size: number, tone: Tone) =>
    `BT /${font === "bold" ? "F2" : "F1"} ${num(size)} Tf ${COLOR[tone]} rg ${num(x)} ${num(baseline)} Td ${pdfString(text)} Tj ET`;

  for (const l of page.lines) {
    // Baseline sits about three-quarters of the way down the line box.
    const baseline = PAGE_HEIGHT - (l.top + l.leading * 0.74);
    if (l.marker) ops.push(show(l.marker, MARGIN_X, baseline, l.font, l.size, "body"));
    if (l.text !== "") ops.push(show(l.text, l.x, baseline, l.font, l.size, l.tone));
  }
  const footer = `${footerText} · Page ${pageNumber} of ${pageCount}`;
  ops.push(show(toWinAnsi(footer).text, MARGIN_X, FOOTER_BASELINE, "regular", 8, "secondary"));
  return ops.join("\n");
}

export interface RenderedPdf {
  bytes: Uint8Array<ArrayBuffer>;
  pages: PdfPage[];
  /** Characters the PDF fonts could not represent (shown as "?"); 0 when nothing was lost. */
  replacedCharacters: number;
}

export function renderPdf(model: ReportModel, options: { title?: string; now?: Date } = {}): RenderedPdf {
  const title = options.title ?? "OrchestratoR Accessibility Report";
  const now = options.now ?? new Date();
  const replacedRef = { count: 0 };

  const elements = toElements(model.blocks, replacedRef);
  // Fonts and WinAnsi conversion happen above, so the count is final before this runs.
  if (replacedRef.count > 0) {
    const n = replacedRef.count;
    const notice = toWinAnsi(
      `Note: ${n} character${n === 1 ? "" : "s"} in this report could not be shown in the PDF and ${
        n === 1 ? "was" : "were"
      } replaced with "?". The Markdown export keeps the original text.`
    ).text;
    elements.push({
      lines: textLines(notice, { font: "regular", size: SMALL_SIZE, leading: SMALL_LEADING, tone: "secondary", x: MARGIN_X }),
      spaceBefore: 8, spaceAfter: 0, keepTogether: true, keepWithNext: false,
    });
  }

  const pages = layoutElements(elements);

  // Object numbering: 1 catalog, 2 pages, 3 regular font, 4 bold font, 5 info,
  // then a page object and a content object for each page.
  const FIRST_PAGE_OBJ = 6;
  const pageObj = (i: number) => FIRST_PAGE_OBJ + i * 2;
  const bodies: string[] = [];
  bodies[1] = "<< /Type /Catalog /Pages 2 0 R /Lang (en-US) /ViewerPreferences << /DisplayDocTitle true >> >>";
  bodies[2] = `<< /Type /Pages /Kids [${pages.map((_, i) => `${pageObj(i)} 0 R`).join(" ")}] /Count ${pages.length} >>`;
  bodies[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  bodies[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
  bodies[5] = `<< /Title ${pdfString(toWinAnsi(title).text)} /Producer (OrchestratoR) /Creator (OrchestratoR) /CreationDate (${pdfDate(now)}) >>`;
  pages.forEach((page, i) => {
    const content = pageContent(page, i + 1, pages.length, "OrchestratoR Accessibility Report");
    bodies[pageObj(i)] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
      `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${pageObj(i) + 1} 0 R >>`;
    bodies[pageObj(i) + 1] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
  });

  let file = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (let n = 1; n < bodies.length; n += 1) {
    offsets[n] = file.length;
    file += `${n} 0 obj\n${bodies[n]}\nendobj\n`;
  }
  const xrefAt = file.length;
  const total = bodies.length; // objects 1..total-1, plus the free entry 0
  file += `xref\n0 ${total}\n0000000000 65535 f \n`;
  for (let n = 1; n < total; n += 1) file += `${String(offsets[n]).padStart(10, "0")} 00000 n \n`;
  file += `trailer\n<< /Size ${total} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;

  // Everything above is ASCII (high bytes are octal-escaped), so string length is byte length.
  const encoded = new TextEncoder().encode(file);
  const bytes = new Uint8Array(new ArrayBuffer(encoded.length));
  bytes.set(encoded);
  return { bytes, pages, replacedCharacters: replacedRef.count };
}
